import time
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Response, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Camera, User
from ..schemas import CameraIn, CameraUpdate, CameraOut
from ..security import get_current_user, get_current_admin
from ..services.camera_manager import camera_manager

router = APIRouter(prefix="/cameras", tags=["cameras"])

@router.get("", response_model=List[CameraOut])
def list_cameras(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Camera).order_by(Camera.id.asc()).all()

@router.post("", response_model=CameraOut, status_code=status.HTTP_201_CREATED)
def create_camera(
    cam_in: CameraIn,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    new_cam = Camera(
        name=cam_in.name,
        source=cam_in.source,
        line_x1=cam_in.line_x1,
        line_y1=cam_in.line_y1,
        line_x2=cam_in.line_x2,
        line_y2=cam_in.line_y2,
        lines_json=cam_in.lines_json,
        roi_x1=cam_in.roi_x1,
        roi_y1=cam_in.roi_y1,
        roi_x2=cam_in.roi_x2,
        roi_y2=cam_in.roi_y2,
        in_direction=cam_in.in_direction,
        status="stopped"
    )
    db.add(new_cam)
    db.commit()
    db.refresh(new_cam)
    return new_cam

@router.get("/{camera_id}", response_model=CameraOut)
def get_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    return cam

@router.put("/{camera_id}", response_model=CameraOut)
def update_camera(
    camera_id: int,
    cam_in: CameraUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    update_data = cam_in.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(cam, k, v)

    db.commit()
    db.refresh(cam)
    
    # Notify camera manager of updated config
    camera_manager.update_camera_config(camera_id, db)
    return cam

@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    camera_manager.stop_camera(camera_id, db)
    db.delete(cam)
    db.commit()
    return None

@router.post("/{camera_id}/start")
def start_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    success = camera_manager.start_camera(camera_id, db)
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to start camera")

    db.refresh(cam)
    return {"message": "Camera started", "status": cam.status}

@router.post("/{camera_id}/stop")
def stop_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    camera_manager.stop_camera(camera_id, db)
    db.refresh(cam)
    return {"message": "Camera stopped", "status": cam.status}

@router.get("/{camera_id}/snapshot")
def get_camera_snapshot(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    frame_bytes = camera_manager.get_snapshot(camera_id, db)
    return Response(content=frame_bytes, media_type="image/jpeg")

@router.post("/{camera_id}/snapshot")
async def upload_camera_snapshot(
    camera_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty image file")

    camera_manager.set_snapshot(camera_id, content)
    return {"message": "Calibration snapshot updated successfully"}

@router.get("/{camera_id}/stream")
def stream_camera_feed(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    On-demand MJPEG stream with live detection annotations (boxes, age, gender, count HUD).
    Activates the camera worker and monitor mode only while the stream is actively consumed.
    Immediately shuts down annotations and encoding upon client disconnect.
    """
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    # Start camera worker if not already running
    camera_manager.start_camera(camera_id, db)
    # Increment active monitor subscribers
    camera_manager.start_monitor(camera_id)

    def frame_generator():
        try:
            last_frame: bytes = b""
            empty_cycles = 0
            while True:
                frame_bytes = camera_manager.get_annotated_frame(camera_id)
                if frame_bytes:
                    last_frame = frame_bytes
                    empty_cycles = 0
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                    )
                elif last_frame:
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n" + last_frame + b"\r\n"
                    )
                else:
                    # Initial spin-up: yield raw snapshot until annotations are ready
                    raw_snap = camera_manager.get_snapshot(camera_id, db)
                    if raw_snap:
                        yield (
                            b"--frame\r\n"
                            b"Content-Type: image/jpeg\r\n\r\n" + raw_snap + b"\r\n"
                        )
                time.sleep(0.08)
        except (GeneratorExit, Exception):
            pass
        finally:
            # Client disconnected: decrement monitor count to stop drawing annotations
            camera_manager.stop_monitor(camera_id)

    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )
