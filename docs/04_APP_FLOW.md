# 04 APP FLOW

## 1. Pages
| Route | Page | Access |
|-------|------|--------|
| /login | Login | Public |
| /dashboard | Main dashboard | Admin, Viewer |
| /events | Event history table + export | Admin, Viewer |
| /cameras | Camera list and control | Admin |
| /cameras/[id] | Camera settings + line drawing | Admin |
| /users | User management | Admin |

## 2. Main Navigation Flow
```
Login ──► Dashboard ──► Events
              │
              ├──► Cameras ──► Camera Detail (draw line, start/stop)
              └──► Users (admin only)
```

## 3. Flow A: Login
1. User opens site → redirected to `/login` if no token.
2. Enters email + password → `POST /auth/login`.
3. Success: token saved in httpOnly cookie → go to `/dashboard`.
4. Fail: show "Invalid email or password".

## 4. Flow B: Setup a Camera (Admin, first-time)
1. Go to **Cameras** → click **Add Camera**.
2. Enter name + source (RTSP URL / video file / webcam index) → Save.
3. Open camera detail → click **Load Preview** (`GET /snapshot`).
4. Click two points on the image to draw the **counting line**.
5. Choose which side is **IN**.
6. Save → click **Start**.
7. Status changes to `running`.

## 5. Flow C: Live Counting (backend, automatic)
```
Camera frame
   ↓
Detect + track people (YOLO)
   ↓
Crossed the line?  ── no ──► next frame
   │ yes
   ↓
Direction = IN or OUT
   ↓
If IN: estimate age + gender (InsightFace)
   ↓
Save event in MySQL (no image saved)
   ↓
Dashboard picks it up on next refresh
```

## 6. Flow D: View Dashboard
1. Open `/dashboard`. Default filter: **Today, All cameras**.
2. Page calls `/stats/summary`, `/stats/traffic`, `/stats/age`, `/stats/gender`, `/events?limit=20`.
3. Shows KPI cards, charts, latest events.
4. If filter is Today → auto refresh every 5 s.
5. Changing camera/date → all widgets reload.

## 7. Flow E: Export Report
1. Go to `/events` → set filters.
2. Click **Export CSV** → `GET /events/export` → file downloads.

## 8. Error and Empty States
| Situation | What user sees |
|-----------|----------------|
| No data in range | "No data for this period" with empty charts |
| Camera disconnected | Red badge `error` + message on Cameras page |
| API down | Banner "Cannot reach server. Retrying…" |
| Token expired | Redirect to login |
| Viewer opens admin page | "You do not have access" page |

## 9. Camera Status Lifecycle
`stopped` → (Start) → `running` → (Stop) → `stopped`
`running` → (stream lost) → `error` → (auto retry every 10 s) → `running`
