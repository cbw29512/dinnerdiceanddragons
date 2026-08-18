"""Contract tests for non-food-centric Venue support metadata."""

from app.models.venue import VenueSupportOffering


def test_venue_support_is_not_food_only() -> None:
    try:
        assert VenueSupportOffering.CONSISTENT_SPACE.value == "consistent_space"
        assert VenueSupportOffering.LOYALTY_REWARDS.value == "loyalty_rewards"
        assert VenueSupportOffering.PRIZE_SUPPORT.value == "prize_support"
        assert VenueSupportOffering.TABLETOP_SUPPLIES.value == "tabletop_supplies"
        assert VenueSupportOffering.OTHER.value == "other"
    except Exception:
        raise
