import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const { getPropertiesMock, createPropertyMock, updatePropertyMock } = vi.hoisted(() => ({
  getPropertiesMock: vi.fn(), createPropertyMock: vi.fn(), updatePropertyMock: vi.fn(),
}));
vi.mock("./api", () => ({
  getProperties: getPropertiesMock,
  createProperty: createPropertyMock,
  updateProperty: updatePropertyMock,
  createPropertyAnalysis: vi.fn(),
}));
vi.mock("./components/MapPicker", () => ({
  default: ({ location, onLocationChange, onBoundaryChange }) => <div>
    <button type="button" onClick={() => {
      onLocationChange({ address: "1 Main Street", state: "Karnataka", country: "India", latitude: "12.971599", longitude: "77.594566" });
      onBoundaryChange({ type: "Polygon", coordinates: [[[77.5945, 12.9715], [77.5947, 12.9715], [77.5947, 12.9717], [77.5945, 12.9715]]] });
    }}>Mock location</button>
    <output data-testid="map-location">{location.latitude},{location.longitude}</output>
  </div>,
}));

describe("App", () => {
  beforeEach(() => {
    getPropertiesMock.mockReset().mockResolvedValue([]);
    createPropertyMock.mockReset().mockResolvedValue({ id: 1 });
    updatePropertyMock.mockReset().mockResolvedValue({ id: 1 });
  });

  it("shows validation errors without calling the API", async () => {
    render(<App />);
    await waitFor(() => expect(getPropertiesMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Save customer property" }));
    expect(await screen.findAllByText("This field is required.")).toHaveLength(9);
    expect(createPropertyMock).not.toHaveBeenCalled();
  });

  it("keeps a newly saved property loaded for analysis and can start a new property", async () => {
    render(<App />);
    await waitFor(() => expect(getPropertiesMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText("Customer name"), { target: { value: "Asha Rao" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "asha@example.com" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "+91 98765 43210" } });
    fireEvent.change(screen.getByLabelText("Property name"), { target: { value: "Lake House" } });
    fireEvent.click(screen.getByRole("button", { name: "Mock location" }));
    fireEvent.click(screen.getByRole("button", { name: "Save customer property" }));

    expect(await screen.findByText("Property saved. Run the surroundings analysis when ready.")).toBeInTheDocument();
    expect(createPropertyMock).toHaveBeenCalledWith(expect.objectContaining({ name: "Asha Rao", latitude: "12.971599" }));
    expect(getPropertiesMock).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Customer name")).toHaveValue("Asha Rao");
    expect(screen.getByRole("button", { name: "Update customer property" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New Property" }));
    expect(screen.getByLabelText("Customer name")).toHaveValue("");
  });

  it("loads a saved property into the form and map", async () => {
    getPropertiesMock.mockResolvedValueOnce([{
      id: 7,
      name: "Asha Rao",
      email: "asha@example.com",
      phone_number: "+91 98765 43210",
      property_name: "Lake House",
      address: "1 Main Street",
      state: "Karnataka",
      country: "India",
      latitude: "12.971599",
      longitude: "77.594566",
      created_at: "2026-09-22T10:00:00Z",
    }]);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "View Lake House for Asha Rao" }));

    expect(screen.getByLabelText("Customer name")).toHaveValue("Asha Rao");
    expect(screen.getByLabelText("Property address")).toHaveValue("1 Main Street");
    expect(screen.getByTestId("map-location")).toHaveTextContent("12.971599,77.594566");
    expect(screen.getByText("Lake House loaded for review.")).toBeInTheDocument();
  });
});
