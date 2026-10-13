from typing import Annotated

from fastapi import APIRouter, Query

from flow_tarsk.api.deps import Stats
from flow_tarsk.schemas.stats import StatsOut

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsOut)
async def get_stats(svc: Stats, days: Annotated[int, Query(ge=1, le=90)] = 7) -> StatsOut:
    return await svc.stats(days)
