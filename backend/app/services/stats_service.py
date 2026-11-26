import re
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from ..models import CountEvent

ALL_AGE_GROUPS = ["child", "teen", "young_adult", "adult", "senior", "unknown"]
ALL_GENDERS = ["male", "female", "unknown"]
DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

def _parse_tz_offset(tz_offset: Optional[str]) -> Tuple[str, timedelta]:
    """Validates and parses timezone offset string like '+05:30' or '-04:00'."""
    if not tz_offset:
        return "+00:00", timedelta(0)
    match = re.match(r"^([+-])(\d{2}):(\d{2})$", tz_offset.strip())
    if not match:
        return "+00:00", timedelta(0)
    sign, hours, minutes = match.groups()
    delta = timedelta(hours=int(hours), minutes=int(minutes))
    if sign == "-":
        delta = -delta
    return tz_offset.strip(), delta

def _apply_filters(
    query,
    camera_id: Optional[int] = None,
    line_id: Optional[str] = None,
    age_group: Optional[str] = None,
    gender: Optional[str] = None,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None
):
    if camera_id is not None:
        query = query.filter(CountEvent.camera_id == camera_id)
    if line_id is not None and line_id != "":
        query = query.filter(CountEvent.line_id == line_id)
    if age_group is not None and age_group != "":
        query = query.filter(CountEvent.age_group == age_group)
    if gender is not None and gender != "":
        query = query.filter(CountEvent.gender == gender)
    if from_time is not None:
        query = query.filter(CountEvent.event_time >= from_time)
    if to_time is not None:
        query = query.filter(CountEvent.event_time <= to_time)
    return query

def get_summary(
    db: Session,
    camera_id: Optional[int] = None,
    line_id: Optional[str] = None,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    compare_previous: bool = True
) -> Dict[str, Any]:
    base_query = db.query(
        func.sum(case((CountEvent.direction == "in", 1), else_=0)).label("total_in"),
        func.sum(case((CountEvent.direction == "out", 1), else_=0)).label("total_out"),
        func.avg(case((CountEvent.direction == "in", CountEvent.age), else_=None)).label("avg_age")
    )
    filtered = _apply_filters(base_query, camera_id=camera_id, line_id=line_id, from_time=from_time, to_time=to_time)
    row = filtered.first()

    total_in = int(row.total_in or 0) if row else 0
    total_out = int(row.total_out or 0) if row else 0
    avg_age = round(float(row.avg_age), 1) if row and row.avg_age is not None else None
    inside_now = max(total_in - total_out, 0)

    delta_in_pct: Optional[float] = None
    delta_out_pct: Optional[float] = None
    delta_inside_pct: Optional[float] = None
    delta_avg_age_pct: Optional[float] = None
    prev_total_in: Optional[int] = None
    prev_total_out: Optional[int] = None
    prev_inside_now: Optional[int] = None

    if compare_previous and from_time and to_time and to_time > from_time:
        duration = to_time - from_time
        prev_from = from_time - duration
        prev_to = from_time
        prev_filtered = _apply_filters(
            base_query,
            camera_id=camera_id,
            line_id=line_id,
            from_time=prev_from,
            to_time=prev_to
        )
        prev_row = prev_filtered.first()
        prev_total_in = int(prev_row.total_in or 0) if prev_row else 0
        prev_total_out = int(prev_row.total_out or 0) if prev_row else 0
        prev_inside_now = max(prev_total_in - prev_total_out, 0)
        prev_avg_age = round(float(prev_row.avg_age), 1) if prev_row and prev_row.avg_age is not None else None

        def calc_pct(cur: float, prev: float) -> Optional[float]:
            if prev > 0:
                return round(((cur - prev) / prev) * 100.0, 1)
            elif cur > 0:
                return 100.0
            return 0.0

        delta_in_pct = calc_pct(total_in, prev_total_in)
        delta_out_pct = calc_pct(total_out, prev_total_out)
        delta_inside_pct = calc_pct(inside_now, prev_inside_now)
        if avg_age is not None and prev_avg_age is not None:
            delta_avg_age_pct = calc_pct(avg_age, prev_avg_age)

    return {
        "total_in": total_in,
        "total_out": total_out,
        "inside_now": inside_now,
        "avg_age": avg_age,
        "delta_in_pct": delta_in_pct,
        "delta_out_pct": delta_out_pct,
        "delta_inside_pct": delta_inside_pct,
        "delta_avg_age_pct": delta_avg_age_pct,
        "prev_total_in": prev_total_in,
        "prev_total_out": prev_total_out,
        "prev_inside_now": prev_inside_now,
    }

