import { useEffect, useState } from "react";
import { createPropertyAnalysis } from "../api";
import { coordinatesOnly, polygonCentroid } from "../location";
import { googleMapsApiKey, reverseGoogleLocation, searchNearbyPlaces } from "../googleMaps";
import GoogleMapView from "./GoogleMapView";
import NearbyPlaces from "./NearbyPlaces";

function analysisMessage(error, fallback) {
  return error?.fields?.detail || error?.message || fallback;
}

export default function MapPicker({
  location,
  propertyId = null,
  analysisResetKey = 0,
  propertyDirty = false,
  onAnalysisChange = () => {},
  onLocationChange,
  onBoundaryChange = () => {},
  boundaryError = "",
  analysis = null,
}) {
  const [pickMode, setPickMode] = useState(false);
  const [boundaryMode, setBoundaryMode] = useState(false);
  const [draftVertices, setDraftVertices] = useState([]);
  const [visibleFeatureTypes, setVisibleFeatureTypes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(googleMapsApiKey
    ? "Search an address above, or pick a location directly on the map."
    : "Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env to enable the map.");
  const [messageType, setMessageType] = useState(googleMapsApiKey ? "info" : "error");
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [nearbyStatus, setNearbyStatus] = useState("idle");
  const [nearbyError, setNearbyError] = useState("");
  const [selectedNearbyPlaceId, setSelectedNearbyPlaceId] = useState("");
  const [selectedGisFeatureId, setSelectedGisFeatureId] = useState("");
  const [radius, setRadius] = useState(500);
  const [analysisStatus, setAnalysisStatus] = useState("idle");
  const [analysisError, setAnalysisError] = useState("");
  const gisAnalysis = analysis ? {
    ...analysis,
    directions: Object.fromEntries(Object.entries(analysis.directions || {}).map(([code, section]) => [
      code,
      { ...section, features: (section.features || []).map((feature, index) => ({ ...feature, id: `gis-${code}-${index}`, direction: code })) },
    ])),
  } : null;
  const gisFeatures = Object.values(gisAnalysis?.directions || {}).flatMap((direction) => direction.features || []).filter((feature) => feature.geometry);
  const availableFeatureTypes = [...new Set(gisFeatures.map((feature) => feature.type))].sort();
  const analysisCenter = polygonCentroid(location.boundary);

  useEffect(() => { setVisibleFeatureTypes(availableFeatureTypes); }, [analysis?.analysis_id]);

  useEffect(() => {
    setNearbyPlaces([]);
    setNearbyStatus("idle");
    setNearbyError("");
    setAnalysisStatus("idle");
    setAnalysisError("");
    setSelectedNearbyPlaceId("");
    setSelectedGisFeatureId("");
    onAnalysisChange(null);
  }, [propertyId, analysisResetKey]);

  useEffect(() => {
    if (!propertyDirty) return;
    setNearbyPlaces([]);
    setNearbyStatus("idle");
    setNearbyError("");
    setAnalysisStatus("idle");
    setAnalysisError("");
    setSelectedNearbyPlaceId("");
    setSelectedGisFeatureId("");
  }, [propertyDirty]);

  const selectPoint = async (coordinates) => {
    onLocationChange(coordinatesOnly(coordinates));
    setBusy(true);
    setMessageType("info");
    setMessage("Finding the address for this point…");
    try {
      const { addressResolution, ...selectedLocation } = await reverseGoogleLocation(coordinates);
      onLocationChange(selectedLocation);
      setMessageType("success");
      setMessage(addressResolution === "nearby_place"
        ? "Google location selected. The address was approximated from the nearest Google place; review it before saving."
        : "Google location selected. Review the address fields before saving.");
    } catch {
      setMessageType("warning");
      setMessage("Coordinates were selected, but Google could not find an address. Enter the address, state, and country manually.");
    } finally {
      setBusy(false);
    }
  };

  const runAnalysis = async () => {
    if (!propertyId) {
      setAnalysisStatus("error");
      setAnalysisError("Save the property and boundary before running the surroundings analysis.");
      return;
    }
    if (propertyDirty) {
      setAnalysisStatus("error");
      setAnalysisError("Save the property changes before running the analysis.");
      return;
    }
    if (!location.boundary) {
      setAnalysisStatus("error");
      setAnalysisError("Draw and save the property boundary before running the analysis.");
      return;
    }
    const centroid = polygonCentroid(location.boundary);
    if (!centroid) {
      setAnalysisStatus("error");
      setAnalysisError("The property boundary could not be used to calculate its center.");
      return;
    }

    setAnalysisStatus("loading");
    setAnalysisError("");
    setNearbyStatus(googleMapsApiKey ? "loading" : "error");
    setNearbyError(googleMapsApiKey ? "" : "Add VITE_GOOGLE_MAPS_API_KEY to search nearby places.");
    setNearbyPlaces([]);
    setSelectedNearbyPlaceId("");
    setSelectedGisFeatureId("");

    const [gisResult, placesResult] = await Promise.allSettled([
      createPropertyAnalysis(propertyId, radius),
      googleMapsApiKey ? searchNearbyPlaces(centroid, radius) : Promise.reject(new Error("Google Maps API key is missing.")),
    ]);

    const gisSucceeded = gisResult.status === "fulfilled";
    const placesSucceeded = placesResult.status === "fulfilled";
    if (gisSucceeded) onAnalysisChange(gisResult.value);
    else {
      onAnalysisChange(null);
      setAnalysisError(analysisMessage(gisResult.reason, "The GIS analysis could not be completed."));
    }
    if (placesSucceeded) {
      setNearbyPlaces(placesResult.value);
      setNearbyStatus("success");
      setNearbyError("");
    } else {
      setNearbyPlaces([]);
      setNearbyStatus("error");
      setNearbyError(analysisMessage(placesResult.reason, "Google Places could not be loaded."));
    }

    const gisPartial = gisSucceeded && gisResult.value.status === "partial";
    if (gisSucceeded && placesSucceeded && !gisPartial) setAnalysisStatus("success");
    else if (gisSucceeded || placesSucceeded) setAnalysisStatus("partial");
    else setAnalysisStatus("error");
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessageType("error");
      setMessage("This browser does not support geolocation.");
      return;
    }
    setBusy(true);
    setMessageType("info");
    setMessage("Requesting your current location…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { void selectPoint({ latitude: coords.latitude, longitude: coords.longitude }); },
      (error) => {
        setBusy(false);
        setMessageType("error");
        setMessage(error.code === 1
          ? "Location permission was denied. Your previous selection was kept."
          : "Your location could not be determined. Your previous selection was kept.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const togglePickMode = () => {
    setBoundaryMode(false);
    setPickMode((active) => {
      setMessageType("info");
      setMessage(!active
        ? "Selection mode is active. Nearby markers are hidden so you can click any point on the Google map."
        : "Map selection cancelled.");
      return !active;
    });
  };

  const startBoundary = () => {
    if (!location.latitude || !location.longitude) {
      setMessageType("warning");
      setMessage("Select the property point before drawing its boundary.");
      return;
    }
    setPickMode(false);
    setDraftVertices([]);
    setBoundaryMode(true);
    setMessageType("info");
    setMessage("Boundary mode is active. Click at least three property corners, then finish the boundary.");
  };

  const addBoundaryVertex = (vertex) => setDraftVertices((current) => [...current, vertex]);

  const finishBoundary = () => {
    if (draftVertices.length < 3) {
      setMessageType("warning");
      setMessage("Add at least three boundary vertices before finishing.");
      return;
    }
    const ring = [...draftVertices, draftVertices[0]].map(({ lat, lng }) => [lng, lat]);
    onBoundaryChange({ type: "Polygon", coordinates: [ring] });
    setBoundaryMode(false);
    setDraftVertices([]);
    setMessageType("success");
    setMessage("Property boundary created. Drag its handles to refine the shape.");
  };

  const clearBoundary = () => {
    setBoundaryMode(false);
    setDraftVertices([]);
    onBoundaryChange(null);
    setMessageType("info");
    setMessage("Property boundary cleared.");
  };

  const handleGooglePoint = (coordinates) => {
    setPickMode(false);
    void selectPoint(coordinates);
  };

  const showNearbyPlace = (placeId) => {
    setPickMode(false);
    setSelectedGisFeatureId("");
    setSelectedNearbyPlaceId(placeId);
  };

  const showGisFeature = (featureId) => {
    setSelectedNearbyPlaceId("");
    setSelectedGisFeatureId(featureId);
  };

  const providerStatuses = gisAnalysis?.providers || {};
  const canRun = Boolean(propertyId && !propertyDirty && location.boundary && !analysisStatus.includes("loading"));

  return (
    <section className={`map-panel ${pickMode ? "map-panel--picking" : ""}`} aria-labelledby="map-title">
      <div className="map-toolbar">
        <div className="section-heading"><span className="section-number">2</span><div><span className="step-label">Google Maps</span><h3 id="map-title">Mark the property</h3><p>Find the location and outline its boundary.</p></div></div>
        <div className="map-actions">
          <button type="button" className="secondary-button" onClick={useCurrentLocation} disabled={busy || !googleMapsApiKey}>Use current location</button>
          <button type="button" className={pickMode ? "secondary-button secondary-button--active" : "secondary-button"} onClick={togglePickMode} disabled={busy || !googleMapsApiKey}>{pickMode ? "Cancel map selection" : "Pick location on map"}</button>
          <button type="button" className={boundaryMode ? "secondary-button secondary-button--active" : "secondary-button"} onClick={startBoundary} disabled={busy || !googleMapsApiKey}>{location.boundary ? "Redraw" : "Draw boundary"}</button>
          {boundaryMode && <button type="button" className="secondary-button" onClick={() => setDraftVertices((current) => current.slice(0, -1))} disabled={!draftVertices.length}>Undo vertex</button>}
          {boundaryMode && <button type="button" className="secondary-button" onClick={finishBoundary} disabled={draftVertices.length < 3}>Finish boundary</button>}
          {(location.boundary || boundaryMode) && <button type="button" className="secondary-button" onClick={clearBoundary}>Clear boundary</button>}
        </div>
      </div>
      <div className={`map-message map-message--${messageType}`} role="status">{message}</div>
      {boundaryError && <div className="map-message map-message--error" role="alert">{boundaryError}</div>}
      <NearbyPlaces
        status={nearbyStatus}
        places={nearbyPlaces}
        error={nearbyError}
        onSelect={showNearbyPlace}
        onSelectFeature={showGisFeature}
        analysis={gisAnalysis}
        analysisStatus={analysisStatus}
        analysisError={analysisError}
        providerStatuses={providerStatuses}
        radius={radius}
        onRadiusChange={setRadius}
        onRunAnalysis={runAnalysis}
        canRun={canRun}
        propertyDirty={propertyDirty}
      >
        <div className="map-frame">
          <GoogleMapView
            location={location}
            pickMode={pickMode}
            onPointSelect={handleGooglePoint}
            onLocationChange={onLocationChange}
            onStatus={(type, text) => { setMessageType(type); setMessage(text); }}
            nearbyPlaces={nearbyPlaces}
            selectedNearbyPlaceId={selectedNearbyPlaceId}
            nearbyRadiusMeters={radius}
            nearbyCenter={analysisCenter}
            boundary={location.boundary}
            boundaryMode={boundaryMode}
            draftVertices={draftVertices}
            onBoundaryVertexAdd={addBoundaryVertex}
            onBoundaryFinish={finishBoundary}
            onBoundaryChange={onBoundaryChange}
            gisFeatures={gisFeatures}
            visibleFeatureTypes={visibleFeatureTypes}
            selectedGisFeatureId={selectedGisFeatureId}
            onGisFeatureSelect={showGisFeature}
          />
        </div>
      </NearbyPlaces>
    </section>
  );
}
