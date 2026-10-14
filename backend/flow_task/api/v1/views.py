from typing import Annotated

from fastapi import APIRouter, Query

from flow_task.api.deps import Tasks
from flow_task.repositories.tasks import SortKey
from flow_task.schemas.common import Page
from flow_task.schemas.stats import ViewCounts
from flow_task.schemas.task import TaskOut

router = APIRouter(prefix="/views", tags=["views"])

PageQ = Annotated[int, Query(ge=1)]
SizeQ = Annotated[int, Query(ge=1, le=100)]


@router.get("/counts", response_model=ViewCounts)
async def counts(svc: Tasks) -> ViewCounts:
    return ViewCounts(**await svc.view_counts())


@router.get("/today", response_model=Page[TaskOut])
async def today(
    svc: Tasks,
    page: PageQ = 1,
    size: SizeQ = 20,
    sort: SortKey | None = None,
    include_done: bool = False,
) -> Page[TaskOut]:
    return await svc.view("today", page, size, sort, include_done)


@router.get("/upcoming", response_model=Page[TaskOut])
async def upcoming(
    svc: Tasks,
    page: PageQ = 1,
    size: SizeQ = 20,
    sort: SortKey | None = None,
    include_done: bool = False,
) -> Page[TaskOut]:
    return await svc.view("upcoming", page, size, sort, include_done)


@router.get("/overdue", response_model=Page[TaskOut])
async def overdue(
    svc: Tasks,
    page: PageQ = 1,
    size: SizeQ = 20,
    sort: SortKey | None = None,
    include_done: bool = False,
) -> Page[TaskOut]:
    return await svc.view("overdue", page, size, sort, include_done)


@router.get("/inbox", response_model=Page[TaskOut])
async def inbox(
    svc: Tasks,
    page: PageQ = 1,
    size: SizeQ = 20,
    sort: SortKey | None = None,
    include_done: bool = False,
) -> Page[TaskOut]:
    return await svc.view("inbox", page, size, sort, include_done)
