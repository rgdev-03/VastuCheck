import math


DIRECTIONS = (
    ("N", 0), ("NE", 45), ("E", 90), ("SE", 135),
    ("S", 180), ("SW", 225), ("W", 270), ("NW", 315),
)


def destination(latitude, longitude, bearing_degrees, distance_m):
    radius = 6371008.8
    angular = distance_m / radius
    bearing = math.radians(bearing_degrees)
    latitude_1 = math.radians(latitude)
    longitude_1 = math.radians(longitude)
    latitude_2 = math.asin(
        math.sin(latitude_1) * math.cos(angular)
        + math.cos(latitude_1) * math.sin(angular) * math.cos(bearing)
    )
    longitude_2 = longitude_1 + math.atan2(
        math.sin(bearing) * math.sin(angular) * math.cos(latitude_1),
        math.cos(angular) - math.sin(latitude_1) * math.sin(latitude_2),
    )
    return math.degrees(latitude_2), math.degrees(longitude_2)


def haversine_m(latitude_1, longitude_1, latitude_2, longitude_2):
    lat1, lat2 = math.radians(latitude_1), math.radians(latitude_2)
    lat_delta = lat2 - lat1
    lon_delta = math.radians(longitude_2 - longitude_1)
    value = (
        math.sin(lat_delta / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(lon_delta / 2) ** 2
    )
    return 6371008.8 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def bearing_from(latitude_1, longitude_1, latitude_2, longitude_2):
    lat1, lat2 = math.radians(latitude_1), math.radians(latitude_2)
    delta = math.radians(longitude_2 - longitude_1)
    y = math.sin(delta) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(delta)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def direction_for_bearing(bearing):
    return DIRECTIONS[int((bearing + 22.5) // 45) % 8][0]
