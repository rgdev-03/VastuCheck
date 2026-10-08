# Vastu GIS Property Surroundings POC

React and Google Maps frontend backed by Django REST Framework, PostgreSQL 17, and PostGIS.
The application stores a property point and boundary, keeps live Google Places results transient,
and produces versioned eight-direction surroundings analyses for any property coordinate using
Mapbox Streets, Copernicus DEM, and Sentinel-2.

## Backend

PostgreSQL 17 must have the `postgis` and `postgis_raster` extensions available. On Windows, the
standard PostGIS bundle provides GDAL, GEOS, PROJ, `ogr2ogr`, and `raster2pgsql`.

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Set PostgreSQL, Mapbox, and Copernicus Data Space credentials in .env
python manage.py migrate
python manage.py runserver
```

Canonical endpoints:

- `GET/POST /api/properties/`
- `GET/PATCH /api/properties/{id}/`
- `POST /api/properties/{id}/analyses/`
- `GET /api/properties/{id}/surroundings/?radius_m=500`
- `GET/POST /api/customers/` remains as a temporary coordinate-based compatibility endpoint.

To migrate the former SQLite records once:

```powershell
python manage.py import_legacy_sqlite .\db.sqlite3 --backup
```

The import preserves IDs, timestamps, contact data, and exact coordinates. Legacy rows have no
invented parcel boundary and must be opened and updated through the map before analysis.

## External analysis providers

Configure these server-side values in `backend/.env`:

```dotenv
MAPBOX_ACCESS_TOKEN=your-mapbox-token
SENTINEL_CLIENT_ID=your-copernicus-oauth-client-id
SENTINEL_CLIENT_SECRET=your-copernicus-oauth-client-secret
```

Mapbox Tilequery supplies nearby physical vector features. The Copernicus Data Space Process API
supplies Sentinel-2 land-cover classification and GLO-30 elevation when the account is eligible.
Because GLO-30 access is restricted by Copernicus, terrain analysis automatically retries with
GLO-90 after a permission denial. OAuth access tokens are cached until shortly before expiry. Local
OSM, WorldCover, and DEM imports are no longer required, and the old Ballari import/bootstrap
commands are intentionally disabled.

Provider failures do not fail the whole request. The API saves and returns a `partial` snapshot with
per-provider status and error details; input errors such as an unsupported radius still return 4xx.

## Frontend

Enable Maps JavaScript API, Places API (New), and Geocoding API for a referrer-restricted browser key.

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Property boundaries use an editable `google.maps.Polygon`; the removed Google Drawing Manager is
not used. Google Places remains a browser-side 200 m search. GIS analysis supports 100, 200, 500,
and 1000 m radii and uses geographic true north. PostGIS stores properties, boundaries, and analysis
snapshots only; it does not store global source datasets.

## Verification

```powershell
cd backend
python manage.py test

cd ..\frontend
npm test -- --run
npm run build
```
