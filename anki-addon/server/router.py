"""URL routing and request dispatch."""

import re
from .web import Response


class Router:
    def __init__(self):
        self.routes = []

    def add(self, method, pattern, handler):
        """Register a route. Pattern can contain :param placeholders."""
        # Convert :param to named regex groups
        regex = re.sub(r":([a-zA-Z_]+)", r"(?P<\1>[^/]+)", pattern)
        regex = "^" + regex + "$"
        self.routes.append((method, re.compile(regex), handler))

    def get(self, pattern, handler):
        self.add("GET", pattern, handler)

    def post(self, pattern, handler):
        self.add("POST", pattern, handler)

    def put(self, pattern, handler):
        self.add("PUT", pattern, handler)

    def delete(self, pattern, handler):
        self.add("DELETE", pattern, handler)

    def handle(self, method, path, headers, body):
        """Route a request. Returns Response or None (for static files)."""
        # Handle CORS preflight
        if method == "OPTIONS":
            return Response(
                200, "",
                extra_headers={
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Max-Age": "86400",
                },
            )

        for route_method, regex, handler in self.routes:
            if method != route_method:
                continue
            match = regex.match(path)
            if match:
                try:
                    return handler(match.groupdict(), headers, body)
                except Exception as e:
                    return Response.error(str(e))

        # No route matched -- return None to fall through to static file serving
        if path.startswith("/api/"):
            return Response.error("Not Found", 404)
        return None
