"""Tests for session service."""

from __future__ import annotations

from anki_defs.services.session import (
    add_card,
    add_pending,
    add_word_to_db_cache,
    clear_all,
    clear_usage,
    get_state,
    get_usage_totals,
    load_word_cache,
    promote_pending,
    record_usage,
    remove_card,
    remove_pending,
    replace_deck_cache,
    search_history,
)


def _make_card(**overrides):
    base = {
        "id": "card-1",
        "word": "বাজার",
        "definition": "market",
        "banglaDefinition": "হাট",
        "exampleSentence": "সে **বাজারে** গেল।",
        "sentenceTranslation": "He went to the market.",
        "createdAt": 1000,
        "noteId": 42,
        "deckName": "Bangla",
        "modelName": "Bangla (and reversed)",
    }
    base.update(overrides)
    return base


def _make_pending(**overrides):
    base = {
        "id": "pending-1",
        "word": "কাঁদা",
        "definition": "to cry",
        "banglaDefinition": "চোখ থেকে জল পড়া",
        "exampleSentence": "মেয়েটা **কাঁদছে**।",
        "sentenceTranslation": "The girl is crying.",
        "createdAt": 2000,
        "deckName": "Bangla",
        "modelName": "Bangla (and reversed)",
    }
    base.update(overrides)
    return base


def test_empty_state():
    state = get_state()
    assert state["cards"] == []
    assert state["pendingQueue"] == []


def test_add_and_get_card():
    add_card(_make_card())
    state = get_state()
    assert len(state["cards"]) == 1
    assert state["cards"][0]["word"] == "বাজার"


def test_remove_card():
    add_card(_make_card())
    assert remove_card("card-1") is True
    assert remove_card("card-1") is False
    assert get_state()["cards"] == []


def test_add_and_get_pending():
    add_pending(_make_pending())
    state = get_state()
    assert len(state["pendingQueue"]) == 1
    assert state["pendingQueue"][0]["word"] == "কাঁদা"


def test_remove_pending():
    add_pending(_make_pending())
    assert remove_pending("pending-1") is True
    assert remove_pending("pending-1") is False


def test_promote_pending():
    add_pending(_make_pending())
    card = promote_pending("pending-1", note_id=99)
    assert card is not None
    assert card["noteId"] == 99
    assert card["word"] == "কাঁদা"
    state = get_state()
    assert len(state["cards"]) == 1
    assert len(state["pendingQueue"]) == 0


def test_promote_missing_pending():
    result = promote_pending("nonexistent", note_id=99)
    assert result is None


def test_clear_all():
    add_card(_make_card())
    add_pending(_make_pending())
    clear_all()
    state = get_state()
    assert state["cards"] == []
    assert state["pendingQueue"] == []


def test_usage_tracking():
    record_usage(
        {"inputTokens": 100, "outputTokens": 50, "provider": "gemini", "model": "gemini-2.5-flash"},
        0.001,
    )
    totals = get_usage_totals()
    assert totals["totalInputTokens"] == 100
    assert totals["totalOutputTokens"] == 50
    assert totals["requestCount"] == 1


def test_clear_usage():
    record_usage(
        {"inputTokens": 100, "outputTokens": 50, "provider": "claude", "model": "test"}, 0.0
    )
    clear_usage()
    totals = get_usage_totals()
    assert totals["requestCount"] == 0


def test_history_search():
    add_card(_make_card(id="c1", word="বাজার", createdAt=1))
    add_card(_make_card(id="c2", word="মাছ", definition="fish", createdAt=2))

    result = search_history()
    assert result["total"] == 2

    result = search_history(query="fish")
    assert result["total"] == 1
    assert result["items"][0]["word"] == "মাছ"


def test_history_pagination():
    for i in range(5):
        add_card(_make_card(id=f"c{i}", word=f"word{i}", createdAt=i))
    result = search_history(limit=2, offset=0)
    assert len(result["items"]) == 2
    assert result["total"] == 5


def test_word_cache():
    add_word_to_db_cache("বাজার", "Bangla")
    add_word_to_db_cache("মাছ", "Bangla")
    cache = load_word_cache()
    assert "বাজার" in cache["Bangla"]
    assert "মাছ" in cache["Bangla"]


def test_replace_deck_cache():
    add_word_to_db_cache("old", "Bangla")
    replace_deck_cache("Bangla", {"new1", "new2"})
    cache = load_word_cache()
    assert "old" not in cache.get("Bangla", set())
    assert "new1" in cache["Bangla"]
    assert "new2" in cache["Bangla"]
