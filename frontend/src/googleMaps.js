import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export const googleMapId = import.meta.env.VITE_GOOGLE_MAP_ID || "DEMO_MAP_ID";
export const NEARBY_SEARCH_RADIUS_METERS = 200;
export const NEARBY_SEARCH_MAX_RESULTS = 20;

export const NEARBY_PLACE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "primaryType",
  "primaryTypeDisplayName",
  "googleMapsURI",
];

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
  const latitude = Number(coordinates.latitude);
  const longitude = Number(coordinates.longitude);

  try {
    const { Geocoder } = await importLibrary("geocoding");
    const geocoder = new Geocoder();
    const response = await geocoder.geocode({
      location: { lat: latitude, lng: longitude },
      fulfillOnZeroResults: true,
    });
    const result = response.results?.find((item) => item.formatted_address) || response.results?.[0];
    if (!result) throw new Error("No reverse-geocoding result found.");
    return {
      address: result.formatted_address || "",
      state: addressPart(result.address_components, "administrative_area_level_1"),
      country: addressPart(result.address_components, "country"),
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
      addressResolution: "reverse_geocode",
    };
  } catch (geocodingError) {
    const { places } = await loadGoogleLibraries();
    const response = await places.Place.searchNearby({
      fields: ["displayName", "formattedAddress", "addressComponents", "location", "primaryType"],
      locationRestriction: {
        center: { lat: latitude, lng: longitude },
        radius: NEARBY_SEARCH_RADIUS_METERS,
      },
      maxResultCount: 1,
      rankPreference: places.SearchNearbyRankPreference.DISTANCE,
    });
    const place = response.places?.[0];
    if (!place?.formattedAddress) throw geocodingError;
    return {
      address: place.formattedAddress,
      state: addressPart(place.addressComponents, "administrative_area_level_1"),
      country: addressPart(place.addressComponents, "country"),
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
      addressResolution: "nearby_place",
    };
  }
}

function coordinateValue(value) {
  return typeof value === "function" ? value() : value;
}

export function distanceInMeters(origin, destination) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const latitude1 = toRadians(Number(origin.latitude));
  const latitude2 = toRadians(Number(destination.latitude));
  const latitudeDelta = latitude2 - latitude1;
  const longitudeDelta = toRadians(Number(destination.longitude) - Number(origin.longitude));
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

const COMPASS_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function directionFromCoordinates(origin, destination) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const latitude1 = toRadians(Number(origin.latitude));
  const latitude2 = toRadians(Number(destination.latitude));
  const longitudeDelta = toRadians(Number(destination.longitude) - Number(origin.longitude));
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2);
  const x = Math.cos(latitude1) * Math.sin(latitude2)
    - Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta);
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return COMPASS_DIRECTIONS[Math.floor((bearing + 22.5) / 45) % 8];
}

export function normalizeNearbyPlace(place, origin) {
  const latitude = Number(coordinateValue(place.location?.lat));
  const longitude = Number(coordinateValue(place.location?.lng));
  if (!place.id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    id: place.id,
    name: typeof place.displayName === "string" ? place.displayName : place.displayName?.text || "Unnamed place",
    address: place.formattedAddress || "Address unavailable",
    primaryType: place.primaryType || "place",
    category: nearbyPlaceCategory(place),
    typeLabel: typeof place.primaryTypeDisplayName === "string"
      ? place.primaryTypeDisplayName
      : place.primaryTypeDisplayName?.text || "Place",
    latitude,
    longitude,
    distanceMeters: distanceInMeters(origin, { latitude, longitude }),
    direction: directionFromCoordinates(origin, { latitude, longitude }),
    googleMapsUri: place.googleMapsURI || "",
  };
}

export const PLACE_CATEGORIES = {
  education: new Set(["school", "primary_school", "secondary_school", "preschool", "university", "college", "educational_institution"]),
  healthcare: new Set(["hospital", "doctor", "dentist", "pharmacy", "medical_clinic", "health" ]),
  transport: new Set(["transit_station", "bus_station", "train_station", "subway_station", "airport", "taxi_stand", "parking"]),
  commercial: new Set(["store", "shopping_mall", "supermarket", "grocery_store", "market", "department_store", "business_center"]),
};

export function nearbyPlaceCategory(place) {
  const type = String(place.primaryType || "").toLowerCase();
  for (const [category, types] of Object.entries(PLACE_CATEGORIES)) {
    if (types.has(type)) return category;
  }
  return "other";
}

export async function searchNearbyPlaces(origin, radiusMeters = NEARBY_SEARCH_RADIUS_METERS) {
  const latitude = Number(origin.latitude);
  const longitude = Number(origin.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

  const { places } = await loadGoogleLibraries();
  const response = await places.Place.searchNearby({
    fields: NEARBY_PLACE_FIELDS,
    locationRestriction: {
      center: { lat: latitude, lng: longitude },
      radius: radiusMeters,
    },
    maxResultCount: NEARBY_SEARCH_MAX_RESULTS,
    rankPreference: places.SearchNearbyRankPreference.DISTANCE,
  });

  return (response.places || [])
    .map((place, index) => ({ place: normalizeNearbyPlace(place, { latitude, longitude }), index }))
    .filter(({ place }) => place)
    .sort((left, right) => left.place.distanceMeters - right.place.distanceMeters || left.index - right.index)
    .map(({ place }) => place);
}

