import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const { getCustomersMock, createCustomerMock } = vi.hoisted(() => ({ getCustomersMock: vi.fn(), createCustomerMock: vi.fn() }));
vi.mock("./api", () => ({ getCustomers: getCustomersMock, createCustomer: createCustomerMock }));
vi.mock("./components/MapPicker", () => ({
  default: ({ location, onLocationChange }) => <div>
    <button type="button" onClick={() => onLocationChange({ address: "1 Main Street", state: "Karnataka", country: "India", latitude: "12.971599", longitude: "77.594566" })}>Mock location</button>
    <output data-testid="map-location">{location.latitude},{location.longitude}</output>
  </div>,
}));

describe("App", () => {
  beforeEach(() => {
    getCustomersMock.mockReset().mockResolvedValue([]);
    createCustomerMock.mockReset().mockResolvedValue({ id: 1 });
  });

  it("shows validation errors without calling the API", async () => {
    render(<App />);
    await waitFor(() => expect(getCustomersMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Save customer property" }));
    expect(await screen.findAllByText("This field is required.")).toHaveLength(9);
    expect(createCustomerMock).not.toHaveBeenCalled();
  });

  it("saves, clears the form, and refreshes the customer list", async () => {
    render(<App />);
    await waitFor(() => expect(getCustomersMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText("Customer name"), { target: { value: "Asha Rao" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "asha@example.com" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "+91 98765 43210" } });
    fireEvent.change(screen.getByLabelText("Property name"), { target: { value: "Lake House" } });
    fireEvent.click(screen.getByRole("button", { name: "Mock location" }));
    fireEvent.click(screen.getByRole("button", { name: "Save customer property" }));

    expect(await screen.findByText("Customer property saved successfully.")).toBeInTheDocument();
    expect(createCustomerMock).toHaveBeenCalledWith(expect.objectContaining({ name: "Asha Rao", latitude: "12.971599" }));
    expect(getCustomersMock).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Customer name")).toHaveValue("");
  });

  it("loads a saved property into the form and map", async () => {
    getCustomersMock.mockResolvedValueOnce([{
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
