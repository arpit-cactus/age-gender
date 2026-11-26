# 02 PRD (Product Requirements Document)

## 1. Overview
VisionCount Dashboard turns camera video into three simple insights: people IN/OUT count, age group, and gender. Results are shown on a web dashboard.

## 2. Users and Roles
| Role | Permissions |
|------|-------------|
| Admin | Login, add/edit/delete cameras, set counting line, manage users, view dashboard, export CSV |
| Viewer | Login, view dashboard, export CSV |

## 3. Features

### F1. Authentication
- Login with email + password. JWT token.
- Two roles: admin, viewer.

### F2. Camera Management (Admin)
- Add camera: name, source (RTSP URL, video file path, or webcam index), direction setting.
- Draw/set a **counting line** (two points) on a preview frame. Crossing one way = IN, other way = OUT.
- Start / Stop processing per camera.
- Show camera status: running, stopped, error.

### F3. People IN / OUT Count
- Detect and track each person.
- When a tracked person crosses the line: save one IN or OUT event.
- Show: Total IN today, Total OUT today, **Currently inside = IN − OUT** (never below 0).

### F4. Age Estimation
- For each IN event, estimate age and put it into an age group:
  `0-12`, `13-19`, `20-35`, `36-50`, `51+`
- Also keep the estimated age number.

### F5. Gender Estimation
- For each IN event, estimate: `male`, `female`, or `unknown` (if face not clear).

### F6. Dashboard
- KPI cards: Total IN, Total OUT, Inside Now, Average Age.
- Line chart: IN vs OUT per hour (or per day).
- Bar chart: age groups.
- Donut chart: gender split.
- Table: latest 20 events.
- Filters: camera, date range (Today, Yesterday, Last 7 days, Custom).
- Auto refresh every 5 seconds for "Today".

### F7. Export
- Download events as CSV for the selected filters.

## 4. User Stories
1. As an admin, I add a camera and draw a line so counting starts.
2. As a viewer, I open the dashboard and see how many people are inside now.
3. As a manager, I check which age group and gender visits most in the last 7 days.
4. As a manager, I export a CSV for a report.

## 5. Acceptance Criteria
| Feature | Criteria |
|---------|----------|
| Count | A person crossing the line once creates exactly one event. |
| Inside Now | Equals today's IN minus OUT, minimum 0. |
| Age/Gender | Every IN event has a gender value and an age group (or `unknown`). |
| Dashboard | Loads in under 3 seconds for 7 days of data. |
| Filters | Charts and table change when camera/date filter changes. |
| Privacy | No image or video frame is written to database or disk. |

## 6. Non-Functional Requirements
- Process at least 10 FPS per camera on a normal PC (GPU optional, CPU supported with lower FPS).
- Support 1–4 cameras.
- Works in Chrome, Edge, Firefox (latest).
- Responsive for desktop and tablet.

## 7. Out of Scope
Face recognition, alerts, heatmaps, mobile app, cloud multi-tenant.

## 8. Milestones
| Phase | Deliverable |
|-------|-------------|
| 1 | DB + FastAPI auth + camera CRUD |
| 2 | Detection, tracking, IN/OUT counting |
| 3 | Age + gender estimation |
| 4 | Next.js dashboard + charts |
| 5 | Export, testing, Docker, docs |
