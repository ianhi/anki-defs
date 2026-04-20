"""Prompts route — preview rendered prompts without calling the LLM."""

from __future__ import annotations

import os
from typing import Any

from bottle import request, response

from .. import ai
from ..settings import get_settings


def register(app: Any) -> None:
    @app.post("/api/prompts/preview")
    def preview() -> dict:
        if os.environ.get("ANKI_DEFS_DEV"):
            ai.reload_prompts()

        body = request.json or {}
        new_message: str = body.get("newMessage", "")
        highlighted_words: list[str] | None = body.get("highlightedWords")
        request_mode: str | None = body.get("mode")

        if not new_message:
            response.status = 400
            return {"error": "newMessage is required"}

        settings = get_settings()
        prompts = ai.get_system_prompts(
            settings.get("showTransliteration", False)
        )

        selection = ai.select_prompt(
            prompts,
            new_message,
            highlighted_words=highlighted_words,
            mode=request_mode,
        )

        return {
            "mode": selection.mode,
            "systemPrompt": selection.system_prompt,
            "userMessage": selection.user_message,
        }
