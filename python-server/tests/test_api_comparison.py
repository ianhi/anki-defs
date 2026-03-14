"""Phase 3: API comparison tests — Express (:3001) vs Python (:3002).

Run both servers, then:
    cd python-server && uv run pytest tests/test_api_comparison.py -v

Requires:
    - Express server on :3001 (npm run dev:server)
    - Python server on :3002 (ANKI_DEFS_DEV=1 uv run uvicorn anki_defs.main:app --port 3002)
    - Anki Desktop with AnkiConnect (optional — anki tests skipped if offline)
"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

EXPRESS_URL = "http://localhost:3001"
PYTHON_URL = "http://localhost:3002"


@pytest.fixture(scope="module")
def express() -> httpx.Client:
    client = httpx.Client(base_url=EXPRESS_URL, timeout=10.0)
    try:
        client.get("/api/health")
    except httpx.ConnectError:
        pytest.skip("Express server not running on :3001")
    return client


@pytest.fixture(scope="module")
def python() -> httpx.Client:
    client = httpx.Client(base_url=PYTHON_URL, timeout=10.0)
    try:
        client.get("/api/health")
    except httpx.ConnectError:
        pytest.skip("Python server not running on :3002")
    return client


def _anki_available(client: httpx.Client) -> bool:
    try:
        resp = client.get("/api/anki/status")
        return resp.json().get("connected", False)
    except Exception:
        return False


# --- Exact match endpoints ---


class TestExactMatch:
    def test_health(self, express: httpx.Client, python: httpx.Client):
        e = express.get("/api/health").json()
        p = python.get("/api/health").json()
        assert e == p == {"status": "ok"}

    def test_platform(self, express: httpx.Client, python: httpx.Client):
        e = express.get("/api/platform").json()
        p = python.get("/api/platform").json()
        assert e == {"platform": "web"}
        assert p == {"platform": "web"}


# --- Settings ---


class TestSettings:
    def test_settings_structure(self, express: httpx.Client, python: httpx.Client):
        e = express.get("/api/settings").json()
        p = python.get("/api/settings").json()
        # Same keys
        assert set(e.keys()) == set(p.keys()), f"Key mismatch: {set(e.keys()) ^ set(p.keys())}"

    def test_settings_values(self, express: httpx.Client, python: httpx.Client):
        e = express.get("/api/settings").json()
        p = python.get("/api/settings").json()
        # Compare non-key fields (keys may differ if servers use different settings files)
        for field in ("aiProvider", "defaultDeck", "defaultModel", "showTransliteration",
                       "leftHanded", "ankiConnectUrl", "englishToBanglaPrefix", "autoDetectEnglish"):
            assert e.get(field) == p.get(field), f"{field}: express={e.get(field)}, python={p.get(field)}"

    def test_settings_keys_masked(self, express: httpx.Client, python: httpx.Client):
        e = express.get("/api/settings").json()
        p = python.get("/api/settings").json()
        for key_field in ("claudeApiKey", "geminiApiKey", "openRouterApiKey"):
            e_val = e.get(key_field, "")
            p_val = p.get(key_field, "")
            # Both should be either empty or masked (starts with bullets)
            if e_val:
                assert e_val.endswith(p_val[-4:]) or e_val == p_val, (
                    f"{key_field} masking mismatch"
                )


# --- Anki endpoints (require Anki running) ---


class TestAnki:
    def test_status(self, express: httpx.Client, python: httpx.Client):
        e = express.get("/api/anki/status").json()
        p = python.get("/api/anki/status").json()
        assert set(e.keys()) == set(p.keys())
        # Both should agree on connection state
        assert e["connected"] == p["connected"]

    def test_decks(self, express: httpx.Client, python: httpx.Client):
        if not _anki_available(express):
            pytest.skip("Anki not available")
        e = express.get("/api/anki/decks").json()
        p = python.get("/api/anki/decks").json()
        assert sorted(e["decks"]) == sorted(p["decks"])

    def test_models(self, express: httpx.Client, python: httpx.Client):
        if not _anki_available(express):
            pytest.skip("Anki not available")
        e = express.get("/api/anki/models").json()
        p = python.get("/api/anki/models").json()
        assert sorted(e["models"]) == sorted(p["models"])

    def test_model_fields(self, express: httpx.Client, python: httpx.Client):
        if not _anki_available(express):
            pytest.skip("Anki not available")
        # Use a model that should exist
        settings = express.get("/api/settings").json()
        model = settings.get("defaultModel", "Basic")
        e = express.get(f"/api/anki/models/{model}/fields").json()
        p = python.get(f"/api/anki/models/{model}/fields").json()
        assert e["fields"] == p["fields"]


# --- Session ---


class TestSession:
    def test_session_structure(self, express: httpx.Client, python: httpx.Client):
        e = express.get("/api/session").json()
        p = python.get("/api/session").json()
        assert "cards" in e and "pendingQueue" in e
        assert "cards" in p and "pendingQueue" in p
        # Same data (they share the same SQLite DB file)
        assert len(e["cards"]) == len(p["cards"]), (
            f"Card count mismatch: express={len(e['cards'])}, python={len(p['cards'])}"
        )

    def test_usage_structure(self, express: httpx.Client, python: httpx.Client):
        e = express.get("/api/session/usage").json()
        p = python.get("/api/session/usage").json()
        assert set(e.keys()) == set(p.keys())
        for key in ("totalInputTokens", "totalOutputTokens", "totalCost", "requestCount"):
            assert key in e and key in p

    def test_history_structure(self, express: httpx.Client, python: httpx.Client):
        e = express.get("/api/session/history?limit=5").json()
        p = python.get("/api/session/history?limit=5").json()
        assert "items" in e and "total" in e
        assert "items" in p and "total" in p
        assert e["total"] == p["total"], (
            f"History total mismatch: express={e['total']}, python={p['total']}"
        )


# --- Prompt preview ---


class TestPromptPreview:
    def _compare_preview(
        self, express: httpx.Client, python: httpx.Client, body: dict[str, Any]
    ):
        e = express.post("/api/prompts/preview", json=body).json()
        p = python.post("/api/prompts/preview", json=body).json()
        assert e["mode"] == p["mode"], f"Mode mismatch: {e['mode']} vs {p['mode']}"
        assert e["userMessage"] == p["userMessage"], (
            f"User message mismatch:\n  express: {e['userMessage']}\n  python:  {p['userMessage']}"
        )
        # System prompts should match (same template files)
        assert e["systemPrompt"] == p["systemPrompt"], "System prompt mismatch"

    def test_single_word(self, express: httpx.Client, python: httpx.Client):
        self._compare_preview(express, python, {"newMessage": "বাজার"})

    def test_focused_words(self, express: httpx.Client, python: httpx.Client):
        self._compare_preview(
            express, python,
            {"newMessage": "সে বাজারে গেল", "highlightedWords": ["বাজারে", "গেল"]},
        )

    def test_english_to_bangla(self, express: httpx.Client, python: httpx.Client):
        self._compare_preview(
            express, python, {"newMessage": "market", "mode": "english-to-bangla"}
        )

    def test_english_to_bangla_focused(self, express: httpx.Client, python: httpx.Client):
        self._compare_preview(
            express, python,
            {
                "newMessage": "this is a potted plant",
                "highlightedWords": ["potted"],
                "mode": "english-to-bangla",
            },
        )

    def test_sentence_blocked(self, express: httpx.Client, python: httpx.Client):
        self._compare_preview(express, python, {"newMessage": "সে বাজারে গেল"})


# --- SSE structure (chat stream) ---


class TestSSEStructure:
    """Compare SSE event types/structure, not AI content (which varies per call)."""

    def _parse_sse(self, response: httpx.Response) -> list[dict[str, Any]]:
        events = []
        for line in response.text.strip().split("\n"):
            line = line.strip()
            if line.startswith("data: "):
                try:
                    events.append(json.loads(line[6:]))
                except json.JSONDecodeError:
                    pass
        return events

    def test_stream_event_types(self, express: httpx.Client, python: httpx.Client):
        """Both servers should produce the same event type sequence for the same input."""
        if not _anki_available(express):
            pytest.skip("Anki not available (needed for card_preview events)")

        settings = express.get("/api/settings").json()
        # Skip if no AI key configured
        provider = settings.get("aiProvider", "claude")
        key_field = {
            "claude": "claudeApiKey",
            "gemini": "geminiApiKey",
            "openrouter": "openRouterApiKey",
        }.get(provider, "")
        if not settings.get(key_field):
            pytest.skip(f"No API key for {provider}")

        body = {"newMessage": "বাজার"}

        # Use longer timeout for AI calls
        e_resp = express.post("/api/chat/stream", json=body, timeout=30.0)
        p_resp = python.post("/api/chat/stream", json=body, timeout=30.0)

        e_events = self._parse_sse(e_resp)
        p_events = self._parse_sse(p_resp)

        e_types = [e["type"] for e in e_events]
        p_types = [e["type"] for e in p_events]

        # Both should end with "done"
        assert e_types[-1] == "done", f"Express didn't end with done: {e_types}"
        assert p_types[-1] == "done", f"Python didn't end with done: {p_types}"

        # Both should have at least usage + card_preview + done (or error + done)
        assert len(e_types) >= 2, f"Express too few events: {e_types}"
        assert len(p_types) >= 2, f"Python too few events: {p_types}"

        # If no errors, both should have same event type sequence
        if "error" not in e_types and "error" not in p_types:
            assert e_types == p_types, (
                f"Event type sequence mismatch:\n  express: {e_types}\n  python:  {p_types}"
            )


# --- Write operations (independent, verify status codes) ---


class TestWriteOps:
    def test_session_card_crud(self, express: httpx.Client, python: httpx.Client):
        """Both servers handle session card CRUD with same status codes."""
        card = {
            "id": "test-comparison-card",
            "word": "পরীক্ষা",
            "definition": "test",
            "banglaDefinition": "",
            "exampleSentence": "",
            "sentenceTranslation": "",
            "createdAt": 9999999,
            "noteId": 0,
            "deckName": "Bangla",
            "modelName": "Basic",
        }

        # Add card to both
        e = express.post("/api/session/cards", json=card)
        p = python.post("/api/session/cards", json=card)
        assert e.status_code == p.status_code == 200

        # Delete from both
        e = express.delete("/api/session/cards/test-comparison-card")
        p = python.delete("/api/session/cards/test-comparison-card")
        assert e.status_code == p.status_code == 200

    def test_validation_errors_match(self, express: httpx.Client, python: httpx.Client):
        """Both servers reject invalid input with same status codes."""
        # Missing required fields
        e = express.post("/api/session/cards", json={"word": "test"})
        p = python.post("/api/session/cards", json={"word": "test"})
        assert e.status_code == p.status_code == 400

        e = express.post("/api/chat/relemmatize", json={})
        p = python.post("/api/chat/relemmatize", json={})
        assert e.status_code == p.status_code == 400

        e = express.post("/api/prompts/preview", json={})
        p = python.post("/api/prompts/preview", json={})
        assert e.status_code == p.status_code == 400
