# 08 STRICT RULES

These rules are mandatory for everyone (developers and AI coding assistants) working on this project.

## A. Scope Rules
1. Build **only** the 3 capabilities: IN/OUT count, age estimation, gender estimation.
2. Do **not** add features not listed in the PRD without written approval.
3. Do **not** add Redis, Celery, Kafka, RabbitMQ, GraphQL, microservices, or Kubernetes.
4. Do **not** change the stack: Next.js + FastAPI + MySQL.

## B. Privacy Rules
1. **Never** save face images, person crops, or video frames to disk or database.
2. **Never** implement face recognition or person identification.
3. Store only: direction, time, camera, estimated age, age group, gender.
4. Dashboard must show note: "Age and gender are AI estimates."
5. Never log passwords, tokens, or full RTSP URLs with credentials.

## C. Backend Rules (FastAPI)
1. Use Python 3.11, type hints everywhere, Pydantic for all input/output.
2. Routers stay thin; business logic goes in `services/` and `vision/`.
3. All endpoints under `/api/v1`. Protected by JWT except `/auth/login`.
4. Admin-only endpoints must check role on the server.
5. Use SQLAlchemy ORM / parameterized queries only. No string-built SQL.
6. DB changes only through Alembic migrations.
7. Store all datetimes in UTC; convert on the frontend.
8. Run **one** Uvicorn worker (camera threads must not duplicate).
9. Vision code must never block API requests (run in threads).
10. Return consistent errors: `{"detail": "message"}` with correct HTTP codes.

## D. Counting Rules
1. One line crossing = exactly one event.
2. Same `track_id` cannot create another event within the cooldown (default 10 s).
3. Inside Now = max(IN − OUT, 0).
4. Age/gender are estimated only for IN events and use up to 5 face samples (median age, majority gender).
5. If face is unclear or confidence is below 0.5 → `unknown`.
6. Age groups are fixed: child 0–12, teen 13–19, young_adult 20–35, adult 36–50, senior 51+.

## E. Frontend Rules (Next.js)
1. TypeScript strict mode. No `any`.
2. App Router, Tailwind CSS, Recharts for charts.
3. All API calls go through `lib/api.ts`. No fetch calls scattered in components.
4. Every data widget must have: loading state, empty state, error state.
5. Use the colors defined in the UI/UX brief (IN green, OUT red, etc.).
6. Poll every 5 s only for "Today"; never poll on other date ranges.
7. Do not store tokens in localStorage; use httpOnly cookie.
8.dont use emoji eny where

## F. Database Rules
1. Table and column names are `snake_case`.
2. Do not change the schema in `06_BACKEND_SCHEMAS.md` without updating that doc.
3. Keep the listed indexes. Add new ones only with proof of slow query.
4. Delete events older than 12 months with the retention script.

## G. Code Quality Rules
1. Format: Black + Ruff (Python), ESLint + Prettier (TypeScript).
2. Names must be clear; functions do one thing and stay short.
3. No dead code, no commented-out code, no hardcoded secrets.
4. All secrets in `.env`; provide `.env.example`.
5. Write tests for counting logic and for each API router.
6. Every pull request must pass lint and tests.

## H. Git Rules
1. Branches: `main`, `feature/<name>`, `fix/<name>`.
2. Commit format: `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`.
3. No direct commits to `main`.

## I. Documentation Rules
1. If code and docs differ, **update the docs in the same change**.
2. README must explain: setup, `.env`, run with Docker, run tests, add a camera.

## J. Definition of Done
- Feature works end-to-end (camera → DB → dashboard).
- Tests pass, lint passes.
- Docs updated.
- No rule in this file is broken.

## K. Instruction for AI Coding Assistants
Read docs `01` to `08` fully before writing code. Follow them exactly. If a request conflicts with these rules, stop and ask instead of guessing.
