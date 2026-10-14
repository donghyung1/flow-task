"""Task business logic."""

from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from flow_task.core import clock
from flow_task.core.config import get_settings
from flow_task.core.errors import AppError, not_found
from flow_task.core.recurrence import InvalidRecurrenceError, next_occurrence, parse_rule
from flow_task.core.timeutil import ViewBounds, view_bounds
from flow_task.models import Tag, Task, TaskStatus
from flow_task.repositories.projects import ProjectRepository
from flow_task.repositories.tags import TagRepository
from flow_task.repositories.tasks import TaskFilters, TaskRepository
from flow_task.schemas.common import Page
from flow_task.schemas.project import ProjectBrief
from flow_task.schemas.tag import TagBrief
from flow_task.schemas.task import (
    ReorderRequest,
    SubtasksProgress,
    TaskCreate,
    TaskDetail,
    TaskOut,
    TaskUpdate,
)

MAX_TAGS = 10


def task_not_found() -> AppError:
    return not_found("TASK_NOT_FOUND", "할 일을 찾을 수 없습니다.")


def validate_rule(rule: str | None) -> str | None:
    if rule is None or not rule.strip():
        return None
    try:
        parse_rule(rule)
    except InvalidRecurrenceError as exc:
        raise AppError("INVALID_RECURRENCE", str(exc), 400) from exc
    return rule.strip()


