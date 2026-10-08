class GooglePlacesService:
    """Documents the existing client-side Places provider in analysis snapshots."""

    provider = "google"

    @staticmethod
    def status():
        return {
            "status": "client_side",
            "detail": "Nearby named places are fetched transiently by the Google Maps frontend.",
        }
