import { describe, expect, it } from "vitest";
import { coordinatesOnly, locationFromGeocode, pointCoordinates } from "./location";

describe("location helpers", () => {
  it("normalizes an ArcGIS point and formatted address", () => {
    const coordinates = pointCoordinates({ longitude: 77.5945664, latitude: 12.9715987 });
    const result = locationFromGeocode({
      address: "Fallback",
      attributes: { LongLabel: "1 Main Street, Bengaluru", Region: "Karnataka", CntryName: "India" },
    }, coordinates);

    expect(result).toEqual({
      address: "1 Main Street, Bengaluru",
      state: "Karnataka",
      country: "India",
      latitude: "12.971599",
      longitude: "77.594566",
    });
  });

  it("keeps coordinates while clearing address fields when geocoding is unavailable", () => {
    expect(coordinatesOnly({ latitude: 10, longitude: 20 })).toEqual({
      address: "", state: "", country: "", latitude: "10.000000", longitude: "20.000000",
    });
  });
});

