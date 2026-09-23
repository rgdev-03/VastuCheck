import { describe, expect, it } from "vitest";
import { locationFromGooglePlace } from "./googleMaps";

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
