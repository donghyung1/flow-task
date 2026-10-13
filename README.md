# Task Flow

**나 한 사람만 쓰는** 할 일 관리 앱입니다. 할 일을 **등록 → 정리 → 실행 → 완료**의 흐름(Flow)으로 관리하며, 로그인 없이 브라우저를 열면 바로 사용할 수 있습니다.

- 기술 스택: Python 3.15 · FastAPI · MariaDB 11 · SQLAlchemy(async) · Alembic · uv · HTML/CSS/Vanilla JS
- 제품 요구사항: [docs/PRD.md](docs/PRD.md)
- API 계약: [docs/API_CONTRACT.md](docs/API_CONTRACT.md)

## 주요 기능

- 빠른 추가: 제목만 입력해 즉시 할 일 등록 (`N` 키)
- 마감일·우선순위(NONE/LOW/MEDIUM/HIGH)·메모·상태(TODO/IN_PROGRESS/DONE) 지정
- 스마트 뷰: 오늘 / 다가오는 일(7일) / 지연됨 / 받은함 (`APP_TIMEZONE` 기준)
- 프로젝트·태그 분류, 하위 작업(1단계) 및 진행률
- 제목·메모 키워드 검색 (`/`)
- 소프트 삭제 후 30일 뒤 영구 삭제
- 키보드 단축키: `N`(새 할 일), `/`(검색), `Esc`(패널 닫기)
- 다크 테마 (숯색 배경 + 빨강 강조)

## 빠른 시작

요구사항: [uv](https://docs.astral.sh/uv/), MariaDB 11 (로컬 설치 또는 기존 서버)

### 1. 의존성 설치

```bash
uv sync
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

`.env`에서 `DATABASE_URL`을 실제 MariaDB 접속 정보로 수정합니다. 아래 [환경 변수](#환경-변수) 표를 참고하세요.

### 3. DB 마이그레이션

```bash
uv run alembic upgrade head
```

### 4. 서버 실행

```bash
uv run flow-tarsk
```

브라우저에서 <http://127.0.0.1:8000/app/today> 를 엽니다.

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DATABASE_URL` | (필수) | SQLAlchemy 비동기 URL. 예: `mysql+aiomysql://taskflow:비밀번호@127.0.0.1:3306/taskflow` |
| `APP_TIMEZONE` | `Asia/Seoul` | 스마트 뷰(오늘/다가오는 일/지연됨) 경계 계산에 쓰는 타임존. DB에는 UTC로 저장 |
| `HOST` | `127.0.0.1` | 바인딩 주소. 로컬 전용이 기본값이며 외부 노출 시 주의 (아래 보안 항목 참고) |
| `PORT` | `8000` | 서버 포트 |

설정 파일은 `.env`로 관리하며 저장소에 커밋하지 않습니다 (`.gitignore`에 포함).

## 보안

- 이 앱에는 **인증이 없습니다.** 누구든 접근하면 모든 데이터를 보고 수정할 수 있습니다.
- 기본 바인딩은 `127.0.0.1`(로컬 전용)입니다. `HOST`를 `0.0.0.0` 등으로 바꾸면 같은 네트워크의 누구나 접근할 수 있으니 권장하지 않습니다.
- 다른 기기에서 접속하려면 **VPN(예: Tailscale)** 또는 **접근 제어가 걸린 리버스 프록시** 뒤에 두세요. 공인 인터넷에 직접 노출하지 마세요.

## 개발 명령어

```bash
uv run ruff check .                # 린트
uv run ruff format .               # 포맷
uv run mypy src                    # 타입 검사
```

### E2E 테스트

서버를 먼저 실행한 뒤(`uv run flow-tarsk`) 실행합니다. 다른 주소는 `BASE_URL`로 지정합니다.

```bash
cd e2e && npm ci && npx playwright install chromium && npx playwright test
```

## API 문서

서버 실행 후:

- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>
- 헬스체크: `GET /health` (DB 연결 포함)

## 백업 및 복원

일 1회 `mariadb-dump`로 백업하고, 백업은 `backups/` 디렉터리에 `taskflow-YYYYmmdd-HHMMSS.sql.gz` 형식으로 저장됩니다. 기본 14일이 지난 파일은 자동 삭제됩니다.

### 백업 실행

`mariadb-dump` 클라이언트가 필요합니다 (`mariadb-client` 패키지 등).

```bash
DB_PASSWORD='비밀번호' scripts/backup.sh
```

| 변수 | 기본값 |
|------|--------|
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | `3306` |
| `DB_USER` | `taskflow` |
| `DB_NAME` | `taskflow` |
| `DB_PASSWORD` | (필수) |
| `RETENTION_DAYS` | `14` |

### 매일 자동 백업 (cron)

`crontab -e`에 아래 줄을 추가합니다. 비밀번호는 crontab에 직접 쓰지 말고 환경 파일에서 읽는 방식을 권장합니다.

```cron
30 3 * * * cd /절대경로/flow-tarsk && DB_PASSWORD="$(cat $HOME/.config/flow-tarsk/db_password)" scripts/backup.sh >> /tmp/flow-tarsk-backup.log 2>&1
```

### 복원

```bash
DB_PASSWORD='비밀번호' scripts/restore.sh backups/taskflow-20261013-033000.sql.gz
```

- 대상 DB의 기존 데이터가 **덮어써집니다.** 실행 전 확인 프롬프트에서 `yes`를 입력해야 진행됩니다.
- 복원 전에 gzip 무결성을 검사합니다.
- 복원 후에는 서버를 재시작하는 것을 권장합니다.

## 소프트 삭제 데이터 영구 삭제

삭제된 할 일은 30일 동안 소프트 삭제 상태로 남고, 이후 `flow-tarsk-purge` 명령으로 영구 삭제합니다.

```bash
uv run flow-tarsk-purge
```

주기적으로 실행하려면 cron에 등록하세요 (예: 매일 새벽 4시):

```cron
0 4 * * * cd /절대경로/flow-tarsk && uv run flow-tarsk-purge >> /tmp/flow-tarsk-purge.log 2>&1
```

## 키보드 단축키

| 키 | 동작 |
|----|------|
| `N` | 새 할 일 입력 |
| `/` | 검색 |
| `Esc` | 상세 패널 닫기 |

## 프로젝트 구조

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
docs/                    # PRD, API 계약
scripts/                 # backup.sh, restore.sh
```
