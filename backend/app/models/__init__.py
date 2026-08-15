"""Production ORM models.

Import every ORM model here so Alembic can load all registered table metadata
from one place.
"""

from app.db.base import Base
from app.models.user import AccountStatus, User

metadata = Base.metadata

__all__ = ["AccountStatus", "User", "metadata"]
