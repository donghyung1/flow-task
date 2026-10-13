"""RRULE subset parsing and next-occurrence computation (pure functions)."""

import calendar
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta, tzinfo

from flow_tarsk.core.timeutil import local_date

_DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
_FREQS = {"DAILY", "WEEKLY", "MONTHLY"}
_ALLOWED = {"FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "UNTIL"}


class InvalidRecurrenceError(ValueError):
    pass


@dataclass(frozen=True)
class Rule:
    freq: str
    interval: int = 1
    byday: list[int] = field(default_factory=list)  # weekday indexes, Mon=0
    bymonthday: int | None = None
    until: datetime | None = None


def parse_rule(text: str) -> Rule:
    parts: dict[str, str] = {}
    for chunk in text.strip().split(";"):
        key, sep, value = chunk.partition("=")
        key = key.strip().upper()
        if not sep or not value.strip() or key not in _ALLOWED or key in parts:
            raise InvalidRecurrenceError(f"invalid recurrence rule: {text!r}")
        parts[key] = value.strip().upper()
    freq = parts.get("FREQ")
    if freq not in _FREQS:
        raise InvalidRecurrenceError("FREQ must be DAILY, WEEKLY or MONTHLY")
    try:
        interval = int(parts.get("INTERVAL", "1"))
    except ValueError as exc:
        raise InvalidRecurrenceError("INTERVAL must be an integer") from exc
    if not 1 <= interval <= 999:
        raise InvalidRecurrenceError("INTERVAL out of range")
    byday: list[int] = []
    if "BYDAY" in parts:
        if freq != "WEEKLY":
            raise InvalidRecurrenceError("BYDAY is only valid with FREQ=WEEKLY")
        for token in parts["BYDAY"].split(","):
            if token not in _DAYS:
                raise InvalidRecurrenceError(f"invalid BYDAY value: {token}")
            byday.append(_DAYS.index(token))
        byday = sorted(set(byday))
    bymonthday: int | None = None
    if "BYMONTHDAY" in parts:
        if freq != "MONTHLY":
            raise InvalidRecurrenceError("BYMONTHDAY is only valid with FREQ=MONTHLY")
        try:
            bymonthday = int(parts["BYMONTHDAY"])
        except ValueError as exc:
            raise InvalidRecurrenceError("BYMONTHDAY must be an integer") from exc
        if not 1 <= bymonthday <= 31:
            raise InvalidRecurrenceError("BYMONTHDAY must be 1..31")
    until: datetime | None = None
    if "UNTIL" in parts:
        raw = parts["UNTIL"]
        try:
            if len(raw) == 8:
                until = datetime.strptime(raw, "%Y%m%d").replace(
                    hour=23, minute=59, second=59, tzinfo=UTC
                )
            else:
                until = datetime.strptime(raw.rstrip("Z"), "%Y%m%dT%H%M%S").replace(tzinfo=UTC)
        except ValueError as exc:
            raise InvalidRecurrenceError("invalid UNTIL") from exc
    return Rule(freq, interval, byday, bymonthday, until)


def _add_months(year: int, month: int, n: int) -> tuple[int, int]:
    idx = year * 12 + (month - 1) + n
    return idx // 12, idx % 12 + 1


def _next_date(rule: Rule, base: date) -> date:
    if rule.freq == "DAILY":
        return base + timedelta(days=rule.interval)
    if rule.freq == "WEEKLY":
        days = rule.byday or [base.weekday()]
        for d in days:
            if d > base.weekday():
                return base + timedelta(days=d - base.weekday())
        week_start = base - timedelta(days=base.weekday())
        return week_start + timedelta(weeks=rule.interval, days=days[0])
    target = rule.bymonthday or base.day
    year, month = base.year, base.month
    if target <= base.day and rule.bymonthday is not None or rule.bymonthday is None:
        year, month = _add_months(year, month, rule.interval)
    last = calendar.monthrange(year, month)[1]
    return date(year, month, min(target, last))


def next_occurrence(rule_text: str, base: datetime, tz: tzinfo) -> datetime | None:
    """Next occurrence after ``base`` (UTC-aware), keeping local time of day.

    Returns None if the next occurrence is past UNTIL.
    """
    rule = parse_rule(rule_text)
    if base.tzinfo is None:
        base = base.replace(tzinfo=UTC)
    local = base.astimezone(tz)
    nxt_date = _next_date(rule, local_date(base, tz))
    nxt = datetime.combine(
        nxt_date, time(local.hour, local.minute, local.second, local.microsecond), tzinfo=tz
    )
    nxt_utc = nxt.astimezone(UTC)
    if rule.until is not None and nxt_utc > rule.until:
        return None
    return nxt_utc
