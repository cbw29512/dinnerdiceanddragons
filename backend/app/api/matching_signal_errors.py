"""Stable HTTP translation for Table Match input service errors."""

from typing import NoReturn

from fastapi import HTTPException, status

from app.services.matching_signal_common import (
    MatchingSignalConflictError,
    MatchingSignalPersistenceError,
    MatchingSignalValidationError,
)


def raise_matching_signal_http(exc: Exception) -> NoReturn:
    """Translate known matching-signal failures and preserve unknown exceptions."""

    try:
        if isinstance(exc, MatchingSignalValidationError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc
        if isinstance(exc, MatchingSignalConflictError):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        if isinstance(exc, MatchingSignalPersistenceError):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Matching input could not be processed.",
            ) from exc
        raise exc
    except HTTPException:
        raise


__all__ = ["raise_matching_signal_http"]
