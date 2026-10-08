import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SurroundingAnalysis from "./SurroundingAnalysis";

const { createPropertyAnalysisMock } = vi.hoisted(() => ({ createPropertyAnalysisMock: vi.fn() }));
vi.mock("../api", () => ({ createPropertyAnalysis: createPropertyAnalysisMock }));

const emptyDirections = Object.fromEntries(["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((code) => [code, { features: [] }]));

describe("SurroundingAnalysis", () => {
  beforeEach(() => createPropertyAnalysisMock.mockReset().mockResolvedValue({
    analysis_id: 4, radius_m: 500, generated_at: "2026-09-29T10:00:00Z",
    sources: { mapbox: "Mapbox Streets v8" },
    directions: { ...emptyDirections, E: { features: [{ type: "road", distance_m: 95, source: "mapbox_streets_v8", metrics: {} }] } },
  }));

  it("runs analysis and renders all directions", async () => {
    render(<SurroundingAnalysis propertyId={7} />);
    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));
    await waitFor(() => expect(createPropertyAnalysisMock).toHaveBeenCalledWith(7, 500));
    expect(await screen.findByText("Road")).toBeInTheDocument();
    expect(screen.getByText("95 m · mapbox_streets_v8")).toBeInTheDocument();
    expect(screen.getAllByText("No significant feature")).toHaveLength(7);
  });

  it("shows provider-specific failures for partial results", async () => {
    createPropertyAnalysisMock.mockResolvedValue({
      analysis_id: 5,
      radius_m: 500,
      generated_at: "2026-09-30T10:00:00Z",
      sources: {},
      directions: emptyDirections,
      status: "partial",
      providers: { mapbox: { status: "failed", detail: "Mapbox quota exceeded." } },
    });
    render(<SurroundingAnalysis propertyId={8} />);
    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Mapbox quota exceeded");
  });

  it("requires a saved property", () => {
    render(<SurroundingAnalysis propertyId={null} />);
    expect(screen.getByRole("button", { name: "Run analysis" })).toBeDisabled();
  });
});
