export default function CustomerList({ customers, loading, error, onView }) {
  return (
    <section className="records-section" aria-labelledby="records-title">
      <div className="records-heading">
        <div><span className="step-label">Your properties</span><h2 id="records-title">Saved properties</h2></div>
        {!loading && !error && <span className="record-count">{customers.length}</span>}
      </div>
      {loading && <div className="empty-state">Loading saved properties…</div>}
      {error && <div className="alert alert--error">{error}</div>}
      {!loading && !error && customers.length === 0 && <div className="empty-state">No saved properties yet.</div>}
      {!loading && !error && customers.length > 0 && (
        <div className="property-list">
          {customers.map((customer) => (
            <article className="property-card" key={customer.id}>
              <div className="property-card-icon" aria-hidden="true">⌂</div>
              <div className="property-card-copy">
                <strong>{customer.property_name}</strong>
                <span>{customer.address}</span>
                <small>{customer.name} · {customer.state}, {customer.country}</small>
              </div>
              <button type="button" className="view-button" onClick={() => onView(customer)} aria-label={`View ${customer.property_name} for ${customer.name}`}>
                Open
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
