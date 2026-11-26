import time
import math
from collections import deque
from typing import Optional, Literal, Dict, Tuple, List

def ccw(a: Tuple[float, float], b: Tuple[float, float], c: Tuple[float, float]) -> float:
    """
    2D cross-product of vector AB and AC.
    Returns:
      > 0 if counter-clockwise (c is to the left of directed line a -> b)
      < 0 if clockwise (c is to the right of directed line a -> b)
      = 0 if collinear
    """
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

def segments_intersect(
    p1: Tuple[float, float], p2: Tuple[float, float],
    q1: Tuple[float, float], q2: Tuple[float, float]
) -> bool:
    """
    Determines if 2D line segment p1-p2 intersects segment q1-q2.
    Handles general intersections and boundary touch cases.
    """
    cp1 = ccw(p1, p2, q1)
    cp2 = ccw(p1, p2, q2)
    cp3 = ccw(q1, q2, p1)
    cp4 = ccw(q1, q2, p2)

    # General intersection: endpoints of each segment are on opposite sides of the other
    if ((cp1 > 0 and cp2 < 0) or (cp1 < 0 and cp2 > 0)) and \
       ((cp3 > 0 and cp4 < 0) or (cp3 < 0 and cp4 > 0)):
        return True

    # Check collinear / touching boundary cases
    def on_segment(p, q, r):
        return (min(p[0], r[0]) <= q[0] <= max(p[0], r[0]) and
                min(p[1], r[1]) <= q[1] <= max(p[1], r[1]))

    if cp1 == 0 and on_segment(p1, q1, p2): return True
    if cp2 == 0 and on_segment(p1, q2, p2): return True
    if cp3 == 0 and on_segment(q1, p1, q2): return True
    if cp4 == 0 and on_segment(q1, p2, q2): return True

    return False

def get_crossing_direction(
    p_prev: Tuple[float, float],
    p_curr: Tuple[float, float],
    line_start: Tuple[float, float],
    line_end: Tuple[float, float],
    in_direction: Literal["left", "right"]
) -> Optional[Literal["in", "out"]]:
    """
    Calculates whether the motion from p_prev to p_curr is 'in' or 'out'
    relative to the counting line vector and its assigned in_direction.
    Uses the projection (dot product) of the motion vector onto the normal vector.
    """
    x1, y1 = line_start
    x2, y2 = line_end
    dx = x2 - x1
    dy = y2 - y1
    length = math.hypot(dx, dy)
    if length == 0:
        return None

    # Normal vector perpendicular to the counting line directed towards IN
    # Consistent with LineEditor canvas arrow visualization
    factor = 1.0 if in_direction == "left" else -1.0
    nx = (-dy / length) * factor
    ny = (dx / length) * factor

    # Motion vector
    mx = p_curr[0] - p_prev[0]
    my = p_curr[1] - p_prev[1]

    dot = mx * nx + my * ny
    if abs(dot) < 1e-6:
        return None
    return "in" if dot > 0 else "out"


