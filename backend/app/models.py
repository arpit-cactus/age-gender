from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Float, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum("admin", "viewer", name="user_roles"), nullable=False, default="viewer")
    is_active = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    source = Column(String(500), nullable=False)
    line_x1 = Column(Float, nullable=True)
    line_y1 = Column(Float, nullable=True)
    line_x2 = Column(Float, nullable=True)
    line_y2 = Column(Float, nullable=True)
    lines_json = Column(Text, nullable=True)
    roi_x1 = Column(Float, nullable=True)
    roi_y1 = Column(Float, nullable=True)
    roi_x2 = Column(Float, nullable=True)
    roi_y2 = Column(Float, nullable=True)
    in_direction = Column(Enum("left", "right", name="camera_in_directions"), nullable=False, default="right")
    status = Column(Enum("stopped", "running", "error", name="camera_statuses"), nullable=False, default="stopped")
    last_error = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    events = relationship("CountEvent", back_populates="camera", cascade="all, delete-orphan")


class CountEvent(Base):
    __tablename__ = "count_events"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    camera_id = Column(Integer, ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False, index=True)
    direction = Column(Enum("in", "out", name="event_directions"), nullable=False, index=True)
    track_id = Column(Integer, nullable=False)
    line_id = Column(String(50), nullable=True, index=True)
    line_name = Column(String(100), nullable=True)
    age = Column(Integer, nullable=True)
    age_group = Column(
        Enum("child", "teen", "young_adult", "adult", "senior", "unknown", name="age_groups"),
        nullable=False,
        default="unknown"
    )
    gender = Column(Enum("male", "female", "unknown", name="gender_types"), nullable=False, default="unknown")
    confidence = Column(Float, nullable=True)
    event_time = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    camera = relationship("Camera", back_populates="events")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    setting_key = Column(String(100), primary_key=True, index=True)
    setting_value = Column(String(500), nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
