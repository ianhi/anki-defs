"""Protocol defining the Anki backend interface used by route modules.

Both ``anki_connect`` (python-server) and ``anki_service`` (anki-addon)
implement this interface.  Routes accept an ``AnkiBackend`` parameter
instead of ``Any`` so that pyright can verify call signatures.
"""

from __future__ import annotations

from typing import Any, Protocol


class AnkiBackend(Protocol):
    """Minimal Anki backend interface consumed by shared route handlers."""

    def get_decks(self) -> list[str]: ...

    def get_models(self) -> list[str]: ...

    def get_model_fields(self, model_name: str) -> list[str]: ...

    def search_notes(self, query: str) -> list[dict[str, Any]]: ...

    def search_word(
        self, word: str, deck_name: str
    ) -> dict[str, Any] | None: ...

    def get_note(self, note_id: int) -> dict[str, Any] | None: ...

    def create_card(
        self,
        deck: str,
        card_type: str,
        word: str,
        definition: str,
        native_definition: str,
        example: str,
        translation: str,
        vocab_templates: dict[str, bool] | None = None,
        tags: list[str] | None = None,
    ) -> tuple[int, str]: ...

    def delete_note(self, note_id: int) -> None: ...

    def sync(self) -> None: ...

    def get_status(self) -> dict[str, Any]: ...

    def check_migrations_for_deck(
        self,
        deck: str,
        card_types: list[str] | None = None,
    ) -> list[dict[str, Any]]: ...
