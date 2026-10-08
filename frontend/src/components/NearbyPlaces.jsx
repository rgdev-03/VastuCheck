const DIRECTIONS = [
  { code: "NW", label: "North West" }, { code: "N", label: "North" },
  { code: "NE", label: "North East" }, { code: "W", label: "West" },
  { code: "E", label: "East" }, { code: "SW", label: "South West" },
  { code: "S", label: "South" }, { code: "SE", label: "South East" },
];

const CATEGORY_LABELS = {
  education: "Education", healthcare: "Healthcare", transport: "Transport",
  commercial: "Commercial / services", other: "Other place",
};
const readableLabel = (value) => String(value || "Feature").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const sourceLabel = (value) => ({
  mapbox_streets_v8: "Mapbox", sentinel_2_l2a: "Sentinel-2", copernicus_dem_glo30: "Copernicus DEM 30 m",
  copernicus_dem_glo90: "Copernicus DEM 90 m",
})[value] || readableLabel(value);

function PlaceCard({ place, onSelect }) {
  return (
    <article className="surrounding-result surrounding-result--place">
      <button type="button" className="nearby-focus" onClick={() => onSelect(place.id)} aria-label={`Show ${place.name} on Google Maps`}>
        <span className="nearby-details">
          <strong>{place.name}</strong>
          <span>{CATEGORY_LABELS[place.category] || place.typeLabel} · {place.distanceMeters} m away</span>
          <span>{place.address}</span>
        </span>
      </button>
      {place.googleMapsUri && <a className="nearby-link" href={place.googleMapsUri} target="_blank" rel="noreferrer" aria-label={`Open ${place.name} in Google Maps`}>Open map</a>}
    </article>
  );
}

function AnalysisCard({ feature, onSelect }) {
  const content = <>
    <strong>{feature.name || readableLabel(feature.type)}</strong>
    <span>{readableLabel(feature.type)} · about {feature.distance_m} m · {sourceLabel(feature.source)}</span>
    {feature.metrics?.coverage_percent != null && <span>Estimated coverage: {feature.metrics.coverage_percent}% of this direction</span>}
    {feature.metrics?.rise_m != null && <span>Elevation rises {feature.metrics.rise_m} m over about {feature.distance_m} m ({feature.metrics.grade_percent}% grade)</span>}
    {feature.metrics?.layer && feature.type === "landuse" && <span>Mapped land use: {readableLabel(feature.metrics.layer)}</span>}
  </>;
  return (
    <article className="surrounding-result surrounding-result--gis">
      {feature.geometry
        ? <button type="button" className="nearby-focus" onClick={() => onSelect(feature.id)} aria-label={`Show ${readableLabel(feature.type)} ${feature.direction} on map`}><span className="nearby-details">{content}</span></button>
        : <div className="nearby-details">{content}</div>}
    </article>
  );
}

function buildHighlights(places, analysis) {
  const highlights = [];
  const placeGroups = places.reduce((groups, place) => {
    const category = place.category || "other";
    groups[category] = [...(groups[category] || []), place];
    return groups;
  }, {});
  Object.entries(placeGroups).sort((left, right) => right[1].length - left[1].length).slice(0, 3).forEach(([category, matches]) => {
    const closest = [...matches].sort((left, right) => left.distanceMeters - right.distanceMeters)[0];
    highlights.push({
      key: `places-${category}`,
      text: `${matches.length} ${CATEGORY_LABELS[category]?.toLowerCase() || "nearby"} ${matches.length === 1 ? "place was" : "places were"} returned; closest is ${closest.name}, about ${closest.distanceMeters} m away.`,
    });
  });

  const directional = Object.entries(analysis?.directions || {});
  const vegetation = directional.flatMap(([direction, section]) => (section.features || [])
    .filter((feature) => feature.type === "vegetation" && feature.metrics?.coverage_percent != null)
    .map((feature) => ({ direction, percent: feature.metrics.coverage_percent }))
  ).sort((left, right) => right.percent - left.percent)[0];
  if (vegetation) {
    const directionLabel = DIRECTIONS.find((item) => item.code === vegetation.direction)?.label || vegetation.direction;
    highlights.push({ key: "vegetation", text: `Sentinel-2 estimates ${vegetation.percent}% vegetation coverage in the ${directionLabel} sector.` });
  }

  const water = directional.flatMap(([direction, section]) => (section.features || [])
    .filter((feature) => ["water", "waterway"].includes(feature.type))
    .map((feature) => ({ direction, name: feature.name, distance: feature.distance_m, source: feature.source }))
  ).sort((left, right) => left.distance - right.distance)[0];
  if (water) {
    const directionLabel = DIRECTIONS.find((item) => item.code === water.direction)?.label || water.direction;
    highlights.push({ key: "water", text: `${water.name || "A mapped water feature"} is about ${water.distance} m to the ${directionLabel}; source: ${sourceLabel(water.source)}.` });
  }
  return highlights;
}

