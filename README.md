# VisionCount Dashboard – People Analytics Platform

VisionCount is a high-performance web dashboard that provides three core capabilities from camera video:
1. **People IN / OUT count** (Live occupancy tracking and line-crossing direction)
2. **Age estimation** (Categorized into Child, Teen, Young Adult, Adult, Senior)
3. **Gender estimation** (Male, Female, Unknown)

---

## 🎨 Design & Branding
- **Branding**: Camsense AI theme with official logos (`/images/` and `/logo/`)
- **Typography**: Inter font (`/fonts/inter.woff2`)
- **Design Philosophy**: Modern, accessible (WCAG 2.2 AA compliant), responsive data tables with sticky headers, Recharts data visualizers, and zero face image storage (Strict Privacy Principle).

---

## 🏗️ Architecture & Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts, Lucide Icons
- **Backend**: FastAPI, Python 3.12, Uvicorn (single-worker process for thread-safe camera tracking)
- **Database**: MySQL 8 (InnoDB, utf8mb4)
- **Computer Vision**:
  - **YOLOv8 + ByteTrack**: Accurate person detection and tracking (`yolov8n.pt`)
  - **InsightFace**: Facial feature extraction for Age & Gender estimation (`buffalo_s`)
  - **Memory-Only Processing**: Bounding boxes and face crops are evaluated in memory and discarded immediately. No video frames or face images are ever stored.

---

## 🚀 Quick Setup (Single Command)

To set up everything (creates `backend/.venv`, installs requirements, configures MySQL database `visioncount`, creates tables, seeds users, downloads AI models, and builds the frontend) run:

```bash
chmod +x setup.sh start.sh
./setup.sh
```

To run setup and immediately start both the backend and frontend servers:

```bash
./setup.sh --start
```

Or start both servers anytime:

```bash
./start.sh
```

### Manual Virtual Environment Activation
If you prefer running manual commands in the backend virtual environment:

```bash
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

---

## 🔑 Default Seeded Accounts
| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| **Admin** | `admin@camsense.ai` | `admin123` | Full dashboard, Camera CRUD, counting line drawing, User management, CSV export |
| **Viewer** | `viewer@camsense.ai` | `viewer123` | Dashboard monitoring, Event log view, CSV export |

---

## 🌐 Endpoints & Ports
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🧪 Running Tests

Run the backend unit tests (FastAPI endpoints, authentication, line-crossing math, and demographic classifiers):

```bash
PYTHONPATH=. pytest backend/tests
```

---

## 🐳 Docker Deployment

The entire system can also be launched with Docker Compose:

```bash
docker compose up --build
```
