import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export const googleMapId = import.meta.env.VITE_GOOGLE_MAP_ID || "DEMO_MAP_ID";

let configured = false;

function configureGoogleMaps() {
  if (!configured && googleMapsApiKey) {
    setOptions({ key: googleMapsApiKey, v: "weekly" });
    configured = true;
  }
}

export async function loadGoogleLibraries() {
  if (!googleMapsApiKey) throw new Error("Google Maps API key is missing.");
  configureGoogleMaps();
  const [maps, marker, places] = await Promise.all([
    importLibrary("maps"),
    importLibrary("marker"),
    importLibrary("places"),
  ]);
  return { maps, marker, places };
}

function addressPart(components, type, short = false) {
  const component = components?.find((item) => item.types?.includes(type));
  return component ? (short ? component.shortText || component.short_name : component.longText || component.long_name) : "";
}

export function locationFromGooglePlace(place) {
  const latitude = typeof place.location?.lat === "function" ? place.location.lat() : place.location?.lat;
  const longitude = typeof place.location?.lng === "function" ? place.location.lng() : place.location?.lng;
  return {
    address: place.formattedAddress || place.displayName || "",
    state: addressPart(place.addressComponents, "administrative_area_level_1"),
    country: addressPart(place.addressComponents, "country"),
    latitude: Number(latitude).toFixed(6),
    longitude: Number(longitude).toFixed(6),
  };
}

export async function reverseGoogleLocation(coordinates) {
  if (!googleMapsApiKey) throw new Error("Google Maps API key is missing.");
  configureGoogleMaps();
  const { Geocoder } = await importLibrary("geocoding");
  const geocoder = new Geocoder();
  const response = await geocoder.geocode({ location: { lat: coordinates.latitude, lng: coordinates.longitude } });
  const result = response.results?.[0];
  if (!result) throw new Error("No address found.");
  return {
    address: result.formatted_address || "",
    state: addressPart(result.address_components, "administrative_area_level_1"),
    country: addressPart(result.address_components, "country"),
    latitude: Number(coordinates.latitude).toFixed(6),
    longitude: Number(coordinates.longitude).toFixed(6),
  };
}

