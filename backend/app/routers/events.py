import io
import csv
from datetime import datetime, timezone
from typing import Optional, Literal
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import CountEvent, Camera, User
from ..schemas import PaginatedEvents, EventOut
from ..security import get_current_user

router = APIRouter(prefix="/events", tags=["events"])

def _parse_time(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    s = dt_str.strip()
    if " " in s and "+" not in s:
        parts = s.rsplit(" ", 1)
        if len(parts) == 2 and ":" in parts[1]:
            s = f"{parts[0]}+{parts[1]}"
    try:
        if s.endswith("Z") or s.endswith("z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return None

def _filter_events(
    query,
    camera_id: Optional[int],
    line_id: Optional[str],
    direction: Optional[str],
    age_group: Optional[str],
    gender: Optional[str],
    from_time: Optional[datetime],
    to_time: Optional[datetime]
):
    if camera_id is not None:
        query = query.filter(CountEvent.camera_id == camera_id)
    if line_id is not None and line_id != "":
        query = query.filter(CountEvent.line_id == line_id)
    if direction is not None and direction != "":
        query = query.filter(CountEvent.direction == direction)
    if age_group is not None and age_group != "":
        query = query.filter(CountEvent.age_group == age_group)
    if gender is not None and gender != "":
        query = query.filter(CountEvent.gender == gender)
    if from_time is not None:
        query = query.filter(CountEvent.event_time >= from_time)
    if to_time is not None:
        query = query.filter(CountEvent.event_time <= to_time)
    return query

@router.get("", response_model=PaginatedEvents)
def list_events(
    camera_id: Optional[int] = Query(None),
    line_id: Optional[str] = Query(None),
    direction: Optional[Literal["in", "out"]] = Query(None),
    age_group: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    from_time: Optional[str] = Query(None, alias="from"),
    to_time: Optional[str] = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    base_query = db.query(CountEvent, Camera.name.label("camera_name")).outerjoin(Camera, CountEvent.camera_id == Camera.id)
    filtered = _filter_events(
        base_query,
        camera_id=camera_id,
        line_id=line_id,
        direction=direction,
        age_group=age_group,
        gender=gender,
        from_time=_parse_time(from_time),
        to_time=_parse_time(to_time)
    )

    total = filtered.count()
    offset = (page - 1) * limit
    results = filtered.order_by(CountEvent.event_time.desc()).offset(offset).limit(limit).all()

    items = []
    for ev, cam_name in results:
        items.append(EventOut(
            id=ev.id,
            camera_id=ev.camera_id,
            camera_name=cam_name,
            line_id=ev.line_id,
            line_name=ev.line_name,
            direction=ev.direction,
            track_id=ev.track_id,
            age=ev.age,
            age_group=ev.age_group,
            gender=ev.gender,
            confidence=ev.confidence,
            event_time=ev.event_time
        ))

    total_pages = (total + limit - 1) // limit if total > 0 else 1

    return PaginatedEvents(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )

@router.get("/export")
def export_events_csv(
    camera_id: Optional[int] = Query(None),
    line_id: Optional[str] = Query(None),
    direction: Optional[Literal["in", "out"]] = Query(None),
    age_group: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    from_time: Optional[str] = Query(None, alias="from"),
    to_time: Optional[str] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    base_query = db.query(CountEvent, Camera.name.label("camera_name")).outerjoin(Camera, CountEvent.camera_id == Camera.id)
    filtered = _filter_events(
        base_query,
        camera_id=camera_id,
        line_id=line_id,
        direction=direction,
        age_group=age_group,
        gender=gender,
        from_time=_parse_time(from_time),
        to_time=_parse_time(to_time)
    )
    results = filtered.order_by(CountEvent.event_time.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Event ID", "Camera ID", "Camera Name", "Line ID", "Line Name",
        "Direction", "Track ID", "Estimated Age", "Age Group", "Gender", 
        "Confidence", "Event Time (UTC)"
    ])

    for ev, cam_name in results:
        writer.writerow([
            ev.id,
            ev.camera_id,
            cam_name or f"Camera #{ev.camera_id}",
            ev.line_id or "",
            ev.line_name or "",
            ev.direction,
            ev.track_id,
            ev.age if ev.age is not None else "",
            ev.age_group,
            ev.gender,
            f"{ev.confidence:.2f}" if ev.confidence is not None else "",
            ev.event_time.strftime("%Y-%m-%d %H:%M:%S")
        ])

    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    filename = f"visioncount_events_{timestamp}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
