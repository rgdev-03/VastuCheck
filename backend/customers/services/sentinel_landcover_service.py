import math
from datetime import date, timedelta

from .geo import DIRECTIONS, bearing_from, destination, direction_for_bearing, haversine_m
from .sentinel_process import SentinelProcessService


LANDCOVER_EVALSCRIPT = """//VERSION=3
function setup() {
  return {input: ["B02", "B03", "B04", "B08", "B11", "SCL", "dataMask"], output: {bands: 1, sampleType: "UINT8"}};
}
function normalizedDifference(a, b) { return (a - b) / (a + b || 0.0001); }
function evaluatePixel(s) {
  if (!s.dataMask || [1, 3, 8, 9, 10, 11].includes(s.SCL)) return [0];
  let ndvi = normalizedDifference(s.B08, s.B04);
  let ndwi = normalizedDifference(s.B03, s.B08);
  let ndbi = normalizedDifference(s.B11, s.B08);
  if (ndwi > 0.25) return [1];
  if (ndvi > 0.45) return [2];
  if (ndvi > 0.18) return [3];
  if (ndbi > 0.05) return [5];
  return [4];
}
"""

CLASSES = {1: "water", 2: "vegetation", 3: "agriculture", 4: "bare_open_land", 5: "built_up"}


class SentinelLandcoverService(SentinelProcessService):
    resolution_m = 10

    def landcover_features(self, latitude, longitude, radius_m):
        today = date.today()
        data = {
            "type": "sentinel-2-l2a",
            "dataFilter": {
                "timeRange": {
                    "from": (today - timedelta(days=365)).isoformat() + "T00:00:00Z",
                    "to": today.isoformat() + "T23:59:59Z",
                },
                "mosaickingOrder": "leastCC",
                "maxCloudCoverage": 30,
            },
        }
        image, bounds = self.process_image(
            latitude, longitude, radius_m, data, LANDCOVER_EVALSCRIPT, resolution_m=self.resolution_m
        )
        west, south, east, north = bounds
        totals = {code: 0 for code, _ in DIRECTIONS}
        counts = {code: {} for code, _ in DIRECTIONS}
        nearest = {code: {} for code, _ in DIRECTIONS}
        for y in range(image.height):
            sample_latitude = north - y / max(image.height - 1, 1) * (north - south)
            for x in range(image.width):
                sample_longitude = west + x / max(image.width - 1, 1) * (east - west)
                distance = haversine_m(latitude, longitude, sample_latitude, sample_longitude)
                if distance <= 0 or distance > radius_m:
                    continue
                value = self.pixel_at(image, bounds, sample_latitude, sample_longitude)
                feature_type = CLASSES.get(value)
                if not feature_type:
                    continue
                code = direction_for_bearing(
                    bearing_from(latitude, longitude, sample_latitude, sample_longitude)
                )
                totals[code] += 1
                counts[code][feature_type] = counts[code].get(feature_type, 0) + 1
                nearest[code][feature_type] = min(nearest[code].get(feature_type, math.inf), distance)
        result = []
        for code, _ in DIRECTIONS:
            for feature_type, count in counts[code].items():
                result.append({
                    "type": feature_type,
                    "distance_m": round(nearest[code][feature_type]),
                    "direction": code,
                    "source": "sentinel_2_l2a",
                    "confidence": "medium",
                    "metrics": {"coverage_percent": round(count * 100 / max(totals[code], 1), 1)},
                })
        return result
