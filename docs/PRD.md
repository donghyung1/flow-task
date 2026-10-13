# Task Flow — 제품 요구사항 문서 (PRD)

| 항목 | 내용 |
|------|------|
| 제품명 | Task Flow |
| 문서 버전 | v0.3 (1인 전용, 인증 제거) |
| 작성일 | 2026-10-13 |
| 작성자 | donghyung1 |
| 상태 | Draft |
| 기술 스택 | Python 3.15 · FastAPI · MariaDB · uv · HTML/CSS/JavaScript (Vanilla) |

---

## 1. 개요

### 1.1 배경
해야 할 일을 메모 앱, 캘린더, 메신저 등에 흩어 관리하다 보니 마감을 놓치거나 우선순위를 판단하기 어렵다. Task Flow는 **나 한 사람만 쓰는** 할 일 관리 앱으로, 할 일을 한 곳에서 **등록 → 정리 → 실행 → 완료**의 흐름(Flow)으로 관리하게 해 준다.

### 1.2 목표
- 할 일을 3초 안에 등록할 수 있을 만큼 단순한 경험 제공
- 마감일·우선순위·프로젝트·태그로 할 일을 구조화
- "오늘 할 일", "다가오는 일", "지연된 일" 뷰로 지금 할 일에 집중하게 함
- REST API 백엔드와, 이를 사용하는 웹 프론트엔드(HTML·CSS·JS만 사용) 제공
- 로그인 없이 브라우저를 열면 바로 사용

### 1.3 비목표 (v1 범위 밖)
- 다중 사용자, 회원가입, 로그인 등 모든 인증/계정 기능 (1인 전용)
- 팀 협업, 할 일 공유, 권한 관리
- 실시간 동기화(WebSocket), 오프라인 모드
- 외부 캘린더(Google Calendar 등) 연동
- 알림 (이메일, 푸시, 브라우저 알림)
- 네이티브 모바일 앱
- 프론트엔드 프레임워크/빌드 도구 (React, Vue, TypeScript, 번들러 등)

---

## 2. 사용자

사용자는 **본인 1명**이다. 업무와 개인 일을 함께 관리하며, 다음이 필요하다.
- 오늘 해야 할 일과 마감이 다가오는 일을 한눈에 보기
- 업무/개인/공부 등 프로젝트별로 분류하기
- 큰 일을 하위 작업으로 쪼개고 우선순위대로 처리하기

---

## 3. 사용자 스토리

| ID | 사용자 스토리 | 우선순위 |
|----|---------------|----------|
| US-01 | 나는 제목만 입력해 빠르게 할 일을 추가하고 싶다. | P0 |
| US-02 | 나는 할 일에 마감일, 우선순위, 메모를 지정하고 싶다. | P0 |
| US-03 | 나는 할 일을 완료 처리하거나 되돌리고 싶다. | P0 |
| US-04 | 나는 할 일을 수정·삭제하고 싶다. | P0 |
| US-05 | 나는 오늘/다가오는/지연된 할 일을 따로 보고 싶다. | P0 |
| US-06 | 나는 할 일을 프로젝트(목록)로 묶고 싶다. | P1 |
| US-07 | 나는 태그로 할 일을 분류하고 필터링하고 싶다. | P1 |
| US-08 | 나는 큰 할 일을 하위 작업으로 나누고 싶다. | P1 |
| US-09 | 나는 키워드로 할 일을 검색하고 싶다. | P1 |
| US-10 | 나는 매일/매주/매월 반복되는 할 일을 등록하고 싶다. | P2 |
| US-11 | 나는 완료 통계(주간 완료 수 등)를 보고 싶다. | P2 |

> P0: MVP 필수 · P1: v1 출시 포함 · P2: 이후 버전

---

## 4. 기능 요구사항

### 4.1 할 일 (Task) (P0)
- FR-TASK-01: 할 일 생성 — 필수: 제목(1~200자) / 선택: 메모(최대 5,000자), 마감일시, 우선순위, 프로젝트, 태그
- FR-TASK-02: 우선순위 4단계: `NONE`, `LOW`, `MEDIUM`, `HIGH`
- FR-TASK-03: 상태: `TODO`, `IN_PROGRESS`, `DONE`  — 완료 시 `completed_at` 기록, 되돌리면 초기화
- FR-TASK-04: 할 일 단건 조회 / 수정(부분 수정, PATCH) / 삭제(소프트 삭제)
- FR-TASK-05: 목록 조회 — 필터(상태, 우선순위, 프로젝트, 태그, 마감일 범위), 정렬(마감일, 우선순위, 생성일, 수동 순서), 페이지네이션

