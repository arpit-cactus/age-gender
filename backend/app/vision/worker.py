import threading
import time
from datetime import datetime, timezone
from typing import Optional, Tuple
import cv2
import numpy as np

from ..config import settings
from ..database import SessionLocal
from ..models import Camera, CountEvent, SystemSetting
from .detector import PersonDetector
from .counter import LineCounter, MultiLineCounter
from .face_analyzer import FaceAnalyzer

class CameraWorker:
    """
    Dedicated worker thread for an active Camera stream.
    Runs YOLO person detection, ByteTrack tracking, calibrated line crossing check,
    and high-precision age and gender estimation (MiVOLO v2 with InsightFace fallback).
    Auto-detects CUDA GPU on servers and falls back seamlessly to CPU.
    Dynamically syncs system settings on-the-fly.
    Strictly keeps zero video or face images in disk/DB (privacy).
    """
    def __init__(
        self,
        camera_id: int,
        source: str,
        lines: Optional[list] = None,
        line: Optional[Tuple[float, float, float, float]] = None,
        roi: Optional[Tuple[float, float, float, float]] = None,
        in_direction: str = "right"
    ):
        self.camera_id = camera_id
        self.source = source
        self.lines = lines or []
        if not self.lines:
            default_line = line or (0.2, 0.5, 0.8, 0.5)
            self.lines = [{
                "id": "line-1",
                "name": "Line 1",
                "x1": default_line[0],
                "y1": default_line[1],
                "x2": default_line[2],
                "y2": default_line[3],
                "in_direction": in_direction
            }]
        self.line = (self.lines[0]["x1"], self.lines[0]["y1"], self.lines[0]["x2"], self.lines[0]["y2"])
        self.roi = roi
        self.in_direction = self.lines[0].get("in_direction", in_direction)
        
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._latest_frame: Optional[np.ndarray] = None
        self._frame_lock = threading.Lock()

        # On-demand live monitor subscribers
        self._monitor_clients: int = 0
        self._monitor_lock = threading.Lock()
        self._latest_annotated_frame: Optional[bytes] = None
        self._frame_seq: int = 0
        
        # Local count accumulator for live HUD display
        self._live_total_in: int = 0
        self._live_total_out: int = 0
        self._last_settings_sync = 0.0
        
        self.detector = PersonDetector(conf_threshold=0.35)
        self.counter = MultiLineCounter(
            lines=self.lines,
            cooldown_sec=settings.DOUBLE_COUNT_COOLDOWN_SEC
        )
        self.face_analyzer = FaceAnalyzer(model_name="mivolo_v2", confidence_threshold=0.45)

    def _sync_system_settings(self):
        """Reads updated runtime configuration from database without stopping stream."""
        db = SessionLocal()
        try:
            rows = db.query(SystemSetting).all()
            vals = {r.setting_key: r.setting_value for r in rows}
            model_name = vals.get("face_model_name", "mivolo_v2")
            face_conf = float(vals.get("face_conf_threshold", 0.45))
            person_conf = float(vals.get("person_conf_threshold", 0.35))
            max_samples = int(vals.get("max_face_samples", 5))

            self.face_analyzer.update_config(
                confidence_threshold=face_conf,
                max_samples=max_samples,
                model_name=model_name
            )
            self.detector.conf_threshold = person_conf
        except Exception as e:
            pass
        finally:
            db.close()

    def update_config(
        self,
        lines: Optional[list] = None,
        line: Optional[Tuple[float, float, float, float]] = None,
        roi: Optional[Tuple[float, float, float, float]] = None,
        in_direction: str = "right"
    ):
        if lines:
            self.lines = lines
            self.line = (float(lines[0]["x1"]), float(lines[0]["y1"]), float(lines[0]["x2"]), float(lines[0]["y2"]))
            self.in_direction = lines[0].get("in_direction", in_direction)
        elif line:
            self.line = line
            self.in_direction = in_direction
            self.lines = [{
                "id": "line-1",
                "name": "Line 1",
                "x1": line[0], "y1": line[1], "x2": line[2], "y2": line[3],
                "in_direction": in_direction
            }]
        self.roi = roi
        self.counter.update_lines(self.lines)

    def start_monitor_client(self):
        with self._monitor_lock:
            self._monitor_clients += 1
            print(f"[Camera {self.camera_id}] Live monitor client connected. Active: {self._monitor_clients}")

    def stop_monitor_client(self):
        with self._monitor_lock:
            self._monitor_clients = max(0, self._monitor_clients - 1)
            print(f"[Camera {self.camera_id}] Live monitor client disconnected. Active: {self._monitor_clients}")

    def get_annotated_frame_bytes(self) -> Optional[bytes]:
        with self._monitor_lock:
            return self._latest_annotated_frame

    def get_annotated_frame_if_newer(self, last_seq: int) -> Tuple[int, Optional[bytes]]:
        with self._monitor_lock:
            if self._frame_seq > last_seq and self._latest_annotated_frame is not None:
                return self._frame_seq, self._latest_annotated_frame
            return last_seq, None

    def get_latest_frame_bytes(self) -> Optional[bytes]:
        with self._frame_lock:
            if self._latest_frame is None:
                return None
            success, enc = cv2.imencode(".jpg", self._latest_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if success:
                return enc.tobytes()
        return None

    def start(self):
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name=f"cam-worker-{self.camera_id}")
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=3.0)
            self._thread = None

    def _open_capture(self) -> Optional[cv2.VideoCapture]:
        if self.source.isdigit():
            cap = cv2.VideoCapture(int(self.source))
            try:
                # Request full high-definition stream for USB / local webcams
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
            except Exception:
                pass
        else:
            if self.source.startswith("rtsp://") or self.source.startswith("rtsps://"):
                import os
                # Low latency, no buffer bloat for smooth real-time RTSP
                os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|fflags;nobuffer|flags;low_delay|max_delay;500000|stimeout;10000000"
            cap = cv2.VideoCapture(self.source)
        
        if not cap.isOpened():
            return None
        
        try:
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass

        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        print(f"[Camera {self.camera_id}] Native stream opened at {w}x{h} (full-resolution AI processing)")
        return cap

    def _set_camera_status(self, status: str, last_error: Optional[str] = None):
        db = SessionLocal()
        try:
            cam = db.query(Camera).filter(Camera.id == self.camera_id).first()
            if cam:
                cam.status = status # type: ignore
                cam.last_error = last_error # type: ignore
                db.commit()
        except Exception as e:
            db.rollback()
            print(f"Error updating status for camera {self.camera_id}: {e}")
        finally:
            db.close()

    def _save_event(
        self,
        direction: str,
        track_id: int,
        age: Optional[int],
        age_group: str,
        gender: str,
        confidence: Optional[float],
        line_id: Optional[str] = None,
        line_name: Optional[str] = None
    ):
        if direction == "in":
            self._live_total_in += 1
        else:
            self._live_total_out += 1

        db = SessionLocal()
        try:
            event = CountEvent(
                camera_id=self.camera_id,
                direction=direction,
                track_id=track_id,
                line_id=line_id,
                line_name=line_name,
                age=age,
                age_group=age_group,
                gender=gender,
                confidence=confidence,
                event_time=datetime.now(timezone.utc)
            )
            db.add(event)
            db.commit()
            print(f"Recorded event on camera {self.camera_id}: {direction.upper()} (track {track_id}, line {line_name or line_id}, age {age}, group {age_group}, gender {gender})")
        except Exception as e:
            db.rollback()
            print(f"Error saving count event for camera {self.camera_id}: {e}")
        finally:
            db.close()

    def _run(self):
        print(f"Worker started for camera {self.camera_id} with source: {self.source}")
        # Rock-solid 6 FPS (optimal 5-7 FPS: steady AI inference and zero network stutter)
        target_fps = min(7, max(4, int(settings.PROCESS_FPS)))
        frame_interval = 1.0 / target_fps
        self._sync_system_settings()

        while not self._stop_event.is_set():
            cap = self._open_capture()
            if cap is None:
                err_msg = f"Unable to open video source: {self.source}"
                print(f"[Camera {self.camera_id}] {err_msg}")
                self._set_camera_status("error", err_msg)
                for _ in range(10):
                    if self._stop_event.is_set():
                        return
                    time.sleep(1.0)
                continue

            self._set_camera_status("running", None)
            last_cleanup = time.time()

            try:
                while not self._stop_event.is_set():
                    t_start = time.time()

                    # Periodic settings reload (every 15s)
                    if t_start - self._last_settings_sync > 15.0:
                        self._sync_system_settings()
                        self._last_settings_sync = t_start

                    # Drain stale buffer on RTSP to ensure real-time zero-lag live feed
                    ret, frame = cap.read()
                    if ret and (self.source.startswith("rtsp://") or self.source.startswith("rtsps://")):
                        for _ in range(2):
                            if not cap.grab():
                                break
                        ret2, fresh_frame = cap.retrieve()
                        if ret2 and fresh_frame is not None:
                            frame = fresh_frame

                    if not ret or frame is None:
                        if not self.source.isdigit() and not self.source.startswith("rtsp://"):
                            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                            ret, frame = cap.read()
                        
                        if not ret or frame is None:
                            print(f"[Camera {self.camera_id}] Stream disconnected or ended.")
                            break

                    with self._frame_lock:
                        self._latest_frame = frame.copy()

                    # Detect and track people
                    tracked_people = self.detector.track(frame)

                    for person in tracked_people:
                        tid = person["track_id"]
                        cx, cy = person["center"]
                        bx, by = person.get("bottom_center", (cx, cy))
                        crop = person["crop"]

                        # If ROI is configured, ignore persons outside ROI
                        if self.roi is not None:
                            rx1 = min(self.roi[0], self.roi[2])
                            ry1 = min(self.roi[1], self.roi[3])
                            rx2 = max(self.roi[0], self.roi[2])
                            ry2 = max(self.roi[1], self.roi[3])
                            if not (rx1 <= cx <= rx2 and ry1 <= cy <= ry2):
                                del crop
                                continue

                        # Buffer face estimate sample with person box offset
                        px1, py1, px2, py2 = person["bbox"]
                        self.face_analyzer.analyze_crop(tid, crop, box_offset=(px1, py1))

                        # Check line crossing using ByteTrack trajectory & segment intersection
                        crossing_res = self.counter.check_crossing(tid, cx, cy, bx, by)
                        if crossing_res is not None:
                            crossing = crossing_res[0] if isinstance(crossing_res, tuple) else crossing_res
                            lid = crossing_res[1] if isinstance(crossing_res, tuple) and len(crossing_res) > 1 else None
                            lcfg = crossing_res[2] if isinstance(crossing_res, tuple) and len(crossing_res) > 2 else {}
                            lname = lcfg.get("name") if isinstance(lcfg, dict) else (f"Line {lid}" if lid else None)

                            if crossing == "in":
                                if tid not in self.face_analyzer._samples or len(self.face_analyzer._samples[tid]) == 0:
                                    self.face_analyzer.analyze_crop(tid, crop, box_offset=(px1, py1), force=True)
                                age, age_group, gender, conf = self.face_analyzer.get_final_estimate(tid)
                            else:
                                age, age_group, gender, conf = None, "unknown", "unknown", None
                                self.face_analyzer.cleanup_track(tid)

                            self._save_event(crossing, tid, age, age_group, gender, conf, line_id=lid, line_name=lname)

                        del crop

                    # Clean stale tracks
                    if time.time() - last_cleanup > 30.0:
                        self.counter.cleanup()
                        last_cleanup = time.time()

                    # On-Demand Live Monitor Annotations & Encoding
                    with self._monitor_lock:
                        is_monitoring = self._monitor_clients > 0

                    if is_monitoring:
                        h, w = frame.shape[:2]
                        annotated = frame.copy()

                        # 1. Draw ROI if configured
                        if self.roi is not None:
                            rx1 = int(min(self.roi[0], self.roi[2]) * w)
                            ry1 = int(min(self.roi[1], self.roi[3]) * h)
                            rx2 = int(max(self.roi[0], self.roi[2]) * w)
                            ry2 = int(max(self.roi[1], self.roi[3]) * h)
                            cv2.rectangle(annotated, (rx1, ry1), (rx2, ry2), (0, 165, 255), 2)
                            cv2.putText(
                                annotated, "ROI ACTIVE", (rx1 + 8, max(20, ry1 + 20)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 165, 255), 1, cv2.LINE_AA
                            )

                        # 2. Draw Counting Lines
                        line_colors = [
                            (229, 70, 79),   # Indigo/Blue
                            (212, 182, 6),   # Cyan
                            (234, 51, 147),  # Purple
                            (12, 88, 234),   # Orange
                            (150, 50, 230),  # Pink
                        ]
                        for idx, lcfg in enumerate(self.lines):
                            color = line_colors[idx % len(line_colors)]
                            lx1 = int(float(lcfg["x1"]) * w)
                            ly1 = int(float(lcfg["y1"]) * h)
                            lx2 = int(float(lcfg["x2"]) * w)
                            ly2 = int(float(lcfg["y2"]) * h)
                            cv2.line(annotated, (lx1, ly1), (lx2, ly2), color, 3)
                            
                            # Endpoints
                            cv2.circle(annotated, (lx1, ly1), 6, color, -1)
                            cv2.circle(annotated, (lx2, ly2), 6, color, -1)
                            
                            mx, my = (lx1 + lx2) // 2, (ly1 + ly2) // 2
                            lname = lcfg.get("name", f"Line {idx+1}")
                            ldir = lcfg.get("in_direction", "right")
                            dir_label = f"{lname} ({ldir.upper()}=IN)"
                            cv2.putText(
                                annotated, dir_label, (max(10, mx - 60), max(20, my - 8)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA
                            )

                        # 3. Draw Tracked People with ByteTrack trails & 3-in-1 capability tags
                        for person in tracked_people:
                            px1, py1, px2, py2 = person["bbox"]
                            tid = person["track_id"]
                            age, age_group, gender, conf = self.face_analyzer.get_current_estimate(tid)
                            
                            age_text = f"{age}y" if age is not None else "?y"
                            gender_text = gender.upper()[:1] if gender in ("male", "female") else "?"
                            model_badge = "MiVOLO" if self.face_analyzer.active_model == "mivolo_v2" else "IFACE"
                            tag_text = f"ID #{tid} | {age_text} | {gender_text} [{model_badge}]"

                            # Draw ByteTrack motion trajectory trail
                            traj = self.counter.get_trajectory(tid)
                            if len(traj) >= 2:
                                trail_pts = np.array(
                                    [(int(pt[0] * w), int(pt[1] * h)) for pt in traj[-15:]],
                                    np.int32
                                ).reshape((-1, 1, 2))
                                cv2.polylines(annotated, [trail_pts], isClosed=False, color=(240, 180, 0), thickness=2, lineType=cv2.LINE_AA)
                            
                            box_color = (60, 210, 100) # Emerald green for person body
                            cv2.rectangle(annotated, (px1, py1), (px2, py2), box_color, 2)
                            
                            tag_y = max(22, py1)
                            (tw, th), _ = cv2.getTextSize(tag_text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
                            cv2.rectangle(annotated, (px1, tag_y - th - 6), (px1 + tw + 8, tag_y), (30, 30, 30), -1)
                            cv2.putText(
                                annotated, tag_text, (px1 + 4, tag_y - 4),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA
                            )

                            # Exact Face Bounding Box & Landmarks Overlay
                            face_info = self.face_analyzer.get_latest_face_info(tid)
                            if face_info is not None:
                                fx1, fy1, fx2, fy2 = face_info["box"]
                                cv2.rectangle(annotated, (fx1, fy1), (fx2, fy2), (255, 200, 0), 2)
                                
                                for lx, ly in face_info.get("landmarks", []):
                                    cv2.circle(annotated, (lx, ly), 2, (0, 255, 255), -1)

                                f_age = face_info.get("age")
                                f_gen = face_info.get("gender", "unknown")
                                f_tag = f"FACE: {f_age}y {f_gen[:1].upper()}" if f_age else "FACE"
                                (ftw, fth), _ = cv2.getTextSize(f_tag, cv2.FONT_HERSHEY_SIMPLEX, 0.35, 1)
                                cv2.rectangle(annotated, (fx1, max(14, fy1) - fth - 4), (fx1 + ftw + 4, max(14, fy1)), (255, 200, 0), -1)
                                cv2.putText(
                                    annotated, f_tag, (fx1 + 2, max(14, fy1) - 2),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 0), 1, cv2.LINE_AA
                                )

                        # 4. Status HUD Overlay
                        hud_h = 32
                        cv2.rectangle(annotated, (0, 0), (w, hud_h), (18, 20, 28), -1)
                        dev_label = self.detector.device.upper()
                        hud_text = f"CAM {self.camera_id} | DEV: {dev_label} | IN: {self._live_total_in} | OUT: {self._live_total_out} | TRACKS: {len(tracked_people)}"
                        cv2.putText(
                            annotated, hud_text, (10, 21),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 180), 1, cv2.LINE_AA
                        )

                        # Optimize stream frame: downscale to max 854px width (480p) and encode at 65 quality
                        # Reduces frame size from ~250KB to ~30KB for rock-solid 5-7 FPS over FRP/tunnel
                        stream_frame = annotated
                        sh, sw = stream_frame.shape[:2]
                        if sw > 854:
                            scale = 854.0 / sw
                            stream_frame = cv2.resize(stream_frame, (854, int(sh * scale)), interpolation=cv2.INTER_AREA)

                        # Encode JPEG for live stream
                        success, enc = cv2.imencode(".jpg", stream_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 65])
                        if success:
                            with self._monitor_lock:
                                self._latest_annotated_frame = enc.tobytes()
                                self._frame_seq += 1

                    # Rate limiter
                    elapsed = time.time() - t_start
                    sleep_time = max(0.001, frame_interval - elapsed)
                    time.sleep(sleep_time)

            except Exception as e:
                err_msg = f"Worker runtime exception: {e}"
                print(f"[Camera {self.camera_id}] {err_msg}")
                self._set_camera_status("error", err_msg)
            finally:
                cap.release()

        self._set_camera_status("stopped", None)
        print(f"Worker stopped for camera {self.camera_id}")
