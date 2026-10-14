from fastapi import APIRouter
from typing import Dict, Any, List
from ...core.sync_engine import sync_engine
from ...models.metrics_models import EntityMetrics

router = APIRouter(prefix="/api/metrics", tags=["Metrics"])

@router.get("/summary")
def get_metrics_summary() -> Dict[str, Any]:
    """Mengambil metrik ringkasan transaksi seluruh sistem."""
    status = sync_engine.get_status()
    return {
        "total_inserts": status["total_inserts"],
        "total_updates": status["total_updates"],
        "total_deletes": status["total_deletes"],
        "total_transactions": status["total_transactions"],
        "current_cycle": status["current_cycle"],
        "last_sync_time": status["last_sync_time"]
    }

@router.get("/by-company")
def get_metrics_by_company() -> List[Dict[str, Any]]:
    """Mengambil rincian metrik operasi DML per entitas perusahaan (API, ANR, TTM)."""
    status = sync_engine.get_status()
    metrics = status.get("metrics_by_company", {})
    return list(metrics.values())

@router.post("/reset")
def reset_all_metrics():
    """Mereset seluruh akumulasi metrik transaksi dan riwayat log ke kondisi bersih (0)."""
    sync_engine.reset_metrics()
    return {"success": True, "message": "Seluruh metrik dan riwayat log berhasil direset ke nol bersih."}

@router.post("/node/reset")
def reset_node_metrics(node_key: str):
    """Mereset metrik DML khusus untuk node database tertentu."""
    success = sync_engine.reset_node_metrics(node_key)
    if not success:
        return {"success": False, "message": f"Node [{node_key}] tidak ditemukan."}
    return {"success": True, "message": f"Metrik transaksi untuk node [{node_key}] berhasil direset ke nol."}

@router.delete("/node")
def delete_node_metrics(node_key: str):
    """Menghapus entri riwayat metrik node tertentu."""
    success = sync_engine.delete_node_metrics(node_key)
    if not success:
        return {"success": False, "message": f"Node [{node_key}] tidak ditemukan."}
    return {"success": True, "message": f"Riwayat metrik node [{node_key}] berhasil dihapus dari dashboard."}
