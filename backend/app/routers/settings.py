from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import torch

from ..database import get_db
from ..models import User, SystemSetting
from ..schemas import SystemSettingsModel, SystemSettingsUpdate
from ..security import get_current_user, get_current_admin

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULTS = {
    "poll_interval_sec": 5,
    "process_fps": 10,
    "double_count_cooldown_sec": 10,
    "face_conf_threshold": 0.45,
    "person_conf_threshold": 0.35,
    "max_face_samples": 5,
    "face_model_name": "mivolo_v2",
}

@router.get("", response_model=SystemSettingsModel)
def get_system_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rows = db.query(SystemSetting).all()
    vals = dict(DEFAULTS)
    for r in rows:
        key = r.setting_key
        if key in vals:
            target_type = type(DEFAULTS[key])
            try:
                vals[key] = target_type(r.setting_value)
            except (ValueError, TypeError):
                pass
                
    # Detect hardware acceleration status
    has_cuda = torch.cuda.is_available()
    vals["has_cuda"] = has_cuda
    vals["active_device"] = "cuda:0" if has_cuda else "cpu"
    vals["cuda_device_name"] = torch.cuda.get_device_name(0) if has_cuda else None
    
    return SystemSettingsModel(**vals)

@router.put("", response_model=SystemSettingsModel)
def update_system_settings(
    updates: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    update_dict = updates.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        if v is not None:
            existing = db.query(SystemSetting).filter(SystemSetting.setting_key == k).first()
            if existing:
                existing.setting_value = str(v)
            else:
                db.add(SystemSetting(setting_key=k, setting_value=str(v)))
    db.commit()

    return get_system_settings(db=db, current_user=admin)
