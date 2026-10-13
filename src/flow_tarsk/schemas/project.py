from pydantic import BaseModel, ConfigDict, Field

from flow_tarsk.schemas.common import HEX_COLOR, PatchModel, UTCDatetime


class ProjectCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=50)
    color: str = Field("#808080", pattern=HEX_COLOR)
    sort_order: int = Field(0, ge=-2147483648, le=2147483647)


class ProjectUpdate(PatchModel):
    non_nullable = ("name", "color", "is_archived", "sort_order")
    name: str | None = Field(None, min_length=1, max_length=50)
    color: str | None = Field(None, pattern=HEX_COLOR)
    is_archived: bool | None = None
    sort_order: int | None = Field(None, ge=-2147483648, le=2147483647)


class ProjectBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    color: str


class ProjectOut(BaseModel):
    id: int
    name: str
    color: str
    is_archived: bool
    sort_order: int
    open_count: int
    total_count: int
    created_at: UTCDatetime
    updated_at: UTCDatetime
