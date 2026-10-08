import { useCallback, useEffect, useRef, useState } from "react";
import { createProperty, getProperties, updateProperty } from "./api";
import CustomerForm from "./components/CustomerForm";
import CustomerList from "./components/CustomerList";
import MapPicker from "./components/MapPicker";

export const EMPTY_FORM = {
  name: "", email: "", phone_number: "", property_name: "", address: "",
  state: "", country: "", latitude: "", longitude: "", boundary: null,
};

export function validateForm(values) {
  const errors = {};
  for (const field of ["name", "email", "phone_number", "property_name", "address", "state", "country", "latitude", "longitude"]) {
    if (!String(values[field] ?? "").trim()) errors[field] = "This field is required.";
  }
  if (!values.boundary) errors.boundary = "Draw the property boundary on the map.";
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
  const [activePropertyId, setActivePropertyId] = useState(null);
  const [editingPropertyId, setEditingPropertyId] = useState(null);
  const [activeAnalysis, setActiveAnalysis] = useState(null);
  const [propertyDirty, setPropertyDirty] = useState(false);
  const [analysisResetKey, setAnalysisResetKey] = useState(0);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      setCustomers(await getProperties());
    } catch {
      setListError("Saved properties could not be loaded. Confirm that the Django server is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCustomers(); }, [loadCustomers]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setPropertyDirty(true);
    setActiveAnalysis(null);
    setErrors((current) => ({ ...current, [field]: undefined, non_field_errors: undefined }));
    setNotice("");
  };

  const updateLocation = (nextLocation) => {
    setForm((current) => {
      const coordinatesChanged = nextLocation.latitude != null && nextLocation.longitude != null
        && (String(nextLocation.latitude) !== String(current.latitude) || String(nextLocation.longitude) !== String(current.longitude));
      return { ...current, ...nextLocation, boundary: coordinatesChanged ? null : current.boundary };
    });
    setPropertyDirty(true);
    setActiveAnalysis(null);
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

  const updateBoundary = (boundary) => {
    setForm((current) => ({ ...current, boundary }));
    setPropertyDirty(true);
    setActiveAnalysis(null);
    setErrors((current) => ({ ...current, boundary: undefined, non_field_errors: undefined }));
    setNotice("");
  };

  const viewCustomer = (customer) => {
    setForm({
      ...Object.fromEntries(Object.keys(EMPTY_FORM).filter((field) => field !== "boundary").map((field) => [field, String(customer[field] ?? "")])),
      boundary: customer.boundary || null,
    });
    setActivePropertyId(customer.id);
    setEditingPropertyId(customer.id);
    setPropertyDirty(false);
    setActiveAnalysis(null);
    setAnalysisResetKey((key) => key + 1);
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
      const wasUpdating = Boolean(editingPropertyId);
      const saved = wasUpdating
        ? await updateProperty(editingPropertyId, form)
        : await createProperty(form);
      setActivePropertyId(saved.id);
      setEditingPropertyId(saved.id);
      setPropertyDirty(false);
      setActiveAnalysis(null);
      setAnalysisResetKey((key) => key + 1);
      setNotice(wasUpdating ? "Property updated. Run the surroundings analysis when ready." : "Property saved. Run the surroundings analysis when ready.");
      await loadCustomers();
    } catch (error) {
      const serverErrors = normalizeServerErrors(error.fields);
      setErrors(Object.keys(serverErrors).length ? serverErrors : { non_field_errors: "The property could not be saved. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const startNewProperty = () => {
    setForm(EMPTY_FORM);
    setActivePropertyId(null);
    setEditingPropertyId(null);
    setPropertyDirty(false);
    setActiveAnalysis(null);
    setAnalysisResetKey((key) => key + 1);
    setErrors({});
    setNotice("");
  };

  return (
    <>
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true">V</div>
        <div><h1>Vaastu Property</h1><span className="header-subtitle">Simple property surroundings</span></div>
      </header>
      <main>
        {notice && <div className="alert alert--success" role="status">{notice}</div>}
        <section className="property-workspace" ref={workspaceRef} aria-labelledby="workspace-title">
          <div className="page-heading">
            <div><span className="step-label">Property setup</span><h2 id="workspace-title">Enter property details</h2></div>
            <div className="page-heading-actions"><p>Add the owner and location, mark the property, then save.</p>{activePropertyId && <button type="button" className="secondary-button" onClick={startNewProperty}>New Property</button>}</div>
          </div>
          <CustomerForm values={form} errors={errors} saving={saving} isEditing={Boolean(editingPropertyId)} onChange={updateField} onLocationChange={updateLocation} onSubmit={submit} />
          <MapPicker location={form} propertyId={activePropertyId} analysisResetKey={analysisResetKey} propertyDirty={propertyDirty} onAnalysisChange={setActiveAnalysis} onLocationChange={updateLocation} onBoundaryChange={updateBoundary} boundaryError={errors.boundary} analysis={activeAnalysis} />
        </section>
        <CustomerList customers={customers} loading={loading} error={listError} onView={viewCustomer} />
      </main>
      <footer>Customer Property Location POC · Location data powered by Google Maps</footer>
    </>
  );
}
