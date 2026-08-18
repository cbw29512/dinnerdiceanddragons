"""Persisted, paginated, role-safe Game Hub message reads and writes."""

import logging
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.event import EventStatus
from app.models.message import Message, MessageModerationStatus
from app.models.user import User
from app.schemas.game_hub import HubMessagePageResponse, HubMessageResponse, MessageCreateRequest
from app.services.event_access import EventNotFoundError
from app.services.game_hub_access import HubAccessContext, require_hub_access
from app.services.game_hub_message_policy import (
    HubMessageConflictError,
    HubMessageForbiddenError,
    readable_message_filter,
    route_message,
)
from app.services.message_cursor import decode_message_cursor, encode_message_cursor

LOGGER = logging.getLogger(__name__)
READ_ONLY_EVENT_STATUSES = {
    EventStatus.CANCELLED.value,
    EventStatus.COMPLETED.value,
}


class HubMessagePersistenceError(RuntimeError):
    pass


def list_hub_messages(
    session: Session,
    user: User,
    event_id: UUID,
    *,
    limit: int,
    cursor: str | None,
) -> HubMessagePageResponse:
    """Return one bounded page containing only channels visible to the caller."""

    try:
        context = require_hub_access(session, user, event_id)
        query = (
            select(Message, User)
            .join(User, User.id == Message.sender_user_id)
            .where(
                Message.event_id == event_id,
                Message.moderation_status == MessageModerationStatus.VISIBLE.value,
                readable_message_filter(context, user.id),
            )
        )
        if cursor is not None:
            created_at, message_id = decode_message_cursor(cursor)
            query = query.where(
                or_(
                    Message.created_at < created_at,
                    and_(Message.created_at == created_at, Message.id < message_id),
                )
            )
        rows = session.execute(
            query.order_by(Message.created_at.desc(), Message.id.desc()).limit(limit + 1)
        ).all()
        has_more = len(rows) > limit
        rows = rows[:limit]
        items = [_render_message(context, user.id, message, sender) for message, sender in rows]
        next_cursor = None
        if has_more and rows:
            last_message = rows[-1][0]
            next_cursor = encode_message_cursor(last_message.created_at, last_message.id)
        return HubMessagePageResponse(items=items, next_cursor=next_cursor)
    except (EventNotFoundError, HubMessageConflictError, HubMessageForbiddenError):
        raise
    except SQLAlchemyError as exc:
        LOGGER.exception("Game Hub message read failed for Event %s", event_id)
        raise HubMessagePersistenceError("Messages could not be loaded.") from exc


def create_hub_message(
    session: Session,
    user: User,
    event_id: UUID,
    payload: MessageCreateRequest,
) -> HubMessageResponse:
    """Persist one message after deriving all routing from trusted Event state."""

    try:
        context = require_hub_access(session, user, event_id)
        if context.event.status in READ_ONLY_EVENT_STATUSES:
            raise HubMessageConflictError("Cancelled and completed Events are read-only.")
        routing = route_message(session, context=context, payload=payload)
        message = Message(
            event_id=event_id,
            sender_user_id=user.id,
            channel_type=payload.channel_type,
            recipient_user_id=routing.recipient_user_id,
            venue_id=routing.venue_id,
            category=routing.category,
            body=payload.body,
        )
        session.add(message)
        session.flush()
        response = _render_message(context, user.id, message, user)
        session.commit()
        return response
    except (EventNotFoundError, HubMessageConflictError, HubMessageForbiddenError):
        session.rollback()
        raise
    except SQLAlchemyError as exc:
        session.rollback()
        LOGGER.exception("Game Hub message persistence failed for Event %s", event_id)
        raise HubMessagePersistenceError("Message could not be persisted.") from exc


def _render_message(
    context: HubAccessContext,
    viewer_user_id: UUID,
    message: Message,
    sender: User,
) -> HubMessageResponse:
    role = _sender_role(context, message.sender_user_id)
    fallback = {
        "gm": "Dungeon Master",
        "venue": "Venue",
        "player": "Player",
        "member": "Table member",
    }[role]
    can_reply_to_player = bool(
        set(context.viewer_roles) & {"gm", "venue_manager"}
        and message.sender_user_id in context.confirmed_player_registration_by_user
    )
    reply_registration_id = (
        context.confirmed_player_registration_by_user.get(message.sender_user_id)
        if can_reply_to_player
        else None
    )
    return HubMessageResponse(
        id=message.id,
        channel_type=message.channel_type,
        category=message.category,
        body=message.body,
        created_at=message.created_at,
        sender_display_name=sender.display_name or fallback,
        sender_role=role,
        mine=message.sender_user_id == viewer_user_id,
        reply_registration_id=reply_registration_id,
    )


def _sender_role(context: HubAccessContext, sender_user_id: UUID) -> str:
    if sender_user_id == context.gm_user_id:
        return "gm"
    if sender_user_id in context.venue_manager_user_ids:
        return "venue"
    if sender_user_id in context.confirmed_player_user_ids:
        return "player"
    return "member"


__all__ = [
    "HubMessagePersistenceError",
    "READ_ONLY_EVENT_STATUSES",
    "create_hub_message",
    "list_hub_messages",
]
