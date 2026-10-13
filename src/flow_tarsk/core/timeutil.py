"""Pure timezone helpers for smart-view boundaries."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta, tzinfo


@dataclass(frozen=True)
class ViewBounds:
    """All values are timezone-aware UTC datetimes."""

    now: datetime
    today_end: datetime  # local tomorrow 00:00
    upcoming_end: datetime  # local tomorrow + 7 days 00:00
    local_today: date


def local_midnight_utc(day: date, tz: tzinfo) -> datetime:
    """Return the UTC instant of 00:00 local time on ``day``."""
    return datetime.combine(day, time.min, tzinfo=tz).astimezone(UTC)


def local_date(moment: datetime, tz: tzinfo) -> date:
    return moment.astimezone(tz).date()


def view_bounds(now: datetime, tz: tzinfo) -> ViewBounds:
    """Compute smart-view boundaries for ``now`` in timezone ``tz``."""
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)
    now = now.astimezone(UTC)
    today = local_date(now, tz)
    tomorrow = today + timedelta(days=1)
    return ViewBounds(
        now=now,
        today_end=local_midnight_utc(tomorrow, tz),
        upcoming_end=local_midnight_utc(tomorrow + timedelta(days=7), tz),
        local_today=today,
    )
