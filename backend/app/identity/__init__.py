"""Identity-domain rules shared by authentication and profile workflows."""

from app.identity.display_names import (
    DisplayName,
    DisplayNameValidationError,
    prepare_display_name,
)

__all__ = ["DisplayName", "DisplayNameValidationError", "prepare_display_name"]
