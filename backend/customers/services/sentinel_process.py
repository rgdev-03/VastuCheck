from io import BytesIO

import requests
from PIL import Image
from django.conf import settings

from .geo import destination
from .provider import ProviderError, response_error


class SentinelProcessService:
    provider = "sentinel"
    resolution_m = 30

    def __init__(self, auth, session=None):
        self.auth = auth
        self.session = session or requests.Session()

    def process_image(self, latitude, longitude, radius_m, data, evalscript, resolution_m=None):
        resolution = resolution_m or self.resolution_m
        south, west = destination(latitude, longitude, 225, radius_m * 1.45)
        north, east = destination(latitude, longitude, 45, radius_m * 1.45)
        size = max(3, min(512, round(radius_m * 2 / resolution) + 1))
        payload = {
            "input": {
                "bounds": {
                    "bbox": [west, south, east, north],
                    "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"},
                },
                "data": [data],
            },
            "output": {
                "width": size,
                "height": size,
                "responses": [{"identifier": "default", "format": {"type": "image/png"}}],
            },
            "evalscript": evalscript,
        }
        try:
            response = self.session.post(
                settings.SENTINEL_PROCESS_URL,
                json=payload,
                headers={"Authorization": f"Bearer {self.auth.token()}"},
                timeout=settings.SENTINEL_TIMEOUT_SECONDS,
            )
        except requests.RequestException as error:
            raise ProviderError(self.provider, f"Sentinel Process API failed: {error}") from error
        if not response.ok:
            raise response_error(response, self.provider)
        try:
            image = Image.open(BytesIO(response.content))
            image.load()
        except (OSError, ValueError) as error:
            raise ProviderError(self.provider, "Sentinel returned an unreadable raster.") from error
        return image, (west, south, east, north)

    @staticmethod
    def pixel_at(image, bounds, latitude, longitude):
        west, south, east, north = bounds
        x = round((longitude - west) / (east - west) * (image.width - 1))
        y = round((north - latitude) / (north - south) * (image.height - 1))
        x = max(0, min(image.width - 1, x))
        y = max(0, min(image.height - 1, y))
        value = image.getpixel((x, y))
        return value[0] if isinstance(value, tuple) else value
