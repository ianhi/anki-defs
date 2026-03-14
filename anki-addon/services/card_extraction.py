"""Card extraction — thin wrapper around shared _services.card_extraction."""

try:
    from .._services.card_extraction import (  # noqa: F401
        apply_spelling_correction,
        build_card_previews,
        validate_card_responses,
    )
except ImportError:
    from _services.card_extraction import (  # type: ignore[no-redef]  # noqa: F401
        apply_spelling_correction,
        build_card_previews,
        validate_card_responses,
    )