### 4.2 스마트 뷰 (P0)
설정된 타임존(`APP_TIMEZONE`, 기본 `Asia/Seoul`) 기준으로 계산한다.
- **오늘(Today)**: 마감일이 오늘이거나 지난 미완료 할 일
- **다가오는 일(Upcoming)**: 내일부터 7일 이내 마감인 미완료 할 일
- **지연됨(Overdue)**: 마감일시가 현재보다 이전인 미완료 할 일
- **받은함(Inbox)**: 프로젝트가 지정되지 않은 할 일

### 4.3 프로젝트 (P1)
- FR-PROJ-01: 프로젝트 생성/수정/삭제 (이름 1~50자, 색상 HEX)
- FR-PROJ-02: 프로젝트 삭제 시 소속 할 일은 받은함으로 이동한다(`project_id` → NULL). 함께 삭제 옵션은 제공하지 않는다.
- FR-PROJ-03: 프로젝트별 미완료/전체 할 일 개수 제공
- FR-PROJ-04: 프로젝트 보관(archive) 기능

### 4.4 태그 (P1)
- FR-TAG-01: 태그 생성/수정/삭제, 이름 중복 불가
- FR-TAG-02: 할 일 1개에 태그 최대 10개, 태그 기준 필터링

### 4.5 하위 작업 (P1)
- FR-SUB-01: 할 일 아래 하위 작업 추가 (1단계 깊이만 허용)
- FR-SUB-02: 하위 작업 완료 진행률(예: 2/5) 제공
- FR-SUB-03: 부모 할 일 삭제 시 하위 작업 함께 삭제

### 4.6 검색 (P1)
- FR-SEARCH-01: 제목·메모 대상 키워드 검색 (MariaDB FULLTEXT 인덱스 활용)

### 4.7 반복 할 일 (P2)
- 반복 규칙: 매일 / 매주(요일 지정) / 매월(일자 지정) / 종료일
- 반복 할 일 완료 시 다음 회차 할 일을 자동 생성

### 4.8 통계 (P2)
- 기간별 완료 개수, 프로젝트별 완료율, 연속 달성일(streak)

### 4.9 웹 프론트엔드 (P0~P1)
순수 **HTML, CSS, JavaScript(Vanilla, ES Modules)** 만 사용한다. 프레임워크·라이브러리·빌드 도구 없이 FastAPI가 정적 파일로 직접 서빙한다. 로그인 화면 없이 접속하면 바로 메인 화면이 열린다.

- FR-WEB-01: 화면 구성
  | 화면 | 내용 | 우선순위 |
  |------|------|----------|
  | 메인 (할 일 목록) | 좌측 사이드바(스마트 뷰·프로젝트·태그), 중앙 목록, 상단 빠른 추가 입력창 | P0 |
  | 할 일 상세 패널 | 제목·메모·마감일·우선순위·프로젝트·태그 편집, 하위 작업 | P0 (하위 작업 P1) |
  | 프로젝트 / 태그 관리 | 생성·수정·삭제, 색상 선택 | P1 |
  | 통계 | 주간 완료 수 등 간단한 막대 그래프(CSS/SVG로 구현) | P2 |
- FR-WEB-02: SPA 형태로 동작하며, 라우팅은 History API(`/app/today`, `/app/projects/3` 등) 기반으로 구현한다. 새로고침 시에도 같은 화면이 유지되어야 한다.
- FR-WEB-03: API 호출은 `fetch` 기반 공통 모듈로 처리하고, 오류 응답은 공통 에러 형식을 해석해 토스트로 표시한다.
- FR-WEB-04: 할 일 추가·완료 토글은 낙관적 업데이트(optimistic update)로 즉시 반영하고, 실패 시 되돌리며 오류 토스트를 표시한다.
- FR-WEB-05: 반응형 레이아웃 — 데스크톱(≥1024px)은 3단, 모바일(<768px)은 사이드바를 햄버거 메뉴로 접는다.
- FR-WEB-06: 키보드 단축키 — `N`(새 할 일), `/`(검색), `Esc`(패널 닫기)
- FR-WEB-07: 다크 모드 — `prefers-color-scheme` 기반 자동 전환 (CSS 변수 사용)
- FR-WEB-08: 사용자 입력은 `textContent`로 렌더링하여 XSS를 방지한다(`innerHTML`에 사용자 데이터 삽입 금지).

---

## 5. 비기능 요구사항

