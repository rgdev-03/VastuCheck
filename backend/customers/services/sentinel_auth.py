import threading
import time

import requests
from django.conf import settings

from .provider import ProviderError, response_error


class SentinelAuthService:
    provider = "sentinel"
    _cache = {}
    _cache_lock = threading.Lock()

    def __init__(self, client_id=None, client_secret=None, session=None):
        self.client_id = client_id or settings.SENTINEL_CLIENT_ID
        self.client_secret = client_secret or settings.SENTINEL_CLIENT_SECRET
        self.session = session or requests.Session()

    def token(self):
        cached = self._cache.get(self.client_id)
        if cached and time.monotonic() < cached[1]:
            return cached[0]
        with self._cache_lock:
            cached = self._cache.get(self.client_id)
            if cached and time.monotonic() < cached[1]:
                return cached[0]
            if not self.client_id or not self.client_secret:
                raise ProviderError(self.provider, "Sentinel OAuth credentials are not configured.")
            try:
                response = self.session.post(
                    settings.SENTINEL_TOKEN_URL,
                    data={
                        "grant_type": "client_credentials",
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                    },
                    timeout=settings.PROVIDER_TIMEOUT_SECONDS,
                )
            except requests.RequestException as error:
                raise ProviderError(self.provider, f"Sentinel authentication failed: {error}") from error
            if not response.ok:
                raise response_error(response, self.provider)
            payload = response.json()
            token = payload["access_token"]
            expires_at = time.monotonic() + max(int(payload.get("expires_in", 300)) - 30, 1)
            self._cache[self.client_id] = (token, expires_at)
            return token
