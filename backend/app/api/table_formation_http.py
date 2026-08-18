"""FastAPI translation for controlled table-formation domain errors."""

from typing import NoReturn

from fastapi import HTTPException, status

from app.services.table_formation_errors import (
    TableFormationConflictError,
    TableFormationForbiddenError,
    TableFormationNotFoundError,
    TableFormationReadError,
)


def raise_table_formation_http(exc: Exception) -> NoReturn:
    """Map one controlled domain error without leaking private resource existence."""

    if isinstance(exc, TableFormationNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found.",
        ) from exc
    if isinstance(exc, TableFormationForbiddenError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    if isinstance(exc, TableFormationConflictError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    if isinstance(exc, TableFormationReadError):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Formation state could not be loaded.",
        ) from exc
    raise exc


__all__ = ["raise_table_formation_http"]
