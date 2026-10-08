const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/$/, "");

async function parseResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("The server could not complete the request.");
    error.status = response.status;
    error.fields = body;
    throw error;
  }
  return body;
}

function normalizeProperty(property) {
  const coordinates = property.location?.coordinates || [];
  return {
    ...property,
    latitude: coordinates.length ? Number(coordinates[1]).toFixed(6) : String(property.latitude ?? ""),
    longitude: coordinates.length ? Number(coordinates[0]).toFixed(6) : String(property.longitude ?? ""),
  };
}

function propertyPayload(property) {
  return {
    name: property.name,
    email: property.email,
    phone_number: property.phone_number,
    property_name: property.property_name,
    address: property.address,
    state: property.state,
    country: property.country,
    location: { type: "Point", coordinates: [Number(property.longitude), Number(property.latitude)] },
    boundary: property.boundary,
  };
}

export async function getProperties() {
  const response = await fetch(`${API_BASE_URL}/properties/`);
  return (await parseResponse(response)).map(normalizeProperty);
}

export async function createProperty(property) {
  const response = await fetch(`${API_BASE_URL}/properties/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(propertyPayload(property)),
  });
  return normalizeProperty(await parseResponse(response));
}

export async function updateProperty(id, property) {
  const response = await fetch(`${API_BASE_URL}/properties/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(propertyPayload(property)),
  });
  return normalizeProperty(await parseResponse(response));
}

export async function createPropertyAnalysis(id, radiusM) {
  const response = await fetch(`${API_BASE_URL}/properties/${id}/analyses/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ radius_m: Number(radiusM) }),
  });
  return parseResponse(response);
}

export const getCustomers = getProperties;
export const createCustomer = createProperty;

