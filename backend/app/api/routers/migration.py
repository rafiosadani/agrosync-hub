import json
import os
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from ...config import SCHEMA_AUDIT_PATH
from ...core.schema_migrator import run_all_schema_migrations

router = APIRouter(prefix="/api/migration", tags=["DDL Migration"])

@router.get("/audit-summary")
def get_audit_summary() -> Dict[str, Any]:
    """Membaca ringkasan audit skema dari database_schema_audit.json"""
    if not os.path.exists(SCHEMA_AUDIT_PATH):
        raise HTTPException(status_code=404, detail="File audit skema tidak ditemukan")

    try:
        with open(SCHEMA_AUDIT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        tables = set()
        columns_count = len(data)
        primary_keys_count = 0

        for col in data:
            tables.add(col.get("TableName"))
            if col.get("IsPrimaryKey") == "YES":
                primary_keys_count += 1

        return {
            "total_tables": len(tables),
            "total_columns": columns_count,
            "total_primary_keys": primary_keys_count,
            "sample_tables": sorted(list(tables))[:20]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/run")
def trigger_migration() -> List[Dict[str, Any]]:
    """Menjalankan migrasi DDL cerdas (Smart Alter / Auto Create) untuk semua node database."""
    try:
        results = run_all_schema_migrations()
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menjalankan migrasi DDL: {e}")
