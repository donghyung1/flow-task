from collections.abc import Sequence

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from flow_tarsk.models import Tag, Task, task_tags


class TagRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, tag_id: int) -> Tag | None:
        return await self.session.get(Tag, tag_id)

    async def by_name(self, name: str) -> Tag | None:
        return (
            await self.session.execute(select(Tag).where(Tag.name == name))
        ).scalar_one_or_none()

    async def by_names(self, names: Sequence[str]) -> list[Tag]:
        if not names:
            return []
        return list((await self.session.execute(select(Tag).where(Tag.name.in_(names)))).scalars())

    async def list_all(self) -> Sequence[Tag]:
        return (await self.session.execute(select(Tag).order_by(Tag.name, Tag.id))).scalars().all()

    async def counts(self) -> dict[int, int]:
        stmt = (
            select(task_tags.c.tag_id, func.count(Task.id))
            .join(Task, Task.id == task_tags.c.task_id)
            .where(Task.deleted_at.is_(None))
            .group_by(task_tags.c.tag_id)
        )
        return {int(t): int(c) for t, c in (await self.session.execute(stmt)).all()}

    async def delete(self, tag_id: int) -> None:
        await self.session.execute(delete(Tag).where(Tag.id == tag_id))
