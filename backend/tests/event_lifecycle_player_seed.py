"""Player records used by Event lifecycle test fixtures."""

from sqlalchemy.orm import Session

from app.models.game_system import GameSystem
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType


def seed_lifecycle_players(
    session: Session,
    system: GameSystem,
    match: TableMatch,
    player_count: int,
) -> tuple[list[User], list[PlayerProfile], list[PlayerDemandSignal]]:
    """Persist deterministic active Players that are eligible for one match."""

    try:
        player_users: list[User] = []
        player_profiles: list[PlayerProfile] = []
        player_demands: list[PlayerDemandSignal] = []
        for index in range(player_count):
            user = User(
                auth_provider_user_id=f"lifecycle-player-{index}",
                email=f"lifecycle-player-{index}@example.test",
                status=AccountStatus.ACTIVE.value,
            )
            session.add(user)
            session.flush()
            session.add(UserRole(user_id=user.id, role=UserRoleType.PLAYER.value))
            profile = PlayerProfile(
                user_id=user.id,
                postal_code="29501",
                travel_radius_miles=25,
            )
            session.add(profile)
            session.flush()
            demand = PlayerDemandSignal(
                player_profile_id=profile.id,
                game_system_id=system.id,
                preferred_format="one_shot",
            )
            session.add(demand)
            session.flush()
            session.add(
                TableMatchPlayer(
                    table_match_id=match.id,
                    player_demand_signal_id=demand.id,
                    distance_miles=5,
                )
            )
            player_users.append(user)
            player_profiles.append(profile)
            player_demands.append(demand)
        return player_users, player_profiles, player_demands
    except Exception:
        raise


__all__ = ["seed_lifecycle_players"]
