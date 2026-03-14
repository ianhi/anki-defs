"""Prompts route — preview rendered prompts without calling the LLM."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..services import ai
from ..services.settings import get_settings

router = APIRouter(prefix="/api/prompts")


@router.post("/preview")
async def preview(request: Request) -> JSONResponse:
    # In dev mode, reload from disk so edits are picked up without restart
    ai.reload_prompts()

    body = await request.json()
    new_message: str = body.get("newMessage", "")
    highlighted_words: list[str] | None = body.get("highlightedWords")
    request_mode: str | None = body.get("mode")

    if not new_message:
        return JSONResponse({"error": "newMessage is required"}, status_code=400)

    settings = get_settings()
    prompts = ai.get_system_prompts(settings.get("showTransliteration", False))

    selection = ai.select_prompt(
        prompts,
        new_message,
        highlighted_words=highlighted_words,
        mode=request_mode,
    )

    return JSONResponse({
        "mode": selection.mode,
        "systemPrompt": selection.system_prompt,
        "userMessage": selection.user_message,
    })
