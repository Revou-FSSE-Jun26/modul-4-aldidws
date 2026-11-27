"""Time formatting helpers."""

from datetime import datetime, timezone


def format_utc(value: datetime | None) -> str | None:
    """Return *value* as ``YYYY-MM-DDTHH:MM:SSZ`` in UTC, or ``None``.

    Second precision only. A naive datetime is treated as already being UTC.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
