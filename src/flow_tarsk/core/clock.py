"""Clock indirection so tests can freeze time."""

from datetime import UTC, datetime


def utcnow() -> datetime:
    return datetime.now(UTC)
