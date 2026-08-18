"""Domain errors for production table formation workflows."""


class FormationNotFoundError(LookupError):
    pass


class FormationForbiddenError(PermissionError):
    pass


class FormationConflictError(RuntimeError):
    pass


class FormationPersistenceError(RuntimeError):
    pass


__all__ = [
    "FormationConflictError",
    "FormationForbiddenError",
    "FormationNotFoundError",
    "FormationPersistenceError",
]
