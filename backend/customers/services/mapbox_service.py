import requests
from django.conf import settings
from django.contrib.gis.geos import GEOSGeometry

from .geo import bearing_from, direction_for_bearing, haversine_m
from .provider import ProviderError, response_error


LAYER_TYPES = {
    "building": "building",
    "road": "road",
    "transportation": "road",
    "railway": "railway",
    "water": "water",
    "waterway": "waterway",
    "landuse": "landuse",
}


class MapboxService:
    provider = "mapbox"

    def __init__(self, access_token=None, session=None):
        self.access_token = access_token or settings.MAPBOX_ACCESS_TOKEN
        self.session = session or requests.Session()

    def nearby_features(self, latitude, longitude, radius_m):
        if not self.access_token:
            raise ProviderError(self.provider, "MAPBOX_ACCESS_TOKEN is not configured.")
        url = settings.MAPBOX_TILEQUERY_URL.format(longitude=longitude, latitude=latitude)
        try:
            response = self.session.get(
                url,
                params={
                    "access_token": self.access_token,
                    "radius": radius_m,
                    "limit": 50,
                    "layers": "building,road,water,waterway,landuse",
                    "dedupe": "true",
                },
                timeout=settings.PROVIDER_TIMEOUT_SECONDS,
            )
        except requests.RequestException as error:
            raise ProviderError(self.provider, f"Mapbox request failed: {error}") from error
        if not response.ok:
            raise response_error(response, self.provider)
        return self._normalize(response.json().get("features", []), latitude, longitude, radius_m)

    def _normalize(self, features, latitude, longitude, radius_m):
        normalized = []
        seen = set()
        for item in features:
            properties = item.get("properties") or {}
            tilequery = properties.get("tilequery") or {}
            layer = tilequery.get("layer") or item.get("source-layer") or properties.get("layer") or ""
            road_class = properties.get("class") or properties.get("type")
            feature_type = "railway" if layer == "road" and road_class in {
                "rail", "railway", "transit", "major_rail", "minor_rail"
            } else LAYER_TYPES.get(layer)
            if not feature_type:
                continue
            point = self._representative_point(item.get("geometry"))
            if not point:
                continue
            feature_latitude, feature_longitude = point
            distance = tilequery.get("distance")
            if distance is None:
                distance = haversine_m(latitude, longitude, feature_latitude, feature_longitude)
            if distance > radius_m:
                continue
            source_id = str(item.get("id") or properties.get("osm_id") or "")
            key = (layer, source_id, round(feature_latitude, 6), round(feature_longitude, 6))
            if key in seen:
                continue
            seen.add(key)
            normalized.append({
                "type": feature_type,
                "name": properties.get("name") or properties.get("name_en") or None,
                "distance_m": round(distance),
                "direction": direction_for_bearing(
                    bearing_from(latitude, longitude, feature_latitude, feature_longitude)
                ),
                "source": "mapbox_streets_v8",
                "confidence": "high",
                "metrics": {"layer": layer},
                "geometry": item.get("geometry"),
            })
        return normalized

    @staticmethod
    def _representative_point(geometry):
        if not geometry:
            return None
        try:
            shape = GEOSGeometry(__import__("json").dumps(geometry), srid=4326)
        except (TypeError, ValueError):
            return None
        point = shape if shape.geom_type == "Point" else shape.centroid
        return point.y, point.x
