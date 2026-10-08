import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MapPicker from "./MapPicker";

const { reverseGoogleLocationMock, searchNearbyPlacesMock, createPropertyAnalysisMock } = vi.hoisted(() => ({
  reverseGoogleLocationMock: vi.fn(),
  searchNearbyPlacesMock: vi.fn(),
  createPropertyAnalysisMock: vi.fn(),
}));

vi.mock("../googleMaps", () => ({
  googleMapsApiKey: "test-google-key",
  reverseGoogleLocation: reverseGoogleLocationMock,
  searchNearbyPlaces: searchNearbyPlacesMock,
}));
vi.mock("../api", () => ({ createPropertyAnalysis: createPropertyAnalysisMock }));
vi.mock("./GoogleMapView", () => ({
  default: ({ location, pickMode, boundaryMode, onPointSelect, onBoundaryVertexAdd, selectedGisFeatureId }) => (
    <div data-testid="google-map-view" data-selected-gis-feature={selectedGisFeatureId || ""}>
      {location.latitude},{location.longitude},{pickMode ? "picking" : "idle"},{boundaryMode ? "boundary" : "no-boundary"}
      <button type="button" onClick={() => onPointSelect({ latitude: 39.273808, longitude: -76.710079 })}>Mock Google map click</button>
      <button type="button" onClick={() => onBoundaryVertexAdd({ lat: 15.1525, lng: 76.9026 })}>Mock boundary vertex 1</button>
      <button type="button" onClick={() => onBoundaryVertexAdd({ lat: 15.1525, lng: 76.9029 })}>Mock boundary vertex 2</button>
      <button type="button" onClick={() => onBoundaryVertexAdd({ lat: 15.1522, lng: 76.9027 })}>Mock boundary vertex 3</button>
    </div>
  ),
}));

