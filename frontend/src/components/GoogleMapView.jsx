import { useEffect, useRef, useState } from "react";
import {
  googleMapId,
  googleMapsApiKey,
  loadGoogleLibraries,
  NEARBY_SEARCH_RADIUS_METERS,
} from "../googleMaps";

const INITIAL_LOCATION = { lat: 15.152382, lng: 76.902736 };

export default function GoogleMapView({
  location,
  pickMode,
  onPointSelect,
  onLocationChange,
  onStatus,
  nearbyPlaces = [],
  selectedNearbyPlaceId = "",
  nearbyRadiusMeters = NEARBY_SEARCH_RADIUS_METERS,
  nearbyCenter = null,
  boundary = null,
  boundaryMode = false,
  draftVertices = [],
  onBoundaryVertexAdd = () => {},
  onBoundaryFinish = () => {},
  onBoundaryChange = () => {},
  gisFeatures = [],
  visibleFeatureTypes = [],
  selectedGisFeatureId = "",
  onGisFeatureSelect = () => {},
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapsLibraryRef = useRef(null);
  const markerLibraryRef = useRef(null);
  const nearbyMarkersRef = useRef(new Map());
  const radiusCircleRef = useRef(null);
  const infoWindowRef = useRef(null);
  const pickModeRef = useRef(pickMode);
  const boundaryModeRef = useRef(boundaryMode);
  const boundaryVertexHandlerRef = useRef(onBoundaryVertexAdd);
  const boundaryFinishHandlerRef = useRef(onBoundaryFinish);
  const boundaryPolygonRef = useRef(null);
  const boundaryDraftRef = useRef(null);
  const boundaryVertexMarkersRef = useRef([]);
  const [loadError, setLoadError] = useState("");
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => { pickModeRef.current = pickMode; }, [pickMode]);
  useEffect(() => { boundaryModeRef.current = boundaryMode; }, [boundaryMode]);
  useEffect(() => { boundaryVertexHandlerRef.current = onBoundaryVertexAdd; }, [onBoundaryVertexAdd]);
  useEffect(() => { boundaryFinishHandlerRef.current = onBoundaryFinish; }, [onBoundaryFinish]);

  useEffect(() => {
    if (!googleMapsApiKey || !containerRef.current) return undefined;
    let disposed = false;
    let clickListener;

    loadGoogleLibraries().then(({ maps, marker }) => {
      if (disposed) return;
      const map = new maps.Map(containerRef.current, {
        center: INITIAL_LOCATION,
        zoom: 18,
        mapTypeId: "satellite",
        mapId: googleMapId,
        streetViewControl: false,
      });
      const selectedMarker = new marker.AdvancedMarkerElement({ map: null });
      clickListener = map.addListener("click", (event) => {
        if (!event.latLng) return;
        if (boundaryModeRef.current) {
          boundaryVertexHandlerRef.current({ lat: event.latLng.lat(), lng: event.latLng.lng() });
        } else if (pickModeRef.current) {
          onPointSelect({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
        }
      });
      mapRef.current = map;
      markerRef.current = selectedMarker;
      mapsLibraryRef.current = maps;
      markerLibraryRef.current = marker;
      infoWindowRef.current = new maps.InfoWindow();
      setMapReady(true);
    }).catch(() => {
      if (!disposed) setLoadError("Google Maps could not be loaded. Check the API key, enabled APIs, billing, and referrer restrictions.");
    });

    return () => {
      disposed = true;
      clickListener?.remove();
      if (markerRef.current) markerRef.current.map = null;
      nearbyMarkersRef.current.forEach(({ marker }) => { marker.map = null; });
      nearbyMarkersRef.current.clear();
      radiusCircleRef.current?.setMap(null);
      radiusCircleRef.current = null;
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
      boundaryPolygonRef.current?.setMap(null);
      boundaryDraftRef.current?.setMap(null);
      boundaryVertexMarkersRef.current.forEach((vertexMarker) => { vertexMarker.map = null; });
      boundaryVertexMarkersRef.current = [];
      boundaryPolygonRef.current = null;
      boundaryDraftRef.current = null;
      markerRef.current = null;
      mapRef.current = null;
      mapsLibraryRef.current = null;
      markerLibraryRef.current = null;
      setMapReady(false);
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
    const map = mapRef.current;
    const maps = mapsLibraryRef.current;
    if (!mapReady || !map || !maps?.Polygon || !maps?.Polyline) return undefined;
    boundaryPolygonRef.current?.setMap(null);
    boundaryDraftRef.current?.setMap(null);
    boundaryVertexMarkersRef.current.forEach((vertexMarker) => { vertexMarker.map = null; });
    boundaryVertexMarkersRef.current = [];
    boundaryPolygonRef.current = null;
    boundaryDraftRef.current = null;
    const listeners = [];

    if (boundaryMode && draftVertices.length) {
      boundaryDraftRef.current = new maps.Polyline({
        map, path: draftVertices, clickable: false, strokeColor: "#a85424", strokeOpacity: 1, strokeWeight: 3,
      });
      if (markerLibraryRef.current?.AdvancedMarkerElement) {
        boundaryVertexMarkersRef.current = draftVertices.map((position, index) => {
          const content = document.createElement("span");
          content.className = index === 0 ? "boundary-vertex boundary-vertex--first" : "boundary-vertex";
          const vertexMarker = new markerLibraryRef.current.AdvancedMarkerElement({
            map, position, content, gmpClickable: index === 0 && draftVertices.length >= 3,
            title: index === 0 && draftVertices.length >= 3 ? "Finish property boundary" : `Boundary vertex ${index + 1}`,
          });
          if (index === 0 && draftVertices.length >= 3) {
            vertexMarker.addListener("click", () => boundaryFinishHandlerRef.current());
          }
          return vertexMarker;
        });
      }
    } else if (boundary?.coordinates?.[0]?.length >= 4) {
      const path = boundary.coordinates[0].slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
      const polygon = new maps.Polygon({
        map, paths: path, editable: true, draggable: false, geodesic: false,
        fillColor: "#d9a15f", fillOpacity: 0.22, strokeColor: "#a85424", strokeOpacity: 1, strokeWeight: 3,
      });
      boundaryPolygonRef.current = polygon;
      const syncBoundary = () => {
        const points = polygon.getPath().getArray().map((point) => [point.lng(), point.lat()]);
        if (points.length >= 3) onBoundaryChange({ type: "Polygon", coordinates: [[...points, points[0]]] });
      };
      const polygonPath = polygon.getPath();
      for (const eventName of ["set_at", "insert_at", "remove_at"]) {
        const listener = polygonPath.addListener?.(eventName, syncBoundary);
        if (listener) listeners.push(listener);
      }
      if (maps.LatLngBounds) {
        const bounds = new maps.LatLngBounds();
        path.forEach((point) => bounds.extend(point));
        map.fitBounds(bounds, 48);
      }
    }
    return () => {
      listeners.forEach((listener) => listener.remove?.());
      boundaryPolygonRef.current?.setMap(null);
      boundaryDraftRef.current?.setMap(null);
      boundaryVertexMarkersRef.current.forEach((vertexMarker) => { vertexMarker.map = null; });
      boundaryVertexMarkersRef.current = [];
      boundaryPolygonRef.current = null;
      boundaryDraftRef.current = null;
    };
  }, [mapReady, boundary, boundaryMode, draftVertices, onBoundaryChange]);

  useEffect(() => {
    const data = mapRef.current?.data;
    if (!mapReady || !data?.addGeoJson) return undefined;
    data.forEach((feature) => data.remove(feature));
    const visible = new Set(visibleFeatureTypes);
    const features = gisFeatures
      .filter((feature) => feature.geometry && visible.has(feature.type))
      .map((feature, index) => ({
        type: "Feature", id: feature.id || `${feature.type}-${index}`, geometry: feature.geometry,
        properties: { featureType: feature.type, name: feature.name || feature.type },
      }));
    data.addGeoJson({ type: "FeatureCollection", features });
    data.setStyle((feature) => {
      const featureType = feature.getProperty("featureType");
      const color = featureType === "water" ? "#2b83d5" : featureType === "road" ? "#e15539" : featureType === "building" ? "#725d45" : "#2f7559";
      const selected = String(feature.getId()) === String(selectedGisFeatureId);
      return { strokeColor: selected ? "#1769aa" : color, strokeWeight: selected ? 6 : 3, fillColor: selected ? "#1769aa" : color, fillOpacity: selected ? 0.42 : 0.25 };
    });
    const clickListener = data.addListener?.("click", (event) => {
      const featureId = event.feature?.getId?.();
      if (featureId != null) onGisFeatureSelect(String(featureId));
    });
    return () => {
      clickListener?.remove?.();
      data.forEach((feature) => data.remove(feature));
    };
  }, [mapReady, gisFeatures, visibleFeatureTypes, selectedGisFeatureId, onGisFeatureSelect]);

  useEffect(() => {
    if (!selectedGisFeatureId || !mapRef.current) return;
    const selected = gisFeatures.find((feature) => String(feature.id) === String(selectedGisFeatureId));
    if (!selected?.geometry) return;
    const points = [];
    const collect = (coordinates) => {
      if (!Array.isArray(coordinates)) return;
      if (coordinates.length >= 2 && Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1]))) {
        points.push(coordinates);
      } else coordinates.forEach(collect);
    };
    collect(selected.geometry.coordinates);
    if (!points.length) return;
    const center = points.reduce((sum, [lng, lat]) => ({ lat: sum.lat + Number(lat) / points.length, lng: sum.lng + Number(lng) / points.length }), { lat: 0, lng: 0 });
    mapRef.current.panTo(center);
    mapRef.current.setZoom(19);
  }, [selectedGisFeatureId, gisFeatures, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsLibraryRef.current;
    const markerLibrary = markerLibraryRef.current;
    if (!mapReady || !map || !maps || !markerLibrary) return undefined;

    nearbyMarkersRef.current.forEach(({ marker }) => { marker.map = null; });
    nearbyMarkersRef.current.clear();
    radiusCircleRef.current?.setMap(null);
    radiusCircleRef.current = null;
    infoWindowRef.current?.close();

    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    if (!String(location.latitude).trim() || !String(location.longitude).trim()
      || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;

    const center = nearbyCenter && Number.isFinite(nearbyCenter.latitude) && Number.isFinite(nearbyCenter.longitude)
      ? { lat: nearbyCenter.latitude, lng: nearbyCenter.longitude }
      : { lat: latitude, lng: longitude };
    radiusCircleRef.current = new maps.Circle({
      map,
      center,
      radius: nearbyRadiusMeters,
      clickable: false,
      fillColor: "#d9a15f",
      fillOpacity: 0.14,
      strokeColor: "#a85424",
      strokeOpacity: 0.82,
      strokeWeight: 2,
    });

    const openPlace = (place, marker) => {
      const content = document.createElement("div");
      content.className = "nearby-info-window";
      const name = document.createElement("strong");
      name.textContent = place.name;
      const details = document.createElement("span");
      details.textContent = `${place.typeLabel} · ${place.distanceMeters} m away`;
      const address = document.createElement("span");
      address.textContent = place.address;
      content.append(name, details, address);
      infoWindowRef.current?.setContent(content);
      infoWindowRef.current?.open({ map, anchor: marker });
    };

    if (!pickMode && !boundaryMode) nearbyPlaces.forEach((place, index) => {
      const label = document.createElement("span");
      label.className = "google-nearby-marker";
      label.textContent = String(index + 1);
      const marker = new markerLibrary.AdvancedMarkerElement({
        map,
        position: { lat: place.latitude, lng: place.longitude },
        title: `${index + 1}. ${place.name}`,
        content: label,
        gmpClickable: true,
      });
      marker.addListener("click", () => openPlace(place, marker));
      nearbyMarkersRef.current.set(place.id, { marker, place, openPlace });
    });

    return () => {
      nearbyMarkersRef.current.forEach(({ marker }) => { marker.map = null; });
      nearbyMarkersRef.current.clear();
      radiusCircleRef.current?.setMap(null);
      radiusCircleRef.current = null;
      infoWindowRef.current?.close();
    };
  }, [mapReady, nearbyPlaces, location.latitude, location.longitude, pickMode, boundaryMode, nearbyRadiusMeters, nearbyCenter?.latitude, nearbyCenter?.longitude]);

  useEffect(() => {
    if (!selectedNearbyPlaceId || !mapRef.current) return;
    nearbyMarkersRef.current.forEach(({ marker }) => marker.content?.classList?.remove("google-nearby-marker--selected"));
    const selected = nearbyMarkersRef.current.get(selectedNearbyPlaceId);
    if (!selected) return;
    selected.marker.content?.classList?.add("google-nearby-marker--selected");
    mapRef.current.panTo(selected.marker.position);
    mapRef.current.setZoom(19);
    selected.openPlace(selected.place, selected.marker);
  }, [selectedNearbyPlaceId, nearbyPlaces, mapReady]);

  if (!googleMapsApiKey) {
    return <div className="provider-error">Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to <code>frontend/.env</code> to enable Google Maps.</div>;
  }

  return (
    <div className="google-map-shell">
      <div className="google-map" ref={containerRef} />
      <div className="map-compass-labels" aria-hidden="true"><span>N</span><span>E</span><span>S</span><span>W</span></div>
      {loadError && <div className="provider-error provider-error--overlay">{loadError}</div>}
    </div>
  );
}