def get_traffic(
    db: Session,
    camera_id: Optional[int] = None,
    line_id: Optional[str] = None,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    interval: str = "hour",
    tz_offset: str = "+00:00"
) -> List[Dict[str, Any]]:
    valid_tz, tz_delta = _parse_tz_offset(tz_offset)
    date_format = "%Y-%m-%d %H:00:00" if interval == "hour" else "%Y-%m-%d"
    
    # Use MariaDB CONVERT_TZ for timezone conversion
    converted_time = func.convert_tz(CountEvent.event_time, "+00:00", valid_tz)
    local_time_expr = func.coalesce(converted_time, CountEvent.event_time)
    bucket_expr = func.date_format(local_time_expr, date_format).label("bucket")

    query = db.query(
        bucket_expr,
        func.sum(case((CountEvent.direction == "in", 1), else_=0)).label("ins"),
        func.sum(case((CountEvent.direction == "out", 1), else_=0)).label("outs")
    )
    query = _apply_filters(query, camera_id=camera_id, line_id=line_id, from_time=from_time, to_time=to_time)
    query = query.group_by("bucket").order_by("bucket")
    rows = query.all()

    query_map = {
        str(r.bucket): {
            "ins": int(r.ins or 0),
            "outs": int(r.outs or 0)
        }
        for r in rows if r.bucket
    }

    # Generate continuous zero-filled buckets when from_time and to_time exist
    if from_time and to_time and to_time >= from_time:
        start_local = from_time.replace(tzinfo=timezone.utc) + tz_delta
        end_local = to_time.replace(tzinfo=timezone.utc) + tz_delta

        zero_buckets: List[str] = []
        if interval == "hour":
            curr = start_local.replace(minute=0, second=0, microsecond=0)
            while curr <= end_local:
                zero_buckets.append(curr.strftime("%Y-%m-%d %H:00:00"))
                curr += timedelta(hours=1)
        else:
            curr = start_local.date()
            end_date = end_local.date()
            while curr <= end_date:
                zero_buckets.append(curr.strftime("%Y-%m-%d"))
                curr += timedelta(days=1)

        result = []
        for b in zero_buckets:
            data = query_map.get(b, {"ins": 0, "outs": 0})
            result.append({
                "bucket": b,
                "ins": data["ins"],
                "outs": data["outs"]
            })
        return result

    # Fallback to query rows directly if continuous range cannot be generated
    return [
        {
            "bucket": str(r.bucket),
            "ins": int(r.ins or 0),
            "outs": int(r.outs or 0)
        }
        for r in rows
    ]

def get_age_groups(
    db: Session,
    camera_id: Optional[int] = None,
    line_id: Optional[str] = None,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None
) -> List[Dict[str, Any]]:
    query = db.query(
        CountEvent.age_group,
        func.count(CountEvent.id).label("count")
    ).filter(CountEvent.direction == "in")
    query = _apply_filters(query, camera_id=camera_id, line_id=line_id, from_time=from_time, to_time=to_time)
    query = query.group_by(CountEvent.age_group)
    rows = query.all()

    counts = {r.age_group: int(r.count) for r in rows}
    total = sum(counts.values())

    result = []
    for grp in ALL_AGE_GROUPS:
        c = counts.get(grp, 0)
        pct = round((c / total * 100), 1) if total > 0 else 0.0
        result.append({
            "age_group": grp,
            "count": c,
            "percentage": pct
        })
    return result

def get_gender_stats(
    db: Session,
    camera_id: Optional[int] = None,
    line_id: Optional[str] = None,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None
) -> List[Dict[str, Any]]:
    query = db.query(
        CountEvent.gender,
        func.count(CountEvent.id).label("count")
    ).filter(CountEvent.direction == "in")
    query = _apply_filters(query, camera_id=camera_id, line_id=line_id, from_time=from_time, to_time=to_time)
    query = query.group_by(CountEvent.gender)
    rows = query.all()

    counts = {r.gender: int(r.count) for r in rows}
    total = sum(counts.values())

    result = []
    for g in ALL_GENDERS:
        c = counts.get(g, 0)
        pct = round((c / total * 100), 1) if total > 0 else 0.0
        result.append({
            "gender": g,
            "count": c,
            "percentage": pct
        })
    return result

