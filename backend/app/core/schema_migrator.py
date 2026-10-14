import json
import os
import pyodbc
from typing import Dict, List, Any
from ..config import SCHEMA_AUDIT_PATH, CURRENT_ODBC_DRIVER
from .config_manager import ConfigManager
from .sync_engine import sync_engine
from .connection_tester import normalize_server_address

def map_sql_type(col_metadata):
    """Penerjemah tipe data SQL Server secara akurat berdasarkan metadata audit"""
    dt = col_metadata["DataType"].lower()
    max_length = col_metadata["MaxLength"]
    
    if dt in ('varchar', 'char'):
        return f"VARCHAR({max_length})" if str(max_length) != 'MAX' else "VARCHAR(MAX)"
    elif dt in ('nvarchar', 'nchar'):
        return f"NVARCHAR({max_length})" if str(max_length) != 'MAX' else "NVARCHAR(MAX)"
    elif dt in ('varbinary', 'binary', 'image'):
        return f"VARBINARY({max_length})" if str(max_length) != 'MAX' else "VARBINARY(MAX)"
    elif dt in ('decimal', 'numeric'):
        precision = col_metadata.get("NumericPrecision", 25)
        scale = col_metadata.get("NumericScale", 5)
        if precision == 0:
            precision = 25
        return f"DECIMAL({precision}, {scale})"
    elif dt == 'float':
        return "FLOAT"
    elif dt == 'int':
        return "INT"
    elif dt in ('datetime', 'smalldatetime'):
        return "DATETIME"
    elif dt == 'date':
        return "DATE"
    elif dt == 'bit':
        return "BIT"
    elif dt == 'uniqueidentifier':
        return "UNIQUEIDENTIFIER"
    elif dt in ('timestamp', 'rowversion'):
        return "VARBINARY(8)"
    else:
        return f"VARCHAR(MAX)"

def run_ddl_migration_for_node(config: Dict[str, Any], schema_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    comp_name = config["CompanyName"]
    db_lokal = config["DatabaseLokal"]
    server_lokal = normalize_server_address(config["ServerLokal"])
    user_lokal = config["UserLokal"]
    pwd_lokal = config["PasswordLokal"]

    result = {
        "company_name": comp_name,
        "database": db_lokal,
        "status": "SUCCESS",
        "created_tables": 0,
        "updated_tables": 0,
        "altered_columns": 0,
        "errors": []
    }

    # 1. Pastikan database lokal ada
    master_conn_str = (
        f"DRIVER={{{CURRENT_ODBC_DRIVER}}};"
        f"SERVER={server_lokal};"
        f"DATABASE=master;"
        f"UID={user_lokal};"
        f"PWD={pwd_lokal};"
        f"TrustServerCertificate=yes;"
    )

    try:
        master_conn = pyodbc.connect(master_conn_str, autocommit=True, timeout=5)
        master_cursor = master_conn.cursor()
        master_cursor.execute(f"SELECT database_id FROM sys.databases WHERE name = '{db_lokal}'")
        if not master_cursor.fetchone():
            master_cursor.execute(f"CREATE DATABASE [{db_lokal}];")
            sync_engine.add_log("INFO", f"[{comp_name}] Database lokal '{db_lokal}' otomatis dibuat.", comp_name)
        master_cursor.close()
        master_conn.close()
    except Exception as e:
        err_msg = f"Gagal membuat database master: {e}"
        result["status"] = "ERROR"
        result["errors"].append(err_msg)
        sync_engine.add_log("ERROR", f"[{comp_name}] {err_msg}", comp_name)
        return result

    # 2. Migrasi skema cerdas
    db_conn_str = (
        f"DRIVER={{{CURRENT_ODBC_DRIVER}}};"
        f"SERVER={server_lokal};"
        f"DATABASE={db_lokal};"
        f"UID={user_lokal};"
        f"PWD={pwd_lokal};"
        f"TrustServerCertificate=yes;"
    )

    tables = {}
    for row in schema_data:
        t_name = row["TableName"]
        if t_name not in tables:
            tables[t_name] = []
        tables[t_name].append(row)

    try:
        conn = pyodbc.connect(db_conn_str, timeout=5)
        cursor = conn.cursor()

        for table_name, columns in tables.items():
            cursor.execute("""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = ?
            """, table_name)
            table_exists = cursor.fetchone()[0] > 0

            if not table_exists:
                sql_columns = []
                primary_keys = []
                unique_constraints = []

                for col in columns:
                    c_name = col["ColumnName"]
                    d_type = map_sql_type(col)
                    nullable = "NULL" if col["IsNullable"] == "YES" else "NOT NULL"
                    sql_columns.append(f"    [{c_name}] {d_type} {nullable}")

                    if col["IsPrimaryKey"] == "YES":
                        primary_keys.append(f"[{c_name}]")
                    if col.get("IsUnique") == "YES":
                        unique_constraints.append(f"CONSTRAINT UQ_{table_name}_{c_name} UNIQUE ([{c_name}])")

                if primary_keys:
                    sql_columns.append(f"    PRIMARY KEY ({', '.join(primary_keys)})")
                for uq in unique_constraints:
                    sql_columns.append(f"    {uq}")

                create_sql = f"CREATE TABLE [{table_name}] (\n" + ",\n".join(sql_columns) + "\n);"
                try:
                    cursor.execute(create_sql)
                    conn.commit()
                    result["created_tables"] += 1
                except Exception as err:
                    result["errors"].append(f"Create [{table_name}]: {err}")
            else:
                cursor.execute("""
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = ?
                """, table_name)
                existing_cols = {row[0].lower() for row in cursor.fetchall()}

                altered_for_table = 0
                for col in columns:
                    c_name = col["ColumnName"]
                    if c_name.lower() not in existing_cols:
                        d_type = map_sql_type(col)
                        alter_sql = f"ALTER TABLE [{table_name}] ADD [{c_name}] {d_type} NULL;"
                        try:
                            cursor.execute(alter_sql)
                            conn.commit()
                            altered_for_table += 1
                            result["altered_columns"] += 1
                        except Exception as alt_err:
                            result["errors"].append(f"Alter [{table_name}].[{c_name}]: {alt_err}")

                result["updated_tables"] += 1

        cursor.close()
        conn.close()
        sync_engine.add_log(
            "SUCCESS",
            f"[{comp_name}] Migrasi DDL selesai: {result['created_tables']} tabel baru, {result['updated_tables']} tabel diverifikasi, {result['altered_columns']} kolom baru.",
            comp_name
        )
    except Exception as ex:
        result["status"] = "ERROR"
        result["errors"].append(str(ex))
        sync_engine.add_log("ERROR", f"[{comp_name}] Gagal migrasi skema: {ex}", comp_name)

    return result

def run_all_schema_migrations() -> List[Dict[str, Any]]:
    if not os.path.exists(SCHEMA_AUDIT_PATH):
        raise FileNotFoundError(f"File metadata schema audit tidak ditemukan di {SCHEMA_AUDIT_PATH}")
    
    with open(SCHEMA_AUDIT_PATH, "r", encoding="utf-8") as f:
        schema_data = json.load(f)

    configs = ConfigManager.get_all_raw()
    results = []
    for cfg in configs:
        res = run_ddl_migration_for_node(cfg, schema_data)
        results.append(res)
    return results
