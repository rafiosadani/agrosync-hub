import time
from fastapi import APIRouter, Query
from typing import List, Optional
from pydantic import BaseModel, Field
from concurrent.futures import ThreadPoolExecutor
from ...models.metrics_models import OverallSystemHealth, NodeHealth
from ...models.config_models import DatabaseNodeUpdate
from ...core.config_manager import ConfigManager
from ...core.sync_engine import sync_engine
from ...core.connection_tester import test_sql_connection
from ...core.subnet_scanner import get_local_network_info, scan_subnet_sql_servers

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

class SubnetScanRequest(BaseModel):
    subnet_prefix: Optional[str] = None
    port: int = Field(1433, description="Port target SQL Server, default 1433")

class UpdateNodeAddressRequest(BaseModel):
    node_id: int
    role: str = Field(..., description="'pusat' atau 'lokal'")
    new_address: str = Field(..., description="Alamat host baru, misal 192.168.2.145,1433 atau HOST-SERVER,1433")

@router.get("/network-info")
def get_network_info_endpoint():
    """Mendapatkan IP LAN aktif, Hostname, dan Subnet laptop pengguna saat ini secara instan"""
    return get_local_network_info()

@router.post("/scan-subnet")
def scan_subnet_endpoint(req: Optional[SubnetScanRequest] = None):
    """
    Memindai seluruh subnet (/24) untuk mendeteksi instance SQL Server port 1433 yang aktif.
    Selesai dalam 1-2 detik secara multi-threaded.
    """
    prefix = req.subnet_prefix if req else None
    port = req.port if req and req.port else 1433
    return scan_subnet_sql_servers(subnet_prefix=prefix, port=port)

@router.post("/update-node-address")
def update_node_address_endpoint(req: UpdateNodeAddressRequest):
    """Memperbarui alamat ServerPusat atau ServerLokal pada node tertentu hasil auto-scan"""
    global _health_cache
    _health_cache = None  # Reset cache agar health check langsung live

    updates = DatabaseNodeUpdate()
    if req.role.lower() == "pusat":
        updates.ServerPusat = req.new_address
    elif req.role.lower() == "lokal":
        updates.ServerLokal = req.new_address
    else:
        raise ValueError("Role harus bernilai 'pusat' atau 'lokal'.")

    updated_node = ConfigManager.update_node(req.node_id, updates)
    sync_engine.add_log(
        "INFO",
        f"Alamat {req.role.upper()} untuk node [{updated_node.CompanyName}] diperbarui ke: {req.new_address}"
    )
    return {
        "success": True,
        "message": f"Alamat {req.role.upper()} untuk [{updated_node.CompanyName}] berhasil diperbarui.",
        "node": updated_node
    }
