from .geo import DIRECTIONS, destination
from .provider import ProviderError
from .sentinel_process import SentinelProcessService


DEM_EVALSCRIPT = """//VERSION=3
function setup() {
  return {input: ["DEM", "dataMask"], output: {bands: 1, sampleType: "UINT16"}};
}
function evaluatePixel(s) {
  return [s.dataMask ? Math.max(1, Math.min(65535, Math.round((s.DEM + 1000) * 5))) : 0];
}
"""


class SentinelTerrainService(SentinelProcessService):
    def terrain_features(self, latitude, longitude, radius_m):
        dem_instance = "COPERNICUS_30"
        try:
            image, bounds = self._dem_image(latitude, longitude, radius_m, dem_instance)
        except ProviderError as error:
            # GLO-30 is restricted to approved CCM user categories in CDSE. Keep
            # using it for eligible accounts, but transparently use public GLO-90
            # when the Process API explicitly denies access to that collection.
            if error.status_code != 403:
                raise
            dem_instance = "COPERNICUS_90"
            image, bounds = self._dem_image(latitude, longitude, radius_m, dem_instance)
        origin = self._elevation(image, bounds, latitude, longitude)
        result = []
        if origin is None:
            return result
        distances = sorted({max(1, round(radius_m * value)) for value in (0.2, 0.5, 1.0)})
        for code, bearing in DIRECTIONS:
            samples = []
            for distance_m in distances:
                sample_latitude, sample_longitude = destination(latitude, longitude, bearing, distance_m)
                elevation = self._elevation(image, bounds, sample_latitude, sample_longitude)
                if elevation is not None:
                    samples.append((distance_m, elevation))
            if len(samples) < 2:
                continue
            endpoint_distance, endpoint = samples[-1]
            rise = endpoint - origin
            grade = rise * 100 / endpoint_distance
            if rise >= 10 and grade >= 3:
                result.append({
                    "type": "elevated_terrain",
                    "distance_m": endpoint_distance,
                    "direction": code,
                    "source": "copernicus_dem_glo30" if dem_instance == "COPERNICUS_30" else "copernicus_dem_glo90",
                    "confidence": "medium",
                    "metrics": {
                        "origin_elevation_m": round(origin, 1),
                        "rise_m": round(rise, 1),
                        "grade_percent": round(grade, 1),
                        "samples": [
                            {"distance_m": distance, "elevation_m": round(value, 1)}
                            for distance, value in samples
                        ],
                    },
                })
        return result

    def _dem_image(self, latitude, longitude, radius_m, dem_instance):
        return self.process_image(
            latitude,
            longitude,
            radius_m,
            {"type": "dem", "dataFilter": {"demInstance": dem_instance}},
            DEM_EVALSCRIPT,
            resolution_m=30 if dem_instance == "COPERNICUS_30" else 90,
        )

    def _elevation(self, image, bounds, latitude, longitude):
        encoded = self.pixel_at(image, bounds, latitude, longitude)
        return None if encoded == 0 else encoded / 5 - 1000
