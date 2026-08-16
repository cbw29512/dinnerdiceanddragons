"""Canonical request payloads used by Venue onboarding tests."""


def venue_payload() -> dict:
    """Return one valid canonical Venue onboarding request."""

    try:
        return {
            "name": "Florence Game Night Cafe",
            "venue_type": "cafe",
            "address_line1": "123 Game Night Way",
            "address_line2": "Suite 2",
            "city": "Florence",
            "state_region": "sc",
            "postal_code": "29501",
            "website_url": "https://example.com",
            "phone": "843-555-0100",
            "amenities": ["Accessible entrance", "Parking", "Wi-Fi"],
            "accessibility_notes": "Step-free front entrance.",
            "parking_notes": "Shared lot beside the building.",
            "noise_notes": "Quieter rear seating area.",
            "lighting_notes": "Bright overhead lighting available.",
            "manager_role": "manager",
        }
    except Exception:
        raise
