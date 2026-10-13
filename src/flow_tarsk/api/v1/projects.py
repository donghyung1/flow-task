from fastapi import APIRouter, Response

from flow_tarsk.api.deps import Projects
from flow_tarsk.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
async def list_projects(svc: Projects, include_archived: bool = False) -> list[ProjectOut]:
    return await svc.list_all(include_archived)


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(data: ProjectCreate, svc: Projects) -> ProjectOut:
    return await svc.create(data)


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: int, svc: Projects) -> ProjectOut:
    return await svc.get(project_id)


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: int, data: ProjectUpdate, svc: Projects) -> ProjectOut:
    return await svc.update(project_id, data)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: int, svc: Projects) -> Response:
    await svc.delete(project_id)
    return Response(status_code=204)
