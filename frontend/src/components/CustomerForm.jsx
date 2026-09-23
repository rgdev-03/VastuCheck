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

export default function CustomerForm({ values, errors, saving, onChange, onSubmit }) {
  const change = (event) => onChange(event.target.name, event.target.value);
  return (
    <form className="customer-form" onSubmit={onSubmit} noValidate>
      <div className="section-heading">
        <span className="eyebrow">Customer details</span>
        <h2>Register a property</h2>
        <p>Choose an exact location on the map, then review the address before saving.</p>
      </div>

      <div className="form-grid">
        <Field name="name" value={values.name} onChange={change} error={errors.name} />
        <Field name="email" value={values.email} onChange={change} error={errors.email} type="email" />
        <Field name="phone_number" value={values.phone_number} onChange={change} error={errors.phone_number} type="tel" />
        <Field name="property_name" value={values.property_name} onChange={change} error={errors.property_name} />
        <Field name="address" value={values.address} onChange={change} error={errors.address} multiline />
        <Field name="state" value={values.state} onChange={change} error={errors.state} />
        <Field name="country" value={values.country} onChange={change} error={errors.country} />
        <Field name="latitude" value={values.latitude} onChange={change} error={errors.latitude} readOnly />
        <Field name="longitude" value={values.longitude} onChange={change} error={errors.longitude} readOnly />
      </div>

      {errors.non_field_errors && <div className="alert alert--error">{errors.non_field_errors}</div>}
      <button className="primary-button" type="submit" disabled={saving}>
        {saving ? "Saving property…" : "Save customer property"}
      </button>
    </form>
  );
}

