from pydantic import BaseModel


class DailyStat(BaseModel):
    date: str
    completed: int


class ProjectStat(BaseModel):
    project_id: int
    name: str
    color: str
    done: int
    total: int
    rate: float


class StatsOut(BaseModel):
    daily: list[DailyStat]
    by_project: list[ProjectStat]
    streak: int
    total_completed: int


class ViewCounts(BaseModel):
    today: int
    upcoming: int
    overdue: int
    inbox: int
