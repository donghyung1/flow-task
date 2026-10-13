from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from flow_tarsk.core.errors import AppError, not_found
from flow_tarsk.models import Tag
from flow_tarsk.repositories.tags import TagRepository
from flow_tarsk.schemas.tag import TagCreate, TagOut, TagUpdate


def _conflict() -> AppError:
    return AppError("TAG_NAME_CONFLICT", "이미 존재하는 태그 이름입니다.", 409)


class TagService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = TagRepository(session)

    @staticmethod
    def _out(tag: Tag, counts: dict[int, int]) -> TagOut:
        return TagOut(id=tag.id, name=tag.name, color=tag.color, task_count=counts.get(tag.id, 0))

    async def _get(self, tag_id: int) -> Tag:
        tag = await self.repo.get(tag_id)
        if tag is None:
            raise not_found("TAG_NOT_FOUND", "태그를 찾을 수 없습니다.")
        return tag

    async def list_all(self) -> list[TagOut]:
        counts = await self.repo.counts()
        return [self._out(t, counts) for t in await self.repo.list_all()]

    async def create(self, data: TagCreate) -> TagOut:
        if await self.repo.by_name(data.name) is not None:
            raise _conflict()
        tag = Tag(name=data.name, color=data.color)
        self.session.add(tag)
        await self._commit()
        return self._out(tag, {})

    async def update(self, tag_id: int, data: TagUpdate) -> TagOut:
        tag = await self._get(tag_id)
        if data.name is not None:
            other = await self.repo.by_name(data.name)
            if other is not None and other.id != tag.id:
                raise _conflict()
            tag.name = data.name
        if "color" in data.model_fields_set:
            tag.color = data.color
        await self._commit()
        return self._out(tag, await self.repo.counts())

    async def delete(self, tag_id: int) -> None:
        await self._get(tag_id)
        await self.repo.delete(tag_id)
        await self.session.commit()

    async def _commit(self) -> None:
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise _conflict() from exc
