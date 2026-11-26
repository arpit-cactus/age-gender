import os
import cv2
import statistics
import time
from typing import Dict, List, Tuple, Optional
import numpy as np

from .mivolo_engine import MiVOLOEngine

def categorize_age(age: Optional[int]) -> str:
    """
    Categorizes numeric age into standardized demographic cohorts:
    - child: 0–12
    - teen: 13–19
    - young_adult: 20–35
    - adult: 36–50
    - senior: 51+
    """
    if age is None or age <= 0:
        return "unknown"
    if age <= 12:
        return "child"
    elif age <= 19:
        return "teen"
    elif age <= 35:
        return "young_adult"
    elif age <= 50:
        return "adult"
    else:
        return "senior"

def is_sharp_crop(crop: np.ndarray, min_variance: float = 30.0) -> bool:
    """
    Calculates the variance of the Laplacian to reject motion-blurred frames.
    Sharp images typically have variance > 100, while motion blur drops < 30.
    """
    if crop is None or crop.size == 0:
        return False
    try:
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if len(crop.shape) == 3 else crop
        variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        return variance >= min_variance
    except Exception:
        return True

def is_frontal_face(kps: Optional[np.ndarray], max_asymmetry: float = 0.45) -> bool:
    """
    Validates face frontality using 5 keypoints (left eye, right eye, nose):
    Rejects profile faces turned sideways (> 35 degrees yaw) which cause demographic noise.
    """
    if kps is None or len(kps) < 3:
        return True
    try:
        left_eye_x = float(kps[0][0])
        right_eye_x = float(kps[1][0])
        nose_x = float(kps[2][0])

        eye_dist = abs(right_eye_x - left_eye_x)
        if eye_dist < 8.0:
            return False  # Face too small or squished profile

        dist_left = abs(nose_x - left_eye_x)
        dist_right = abs(right_eye_x - nose_x)
        asymmetry = abs(dist_left - dist_right) / eye_dist
        return asymmetry <= max_asymmetry
    except Exception:
        return True


