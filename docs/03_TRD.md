# 03 TRD (Technical Requirements Document)

## 1. Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS, Recharts |
| Backend | FastAPI, Python 3.11, Uvicorn |
| ORM / Migrations | SQLAlchemy 2.x + Alembic |
| Database | MySQL 8 |
| Computer Vision | OpenCV, Ultralytics YOLO (person detection + tracking), InsightFace (face + age + gender) |
| Auth | JWT (python-jose), passlib bcrypt |
| Deploy | Docker Compose (3 containers: web, api, mysql) |

> No Redis, no queue, no cache server. Keep it simple.

## 2. Why These Choices
- **YOLO + built-in tracker (ByteTrack):** gives a stable ID per person, needed for line crossing.
- **InsightFace:** one model returns face, age, and gender together. Fast enough on CPU.
- **Python thread for video:** no queue needed; each camera runs in one background thread inside the FastAPI process.
- **Polling:** dashboard calls REST every 5 seconds. No WebSocket needed.

## 3. Counting Logic
1. Read frame from camera (skip frames to stay near 10 FPS).
2. YOLO detects `person` and tracks them → `track_id`, bounding box.
3. For each track, keep last center point.
4. If the center point moves across the counting line, direction decides IN or OUT.
5. Each `track_id` can only trigger one crossing per 10 seconds (anti-double-count).
6. On IN event: crop the upper body/face region of that person, run InsightFace, get `age` and `gender`.
7. Save event to MySQL. **Discard the crop immediately (memory only).**
8. To improve accuracy: collect up to 5 face estimates while the person approaches the line, use the median age and majority gender.

## 4. Age Groups
| Group | Range |
|-------|-------|
| child | 0–12 |
| teen | 13–19 |
| young_adult | 20–35 |
| adult | 36–50 |
| senior | 51+ |

## 5. API Design (REST, JSON, prefix `/api/v1`)
| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| POST | /auth/login | public | Get JWT |
| GET | /auth/me | any | Current user |
| GET | /cameras | any | List cameras |
| POST | /cameras | admin | Add camera |
| PUT | /cameras/{id} | admin | Update camera / line |
| DELETE | /cameras/{id} | admin | Delete camera |
| POST | /cameras/{id}/start | admin | Start processing |
| POST | /cameras/{id}/stop | admin | Stop processing |
| GET | /cameras/{id}/snapshot | admin | One preview frame (JPEG) for drawing the line |
| GET | /stats/summary | any | KPI numbers |
| GET | /stats/traffic | any | IN/OUT per hour or day |
| GET | /stats/age | any | Age group counts |
| GET | /stats/gender | any | Gender counts |
| GET | /events | any | Paginated event list |
| GET | /events/export | any | CSV download |
| GET | /users, POST /users | admin | Manage users |

Common query params: `camera_id`, `from`, `to`, `interval` (hour/day).

## 6. Performance Targets
- API response under 500 ms for 7-day queries (indexed columns).
- Each camera thread uses at most one CPU-heavy model pass per frame; face model runs **only at IN events**, not every frame.

## 7. Security
- Passwords hashed with bcrypt.
- JWT expires in 8 hours.
- CORS only allows the frontend origin.
- RTSP passwords stored in `.env`/encrypted column, never returned by API.
- All inputs validated with Pydantic.

## 8. Configuration (`.env`)
```
DATABASE_URL=mysql+pymysql://user:pass@db:3306/visioncount
JWT_SECRET=change_me
JWT_EXPIRE_MINUTES=480
FRONTEND_ORIGIN=http://localhost:3000
PROCESS_FPS=10
DOUBLE_COUNT_COOLDOWN_SEC=10
```

## 9. Testing
- Backend: pytest for APIs and counting logic (use a sample video file).
- Frontend: basic component tests + manual QA checklist.
- Accuracy test: manual count of a 5-minute video vs system count.

## 10. Known Limits
- Age estimation is approximate (±5–8 years typical).
- Poor light, masks, or side-view faces reduce accuracy → saved as `unknown`.
