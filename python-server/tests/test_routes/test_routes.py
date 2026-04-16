"""Integration tests for Bottle routes using WebTest."""

from __future__ import annotations

import pytest
from webtest import TestApp

from anki_defs.main import app


@pytest.fixture
def client():
    return TestApp(app, extra_environ={"REMOTE_ADDR": "127.0.0.1"})


class TestHealthAndPlatform:
    def test_health(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json == {"status": "ok"}

    def test_platform(self, client):
        resp = client.get("/api/platform")
        assert resp.status_code == 200
        assert resp.json == {"platform": "web"}


class TestSettings:
    def test_get_settings(self, client):
        resp = client.get("/api/settings")
        assert resp.status_code == 200
        data = resp.json
        assert data["aiProvider"] == "gemini"
        assert data["defaultDeck"] == "Bangla"
        assert data["claudeApiKey"] == ""

    def test_put_settings(self, client):
        resp = client.put_json("/api/settings", {"aiProvider": "gemini"})
        assert resp.status_code == 200
        data = resp.json
        assert data["aiProvider"] == "gemini"

    def test_masked_keys_ignored(self, client):
        client.put_json("/api/settings", {"claudeApiKey": "sk-test-1234"})
        masked = "\u2022" * 8 + "1234"
        client.put_json("/api/settings", {"claudeApiKey": masked})
        resp = client.get("/api/settings")
        assert resp.json["claudeApiKey"] == "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u20221234"


class TestSession:
    def test_get_empty_session(self, client):
        resp = client.get("/api/session")
        assert resp.status_code == 200
        data = resp.json
        assert data["cards"] == []
        assert data["pendingQueue"] == []

    def test_add_card(self, client):
        card = {
            "id": "c1",
            "word": "\u09ac\u09be\u099c\u09be\u09b0",
            "definition": "market",
            "nativeDefinition": "",
            "exampleSentence": "",
            "sentenceTranslation": "",
            "createdAt": 1000,
            "noteId": 42,
            "deckName": "Bangla",
            "modelName": "Test",
        }
        resp = client.post_json("/api/session/cards", card)
        assert resp.status_code == 200
        assert resp.json["success"] is True

        state = client.get("/api/session").json
        assert len(state["cards"]) == 1

    def test_add_card_validation(self, client):
        resp = client.post_json("/api/session/cards", {"word": "test"}, expect_errors=True)
        assert resp.status_code == 400

    def test_usage(self, client):
        resp = client.get("/api/session/usage")
        assert resp.status_code == 200
        data = resp.json
        assert data["requestCount"] == 0

    def test_history(self, client):
        resp = client.get("/api/session/history")
        assert resp.status_code == 200
        data = resp.json
        assert data["total"] == 0
        assert data["items"] == []


class TestPrompts:
    def test_preview_single_word(self, client):
        resp = client.post_json(
            "/api/prompts/preview", {"newMessage": "\u09ac\u09be\u099c\u09be\u09b0"}
        )
        assert resp.status_code == 200
        data = resp.json
        assert data["mode"] == "single-word"
        assert "\u09ac\u09be\u099c\u09be\u09b0" in data["userMessage"]
        assert data["systemPrompt"] != ""

    def test_preview_focused(self, client):
        resp = client.post_json(
            "/api/prompts/preview",
            {
                "newMessage": "সে বাজারে গেল",
                "highlightedWords": ["\u09ac\u09be\u099c\u09be\u09b0\u09c7"],
            },
        )
        assert resp.status_code == 200
        assert resp.json["mode"] == "focused-words"

    def test_preview_english_to_bangla(self, client):
        resp = client.post_json(
            "/api/prompts/preview",
            {"newMessage": "market", "mode": "english-to-target"},
        )
        assert resp.status_code == 200
        assert resp.json["mode"] == "english-to-target"

    def test_preview_missing_message(self, client):
        resp = client.post_json("/api/prompts/preview", {}, expect_errors=True)
        assert resp.status_code == 400


class TestLanguages:
    def test_get_languages(self, client):
        resp = client.get("/api/anki/languages")
        assert resp.status_code == 200
        data = resp.json
        assert "languages" in data
        assert isinstance(data["languages"], list)
        codes = [lang["code"] for lang in data["languages"]]
        assert "bn-IN" in codes
