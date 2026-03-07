"""Tests for the non-blocking HTTP server components."""

import json
import socket
import threading
import time


class TestClientBuffer:
    """Test HTTP request parsing."""

    def test_simple_get(self):
        from server.web import ClientBuffer

        buf = ClientBuffer()
        buf.feed(b"GET /api/health HTTP/1.1\r\nHost: localhost\r\n\r\n")
        assert buf.is_complete()
        method, path, headers, body = buf.parse()
        assert method == "GET"
        assert path == "/api/health"
        assert headers["host"] == "localhost"
        assert body == ""

    def test_post_with_body(self):
        from server.web import ClientBuffer

        request = b'POST /api/chat/define HTTP/1.1\r\nContent-Length: 16\r\n\r\n{"word":"hello"}'
        buf = ClientBuffer()
        buf.feed(request)
        assert buf.is_complete()
        method, path, headers, body = buf.parse()
        assert method == "POST"
        assert path == "/api/chat/define"
        assert json.loads(body) == {"word": "hello"}

    def test_incomplete_body(self):
        from server.web import ClientBuffer

        buf = ClientBuffer()
        buf.feed(b"POST /test HTTP/1.1\r\nContent-Length: 100\r\n\r\npartial")
        assert not buf.is_complete()

    def test_chunked_receive(self):
        from server.web import ClientBuffer

        buf = ClientBuffer()
        buf.feed(b"GET /test HTTP")
        assert not buf.is_complete()
        buf.feed(b"/1.1\r\nHost: localhost\r\n")
        assert not buf.is_complete()
        buf.feed(b"\r\n")
        assert buf.is_complete()

    def test_query_string_stripped(self):
        from server.web import ClientBuffer

        buf = ClientBuffer()
        buf.feed(b"GET /api/test?foo=bar&baz=1 HTTP/1.1\r\n\r\n")
        assert buf.is_complete()
        method, path, headers, body = buf.parse()
        assert path == "/api/test"


class TestResponse:
    """Test Response helper methods."""

    def test_json_response(self):
        from server.web import Response

        resp = Response.json({"status": "ok"})
        assert resp.status == 200
        assert resp.content_type == "application/json"
        assert json.loads(resp.body) == {"status": "ok"}

    def test_json_with_status(self):
        from server.web import Response

        resp = Response.json({"error": "not found"}, 404)
        assert resp.status == 404

    def test_error_response(self):
        from server.web import Response

        resp = Response.error("something broke", 500)
        assert resp.status == 500
        data = json.loads(resp.body)
        assert data["error"] == "something broke"

    def test_sse_response(self):
        from server.web import Response

        callback_called = []
        resp = Response.sse(lambda sock: callback_called.append(True))
        assert resp.is_sse
        assert resp.sse_callback is not None


