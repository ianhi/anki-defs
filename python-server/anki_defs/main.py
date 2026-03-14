"""FastAPI application — main entry point for the Python server."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import CLIENT_DIST, load_dotenv
from .middleware.auth import AuthMiddleware
from .routes import anki, chat, prompts, session, settings
from .services.settings import get_settings, save_settings

# Load .env files before anything else
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Generate API token on first startup."""
    current = get_settings()
    if not current.get("apiToken"):
        token = str(uuid.uuid4())
        save_settings({"apiToken": token})
        print(f"[Server] Generated API token: {token}")
    else:
        print(f"[Server] API token: {current['apiToken']}")
    yield


app = FastAPI(lifespan=lifespan)

# CORS — same origins as Express
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3001",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth middleware
app.add_middleware(AuthMiddleware)

# Mount route modules
app.include_router(anki.router)
app.include_router(chat.router)
app.include_router(prompts.router)
app.include_router(session.router)
app.include_router(settings.router)


@app.get("/api/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.get("/api/platform")
async def platform() -> JSONResponse:
    return JSONResponse({"platform": "web"})


# Static file serving (production) — mount LAST, only if client is built
# Use StaticFiles with html=True for SPA fallback
if CLIENT_DIST.exists() and (CLIENT_DIST / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(CLIENT_DIST), html=True), name="static")
