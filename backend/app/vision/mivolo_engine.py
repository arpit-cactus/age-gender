import threading
import logging
from typing import Optional, Tuple
import numpy as np

logger = logging.getLogger(__name__)

class MiVOLOEngine:
    """
    High-Precision Age and Gender Estimation Engine using MiVOLO v2.
    
    Architecture:
    - Multi-input Vision Transformer (MiVOLO v2) fusing person body crop and face crop
      via cross-attention.
    - If face crop is unavailable (e.g., person facing away or occluded), gracefully
      predicts age and gender purely from the full body crop.
    - Automatically accelerates on NVIDIA CUDA GPUs with FP16 precision (~12-20ms per inference).
    - If CUDA is not available or encounters runtime memory/driver errors, falls back smoothly to CPU.
    - Thread-safe singleton for shared camera stream workers.
    """
    _instance: Optional["MiVOLOEngine"] = None
    _instance_lock = threading.Lock()

    @classmethod
    def get_instance(cls, model_id: str = "iitolstykh/mivolo_v2", device: Optional[str] = None) -> "MiVOLOEngine":
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = cls(model_id=model_id, device=device)
            return cls._instance

    def __init__(self, model_id: str = "iitolstykh/mivolo_v2", device: Optional[str] = None):
        self.model_id = model_id
        self._custom_device = device
        self.device = "cpu"
        self.dtype = None
        self.model = None
        self.processor = None
        self.config = None
        self.is_ready = False
        self._lock = threading.Lock()
        self._init_error: Optional[str] = None
        self._initialized = False

    def initialize(self) -> bool:
        """Loads and initializes the MiVOLO v2 model and image processor."""
        if self._initialized:
            return self.is_ready

        with self._lock:
            if self._initialized:
                return self.is_ready
            self._initialized = True

            try:
                import torch
                from transformers import AutoModelForImageClassification, AutoImageProcessor, AutoConfig

                if self._custom_device:
                    self.device = self._custom_device
                else:
                    self.device = "cuda:0" if torch.cuda.is_available() else "cpu"

                self.dtype = torch.float16 if "cuda" in self.device else torch.float32

                logger.info(f"[MiVOLO] Initializing '{self.model_id}' on {self.device.upper()} ({self.dtype})...")
                print(f"[MiVOLO] Initializing '{self.model_id}' on {self.device.upper()} ({self.dtype})...")

                self.config = AutoConfig.from_pretrained(self.model_id, trust_remote_code=True)
                self.processor = AutoImageProcessor.from_pretrained(self.model_id, trust_remote_code=True)
                
                try:
                    self.model = AutoModelForImageClassification.from_pretrained(
                        self.model_id,
                        trust_remote_code=True,
                        torch_dtype=self.dtype
                    ).to(self.device)
                except Exception as cuda_err:
                    if self.device != "cpu":
                        print(f"[MiVOLO] Failed to load on {self.device}: {cuda_err}. Falling back to CPU...")
                        self.device = "cpu"
                        self.dtype = torch.float32
                        self.model = AutoModelForImageClassification.from_pretrained(
                            self.model_id,
                            trust_remote_code=True,
                            torch_dtype=self.dtype
                        ).to("cpu")
                    else:
                        raise cuda_err

                self.model.eval()
                self.is_ready = True
                print(f"[MiVOLO] Ready on {self.device.upper()} ({self.dtype}).")
                return True

            except Exception as e:
                self._init_error = str(e)
                self.is_ready = False
                logger.error(f"[MiVOLO] Failed to initialize MiVOLO v2: {e}")
                print(f"[MiVOLO] Initialization warning: {e}. Graceful fallback will be used.")
                return False

    def predict(
        self,
        person_crop: np.ndarray,
        face_crop: Optional[np.ndarray] = None
    ) -> Optional[Tuple[int, str, float]]:
        """
        Runs dual-input or single-input age and gender inference.
        
        Args:
            person_crop: BGR numpy image of the full person body.
            face_crop: Optional BGR numpy image of the detected facial region.
            
        Returns:
            Tuple of (age: int, gender: str, confidence: float) or None on failure.
        """
        if not self._initialized:
            self.initialize()

        if not self.is_ready or self.model is None or self.processor is None:
            return None

        if person_crop is None or person_crop.size == 0:
            return None

        import torch

        # If no face is detected, pass a blank zero-frame to trigger body-only fusion
        if face_crop is None or face_crop.size == 0 or face_crop.shape[0] < 12 or face_crop.shape[1] < 12:
            face_input_img = np.zeros((384, 384, 3), dtype=np.uint8)
        else:
            face_input_img = face_crop

        try:
            with self._lock:
                faces_input = self.processor(images=[face_input_img])["pixel_values"].to(self.device, dtype=self.dtype)
                body_input = self.processor(images=[person_crop])["pixel_values"].to(self.device, dtype=self.dtype)

                with torch.no_grad():
                    output = self.model(faces_input=faces_input, body_input=body_input)

                # Extract Age
                raw_age = float(output.age_output[0].item())
                age = max(1, min(100, int(round(raw_age))))

                # Extract Gender
                gender_idx = int(output.gender_class_idx[0].item())
                id2label = getattr(self.config, "gender_id2label", {0: "male", 1: "female"})
                gender = id2label.get(gender_idx) or id2label.get(str(gender_idx)) or ("male" if gender_idx == 0 else "female")
                gender = str(gender).lower()

                # Extract Confidence
                confidence = float(output.gender_probs[0].item())

                return (age, gender, round(confidence, 3))

        except Exception as e:
            if "cuda" in self.device:
                logger.warning(f"[MiVOLO] CUDA inference error: {e}. Recovering to CPU...")
                print(f"[MiVOLO] CUDA inference error: {e}. Recovering to CPU...")
                try:
                    with self._lock:
                        self.device = "cpu"
                        self.dtype = torch.float32
                        self.model = self.model.to("cpu").to(self.dtype)
                        faces_input = self.processor(images=[face_input_img])["pixel_values"].to("cpu", dtype=torch.float32)
                        body_input = self.processor(images=[person_crop])["pixel_values"].to("cpu", dtype=torch.float32)
                        with torch.no_grad():
                            output = self.model(faces_input=faces_input, body_input=body_input)

                        raw_age = float(output.age_output[0].item())
                        age = max(1, min(100, int(round(raw_age))))
                        gender_idx = int(output.gender_class_idx[0].item())
                        id2label = getattr(self.config, "gender_id2label", {0: "male", 1: "female"})
                        gender = id2label.get(gender_idx) or id2label.get(str(gender_idx)) or ("male" if gender_idx == 0 else "female")
                        gender = str(gender).lower()
                        confidence = float(output.gender_probs[0].item())
                        return (age, gender, round(confidence, 3))
                except Exception as cpu_e:
                    logger.error(f"[MiVOLO] Fallback CPU inference error: {cpu_e}")
                    return None
            else:
                logger.error(f"[MiVOLO] Prediction error: {e}")
                return None
