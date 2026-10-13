from fastapi import APIRouter

from flow_task.api.v1 import projects, stats, tags, tasks, views

api_router = APIRouter(prefix="/api/v1")
for module in (tasks, views, projects, tags, stats):
    api_router.include_router(module.router)
