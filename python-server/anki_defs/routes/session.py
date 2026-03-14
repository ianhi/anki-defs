"""Session routes — CRUD for cards, pending, usage, history."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..services import session as session_service

router = APIRouter(prefix="/api/session")


@router.get("")
async def get_session() -> JSONResponse:
    try:
        state = await asyncio.to_thread(session_service.get_state)
        return JSONResponse(state)
    except Exception as e:
        print(f"[Session] Error getting state: {e}")
        return JSONResponse({"error": "Failed to get session state"}, status_code=500)


@router.post("/cards")
async def add_card(request: Request) -> JSONResponse:
    card = await request.json()
    if not card.get("id") or not card.get("word"):
        return JSONResponse({"error": "id and word are required"}, status_code=400)
    try:
        await asyncio.to_thread(session_service.add_card, card)
        return JSONResponse({"success": True})
    except Exception as e:
        print(f"[Session] Error adding card: {e}")
        return JSONResponse({"error": "Failed to add card"}, status_code=500)


@router.delete("/cards/{card_id}")
async def remove_card(card_id: str) -> JSONResponse:
    try:
        removed = await asyncio.to_thread(session_service.remove_card, card_id)
        return JSONResponse({"success": removed})
    except Exception as e:
        print(f"[Session] Error removing card: {e}")
        return JSONResponse({"error": "Failed to remove card"}, status_code=500)


@router.post("/pending")
async def add_pending(request: Request) -> JSONResponse:
    card = await request.json()
    if not card.get("id") or not card.get("word"):
        return JSONResponse({"error": "id and word are required"}, status_code=400)
    try:
        await asyncio.to_thread(session_service.add_pending, card)
        return JSONResponse({"success": True})
    except Exception as e:
        print(f"[Session] Error adding pending card: {e}")
        return JSONResponse({"error": "Failed to add pending card"}, status_code=500)


@router.delete("/pending/{card_id}")
async def remove_pending(card_id: str) -> JSONResponse:
    try:
        removed = await asyncio.to_thread(session_service.remove_pending, card_id)
        return JSONResponse({"success": removed})
    except Exception as e:
        print(f"[Session] Error removing pending card: {e}")
        return JSONResponse({"error": "Failed to remove pending card"}, status_code=500)


@router.post("/pending/{pending_id}/promote")
async def promote_pending(pending_id: str, request: Request) -> JSONResponse:
    body = await request.json()
    note_id = body.get("noteId")
    if not note_id:
        return JSONResponse({"error": "noteId is required"}, status_code=400)
    try:
        card = await asyncio.to_thread(session_service.promote_pending, pending_id, note_id)
        if card is None:
            return JSONResponse({"error": "Pending card not found"}, status_code=404)
        return JSONResponse({"success": True, "card": card})
    except Exception as e:
        print(f"[Session] Error promoting pending card: {e}")
        return JSONResponse({"error": "Failed to promote pending card"}, status_code=500)


@router.post("/clear")
async def clear_session() -> JSONResponse:
    try:
        await asyncio.to_thread(session_service.clear_all)
        return JSONResponse({"success": True})
    except Exception as e:
        print(f"[Session] Error clearing session: {e}")
        return JSONResponse({"error": "Failed to clear session"}, status_code=500)


@router.get("/usage")
async def get_usage() -> JSONResponse:
    try:
        totals = await asyncio.to_thread(session_service.get_usage_totals)
        return JSONResponse(totals)
    except Exception as e:
        print(f"[Session] Error getting usage: {e}")
        return JSONResponse({"error": "Failed to get usage"}, status_code=500)


@router.post("/usage/reset")
async def reset_usage() -> JSONResponse:
    try:
        await asyncio.to_thread(session_service.clear_usage)
        return JSONResponse({"success": True})
    except Exception as e:
        print(f"[Session] Error resetting usage: {e}")
        return JSONResponse({"error": "Failed to reset usage"}, status_code=500)


@router.get("/history")
async def search_history(q: str | None = None, limit: int = 50, offset: int = 0) -> JSONResponse:
    try:
        limit = min(max(limit, 1), 200)
        offset = max(offset, 0)
        result = await asyncio.to_thread(session_service.search_history, q, limit, offset)
        return JSONResponse(result)
    except Exception as e:
        print(f"[Session] Error searching history: {e}")
        return JSONResponse({"error": "Failed to search history"}, status_code=500)
