from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from flow_task.models.task import Priority, TaskStatus
from flow_task.schemas.common import PatchModel, UTCDatetime
from flow_task.schemas.project import ProjectBrief
from flow_task.schemas.tag import TagBrief

TagName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]


class TaskCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(None, max_length=5000)
    priority: Priority = Priority.NONE
    status: TaskStatus = TaskStatus.TODO
    due_at: UTCDatetime | None = None
    project_id: int | None = None
    tags: list[TagName] = Field(default_factory=list)
    recurrence_rule: str | None = Field(None, max_length=255)


class TaskUpdate(PatchModel):
    non_nullable = ("title", "priority", "status", "tags")
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=5000)
    priority: Priority | None = None
    status: TaskStatus | None = None
    due_at: UTCDatetime | None = None
    project_id: int | None = None
    tags: list[TagName] | None = None
    recurrence_rule: str | None = Field(None, max_length=255)


class ReorderItem(BaseModel):
    id: int
    sort_order: int = Field(ge=-2147483648, le=2147483647)


class ReorderRequest(BaseModel):
    items: list[ReorderItem]


class SubtasksProgress(BaseModel):
    done: int
    total: int


class TaskOut(BaseModel):
    id: int
    parent_id: int | None
    project_id: int | None
    title: str
    description: str | None
    status: TaskStatus
    priority: Priority
    due_at: UTCDatetime | None
    completed_at: UTCDatetime | None
    sort_order: int
    recurrence_rule: str | None
    project: ProjectBrief | None
    tags: list[TagBrief]
    subtasks_progress: SubtasksProgress
    created_at: UTCDatetime
    updated_at: UTCDatetime


class TaskDetail(TaskOut):
    subtasks: list[TaskOut]
