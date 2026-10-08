class ProviderError(Exception):
    def __init__(self, provider, message, status_code=None):
        self.provider = provider
        self.status_code = status_code
        super().__init__(message)


def response_error(response, provider):
    try:
        detail = response.json().get("error", {}).get("message") or response.json().get("message")
    except (TypeError, ValueError, AttributeError):
        detail = None
    return ProviderError(
        provider,
        detail or f"{provider} returned HTTP {response.status_code}.",
        status_code=response.status_code,
    )
