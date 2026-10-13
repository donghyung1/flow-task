from pydantic import BaseModel, ConfigDict, Field

from flow_task.schemas.common import HEX_COLOR, PatchModel


class TagCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=30)
    color: str | None = Field(None, pattern=HEX_COLOR)


class TagUpdate(PatchModel):
    non_nullable = ("name",)
    name: str | None = Field(None, min_length=1, max_length=30)
    color: str | None = Field(None, pattern=HEX_COLOR)


class TagBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    color: str | None


class TagOut(TagBrief):
    task_count: int
