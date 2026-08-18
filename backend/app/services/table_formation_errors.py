"""Domain errors for production table-formation lifecycle operations."""


class TableFormationError(RuntimeError):
    """Base error for a controlled table-formation failure."""


class TableFormationNotFoundError(TableFormationError):
    """The requested private formation resource is unavailable to the caller."""


class TableFormationForbiddenError(TableFormationError):
    """The authenticated caller lacks the required durable role or ownership."""


class TableFormationConflictError(TableFormationError):
    """The requested transition conflicts with current durable state."""


class TableFormationReadError(TableFormationError):
    """Persisted formation state is incomplete or could not be rendered safely."""


__all__ = [
    "TableFormationConflictError",
    "TableFormationError",
    "TableFormationForbiddenError",
    "TableFormationNotFoundError",
    "TableFormationReadError",
]
