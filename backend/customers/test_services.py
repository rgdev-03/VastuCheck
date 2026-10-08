from io import BytesIO
from unittest.mock import Mock

from django.test import SimpleTestCase, override_settings
from PIL import Image

from .services.mapbox_service import MapboxService
from .services.provider import ProviderError, response_error
from .services.sentinel_auth import SentinelAuthService
from .services.sentinel_landcover_service import LANDCOVER_EVALSCRIPT
from .services.sentinel_process import SentinelProcessService
from .services.sentinel_terrain_service import SentinelTerrainService


class MapboxServiceTests(SimpleTestCase):
    def test_normalizes_and_classifies_tilequery_features(self):
        service = MapboxService(access_token="token", session=Mock())
        features = service._normalize([{
            "id": "rail-1",
            "geometry": {"type": "Point", "coordinates": [76.903, 15.152]},
            "properties": {
                "name": "Test railway",
                "class": "rail",
                "tilequery": {"layer": "road", "distance": 40},
            },
        }], 15.152, 76.902, 500)
        self.assertEqual(features[0]["type"], "railway")
        self.assertEqual(features[0]["direction"], "E")
        self.assertEqual(features[0]["distance_m"], 40)


class SentinelServiceTests(SimpleTestCase):
    def setUp(self):
        SentinelAuthService._cache.clear()

    def test_oauth_token_is_shared_until_expiry(self):
        response = Mock(ok=True)
        response.json.return_value = {"access_token": "cached-token", "expires_in": 3600}
        session = Mock()
        session.post.return_value = response
        first = SentinelAuthService("client", "secret", session=session)
        second = SentinelAuthService("client", "secret", session=session)
        self.assertEqual(first.token(), "cached-token")
        self.assertEqual(second.token(), "cached-token")
        session.post.assert_called_once()

    @override_settings(SENTINEL_PROCESS_URL="https://example.test/process/v1", SENTINEL_TIMEOUT_SECONDS=5)
    def test_process_request_uses_crs84_and_decodes_png(self):
        content = BytesIO()
        Image.new("L", (3, 3), color=7).save(content, format="PNG")
        response = Mock(ok=True, content=content.getvalue())
        session = Mock()
        session.post.return_value = response
        auth = Mock()
        auth.token.return_value = "token"
        service = SentinelProcessService(auth, session=session)
        image, _ = service.process_image(15.152, 76.902, 100, {"type": "dem"}, "script", 30)
        payload = session.post.call_args.kwargs["json"]
        self.assertEqual(
            payload["input"]["bounds"]["properties"]["crs"],
            "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
        )
        self.assertEqual(image.getpixel((1, 1)), 7)

    def test_landcover_evalscript_does_not_redeclare_builtin_index(self):
        self.assertNotIn("function index(", LANDCOVER_EVALSCRIPT)
        self.assertIn("function normalizedDifference(", LANDCOVER_EVALSCRIPT)

    def test_provider_error_preserves_http_status(self):
        response = Mock(status_code=403)
        response.json.return_value = {"error": {"message": "Not authorized"}}
        error = response_error(response, "sentinel")
        self.assertEqual(error.status_code, 403)

    def test_terrain_falls_back_to_glo90_when_glo30_is_forbidden(self):
        service = SentinelTerrainService(Mock())
        image = Image.new("I", (3, 3), color=6000)
        bounds = (76.89, 15.14, 76.91, 15.16)
        service.process_image = Mock(side_effect=[
            ProviderError("sentinel", "Not authorized", status_code=403),
            (image, bounds),
        ])

        self.assertEqual(service.terrain_features(15.15, 76.90, 100), [])
        requested_instances = [
            call.args[3]["dataFilter"]["demInstance"]
            for call in service.process_image.call_args_list
        ]
        self.assertEqual(requested_instances, ["COPERNICUS_30", "COPERNICUS_90"])

    def test_terrain_does_not_mask_non_permission_errors(self):
        service = SentinelTerrainService(Mock())
        service.process_image = Mock(
            side_effect=ProviderError("sentinel", "Bad request", status_code=400)
        )

        with self.assertRaises(ProviderError):
            service.terrain_features(15.15, 76.90, 100)
        service.process_image.assert_called_once()
