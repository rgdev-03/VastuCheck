import { useEffect, useRef, useState } from "react";
import {
  googleMapId,
  googleMapsApiKey,
  loadGoogleLibraries,
  locationFromGooglePlace,
} from "../googleMaps";

const INITIAL_LOCATION = { lat: 15.3505, lng: 76.1567 };

export default function GoogleMapView({ active, location, pickMode, onPointSelect, onLocationChange, onStatus }) {
  const containerRef = useRef(null);
  const searchRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const pickModeRef = useRef(pickMode);
  const [loadError, setLoadError] = useState("");

  useEffect(() => { pickModeRef.current = pickMode; }, [pickMode]);

  useEffect(() => {
    if (!googleMapsApiKey || !containerRef.current || !searchRef.current) return undefined;
    let disposed = false;
    let clickListener;
    let autocomplete;
    let handlePlaceSelect;

    loadGoogleLibraries().then(({ maps, marker, places }) => {
      if (disposed) return;
      const map = new maps.Map(containerRef.current, {
        center: INITIAL_LOCATION,
        zoom: 18,
        mapTypeId: "satellite",
        mapId: googleMapId,
        streetViewControl: false,
      });
      const selectedMarker = new marker.AdvancedMarkerElement({ map: null });
      autocomplete = new places.PlaceAutocompleteElement({});
      autocomplete.setAttribute("placeholder", "Search Google Maps");
      searchRef.current.replaceChildren(autocomplete);

      handlePlaceSelect = async (event) => {
        try {
          const place = event.placePrediction.toPlace();
          await place.fetchFields({ fields: ["displayName", "formattedAddress", "location", "addressComponents"] });
          if (!place.location) throw new Error("No location found.");
          const selected = locationFromGooglePlace(place);
          onLocationChange(selected);
          map.setCenter(place.location);
          map.setZoom(20);
          selectedMarker.map = map;
          selectedMarker.position = place.location;
          onStatus("success", "Google location selected. Review the address fields before saving.");
        } catch {
          onStatus("error", "Google could not load details for that place. Try another result.");
        }
      };
      autocomplete.addEventListener("gmp-select", handlePlaceSelect);
      clickListener = map.addListener("click", (event) => {
        if (!pickModeRef.current || !event.latLng) return;
        onPointSelect({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
      });
      mapRef.current = map;
      markerRef.current = selectedMarker;
    }).catch(() => {
      if (!disposed) setLoadError("Google Maps could not be loaded. Check the API key, enabled APIs, billing, and referrer restrictions.");
    });

    return () => {
      disposed = true;
      clickListener?.remove();
      if (autocomplete && handlePlaceSelect) autocomplete.removeEventListener("gmp-select", handlePlaceSelect);
      autocomplete?.remove();
      if (markerRef.current) markerRef.current.map = null;
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !location.latitude || !location.longitude) return;
    const position = { lat: Number(location.latitude), lng: Number(location.longitude) };
    marker.map = map;
    marker.position = position;
    map.setCenter(position);
    map.setZoom(19);
  }, [location.latitude, location.longitude]);

  useEffect(() => {
    if (!active || !mapRef.current) return;
    const center = location.latitude && location.longitude
      ? { lat: Number(location.latitude), lng: Number(location.longitude) }
      : INITIAL_LOCATION;
    requestAnimationFrame(() => mapRef.current?.setCenter(center));
  }, [active, location.latitude, location.longitude]);

  if (!googleMapsApiKey) {
    return <div className="provider-error">Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to <code>frontend/.env</code> to enable Google Maps.</div>;
  }

  return (
    <div className="google-map-shell">
      <div className="google-search" ref={searchRef} />
      <div className="google-map" ref={containerRef} />
      {loadError && <div className="provider-error provider-error--overlay">{loadError}</div>}
    </div>
  );
}

