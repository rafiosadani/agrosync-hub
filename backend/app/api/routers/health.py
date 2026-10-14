import time
from fastapi import APIRouter, Query
from typing import List, Optional
from concurrent.futures import ThreadPoolExecutor
from ...models.metrics_models import OverallSystemHealth, NodeHealth
from ...core.config_manager import ConfigManager
from ...core.sync_engine import sync_engine
from ...core.connection_tester import test_sql_connection

router = APIRouter(prefix="/api/health", tags=["System Health"])

_health_cache: Optional[OverallSystemHealth] = None
_last_health_check_time: float = 0.0
CACHE_TTL_SECONDS: float = 10.0

def check_single_node(idx_and_cfg) -> NodeHealth:
    idx, cfg = idx_and_cfg
    p_ok, p_lat, p_msg, *_ = test_sql_connection(
        cfg["ServerPusat"], cfg["DatabasePusat"], cfg["UserPusat"], cfg["PasswordPusat"], timeout=5
    )
    l_ok, l_lat, l_msg, *_ = test_sql_connection(
        cfg["ServerLokal"], cfg["DatabaseLokal"], cfg["UserLokal"], cfg["PasswordLokal"], timeout=5
    )

    if p_ok and l_ok:
        overall = "HEALTHY"
    elif p_ok or l_ok:
        overall = "DEGRADED"
    else:
        overall = "OFFLINE"

    return NodeHealth(
        id=idx,
        company_name=cfg.get("CompanyName", "UNKNOWN"),
        database_pusat=cfg.get("DatabasePusat", ""),
        database_lokal=cfg.get("DatabaseLokal", ""),
        server_pusat=cfg.get("ServerPusat", ""),
        server_lokal=cfg.get("ServerLokal", ""),
        pusat_online=p_ok,
        pusat_latency_ms=p_lat,
        pusat_error=None if p_ok else p_msg,
        lokal_online=l_ok,
        lokal_latency_ms=l_lat,
        lokal_error=None if l_ok else l_msg,
        overall_status=overall
    )

@router.get("", response_model=OverallSystemHealth)
def get_system_health(force: bool = Query(False, description="Paksa cek koneksi ulang secara live")):
    """Mengambil status kesehatan sistem dan node database dengan TTL caching cerdas untuk mencegah connection churn."""
    global _health_cache, _last_health_check_time

    now = time.time()
    raw_configs = ConfigManager.get_all_raw()
    eng_status = sync_engine.get_status()

    # Gunakan cache jika masih dalam batas TTL dan konfigurasi tidak berubah
    if not force and _health_cache is not None and (now - _last_health_check_time) < CACHE_TTL_SECONDS:
        if _health_cache.total_nodes == len(raw_configs):
            _health_cache.engine_status = eng_status["state"]
            _health_cache.last_sync_time = eng_status["last_sync_time"]
            return _health_cache

    if raw_configs:
        with ThreadPoolExecutor(max_workers=max(len(raw_configs) * 2, 4)) as executor:
            node_health_list = list(executor.map(check_single_node, enumerate(raw_configs)))
    else:
        node_health_list = []

    healthy_count = sum(1 for n in node_health_list if n.overall_status == "HEALTHY")
    degraded_count = sum(1 for n in node_health_list if n.overall_status == "DEGRADED")
    offline_count = sum(1 for n in node_health_list if n.overall_status == "OFFLINE")

    if offline_count > 0:
        system_status = "CRITICAL"
    elif degraded_count > 0:
        system_status = "WARNING"
    else:
        system_status = "HEALTHY"

    _health_cache = OverallSystemHealth(
        status=system_status,
        total_nodes=len(raw_configs),
        healthy_nodes=healthy_count,
        degraded_nodes=degraded_count,
        offline_nodes=offline_count,
        engine_status=eng_status["state"],
        last_sync_time=eng_status["last_sync_time"],
        nodes=node_health_list
    )
    _last_health_check_time = now

    return _health_cache