class TaskService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.tasks = TaskRepository(session)
        self.projects = ProjectRepository(session)
        self.tags = TagRepository(session)

    # ---- serialization -------------------------------------------------
    def _out(self, task: Task, progress: dict[int, tuple[int, int]]) -> TaskOut:
        done, total = progress.get(task.id, (0, 0))
        return TaskOut(
            id=task.id,
            parent_id=task.parent_id,
            project_id=task.project_id,
            title=task.title,
            description=task.description,
            status=task.status,
            priority=task.priority,
            due_at=task.due_at,
            completed_at=task.completed_at,
            sort_order=task.sort_order,
            recurrence_rule=task.recurrence_rule,
            project=ProjectBrief.model_validate(task.project) if task.project else None,
            tags=[TagBrief.model_validate(t) for t in task.tags],
            subtasks_progress=SubtasksProgress(done=done, total=total),
            created_at=task.created_at,
            updated_at=task.updated_at,
        )

    async def _outs(self, tasks: Sequence[Task]) -> list[TaskOut]:
        progress = await self.tasks.progress([t.id for t in tasks])
        return [self._out(t, progress) for t in tasks]

    async def _fresh(self, task_id: int) -> TaskOut:
        task = await self.tasks.get(task_id, refresh=True)
        if task is None:  # pragma: no cover - defensive
            raise task_not_found()
        return (await self._outs([task]))[0]

    # ---- helpers -------------------------------------------------------
    async def _require_project(self, project_id: int | None) -> None:
        if project_id is not None and await self.projects.get(project_id) is None:
            raise not_found("PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.")

    async def _resolve_tags(self, names: list[str]) -> list[Tag]:
        unique: dict[str, str] = {}
        for n in names:
            unique.setdefault(n.casefold(), n)
        if len(unique) > MAX_TAGS:
            raise AppError(
                "TOO_MANY_TAGS", f"태그는 최대 {MAX_TAGS}개까지 지정할 수 있습니다.", 400
            )
        existing = await self.tags.by_names(list(unique.values()))
        by_key = {t.name.casefold(): t for t in existing}
        result: list[Tag] = []
        for key, name in unique.items():
            tag = by_key.get(key)
            if tag is None:
                tag = Tag(name=name)
                self.session.add(tag)
            result.append(tag)
        await self.session.flush()
        return result

    # ---- create --------------------------------------------------------
    async def create(self, data: TaskCreate, parent: Task | None = None) -> TaskOut:
        rule = validate_rule(data.recurrence_rule)
        project_id = data.project_id
        if project_id is None and parent is not None:
            project_id = parent.project_id
        await self._require_project(project_id)
        tags = await self._resolve_tags(data.tags)
        now = clock.utcnow()
        task = Task(
            parent_id=parent.id if parent else None,
            project_id=project_id,
            title=data.title,
            description=data.description,
            status=data.status,
            priority=data.priority,
            due_at=data.due_at,
            completed_at=now if data.status == TaskStatus.DONE else None,
            recurrence_rule=rule,
            tags=tags,
        )
        self.session.add(task)
        await self.session.commit()
        return await self._fresh(task.id)

    async def create_subtask(self, parent_id: int, data: TaskCreate) -> TaskOut:
        parent = await self.tasks.get(parent_id)
        if parent is None:
            raise task_not_found()
        if parent.parent_id is not None:
            raise AppError(
                "SUBTASK_DEPTH_EXCEEDED", "하위 작업에는 하위 작업을 추가할 수 없습니다.", 400
            )
        return await self.create(data, parent)

    # ---- read ----------------------------------------------------------
    async def get(self, task_id: int) -> TaskDetail:
        task = await self.tasks.get(task_id)
        if task is None:
            raise task_not_found()
        subs = await self.tasks.subtasks(task_id)
        progress = await self.tasks.progress([task_id, *[s.id for s in subs]])
        return TaskDetail(
            **self._out(task, progress).model_dump(),
            subtasks=[self._out(s, progress) for s in subs],
        )

    async def list_tasks(self, f: TaskFilters, page: int, size: int) -> Page[TaskOut]:
        rows, total = await self.tasks.search(f, page, size)
        return Page[TaskOut](items=await self._outs(rows), page=page, size=size, total=total)

    # ---- update --------------------------------------------------------
    async def update(self, task_id: int, data: TaskUpdate) -> TaskOut:
        task = await self.tasks.get(task_id)
        if task is None:
            raise task_not_found()
        fields = data.model_fields_set
        if "recurrence_rule" in fields:
            task.recurrence_rule = validate_rule(data.recurrence_rule)
        if "project_id" in fields:
            await self._require_project(data.project_id)
            task.project_id = data.project_id
        if "tags" in fields and data.tags is not None:
            task.tags = await self._resolve_tags(data.tags)
        if "title" in fields and data.title is not None:
            task.title = data.title
        if "description" in fields:
            task.description = data.description
        if "priority" in fields and data.priority is not None:
            task.priority = data.priority
        if "due_at" in fields:
            task.due_at = data.due_at
        if "status" in fields and data.status is not None:
            self._apply_status(task, data.status)
        await self.session.commit()
        return await self._fresh(task_id)

    def _apply_status(self, task: Task, status: TaskStatus) -> None:
        if status == TaskStatus.DONE:
            if task.status != TaskStatus.DONE:
                task.status = TaskStatus.DONE
                task.completed_at = clock.utcnow()
                self._spawn_next(task)
        else:
            task.status = status
            task.completed_at = None

    def _spawn_next(self, task: Task) -> Task | None:
        if not task.recurrence_rule:
            return None
        base = task.due_at or task.completed_at or clock.utcnow()
        nxt = next_occurrence(task.recurrence_rule, base, get_settings().tz)
        if nxt is None:
            return None
        clone = Task(
            parent_id=task.parent_id,
            project_id=task.project_id,
            title=task.title,
            description=task.description,
            status=TaskStatus.TODO,
            priority=task.priority,
            due_at=nxt,
            sort_order=task.sort_order,
            recurrence_rule=task.recurrence_rule,
            tags=list(task.tags),
        )
        self.session.add(clone)
        return clone

    async def complete(self, task_id: int) -> TaskOut:
        task = await self.tasks.get(task_id)
        if task is None:
            raise task_not_found()
        self._apply_status(task, TaskStatus.DONE)
        await self.session.commit()
        return await self._fresh(task_id)

    async def reopen(self, task_id: int) -> TaskOut:
        task = await self.tasks.get(task_id)
        if task is None:
            raise task_not_found()
        self._apply_status(task, TaskStatus.TODO)
        await self.session.commit()
        return await self._fresh(task_id)

    async def delete(self, task_id: int) -> None:
        task = await self.tasks.get(task_id)
        if task is None:
            raise task_not_found()
        now = clock.utcnow()
        task.deleted_at = now
        for child in await self.tasks.live_children(task_id):
            child.deleted_at = now
        await self.session.commit()

    async def reorder(self, data: ReorderRequest) -> None:
        orders = {item.id: item.sort_order for item in data.items}
        found = await self.tasks.get_many(list(orders))
        if len(found) != len(orders):
            raise task_not_found()
        for task in found:
            task.sort_order = orders[task.id]
        await self.session.commit()

    # ---- smart views ---------------------------------------------------
    def bounds(self) -> ViewBounds:
        return view_bounds(clock.utcnow(), get_settings().tz)

    def view_filters(self, name: str, b: ViewBounds, include_done: bool = False) -> TaskFilters:
        f = TaskFilters(open_only=not include_done, sort="due_at")
        match name:
            case "today":
                f.due_before = b.today_end
            case "upcoming":
                f.due_at_or_after = b.today_end
                f.due_before = b.upcoming_end
            case "overdue":
                f.due_before = b.now
            case "inbox":
                f.inbox = True
                f.sort = "sort_order"
        return f

    async def view(
        self, name: str, page: int, size: int, sort: str | None, include_done: bool = False
    ) -> Page[TaskOut]:
        f = self.view_filters(name, self.bounds(), include_done)
        if sort:
            f.sort = sort
        return await self.list_tasks(f, page, size)

    async def view_counts(self) -> dict[str, int]:
        b = self.bounds()
        return {
            name: await self.tasks.count(self.view_filters(name, b))
            for name in ("today", "upcoming", "overdue", "inbox")
        }