describe("Google-only MapPicker", () => {
  beforeEach(() => {
    reverseGoogleLocationMock.mockReset().mockResolvedValue({
      address: "204 Garden Ridge Road",
      state: "Maryland",
      country: "United States",
      latitude: "39.273808",
      longitude: "-76.710079",
      addressResolution: "reverse_geocode",
    });
    searchNearbyPlacesMock.mockReset().mockResolvedValue([]);
    createPropertyAnalysisMock.mockReset().mockResolvedValue({ analysis_id: 1, radius_m: 500, status: "complete", directions: {} });
  });

  it("shows only Google Maps and resolves a selected point", async () => {
    const onLocationChange = vi.fn();
    render(<MapPicker location={{ latitude: "", longitude: "" }} onLocationChange={onLocationChange} />);

    expect(screen.getByText("Google Maps")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pick location on map" }));
    expect(screen.getByTestId("google-map-view")).toHaveTextContent("picking");
    fireEvent.click(screen.getByRole("button", { name: "Mock Google map click" }));

    await waitFor(() => expect(reverseGoogleLocationMock).toHaveBeenCalledWith({ latitude: 39.273808, longitude: -76.710079 }));
    expect(onLocationChange).toHaveBeenLastCalledWith(expect.objectContaining({ address: "204 Garden Ridge Road" }));
  });

  it("keeps selected coordinates when Google reverse geocoding fails", async () => {
    reverseGoogleLocationMock.mockRejectedValue(new Error("No match"));
    const onLocationChange = vi.fn();
    render(<MapPicker location={{ latitude: "", longitude: "" }} onLocationChange={onLocationChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Mock Google map click" }));

    expect(await screen.findByText(/could not find an address/i)).toBeInTheDocument();
    expect(onLocationChange).toHaveBeenCalledWith(expect.objectContaining({ latitude: "39.273808", address: "" }));
  });

  it("labels an address approximated from the nearest Google place", async () => {
    reverseGoogleLocationMock.mockResolvedValue({
      address: "Nearest place address",
      state: "Karnataka",
      country: "India",
      latitude: "15.152685",
      longitude: "76.902695",
      addressResolution: "nearby_place",
    });
    const onLocationChange = vi.fn();
    render(<MapPicker location={{ latitude: "", longitude: "" }} onLocationChange={onLocationChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Mock Google map click" }));

    expect(await screen.findByText(/approximated from the nearest Google place/i)).toBeInTheDocument();
    expect(onLocationChange).toHaveBeenLastCalledWith(expect.not.objectContaining({ addressResolution: expect.anything() }));
  });

  it("preserves the previous selection when location permission is denied", () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: vi.fn((success, failure) => failure({ code: 1 })) },
    });
    const onLocationChange = vi.fn();
    render(<MapPicker location={{ latitude: "12", longitude: "77" }} onLocationChange={onLocationChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Use current location" }));

    expect(screen.getByText(/permission was denied/i)).toBeInTheDocument();
    expect(onLocationChange).not.toHaveBeenCalled();
  });

  it("draws, finishes, and clears a GeoJSON property boundary", () => {
    const onBoundaryChange = vi.fn();
    const { rerender } = render(<MapPicker
      location={{ latitude: "15.152382", longitude: "76.902736", boundary: null }}
      onLocationChange={vi.fn()}
      onBoundaryChange={onBoundaryChange}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Draw boundary" }));
    expect(screen.getByTestId("google-map-view")).toHaveTextContent("boundary");
    fireEvent.click(screen.getByRole("button", { name: "Mock boundary vertex 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Mock boundary vertex 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Mock boundary vertex 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish boundary" }));
    expect(onBoundaryChange).toHaveBeenCalledWith(expect.objectContaining({ type: "Polygon" }));
    rerender(<MapPicker
      location={{ latitude: "15.152382", longitude: "76.902736", boundary: { type: "Polygon", coordinates: [] } }}
      onLocationChange={vi.fn()}
      onBoundaryChange={onBoundaryChange}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Clear boundary" }));
    expect(onBoundaryChange).toHaveBeenLastCalledWith(null);
  });

  it("runs Google Places and GIS analysis together with the selected radius and boundary centroid", async () => {
    const onAnalysisChange = vi.fn();
    const boundary = { type: "Polygon", coordinates: [[[76, 12], [78, 12], [78, 14], [76, 14], [76, 12]]] };
    searchNearbyPlacesMock.mockResolvedValue([{ id: "place-1", name: "School", typeLabel: "School", category: "education", address: "Main Street", latitude: 13, longitude: 77, distanceMeters: 0, direction: "N", googleMapsUri: "" }]);
    createPropertyAnalysisMock.mockResolvedValue({ analysis_id: 2, radius_m: 1000, status: "complete", directions: {} });
    render(<MapPicker location={{ latitude: "13", longitude: "77", boundary }} propertyId={9} onAnalysisChange={onAnalysisChange} onLocationChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Search radius"), { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));

    await waitFor(() => expect(searchNearbyPlacesMock).toHaveBeenCalledWith({ latitude: 13, longitude: 77 }, 1000));
    expect(createPropertyAnalysisMock).toHaveBeenCalledWith(9, 1000);
    expect(await screen.findByText("School")).toBeInTheDocument();
    expect(onAnalysisChange).toHaveBeenCalledWith(expect.objectContaining({ analysis_id: 2 }));
  });

  it("shows Google results when GIS fails and reports a partial analysis", async () => {
    createPropertyAnalysisMock.mockRejectedValue(new Error("GIS unavailable"));
    searchNearbyPlacesMock.mockResolvedValue([{ id: "place-2", name: "Clinic", typeLabel: "Clinic", category: "healthcare", address: "Main Street", latitude: 13, longitude: 77, distanceMeters: 40, direction: "E", googleMapsUri: "" }]);
    render(<MapPicker location={{ latitude: "13", longitude: "77", boundary: { type: "Polygon", coordinates: [[[76.99, 13], [77.01, 13], [77.01, 13.01], [76.99, 13]]] } }} propertyId={3} onLocationChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));
    expect(await screen.findByText(/some data sources did not return results/i)).toBeInTheDocument();
    expect(screen.getByText("Clinic")).toBeInTheDocument();
    expect(screen.getByText(/GIS analysis: GIS unavailable/i)).toBeInTheDocument();
  });

  it("shows GIS results when Google Places fails", async () => {
    searchNearbyPlacesMock.mockRejectedValue(new Error("Places unavailable"));
    createPropertyAnalysisMock.mockResolvedValue({
      analysis_id: 4, radius_m: 500, status: "complete",
      directions: { E: { features: [{ id: "gis-E-0", type: "road", distance_m: 80, direction: "E", source: "mapbox_streets_v8", metrics: {}, geometry: { type: "Point", coordinates: [77, 13] } }] } },
    });
    function AnalysisHarness() {
      const [analysis, setAnalysis] = useState(null);
      return <MapPicker
        location={{ latitude: "13", longitude: "77", boundary: { type: "Polygon", coordinates: [[[76.99, 13], [77.01, 13], [77.01, 13.01], [76.99, 13]]] } }}
        propertyId={4}
        analysis={analysis}
        onAnalysisChange={setAnalysis}
        onLocationChange={vi.fn()}
      />;
    }
    render(<AnalysisHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));
    expect(await screen.findByText("Road")).toBeInTheDocument();
    expect(screen.getAllByText(/Google Places: Places unavailable/i)).not.toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Show Road E on map" }));
    expect(screen.getByTestId("google-map-view")).toHaveAttribute("data-selected-gis-feature", "gis-E-0");
  });
});