class LineCounter:
    """
    High-precision people counting logic with ByteTrack ID continuity.
    
    Key Features:
    1. Real Finite Segment Intersection: Prevents false counts outside the line bounds.
    2. Dual-Point Tracking: Checks both body center and feet ground contact point.
    3. Multi-Frame Smoothing: Handles fast motion or single-frame detector dropouts.
    4. Anti-Double-Count State Machine: Enforces cooldown window and suppresses loitering bounce.
    5. Trajectory History: Maintains recent coordinate history for real-time visualization.
    """
    def __init__(
        self,
        line: Tuple[float, float, float, float],
        in_direction: Literal["left", "right"] = "right",
        cooldown_sec: int = 10
    ):
        self.x1, self.y1, self.x2, self.y2 = line
        self.in_direction = in_direction
        self.cooldown_sec = cooldown_sec

        # track_id -> deque of recent (cx, cy, bx, by, timestamp)
        self._trajectories: Dict[int, deque] = {}
        # track_id -> state dict { last_counted_time, last_direction, last_side }
        self._track_states: Dict[int, dict] = {}
        self._last_seen_time: Dict[int, float] = {}

    def update_line(self, line: Tuple[float, float, float, float], in_direction: Literal["left", "right"]):
        self.x1, self.y1, self.x2, self.y2 = line
        self.in_direction = in_direction

    def get_trajectory(self, track_id: int) -> List[Tuple[float, float]]:
        """Returns recent (cx, cy) normalized trajectory trail for visualization."""
        if track_id in self._trajectories:
            return [(pt[0], pt[1]) for pt in self._trajectories[track_id]]
        return []

    def check_crossing(
        self,
        track_id: int,
        cx: float,
        cy: float,
        bottom_x: Optional[float] = None,
        bottom_y: Optional[float] = None
    ) -> Optional[Literal["in", "out"]]:
        """
        Evaluates whether track_id crossed the counting line segment.
        Returns 'in', 'out', or None.
        """
        now = time.time()
        self._last_seen_time[track_id] = now

        bx = cx if bottom_x is None else bottom_x
        by = cy if bottom_y is None else bottom_y

        q1 = (self.x1, self.y1)
        q2 = (self.x2, self.y2)

        # Initialize track history
        if track_id not in self._trajectories:
            self._trajectories[track_id] = deque(maxlen=30)
            self._trajectories[track_id].append((cx, cy, bx, by, now))
            side = ccw(q1, q2, (cx, cy))
            self._track_states[track_id] = {
                "last_counted_time": 0.0,
                "last_direction": None,
                "last_side": side
            }
            return None

        traj = self._trajectories[track_id]
        prev_cx, prev_cy, prev_bx, prev_by, _ = traj[-1]
        traj.append((cx, cy, bx, by, now))

        state = self._track_states.setdefault(track_id, {
            "last_counted_time": 0.0,
            "last_direction": None,
            "last_side": 0.0
        })

        # 1. Check segment-segment intersection between consecutive frames
        # Test both body center trajectory and feet/ground trajectory
        center_crossed = segments_intersect((prev_cx, prev_cy), (cx, cy), q1, q2)
        feet_crossed = segments_intersect((prev_bx, prev_by), (bx, by), q1, q2)

        crossed_p_prev = (prev_cx, prev_cy)
        crossed_p_curr = (cx, cy)

        # 2. Multi-frame check: if not detected in single frame (e.g. frame skip or fast walking),
        # check against position from 2 or 3 frames ago
        if not (center_crossed or feet_crossed) and len(traj) >= 3:
            older_cx, older_cy, older_bx, older_by, older_t = traj[-3]
            if (now - older_t) < 0.6:  # within 600 ms window
                if segments_intersect((older_cx, older_cy), (cx, cy), q1, q2):
                    center_crossed = True
                    crossed_p_prev = (older_cx, older_cy)
                elif segments_intersect((older_bx, older_by), (bx, by), q1, q2):
                    feet_crossed = True
                    crossed_p_prev = (older_bx, older_by)
                    crossed_p_curr = (bx, by)

        if not (center_crossed or feet_crossed):
            state["last_side"] = ccw(q1, q2, (cx, cy))
            return None

        # 3. Determine crossing direction (in vs out)
        direction = get_crossing_direction(crossed_p_prev, crossed_p_curr, q1, q2, self.in_direction)
        if direction is None:
            # Fallback using oldest known position on opposite side
            for pt in reversed(list(traj)[:-1]):
                direction = get_crossing_direction((pt[0], pt[1]), (cx, cy), q1, q2, self.in_direction)
                if direction is not None:
                    break

        if direction is None:
            return None

        # 4. Anti-Double-Count Verification
        last_counted_time = state.get("last_counted_time", 0.0)
        last_direction = state.get("last_direction")

        # Suppress repeat crossing in same direction within cooldown window
        if last_direction == direction and (now - last_counted_time) < self.cooldown_sec:
            state["last_side"] = ccw(q1, q2, (cx, cy))
            return None

        # Suppress rapid oscillations / loitering jitter (< 1.5s debounce)
        if (now - last_counted_time) < 1.5:
            state["last_side"] = ccw(q1, q2, (cx, cy))
            return None

        # 5. Successfully crossed!
        state["last_counted_time"] = now
        state["last_direction"] = direction
        state["last_side"] = ccw(q1, q2, (cx, cy))

        return direction

    def cleanup(self, max_stale_sec: float = 60.0):
        """Prunes tracking history for objects no longer visible."""
        now = time.time()
        stale = [tid for tid, t in self._last_seen_time.items() if (now - t) > max_stale_sec]
        for tid in stale:
            self._trajectories.pop(tid, None)
            self._track_states.pop(tid, None)
            self._last_seen_time.pop(tid, None)


class MultiLineCounter:
    """
    Manages multiple finite counting lines for a camera.
    Each line independently evaluates crossing, direction vector, and anti-double-count debouncing.
    """
    def __init__(
        self,
        lines: Optional[List[dict]] = None,
        cooldown_sec: int = 10
    ):
        self.cooldown_sec = cooldown_sec
        self.counters: Dict[str, LineCounter] = {}
        self.lines: List[dict] = []
        if lines:
            self.update_lines(lines)

    def update_lines(self, lines: List[dict]):
        self.lines = lines
        new_counters: Dict[str, LineCounter] = {}
        for idx, line_cfg in enumerate(lines):
            lid = str(line_cfg.get("id") or f"line-{idx+1}")
            x1 = float(line_cfg.get("x1", 0.2))
            y1 = float(line_cfg.get("y1", 0.5))
            x2 = float(line_cfg.get("x2", 0.8))
            y2 = float(line_cfg.get("y2", 0.5))
            in_dir = line_cfg.get("in_direction", "right")

            if lid in self.counters:
                self.counters[lid].update_line((x1, y1, x2, y2), in_dir)
                new_counters[lid] = self.counters[lid]
            else:
                new_counters[lid] = LineCounter(
                    line=(x1, y1, x2, y2),
                    in_direction=in_dir,
                    cooldown_sec=self.cooldown_sec
                )
        self.counters = new_counters

    def check_crossing(
        self,
        track_id: int,
        cx: float,
        cy: float,
        bottom_x: Optional[float] = None,
        bottom_y: Optional[float] = None
    ) -> Optional[Tuple[str, str, dict]]:
        """
        Evaluates whether track_id crossed ANY of the configured counting lines.
        Returns: (crossing_direction: 'in' | 'out', line_id: str, line_cfg: dict) or None
        """
        for line_cfg in self.lines:
            lid = str(line_cfg.get("id") or "line-1")
            counter = self.counters.get(lid)
            if counter:
                direction = counter.check_crossing(track_id, cx, cy, bottom_x, bottom_y)
                if direction is not None:
                    return direction, lid, line_cfg
        return None

    def get_trajectory(self, track_id: int) -> List[Tuple[float, float]]:
        for counter in self.counters.values():
            traj = counter.get_trajectory(track_id)
            if traj:
                return traj
        return []

    def cleanup(self, max_stale_sec: float = 60.0):
        for counter in self.counters.values():
            counter.cleanup(max_stale_sec)
