import { useEffect, useRef, useState } from "react";
import { googleMapsApiKey, loadGoogleLibraries, locationFromGooglePlace } from "../googleMaps";

const fieldLabels = {
  name: "Customer name",
  email: "Email address",
  phone_number: "Phone number",
  property_name: "Property name",
  address: "Property address",
  state: "State / region",
  country: "Country",
  latitude: "Latitude",
  longitude: "Longitude",
};

function Field({ name, value, onChange, error, type = "text", readOnly = false, multiline = false }) {
  const id = `field-${name}`;
  const common = {
    id,
    name,
    value,
    onChange,
    readOnly,
    required: true,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? `${id}-error` : undefined,
  };
  return (
    <label className={`field ${multiline ? "field--wide" : ""}`} htmlFor={id}>
      <span>{fieldLabels[name]}</span>
      {multiline ? <textarea {...common} rows="3" /> : <input {...common} type={type} />}
      {error && <small id={`${id}-error`} className="field-error">{error}</small>}
    </label>
  );
}

export default function CustomerForm({ values, errors, saving, isEditing = false, onChange, onLocationChange, onSubmit }) {
  const change = (event) => onChange(event.target.name, event.target.value);
  const [addressQuery, setAddressQuery] = useState(values.address || "");
  const [suggestions, setSuggestions] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const locationChangeRef = useRef(onLocationChange);
  locationChangeRef.current = onLocationChange;

  useEffect(() => {
    setAddressQuery(values.address || "");
    setSuggestions([]);
  }, [values.address]);

  useEffect(() => {
    if (!googleMapsApiKey || addressQuery.trim().length < 3) {
      setSuggestions([]);
      setAddressLoading(false);
      return undefined;
    }
    let disposed = false;
    const timer = window.setTimeout(async () => {
      setAddressLoading(true);
      try {
        const { places } = await loadGoogleLibraries();
        const response = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: addressQuery.trim() });
        if (!disposed) setSuggestions((response.suggestions || []).map((item) => item.placePrediction).filter(Boolean));
      } catch {
        if (!disposed) setSuggestions([]);
      } finally {
        if (!disposed) setAddressLoading(false);
      }
    }, 250);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [addressQuery]);

  const chooseAddress = async (prediction) => {
    setAddressQuery(prediction.text?.toString?.() || addressQuery);
    setSuggestions([]);
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location", "addressComponents"] });
      if (place.location) locationChangeRef.current(locationFromGooglePlace(place));
    } catch {
      // Keep the typed address available for manual entry if place details fail.
    }
  };

  return (
    <form className="customer-form" onSubmit={onSubmit} noValidate>
      <div className="section-heading">
        <span className="section-number">1</span>
        <div><h3>Basic details</h3><p>Who owns this property?</p></div>
      </div>

      <div className="form-grid">
        <Field name="name" value={values.name} onChange={change} error={errors.name} />
        <Field name="email" value={values.email} onChange={change} error={errors.email} type="email" />
        <Field name="phone_number" value={values.phone_number} onChange={change} error={errors.phone_number} type="tel" />
        <Field name="property_name" value={values.property_name} onChange={change} error={errors.property_name} />
        <label className="field field--wide" htmlFor="field-address">
          <span>{fieldLabels.address}</span>
          {googleMapsApiKey ? <div className="address-autocomplete-wrap">
            <input
              id="field-address"
              name="address"
              value={addressQuery}
              onChange={(event) => { setAddressQuery(event.target.value); onChange("address", event.target.value); }}
              autoComplete="off"
              required
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={suggestions.length > 0}
              aria-controls="address-suggestions"
            />
            {suggestions.length > 0 && <ul id="address-suggestions" className="address-suggestions" role="listbox">
              {suggestions.map((prediction, index) => <li key={`${prediction.placeId || prediction.text}-${index}`} role="option" aria-selected="false">
                <button type="button" onClick={() => void chooseAddress(prediction)}>{prediction.text?.toString?.() || "Address suggestion"}</button>
              </li>)}
            </ul>}
            {addressLoading && <small className="address-loading">Finding addresses…</small>}
          </div> : <input id="field-address" name="address" value={values.address} onChange={change} required />}
          {errors.address && <small id="field-address-error" className="field-error">{errors.address}</small>}
        </label>
        <Field name="state" value={values.state} onChange={change} error={errors.state} />
        <Field name="country" value={values.country} onChange={change} error={errors.country} />
        <div className="coordinate-fields">
          <Field name="latitude" value={values.latitude} onChange={change} error={errors.latitude} readOnly />
          <Field name="longitude" value={values.longitude} onChange={change} error={errors.longitude} readOnly />
        </div>
      </div>

      {errors.non_field_errors && <div className="alert alert--error">{errors.non_field_errors}</div>}
      {errors.boundary && <div className="alert alert--error">{errors.boundary}</div>}
      <button className="primary-button" type="submit" disabled={saving}>
        {saving ? "Saving property…" : isEditing ? "Update customer property" : "Save customer property"}
      </button>
    </form>
  );
}
