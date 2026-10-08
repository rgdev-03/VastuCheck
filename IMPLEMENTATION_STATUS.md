# Vastu GIS Property Surroundings POC — Implementation Status

**Status:** On-demand Mapbox and Copernicus provider analysis implemented  
**Snapshot date:** 30 September 2026

## Implemented

### Property and database

- PostgreSQL 17/PostGIS is the canonical database; `postgis` and `postgis_raster` are migration-managed.
- The property model stores a WGS84 geography point and optional geography polygon.
- New property submissions require a valid, non-self-intersecting boundary containing the selected point.
- The API reports area, perimeter, centroid, and bounding box.
- Three existing SQLite records were imported into PostGIS with their original IDs and coordinates.
- A read-only SQLite backup exists locally at `backend/db.sqlite3.backup` and is ignored by Git.
- `/api/properties/` is canonical; `/api/customers/` remains as a temporary compatibility API.

### Map and boundary workflow

- Google location search, browser geolocation, map point selection, address fallback, and stale-request protection remain intact.
- Google Places searches up to 20 places within 200 m and groups them by true-north direction.
- Users can start boundary mode, add vertices, undo, finish, clear, and edit a saved Google polygon.
- GeoJSON uses standard `[longitude, latitude]` coordinate ordering.
- Google Drawing Manager is not used.

### GIS storage and analysis

- PostGIS stores properties, boundaries, derived results, and versioned analysis snapshots only.
- Mapbox Tilequery supplies nearby buildings, roads, rail/water features, and land use on demand.
- Copernicus Data Space supplies DEM and Sentinel-2 imagery on demand with cached OAuth tokens.
- The analysis engine accepts 100, 200, 500, and 1000 m radii, with 500 m as the UI default.
- It always returns N, NE, E, SE, S, SW, W, and NW sections.
- Vector features are classified by true-north bearing and ordered by property-boundary distance.
- Sentinel-2 classification reports directional land-cover percentages.
- DEM sampling reports `elevated_terrain` when rise is at least 10 m and average grade at least 3%.
- Complete and partial analyses are persisted with source and provider-status metadata.

### Frontend analysis

- Saved properties can run synchronous PostGIS analyses through the new analysis API.
- The property snapshot shows all eight directions, distances, source labels, land-cover percentages,
  terrain metrics, analysis ID, radius, and timestamp.
- Vector analysis features can be toggled by type and rendered as overlays on the satellite map.
- Provider failures, missing boundaries, and unsupported radii produce explicit states.

## API

- `GET/POST /api/properties/`
- `GET/PATCH /api/properties/{id}/`
- `POST /api/properties/{id}/analyses/`
- `GET /api/properties/{id}/surroundings/?radius_m=500`
- `GET/POST /api/customers/` compatibility endpoint

## Verification

- Backend PostGIS tests: **9 passed**.
- Frontend tests: **25 passed**.
- Frontend production build: **passed**.
- Django schema check and migration consistency check: **passed**.
- PostgreSQL migrations through `customers.0003_gisfeature_geography`: **applied**.

## Provider configuration

Set `MAPBOX_ACCESS_TOKEN`, `SENTINEL_CLIENT_ID`, and `SENTINEL_CLIENT_SECRET` in `backend/.env`.
When one or more providers fail, analysis returns a saved `partial` result instead of HTTP 503.

## Deferred

- Property-facing orientation and Vastu-relative direction transformation.
- Authentication/authorization, delete workflows, pagination, and background analysis jobs.
- Report export and asynchronous/background analysis jobs.
- Browser-level end-to-end tests against a controlled live Google Maps environment.
