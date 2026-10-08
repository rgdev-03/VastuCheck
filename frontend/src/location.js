export function coordinatesOnly(coordinates) {
  return {
    address: "",
    state: "",
    country: "",
    latitude: coordinates.latitude.toFixed(6),
    longitude: coordinates.longitude.toFixed(6),
  };
}

export function polygonCentroid(boundary) {
  const ring = boundary?.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 4) return null;
  const points = ring.slice(0, -1);
  let twiceArea = 0;
  let longitudeTotal = 0;
  let latitudeTotal = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [longitude, latitude] = points[index];
    const [nextLongitude, nextLatitude] = points[(index + 1) % points.length];
    const cross = longitude * nextLatitude - nextLongitude * latitude;
    twiceArea += cross;
    longitudeTotal += (longitude + nextLongitude) * cross;
    latitudeTotal += (latitude + nextLatitude) * cross;
  }
  if (Math.abs(twiceArea) < 1e-12) {
    const total = points.reduce((sum, [longitude, latitude]) => ({
      latitude: sum.latitude + latitude,
      longitude: sum.longitude + longitude,
    }), { latitude: 0, longitude: 0 });
    return { latitude: total.latitude / points.length, longitude: total.longitude / points.length };
  }
  return {
    longitude: longitudeTotal / (3 * twiceArea),
    latitude: latitudeTotal / (3 * twiceArea),
  };
}

