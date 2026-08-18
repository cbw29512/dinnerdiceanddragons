"""Channel visibility and server-derived Game Hub message routing."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.models.message import Message, MessageChannel
from app.schemas.game_hub import MessageCreateRequest
from app.services.game_hub_access import (
    HubAccessContext,
    resolve_confirmed_registration_user,
)


class HubMessageConflictError(RuntimeError):
    pass


class HubMessageForbiddenError(PermissionError):
    pass


@dataclass(frozen=True, slots=True)
class MessageRouting:
    recipient_user_id: UUID | None
    venue_id: UUID | None
    category: str | None


def readable_message_filter(
    context: HubAccessContext,
    user_id: UUID,
) -> ColumnElement[bool]:
    """Return the union of message channels visible to the caller's Hub roles."""

    predicates: list[ColumnElement[bool]] = [
        Message.channel_type == MessageChannel.SYSTEM_NOTIFICATION.value,
    ]
    roles = set(context.viewer_roles)
    if roles & {"gm", "player", "venue_manager"}:
        predicates.append(Message.channel_type == MessageChannel.TABLE_ANNOUNCEMENT.value)
    if roles & {"gm", "player"}:
        predicates.append(Message.channel_type == MessageChannel.TABLE_DISCUSSION.value)
    if roles & {"gm", "venue_manager"}:
        predicates.append(Message.channel_type == MessageChannel.GM_VENUE.value)
    if "gm" in roles:
        predicates.append(Message.channel_type == MessageChannel.PLAYER_GM.value)
    elif "player" in roles:
        predicates.append(
            and_(
                Message.channel_type == MessageChannel.PLAYER_GM.value,
                or_(Message.sender_user_id == user_id, Message.recipient_user_id == user_id),
            )
        )
    if "venue_manager" in roles:
        predicates.append(Message.channel_type == MessageChannel.PLAYER_VENUE_QUESTION.value)
    elif "player" in roles:
        predicates.append(
            and_(
                Message.channel_type == MessageChannel.PLAYER_VENUE_QUESTION.value,
                or_(Message.sender_user_id == user_id, Message.recipient_user_id == user_id),
            )
        )
    return or_(*predicates)


def route_message(
    session: Session,
    *,
    context: HubAccessContext,
    payload: MessageCreateRequest,
) -> MessageRouting:
    """Authorize one channel and derive all internal routing identifiers."""

    channel = payload.channel_type
    roles = set(context.viewer_roles)
    if channel == MessageChannel.TABLE_ANNOUNCEMENT.value:
        _require_role(roles, {"gm", "venue_manager"})
        _reject_extra_routing(payload)
        return MessageRouting(None, None, None)
    if channel == MessageChannel.TABLE_DISCUSSION.value:
        _require_role(roles, {"gm", "player"})
        _reject_extra_routing(payload)
        return MessageRouting(None, None, None)
    if channel == MessageChannel.GM_VENUE.value:
        _require_role(roles, {"gm", "venue_manager"})
        _reject_category(payload)
        if payload.registration_id is not None:
            raise HubMessageConflictError("GM/Venue messages do not target a Player.")
        return MessageRouting(None, context.event.venue_id, None)
    if channel == MessageChannel.PLAYER_GM.value:
        _reject_category(payload)
        if "gm" in roles and payload.registration_id is not None:
            recipient = resolve_confirmed_registration_user(
                session,
                event_id=context.event.id,
                registration_id=payload.registration_id,
            )
            return MessageRouting(recipient, None, None)
        if "player" in roles and payload.registration_id is None:
            return MessageRouting(context.gm_user_id, None, None)
        if not roles & {"gm", "player"}:
            raise HubMessageForbiddenError("This Hub role cannot use Player/GM messages.")
        raise HubMessageConflictError(
            "Player/GM routing requires a confirmed Player or a target registration."
        )
    if channel == MessageChannel.PLAYER_VENUE_QUESTION.value:
        if payload.category is None:
            raise HubMessageConflictError("Venue questions require a category.")
        if "venue_manager" in roles and payload.registration_id is not None:
            recipient = resolve_confirmed_registration_user(
                session,
                event_id=context.event.id,
                registration_id=payload.registration_id,
            )
            return MessageRouting(recipient, context.event.venue_id, payload.category)
        if "player" in roles and payload.registration_id is None:
            return MessageRouting(None, context.event.venue_id, payload.category)
        if not roles & {"venue_manager", "player"}:
            raise HubMessageForbiddenError("This Hub role cannot use Venue questions.")
        raise HubMessageConflictError(
            "Venue-question routing requires a confirmed Player or target registration."
        )
    raise HubMessageForbiddenError("This message channel cannot be posted by this Hub role.")


def _require_role(actual: set[str], allowed: set[str]) -> None:
    if not actual & allowed:
        raise HubMessageForbiddenError("This Hub role cannot post to that channel.")


def _reject_category(payload: MessageCreateRequest) -> None:
    if payload.category is not None:
        raise HubMessageConflictError("This channel does not accept a Venue category.")


def _reject_extra_routing(payload: MessageCreateRequest) -> None:
    _reject_category(payload)
    if payload.registration_id is not None:
        raise HubMessageConflictError("This channel does not target one registration.")


__all__ = [
    "HubMessageConflictError",
    "HubMessageForbiddenError",
    "MessageRouting",
    "readable_message_filter",
    "route_message",
]
