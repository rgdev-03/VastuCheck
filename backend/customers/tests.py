from django.urls import reverse
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Property, PropertyAnalysis
from .services import direction_for_bearing


def boundary():
    return {
        "type": "Polygon",
        "coordinates": [[
            [76.90260, 15.15250], [76.90286, 15.15250], [76.90286, 15.15226],
            [76.90260, 15.15226], [76.90260, 15.15250],
        ]],
    }


def payload(**overrides):
    data = {
        "name": "Asha Rao", "email": "asha@example.com", "phone_number": "+91 98765 43210",
        "property_name": "Ballari House", "address": "Ballari, Karnataka", "state": "Karnataka",
        "country": "India", "location": {"type": "Point", "coordinates": [76.902736, 15.152382]},
        "boundary": boundary(),
    }
    data.update(overrides)
    return data


class PropertyApiTests(APITestCase):
    url = reverse("property-list-create")

    def test_create_property_with_geometry_metrics(self):
        response = self.client.post(self.url, payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        record = Property.objects.get()
        self.assertAlmostEqual(record.location.x, 76.902736)
        self.assertGreater(response.data["area_sqm"], 0)
        self.assertEqual(response.data["location"]["type"], "Point")

    def test_boundary_is_required_and_must_cover_location(self):
        missing = self.client.post(self.url, payload(boundary=None), format="json")
        outside = self.client.post(
            self.url,
            payload(location={"type": "Point", "coordinates": [77.0, 16.0]}),
            format="json",
        )
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("boundary", missing.data)
        self.assertEqual(outside.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_invalid_geometry_type_and_phone(self):
        response = self.client.post(
            self.url,
            payload(
                phone_number="invalid",
                location={"type": "Polygon", "coordinates": boundary()["coordinates"]},
            ),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(set(response.data), {"phone_number", "location"})

    def test_patch_updates_boundary(self):
        created = self.client.post(self.url, payload(), format="json")
        changed = boundary()
        changed["coordinates"][0][1] = [76.90290, 15.15250]
        response = self.client.patch(
            reverse("property-detail", args=[created.data["id"]]), {"boundary": changed}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_legacy_endpoint_translates_coordinates(self):
        response = self.client.post(reverse("customer-list-create"), {
            "name": "Legacy", "email": "legacy@example.com", "phone_number": "1234567890",
            "property_name": "Point only", "address": "Ballari", "state": "Karnataka", "country": "India",
            "latitude": "15.152382", "longitude": "76.902736",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["latitude"], "15.152382")
        self.assertIsNone(Property.objects.get(pk=response.data["id"]).boundary)


class SurroundingsApiTests(APITestCase):
    def setUp(self):
        response = self.client.post(reverse("property-list-create"), payload(), format="json")
        self.property = Property.objects.get(pk=response.data["id"])

    def test_rejects_unsupported_radius(self):
        response = self.client.post(
            reverse("property-analysis-create", args=[self.property.id]), {"radius_m": 300}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(PropertyAnalysis.objects.filter(status="failed").count(), 1)

    def test_missing_provider_credentials_returns_partial_snapshot(self):
        response = self.client.post(
            reverse("property-analysis-create", args=[self.property.id]), {"radius_m": 500}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "partial")
        self.assertEqual(response.data["providers"]["mapbox"]["status"], "failed")
        self.assertEqual(PropertyAnalysis.objects.get().status, "partial")

    @patch("customers.services.analysis_service.SentinelLandcoverService")
    @patch("customers.services.analysis_service.SentinelTerrainService")
    @patch("customers.services.analysis_service.MapboxService")
    def test_provider_feature_is_classified_and_analysis_is_persisted(
        self, mapbox_class, terrain_class, landcover_class
    ):
        mapbox_class.return_value.nearby_features.return_value = [{
            "type": "road", "name": "Test Road", "distance_m": 42, "direction": "E",
            "source": "mapbox_streets_v8", "confidence": "high", "metrics": {},
        }]
        terrain_class.return_value.terrain_features.return_value = []
        landcover_class.return_value.landcover_features.return_value = []
        response = self.client.post(
            reverse("property-analysis-create", args=[self.property.id]), {"radius_m": 500}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["status"], "complete")
        self.assertEqual(set(response.data["directions"]), {"N", "NE", "E", "SE", "S", "SW", "W", "NW"})
        self.assertEqual(response.data["directions"]["E"]["features"][0]["type"], "road")
        latest = self.client.get(
            reverse("property-surroundings", args=[self.property.id]), {"radius_m": 500}, format="json",
        )
        self.assertEqual(latest.data["analysis_id"], response.data["analysis_id"])

    def test_compass_boundaries_are_deterministic(self):
        self.assertEqual(direction_for_bearing(22.49), "N")
        self.assertEqual(direction_for_bearing(22.5), "NE")
        self.assertEqual(direction_for_bearing(337.5), "N")
