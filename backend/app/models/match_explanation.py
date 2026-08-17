"""Human-readable criteria explaining persisted Table Match decisions."""

from decimal import Decimal
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MatchCriterionResult(StrEnum):
    """Outcome of one explainable match criterion."""

    PASS = "pass"
    FAIL = "fail"
    INFO = "info"


class MatchExplanation(Base):
    """One auditable criterion attached to a persisted Table Match."""

    __tablename__ = "match_explanations"
    __table_args__ = (
        CheckConstraint(
            "result IN ('pass', 'fail', 'info')",
            name="ck_match_explanations_result",
        ),
        CheckConstraint(
            "length(trim(criterion)) >= 1",
            name="ck_match_explanations_criterion_nonblank",
        ),
        CheckConstraint(
            "length(trim(summary)) >= 1",
            name="ck_match_explanations_summary_nonblank",
        ),
        UniqueConstraint(
            "table_match_id",
            "criterion",
            name="uq_match_explanations_match_criterion",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    table_match_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("table_matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    criterion: Mapped[str] = mapped_column(String(32), nullable=False)
    result: Mapped[str] = mapped_column(String(16), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    weight: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