| 구분 | 요구사항 |
|------|----------|
| 성능 | 주요 API p95 응답 200ms 이하 (할 일 1만 건 기준) |
| 보안 | 인증이 없으므로 **기본 바인딩은 `127.0.0.1`** (로컬 전용). 다른 기기에서 접속하려면 VPN(Tailscale 등) 또는 리버스 프록시의 접근 제어 뒤에 둔다. SQL Injection 방지(ORM 파라미터 바인딩), 프론트엔드와 API 동일 출처 서빙(CORS 비활성), CSP 헤더 적용 |
| 운영 | 단일 인스턴스, `docker compose up` 한 번으로 실행 |
| 데이터 | 일 1회 MariaDB 백업(`mariadb-dump`), 소프트 삭제 데이터 30일 후 영구 삭제 |
| 시간 | DB에는 UTC 저장, 응답은 ISO 8601, 뷰 계산은 `APP_TIMEZONE` 기준 |
| 설정 | 환경 변수(`.env`)로 관리: `DATABASE_URL`, `APP_TIMEZONE`, `HOST`, `PORT` |
| 품질 | 서비스/API 테스트 커버리지 80% 이상, 타입 힌트 + 정적 검사(ruff, mypy) |
| 문서화 | FastAPI 자동 OpenAPI 문서(`/docs`, `/redoc`) 제공 |
| 관측성 | 구조화 로그(JSON), `/health` 헬스체크 엔드포인트 |
| 브라우저 지원 | 최신 2개 버전의 Chrome, Edge, Firefox, Safari |
| 웹 성능 | 초기 로드 리소스(HTML+CSS+JS) 합계 200KB 이하, 첫 화면 표시 1초 이내 |
| 접근성 | 시맨틱 HTML, 키보드만으로 모든 기능 사용 가능, WCAG 2.1 AA 색 대비 |

---

## 6. 시스템 아키텍처

### 6.1 기술 스택
| 영역 | 기술 |
|------|------|
| 언어/런타임 | Python 3.15, uv (패키지/가상환경 관리) |
| 웹 프레임워크 | FastAPI, Uvicorn (ASGI) |
| 데이터 검증 | Pydantic v2, pydantic-settings |
| ORM | SQLAlchemy 2.x (async) |
| DB 드라이버 | asyncmy (또는 aiomysql) |
| 마이그레이션 | Alembic |
| 데이터베이스 | MariaDB 11.x (InnoDB, utf8mb4) |
| 테스트 | pytest, pytest-asyncio, httpx |
| 프론트엔드 | HTML5, CSS3(CSS 변수·Flexbox·Grid), JavaScript(ES2022+, ES Modules) — 외부 라이브러리 없음 |
| 정적 파일 서빙 | FastAPI `StaticFiles` (API와 동일 출처) |
| 배포 | Docker, docker-compose (API + MariaDB) |

### 6.2 구성도
```
[Browser — HTML / CSS / Vanilla JS]
        │ HTTP (정적 파일 + /api/v1 JSON, 동일 출처, 127.0.0.1)
        ▼
┌──────────────────────────┐
│  FastAPI (Uvicorn)       │
│  ├─ static   (웹 프론트)  │
│  ├─ routers  (API 계층)   │
│  ├─ services (비즈니스)   │
│  ├─ repositories (DB접근) │
│  └─ schemas  (Pydantic)  │
└────────────┬─────────────┘
             │ SQLAlchemy async
             ▼
      ┌──────────────┐
      │  MariaDB 11  │
      └──────────────┘
```

### 6.3 디렉터리 구조 (안)
```
src/flow_tarsk/
├── main.py              # FastAPI 앱 생성, 라우터 등록
├── core/                # 설정, 예외 처리
├── db/                  # 엔진·세션, Base 모델
├── models/              # SQLAlchemy ORM 모델
├── schemas/             # Pydantic 요청/응답 스키마
├── repositories/        # DB 쿼리
├── services/            # 비즈니스 로직
├── api/v1/              # 라우터 (tasks, projects, tags, views)
└── static/              # 웹 프론트엔드 (빌드 과정 없음)
    ├── index.html       # SPA 진입점 (/app/* 경로 모두 이 파일로 응답)
    ├── css/
    │   ├── base.css     # 리셋, CSS 변수(라이트/다크 테마)
    │   └── app.css      # 레이아웃, 컴포넌트
    └── js/
        ├── main.js      # 앱 초기화, 라우터
        ├── api.js       # fetch 래퍼, 에러 처리
        ├── state.js     # 간단한 전역 상태 저장소
        ├── views/       # 화면별 렌더링 (today, project, stats ...)
        └── components/  # 재사용 UI (task-item, modal, toast ...)
alembic/                 # 마이그레이션
tests/
.env.example
docker-compose.yml
```

