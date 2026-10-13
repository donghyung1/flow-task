"""Task queries."""

from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import ColumnElement, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from flow_tarsk.models import Priority, Tag, Task, TaskStatus, task_tags

SortKey = Literal[
    "sort_order", "due_at", "-due_at", "priority", "-priority", "created_at", "-created_at"
]
SORT_KEYS: tuple[str, ...] = (
    "sort_order",
    "due_at",
    "-due_at",
    "priority",
    "-priority",
    "created_at",
    "-created_at",
)

_RANK = case(
    (Task.priority == Priority.HIGH, 3),
    (Task.priority == Priority.MEDIUM, 2),
    (Task.priority == Priority.LOW, 1),
    else_=0,
)

_LOAD = (selectinload(Task.project), selectinload(Task.tags))


@dataclass
class TaskFilters:
    statuses: list[TaskStatus] = field(default_factory=list)
    priorities: list[Priority] = field(default_factory=list)
    project_id: int | None = None
    inbox: bool = False
    tag: str | None = None
    due_from: datetime | None = None
    due_to: datetime | None = None
    q: str | None = None
    open_only: bool = False
    due_before: datetime | None = None  # exclusive
    due_at_or_after: datetime | None = None  # inclusive
    sort: str = "sort_order"


def _conditions(f: TaskFilters) -> list[ColumnElement[bool]]:
    conds: list[ColumnElement[bool]] = [Task.deleted_at.is_(None), Task.parent_id.is_(None)]
    if f.statuses:
        conds.append(Task.status.in_(f.statuses))
    if f.open_only:
        conds.append(Task.status != TaskStatus.DONE)
    if f.priorities:
        conds.append(Task.priority.in_(f.priorities))
    if f.project_id is not None:
        conds.append(Task.project_id == f.project_id)
    if f.inbox:
        conds.append(Task.project_id.is_(None))
    if f.tag:
        conds.append(
            Task.id.in_(
                select(task_tags.c.task_id)
                .join(Tag, Tag.id == task_tags.c.tag_id)
                .where(Tag.name == f.tag)
            )
        )
    if f.due_from is not None:
        conds.append(Task.due_at >= f.due_from)
    if f.due_to is not None:
        conds.append(Task.due_at <= f.due_to)
    if f.due_before is not None:
        conds.append(Task.due_at < f.due_before)
    if f.due_at_or_after is not None:
        conds.append(Task.due_at >= f.due_at_or_after)
    if f.q:
        # MariaDB has no ngram parser; substring LIKE works for Korean and short terms.
        conds.append(
            Task.title.contains(f.q, autoescape=True)
            | Task.description.contains(f.q, autoescape=True)
        )
    return conds


def _order(sort: str) -> list[Any]:
    match sort:
        case "due_at":
            return [Task.due_at.is_(None), Task.due_at.asc(), Task.id.asc()]
        case "-due_at":
            return [Task.due_at.is_(None), Task.due_at.desc(), Task.id.asc()]
        case "priority":
            return [_RANK.asc(), Task.sort_order.asc(), Task.id.asc()]
        case "-priority":
            return [_RANK.desc(), Task.sort_order.asc(), Task.id.asc()]
        case "created_at":
            return [Task.created_at.asc(), Task.id.asc()]
        case "-created_at":
            return [Task.created_at.desc(), Task.id.desc()]
        case _:
            return [Task.sort_order.asc(), Task.id.asc()]


class TaskRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def search(self, f: TaskFilters, page: int, size: int) -> tuple[Sequence[Task], int]:
        conds = _conditions(f)
        total = (await self.session.execute(select(func.count(Task.id)).where(*conds))).scalar_one()
        stmt = (
            select(Task)
            .where(*conds)
            .options(*_LOAD)
            .order_by(*_order(f.sort))
            .limit(size)
            .offset((page - 1) * size)
        )
        rows = (await self.session.execute(stmt)).scalars().all()
        return rows, total

    async def count(self, f: TaskFilters) -> int:
        return (
            await self.session.execute(select(func.count(Task.id)).where(*_conditions(f)))
        ).scalar_one()

    async def get(self, task_id: int, *, refresh: bool = False) -> Task | None:
        stmt = select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(*_LOAD)
        if refresh:
            stmt = stmt.execution_options(populate_existing=True)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_many(self, ids: Sequence[int]) -> list[Task]:
        if not ids:
            return []
        stmt = select(Task).where(Task.id.in_(ids), Task.deleted_at.is_(None))
        return list((await self.session.execute(stmt)).scalars().all())

    async def subtasks(self, parent_id: int) -> Sequence[Task]:
        stmt = (
            select(Task)
            .where(Task.parent_id == parent_id, Task.deleted_at.is_(None))
            .options(*_LOAD)
            .order_by(Task.sort_order, Task.id)
        )
        return (await self.session.execute(stmt)).scalars().all()

    async def live_children(self, parent_id: int) -> Sequence[Task]:
        stmt = select(Task).where(Task.parent_id == parent_id, Task.deleted_at.is_(None))
        return (await self.session.execute(stmt)).scalars().all()

    async def progress(self, parent_ids: Sequence[int]) -> dict[int, tuple[int, int]]:
        if not parent_ids:
            return {}
        done = func.coalesce(func.sum(case((Task.status == TaskStatus.DONE, 1), else_=0)), 0)
        stmt = (
            select(Task.parent_id, done, func.count(Task.id))
            .where(Task.parent_id.in_(parent_ids), Task.deleted_at.is_(None))
            .group_by(Task.parent_id)
        )
        rows = (await self.session.execute(stmt)).all()
        return {int(pid): (int(d), int(t)) for pid, d, t in rows}

    async def completed_times(self) -> list[datetime]:
        stmt = select(Task.completed_at).where(
            Task.deleted_at.is_(None),
            Task.status == TaskStatus.DONE,
            Task.completed_at.is_not(None),
        )
        return [v for v in (await self.session.execute(stmt)).scalars().all() if v is not None]
