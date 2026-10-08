import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NearbyPlaces from "./NearbyPlaces";

describe("NearbyPlaces", () => {
  it("renders place details and selects a marker", () => {
    const onSelect = vi.fn();
    render(<NearbyPlaces
      status="success"
      error=""
      onSelect={onSelect}
      places={[{
        id: "place-1",
        name: "Corner Shop",
        typeLabel: "Convenience store",
        address: "1 Main Street",
        distanceMeters: 42,
        direction: "E",
        googleMapsUri: "https://maps.google.com/?cid=1",
      }]}
    />);

    expect(screen.getByText("Convenience store · 42 m away")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "East" })).toBeInTheDocument();
    expect(screen.getAllByText(/run the analysis to check this direction/i)).toHaveLength(7);
    expect(screen.getByRole("link", { name: "Open Corner Shop in Google Maps" })).toHaveAttribute("target", "_blank");
    fireEvent.click(screen.getByRole("button", { name: "Show Corner Shop on Google Maps" }));
    expect(onSelect).toHaveBeenCalledWith("place-1");
  });

  it("shows idle, loading, empty, and error states", () => {
    const { rerender } = render(<NearbyPlaces status="idle" places={[]} error="" onSelect={vi.fn()} />);
    expect(screen.getByText(/save a property with a boundary/i)).toBeInTheDocument();
    rerender(<NearbyPlaces status="loading" analysisStatus="loading" places={[]} error="" onSelect={vi.fn()} />);
    expect(screen.getByText(/searching google places and analyzing/i)).toBeInTheDocument();
    rerender(<NearbyPlaces status="success" analysisStatus="success" analysis={{ analysis_id: 1, radius_m: 500, directions: {} }} places={[]} error="" onSelect={vi.fn()} />);
    expect(screen.getByText(/returned no matches in this search/i)).toBeInTheDocument();
    rerender(<NearbyPlaces status="error" analysisStatus="partial" places={[]} error="Places unavailable" onSelect={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Places unavailable");
  });

  it("shows Google places and GIS features together with source information", () => {
    render(<NearbyPlaces
      status="success"
      analysisStatus="success"
      analysis={{
        analysis_id: 7,
        radius_m: 500,
        directions: {
          E: {
            features: [{
              id: "road-east",
              direction: "E",
              type: "road",
              distance_m: 90,
              source: "mapbox_streets_v8",
              geometry: { type: "Point", coordinates: [77, 13] },
              metrics: {},
            }],
          },
        },
      }}
      places={[{ id: "school", name: "Westside School", category: "education", typeLabel: "School", address: "Oak Street", distanceMeters: 150, direction: "E", googleMapsUri: "" }]}
      error=""
      onSelect={vi.fn()}
      onSelectFeature={vi.fn()}
    />);
    expect(screen.getByText("Westside School")).toBeInTheDocument();
    expect(screen.getByText(/education · 150 m away/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Mapbox/)).not.toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Location highlights" })).toBeInTheDocument();
  });
});
