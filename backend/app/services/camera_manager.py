import threading
from typing import Dict, Optional, Tuple
import cv2
import numpy as np
from sqlalchemy.orm import Session

from ..models import Camera
from ..vision.worker import CameraWorker

class CameraManager:
    """
    Singleton service that maintains active camera worker threads.
    """
    def __init__(self):
        self._workers: Dict[int, CameraWorker] = {}
        self._uploaded_snapshots: Dict[int, bytes] = {}
        self._lock = threading.Lock()

    def set_snapshot(self, camera_id: int, image_bytes: bytes):
        with self._lock:
            self._uploaded_snapshots[camera_id] = image_bytes

    def start_camera(self, camera_id: int, db: Session) -> bool:
        with self._lock:
            # If a worker exists, verify if its background thread is still healthy
            if camera_id in self._workers:
                worker = self._workers[camera_id]
                if worker._thread is not None and worker._thread.is_alive():
                    cam = db.query(Camera).filter(Camera.id == camera_id).first()
                    if cam and cam.status != "running":
                        cam.status = "running"
                        cam.last_error = None
                        db.commit()
                    return True
                else:
                    # Clean up stopped or dead worker
                    self._workers.pop(camera_id, None)

            cam = db.query(Camera).filter(Camera.id == camera_id).first()
            if not cam:
                return False

            lines = []
            if cam.lines_json:
                try:
                    import json
                    lines = json.loads(cam.lines_json)
                except Exception:
                    pass
            if not lines and cam.line_x1 is not None and cam.line_y1 is not None and cam.line_x2 is not None and cam.line_y2 is not None:
                lines = [{
                    "id": "line-1",
                    "name": "Line 1",
                    "x1": cam.line_x1,
                    "y1": cam.line_y1,
                    "x2": cam.line_x2,
                    "y2": cam.line_y2,
                    "in_direction": cam.in_direction or "right"
                }]

            line = (lines[0]["x1"], lines[0]["y1"], lines[0]["x2"], lines[0]["y2"]) if lines else None

            roi = None
            if cam.roi_x1 is not None and cam.roi_y1 is not None and cam.roi_x2 is not None and cam.roi_y2 is not None:
                roi = (cam.roi_x1, cam.roi_y1, cam.roi_x2, cam.roi_y2)

            worker = CameraWorker(
                camera_id=cam.id,
                source=cam.source,
                lines=lines,
                line=line,
                roi=roi,
                in_direction=cam.in_direction
            )
            worker.start()
            self._workers[camera_id] = worker
            
            cam.status = "running"
            cam.last_error = None
            db.commit()
            return True

    def stop_camera(self, camera_id: int, db: Session) -> bool:
        with self._lock:
            worker = self._workers.pop(camera_id, None)
            if worker:
                worker.stop()

            cam = db.query(Camera).filter(Camera.id == camera_id).first()
            if cam:
                cam.status = "stopped"
                cam.last_error = None
                db.commit()
            return True

    def update_camera_config(self, camera_id: int, db: Session):
        with self._lock:
            worker = self._workers.get(camera_id)
            if worker:
                cam = db.query(Camera).filter(Camera.id == camera_id).first()
                if cam:
                    lines = []
                    if cam.lines_json:
                        try:
                            import json
                            lines = json.loads(cam.lines_json)
                        except Exception:
                            pass
                    if not lines and cam.line_x1 is not None and cam.line_y1 is not None and cam.line_x2 is not None and cam.line_y2 is not None:
                        lines = [{
                            "id": "line-1",
                            "name": "Line 1",
                            "x1": cam.line_x1,
                            "y1": cam.line_y1,
                            "x2": cam.line_x2,
                            "y2": cam.line_y2,
                            "in_direction": cam.in_direction or "right"
                        }]
                    line = (lines[0]["x1"], lines[0]["y1"], lines[0]["x2"], lines[0]["y2"]) if lines else None
                    roi = None
                    if cam.roi_x1 is not None and cam.roi_y1 is not None and cam.roi_x2 is not None and cam.roi_y2 is not None:
                        roi = (cam.roi_x1, cam.roi_y1, cam.roi_x2, cam.roi_y2)
                    worker.update_config(lines=lines, line=line, roi=roi, in_direction=cam.in_direction)

    def start_monitor(self, camera_id: int):
        with self._lock:
            worker = self._workers.get(camera_id)
            if worker:
                worker.start_monitor_client()

    def stop_monitor(self, camera_id: int):
        with self._lock:
            worker = self._workers.get(camera_id)
            if worker:
                worker.stop_monitor_client()

    def get_annotated_frame(self, camera_id: int) -> Optional[bytes]:
        with self._lock:
            worker = self._workers.get(camera_id)
            if worker:
                return worker.get_annotated_frame_bytes()
            return None

    def get_annotated_frame_if_newer(self, camera_id: int, last_seq: int) -> Tuple[int, Optional[bytes]]:
        with self._lock:
            worker = self._workers.get(camera_id)
            if worker:
                return worker.get_annotated_frame_if_newer(last_seq)
            return last_seq, None

    def get_snapshot(self, camera_id: int, db: Session) -> bytes:
        # 1. Try to get latest frame from active worker
        with self._lock:
            worker = self._workers.get(camera_id)
            if worker:
                frame_bytes = worker.get_latest_frame_bytes()
                if frame_bytes:
                    return frame_bytes
            # 2. Check uploaded snapshot
            if camera_id in self._uploaded_snapshots:
                return self._uploaded_snapshots[camera_id]

        # 2. If not running or no frame yet, attempt to read one frame from source
        cam = db.query(Camera).filter(Camera.id == camera_id).first()
        if cam:
            try:
                src = int(cam.source) if cam.source.isdigit() else cam.source
                cap = cv2.VideoCapture(src)
                if cap.isOpened():
                    ret, frame = cap.read()
                    cap.release()
                    if ret and frame is not None:
                        success, enc = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                        if success:
                            return enc.tobytes()
            except Exception as e:
                print(f"Error capturing snapshot from source {cam.source}: {e}")

        # 3. Fallback: Generate a clean, high-resolution test preview pattern
        img = np.zeros((720, 1280, 3), dtype=np.uint8)
        # Background gradient
        for y in range(720):
            img[y, :, 0] = int(24 + 15 * (y / 720)) # B
            img[y, :, 1] = int(24 + 15 * (y / 720)) # G
            img[y, :, 2] = int(35 + 20 * (y / 720)) # R
        
        # Grid lines
        for x in range(0, 1280, 80):
            cv2.line(img, (x, 0), (x, 720), (50, 50, 60), 1)
        for y in range(0, 720, 80):
            cv2.line(img, (0, y), (1280, y), (50, 50, 60), 1)

        # Walkway / Entry zone
        cv2.rectangle(img, (340, 100), (940, 680), (40, 45, 55), -1)
        cv2.rectangle(img, (340, 100), (940, 680), (79, 70, 229), 2) # Indigo border

        # Labels
        cam_name = cam.name if cam else f"Camera #{camera_id}"
        cv2.putText(img, f"CAMSENSE PREVIEW: {cam_name.upper()}", (360, 160), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        cv2.putText(img, "Click two points on this canvas to set your counting line", (360, 220), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (160, 170, 190), 1)
        cv2.putText(img, "Entrance / Walkway Area", (520, 420), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 110, 130), 2)

        _, enc = cv2.imencode(".jpg", img)
        return enc.tobytes()

    def start_active_cameras(self, db: Session):
        running_cams = db.query(Camera).filter(Camera.status == "running").all()
        for cam in running_cams:
            print(f"Resuming active camera #{cam.id}: {cam.name}")
            self.start_camera(cam.id, db)

    def stop_all(self):
        with self._lock:
            for cid, worker in list(self._workers.items()):
                try:
                    worker.stop()
                except Exception as e:
                    print(f"Error stopping worker {cid}: {e}")
            self._workers.clear()

camera_manager = CameraManager()
