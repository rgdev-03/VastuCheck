import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import MapPicker from "./MapPicker";

const { locationToAddressMock, reverseGoogleLocationMock } = vi.hoisted(() => ({
  locationToAddressMock: vi.fn(),
  reverseGoogleLocationMock: vi.fn(),
}));
vi.mock("@arcgis/core/config.js", () => ({ default: {} }));
vi.mock("@arcgis/core/rest/locator.js", () => ({ locationToAddress: locationToAddressMock }));
vi.mock("@arcgis/core/Graphic.js", () => ({ default: class Graphic { constructor(value) { Object.assign(this, value); } } }));
vi.mock("@arcgis/core/geometry/Point.js", () => ({ default: class Point { constructor(value) { Object.assign(this, value); } } }));
vi.mock("@arcgis/core/layers/GraphicsLayer.js", () => ({
  default: class GraphicsLayer { add = vi.fn(); removeAll = vi.fn(); },
}));
vi.mock("@arcgis/map-components/components/arcgis-map", () => ({}));
vi.mock("@arcgis/map-components/components/arcgis-zoom", () => ({}));
vi.mock("@arcgis/map-components/components/arcgis-search", () => ({}));
vi.mock("@arcgis/map-components/components/arcgis-fullscreen", () => ({}));
vi.mock("@arcgis/map-components/components/arcgis-basemap-toggle", () => ({}));
vi.mock("../googleMaps", () => ({
  googleMapsApiKey: "test-google-key",
  reverseGoogleLocation: reverseGoogleLocationMock,
}));
vi.mock("./GoogleMapView", () => ({
  default: ({ location, onPointSelect }) => <div data-testid="google-map-view">
    {location.latitude},{location.longitude}
    <button type="button" onClick={() => onPointSelect({ latitude: 39.273808, longitude: -76.710079 })}>Mock Google map click</button>
  </div>,
}));

beforeAll(() => {
  if (!customElements.get("arcgis-map")) {
    customElements.define("arcgis-map", class extends HTMLElement {
      constructor() {
        super();
        this.map = { add: vi.fn(), remove: vi.fn() };
        this.constraints = {};
      }
      viewOnReady() { return Promise.resolve(); }
      goTo = vi.fn(() => Promise.resolve());
    });
  }
});

describe("MapPicker", () => {
  beforeEach(() => {
    locationToAddressMock.mockReset();
    locationToAddressMock.mockResolvedValue({
      address: "1 Main Street",
      attributes: { Region: "Karnataka", CntryName: "India" },
    });
    reverseGoogleLocationMock.mockReset();
    reverseGoogleLocationMock.mockResolvedValue({
      address: "204 Garden Ridge Road",
      state: "Maryland",
      country: "United States",
      latitude: "39.273808",
      longitude: "-76.710079",
    });
  });

  it("ignores ordinary map clicks and accepts exactly one click in pick mode", async () => {
    const onLocationChange = vi.fn();
    const { container } = render(<MapPicker location={{ latitude: "", longitude: "" }} onLocationChange={onLocationChange} />);
    const map = container.querySelector("arcgis-map");
    await screen.findByRole("button", { name: "Select on map" });

    map.dispatchEvent(new CustomEvent("arcgisViewClick", { detail: { mapPoint: { latitude: 10, longitude: 20 } } }));
    expect(onLocationChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Select on map" }));
    map.dispatchEvent(new CustomEvent("arcgisViewClick", { detail: { mapPoint: { latitude: 10, longitude: 20 } } }));
    await waitFor(() => expect(locationToAddressMock).toHaveBeenCalledOnce());
    expect(onLocationChange).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: "10.000000", longitude: "20.000000", country: "India" }));

    map.dispatchEvent(new CustomEvent("arcgisViewClick", { detail: { mapPoint: { latitude: 30, longitude: 40 } } }));
    expect(locationToAddressMock).toHaveBeenCalledOnce();
  });

  it("keeps selected coordinates when reverse geocoding fails", async () => {
    locationToAddressMock.mockRejectedValue(new Error("No match"));
    const onLocationChange = vi.fn();
    const { container } = render(<MapPicker location={{ latitude: "", longitude: "" }} onLocationChange={onLocationChange} />);
    await screen.findByRole("button", { name: "Select on map" });
    fireEvent.click(screen.getByRole("button", { name: "Select on map" }));
    container.querySelector("arcgis-map").dispatchEvent(new CustomEvent("arcgisViewClick", { detail: { mapPoint: { latitude: 10, longitude: 20 } } }));

    expect(await screen.findByText(/no address was found/i)).toBeInTheDocument();
    expect(onLocationChange).toHaveBeenCalledWith(expect.objectContaining({ latitude: "10.000000", address: "" }));
  });

  it("preserves the previous selection when location permission is denied", async () => {
    const getCurrentPosition = vi.fn((success, failure) => failure({ code: 1 }));
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    const onLocationChange = vi.fn();
    render(<MapPicker location={{ latitude: "12.000000", longitude: "77.000000" }} onLocationChange={onLocationChange} />);

    fireEvent.click(await screen.findByRole("button", { name: "Use current location" }));

    expect(await screen.findByText(/permission was denied/i)).toBeInTheDocument();
    expect(onLocationChange).not.toHaveBeenCalled();
  });

  it("moves the map to coordinates loaded from a saved property", async () => {
    const { container } = render(<MapPicker location={{ latitude: "12.971599", longitude: "77.594566" }} onLocationChange={vi.fn()} />);
    const map = container.querySelector("arcgis-map");

    await waitFor(() => expect(map.goTo).toHaveBeenCalledWith({ center: [77.594566, 12.971599], zoom: 19 }));
  });

  it("switches to Google while preserving the selected coordinates", async () => {
    render(<MapPicker location={{ latitude: "12.971599", longitude: "77.594566" }} onLocationChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Google" }));

    expect(screen.getByRole("tab", { name: "Google" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("google-map-view")).toHaveTextContent("12.971599,77.594566");
  });

  it("falls back to Esri address details when Google reverse geocoding fails", async () => {
    reverseGoogleLocationMock.mockRejectedValue(new Error("REQUEST_DENIED"));
    const onLocationChange = vi.fn();
    render(<MapPicker location={{ latitude: "", longitude: "" }} onLocationChange={onLocationChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Google" }));
    fireEvent.click(await screen.findByRole("button", { name: "Select on map" }));
    fireEvent.click(screen.getByRole("button", { name: "Mock Google map click" }));

    expect(await screen.findByText(/resolved with the Esri fallback/i)).toBeInTheDocument();
    expect(onLocationChange).toHaveBeenLastCalledWith(expect.objectContaining({
      address: "1 Main Street",
      state: "Karnataka",
      country: "India",
      latitude: "39.273808",
      longitude: "-76.710079",
    }));
  });
});
