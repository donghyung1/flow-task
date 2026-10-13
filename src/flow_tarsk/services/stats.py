from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from flow_tarsk.core import clock
from flow_tarsk.core.config import get_settings
from flow_tarsk.core.timeutil import local_date
from flow_tarsk.models import Project, Task, TaskStatus
from flow_tarsk.repositories.tasks import TaskRepository
from flow_tarsk.schemas.stats import DailyStat, ProjectStat, StatsOut


def compute_streak(completed_days: set[date], today: date) -> int:
    """Consecutive days with >=1 completion, ending today (or yesterday if today is empty)."""
    day = today if today in completed_days else today - timedelta(days=1)
    streak = 0
    while day in completed_days:
        streak += 1
        day -= timedelta(days=1)
    return streak


class StatsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def stats(self, days: int) -> StatsOut:
        tz = get_settings().tz
        times = await TaskRepository(self.session).completed_times()
        per_day: dict[date, int] = {}
        for t in times:
            d = local_date(t, tz)
            per_day[d] = per_day.get(d, 0) + 1
        today = local_date(clock.utcnow(), tz)
        daily = [
            DailyStat(
                date=(d := today - timedelta(days=i)).isoformat(), completed=per_day.get(d, 0)
            )
            for i in range(days - 1, -1, -1)
        ]

        done = func.sum(func.if_(Task.status == TaskStatus.DONE, 1, 0))
        stmt = (
            select(
                Project.id, Project.name, Project.color, func.coalesce(done, 0), func.count(Task.id)
            )
            .select_from(Project)
            .outerjoin(
                Task,
                (Task.project_id == Project.id)
                & Task.deleted_at.is_(None)
                & Task.parent_id.is_(None),
            )
            .where(Project.is_archived.is_(False))
            .group_by(Project.id, Project.name, Project.color)
            .order_by(Project.sort_order, Project.id)
        )
        by_project = [
            ProjectStat(
                project_id=pid,
                name=name,
                color=color,
                done=int(d),
                total=int(total),
                rate=round(int(d) / int(total), 4) if total else 0.0,
            )
            for pid, name, color, d, total in (await self.session.execute(stmt)).all()
        ]
        return StatsOut(
            daily=daily,
            by_project=by_project,
            streak=compute_streak(set(per_day), today),
            total_completed=len(times),
        )
