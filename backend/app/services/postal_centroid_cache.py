"""Short-transaction cache for privacy-preserving ZIP centroids."""

import logging
from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.db.session import get_session_factory
from app.models.postal_code_centroid import PostalCodeCentroid
from app.services.geocoding import GeocodingError
from app.services.postal_centroids import (
    PostalCentroidResolver,
    PostalCentroidResult,
    normalize_us_postal_code,
    require_valid_postal_centroid,
)

LOGGER = logging.getLogger(__name__)
SessionFactory = Callable[[], Session]


class PostalCentroidCache:
    """Resolve a ZIP once, then reuse its public centroid from PostgreSQL."""

    def __init__(
        self,
        resolver: PostalCentroidResolver,
        *,
        session_factory: SessionFactory | sessionmaker[Session] | None = None,
    ) -> None:
        self._resolver = resolver
        self._session_factory = session_factory or get_session_factory()

    def resolve(self, postal_code: str) -> PostalCentroidResult:
        """Return a cached centroid, resolving outside any DB transaction on miss."""

        normalized = normalize_us_postal_code(postal_code)
        cached = self._load(normalized)
        if cached is not None:
            return cached

        try:
            resolved = require_valid_postal_centroid(
                self._resolver.resolve(normalized),
                expected_postal_code=normalized,
            )
        except (GeocodingError, ValueError):
            LOGGER.exception("Postal centroid provider resolution failed")
            raise

        return self._store_or_load_race(resolved)

    def _load(self, postal_code: str) -> PostalCentroidResult | None:
        with self._session_factory() as session:
            record = session.scalar(
                select(PostalCodeCentroid).where(
                    PostalCodeCentroid.country_code == "US",
                    PostalCodeCentroid.postal_code == postal_code,
                )
            )
            return _result_from_record(record) if record is not None else None

    def _store_or_load_race(self, result: PostalCentroidResult) -> PostalCentroidResult:
        with self._session_factory() as session:
            existing = session.scalar(
                select(PostalCodeCentroid).where(
                    PostalCodeCentroid.country_code == "US",
                    PostalCodeCentroid.postal_code == result.postal_code,
                )
            )
            if existing is not None:
                return _result_from_record(existing)

            record = PostalCodeCentroid(
                country_code="US",
                postal_code=result.postal_code,
                latitude=result.latitude,
                longitude=result.longitude,
                provider=result.provider,
                accuracy=result.accuracy,
                accuracy_type=result.accuracy_type,
            )
            session.add(record)
            try:
                session.commit()
            except IntegrityError:
                session.rollback()
                raced = session.scalar(
                    select(PostalCodeCentroid).where(
                        PostalCodeCentroid.country_code == "US",
                        PostalCodeCentroid.postal_code == result.postal_code,
                    )
                )
                if raced is None:
                    LOGGER.exception("Postal centroid cache insert failed")
                    raise
                return _result_from_record(raced)
            except Exception:
                session.rollback()
                LOGGER.exception("Postal centroid cache write failed")
                raise

            return _result_from_record(record)


def _result_from_record(record: PostalCodeCentroid) -> PostalCentroidResult:
    return PostalCentroidResult(
        postal_code=record.postal_code,
        latitude=float(record.latitude),
        longitude=float(record.longitude),
        accuracy=float(record.accuracy),
        accuracy_type=record.accuracy_type,
        provider=record.provider,
    )


__all__ = ["PostalCentroidCache"]
