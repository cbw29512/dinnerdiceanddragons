"""Tests for public display-name normalization and reserved-name policy."""

import pytest

from app.identity.display_names import DisplayNameValidationError, prepare_display_name


def test_display_name_preserves_presentation_and_collapses_whitespace() -> None:
    result = prepare_display_name("  Chris\t  Wilson  ")

    assert result.display == "Chris Wilson"
    assert result.normalized == "chris wilson"


def test_display_name_uses_nfkc_and_casefold_for_comparison() -> None:
    full_width = prepare_display_name("Ｐｉｎｋｉｅ")
    ordinary = prepare_display_name("pinkie")

    assert full_width.display == "Pinkie"
    assert full_width.normalized == ordinary.normalized == "pinkie"


def test_casefold_handles_unicode_case_variants() -> None:
    first = prepare_display_name("Straße")
    second = prepare_display_name("STRASSE")

    assert first.normalized == second.normalized == "strasse"


@pytest.mark.parametrize(
    "proposed",
    [
        "admin",
        "A-D-M-I-N",
        "Ｍｏｄｅｒａｔｏｒ",
        "Dinner, Dice & Dragons",
        "dinner-dice-and-dragons",
        "DDD",
        "Support",
        "official",
    ],
)
def test_platform_impersonation_names_are_reserved(proposed: str) -> None:
    with pytest.raises(DisplayNameValidationError, match="reserved"):
        prepare_display_name(proposed)


def test_normal_rpg_character_names_are_not_reserved() -> None:
    result = prepare_display_name("Bogborn Moon Druid")

    assert result.display == "Bogborn Moon Druid"
    assert result.normalized == "bogborn moon druid"


def test_empty_display_name_is_rejected() -> None:
    with pytest.raises(DisplayNameValidationError, match="empty"):
        prepare_display_name(" \t\n ")


def test_display_name_over_80_characters_is_rejected() -> None:
    with pytest.raises(DisplayNameValidationError, match="80"):
        prepare_display_name("x" * 81)


def test_exactly_80_characters_is_allowed() -> None:
    result = prepare_display_name("x" * 80)

    assert len(result.display) == 80


def test_invisible_format_characters_are_rejected() -> None:
    with pytest.raises(DisplayNameValidationError, match="invisible"):
        prepare_display_name("Chris\u200bWilson")
