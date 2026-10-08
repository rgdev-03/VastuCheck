import { describe, expect, it } from "vitest";
import { coordinatesOnly, polygonCentroid } from "./location";

describe("location helpers", () => {
  it("keeps coordinates while clearing address fields when geocoding is unavailable", () => {
    expect(coordinatesOnly({ latitude: 10, longitude: 20 })).toEqual({
      address: "", state: "", country: "", latitude: "10.000000", longitude: "20.000000",
    });
  });

  it("calculates the centroid of a saved polygon", () => {
    expect(polygonCentroid({
      type: "Polygon",
      coordinates: [[[76, 12], [78, 12], [78, 14], [76, 14], [76, 12]]],
    })).toEqual({ latitude: 13, longitude: 77 });
  });
});

