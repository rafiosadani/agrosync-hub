from fastapi import APIRouter
from typing import Dict, Any
from ...core.sync_engine import sync_engine
from ...models.metrics_models import SyncControlResponse

router = APIRouter(prefix="/api/sync", tags=["Sync Control"])

@router.get("/status")
def get_sync_status() -> Dict[str, Any]:
    """Mengambil status operasional terkini dari mesin sinkronisasi."""
    return sync_engine.get_status()

@router.post("/start", response_model=SyncControlResponse)
def start_sync():
    """Memulai siklus sinkronisasi background worker."""
    success = sync_engine.start()
    return SyncControlResponse(
        success=success,
        status=sync_engine.state,
        message="Siklus sinkronisasi berhasil dimulai." if success else "Siklus sinkronisasi sudah berjalan."
    )

@router.post("/pause", response_model=SyncControlResponse)
def pause_sync():
    """Menjeda siklus sinkronisasi."""
    success = sync_engine.pause()
    return SyncControlResponse(
        success=success,
        status=sync_engine.state,
        message="Siklus sinkronisasi berhasil dijeda." if success else "Tidak dapat menjeda siklus saat ini."
    )

@router.post("/resume", response_model=SyncControlResponse)
def resume_sync():
    """Melanjutkan siklus sinkronisasi yang dijeda."""
    success = sync_engine.resume()
    return SyncControlResponse(
        success=success,
        status=sync_engine.state,
        message="Siklus sinkronisasi dilanjutkan kembali." if success else "Siklus tidak dalam kondisi jeda."
    )

@router.post("/stop", response_model=SyncControlResponse)
def stop_sync():
    """Menghentikan siklus sinkronisasi."""
    success = sync_engine.stop()
    return SyncControlResponse(
        success=success,
        status=sync_engine.state,
        message="Siklus sinkronisasi dihentikan."
    )

@router.post("/trigger", response_model=SyncControlResponse)
def trigger_now():
    """Memicu siklus sinkronisasi instan (on-demand) 1 kali jalan tanpa perulangan interval."""
    res = sync_engine.sync_once()
    return SyncControlResponse(
        success=res.get("success", False),
        status=sync_engine.state,
        message=res.get("message", "Sinkronisasi instan (on-demand) berhasil dipicu.")
    )