---

## 7. 데이터 모델 (MariaDB)

공통: 엔진 InnoDB, 문자셋 `utf8mb4` / `utf8mb4_unicode_ci`, 시각은 `DATETIME(6)` UTC.
1인 전용이므로 사용자 테이블과 `user_id` 컬럼은 두지 않는다.

### 7.1 ERD
```
projects 1 ──< tasks (0..1 project)
tasks    1 ──< tasks (parent_id, 하위 작업)
tasks   >──< tags  (task_tags)
```

### 7.2 테이블 정의

**projects**
| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| name | VARCHAR(50) | NOT NULL |
| color | CHAR(7) | DEFAULT '#808080' |
| is_archived | BOOLEAN | DEFAULT FALSE |
| sort_order | INT | DEFAULT 0 |
| created_at / updated_at | DATETIME(6) | NOT NULL |

**tasks**
| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| project_id | BIGINT UNSIGNED | FK → projects.id, ON DELETE SET NULL, NULL 허용 |
| parent_id | BIGINT UNSIGNED | FK → tasks.id, ON DELETE CASCADE, NULL 허용 |
| title | VARCHAR(200) | NOT NULL |
| description | TEXT | NULL |
| status | ENUM('TODO','IN_PROGRESS','DONE') | DEFAULT 'TODO' |
| priority | ENUM('NONE','LOW','MEDIUM','HIGH') | DEFAULT 'NONE' |
| due_at | DATETIME(6) | NULL |
| completed_at | DATETIME(6) | NULL |
| sort_order | INT | DEFAULT 0 |
| recurrence_rule | VARCHAR(255) | NULL (P2, RRULE 형식) |
| deleted_at | DATETIME(6) | NULL (소프트 삭제) |
| created_at / updated_at | DATETIME(6) | NOT NULL |

인덱스:
- `idx_tasks_status_due (status, due_at)` — 스마트 뷰 조회
- `idx_tasks_project (project_id)`
- `idx_tasks_parent (parent_id)`
- `FULLTEXT ft_tasks_title_desc (title, description)` — 검색 (한국어는 ngram 파서 사용 검토)

**tags**
| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| name | VARCHAR(30) | NOT NULL, UNIQUE |
| color | CHAR(7) | NULL |

**task_tags**
| 컬럼 | 타입 | 제약 |
|------|------|------|
| task_id | BIGINT UNSIGNED | PK, FK → tasks.id, ON DELETE CASCADE |
| tag_id | BIGINT UNSIGNED | PK, FK → tags.id, ON DELETE CASCADE |

---

## 8. API 명세 (v1)

Base URL: `/api/v1` · 인증 없음 (로컬 전용, 5장 보안 항목 참고)

### 8.1 할 일
| Method | Path | 설명 |
|--------|------|------|
| GET | `/tasks` | 목록 (쿼리: `status`, `priority`, `project_id`, `tag`, `due_from`, `due_to`, `q`, `sort`, `page`, `size`) |
| POST | `/tasks` | 생성 |
| GET | `/tasks/{id}` | 단건 조회 (하위 작업 포함) |
| PATCH | `/tasks/{id}` | 부분 수정 |
| DELETE | `/tasks/{id}` | 삭제 |
| POST | `/tasks/{id}/complete` | 완료 처리 |
| POST | `/tasks/{id}/reopen` | 완료 취소 |
| POST | `/tasks/{id}/subtasks` | 하위 작업 추가 |
| PATCH | `/tasks/reorder` | 수동 정렬 순서 일괄 변경 |

### 8.2 스마트 뷰
| Method | Path | 설명 |
|--------|------|------|
| GET | `/views/today` | 오늘 할 일 |
| GET | `/views/upcoming` | 다가오는 7일 |
| GET | `/views/overdue` | 지연된 할 일 |
| GET | `/views/inbox` | 받은함 |

### 8.3 프로젝트 / 태그
| Method | Path | 설명 |
|--------|------|------|
| GET / POST | `/projects` | 목록 / 생성 |
| GET / PATCH / DELETE | `/projects/{id}` | 조회 / 수정 / 삭제 |
| GET / POST | `/tags` | 목록 / 생성 |
| PATCH / DELETE | `/tags/{id}` | 수정 / 삭제 |

### 8.4 기타
| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 헬스체크 (DB 연결 포함) |

