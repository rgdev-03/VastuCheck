const firstValue = (attributes, keys) => {
  for (const key of keys) {
    const value = attributes?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return "";
};

export function pointCoordinates(point) {
  const longitude = point?.longitude ?? point?.x;
  const latitude = point?.latitude ?? point?.y;
  if (!Number.isFinite(Number(longitude)) || !Number.isFinite(Number(latitude))) return null;
  return { longitude: Number(longitude), latitude: Number(latitude) };
}

export function locationFromGeocode(response, coordinates, fallbackAddress = "") {
  const attributes = response?.attributes || {};
  return {
    address: firstValue(attributes, ["LongLabel", "Match_addr", "Place_addr", "Address"]) || response?.address || fallbackAddress,
    state: firstValue(attributes, ["Region", "RegionAbbr", "State"]),
    country: firstValue(attributes, ["CntryName", "Country", "CountryCode"]),
    latitude: coordinates.latitude.toFixed(6),
    longitude: coordinates.longitude.toFixed(6),
  };
}

export function coordinatesOnly(coordinates) {
  return {
    address: "",
    state: "",
    country: "",
    latitude: coordinates.latitude.toFixed(6),
    longitude: coordinates.longitude.toFixed(6),
  };
}

