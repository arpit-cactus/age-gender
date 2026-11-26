import os
from pydantic import BaseModel

class Settings(BaseModel):
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://root:@127.0.0.1:3306/visioncount"
    )
    JWT_SECRET: str = os.getenv("JWT_SECRET", "camsense_visioncount_jwt_secret_key_2026")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))

    # Origins allowed for CORS.  Add the FRP public URL so the hosted
    # panel at http://general.cactusxpo.com/ can reach the API.
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
    PUBLIC_URL: str = os.getenv("PUBLIC_URL", "http://general.cactusxpo.com")

    PROCESS_FPS: int = int(os.getenv("PROCESS_FPS", "6"))
    DOUBLE_COUNT_COOLDOWN_SEC: int = int(os.getenv("DOUBLE_COUNT_COOLDOWN_SEC", "10"))

settings = Settings()
