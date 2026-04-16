"""Tests for SSE formatting."""

import json


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
