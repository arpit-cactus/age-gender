from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import (
    SummaryOut,
    TrafficBucket,
    AgeGroupStat,
    GenderStat,
    DemographicMatrix,
    HeatmapCell,
    LineTrafficStat,
)
from ..security import get_current_user
from ..services import stats_service

router = APIRouter(prefix="/stats", tags=["stats"])

def _parse_time(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    s = dt_str.strip()
    # Handle unencoded '+' becoming ' ' in query params (e.g. 2026-11-26T10:00:00 00:00)
    if " " in s and "+" not in s:
        parts = s.rsplit(" ", 1)
        if len(parts) == 2 and ":" in parts[1]:
            s = f"{parts[0]}+{parts[1]}"
    try:
        # Handle trailing Z
        if s.endswith("Z") or s.endswith("z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is not None:
            # Convert to naive UTC datetime for MySQL comparison
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return None

@router.get("/summary", response_model=SummaryOut)
def get_summary(
    camera_id: Optional[int] = Query(None),
    line_id: Optional[str] = Query(None),
    from_time: Optional[str] = Query(None, alias="from"),
    to_time: Optional[str] = Query(None, alias="to"),
    compare: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return stats_service.get_summary(
        db,
        camera_id=camera_id,
        line_id=line_id,
        from_time=_parse_time(from_time),
        to_time=_parse_time(to_time),
        compare_previous=compare
    )

@router.get("/traffic", response_model=List[TrafficBucket])
def get_traffic(
    camera_id: Optional[int] = Query(None),
    line_id: Optional[str] = Query(None),
    from_time: Optional[str] = Query(None, alias="from"),
    to_time: Optional[str] = Query(None, alias="to"),
    interval: str = Query("hour", pattern="^(hour|day)$"),
    tz_offset: str = Query("+00:00"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return stats_service.get_traffic(
        db,
        camera_id=camera_id,
        line_id=line_id,
        from_time=_parse_time(from_time),
        to_time=_parse_time(to_time),
        interval=interval,
        tz_offset=tz_offset
    )

@router.get("/age", response_model=List[AgeGroupStat])
def get_age(
    camera_id: Optional[int] = Query(None),
    line_id: Optional[str] = Query(None),
    from_time: Optional[str] = Query(None, alias="from"),
    to_time: Optional[str] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return stats_service.get_age_groups(
        db,
        camera_id=camera_id,
        line_id=line_id,
        from_time=_parse_time(from_time),
        to_time=_parse_time(to_time)
    )

@router.get("/gender", response_model=List[GenderStat])
def get_gender(
    camera_id: Optional[int] = Query(None),
    line_id: Optional[str] = Query(None),
    from_time: Optional[str] = Query(None, alias="from"),
    to_time: Optional[str] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return stats_service.get_gender_stats(
        db,
        camera_id=camera_id,
        line_id=line_id,
        from_time=_parse_time(from_time),
        to_time=_parse_time(to_time)
    )

@router.get("/demographic-matrix", response_model=DemographicMatrix)
def get_demographic_matrix(
    camera_id: Optional[int] = Query(None),
    line_id: Optional[str] = Query(None),
    from_time: Optional[str] = Query(None, alias="from"),
    to_time: Optional[str] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return stats_service.get_demographic_matrix(
        db,
        camera_id=camera_id,
        line_id=line_id,
        from_time=_parse_time(from_time),
        to_time=_parse_time(to_time)
    )

@router.get("/heatmap", response_model=List[HeatmapCell])
def get_traffic_heatmap(
    camera_id: Optional[int] = Query(None),
    line_id: Optional[str] = Query(None),
    from_time: Optional[str] = Query(None, alias="from"),
    to_time: Optional[str] = Query(None, alias="to"),
    tz_offset: str = Query("+00:00"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return stats_service.get_traffic_heatmap(
        db,
        camera_id=camera_id,
        line_id=line_id,
        from_time=_parse_time(from_time),
        to_time=_parse_time(to_time),
        tz_offset=tz_offset
    )

@router.get("/lines", response_model=List[LineTrafficStat])
def get_lines_breakdown(
    camera_id: Optional[int] = Query(None),
    from_time: Optional[str] = Query(None, alias="from"),
    to_time: Optional[str] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return stats_service.get_lines_breakdown(
        db,
        camera_id=camera_id,
        from_time=_parse_time(from_time),
        to_time=_parse_time(to_time)
    )
