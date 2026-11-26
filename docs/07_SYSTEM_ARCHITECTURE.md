# 07 SYSTEM ARCHITECTURE

## 1. Principle
**Simple monolith.** Three parts only: Next.js, FastAPI, MySQL. No Redis, no message queue, no workers cluster.

## 2. Diagram
```
 ┌──────────────┐
 │ Camera (RTSP │
 │ /file/webcam)│
 └──────┬───────┘
        │ video frames
        ▼
 ┌──────────────────────────────────────────┐
 │               FastAPI (Python)           │
 │                                          │
 │  ┌─────────────┐      ┌───────────────┐  │
 │  │ REST API    │      │ Camera Worker │  │
 │  │ auth, stats │      │ (1 thread per │  │
 │  │ cameras,    │      │  camera)      │  │
 │  │ events      │      │ YOLO + track  │  │
 │  └──────┬──────┘      │ line counting │  │
 │         │             │ InsightFace   │  │
 │         │             │ age + gender  │  │
 │         │             └──────┬────────┘  │
 └─────────┼────────────────────┼───────────┘
           │ SQLAlchemy         │ insert events
           ▼                    ▼
        ┌────────────────────────────┐
        │          MySQL 8           │
        └────────────────────────────┘
           ▲
           │ REST (JSON) every 5 s
 ┌─────────┴──────────┐
 │  Next.js Dashboard │ ◄── Browser (user)
 └────────────────────┘
```

## 3. Components
| Component | Responsibility |
|-----------|----------------|
| Next.js | UI, login pages, charts, calls REST API |
| FastAPI REST | Auth, camera CRUD, stats queries, CSV export |
| Camera Worker | Background thread: read frames, detect, track, count, estimate age/gender, save event |
| MySQL | Stores users, cameras, count events |

## 4. Folder Structure
```
visioncount/
├── docker-compose.yml
├── .env
├── docs/                      # these 8 documents
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, startup
│   │   ├── config.py          # env settings
│   │   ├── database.py        # engine, session
│   │   ├── models.py          # SQLAlchemy models
│   │   ├── schemas.py         # Pydantic schemas
│   │   ├── security.py        # JWT, hashing
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── cameras.py
│   │   │   ├── stats.py
│   │   │   ├── events.py
│   │   │   └── users.py
│   │   ├── services/
│   │   │   ├── stats_service.py
│   │   │   └── camera_manager.py   # start/stop workers
│   │   └── vision/
│   │       ├── worker.py           # per-camera loop
│   │       ├── detector.py         # YOLO + tracker
│   │       ├── counter.py          # line crossing logic
│   │       └── face_analyzer.py    # InsightFace age/gender
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── login/page.tsx
    │   ├── dashboard/page.tsx
    │   ├── events/page.tsx
    │   ├── cameras/page.tsx
    │   ├── cameras/[id]/page.tsx
    │   └── users/page.tsx
    ├── components/            # KpiCard, charts, tables, LineEditor
    ├── lib/api.ts             # fetch wrapper with token
    └── package.json
```

## 5. Data Flow Summary
1. Admin adds camera and starts it → `camera_manager` spawns a thread.
2. Thread loops: frame → detect/track → line check → (IN) age/gender → insert row.
3. Browser asks API for stats every 5 s → API runs SQL aggregates on MySQL → returns JSON → charts update.

## 6. Deployment (Docker Compose)
| Service | Image | Port |
|---------|-------|------|
| web | Next.js (node:20) | 3000 |
| api | FastAPI (python:3.11-slim) | 8000 |
| db | mysql:8 | 3306 (internal) |

- Run API with **one Uvicorn worker** so camera threads are not duplicated.
- On restart, cameras marked `running` are started again automatically.
- GPU is optional; CPU works with lower FPS.

## 7. Scaling Notes (later, only if needed)
- More than ~4 cameras → move the Camera Worker into its own container (same code, same MySQL).
- Slow stats → add a daily summary table. Still no Redis needed.

## 8. Reliability
- Stream lost → worker marks camera `error` and retries every 10 s.
- DB insert fails → log error, keep processing.
- Graceful shutdown: stop threads, release cameras.

## 9. Logging
Python `logging` to console (JSON optional). Log camera start/stop, errors, and counts per minute.
