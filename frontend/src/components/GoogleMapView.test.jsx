import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoogleMapView from "./GoogleMapView";

const mocks = vi.hoisted(() => ({
  maps: [],
  markers: [],
  circles: [],
  infoWindows: [],
}));

vi.mock("../googleMaps", () => {
  class MapView {
    constructor() {
      this.setCenter = vi.fn();
      this.setZoom = vi.fn();
      this.panTo = vi.fn();
      this.addListener = vi.fn(() => ({ remove: vi.fn() }));
      mocks.maps.push(this);
    }
  }
  class AdvancedMarkerElement {
    constructor(options) {
      Object.assign(this, options);
      this.addListener = vi.fn(() => ({ remove: vi.fn() }));
      mocks.markers.push(this);
    }
  }
  class Circle {
    constructor(options) {
      Object.assign(this, options);
      this.setMap = vi.fn((map) => { this.map = map; });
      mocks.circles.push(this);
    }
  }
  class InfoWindow {
    constructor() {
      this.setContent = vi.fn();
      this.open = vi.fn();
      this.close = vi.fn();
      mocks.infoWindows.push(this);
    }
  }
  class PlaceAutocompleteElement {
    constructor() { return document.createElement("div"); }
  }
  return {
    googleMapId: "test-map-id",
    googleMapsApiKey: "test-key",
    NEARBY_SEARCH_RADIUS_METERS: 200,
    locationFromGooglePlace: vi.fn(),
    loadGoogleLibraries: vi.fn().mockResolvedValue({
      maps: { Map: MapView, Circle, InfoWindow },
      marker: { AdvancedMarkerElement },
      places: { PlaceAutocompleteElement },
    }),
  };
});

const places = [
  { id: "one", name: "First place", typeLabel: "Store", address: "1 Main Street", latitude: 12.972, longitude: 77.595, distanceMeters: 50 },
  { id: "two", name: "Second place", typeLabel: "Cafe", address: "2 Main Street", latitude: 12.973, longitude: 77.596, distanceMeters: 100 },
];

describe("GoogleMapView nearby overlays", () => {
  beforeEach(() => {
    mocks.maps.length = 0;
    mocks.markers.length = 0;
    mocks.circles.length = 0;
    mocks.infoWindows.length = 0;
  });

  it("creates and cleans up the radius circle and numbered place markers", async () => {
    const { unmount } = render(<GoogleMapView
      active
      location={{ latitude: "12.971599", longitude: "77.594566" }}
      pickMode={false}
      onPointSelect={vi.fn()}
      onLocationChange={vi.fn()}
      onStatus={vi.fn()}
      nearbyPlaces={places}
      selectedNearbyPlaceId=""
    />);

    await waitFor(() => expect(mocks.circles).toHaveLength(1));
    expect(mocks.circles[0]).toMatchObject({ radius: 200, center: { lat: 12.971599, lng: 77.594566 } });
    expect(mocks.markers).toHaveLength(3);
    expect(mocks.markers.slice(1).map((marker) => marker.title)).toEqual(["1. First place", "2. Second place"]);

    const nearbyMarkers = mocks.markers.slice(1);
    const circle = mocks.circles[0];
    unmount();
    expect(nearbyMarkers.every((marker) => marker.map === null)).toBe(true);
    expect(circle.setMap).toHaveBeenCalledWith(null);
  });

  it("focuses a selected nearby marker and opens its details", async () => {
    const { rerender } = render(<GoogleMapView
      active
      location={{ latitude: "12.971599", longitude: "77.594566" }}
      pickMode={false}
      onPointSelect={vi.fn()}
      onLocationChange={vi.fn()}
      onStatus={vi.fn()}
      nearbyPlaces={places}
      selectedNearbyPlaceId=""
    />);
    await waitFor(() => expect(mocks.markers).toHaveLength(3));

    rerender(<GoogleMapView
      active
      location={{ latitude: "12.971599", longitude: "77.594566" }}
      pickMode={false}
      onPointSelect={vi.fn()}
      onLocationChange={vi.fn()}
      onStatus={vi.fn()}
      nearbyPlaces={places}
      selectedNearbyPlaceId="two"
    />);

    await waitFor(() => expect(mocks.maps[0].panTo).toHaveBeenCalledWith({ lat: 12.973, lng: 77.596 }));
    expect(mocks.infoWindows[0].open).toHaveBeenCalledWith({ map: mocks.maps[0], anchor: mocks.markers[2] });
  });

  it("hides nearby markers in point-selection mode so they cannot intercept map clicks", async () => {
    const { rerender } = render(<GoogleMapView
      location={{ latitude: "12.971599", longitude: "77.594566" }}
      pickMode={false}
      onPointSelect={vi.fn()}
      onLocationChange={vi.fn()}
      onStatus={vi.fn()}
      nearbyPlaces={places}
      selectedNearbyPlaceId=""
    />);
    await waitFor(() => expect(mocks.markers).toHaveLength(3));
    const nearbyMarkers = mocks.markers.slice(1);

    rerender(<GoogleMapView
      location={{ latitude: "12.971599", longitude: "77.594566" }}
      pickMode
      onPointSelect={vi.fn()}
      onLocationChange={vi.fn()}
      onStatus={vi.fn()}
      nearbyPlaces={places}
      selectedNearbyPlaceId=""
    />);

    await waitFor(() => expect(nearbyMarkers.every((marker) => marker.map === null)).toBe(true));
    expect(mocks.markers).toHaveLength(3);
  });
});
