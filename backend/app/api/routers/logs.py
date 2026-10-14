from fastapi import APIRouter, Query
from typing import List, Optional
from ...core.sync_engine import sync_engine
from ...models.metrics_models import ActivityLogItem

router = APIRouter(prefix="/api/logs", tags=["Activity Logs"])

@router.get("", response_model=List[ActivityLogItem])
def get_activity_logs(
    limit: int = Query(100, ge=1, le=500),
    company: Optional[str] = None,
    level: Optional[str] = None,
    search: Optional[str] = None
):
    """Mengambil riwayat log aktivitas dan perubahan DML dengan filter dinamis."""
    return sync_engine.get_logs(limit=limit, company=company, level=level, search=search)

@router.delete("")
def clear_activity_logs():
    """Mengosongkan buffer log aktivitas."""
    sync_engine.clear_logs()
    return {"success": True, "message": "Log aktivitas berhasil dibersihkan."}
