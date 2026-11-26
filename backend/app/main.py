import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine, Base, SessionLocal
from .models import User
from .routers import auth, cameras, stats, events, users, settings as settings_router
from .services.camera_manager import camera_manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables created
    Base.metadata.create_all(bind=engine)
    
    # Resume active camera workers
    db = SessionLocal()
    try:
        camera_manager.start_active_cameras(db)
    except Exception as e:
        print(f"Error resuming active cameras on startup: {e}")
    finally:
        db.close()

    yield

    # Shutdown: gracefully terminate all camera threads
    print("Shutting down camera workers...")
    camera_manager.stop_all()

app = FastAPI(
    title="VisionCount People Analytics API",
    version="1.0.0",
    description="Backend API for people IN/OUT count, age estimation, and gender estimation",
    lifespan=lifespan
)

# CORS setup — includes both the local dev origin and the FRP public URL
origins = [
    settings.FRONTEND_ORIGIN,
    settings.PUBLIC_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://general.cactusxpo.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 Routers
API_V1_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_V1_PREFIX)
app.include_router(cameras.router, prefix=API_V1_PREFIX)
app.include_router(stats.router, prefix=API_V1_PREFIX)
app.include_router(events.router, prefix=API_V1_PREFIX)
app.include_router(users.router, prefix=API_V1_PREFIX)
app.include_router(settings_router.router, prefix=API_V1_PREFIX)

@app.get("/")
def root():
    return {
        "service": "VisionCount Dashboard API",
        "status": "healthy",
        "capabilities": [
            "People IN/OUT Count",
            "Age Estimation",
            "Gender Estimation"
        ],
        "api_docs": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "ok"}
