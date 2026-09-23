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

export async function getCustomers() {
  const response = await fetch(`${API_BASE_URL}/customers/`);
  return parseResponse(response);
}

export async function createCustomer(customer) {
  const response = await fetch(`${API_BASE_URL}/customers/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(customer),
  });
  return parseResponse(response);
}

