"""Executable PostgreSQL contract for transaction-local application timeouts."""

from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import get_session_factory


def main() -> None:
    settings = get_settings()
    factory = get_session_factory()

    with factory() as session:
        row = session.execute(
            text(
                "SELECT "
                "extract(epoch FROM current_setting('statement_timeout')::interval) * 1000, "
                "extract(epoch FROM current_setting('lock_timeout')::interval) * 1000, "
                "extract(epoch FROM current_setting('idle_in_transaction_session_timeout')::interval) * 1000"
            )
        ).one()

        assert int(row[0]) == settings.db_statement_timeout_ms, row
        assert int(row[1]) == settings.db_lock_timeout_ms, row
        assert int(row[2]) == settings.db_idle_transaction_timeout_ms, row

    print("PostgreSQL transaction-local timeout contract passed.")


if __name__ == "__main__":
    main()
