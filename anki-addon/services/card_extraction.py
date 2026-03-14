"""Card extraction — thin wrapper around shared _services.card_extraction."""

from anki_defs._services.card_extraction import (  # noqa: F401
    apply_spelling_correction,
    build_card_previews,
    validate_card_responses,
)
