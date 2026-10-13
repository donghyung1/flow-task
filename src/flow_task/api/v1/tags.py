from fastapi import APIRouter, Response

from flow_task.api.deps import Tags
from flow_task.schemas.tag import TagCreate, TagOut, TagUpdate

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
async def list_tags(svc: Tags) -> list[TagOut]:
    return await svc.list_all()


@router.post("", response_model=TagOut, status_code=201)
async def create_tag(data: TagCreate, svc: Tags) -> TagOut:
    return await svc.create(data)


@router.patch("/{tag_id}", response_model=TagOut)
async def update_tag(tag_id: int, data: TagUpdate, svc: Tags) -> TagOut:
    return await svc.update(tag_id, data)


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(tag_id: int, svc: Tags) -> Response:
    await svc.delete(tag_id)
    return Response(status_code=204)
