"""Provider interface for AI completions."""

from __future__ import annotations

from typing import Any, Callable, Protocol


class StreamCallbacks(Protocol):
    on_text: Callable[[str], None]
    on_usage: Callable[[dict[str, Any]], None]
    on_done: Callable[[], None]
    on_error: Callable[[str], None]
