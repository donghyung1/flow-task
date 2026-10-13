# API Contract (백엔드 ↔ 프론트엔드 공유 계약)

PRD.md 8장을 구체화한 문서. 백엔드와 프론트엔드는 이 문서를 기준으로 구현한다.

## 공통
- Base: `/api/v1`, JSON, 시각은 ISO 8601 UTC (`2026-10-15T09:00:00Z`)
- 목록 응답(할 일/뷰): `{ "items": [...], "page": 1, "size": 20, "total": 134 }`
- 프로젝트/태그 목록: 페이지네이션 없이 **JSON 배열**
- 에러: `{ "error": { "code": "TASK_NOT_FOUND", "message": "..." } }`
  - 422 검증 오류도 같은 형식으로 변환: code=`VALIDATION_ERROR`, `details` 필드에 FastAPI 오류 배열
  - 코드: `TASK_NOT_FOUND`, `PROJECT_NOT_FOUND`, `TAG_NOT_FOUND`, `TAG_NAME_CONFLICT`(409), `SUBTASK_DEPTH_EXCEEDED`(400), `TOO_MANY_TAGS`(400), `INVALID_RECURRENCE`(400), `VALIDATION_ERROR`(422)
- 정적/라우팅: `/` → 302 `/app/today`; `/app` 및 `/app/{path:path}` → `static/index.html`; 정적 자원은 `/static/...`
- `GET /health` (prefix 없음) → `{ "status": "ok", "db": "ok" }` (DB 실패 시 503, `"db": "error"`)

## Task 객체
```json
{
  "id": 42, "parent_id": null, "project_id": 3,
  "title": "...", "description": "...",
  "status": "TODO|IN_PROGRESS|DONE", "priority": "NONE|LOW|MEDIUM|HIGH",
  "due_at": "2026-10-15T09:00:00Z", "completed_at": null,
  "sort_order": 0, "recurrence_rule": null,
  "project": { "id": 3, "name": "Task Flow", "color": "#4F46E5" },
  "tags": [{ "id": 1, "name": "업무", "color": null }],
  "subtasks_progress": { "done": 0, "total": 0 },
  "created_at": "...", "updated_at": "..."
}
```
- `GET /tasks/{id}` 응답에만 `"subtasks": [Task...]` 추가 (sort_order, id 순)

## 할 일
| Method | Path | 비고 |
|---|---|---|
| GET | `/tasks` | 쿼리: `status`(콤마 다중), `priority`(콤마 다중), `project_id`, `inbox=true`, `tag`(태그명), `due_from`, `due_to`, `q`, `sort`, `page`(1~), `size`(1~100, 기본 20). **최상위 할 일만** 반환(parent_id IS NULL), 삭제된 것 제외 |
| POST | `/tasks` | body: `title`(1~200) 필수; `description`(≤5000), `priority`, `status`, `due_at`, `project_id`, `tags`(태그명 배열 ≤10, 없으면 자동 생성), `recurrence_rule` → 201 Task |
| GET | `/tasks/{id}` | Task + subtasks |
| PATCH | `/tasks/{id}` | 위 필드 부분 수정. `tags` 주면 전체 교체. `null`로 due_at/project_id/description 해제 가능. status를 DONE으로 바꾸면 complete와 동일 처리 |
| DELETE | `/tasks/{id}` | 204, 소프트 삭제(하위 작업도 함께 소프트 삭제) |
| POST | `/tasks/{id}/complete` | 200 Task. `completed_at` 기록. 반복 규칙 있으면 다음 회차 생성 |
| POST | `/tasks/{id}/reopen` | 200 Task. status=TODO, completed_at=null |
| POST | `/tasks/{id}/subtasks` | body는 POST /tasks와 동일 → 201 Task. 부모가 하위 작업이면 400 `SUBTASK_DEPTH_EXCEEDED` |
| PATCH | `/tasks/reorder` | body `{ "items": [{ "id": 1, "sort_order": 0 }, ...] }` → 204 |

- `sort`: `sort_order`(기본), `due_at`, `-due_at`, `priority`, `-priority`, `created_at`, `-created_at`. due_at 정렬 시 NULL은 뒤로. priority 정렬은 HIGH>MEDIUM>LOW>NONE 의미 기준(`-priority` = 높은 것 먼저)
- `q`: 제목·메모 검색 (FULLTEXT ngram, 실패/짧은 검색어는 LIKE 폴백)

## 반복 규칙 (`recurrence_rule`, RRULE 부분집합)
- `FREQ=DAILY`
- `FREQ=WEEKLY;BYDAY=MO,WE,FR`
- `FREQ=MONTHLY;BYMONTHDAY=15`
- 선택: `;INTERVAL=n`, `;UNTIL=20261231T235959Z`
- 다음 회차: due_at 기준(없으면 완료 시각 기준)으로 다음 발생 시각 계산, UNTIL 넘으면 생성 안 함. 새 할 일은 제목·메모·우선순위·프로젝트·태그·규칙 복사, status=TODO

## 스마트 뷰 (`APP_TIMEZONE` 기준, 미완료 = status != DONE, 최상위만)
| GET | 설명 |
|---|---|
| `/views/today` | due_at < 내일 00:00(로컬) |
| `/views/upcoming` | 내일 00:00 ≤ due_at < 내일+7일 00:00 |
| `/views/overdue` | due_at < 현재 |
| `/views/inbox` | project_id IS NULL, 미완료 |
- 쿼리 `page`, `size`, `sort`, `include_done`(기본 false; true면 완료(DONE) 할 일도 포함, 최상위·미삭제만) 지원. 기본 정렬: due_at 오름차순 (inbox는 sort_order)
- `GET /views/counts` → `{ "today": n, "upcoming": n, "overdue": n, "inbox": n }` (사이드바 배지용)

## 프로젝트
Project 객체: `{ "id", "name", "color", "is_archived", "sort_order", "open_count", "total_count", "created_at", "updated_at" }`
| Method | Path | 비고 |
|---|---|---|
| GET | `/projects?include_archived=false` | 배열 |
| POST | `/projects` | `name`(1~50), `color`(`#RRGGBB`), `sort_order` → 201 |
| GET/PATCH/DELETE | `/projects/{id}` | PATCH: name, color, is_archived, sort_order. DELETE 204, 소속 할 일은 project_id=NULL |

## 태그
Tag 객체: `{ "id", "name", "color", "task_count" }`
| Method | Path | 비고 |
|---|---|---|
| GET | `/tags` | 배열 (이름순) |
| POST | `/tags` | `name`(1~30), `color` → 201, 중복 409 |
| PATCH/DELETE | `/tags/{id}` | 중복 409 / 204 |

## 통계 (P2)
`GET /stats?days=7` (1~90)
```json
{
  "daily": [{ "date": "2026-10-07", "completed": 3 }],
  "by_project": [{ "project_id": 3, "name": "Task Flow", "color": "#4F46E5", "done": 5, "total": 8, "rate": 0.625 }],
  "streak": 4,
  "total_completed": 21
}
```
- daily: APP_TIMEZONE 기준 최근 `days`일(오늘 포함, 오래된 순)
- streak: 오늘(또는 오늘 0건이면 어제)부터 거꾸로 하루 1건 이상 완료한 연속 일수
