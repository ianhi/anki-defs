"""Bearer token auth — localhost exempt, remote requires token."""

from __future__ import annotations

from bottle import HTTPResponse, request

from ..services.settings import get_settings

_LOCALHOST_IPS = {"127.0.0.1", "::1", "::ffff:127.0.0.1"}


def _is_tailscale_ip(ip: str) -> bool:
    """Tailscale CGNAT range: 100.64.0.0/10 (100.64.x.x - 100.127.x.x)."""
    parts = ip.split(".")
    if len(parts) != 4:
        return False
    try:
        return int(parts[0]) == 100 and 64 <= int(parts[1]) <= 127
    except ValueError:
        return False


def check_auth() -> None:
    """Before-request hook: enforce bearer token for non-trusted IPs."""
    if not request.path.startswith("/api"):
        return

    client_ip = request.remote_addr or ""
    if client_ip in _LOCALHOST_IPS or _is_tailscale_ip(client_ip):
        return

    settings = get_settings()
    token = settings.get("apiToken", "")
    if not token:
        raise HTTPResponse(
            status=401,
            body='{"error":"API token not configured"}',
            Content_Type="application/json",
        )

    auth_header = request.get_header("Authorization", "")
    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or parts[1] != token:
        raise HTTPResponse(
            status=401,
            body='{"error":"Invalid or missing API token"}',
            Content_Type="application/json",
        )
