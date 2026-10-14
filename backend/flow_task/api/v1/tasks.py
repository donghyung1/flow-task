from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query, Response

from flow_task.api.deps import Tasks
from flow_task.core.errors import AppError
from flow_task.models import Priority, TaskStatus
from flow_task.repositories.tasks import SortKey, TaskFilters
from flow_task.schemas.common import Page
from flow_task.schemas.task import ReorderRequest, TaskCreate, TaskDetail, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])

PageQ = Annotated[int, Query(ge=1)]
SizeQ = Annotated[int, Query(ge=1, le=100)]


def _parse_enum[E: (TaskStatus, Priority)](cls: type[E], raw: str | None, name: str) -> list[E]:
    if not raw:
        return []
    out: list[E] = []
    for part in raw.split(","):
        part = part.strip().upper()
        if not part:
            continue
        try:
            out.append(cls(part))
        except ValueError as exc:
            raise AppError(
                "VALIDATION_ERROR",
                f"invalid {name}: {part}",
                422,
                [{"loc": ["query", name], "msg": f"invalid {name}: {part}", "type": "enum"}],
            ) from exc
    return out


@router.get("", response_model=Page[TaskOut])
async def list_tasks(
    svc: Tasks,
    status: str | None = None,
    priority: str | None = None,
    project_id: int | None = None,
    inbox: bool = False,
    tag: str | None = None,
    due_from: datetime | None = None,
    due_to: datetime | None = None,
    q: str | None = None,
    sort: SortKey = "sort_order",
    page: PageQ = 1,
    size: SizeQ = 20,
) -> Page[TaskOut]:
    f = TaskFilters(
        statuses=_parse_enum(TaskStatus, status, "status"),
        priorities=_parse_enum(Priority, priority, "priority"),
        project_id=project_id,
        inbox=inbox,
        tag=tag,
        due_from=due_from,
        due_to=due_to,
        q=q.strip() if q else None,
        sort=sort,
    )
    return await svc.list_tasks(f, page, size)


@router.post("", response_model=TaskOut, status_code=201)
async def create_task(data: TaskCreate, svc: Tasks) -> TaskOut:
    return await svc.create(data)


@router.patch("/reorder", status_code=204)
async def reorder(data: ReorderRequest, svc: Tasks) -> Response:
    await svc.reorder(data)
    return Response(status_code=204)


@router.get("/{task_id}", response_model=TaskDetail)
async def get_task(task_id: int, svc: Tasks) -> TaskDetail:
    return await svc.get(task_id)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(task_id: int, data: TaskUpdate, svc: Tasks) -> TaskOut:
    return await svc.update(task_id, data)


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: int, svc: Tasks) -> Response:
    await svc.delete(task_id)
    return Response(status_code=204)


@router.post("/{task_id}/complete", response_model=TaskOut)
async def complete_task(task_id: int, svc: Tasks) -> TaskOut:
    return await svc.complete(task_id)


@router.post("/{task_id}/reopen", response_model=TaskOut)
async def reopen_task(task_id: int, svc: Tasks) -> TaskOut:
    return await svc.reopen(task_id)


@router.post("/{task_id}/subtasks", response_model=TaskOut, status_code=201)
async def create_subtask(task_id: int, data: TaskCreate, svc: Tasks) -> TaskOut:
    return await svc.create_subtask(task_id, data)
