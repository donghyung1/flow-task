from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from flow_tarsk.db.session import get_session
from flow_tarsk.services.projects import ProjectService
from flow_tarsk.services.stats import StatsService
from flow_tarsk.services.tags import TagService
from flow_tarsk.services.tasks import TaskService

Session = Annotated[AsyncSession, Depends(get_session)]


def _tasks(session: Session) -> TaskService:
    return TaskService(session)


def _projects(session: Session) -> ProjectService:
    return ProjectService(session)


def _tags(session: Session) -> TagService:
    return TagService(session)


def _stats(session: Session) -> StatsService:
    return StatsService(session)


Tasks = Annotated[TaskService, Depends(_tasks)]
Projects = Annotated[ProjectService, Depends(_projects)]
Tags = Annotated[TagService, Depends(_tags)]
Stats = Annotated[StatsService, Depends(_stats)]
