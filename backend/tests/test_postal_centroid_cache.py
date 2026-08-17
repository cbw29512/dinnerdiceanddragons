"""Persistence tests for the server-side ZIP-centroid cache."""

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.postal_code_centroid import PostalCodeCentroid
from app.services.postal_centroid_cache import PostalCentroidCache
from app.services.postal_centroids import PostalCentroidResult

POSTAL_CODE = "29501"


class FakeResolver:
    """Deterministic provider fake that records external-resolution calls."""

    def __init__(self) -> None:
        self.calls: list[str] = []

    def resolve(self, postal_code: str) -> PostalCentroidResult:
        self.calls.append(postal_code)
        return PostalCentroidResult(
            postal_code=postal_code,
            latitude=34.1954,
            longitude=-79.7626,
            accuracy=1.0,
            accuracy_type="place",
            provider="fake",
        )


def build_factory() -> tuple[sessionmaker[Session], object]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        poolclass=StaticPool,
    )
    PostalCodeCentroid.__table__.create(engine)
    return sessionmaker(bind=engine, class_=Session, expire_on_commit=False), engine


def test_cache_resolves_once_then_reuses_persisted_centroid() -> None:
    factory, engine = build_factory()
    resolver = FakeResolver()
    cache = PostalCentroidCache(resolver, session_factory=factory)

    first = cache.resolve(POSTAL_CODE)
    second = cache.resolve(POSTAL_CODE)

    assert first == second
    assert resolver.calls == [POSTAL_CODE]

    with factory() as session:
        record = session.scalar(select(PostalCodeCentroid))
        assert record is not None
        assert record.postal_code == POSTAL_CODE
        assert record.provider == "fake"

    engine.dispose()


def test_cache_normalizes_surrounding_whitespace_before_provider_call() -> None:
    factory, engine = build_factory()
    resolver = FakeResolver()
    cache = PostalCentroidCache(resolver, session_factory=factory)

    result = cache.resolve(f"  {POSTAL_CODE}  ")

    assert result.postal_code == POSTAL_CODE
    assert resolver.calls == [POSTAL_CODE]
    engine.dispose()