class TestRouter:
    """Test URL routing."""

    def test_simple_route(self):
        from server.router import Router
        from server.web import Response

        router = Router()
        router.get("/api/health", lambda p, h, b: Response.json({"ok": True}))

        result = router.handle("GET", "/api/health", {}, "")
        assert result is not None
        assert json.loads(result.body) == {"ok": True}

    def test_path_params(self):
        from server.router import Router
        from server.web import Response

        router = Router()
        router.get(
            "/api/anki/models/:name/fields",
            lambda p, h, b: Response.json({"model": p["name"]}),
        )

        result = router.handle("GET", "/api/anki/models/Basic/fields", {}, "")
        assert json.loads(result.body) == {"model": "Basic"}

    def test_numeric_path_param(self):
        from server.router import Router
        from server.web import Response

        router = Router()
        router.get(
            "/api/anki/notes/:id",
            lambda p, h, b: Response.json({"id": int(p["id"])}),
        )

        result = router.handle("GET", "/api/anki/notes/12345", {}, "")
        assert json.loads(result.body) == {"id": 12345}

    def test_no_match_returns_none_for_non_api(self):
        from server.router import Router

        router = Router()
        result = router.handle("GET", "/index.html", {}, "")
        assert result is None

    def test_no_match_returns_404_for_api(self):
        from server.router import Router

        router = Router()
        result = router.handle("GET", "/api/nonexistent", {}, "")
        assert result is not None
        assert result.status == 404

    def test_method_mismatch(self):
        from server.router import Router
        from server.web import Response

        router = Router()
        router.get("/api/test", lambda p, h, b: Response.json({"ok": True}))

        result = router.handle("POST", "/api/test", {}, "")
        # POST to a GET-only route on /api/ path -> 404
        assert result is not None
        assert result.status == 404

    def test_cors_preflight(self):
        from server.router import Router

        router = Router()
        result = router.handle("OPTIONS", "/api/anything", {}, "")
        assert result.status == 200
        assert "Access-Control-Allow-Methods" in result.extra_headers

    def test_handler_exception_returns_error(self):
        from server.router import Router

        def bad_handler(p, h, b):
            raise ValueError("test error")

        router = Router()
        router.get("/api/bad", bad_handler)

        result = router.handle("GET", "/api/bad", {}, "")
        assert result.status == 500
        assert "test error" in json.loads(result.body)["error"]

    def test_post_route_with_body(self):
        from server.router import Router
        from server.web import Response

        router = Router()
        router.post(
            "/api/chat/define",
            lambda p, h, b: Response.json(json.loads(b)),
        )

        result = router.handle("POST", "/api/chat/define", {}, '{"word":"test"}')
        assert json.loads(result.body) == {"word": "test"}

    def test_delete_route(self):
        from server.router import Router
        from server.web import Response

        router = Router()
        router.delete(
            "/api/anki/notes/:id",
            lambda p, h, b: Response.json({"deleted": p["id"]}),
        )

        result = router.handle("DELETE", "/api/anki/notes/99", {}, "")
        assert json.loads(result.body) == {"deleted": "99"}

    def test_put_route(self):
        from server.router import Router
        from server.web import Response

        router = Router()
        router.put("/api/settings", lambda p, h, b: Response.json({"updated": True}))

        result = router.handle("PUT", "/api/settings", {}, "{}")
        assert json.loads(result.body) == {"updated": True}


class TestSSE:
    """Test SSE formatting."""

    def test_format_text_event(self):
        from server.sse import format_sse_event

        msg = format_sse_event("text", "hello world")
        assert msg.startswith("data: ")
        assert msg.endswith("\n\n")
        payload = json.loads(msg[6:].strip())
        assert payload == {"type": "text", "data": "hello world"}

    def test_format_card_preview_event(self):
        from server.sse import format_sse_event

        card = {"word": "test", "definition": "a test", "alreadyExists": False}
        msg = format_sse_event("card_preview", card)
        payload = json.loads(msg[6:].strip())
        assert payload["type"] == "card_preview"
        assert payload["data"]["word"] == "test"

    def test_format_done_event(self):
        from server.sse import format_sse_event

        msg = format_sse_event("done", None)
        payload = json.loads(msg[6:].strip())
        assert payload == {"type": "done", "data": None}


class TestWebServerIntegration:
    """Integration test: start server, make HTTP request, verify response."""

    def test_full_request_response(self):
        from server.router import Router
        from server.web import Response, WebServer

        router = Router()
        router.get("/api/health", lambda p, h, b: Response.json({"status": "ok"}))

        server = WebServer(router.handle)
        server.listen(0)  # bind to random available port
        port = server.sock.getsockname()[1]

        try:
            # Make a request from a client thread
            response_data = {}

            def client():
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.connect(("127.0.0.1", port))
                s.sendall(b"GET /api/health HTTP/1.1\r\nHost: localhost\r\n\r\n")
                data = b""
                while True:
                    chunk = s.recv(4096)
                    if not chunk:
                        break
                    data += chunk
                s.close()
                response_data["raw"] = data.decode("utf-8", errors="replace")

            t = threading.Thread(target=client)
            t.start()

            # Poll the server a few times to process the request
            for _ in range(100):
                server.advance()
                time.sleep(0.01)
                if response_data:
                    break

            t.join(timeout=2)

            assert "raw" in response_data
            assert "200 OK" in response_data["raw"]
            # Extract body (after double CRLF)
            body_start = response_data["raw"].find("\r\n\r\n")
            if body_start >= 0:
                body = response_data["raw"][body_start + 4 :]
                assert json.loads(body) == {"status": "ok"}
        finally:
            server.close()
