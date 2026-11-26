from datetime import datetime
from typing import Optional, Literal, List
from pydantic import BaseModel, EmailStr, ConfigDict

# Auth schemas
class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    name: str
    email: str
    role: str

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    role: str
    is_active: int
    created_at: datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["admin", "viewer"] = "viewer"

# Camera schemas
class CameraIn(BaseModel):
    name: str
    source: str
    line_x1: Optional[float] = None
    line_y1: Optional[float] = None
    line_x2: Optional[float] = None
    line_y2: Optional[float] = None
    lines_json: Optional[str] = None
    roi_x1: Optional[float] = None
    roi_y1: Optional[float] = None
    roi_x2: Optional[float] = None
    roi_y2: Optional[float] = None
    in_direction: Literal["left", "right"] = "right"

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    source: Optional[str] = None
    line_x1: Optional[float] = None
    line_y1: Optional[float] = None
    line_x2: Optional[float] = None
    line_y2: Optional[float] = None
    lines_json: Optional[str] = None
    roi_x1: Optional[float] = None
    roi_y1: Optional[float] = None
    roi_x2: Optional[float] = None
    roi_y2: Optional[float] = None
    in_direction: Optional[Literal["left", "right"]] = None

class CameraOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    source: str
    line_x1: Optional[float] = None
    line_y1: Optional[float] = None
    line_x2: Optional[float] = None
    line_y2: Optional[float] = None
    lines_json: Optional[str] = None
    roi_x1: Optional[float] = None
    roi_y1: Optional[float] = None
    roi_x2: Optional[float] = None
    roi_y2: Optional[float] = None
    in_direction: Literal["left", "right"]
    status: Literal["stopped", "running", "error"]
    last_error: Optional[str] = None
    created_at: datetime

# Event schemas
class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    camera_id: int
    camera_name: Optional[str] = None
    line_id: Optional[str] = None
    line_name: Optional[str] = None
    direction: Literal["in", "out"]
    track_id: int
    age: Optional[int] = None
    age_group: str
    gender: str
    confidence: Optional[float] = None
    event_time: datetime

class PaginatedEvents(BaseModel):
    items: List[EventOut]
    total: int
    page: int
    limit: int
    total_pages: int

# Stats schemas
class SummaryOut(BaseModel):
    total_in: int
    total_out: int
    inside_now: int
    avg_age: Optional[float] = None
    delta_in_pct: Optional[float] = None
    delta_out_pct: Optional[float] = None
    delta_inside_pct: Optional[float] = None
    delta_avg_age_pct: Optional[float] = None
    prev_total_in: Optional[int] = None
    prev_total_out: Optional[int] = None
    prev_inside_now: Optional[int] = None

class TrafficBucket(BaseModel):
    bucket: str
    ins: int
    outs: int

class AgeGroupStat(BaseModel):
    age_group: str
    count: int
    percentage: float

class GenderStat(BaseModel):
    gender: str
    count: int
    percentage: float

class DemographicMatrixCell(BaseModel):
    age_group: str
    gender: str
    count: int
    percentage: float

class DemographicMatrix(BaseModel):
    matrix: List[DemographicMatrixCell]
    total_in: int
    by_age: dict[str, int]
    by_gender: dict[str, int]

class HeatmapCell(BaseModel):
    day_of_week: int
    day_name: str
    hour: int
    ins: int
    outs: int
    total: int

class LineTrafficStat(BaseModel):
    line_id: str
    line_name: str
    ins: int
    outs: int
    total: int

# System Settings Schemas
class SystemSettingsModel(BaseModel):
    poll_interval_sec: int = 5
    process_fps: int = 10
    double_count_cooldown_sec: int = 10
    face_conf_threshold: float = 0.45
    person_conf_threshold: float = 0.35
    max_face_samples: int = 5
    face_model_name: str = "mivolo_v2"
    has_cuda: bool = False
    active_device: str = "cpu"
    cuda_device_name: Optional[str] = None

class SystemSettingsUpdate(BaseModel):
    poll_interval_sec: Optional[int] = None
    process_fps: Optional[int] = None
    double_count_cooldown_sec: Optional[int] = None
    face_conf_threshold: Optional[float] = None
    person_conf_threshold: Optional[float] = None
    max_face_samples: Optional[int] = None
    face_model_name: Optional[str] = None
