from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class NodeHealth(BaseModel):
    id: int
    company_name: str
    database_pusat: str
    database_lokal: str
    server_pusat: Optional[str] = None
    server_lokal: Optional[str] = None
    pusat_online: bool
    pusat_latency_ms: float
    pusat_error: Optional[str] = None
    lokal_online: bool
    lokal_latency_ms: float
    lokal_error: Optional[str] = None
    overall_status: str  # "HEALTHY", "DEGRADED", "OFFLINE"

class OverallSystemHealth(BaseModel):
    status: str  # "HEALTHY", "WARNING", "CRITICAL"
    total_nodes: int
    healthy_nodes: int
    degraded_nodes: int
    offline_nodes: int
    engine_status: str  # "RUNNING", "IDLE", "PAUSED", "STOPPED", "ERROR"
    last_sync_time: Optional[str] = None
    nodes: List[NodeHealth]

class DmlMetrics(BaseModel):
    inserts: int = 0
    updates: int = 0
    deletes: int = 0
    total_transactions: int = 0

class EntityMetrics(BaseModel):
    node_key: Optional[str] = None
    company_name: str
    database_pusat: Optional[str] = None
    database_lokal: Optional[str] = None
    server_pusat: Optional[str] = None
    server_lokal: Optional[str] = None
    total_inserts: int = 0
    total_updates: int = 0
    total_deletes: int = 0
    total_tables_synced: int = 0
    last_sync_time: Optional[str] = None
    status: str = "IDLE"  # "SYNCING", "COMPLETED", "FAILED"
    is_active: bool = True

class TableSyncSummary(BaseModel):
    company_name: str
    table_name: str
    inserts: int = 0
    updates: int = 0
    deletes: int = 0
    timestamp: str

class ActivityLogItem(BaseModel):
    id: str
    timestamp: str
    level: str  # "INFO", "SUCCESS", "WARNING", "ERROR"
    company_name: Optional[str] = None
    table_name: Optional[str] = None
    message: str
    inserts: int = 0
    updates: int = 0
    deletes: int = 0

class SyncControlResponse(BaseModel):
    success: bool
    status: str
    message: str