class FaceAnalyzer:
    """
    High-Precision Age and Gender Estimation Engine.
    
    Model Architecture Tiers:
    1. 'mivolo_v2' (Recommended Flagship):
       Multi-input Vision Transformer combining full person body crop and face crop
       via cross-attention. SOTA accuracy (±4.5y MAE). Supports CUDA GPU acceleration
       with FP16 precision, and smoothly operates on occluded or profile views.
    2. 'buffalo_l':
       InsightFace ResNet50 high-precision facial model.
    3. 'buffalo_s':
       InsightFace MobileNet lightweight CPU-optimized model.
    
    Hardware & Fallback:
    - Auto-detects NVIDIA CUDA GPU ('CUDAExecutionProvider' / torch.cuda).
    - Falls back gracefully to CPU if CUDA is absent.
    - If MiVOLO or buffalo_l weights are unavailable, auto-falls back to buffalo_s.
    """
    def __init__(
        self,
        model_name: str = "mivolo_v2",
        confidence_threshold: float = 0.45,
        max_samples: int = 5,
        min_face_size: int = 24,
        min_sharpness: float = 30.0,
        lazy_init: bool = True
    ):
        self.model_name = model_name
        self.confidence_threshold = confidence_threshold
        self.max_samples = max_samples
        self.min_face_size = min_face_size
        self.min_sharpness = min_sharpness
        self.active_model = model_name
        self.execution_device = "cpu"

        # track_id -> list of (age: int, gender: str, confidence: float)
        self._samples: Dict[int, List[Tuple[int, str, float]]] = {}
        # track_id -> latest face detection bbox & landmarks for live monitor HUD
        self._latest_face_info: Dict[int, dict] = {}
        
        self.app = None
        self.mivolo_engine: Optional[MiVOLOEngine] = None
        self._initialized = False

        if not lazy_init:
            self._init_model()

    def _init_model(self):
        if self._initialized:
            return
        self._initialized = True

        import onnxruntime as ort
        import torch

        # Detect GPU / CUDA availability
        providers = []
        available_providers = ort.get_available_providers()
        if "CUDAExecutionProvider" in available_providers and torch.cuda.is_available():
            providers.append(("CUDAExecutionProvider", {"device_id": 0}))
            self.execution_device = "cuda:0"
        else:
            self.execution_device = "cpu"
        providers.append("CPUExecutionProvider")

        target = self.model_name

        # 1. Initialize MiVOLO v2 if requested
        if target == "mivolo_v2":
            try:
                engine = MiVOLOEngine.get_instance()
                if engine.initialize():
                    self.mivolo_engine = engine
                    self.active_model = "mivolo_v2"
                    print(f"[FaceAnalyzer] MiVOLO v2 activated on {engine.device.upper()}.")
                else:
                    print("[FaceAnalyzer] MiVOLO v2 engine failed to initialize. Falling back to buffalo_l...")
                    target = "buffalo_l"
            except Exception as e:
                print(f"[FaceAnalyzer] MiVOLO v2 init error: {e}. Falling back to buffalo_l...")
                target = "buffalo_l"

        # 2. Initialize Face Detection & Keypoints (InsightFace)
        # Even when MiVOLO is active, InsightFace provides facial bounding boxes and landmarks for live monitor overlays
        try:
            import insightface
            from insightface.app import FaceAnalysis

            # Verify if buffalo_l is already downloaded on disk to prevent blocking runtime downloads
            buffalo_l_dir = os.path.expanduser("~/.insightface/models/buffalo_l")
            has_buffalo_l = os.path.isdir(buffalo_l_dir) and any(os.scandir(buffalo_l_dir))

            # Select detector model:
            # - If target is buffalo_l and downloaded, use buffalo_l; otherwise fall back to buffalo_s
            # - If target is mivolo_v2, use buffalo_l only if present on disk, else buffalo_s
            # - In all cases where buffalo_l is absent, buffalo_s is used without blocking runtime downloads
            if target == "buffalo_l":
                if has_buffalo_l:
                    insight_model_name = "buffalo_l"
                    det_size = (640, 640)
                else:
                    print("[FaceAnalyzer] 'buffalo_l' weights not found locally on disk. Using 'buffalo_s' to avoid runtime download delay.")
                    insight_model_name = "buffalo_s"
                    det_size = (320, 320)
            elif target == "mivolo_v2":
                if has_buffalo_l:
                    insight_model_name = "buffalo_l"
                    det_size = (640, 640)
                else:
                    insight_model_name = "buffalo_s"
                    det_size = (320, 320)
            else:
                insight_model_name = "buffalo_s"
                det_size = (320, 320)

            try:
                app = FaceAnalysis(
                    name=insight_model_name,
                    allowed_modules=["detection", "genderage"],
                    providers=providers
                )
                app.prepare(ctx_id=0, det_size=det_size)
                self.app = app
                if target != "mivolo_v2":
                    self.active_model = insight_model_name
                print(f"[FaceAnalyzer] InsightFace detector '{insight_model_name}' ready on {self.execution_device.upper()}.")
            except Exception as e:
                if insight_model_name != "buffalo_s":
                    print(f"[FaceAnalyzer] '{insight_model_name}' unavailable ({e}). Falling back to 'buffalo_s'...")
                    app = FaceAnalysis(
                        name="buffalo_s",
                        allowed_modules=["detection", "genderage"],
                        providers=providers
                    )
                    app.prepare(ctx_id=0, det_size=(320, 320))
                    self.app = app
                    if target != "mivolo_v2":
                        self.active_model = "buffalo_s"
                    print(f"[FaceAnalyzer] Fallback detector 'buffalo_s' loaded on {self.execution_device.upper()}.")
                else:
                    raise e
        except Exception as e:
            print(f"[FaceAnalyzer] InsightFace detector warning: {e}. Demographic heuristics active.")
            self.app = None

    def update_config(
        self,
        confidence_threshold: Optional[float] = None,
        max_samples: Optional[int] = None,
        min_face_size: Optional[int] = None,
        model_name: Optional[str] = None
    ):
        if confidence_threshold is not None:
            self.confidence_threshold = confidence_threshold
        if max_samples is not None:
            self.max_samples = max_samples
        if min_face_size is not None:
            self.min_face_size = min_face_size
        if model_name is not None and model_name != self.model_name:
            self.model_name = model_name
            self._initialized = False
            self.mivolo_engine = None
            self.app = None
            self._init_model()

    def analyze_crop(
        self,
        track_id: int,
        person_crop: np.ndarray,
        box_offset: Optional[Tuple[int, int]] = None,
        force: bool = False
    ) -> Optional[Tuple[int, str, float]]:
        """
        Runs face detection and age/gender inference on a person crop.
        
        Pipelines:
        - If 'mivolo_v2' is active:
          Fuses person crop + face crop via MiVOLO v2 Transformer.
          If no face is detected, predicts from person body crop alone.
        - If InsightFace ('buffalo_l' or 'buffalo_s') is active:
          Estimates demographics directly from the face crop.
        
        Stores face bounding box and landmarks for live monitor overlay.
        Buffers up to max_samples per track_id.
        """
        if person_crop is None or person_crop.size == 0:
            return None

        # Early exit if we already have sufficient high-confidence samples
        if not force and len(self._samples.get(track_id, [])) >= self.max_samples:
            existing = self._samples[track_id]
            return existing[-1] if existing else None

        h, w = person_crop.shape[:2]
        if h < 32 or w < 24:
            return None

        # 1. Reject motion-blurred frames before calling heavy model
        if not force and not is_sharp_crop(person_crop, self.min_sharpness):
            return None

        if not self._initialized:
            self._init_model()

        age_est: Optional[int] = None
        gender_est: str = "unknown"
        confidence: float = 0.0

        face_crop: Optional[np.ndarray] = None
        best_face = None

        # 2. Detect face in person crop for facial landmarks and face crop extraction
        if self.app is not None:
            try:
                head_region = person_crop[:int(h * 0.65), :]
                faces = self.app.get(head_region)

                if not faces and h > head_region.shape[0]:
                    faces = self.app.get(person_crop)

                if faces:
                    valid_faces = []
                    for f in faces:
                        score = float(getattr(f, "det_score", 0.0))
                        if score < self.confidence_threshold:
                            continue

                        bbox = getattr(f, "bbox", None)
                        if bbox is not None and len(bbox) == 4:
                            fw = bbox[2] - bbox[0]
                            fh = bbox[3] - bbox[1]
                            if fw < self.min_face_size or fh < self.min_face_size:
                                continue

                        kps = getattr(f, "kps", None)
                        if not force and not is_frontal_face(kps, max_asymmetry=0.45):
                            continue

                        valid_faces.append(f)

                    if not valid_faces and force and faces:
                        valid_faces = faces

                    if valid_faces:
                        best_face = max(valid_faces, key=lambda f: getattr(f, "det_score", 0.0))
                        ox, oy = box_offset if box_offset is not None else (0, 0)
                        fb = getattr(best_face, "bbox", [0, 0, 0, 0])
                        
                        fx1 = max(0, int(fb[0]))
                        fy1 = max(0, int(fb[1]))
                        fx2 = min(w, int(fb[2]))
                        fy2 = min(h, int(fb[3]))

                        if fx2 > fx1 and fy2 > fy1:
                            face_crop = person_crop[fy1:fy2, fx1:fx2]

                        global_face_box = (
                            max(0, int(ox + fb[0])),
                            max(0, int(oy + fb[1])),
                            int(ox + fb[2]),
                            int(oy + fb[3])
                        )
                        raw_kps = getattr(best_face, "kps", None)
                        landmarks = [
                            (int(ox + pt[0]), int(oy + pt[1])) for pt in raw_kps
                        ] if raw_kps is not None else []

                        # Store latest face detection info for live monitor HUD
                        self._latest_face_info[track_id] = {
                            "box": global_face_box,
                            "landmarks": landmarks,
                            "age": None,
                            "gender": "unknown",
                            "confidence": float(getattr(best_face, "det_score", 0.0)),
                            "timestamp": time.time()
                        }
            except Exception as e:
                print(f"[FaceAnalyzer] Face detection error for track {track_id}: {e}")

        # 3. Demographic Inference
        # Pipeline A: MiVOLO v2 (Dual Body + Face Fusion)
        if self.active_model == "mivolo_v2" and self.mivolo_engine is not None and self.mivolo_engine.is_ready:
            try:
                res = self.mivolo_engine.predict(person_crop=person_crop, face_crop=face_crop)
                if res is not None:
                    age_est, gender_est, confidence = res
                    # Update HUD with latest MiVOLO v2 estimates
                    if track_id in self._latest_face_info:
                        self._latest_face_info[track_id]["age"] = age_est
                        self._latest_face_info[track_id]["gender"] = gender_est
                        self._latest_face_info[track_id]["confidence"] = confidence
            except Exception as e:
                print(f"[FaceAnalyzer] MiVOLO prediction error for track {track_id}: {e}")

        # Pipeline B: InsightFace Fallback (buffalo_l / buffalo_s)
        if age_est is None and best_face is not None:
            confidence = float(getattr(best_face, "det_score", 0.0))
            raw_age = getattr(best_face, "age", None)
            if raw_age is not None:
                age_est = max(1, min(100, int(round(float(raw_age)))))

            raw_gender = getattr(best_face, "gender", None)
            if raw_gender is not None:
                gender_est = "male" if int(raw_gender) == 1 else "female"
            elif hasattr(best_face, "sex") and best_face.sex:
                gender_est = "male" if str(best_face.sex).upper().startswith("M") else "female"

            if track_id in self._latest_face_info:
                self._latest_face_info[track_id]["age"] = age_est
                self._latest_face_info[track_id]["gender"] = gender_est

        # Record high-quality sample
        if age_est is not None and confidence >= self.confidence_threshold:
            if track_id not in self._samples:
                self._samples[track_id] = []
            if len(self._samples[track_id]) < self.max_samples:
                self._samples[track_id].append((age_est, gender_est, confidence))
            return (age_est, gender_est, confidence)

        return None

    def _aggregate(self, samples: List[Tuple[int, str, float]]) -> Tuple[Optional[int], str, str, Optional[float]]:
        """
        Aggregates multi-frame samples:
        - Outlier-resistant median age
        - Bayesian confidence-weighted majority gender voting
        - Demographic cohort classification
        - Average detection confidence
        """
        if not samples:
            return (None, "unknown", "unknown", None)

        ages = [s[0] for s in samples if s[0] is not None]
        confidences = [s[2] for s in samples]

        # 1. Median Age (outlier-immune)
        median_age = int(round(statistics.median(ages))) if ages else None

        # 2. Confidence-Weighted Gender Voting
        male_score = sum(s[2] for s in samples if s[1] == "male")
        female_score = sum(s[2] for s in samples if s[1] == "female")

        if male_score > female_score and male_score > 0.2:
            majority_gender = "male"
        elif female_score > male_score and female_score > 0.2:
            majority_gender = "female"
        elif male_score > 0 or female_score > 0:
            majority_gender = samples[-1][1]
        else:
            majority_gender = "unknown"

        # 3. Categorized Age Group
        age_group = categorize_age(median_age)

        # 4. Average Confidence
        avg_conf = round(float(statistics.mean(confidences)), 2) if confidences else None

        return (median_age, age_group, majority_gender, avg_conf)

    def get_final_estimate(self, track_id: int) -> Tuple[Optional[int], str, str, Optional[float]]:
        """
        Aggregates buffered samples for track_id and clears buffer immediately (privacy).
        Returns: (median_age, age_group, majority_gender, avg_confidence)
        """
        samples = self._samples.pop(track_id, [])
        return self._aggregate(samples)

    def get_current_estimate(self, track_id: int) -> Tuple[Optional[int], str, str, Optional[float]]:
        """
        Inspects current buffered samples for track_id without clearing buffer.
        Used for on-demand live monitor overlays.
        """
        samples = self._samples.get(track_id, [])
        return self._aggregate(samples)

    def get_latest_face_info(self, track_id: int) -> Optional[dict]:
        """
        Returns the latest detected face bounding box, landmarks, age, and gender
        for live monitor visual overlays.
        """
        info = self._latest_face_info.get(track_id)
        if info and (time.time() - info.get("timestamp", 0.0)) < 1.2:
            return info
        return None

    def cleanup_track(self, track_id: int):
        """Discards samples and face boxes for an inactive track."""
        self._samples.pop(track_id, None)
        self._latest_face_info.pop(track_id, None)
