import os
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import torch
from ultralytics import YOLO

class PersonDetector:
    """
    Detects and tracks people in video frames using YOLOv8 with ByteTrack.
    Filters exclusively for the 'person' class (COCO class 0).
    Auto-detects NVIDIA CUDA GPU on servers, falling back smoothly to CPU on local PCs.
    Uses tuned ByteTrack configuration with extended buffer and low-confidence recovery.
    """
    def __init__(self, model_path: str = "yolov8n.pt", conf_threshold: float = 0.35, device: Optional[str] = None):
        self.model = YOLO(model_path)
        self.conf_threshold = conf_threshold
        # Dedicated ByteTrack config for people counting
        bytetrack_path = os.path.join(os.path.dirname(__file__), "bytetrack.yaml")
        self.tracker_cfg = bytetrack_path if os.path.exists(bytetrack_path) else "bytetrack.yaml"
        # Auto-detect CUDA GPU on server, fallback to CPU
        if device is None:
            self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
        print(f"[PersonDetector] YOLOv8 tracker running on {self.device.upper()}.")

    def track(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Runs tracking on a single frame.
        Returns a list of tracked people:
        [{
            'track_id': int,
            'bbox': (x1, y1, x2, y2),
            'center': (cx, cy), # normalized 0.0 - 1.0
            'bottom_center': (cx, bottom_y), # ground contact (feet)
            'conf': float,
            'crop': np.ndarray
        }]
        """
        h, w = frame.shape[:2]
        try:
            results = self.model.track(
                frame,
                persist=True,
                classes=[0],  # Person class
                conf=self.conf_threshold,
                tracker=self.tracker_cfg,
                device=self.device,
                verbose=False
            )
        except Exception as e:
            if self.device != "cpu":
                print(f"[PersonDetector] CUDA error on {self.device}: {e}. Falling back to CPU...")
                self.device = "cpu"
                try:
                    results = self.model.track(
                        frame,
                        persist=True,
                        classes=[0],
                        conf=self.conf_threshold,
                        tracker=self.tracker_cfg,
                        device="cpu",
                        verbose=False
                    )
                except Exception as inner_e:
                    print(f"[PersonDetector] CPU tracker error: {inner_e}")
                    return []
            else:
                print(f"[PersonDetector] Tracker error: {e}")
                return []

        tracked_objects = []
        if not results or len(results) == 0:
            return tracked_objects

        boxes = results[0].boxes
        if boxes is None or boxes.id is None:
            return tracked_objects

        track_ids = boxes.id.int().cpu().tolist()
        xyxy_coords = boxes.xyxy.cpu().numpy()
        confs = boxes.conf.cpu().numpy() if boxes.conf is not None else [1.0] * len(track_ids)

        for track_id, xyxy, conf in zip(track_ids, xyxy_coords, confs):
            x1, y1, x2, y2 = xyxy
            x1 = max(0, int(x1))
            y1 = max(0, int(y1))
            x2 = min(w, int(x2))
            y2 = min(h, int(y2))

            if x2 <= x1 or y2 <= y1:
                continue

            # Normalized center point (torso / body center)
            cx = ((x1 + x2) / 2.0) / float(w)
            cy = ((y1 + y2) / 2.0) / float(h)

            # Normalized bottom ground contact point (feet)
            bottom_x = cx
            bottom_y = float(y2) / float(h)

            crop = frame[y1:y2, x1:x2].copy()

            tracked_objects.append({
                "track_id": track_id,
                "bbox": (x1, y1, x2, y2),
                "center": (cx, cy),
                "bottom_center": (bottom_x, bottom_y),
                "conf": float(conf),
                "crop": crop
            })

        return tracked_objects
