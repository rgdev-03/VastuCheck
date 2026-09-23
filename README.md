# Customer Property Location POC

A small React + ArcGIS frontend backed by Django REST Framework and SQLite.

## Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py runserver
```

The API is available at `http://localhost:8000/api/customers/`.

## Frontend

Create a restricted ArcGIS API key with basemap and geocoding privileges. Also create a restricted Google Maps key with Maps JavaScript API, Places API (New), and Geocoding API enabled. Rotate the keys previously shared in source or chat before using the application.

```powershell
cd frontend
npm install
Copy-Item .env.example .env
# Put the replacement ArcGIS and Google Maps keys in .env
npm run dev
```

Open `http://localhost:5173`. Browser geolocation works on localhost and on HTTPS deployments.

## Tests

```powershell
cd backend
python manage.py test

cd ..\frontend
npm test -- --run
```
