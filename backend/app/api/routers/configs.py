from fastapi import APIRouter, HTTPException, status
from typing import List
from ...models.config_models import (
    DatabaseNodeConfig, 
    DatabaseNodeMasked, 
    DatabaseNodeUpdate, 
    ConnectionTestRequest, 
    ConnectionTestResponse,
    CreateDatabaseRequest,
    CreateDatabaseResponse,
    FetchDatabasesRequest,
    FetchDatabasesResponse,
    BatchCreateConfigRequest,
    BatchCreateConfigResponse
)
from ...core.config_manager import ConfigManager
from ...core.connection_tester import test_sql_connection, create_sql_database, fetch_sql_databases

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
    """Menambahkan node database baru ke file sync_config.json secara aman dengan validasi anti-duplikasi."""
    try:
        return ConfigManager.add_node(node)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch", response_model=BatchCreateConfigResponse, status_code=status.HTTP_201_CREATED)
def create_configs_batch(payload: BatchCreateConfigRequest):
    """Menambahkan banyak konfigurasi node database sekaligus (Batch Creation)."""
    try:
        created = ConfigManager.add_nodes_batch(payload.nodes)
        return BatchCreateConfigResponse(
            success=True,
            message=f"Berhasil menambahkan {len(created)} konfigurasi node database baru.",
            nodes=created
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{node_id}", response_model=DatabaseNodeMasked)
def update_config(node_id: int, updates: DatabaseNodeUpdate):
    """Memperbarui konfigurasi node database."""
    try:
        return ConfigManager.update_node(node_id, updates)
    except ValueError as e:
        err_msg = str(e)
        code = status.HTTP_409_CONFLICT if ("Duplikasi" in err_msg or "Konflik" in err_msg) else status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=code, detail=err_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{node_id}")
def delete_config(node_id: int):
    """Menghapus node database dari sync_config.json."""
    raw = ConfigManager.get_all_raw()
    deleted_cfg = raw[node_id] if (0 <= node_id < len(raw)) else None

    success = ConfigManager.delete_node(node_id)
    if not success:
        raise HTTPException(status_code=404, detail="Node tidak ditemukan")

    if deleted_cfg:
        db_p = deleted_cfg.get("DatabasePusat", "")
        srv_l = deleted_cfg.get("ServerLokal", "")
        sync_engine.remove_metrics_for_config(db_p=db_p, srv_l=srv_l)

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


@router.post("/fetch-databases", response_model=FetchDatabasesResponse)
def fetch_databases(payload: FetchDatabasesRequest):
    """Mengambil daftar seluruh database aktif (user databases) dari SQL Server."""
    pwd = payload.password
    if (not pwd or pwd == "••••••••") and payload.node_id is not None:
        cfg = ConfigManager.get_by_id(payload.node_id)
        if cfg:
            pwd = cfg.get("PasswordPusat" if payload.role == "pusat" else "PasswordLokal", "")

    ok, dbs, msg = fetch_sql_databases(
        server=payload.server,
        user=payload.user,
        password=pwd
    )
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return FetchDatabasesResponse(success=True, databases=dbs, message=msg)

