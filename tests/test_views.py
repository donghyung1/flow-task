from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.dialects import mysql

from flow_tarsk.api.deps import _tasks
from flow_tarsk.api.v1.views import router
from flow_tarsk.core.timeutil import ViewBounds
from flow_tarsk.repositories.tasks import _conditions
from flow_tarsk.services.tasks import TaskService

NAMES = ("today", "upcoming", "overdue", "inbox")
NOW = datetime(2026, 1, 1, tzinfo=UTC)
B = ViewBounds(now=NOW, today_end=NOW, upcoming_end=NOW, local_today=NOW.date())
svc = TaskService(None)  # type: ignore[arg-type]


def sql(f: Any) -> str:
    return " AND ".join(str(c.compile(dialect=mysql.dialect())) for c in _conditions(f))


@pytest.mark.parametrize("name", NAMES)
def test_default_open_only(name: str) -> None:
    f = svc.view_filters(name, B)
    assert f.open_only
    assert "status !=" in sql(f)


@pytest.mark.parametrize("name", NAMES)
def test_include_done(name: str) -> None:
    f = svc.view_filters(name, B, include_done=True)
    assert not f.open_only
    s = sql(f)
    assert "status" not in s
    assert "deleted_at IS NULL" in s and "parent_id IS NULL" in s
    assert svc.view_filters(name, B).sort == f.sort


def test_overdue_keeps_due_bound() -> None:
    assert svc.view_filters("overdue", B, include_done=True).due_before == NOW


@pytest.mark.parametrize("name", NAMES)
@pytest.mark.parametrize(("qs", "expected"), [("", False), ("?include_done=true", True)])
def test_route_passes_include_done(name: str, qs: str, expected: bool) -> None:
    seen: list[Any] = []

    class Stub:
        async def view(self, *args: Any) -> dict[str, Any]:
            seen.append(args)
            return {"items": [], "total": 0, "page": 1, "size": 20}

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[_tasks] = lambda: Stub()
    r = TestClient(app).get(f"/views/{name}{qs}")
    assert r.status_code == 200, r.text
    assert seen[0][-1] is expected
