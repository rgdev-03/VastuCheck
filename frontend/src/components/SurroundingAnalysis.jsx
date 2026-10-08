import { useEffect, useState } from "react";
import { createPropertyAnalysis } from "../api";

const DIRECTIONS = [
  ["NW", "North West"], ["N", "North"], ["NE", "North East"], ["W", "West"],
  ["E", "East"], ["SW", "South West"], ["S", "South"], ["SE", "South East"],
];

const labelFor = (value) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function SurroundingAnalysis({ propertyId, onAnalysisChange = () => {} }) {
  const [radius, setRadius] = useState(500);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    setStatus("idle");
    setError("");
    setAnalysis(null);
    onAnalysisChange(null);
  }, [propertyId]);

  const run = async () => {
    setStatus("loading");
    setError("");
    try {
      const result = await createPropertyAnalysis(propertyId, radius);
      setAnalysis(result);
      onAnalysisChange(result);
      setStatus("success");
    } catch (requestError) {
      setAnalysis(null);
      onAnalysisChange(null);
      setStatus("error");
      setError(requestError.fields?.detail || "The GIS analysis could not be completed.");
    }
  };

  return (
    <section className="analysis-section" aria-labelledby="analysis-title">
      <div className="analysis-toolbar">
        <div><span className="step-label">Optional</span><h2 id="analysis-title">Surroundings summary</h2><p>One clear result for each direction.</p></div>
        <div className="analysis-actions">
          <label>Radius
            <select value={radius} onChange={(event) => setRadius(Number(event.target.value))} disabled={status === "loading"}>
              <option value="100">100 m</option><option value="200">200 m</option>
              <option value="500">500 m</option><option value="1000">1 km</option>
            </select>
          </label>
          <button type="button" className="primary-button analysis-run" onClick={run} disabled={!propertyId || status === "loading"}>
            {status === "loading" ? "Analyzing…" : "Run analysis"}
          </button>
        </div>
      </div>
      {!propertyId && <p className="nearby-state">Save or open a property to check its surroundings.</p>}
      {propertyId && status === "idle" && <p className="nearby-state">Choose how far to look, then check the surroundings.</p>}
      {status === "error" && <div className="nearby-state nearby-state--error" role="alert">{error}</div>}
      {analysis && (
        <>
          {analysis.status === "partial" && (
            <div className="nearby-state nearby-state--error" role="status">
              Partial results: {Object.entries(analysis.providers || {})
                .filter(([, provider]) => provider.status === "failed")
                .map(([name, provider]) => `${labelFor(name)}: ${provider.detail}`)
                .join(" · ")}
            </div>
          )}
          <div className="analysis-meta"><span>Showing the nearest result within {analysis.radius_m} m</span></div>
          <div className="direction-grid analysis-grid">
            {DIRECTIONS.map(([code, label]) => {
              const features = analysis.directions?.[code]?.features || [];
              return (
                <section key={code} className={`direction-group direction-group--${code.toLowerCase()}`}>
                  <div className="direction-heading"><h3>{label}</h3><span>{code}</span></div>
                  {features.length ? <ul className="analysis-feature-list">{features.slice(0, 1).map((feature, index) => (
                    <li key={`${feature.type}-${index}`}>
                      <strong>{labelFor(feature.type)}</strong>
                      <span>{feature.distance_m} m · {feature.source}</span>
                      {feature.metrics?.coverage_percent != null && <span>{feature.metrics.coverage_percent}% coverage</span>}
                      {feature.metrics?.rise_m != null && <span>{feature.metrics.rise_m} m rise · {feature.metrics.grade_percent}% grade</span>}
                    </li>
                  ))}</ul> : <p className="direction-empty">No significant feature</p>}
                </section>
              );
            })}
          </div>
          <div className="feature-legend">Sources: {Object.values(analysis.sources || {}).join(" · ") || "Unavailable"}</div>
        </>
      )}
    </section>
  );
}
