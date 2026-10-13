"""Hard-delete soft-deleted tasks older than N days."""

from datetime import timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from flow_tarsk.core import clock
from flow_tarsk.models import Task


async def purge_deleted(session: AsyncSession, days: int = 30) -> int:
    """Delete tasks soft-deleted more than ``days`` days ago; return the number removed."""
    cutoff = clock.utcnow() - timedelta(days=days)
    cond = (Task.deleted_at.is_not(None), Task.deleted_at < cutoff)
    count = (await session.execute(select(func.count(Task.id)).where(*cond))).scalar_one()
    await session.execute(delete(Task).where(*cond))
    await session.commit()
    return int(count)