def get_demographic_matrix(
    db: Session,
    camera_id: Optional[int] = None,
    line_id: Optional[str] = None,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Computes Age Group × Gender cross-tabulation matrix for audience segmentation.
    """
    query = db.query(
        CountEvent.age_group,
        CountEvent.gender,
        func.count(CountEvent.id).label("count")
    ).filter(CountEvent.direction == "in")
    query = _apply_filters(query, camera_id=camera_id, line_id=line_id, from_time=from_time, to_time=to_time)
    query = query.group_by(CountEvent.age_group, CountEvent.gender)
    rows = query.all()

    cell_map: Dict[Tuple[str, str], int] = {}
    for r in rows:
        cell_map[(str(r.age_group), str(r.gender))] = int(r.count)

    total_in = sum(cell_map.values())
    by_age: Dict[str, int] = {grp: 0 for grp in ALL_AGE_GROUPS}
    by_gender: Dict[str, int] = {g: 0 for g in ALL_GENDERS}
    matrix = []

    for grp in ALL_AGE_GROUPS:
        for g in ALL_GENDERS:
            count = cell_map.get((grp, g), 0)
            by_age[grp] += count
            by_gender[g] += count
            pct = round((count / total_in * 100), 1) if total_in > 0 else 0.0
            matrix.append({
                "age_group": grp,
                "gender": g,
                "count": count,
                "percentage": pct
            })

    return {
        "matrix": matrix,
        "total_in": total_in,
        "by_age": by_age,
        "by_gender": by_gender
    }

def get_traffic_heatmap(
    db: Session,
    camera_id: Optional[int] = None,
    line_id: Optional[str] = None,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    tz_offset: str = "+00:00"
) -> List[Dict[str, Any]]:
    """
    Computes 7 × 24 Day-of-Week × Hour Peak Traffic Heatmap.
    Day of week: 0 = Mon, ..., 6 = Sun.
    Hour: 0 to 23.
    """
    valid_tz, _ = _parse_tz_offset(tz_offset)
    converted_time = func.convert_tz(CountEvent.event_time, "+00:00", valid_tz)
    local_time_expr = func.coalesce(converted_time, CountEvent.event_time)

    # MySQL: DAYOFWEEK() returns 1=Sunday, 2=Monday, ..., 7=Saturday
    # Transform to ISO: 0=Mon, ..., 6=Sun via ((DAYOFWEEK + 5) % 7)
    dow_expr = ((func.dayofweek(local_time_expr) + 5) % 7).label("dow")
    hour_expr = func.hour(local_time_expr).label("hour")

    query = db.query(
        dow_expr,
        hour_expr,
        func.sum(case((CountEvent.direction == "in", 1), else_=0)).label("ins"),
        func.sum(case((CountEvent.direction == "out", 1), else_=0)).label("outs"),
        func.count(CountEvent.id).label("total")
    )
    query = _apply_filters(query, camera_id=camera_id, line_id=line_id, from_time=from_time, to_time=to_time)
    query = query.group_by("dow", "hour")
    rows = query.all()

    heatmap_map: Dict[Tuple[int, int], Dict[str, int]] = {}
    for r in rows:
        d = int(r.dow)
        h = int(r.hour)
        heatmap_map[(d, h)] = {
            "ins": int(r.ins or 0),
            "outs": int(r.outs or 0),
            "total": int(r.total or 0)
        }

    # Generate full 7 × 24 grid
    result = []
    for day_idx in range(7):
        for hr in range(24):
            data = heatmap_map.get((day_idx, hr), {"ins": 0, "outs": 0, "total": 0})
            result.append({
                "day_of_week": day_idx,
                "day_name": DAY_NAMES[day_idx],
                "hour": hr,
                "ins": data["ins"],
                "outs": data["outs"],
                "total": data["total"]
            })
    return result

def get_lines_breakdown(
    db: Session,
    camera_id: Optional[int] = None,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None
) -> List[Dict[str, Any]]:
    """
    Breakdown of IN/OUT traffic across named counting lines.
    """
    line_id_expr = func.coalesce(CountEvent.line_id, "line-1").label("line_id")
    line_name_expr = func.coalesce(CountEvent.line_name, CountEvent.line_id, "Main Line").label("line_name")

    query = db.query(
        line_id_expr,
        line_name_expr,
        func.sum(case((CountEvent.direction == "in", 1), else_=0)).label("ins"),
        func.sum(case((CountEvent.direction == "out", 1), else_=0)).label("outs"),
        func.count(CountEvent.id).label("total")
    )
    query = _apply_filters(query, camera_id=camera_id, from_time=from_time, to_time=to_time)
    query = query.group_by("line_id", "line_name").order_by(func.count(CountEvent.id).desc())
    rows = query.all()

    return [
        {
            "line_id": str(r.line_id),
            "line_name": str(r.line_name),
            "ins": int(r.ins or 0),
            "outs": int(r.outs or 0),
            "total": int(r.total or 0)
        }
        for r in rows
    ]