function ProviderStatus({ providerStatuses, placesStatus, placesError }) {
  const providers = Object.entries(providerStatuses || {}).filter(([name]) => name !== "google");
  return (
    <div className="surroundings-providers" aria-label="Analysis data sources">
      <span className={`provider-chip provider-chip--${placesStatus}`}>Google Places: {placesStatus === "success" ? "loaded" : placesStatus === "error" ? "unavailable" : "pending"}</span>
      {providers.map(([name, provider]) => <span key={name} className={`provider-chip provider-chip--${provider.status}`} title={provider.detail || ""}>{readableLabel(name)}: {provider.status}</span>)}
      {placesStatus === "error" && placesError && <span className="provider-detail">Google Places: {placesError}</span>}
    </div>
  );
}

export default function NearbyPlaces({
  status,
  places,
  error,
  onSelect,
  onSelectFeature,
  analysis = null,
  analysisStatus = "idle",
  analysisError = "",
  providerStatuses = {},
  radius = 500,
  onRadiusChange = () => {},
  onRunAnalysis = () => {},
  canRun = false,
  propertyDirty = false,
  children = null,
}) {
  const highlights = buildHighlights(places, analysis);
  const hasResults = Boolean(analysis || status === "success" && places.length);
  const directionalCards = DIRECTIONS.map(({ code, label }) => {
    const directionPlaces = places.filter((place) => (place.direction || "N") === code);
    const features = analysis?.directions?.[code]?.features || [];
    return (
      <section key={code} className={`direction-group direction-group--${code.toLowerCase()}`} aria-labelledby={`direction-${code}`}>
        <div className="direction-heading"><h4 id={`direction-${code}`}>{label}</h4><span>{code}</span></div>
        <div className="direction-results">
          {directionPlaces.map((place) => <PlaceCard key={place.id} place={place} onSelect={onSelect} />)}
          {features.map((feature) => <AnalysisCard key={feature.id || `${code}-${feature.type}-${feature.source}`} feature={feature} onSelect={onSelectFeature} />)}
          {!directionPlaces.length && !features.length && <p className="direction-empty">{analysisStatus === "idle" ? "Run the analysis to check this direction." : "No results returned for this direction."}</p>}
        </div>
      </section>
    );
  });

  return (
    <section className="nearby-places unified-surroundings" aria-labelledby="nearby-places-title" aria-busy={analysisStatus === "loading"}>
      <div className="nearby-heading">
        <div><span className="step-label">Property surroundings</span><h3 id="nearby-places-title">Property Surroundings Analysis</h3><p>Approximate straight-line distances from the property boundary center.</p></div>
        <div className="surroundings-controls">
          <label htmlFor="analysis-radius">Search radius
            <select id="analysis-radius" value={radius} onChange={(event) => onRadiusChange(Number(event.target.value))} disabled={analysisStatus === "loading"}>
              <option value="100">100 m</option><option value="200">200 m</option><option value="500">500 m</option><option value="1000">1 km</option>
            </select>
          </label>
          <button type="button" className="primary-button analysis-run" onClick={onRunAnalysis} disabled={!canRun}>
            {analysisStatus === "loading" ? "Analyzing…" : analysisStatus === "success" || analysisStatus === "partial" ? "Refresh analysis" : "Run analysis"}
          </button>
        </div>
      </div>

      {!canRun && analysisStatus === "idle" && <p className="nearby-state">{propertyDirty ? "Save the property changes before running the unified analysis." : "Save a property with a boundary to run the unified Google Places, Mapbox and Sentinel analysis."}</p>}
      {analysisStatus === "loading" && <p className="nearby-state" role="status">Searching Google Places and analyzing map and satellite data…</p>}
      {analysisStatus === "error" && <div className="nearby-state nearby-state--error" role="alert">{analysisError || "The analysis could not be completed. Check the provider messages and try again."}</div>}
      {analysisStatus === "partial" && <div className="nearby-state" role="status">Some data sources did not return results. Available results are shown below; missing data does not mean a feature is absent.</div>}
      {analysisError && analysisStatus === "partial" && <div className="nearby-state nearby-state--error" role="alert">GIS analysis: {analysisError}</div>}
      {status === "error" && analysisStatus !== "error" && <div className="nearby-state nearby-state--error" role="alert">Google Places: {error}</div>}
      {analysisStatus === "success" && status === "success" && places.length === 0 && <p className="nearby-state">Google Places returned no matches in this search. Nearby Search is capped at 20 results and may omit places; this does not confirm that no places exist.</p>}

      {(analysisStatus === "success" || analysisStatus === "partial" || analysisStatus === "error") && <ProviderStatus providerStatuses={providerStatuses} placesStatus={status} placesError={error} />}

      {hasResults && <>
        {highlights.length > 0 && <section className="location-highlights" aria-labelledby="location-highlights-title">
          <h4 id="location-highlights-title">Location highlights</h4>
          <ul>{highlights.map((highlight) => <li key={highlight.key}>{highlight.text}</li>)}</ul>
        </section>}
        <p className="analysis-meta"><span>Showing provider results within {analysis?.radius_m || radius} m. Google Places returns up to 20 matches, so results may omit places. Land cover and elevation are estimates.</span></p>
      </>}

      {(children || hasResults) && <div className="surroundings-layout">
        {directionalCards}
        {children && <div className="surroundings-map">{children}</div>}
      </div>}
      {hasResults && <p className="feature-legend">Sources: Google Places · Mapbox Streets · Sentinel-2 · Copernicus DEM. Distances are approximate and do not represent route distance.</p>}
    </section>
  );
}
