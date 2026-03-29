"""Non-blocking HTTP server using socket + select, polled by QTimer.

Based on the AnkiConnect pattern: a non-blocking TCP socket server driven
by QTimer on the main thread. All request handling runs on the main thread,
making Anki collection access safe without threading.
"""

import json
import mimetypes
import os
import select
import socket

# Ensure mimetypes knows about common web types
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")

WEB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web")

# Max request body size: 1MB
MAX_BODY_SIZE = 1024 * 1024


class WebServer:
    def __init__(self, handler, get_token=None):
        """handler: callable(method, path, headers, body) -> Response
        get_token: callable() -> str | None -- returns the auth token, or None to skip auth
        """
        self.handler = handler
        self.get_token = get_token
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.setblocking(False)
        self.clients = {}  # {socket: ClientBuffer}
        self.client_addrs = {}  # {socket: (host, port)}

    def listen(self, port, host="0.0.0.0"):
        self.sock.bind((host, port))
        self.sock.listen(5)

    def close(self):
        for client_sock in list(self.clients.keys()):
            try:
                client_sock.close()
            except OSError:
                pass
        self.clients.clear()
        try:
            self.sock.close()
        except OSError:
            pass

    def advance(self):
        """Called by QTimer on main thread -- process ready connections."""
        # Accept new connections
        try:
            readable, _, _ = select.select([self.sock], [], [], 0)
            if readable:
                client_sock, addr = self.sock.accept()
                client_sock.setblocking(False)
                self.clients[client_sock] = ClientBuffer()
                self.client_addrs[client_sock] = addr
        except OSError:
            pass

        # Process existing clients
        if not self.clients:
            return

        try:
            readable, _, errored = select.select(
                list(self.clients.keys()), [], list(self.clients.keys()), 0
            )
        except (OSError, ValueError):
            return

        for sock in errored:
            self._close_client(sock)

        for sock in readable:
            buf = self.clients.get(sock)
            if buf is None:
                continue
            try:
                data = sock.recv(8192)
                if not data:
                    self._close_client(sock)
                    continue
                buf.feed(data)
                if buf.is_complete():
                    self._dispatch(sock, buf)
            except (ConnectionResetError, BrokenPipeError):
                self._close_client(sock)
            except BlockingIOError:
                pass
            except OSError:
                self._close_client(sock)

    def _check_auth(self, sock, headers):
        """Check bearer token auth for non-localhost requests. Returns None if OK, or Response."""
        if not self.get_token:
            return None
        addr = self.client_addrs.get(sock)
        if addr and addr[0] in ("127.0.0.1", "::1"):
            return None
        token = self.get_token()
        if not token:
            return Response.error("API token not configured", 401)
        auth = headers.get("authorization", "")
        if auth != "Bearer {}".format(token):
            return Response.error("Invalid or missing API token", 401)
        return None

    def _dispatch(self, sock, buf):
        """Parse HTTP request and dispatch to handler."""
        method, path, headers, body = buf.parse()

        # Check auth for non-localhost requests
        auth_error = self._check_auth(sock, headers)
        if auth_error is not None:
            self._send_response(sock, auth_error)
            return

        # Try API handler first
        response = self.handler(method, path, headers, body)

        if response is not None:
            if response.is_sse:
                # SSE: hand off the socket to the SSE handler
                self._send_sse_headers(sock)
                # Remove from polling -- the SSE thread owns this socket now
                del self.clients[sock]
                response.sse_callback(sock)
                return
            self._send_response(sock, response)
        else:
            # Try static file serving
            self._serve_static(sock, path)

    def _send_response(self, sock, response):
        """Send an HTTP response and close the connection."""
        status_line = "HTTP/1.1 {} {}\r\n".format(response.status, _status_text(response.status))
        headers = "Content-Type: {}\r\n".format(response.content_type)
        if response.extra_headers:
            for k, v in response.extra_headers.items():
                headers += "{}: {}\r\n".format(k, v)
        body_bytes = (
            response.body.encode("utf-8") if isinstance(response.body, str) else response.body
        )
        headers += "Content-Length: {}\r\n".format(len(body_bytes))
        headers += "Access-Control-Allow-Origin: *\r\n"
        headers += "Connection: close\r\n"

        raw = (status_line + headers + "\r\n").encode("utf-8") + body_bytes
        try:
            sock.sendall(raw)
        except OSError:
            pass
        self._close_client(sock)

    def _send_sse_headers(self, sock):
        """Send SSE response headers (no body yet)."""
        raw = (
            "HTTP/1.1 200 OK\r\n"
            "Content-Type: text/event-stream\r\n"
            "Cache-Control: no-cache\r\n"
            "Connection: keep-alive\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "\r\n"
        ).encode("utf-8")
        try:
            sock.sendall(raw)
        except OSError:
            pass

    def _serve_static(self, sock, path):
        """Serve static files from the web/ directory."""
        # Normalize path
        if path == "/" or path == "":
            path = "/index.html"

        # Security: prevent directory traversal
        clean = os.path.normpath(path.lstrip("/"))
        if clean.startswith(".."):
            self._send_response(sock, Response(403, "Forbidden"))
            return

        filepath = os.path.join(WEB_DIR, clean)

        # SPA fallback: if file doesn't exist and path doesn't have extension, serve index.html
        if not os.path.isfile(filepath):
            ext = os.path.splitext(clean)[1]
            if not ext:
                filepath = os.path.join(WEB_DIR, "index.html")

        if not os.path.isfile(filepath):
            self._send_response(sock, Response(404, "Not Found"))
            return

        content_type = mimetypes.guess_type(filepath)[0] or "application/octet-stream"
        try:
            with open(filepath, "rb") as f:
                body = f.read()
        except OSError:
            self._send_response(sock, Response(500, "Internal Server Error"))
            return

        status_line = "HTTP/1.1 200 OK\r\n"
        headers = "Content-Type: {}\r\n".format(content_type)
        headers += "Content-Length: {}\r\n".format(len(body))
        headers += "Access-Control-Allow-Origin: *\r\n"
        headers += "Connection: close\r\n"

        raw = (status_line + headers + "\r\n").encode("utf-8") + body
        try:
            sock.sendall(raw)
        except OSError:
            pass
        self._close_client(sock)

    def _close_client(self, sock):
        try:
            sock.close()
        except OSError:
            pass
        self.clients.pop(sock, None)
        self.client_addrs.pop(sock, None)


