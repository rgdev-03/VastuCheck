import { beforeEach, describe, expect, it, vi } from "vitest";

const { geocodeMock, importLibraryMock, searchNearbyMock } = vi.hoisted(() => ({
  geocodeMock: vi.fn(),
  importLibraryMock: vi.fn(),
  searchNearbyMock: vi.fn(),
}));

vi.mock("@googlemaps/js-api-loader", () => ({
  importLibrary: importLibraryMock,
  setOptions: vi.fn(),
}));

import {
  distanceInMeters,
  directionFromCoordinates,
  locationFromGooglePlace,
  NEARBY_PLACE_FIELDS,
  normalizeNearbyPlace,
  reverseGoogleLocation,
  searchNearbyPlaces,
} from "./googleMaps";

beforeEach(() => {
  searchNearbyMock.mockReset();
  geocodeMock.mockReset();
  importLibraryMock.mockReset().mockImplementation((library) => {
    if (library === "geocoding") {
      return Promise.resolve({ Geocoder: class Geocoder { geocode = geocodeMock; } });
    }
    if (library === "places") {
      return Promise.resolve({
        Place: { searchNearby: searchNearbyMock },
        SearchNearbyRankPreference: { DISTANCE: "DISTANCE" },
      });
    }
    return Promise.resolve({});
  });
});

describe("Google Maps location conversion", () => {
  it("converts a selected place into the shared form shape", () => {
    const result = locationFromGooglePlace({
      displayName: "Lake House",
      formattedAddress: "1 Main Street, Bengaluru, India",
      location: { lat: () => 12.9715987, lng: () => 77.5945664 },
      addressComponents: [
        { longText: "Karnataka", types: ["administrative_area_level_1"] },
        { longText: "India", shortText: "IN", types: ["country"] },
      ],
    });

    expect(result).toEqual({
      address: "1 Main Street, Bengaluru, India",
      state: "Karnataka",
      country: "India",
      latitude: "12.971599",
      longitude: "77.594566",
    });
  });
});

describe("Google nearby places", () => {
  it("calculates and rounds straight-line distance in metres", () => {
    expect(distanceInMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0.001 },
    )).toBe(111);
  });

  it("normalizes optional place fields", () => {
    expect(normalizeNearbyPlace({
      id: "place-1",
      displayName: { text: "Corner Shop" },
      location: { lat: 12.9716, lng: 77.5946 },
    }, { latitude: 12.9716, longitude: 77.5946 })).toEqual({
      id: "place-1",
      name: "Corner Shop",
      address: "Address unavailable",
      primaryType: "place",
      category: "other",
      typeLabel: "Place",
      latitude: 12.9716,
      longitude: 77.5946,
      distanceMeters: 0,
      direction: "N",
      googleMapsUri: "",
    });
  });

  it("classifies bearings into eight compass directions", () => {
    const origin = { latitude: 0, longitude: 0 };
    expect(directionFromCoordinates(origin, { latitude: 1, longitude: 0 })).toBe("N");
    expect(directionFromCoordinates(origin, { latitude: 1, longitude: 1 })).toBe("NE");
    expect(directionFromCoordinates(origin, { latitude: 0, longitude: 1 })).toBe("E");
    expect(directionFromCoordinates(origin, { latitude: -1, longitude: 1 })).toBe("SE");
    expect(directionFromCoordinates(origin, { latitude: -1, longitude: 0 })).toBe("S");
    expect(directionFromCoordinates(origin, { latitude: -1, longitude: -1 })).toBe("SW");
    expect(directionFromCoordinates(origin, { latitude: 0, longitude: -1 })).toBe("W");
    expect(directionFromCoordinates(origin, { latitude: 1, longitude: -1 })).toBe("NW");
  });

  it("uses the selected radius for a distance-ranked search and returns nearest first", async () => {
    searchNearbyMock.mockResolvedValue({
      places: [
        { id: "far", displayName: "Far", location: { lat: 0, lng: 0.001 } },
        { id: "near", displayName: "Near", location: { lat: 0, lng: 0.0001 } },
      ],
    });

    const result = await searchNearbyPlaces({ latitude: 0, longitude: 0 }, 1000);

    expect(searchNearbyMock).toHaveBeenCalledWith({
      fields: NEARBY_PLACE_FIELDS,
      locationRestriction: { center: { lat: 0, lng: 0 }, radius: 1000 },
      maxResultCount: 20,
      rankPreference: "DISTANCE",
    });
    expect(result.map((place) => place.id)).toEqual(["near", "far"]);
  });
});

describe("Google reverse geocoding", () => {
  it("returns the reverse-geocoded address for the selected coordinates", async () => {
    geocodeMock.mockResolvedValue({ results: [{
      formatted_address: "1 Main Street, Bengaluru, India",
      address_components: [
        { long_name: "Karnataka", types: ["administrative_area_level_1"] },
        { long_name: "India", types: ["country"] },
      ],
    }] });

    await expect(reverseGoogleLocation({ latitude: 12.971599, longitude: 77.594566 })).resolves.toEqual({
      address: "1 Main Street, Bengaluru, India",
      state: "Karnataka",
      country: "India",
      latitude: "12.971599",
      longitude: "77.594566",
      addressResolution: "reverse_geocode",
    });
    expect(geocodeMock).toHaveBeenCalledWith({
      location: { lat: 12.971599, lng: 77.594566 },
      fulfillOnZeroResults: true,
    });
  });

  it("falls back to the nearest Google Place address while preserving the selected coordinates", async () => {
    geocodeMock.mockRejectedValue(new Error("REQUEST_DENIED"));
    searchNearbyMock.mockResolvedValue({ places: [{
      formattedAddress: "204 Garden Ridge Road, Maryland, United States",
      addressComponents: [
        { longText: "Maryland", types: ["administrative_area_level_1"] },
        { longText: "United States", types: ["country"] },
      ],
    }] });

    const result = await reverseGoogleLocation({ latitude: 39.273808, longitude: -76.710079 });

    expect(result).toEqual({
      address: "204 Garden Ridge Road, Maryland, United States",
      state: "Maryland",
      country: "United States",
      latitude: "39.273808",
      longitude: "-76.710079",
      addressResolution: "nearby_place",
    });
    expect(searchNearbyMock).toHaveBeenCalledWith(expect.objectContaining({
      locationRestriction: { center: { lat: 39.273808, lng: -76.710079 }, radius: 200 },
      maxResultCount: 1,
      rankPreference: "DISTANCE",
    }));
  });
});
