import { useEffect, useRef, useState } from "react";
import esriConfig from "@arcgis/core/config.js";
import Graphic from "@arcgis/core/Graphic.js";
import Point from "@arcgis/core/geometry/Point.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import { locationToAddress } from "@arcgis/core/rest/locator.js";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import "@arcgis/map-components/components/arcgis-search";
import "@arcgis/map-components/components/arcgis-fullscreen";
import "@arcgis/map-components/components/arcgis-basemap-toggle";
import { coordinatesOnly, locationFromGeocode, pointCoordinates } from "../location";
import { googleMapsApiKey, reverseGoogleLocation } from "../googleMaps";
import GoogleMapView from "./GoogleMapView";

const LOCATOR_URL = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";
const apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
if (apiKey) esriConfig.apiKey = apiKey;

export default function MapPicker({ location, onLocationChange }) {
  const mapRef = useRef(null);
  const searchRef = useRef(null);
  const layerRef = useRef(null);
  const pickModeRef = useRef(false);
  const [pickMode, setPickMode] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(apiKey ? "Search for an address or choose another location method." : "Add VITE_ARCGIS_API_KEY to frontend/.env to enable the map.");
  const [messageType, setMessageType] = useState(apiKey ? "info" : "error");
  const [activeProvider, setActiveProvider] = useState("esri");
  const [googleMounted, setGoogleMounted] = useState(false);

  const setPickModeState = (active) => {
    pickModeRef.current = active;
    setPickMode(active);
  };

  const moveMap = async (coordinates) => {
    if (!mapRef.current) return;
    try {
      await mapRef.current.goTo({ center: [coordinates.longitude, coordinates.latitude], zoom: 19 });
    } catch {
      // Interrupted map animations are harmless.
    }
  };

  const reverseEsriLocation = async (coordinates, fallbackAddress = "") => {
    const response = await locationToAddress(LOCATOR_URL, {
      location: new Point({ longitude: coordinates.longitude, latitude: coordinates.latitude }),
      outFields: ["*"],
    });
    return locationFromGeocode(response, coordinates, fallbackAddress);
  };

  const selectPoint = async (coordinates, fallbackAddress = "", provider = "esri") => {
    onLocationChange({ ...coordinatesOnly(coordinates), address: fallbackAddress });
    void moveMap(coordinates);
    setBusy(true);
    setMessageType("info");
    setMessage("Finding the address for this point…");
    try {
      if (provider === "google") {
        let selectedLocation;
        let usedEsriFallback = false;
        try {
          selectedLocation = await reverseGoogleLocation(coordinates);
          if (!selectedLocation.address || !selectedLocation.state || !selectedLocation.country) {
            const esriLocation = await reverseEsriLocation(coordinates, fallbackAddress);
            selectedLocation = {
              ...selectedLocation,
              address: selectedLocation.address || esriLocation.address,
              state: selectedLocation.state || esriLocation.state,
              country: selectedLocation.country || esriLocation.country,
            };
            usedEsriFallback = true;
          }
        } catch (googleError) {
          console.warn("Google reverse geocoding failed; using the Esri fallback.", googleError);
          selectedLocation = await reverseEsriLocation(coordinates, fallbackAddress);
          usedEsriFallback = true;
        }
        onLocationChange(selectedLocation);
        setMessageType("success");
        setMessage(usedEsriFallback
          ? "Google point selected. Address details were resolved with the Esri fallback."
          : "Google location selected. Review the address fields before saving.");
      } else {
        onLocationChange(await reverseEsriLocation(coordinates, fallbackAddress));
        setMessageType("success");
        setMessage("Location selected. Review the address fields before saving.");
      }
    } catch {
      setMessageType("warning");
      setMessage("Coordinates were selected, but no address was found. Enter the address, state, and country manually.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const mapElement = mapRef.current;
    const searchElement = searchRef.current;
    if (!mapElement || !searchElement) return undefined;
    let cancelled = false;

    const handleMapClick = (event) => {
      if (!pickModeRef.current) return;
      const coordinates = pointCoordinates(event.detail?.mapPoint);
      setPickModeState(false);
      if (coordinates) void selectPoint(coordinates);
    };
    const handleSearchResult = (event) => {
      const result = event.detail?.result;
      const coordinates = pointCoordinates(result?.feature?.geometry || result?.target?.geometry);
      if (coordinates) void selectPoint(coordinates, result?.name || "");
    };

    mapElement.addEventListener("arcgisViewClick", handleMapClick);
    searchElement.addEventListener("arcgisSelectResult", handleSearchResult);
    mapElement.viewOnReady().then(() => {
      if (cancelled) return;
      mapElement.constraints = { maxScale: 0, snapToZoom: false };
      const layer = new GraphicsLayer({ title: "Selected property" });
      mapElement.map.add(layer);
      layerRef.current = layer;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      mapElement.removeEventListener("arcgisViewClick", handleMapClick);
      searchElement.removeEventListener("arcgisSelectResult", handleSearchResult);
      if (layerRef.current && mapElement.map) mapElement.map.remove(layerRef.current);
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.removeAll();
    if (!location.latitude || !location.longitude) return;
    const point = new Point({ longitude: Number(location.longitude), latitude: Number(location.latitude) });
    layer.add(new Graphic({
      geometry: point,
      symbol: {
        type: "simple-marker",
        color: "#e15539",
        size: 13,
        outline: { color: "#ffffff", width: 2 },
      },
    }));
    void moveMap({ longitude: point.longitude, latitude: point.latitude });
  }, [location.latitude, location.longitude, mapReady]);

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
      ({ coords }) => {
        setBusy(false);
        void selectPoint({ latitude: coords.latitude, longitude: coords.longitude }, "", activeProvider);
      },
      (error) => {
        setBusy(false);
        setMessageType("error");
        setMessage(error.code === 1 ? "Location permission was denied. Your previous selection was kept." : "Your location could not be determined. Your previous selection was kept.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const togglePickMode = () => {
    const active = !pickModeRef.current;
    setPickModeState(active);
    setMessageType("info");
    setMessage(active ? "Selection mode is active. Click one point on the map." : "Map selection cancelled.");
  };

  const switchProvider = (provider) => {
    setPickModeState(false);
    setActiveProvider(provider);
    if (provider === "google") setGoogleMounted(true);
    setMessageType("info");
    setMessage(`${provider === "google" ? "Google" : "Esri"} map selected. Search, use your location, or activate map selection.`);
  };

  const handleGooglePoint = (coordinates) => {
    setPickModeState(false);
    void selectPoint(coordinates, "", "google");
  };

  return (
    <section className={`map-panel ${pickMode ? "map-panel--picking" : ""}`} aria-labelledby="map-title">
      <div className="map-toolbar">
        <div>
          <span className="eyebrow">Location picker</span>
          <h2 id="map-title">Pin the property</h2>
        </div>
        <div className="map-actions">
          <button type="button" className="secondary-button" onClick={useCurrentLocation} disabled={busy || (activeProvider === "esri" ? !apiKey : !googleMapsApiKey)}>Use current location</button>
          <button type="button" className={pickMode ? "secondary-button secondary-button--active" : "secondary-button"} onClick={togglePickMode} disabled={busy || !mapReady || (activeProvider === "esri" ? !apiKey : !googleMapsApiKey)}>{pickMode ? "Cancel selection" : "Select on map"}</button>
        </div>
      </div>
      <div className="map-tabs" role="tablist" aria-label="Map provider">
        <button type="button" role="tab" aria-selected={activeProvider === "esri"} className={activeProvider === "esri" ? "map-tab map-tab--active" : "map-tab"} onClick={() => switchProvider("esri")}>Esri</button>
        <button type="button" role="tab" aria-selected={activeProvider === "google"} className={activeProvider === "google" ? "map-tab map-tab--active" : "map-tab"} onClick={() => switchProvider("google")}>Google</button>
      </div>
      <div className={`map-message map-message--${messageType}`} role="status">{message}</div>
      <div className="map-frame">
        <div className="map-provider" hidden={activeProvider !== "esri"} role="tabpanel">
          <arcgis-map ref={mapRef} basemap="arcgis/imagery" center="-74.0060, 40.7128" zoom="19" popup-disabled="true">
            <arcgis-zoom slot="top-left" />
            <arcgis-fullscreen slot="top-left" />
            <arcgis-search ref={searchRef} slot="top-right" />
            <arcgis-basemap-toggle slot="bottom-right" next-basemap="arcgis/navigation" />
          </arcgis-map>
        </div>
        {googleMounted && (
          <div className="map-provider" hidden={activeProvider !== "google"} role="tabpanel">
            <GoogleMapView
              active={activeProvider === "google"}
              location={location}
              pickMode={pickMode}
              onPointSelect={handleGooglePoint}
              onLocationChange={onLocationChange}
              onStatus={(type, text) => { setMessageType(type); setMessage(text); }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