### 8.5 요청/응답 예시
```http
POST /api/v1/tasks
Content-Type: application/json

{
  "title": "PRD 리뷰하기",
  "description": "API 명세 위주로 확인",
  "priority": "HIGH",
  "due_at": "2026-10-15T09:00:00Z",
  "project_id": 3,
  "tags": ["업무", "문서"]
}
```
```json
201 Created
{
  "id": 42,
  "title": "PRD 리뷰하기",
  "description": "API 명세 위주로 확인",
  "status": "TODO",
  "priority": "HIGH",
  "due_at": "2026-10-15T09:00:00Z",
  "completed_at": null,
  "project": { "id": 3, "name": "Task Flow", "color": "#4F46E5" },
  "tags": [{ "id": 1, "name": "업무" }, { "id": 5, "name": "문서" }],
  "subtasks_progress": { "done": 0, "total": 0 },
  "created_at": "2026-10-13T05:12:00Z",
  "updated_at": "2026-10-13T05:12:00Z"
}
```

목록 응답 공통 형식:
```json
{ "items": [ ... ], "page": 1, "size": 20, "total": 134 }
```

### 8.6 에러 응답 형식
```json
{ "error": { "code": "TASK_NOT_FOUND", "message": "할 일을 찾을 수 없습니다." } }
```
| HTTP | 사용 예 |
|------|---------|
| 400 | 잘못된 요청 (예: 하위 작업에 하위 작업 추가) |
| 404 | 리소스 없음 |
| 409 | 태그명 중복 |
| 422 | 입력 검증 실패 (FastAPI 기본) |

---

## 9. 마일스톤

| 단계 | 기간(안) | 범위 |
|------|----------|------|
| M0. 기반 구축 | 1주 | 프로젝트 구조, docker-compose(MariaDB), 설정(.env), Alembic, CI(ruff·mypy·pytest) |
| M1. MVP | 2주 | API: 할 일 CRUD, 완료/취소, 스마트 뷰 · 웹: 메인 목록, 빠른 추가, 상세 패널 (P0 전체) |
| M2. v1 | 3주 | API·웹: 프로젝트, 태그, 하위 작업, 검색, 정렬, 반응형·단축키·다크 모드 (P1 전체) |
| M3. 확장 | 2주 | 반복 할 일, 통계 (P2) |

---

## 10. 성공 지표

| 지표 | 목표 |
|------|------|
| 할 일 생성 API p95 응답시간 | 200ms 이하 |
| 할 일 등록 소요 시간 (빠른 추가) | 3초 이내 |
| 등록된 할 일 대비 완료율 | 50% 이상 |
| 테스트 커버리지 | 80% 이상 |
| 다른 할 일 앱 없이 4주 연속 사용 | 달성 |

---

## 11. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 인증이 없어 외부 노출 시 누구나 접근 가능 | 높음 | 기본 `127.0.0.1` 바인딩, docker-compose 포트도 `127.0.0.1:8000:8000`으로 노출, 원격 접속은 VPN/리버스 프록시 접근 제어로만 |
| 타임존 처리 오류로 스마트 뷰 오동작 | 높음 | UTC 저장 원칙, `APP_TIMEZONE` 기반 경계 계산 로직 단위 테스트 |
| 데이터 유실 | 높음 | 일 1회 자동 백업, 복원 절차 README에 문서화 |
| 한국어 FULLTEXT 검색 품질 저하 | 중간 | MariaDB ngram 파서 또는 `LIKE` 폴백 |
| async 드라이버 호환성 문제 | 중간 | asyncmy/aiomysql 초기 검증, 필요 시 동기 드라이버(PyMySQL) + 스레드풀 대안 |
| Python 3.15 라이브러리 호환성 | 중간 | M0 단계에서 핵심 의존성 설치·동작 검증, 필요 시 3.13/3.14로 조정 |

---

## 12. 결정 사항

| 이슈 | 결정 |
|------|------|
| 사용자 / 인증 | **1인 전용. 회원가입·로그인 없음.** 사용자 테이블·토큰 없음, 로컬 바인딩으로 접근 제한 |
| 웹 프론트엔드 포함 여부 | **포함.** HTML·CSS·JavaScript만 사용 (프레임워크·빌드 도구 없음), FastAPI가 정적 파일로 서빙 |
| 소셜 로그인 | **해당 없음** (인증 기능 자체가 없음) |
| 알림 (이메일/푸시) | **지원하지 않음** |
| 프로젝트 삭제 시 동작 | **소속 할 일을 받은함으로 이동** (함께 삭제 옵션 없음) |
| 타임존 | 사용자 설정 화면 대신 환경 변수 `APP_TIMEZONE`으로 지정 (기본 `Asia/Seoul`) |

### 12.1 남은 오픈 이슈
- 없음
