from datetime import UTC, datetime
from typing import Annotated, ClassVar, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, PlainSerializer, model_validator

HEX_COLOR = r"^#[0-9A-Fa-f]{6}$"


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _fmt(value: datetime) -> str:
    value = _to_utc(value)
    spec = "microseconds" if value.microsecond else "seconds"
    return value.isoformat(timespec=spec).replace("+00:00", "Z")


UTCDatetime = Annotated[
    datetime, AfterValidator(_to_utc), PlainSerializer(_fmt, return_type=str, when_used="always")
]

T = TypeVar("T")


class Page(BaseModel, Generic[T]):  # noqa: UP046
    items: list[T]
    page: int
    size: int
    total: int


class PatchModel(BaseModel):
    """Base for PATCH bodies: explicit null is rejected for non-nullable fields."""

    model_config = ConfigDict(str_strip_whitespace=True)
    non_nullable: ClassVar[tuple[str, ...]] = ()

    @model_validator(mode="after")
    def _check_nulls(self) -> PatchModel:
        for name in self.non_nullable:
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} must not be null")
        return self


__all__ = ["HEX_COLOR", "Field", "Page", "PatchModel", "UTCDatetime"]
