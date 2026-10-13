from sqlalchemy.ext.asyncio import AsyncSession

from flow_tarsk.core.errors import not_found
from flow_tarsk.models import Project
from flow_tarsk.repositories.projects import ProjectRepository
from flow_tarsk.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate


def _not_found() -> Exception:
    return not_found("PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.")


class ProjectService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ProjectRepository(session)

    @staticmethod
    def _out(p: Project, counts: dict[int, tuple[int, int]]) -> ProjectOut:
        open_count, total = counts.get(p.id, (0, 0))
        return ProjectOut(
            id=p.id,
            name=p.name,
            color=p.color,
            is_archived=p.is_archived,
            sort_order=p.sort_order,
            open_count=open_count,
            total_count=total,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )

    async def list_all(self, include_archived: bool) -> list[ProjectOut]:
        projects = await self.repo.list_all(include_archived)
        counts = await self.repo.counts()
        return [self._out(p, counts) for p in projects]

    async def _get(self, project_id: int) -> Project:
        project = await self.repo.get(project_id)
        if project is None:
            raise _not_found()
        return project

    async def get(self, project_id: int) -> ProjectOut:
        project = await self._get(project_id)
        return self._out(project, await self.repo.counts())

    async def create(self, data: ProjectCreate) -> ProjectOut:
        project = Project(name=data.name, color=data.color, sort_order=data.sort_order)
        self.session.add(project)
        await self.session.commit()
        return self._out(project, {})

    async def update(self, project_id: int, data: ProjectUpdate) -> ProjectOut:
        project = await self._get(project_id)
        for name in data.model_fields_set:
            setattr(project, name, getattr(data, name))
        await self.session.commit()
        await self.session.refresh(project)
        return self._out(project, await self.repo.counts())

    async def delete(self, project_id: int) -> None:
        await self._get(project_id)
        await self.repo.delete(project_id)
        await self.session.commit()
