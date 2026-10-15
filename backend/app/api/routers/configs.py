from fastapi import APIRouter, HTTPException, status
from typing import List
from ...models.config_models import (
    DatabaseNodeConfig, 
    DatabaseNodeMasked, 
    DatabaseNodeUpdate, 
    ConnectionTestRequest, 
    ConnectionTestResponse,
    CreateDatabaseRequest,
    CreateDatabaseResponse
)
from ...core.config_manager import ConfigManager
from ...core.connection_tester import test_sql_connection, create_sql_database

router = APIRouter(prefix="/api/configs", tags=["Node Configuration"])

@router.get("", response_model=List[DatabaseNodeMasked])
def get_all_configs():
    """Mengambil seluruh daftar node database dengan password ter-masking."""
    return ConfigManager.get_all_masked()

@router.get("/{node_id}", response_model=DatabaseNodeMasked)
def get_config_by_id(node_id: int):
    """Mengambil data spesifik node database."""
    node = ConfigManager.get_by_id(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node database tidak ditemukan")
    return DatabaseNodeMasked(
        id=node_id,
        CompanyName=node["CompanyName"],
        ServerPusat=node["ServerPusat"],
        DatabasePusat=node["DatabasePusat"],
        UserPusat=node["UserPusat"],
        PasswordPusat="••••••••",
        ServerLokal=node["ServerLokal"],
        DatabaseLokal=node["DatabaseLokal"],
        UserLokal=node["UserLokal"],
        PasswordLokal="••••••••"
    )

@router.post("", response_model=DatabaseNodeMasked, status_code=status.HTTP_201_CREATED)
def create_config(node: DatabaseNodeConfig):
    """Menambahkan node database baru ke file sync_config.json secara aman."""
    return ConfigManager.add_node(node)

@router.put("/{node_id}", response_model=DatabaseNodeMasked)
def update_config(node_id: int, updates: DatabaseNodeUpdate):
    """Memperbarui konfigurasi node database."""
    try:
        return ConfigManager.update_node(node_id, updates)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{node_id}")
def delete_config(node_id: int):
    """Menghapus node database dari sync_config.json."""
    success = ConfigManager.delete_node(node_id)
    if not success:
        raise HTTPException(status_code=404, detail="Node tidak ditemukan")
    return {"success": True, "message": f"Node ID {node_id} berhasil dihapus"}

@router.post("/test-connection", response_model=ConnectionTestResponse)
def test_connection(payload: ConnectionTestRequest):
    """Menguji koneksi ke instance SQL Server secara real-time dan mengukur latensi."""
    pwd = payload.password
    if (not pwd or pwd == "••••••••") and payload.node_id is not None:
        cfg = ConfigManager.get_by_id(payload.node_id)
        if cfg:
            pwd = cfg.get("PasswordPusat" if payload.role == "pusat" else "PasswordLokal", "")

    success, latency, msg, ver, srv_online, db_exists = test_sql_connection(
        server=payload.server,
        database=payload.database,
        user=payload.user,
        password=pwd
    )
    return ConnectionTestResponse(
        success=success,
        latency_ms=latency,
        message=msg,
        version=ver,
        server_online=srv_online,
        database_exists=db_exists
    )

@router.post("/create-database", response_model=CreateDatabaseResponse)
def create_database(payload: CreateDatabaseRequest):
    """Membuat database baru di target SQL Server secara otomatis."""
    ok, msg = create_sql_database(
        server=payload.server,
        database=payload.database,
        user=payload.user,
        password=payload.password
    )
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return CreateDatabaseResponse(success=True, message=msg)