class ClientBuffer:
    """Buffers incoming HTTP request data until complete."""

    def __init__(self):
        self.data = b""
        self._headers_complete = False
        self._content_length = 0

    def feed(self, chunk):
        self.data += chunk
        if not self._headers_complete and b"\r\n\r\n" in self.data:
            self._headers_complete = True
            header_part = self.data.split(b"\r\n\r\n", 1)[0]
            for line in header_part.split(b"\r\n"):
                if line.lower().startswith(b"content-length:"):
                    try:
                        self._content_length = int(line.split(b":", 1)[1].strip())
                    except ValueError:
                        pass
            if self._content_length > MAX_BODY_SIZE:
                raise ValueError("Request body too large")

    def is_complete(self):
        if not self._headers_complete:
            return False
        parts = self.data.split(b"\r\n\r\n", 1)
        body = parts[1] if len(parts) > 1 else b""
        return len(body) >= self._content_length

    def parse(self):
        """Parse the buffered data into (method, path, headers_dict, body_str)."""
        parts = self.data.split(b"\r\n\r\n", 1)
        header_section = parts[0].decode("utf-8", errors="replace")
        body = parts[1] if len(parts) > 1 else b""
        body = body[: self._content_length]

        lines = header_section.split("\r\n")
        request_line = lines[0] if lines else ""
        tokens = request_line.split(" ")
        method = tokens[0] if len(tokens) > 0 else "GET"
        raw_path = tokens[1] if len(tokens) > 1 else "/"

        # Strip query string for routing, preserve it for handlers
        path = raw_path.split("?")[0]
        query_string = raw_path.split("?", 1)[1] if "?" in raw_path else ""

        headers = {}
        for line in lines[1:]:
            if ":" in line:
                key, value = line.split(":", 1)
                headers[key.strip().lower()] = value.strip()

        headers["query_string"] = query_string

        return method, path, headers, body.decode("utf-8", errors="replace")


class Response:
    """Simple HTTP response object."""

    def __init__(self, status, body="", content_type="text/plain", extra_headers=None):
        self.status = status
        self.body = body
        self.content_type = content_type
        self.extra_headers = extra_headers or {}
        self.is_sse = False
        self.sse_callback = None

    @staticmethod
    def json(data, status=200):
        return Response(status, json.dumps(data), "application/json")

    @staticmethod
    def error(message, status=500):
        return Response.json({"error": message}, status)

    @staticmethod
    def sse(callback):
        """Create an SSE response. callback(sock) will be called with the raw socket."""
        resp = Response(200)
        resp.is_sse = True
        resp.sse_callback = callback
        return resp


def _status_text(code):
    texts = {
        200: "OK",
        400: "Bad Request",
        403: "Forbidden",
        404: "Not Found",
        405: "Method Not Allowed",
        500: "Internal Server Error",
    }
    return texts.get(code, "Unknown")
