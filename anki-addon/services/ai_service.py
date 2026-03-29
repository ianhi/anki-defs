"""AI provider abstraction — thin wrapper around shared _services.ai.

All prompt loading, selection, rendering, and provider dispatch is handled
by the shared service layer (copied from python-server at build time).
"""

from anki_defs._services.ai import (  # noqa: F401
    get_completion,
    get_distractor_prompt,
    get_json_completion,
    get_relemmatize_prompt,
    get_system_prompts,
    get_text_completion,
    parse_json_response,
    reload_prompts,
    render_user_template,
    reset_clients,
    select_prompt,
    stream_completion,
)
