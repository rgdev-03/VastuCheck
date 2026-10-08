from django.contrib.gis.db.models.functions import Area

from customers.models import Property

from .geo import DIRECTIONS, bearing_from, destination, direction_for_bearing, haversine_m
from .google_places_service import GooglePlacesService
from .mapbox_service import MapboxService
from .provider import ProviderError
from .sentinel_auth import SentinelAuthService
from .sentinel_landcover_service import SentinelLandcoverService
from .sentinel_terrain_service import SentinelTerrainService


ALLOWED_RADII = {100, 200, 500, 1000}
FEATURE_PRIORITY = {"water": 0, "waterway": 1, "road": 2, "railway": 3, "building": 4}


class AnalysisError(Exception):
    status_code = 400


class MissingBoundary(AnalysisError):
    status_code = 409


def _provider_call(name, callback, providers):
    try:
        features = callback()
        providers[name] = {"status": "success"}
        return features
    except ProviderError as error:
        providers[name] = {"status": "failed", "detail": str(error)}
        return []
    except Exception:
        providers[name] = {"status": "failed", "detail": f"{name} failed unexpectedly."}
        return []


def _merge_duplicates(features):
    result = []
    seen = set()
    for feature in features:
        key = (
            feature.get("direction"),
            feature.get("type"),
            (feature.get("name") or "").casefold(),
            round(feature.get("distance_m", 0) / 5),
        )
        if key not in seen:
            seen.add(key)
            result.append(feature)
    return result


def analyze_property(property_record, radius_m, services=None):
    if radius_m not in ALLOWED_RADII:
        raise AnalysisError("radius_m must be one of 100, 200, 500, or 1000.")
    if not property_record.boundary:
        raise MissingBoundary("Draw and save a property boundary before running analysis.")

    centroid = property_record.boundary.centroid
    services = services or {}
    auth = services.get("sentinel_auth") or SentinelAuthService()
    mapbox = services.get("mapbox") or MapboxService()
    terrain = services.get("sentinel_terrain") or SentinelTerrainService(auth)
    landcover = services.get("sentinel_landcover") or SentinelLandcoverService(auth)

    providers = {"google": GooglePlacesService.status()}
    features = []
    features.extend(_provider_call(
        "mapbox", lambda: mapbox.nearby_features(centroid.y, centroid.x, radius_m), providers
    ))
    features.extend(_provider_call(
        "sentinel_terrain", lambda: terrain.terrain_features(centroid.y, centroid.x, radius_m), providers
    ))
    features.extend(_provider_call(
        "sentinel_landcover", lambda: landcover.landcover_features(centroid.y, centroid.x, radius_m), providers
    ))

    by_direction = {code: {"features": []} for code, _ in DIRECTIONS}
    for feature in _merge_duplicates(features):
        feature = dict(feature)
        code = feature.pop("direction", None)
        if code in by_direction:
            by_direction[code]["features"].append(feature)
    for section in by_direction.values():
        section["features"].sort(
            key=lambda item: (item["distance_m"], FEATURE_PRIORITY.get(item["type"], 99), item["type"])
        )

    provider_successes = [item["status"] == "success" for key, item in providers.items() if key != "google"]
    result_status = "complete" if provider_successes and all(provider_successes) else "partial"
    sources = {
        "mapbox": "Mapbox Streets v8",
        "sentinel_terrain": "Copernicus DEM GLO-30 (GLO-90 fallback)",
        "sentinel_landcover": "Sentinel-2 L2A",
        "google": "Google Places (client-side)",
    }
    area = Property.objects.filter(pk=property_record.pk).annotate(metric=Area("boundary")).values_list(
        "metric", flat=True
    ).first()
    return {
        "analysis_version": "2.0",
        "status": result_status,
        "radius_m": radius_m,
        "property": {
            "id": property_record.id,
            "location": {
                "type": "Point",
                "coordinates": [property_record.location.x, property_record.location.y],
            },
            "area_sqm": round(area.sq_m, 2) if area else None,
        },
        "sources": sources,
        "providers": providers,
        "directions": by_direction,
    }
