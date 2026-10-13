from collections.abc import Sequence

from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from flow_tarsk.models import Project, Task, TaskStatus


class ProjectRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, project_id: int) -> Project | None:
        return await self.session.get(Project, project_id)

    async def list_all(self, include_archived: bool) -> Sequence[Project]:
        stmt = select(Project).order_by(Project.sort_order, Project.id)
        if not include_archived:
            stmt = stmt.where(Project.is_archived.is_(False))
        return (await self.session.execute(stmt)).scalars().all()

    async def counts(self) -> dict[int, tuple[int, int]]:
        """project_id -> (open, total) over live top-level tasks."""
        open_ = func.coalesce(func.sum(case((Task.status != TaskStatus.DONE, 1), else_=0)), 0)
        stmt = (
            select(Task.project_id, open_, func.count(Task.id))
            .where(
                Task.deleted_at.is_(None), Task.parent_id.is_(None), Task.project_id.is_not(None)
            )
            .group_by(Task.project_id)
        )
        return {
            int(pid): (int(o), int(t)) for pid, o, t in (await self.session.execute(stmt)).all()
        }

    async def delete(self, project_id: int) -> None:
        # FK ON DELETE SET NULL moves tasks to the inbox.
        await self.session.execute(delete(Project).where(Project.id == project_id))
