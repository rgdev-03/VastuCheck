function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function CustomerList({ customers, loading, error, onView }) {
  return (
    <section className="records-section" aria-labelledby="records-title">
      <div className="records-heading">
        <div>
          <span className="eyebrow">SQLite records</span>
          <h2 id="records-title">Saved properties</h2>
        </div>
        {!loading && !error && <span className="record-count">{customers.length} total</span>}
      </div>

      {loading && <div className="empty-state">Loading saved properties…</div>}
      {error && <div className="alert alert--error">{error}</div>}
      {!loading && !error && customers.length === 0 && (
        <div className="empty-state">No properties saved yet. Your first record will appear here.</div>
      )}
      {!loading && !error && customers.length > 0 && (
        <div className="table-shell">
          <table>
            <thead><tr><th>Customer</th><th>Property</th><th>Location</th><th>Coordinates</th><th>Saved</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td><strong>{customer.name}</strong><span>{customer.email}</span><span>{customer.phone_number}</span></td>
                  <td><strong>{customer.property_name}</strong><span>{customer.address}</span></td>
                  <td>{customer.state}, {customer.country}</td>
                  <td className="coordinates">{customer.latitude}<br />{customer.longitude}</td>
                  <td>{formatDate(customer.created_at)}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="view-button"
                      onClick={() => onView(customer)}
                      aria-label={`View ${customer.property_name} for ${customer.name}`}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
