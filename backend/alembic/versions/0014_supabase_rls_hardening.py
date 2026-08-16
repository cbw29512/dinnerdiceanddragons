"""lock down DDD tables exposed through Supabase PostgREST

Revision ID: 0014_supabase_rls_hardening
Revises: 0013_table_match_signals
Create Date: 2026-08-16
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0014_supabase_rls_hardening"
down_revision: str | Sequence[str] | None = "0013_table_match_signals"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


RLS_TABLES = (
    "alembic_version",
    "users",
    "user_roles",
    "privileged_audit_events",
    "player_profiles",
    "gm_profiles",
    "venues",
    "venue_managers",
    "game_systems",
    "player_system_experiences",
    "gm_system_experiences",
    "gm_system_formats",
    "recurring_availability_rules",
    "player_availability_windows",
    "gm_availability_windows",
    "player_demand_signals",
    "gm_supply_signals",
    "venue_table_windows",
)


def upgrade() -> None:
    """Deny direct PostgREST access while preserving server-side DB access."""

    for table_name in RLS_TABLES:
        op.execute(f'ALTER TABLE public."{table_name}" ENABLE ROW LEVEL SECURITY')

    # The trigger only raises an exception and requires no schema lookup. Pinning
    # search_path prevents a caller-controlled path from changing resolution.
    op.execute(
        "ALTER FUNCTION public.deny_privileged_audit_event_mutation() "
        "SET search_path = pg_catalog"
    )


def downgrade() -> None:
    """Restore the pre-Supabase-hardening database behavior."""

    op.execute(
        "ALTER FUNCTION public.deny_privileged_audit_event_mutation() "
        "RESET search_path"
    )
    for table_name in reversed(RLS_TABLES):
        op.execute(f'ALTER TABLE public."{table_name}" DISABLE ROW LEVEL SECURITY')
