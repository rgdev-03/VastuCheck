import { useCallback, useEffect, useRef, useState } from "react";
import { createCustomer, getCustomers } from "./api";
import CustomerForm from "./components/CustomerForm";
import CustomerList from "./components/CustomerList";
import MapPicker from "./components/MapPicker";

export const EMPTY_FORM = {
  name: "", email: "", phone_number: "", property_name: "", address: "",
  state: "", country: "", latitude: "", longitude: "",
};

export function validateForm(values) {
  const errors = {};
  for (const [field, value] of Object.entries(values)) {
    if (!String(value).trim()) errors[field] = "This field is required.";
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Enter a valid email address.";
  const digits = values.phone_number.replace(/\D/g, "").length;
  if (values.phone_number && (digits < 7 || digits > 15)) errors.phone_number = "Phone number must contain 7 to 15 digits.";
  return errors;
}

const normalizeServerErrors = (fields) => Object.fromEntries(
  Object.entries(fields || {}).map(([key, value]) => [key, Array.isArray(value) ? value.join(" ") : String(value)]),
);

export default function App() {
  const workspaceRef = useRef(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      setCustomers(await getCustomers());
    } catch {
      setListError("Saved properties could not be loaded. Confirm that the Django server is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCustomers(); }, [loadCustomers]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, non_field_errors: undefined }));
    setNotice("");
  };

  const updateLocation = (nextLocation) => {
    setForm((current) => ({ ...current, ...nextLocation }));
    setErrors((current) => ({
      ...current,
      address: undefined,
      state: undefined,
      country: undefined,
      latitude: undefined,
      longitude: undefined,
    }));
    setNotice("");
  };

  const viewCustomer = (customer) => {
    setForm(Object.fromEntries(Object.keys(EMPTY_FORM).map((field) => [field, String(customer[field] ?? "")])));
    setErrors({});
    setNotice(`${customer.property_name} loaded for review.`);
    requestAnimationFrame(() => workspaceRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const clientErrors = validateForm(form);
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      setNotice("");
      return;
    }
    setSaving(true);
    setErrors({});
    setNotice("");
    try {
      await createCustomer(form);
      setForm(EMPTY_FORM);
      setNotice("Customer property saved successfully.");
      await loadCustomers();
    } catch (error) {
      const serverErrors = normalizeServerErrors(error.fields);
      setErrors(Object.keys(serverErrors).length ? serverErrors : { non_field_errors: "The property could not be saved. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true">VP</div>
        <div><span className="eyebrow">Location intelligence</span><h1>Vastu Property Registry</h1></div>
      </header>
      <main>
        {notice && <div className="alert alert--success" role="status">{notice}</div>}
        <div className="workspace" ref={workspaceRef}>
          <CustomerForm values={form} errors={errors} saving={saving} onChange={updateField} onSubmit={submit} />
          <MapPicker location={form} onLocationChange={updateLocation} />
        </div>
        <CustomerList customers={customers} loading={loading} error={listError} onView={viewCustomer} />
      </main>
      <footer>Customer Property Location POC · Address selection powered by ArcGIS</footer>
    </>
  );
}
