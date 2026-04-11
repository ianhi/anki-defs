"""Integration tests for FastAPI routes using TestClient."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from anki_defs.main import app


@pytest.fixture
def client():
    return TestClient(app)


class TestHealthAndPlatform:
    def test_health(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    def test_platform(self, client):
        resp = client.get("/api/platform")
        assert resp.status_code == 200
        assert resp.json() == {"platform": "web"}


class TestSettings:
    def test_get_settings(self, client):
        resp = client.get("/api/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert data["aiProvider"] == "gemini"
        assert data["defaultDeck"] == "Bangla"
        # Keys should be masked (empty = empty, not masked)
        assert data["claudeApiKey"] == ""

    def test_put_settings(self, client):
        resp = client.put("/api/settings", json={"aiProvider": "gemini"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["aiProvider"] == "gemini"

    def test_masked_keys_ignored(self, client):
        # First set a real key
        client.put("/api/settings", json={"claudeApiKey": "sk-test-1234"})
        # Then try to update with masked key — should be ignored
        masked = "\u2022" * 8 + "1234"
        client.put("/api/settings", json={"claudeApiKey": masked})
        # Key should still be the original
        resp = client.get("/api/settings")
        assert resp.json()["claudeApiKey"] == "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u20221234"


class TestSession:
    def test_get_empty_session(self, client):
        resp = client.get("/api/session")
        assert resp.status_code == 200
        data = resp.json()
        assert data["cards"] == []
        assert data["pendingQueue"] == []

    def test_add_card(self, client):
        card = {
            "id": "c1",
            "word": "বাজার",
            "definition": "market",
            "nativeDefinition": "",
            "exampleSentence": "",
            "sentenceTranslation": "",
            "createdAt": 1000,
            "noteId": 42,
            "deckName": "Bangla",
            "modelName": "Test",
        }
        resp = client.post("/api/session/cards", json=card)
        assert resp.status_code == 200
        assert resp.json()["success"] is True

        state = client.get("/api/session").json()
        assert len(state["cards"]) == 1

    def test_add_card_validation(self, client):
        resp = client.post("/api/session/cards", json={"word": "test"})
        assert resp.status_code == 400

    def test_usage(self, client):
        resp = client.get("/api/session/usage")
        assert resp.status_code == 200
        data = resp.json()
        assert data["requestCount"] == 0

    def test_history(self, client):
        resp = client.get("/api/session/history")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["items"] == []


class TestPrompts:
    def test_preview_single_word(self, client):
        resp = client.post("/api/prompts/preview", json={"newMessage": "বাজার"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["mode"] == "single-word"
        assert "বাজার" in data["userMessage"]
        assert data["systemPrompt"] != ""

    def test_preview_focused(self, client):
        resp = client.post(
            "/api/prompts/preview",
            json={"newMessage": "সে বাজারে গেল", "highlightedWords": ["বাজারে"]},
        )
        assert resp.status_code == 200
        assert resp.json()["mode"] == "focused-words"

    def test_preview_english_to_bangla(self, client):
        resp = client.post(
            "/api/prompts/preview",
            json={"newMessage": "market", "mode": "english-to-target"},
        )
        assert resp.status_code == 200
        assert resp.json()["mode"] == "english-to-target"

    def test_preview_missing_message(self, client):
        resp = client.post("/api/prompts/preview", json={})
        assert resp.status_code == 400


class TestLanguages:
    def test_get_languages(self, client):
        resp = client.get("/api/anki/languages")
        assert resp.status_code == 200
        data = resp.json()
        assert "languages" in data
        assert isinstance(data["languages"], list)
        # At least Bangla should be available
        codes = [lang["code"] for lang in data["languages"]]
        assert "bn-IN" in codes
