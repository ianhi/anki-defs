"""Bearer token auth middleware — localhost exempt, remote requires token."""

from __future__ import annotations

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from ..services.settings import get_settings

_LOCALHOST_IPS = {"127.0.0.1", "::1", "::ffff:127.0.0.1", "testclient"}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Only protect /api/* routes
        if not request.url.path.startswith("/api"):
            return await call_next(request)

        # Localhost is exempt
        client_ip = request.client.host if request.client else ""
        if client_ip in _LOCALHOST_IPS:
            return await call_next(request)

        settings = get_settings()
        token = settings.get("apiToken", "")
        if not token:
            return Response(
                content='{"error":"API token not configured"}',
                status_code=401,
                media_type="application/json",
            )

        auth_header = request.headers.get("authorization", "")
        parts = auth_header.split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != "bearer" or parts[1] != token:
            return Response(
                content='{"error":"Invalid or missing API token"}',
                status_code=401,
                media_type="application/json",
            )

        return await call_next(request)
