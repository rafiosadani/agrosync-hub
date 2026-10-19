import os
import json
import time
import uuid
import threading
from datetime import datetime
from typing import Dict, List, Any, Optional
import pyodbc
from ..config import CURRENT_ODBC_DRIVER, PREFERRED_ODBC_DRIVERS, STATE_FILE_PATH
from .config_manager import ConfigManager
from ..models.metrics_models import ActivityLogItem

def handle_datetimeoffset(value):
    """Fungsi konverter agar pyodbc tidak error membaca DATETIMEOFFSET (-155)"""
    return str(value) if value else None

def get_primary_key(cursor, table_name):
    query = """
        SELECT c.name AS ColumnName
        FROM sys.indexes ind
        INNER JOIN sys.index_columns ic ON ind.object_id = ic.object_id AND ind.index_id = ic.index_id
        INNER JOIN sys.tables tab ON ind.object_id = tab.object_id
        INNER JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
        INNER JOIN sys.columns c ON tab.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE ind.is_primary_key = 1 AND tab.name = ?
    """
    cursor.execute(query, table_name)
    row = cursor.fetchone()
    return row.ColumnName if row else None

def get_table_columns(cursor, table_name):
    query = """
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
    """
    cursor.execute(query, table_name)
    return [row.COLUMN_NAME for row in cursor.fetchall()]

def get_table_columns_detail(cursor, table_name: str) -> Dict[str, Dict[str, Any]]:
    """Mengambil metadata kolom lengkap dari INFORMATION_SCHEMA.COLUMNS"""
    query = """
        SELECT 
            COLUMN_NAME, 
            DATA_TYPE, 
            CHARACTER_MAXIMUM_LENGTH, 
            NUMERIC_PRECISION, 
            NUMERIC_SCALE, 
            IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
    """
    cursor.execute(query, table_name)
    details = {}
    for row in cursor.fetchall():
        col_name = row.COLUMN_NAME
        max_len = row.CHARACTER_MAXIMUM_LENGTH
        if max_len == -1:
            max_len_str = "MAX"
        elif max_len is not None:
            max_len_str = str(max_len)
        else:
            max_len_str = "MAX"

        details[col_name] = {
            "TableName": table_name,
            "ColumnName": col_name,
            "DataType": (row.DATA_TYPE or "varchar").lower(),
            "MaxLength": max_len_str,
            "NumericPrecision": row.NUMERIC_PRECISION or 0,
            "NumericScale": row.NUMERIC_SCALE or 0,
            "IsNullable": row.IS_NULLABLE or "YES",
            "IsPrimaryKey": "NO",
            "IsUnique": "NO",
            "ReferencedTable": "-",
            "ReferencedColumn": "-"
        }
    return details

def format_sql_column_type(col_meta: Dict[str, Any]) -> str:
    """Menerjemahkan metadata kolom menjadi sintaks DDL SQL Server yang valid"""
    dt = str(col_meta.get("DataType", "varchar")).lower()
    max_len = col_meta.get("MaxLength")

    if dt in ('varchar', 'char'):
        if max_len is None or str(max_len).upper() in ('MAX', '-1'):
            return "VARCHAR(MAX)"
        return f"VARCHAR({max_len})"
    elif dt in ('nvarchar', 'nchar'):
        if max_len is None or str(max_len).upper() in ('MAX', '-1'):
            return "NVARCHAR(MAX)"
        return f"NVARCHAR({max_len})"
    elif dt in ('varbinary', 'binary', 'image'):
        if max_len is None or str(max_len).upper() in ('MAX', '-1'):
            return "VARBINARY(MAX)"
        return f"VARBINARY({max_len})"
    elif dt in ('decimal', 'numeric'):
        prec = col_meta.get("NumericPrecision") or 25
        scale = col_meta.get("NumericScale") or 5
        if prec == 0:
            prec = 25
        return f"DECIMAL({prec}, {scale})"
    elif dt == 'float':
        return "FLOAT"
    elif dt in ('int', 'bigint', 'smallint', 'tinyint'):
        return dt.upper()
    elif dt in ('datetime', 'smalldatetime', 'datetime2'):
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
        return "VARCHAR(MAX)"

def normalize_server_address(server: str) -> str:
    if not server:
        return server
    s = server.strip()
    if s.lower().startswith("localhost"):
        return s.replace("localhost", "127.0.0.1").replace("LOCALHOST", "127.0.0.1")
    return s

def get_connection_string(server, database, user, password):
    srv = normalize_server_address(server)
    return (
        f"DRIVER={{{CURRENT_ODBC_DRIVER}}};"
        f"SERVER={srv};"
        f"DATABASE={database};"
        f"UID={user};"
        f"PWD={password};"
        f"TrustServerCertificate=yes;"
    )

class EnterpriseSyncEngine:
    def __init__(self):
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._trigger_event = threading.Event()
        self._lock = threading.RLock()

        # Engine State
        self.state: str = "IDLE"  # "IDLE", "RUNNING", "PAUSED", "STOPPED", "ERROR", "SYNCING"
        self.last_sync_time: Optional[str] = None
        self.current_cycle: int = 0
        self.interval_seconds: int = 10
        self.is_active_syncing: bool = False
        self.is_syncing_once: bool = False

        # In-Memory Metrics State
        self.total_inserts: int = 0
        self.total_updates: int = 0
        self.total_deletes: int = 0
        self.metrics_by_company: Dict[str, Dict[str, Any]] = {}
        self.table_summaries: List[Dict[str, Any]] = []

        # Ring-buffer for activity logs (max 1000 items)
        self.activity_logs: List[ActivityLogItem] = []
        self._max_logs = 1000

        # Unpause initially
        self._pause_event.set()

        # Load persisted metrics & logs from disk if available
        self._load_state()

    def _load_state(self):
        """Memuat riwayat metrik transaksi dan log aktivitas dari file lokal jika ada"""
        if not os.path.exists(STATE_FILE_PATH):
            return
        try:
            with open(STATE_FILE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.total_inserts = data.get("total_inserts", 0)
            self.total_updates = data.get("total_updates", 0)
            self.total_deletes = data.get("total_deletes", 0)
            self.current_cycle = data.get("current_cycle", 0)
            self.last_sync_time = data.get("last_sync_time")
            raw_metrics = data.get("metrics_by_company", {})
            configs = []
            try:
                configs = ConfigManager.get_all_raw()
            except Exception:
                pass

            active_config_keys = [
                (f"{c.get('CompanyName')} - {c.get('DatabasePusat')} ({c.get('ServerLokal')})" if c.get('ServerLokal') else f"{c.get('CompanyName')} - {c.get('DatabasePusat')}")
                for c in configs
            ]

            migrated_metrics = {}
            unmatched_raw = {}

            # Langkah 1: Proses key yang formatnya sudah modern
            for k, val in raw_metrics.items():
                if "(" in k and ")" in k:
                    if k in active_config_keys:
                        val["is_active"] = True
                        migrated_metrics[k] = val
                    else:
                        unmatched_raw[k] = val
                else:
                    unmatched_raw[k] = val

            # Langkah 2: Cocokkan unmatched_raw secara cerdas dengan active_config_keys yang belum memiliki metrik
            # (Misalnya ketika IP ServerLokal diubah dari 192.168.2.198 ke 192.168.2.99)
            for k, val in unmatched_raw.items():
                c_name = val.get("company_name", "")
                db_p = val.get("database_pusat", "")

                # Cari active config untuk database pusat ini yang belum ada di migrated_metrics
                candidates = [
                    cfg for cfg in configs
                    if cfg.get("CompanyName") == c_name and cfg.get("DatabasePusat") == db_p and 
                    (f"{c_name} - {db_p} ({cfg.get('ServerLokal')})" if cfg.get('ServerLokal') else f"{c_name} - {db_p}") not in migrated_metrics
                ]

                if len(candidates) == 1:
                    cfg = candidates[0]
                    srv_l = cfg.get("ServerLokal", "")
                    srv_p = cfg.get("ServerPusat", "")
                    new_key = f"{c_name} - {db_p} ({srv_l})" if srv_l else f"{c_name} - {db_p}"
                    migrated_metrics[new_key] = {
                        **val,
                        "node_key": new_key,
                        "server_pusat": srv_p,
                        "server_lokal": srv_l,
                        "is_active": True
                    }
                elif len(candidates) > 1:
                    num = len(candidates)
                    for cfg in candidates:
                        srv_l = cfg.get("ServerLokal", "")
                        srv_p = cfg.get("ServerPusat", "")
                        new_key = f"{c_name} - {db_p} ({srv_l})" if srv_l else f"{c_name} - {db_p}"
                        migrated_metrics[new_key] = {
                            **val,
                            "node_key": new_key,
                            "server_pusat": srv_p,
                            "server_lokal": srv_l,
                            "total_inserts": val.get("total_inserts", 0) // num,
                            "total_updates": val.get("total_updates", 0) // num,
                            "total_deletes": val.get("total_deletes", 0) // num,
                            "is_active": True
                        }
                else:
                    # Tidak ada active config yang cocok -> tandai sebagai non-aktif / arsip
                    val["is_active"] = False
                    migrated_metrics[k] = val

            self.metrics_by_company = migrated_metrics
            raw_logs = data.get("activity_logs", [])
            self.activity_logs = [ActivityLogItem(**l) for l in raw_logs]
        except Exception as e:
            print(f"⚠️ [SyncEngine] Gagal memuat state sebelumnya: {e}")

    def _save_state(self):
        """Menyimpan akumulasi metrik transaksi dan log aktivitas ke disk secara atomic"""
        try:
            state_data = {
                "total_inserts": self.total_inserts,
                "total_updates": self.total_updates,
                "total_deletes": self.total_deletes,
                "current_cycle": self.current_cycle,
                "last_sync_time": self.last_sync_time,
                "metrics_by_company": self.metrics_by_company,
                "activity_logs": [l.model_dump() for l in self.activity_logs[:200]]
            }
            temp_path = f"{STATE_FILE_PATH}.tmp"
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(state_data, f, indent=2, ensure_ascii=False)
            os.replace(temp_path, STATE_FILE_PATH)
        except Exception as e:
            pass



    def add_log(self, level: str, message: str, company_name: Optional[str] = None, table_name: Optional[str] = None, inserts: int = 0, updates: int = 0, deletes: int = 0):
        with self._lock:
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            log_item = ActivityLogItem(
                id=str(uuid.uuid4())[:8],
                timestamp=now_str,
                level=level,
                company_name=company_name,
                table_name=table_name,
                message=message,
                inserts=inserts,
                updates=updates,
                deletes=deletes
            )
            self.activity_logs.insert(0, log_item)
            if len(self.activity_logs) > self._max_logs:
                self.activity_logs.pop()
            self._save_state()

    def get_logs(self, limit: int = 100, company: Optional[str] = None, level: Optional[str] = None, search: Optional[str] = None) -> List[ActivityLogItem]:
        with self._lock:
            result = self.activity_logs
            if company:
                result = [l for l in result if l.company_name and l.company_name.lower() == company.lower()]
            if level:
                result = [l for l in result if l.level.lower() == level.lower()]
            if search:
                s = search.lower()
                result = [l for l in result if s in l.message.lower() or (l.table_name and s in l.table_name.lower())]
            return result[:limit]

    def clear_logs(self):
        with self._lock:
            self.activity_logs.clear()
            self._save_state()

    def reset_metrics(self):
        """Mereset akumulasi metrik DML dan riwayat aktivitas kembali ke kondisi nol bersih"""
        with self._lock:
            self.total_inserts = 0
            self.total_updates = 0
            self.total_deletes = 0
            self.current_cycle = 0
            self.last_sync_time = None
            for k in self.metrics_by_company:
                self.metrics_by_company[k]["total_inserts"] = 0
                self.metrics_by_company[k]["total_updates"] = 0
                self.metrics_by_company[k]["total_deletes"] = 0
                self.metrics_by_company[k]["total_tables_synced"] = 0
                self.metrics_by_company[k]["last_sync_time"] = None
                self.metrics_by_company[k]["status"] = "STANDBY"
            self.activity_logs.clear()
            self._save_state()

    def reset_node_metrics(self, node_key: str) -> bool:
        """Mereset akumulasi metrik transaksi DML untuk 1 node tertentu kembali ke 0"""
        with self._lock:
            if node_key in self.metrics_by_company:
                old_ins = self.metrics_by_company[node_key].get("total_inserts", 0)
                old_upd = self.metrics_by_company[node_key].get("total_updates", 0)
                old_del = self.metrics_by_company[node_key].get("total_deletes", 0)

                self.total_inserts = max(0, self.total_inserts - old_ins)
                self.total_updates = max(0, self.total_updates - old_upd)
                self.total_deletes = max(0, self.total_deletes - old_del)

                self.metrics_by_company[node_key]["total_inserts"] = 0
                self.metrics_by_company[node_key]["total_updates"] = 0
                self.metrics_by_company[node_key]["total_deletes"] = 0
                self.metrics_by_company[node_key]["total_tables_synced"] = 0
                self.metrics_by_company[node_key]["last_sync_time"] = None
                self.metrics_by_company[node_key]["status"] = "STANDBY"
                self._save_state()
                self.add_log("INFO", f"Metrik transaksi untuk node [{node_key}] telah direset ke 0.")
                return True
            return False

    def delete_node_metrics(self, node_key: str) -> bool:
        """Menghapus entri metrik node tertentu dari tracking (misal node yang sudah pensiun/dihapus)"""
        with self._lock:
            if node_key in self.metrics_by_company:
                old_ins = self.metrics_by_company[node_key].get("total_inserts", 0)
                old_upd = self.metrics_by_company[node_key].get("total_updates", 0)
                old_del = self.metrics_by_company[node_key].get("total_deletes", 0)

                self.total_inserts = max(0, self.total_inserts - old_ins)
                self.total_updates = max(0, self.total_updates - old_upd)
                self.total_deletes = max(0, self.total_deletes - old_del)

                del self.metrics_by_company[node_key]
                self._save_state()
                self.add_log("INFO", f"Riwayat metrik node [{node_key}] telah dihapus dari sistem.")
                return True
            return False

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            # Pastikan setiap database node dari sync_config.json memiliki slot metrik awal
            try:
                raw_configs = ConfigManager.get_all_raw()
                active_keys = set()
                for cfg in raw_configs:
                    c_name = cfg.get("CompanyName", "UNKNOWN")
                    db_p = cfg.get("DatabasePusat", "")
                    db_l = cfg.get("DatabaseLokal", "")
                    srv_p = cfg.get("ServerPusat", "")
                    srv_l = cfg.get("ServerLokal", "")
                    key = f"{c_name} - {db_p} ({srv_l})" if srv_l else f"{c_name} - {db_p}"
                    active_keys.add(key)

                    if key not in self.metrics_by_company:
                        # Cek apakah ada old metric untuk company & db_p yang server-nya sudah tidak aktif di config
                        # (Deteksi perubahan IP / hostname saat runtime)
                        migrated_old_key = None
                        for old_k, old_val in list(self.metrics_by_company.items()):
                            if (old_val.get("company_name") == c_name and 
                                old_val.get("database_pusat") == db_p and 
                                old_k not in [f"{c.get('CompanyName')} - {c.get('DatabasePusat')} ({c.get('ServerLokal')})" for c in raw_configs]):
                                migrated_old_key = old_k
                                break

                        if migrated_old_key:
                            old_val = self.metrics_by_company.pop(migrated_old_key)
                            self.metrics_by_company[key] = {
                                **old_val,
                                "node_key": key,
                                "server_pusat": srv_p,
                                "server_lokal": srv_l,
                                "is_active": True
                            }
                            self._save_state()
                        else:
                            self.metrics_by_company[key] = {
                                "node_key": key,
                                "company_name": c_name,
                                "database_pusat": db_p,
                                "database_lokal": db_l,
                                "server_pusat": srv_p,
                                "server_lokal": srv_l,
                                "total_inserts": 0,
                                "total_updates": 0,
                                "total_deletes": 0,
                                "total_tables_synced": 0,
                                "last_sync_time": None,
                                "status": "STANDBY",
                                "is_active": True
                            }
                    else:
                        self.metrics_by_company[key]["server_pusat"] = srv_p
                        self.metrics_by_company[key]["server_lokal"] = srv_l
                        self.metrics_by_company[key]["is_active"] = True

                        # Jika node aktif ini masih 0 transaksi, tetapi ada node non-aktif untuk DB ini yang memiliki riwayat:
                        if self.metrics_by_company[key].get("total_inserts", 0) == 0:
                            for old_k, old_val in list(self.metrics_by_company.items()):
                                if (old_k != key and old_val.get("company_name") == c_name and 
                                    old_val.get("database_pusat") == db_p and 
                                    old_k not in active_keys and old_val.get("total_inserts", 0) > 0):
                                    self.metrics_by_company[key]["total_inserts"] = old_val["total_inserts"]
                                    self.metrics_by_company[key]["total_updates"] = old_val["total_updates"]
                                    self.metrics_by_company[key]["total_deletes"] = old_val["total_deletes"]
                                    self.metrics_by_company[key]["total_tables_synced"] = old_val.get("total_tables_synced", 0)
                                    self.metrics_by_company[key]["last_sync_time"] = old_val.get("last_sync_time")
                                    self.metrics_by_company[key]["status"] = old_val.get("status", "COMPLETED")
                                    del self.metrics_by_company[old_k]
                                    self._save_state()
                                    break

                for k in self.metrics_by_company:
                    self.metrics_by_company[k]["is_active"] = (k in active_keys)
            except Exception:
                pass

            return {
                "state": self.state,
                "current_cycle": self.current_cycle,
                "last_sync_time": self.last_sync_time,
                "total_inserts": self.total_inserts,
                "total_updates": self.total_updates,
                "total_deletes": self.total_deletes,
                "total_transactions": self.total_inserts + self.total_updates + self.total_deletes,
                "metrics_by_company": self.metrics_by_company,
                "interval_seconds": self.interval_seconds,
                "is_active_syncing": self.is_active_syncing,
                "is_syncing_once": self.is_syncing_once,
                "is_loop_running": bool(self._thread and self._thread.is_alive() and not self._stop_event.is_set() and self.state in ("RUNNING", "PAUSED"))
            }

    def start(self):
        with self._lock:
            if self._thread and self._thread.is_alive():
                if not self._pause_event.is_set():
                    self._pause_event.set()
                    self.state = "RUNNING"
                    self.add_log("INFO", "Siklus sinkronisasi dilanjutkan (resumed).")
                    return True
                return False

            self._stop_event.clear()
            self._pause_event.set()
            self._trigger_event.clear()
            self.state = "RUNNING"
            self._thread = threading.Thread(target=self._worker_loop, daemon=True)
            self._thread.start()
            self.add_log("INFO", "AgroSync Hub background worker berhasil dimulai.")
            return True

    def pause(self):
        with self._lock:
            if self.state == "RUNNING":
                self._pause_event.clear()
                self.state = "PAUSED"
                self._trigger_event.set()  # Unblock timer jeda interval seketika
                self.add_log("WARNING", "Siklus sinkronisasi dijeda oleh pengguna.")
                return True
            return False

    def resume(self):
        with self._lock:
            if self.state == "PAUSED":
                self._pause_event.set()
                self.state = "RUNNING"
                self.add_log("INFO", "Siklus sinkronisasi diaktifkan kembali.")
                return True
            return False

    def stop(self):
        with self._lock:
            self._stop_event.set()
            self._pause_event.set()  # Unblock if paused
            self._trigger_event.set()
            self.state = "STOPPED"
            self.add_log("INFO", "Siklus sinkronisasi dihentikan.")
            return True

    def sync_once(self) -> Dict[str, Any]:
        """
        Menjalankan tepat 1 kali siklus sinkronisasi instan (on-demand) tanpa mengaktifkan loop berulang.
        Memiliki proteksi timbal-balik agar tidak bertabrakan dengan siklus otomatis.
        """
        with self._lock:
            if self.state == "RUNNING":
                return {
                    "success": False,
                    "message": "Siklus otomatis sedang berjalan aktif berulang. Sync on-demand dinonaktifkan."
                }
            if self.is_syncing_once or self.is_active_syncing:
                return {
                    "success": False,
                    "message": "Siklus sinkronisasi sedang berlangsung. Harap tunggu hingga selesai."
                }
            if self.state == "PAUSED":
                return {
                    "success": False,
                    "message": "Sistem sedang dijeda. Lanjutkan atau hentikan siklus sebelum menjalankan on-demand."
                }

            self.state = "SYNCING"
            self.is_syncing_once = True

        def _worker_once():
            try:
                self._execute_sync_cycle(cycle_type="on_demand")
            finally:
                with self._lock:
                    self.is_syncing_once = False
                    if self.state == "SYNCING":
                        self.state = "IDLE"

        thread = threading.Thread(target=_worker_once, daemon=True)
        thread.start()
        return {
            "success": True,
            "message": "Siklus sinkronisasi 1 kali jalan (on-demand) berhasil dimulai."
        }

    def trigger_now(self):
        """Memaksa siklus sinkronisasi berjalan saat ini juga: jika loop aktif, bypass interval; jika standby, jalankan 1 siklus."""
        with self._lock:
            if self.state == "RUNNING":
                self._trigger_event.set()
                self.add_log("INFO", "Siklus otomatis dipercepat (interval di-bypass).")
                return True
        return self.sync_once().get("success", False)

    def _execute_sync_cycle(self, cycle_type: str = "auto"):
        """Menjalankan 1 siklus pemrosesan sinkronisasi data DML untuk seluruh node aktif"""
        with self._lock:
            self.current_cycle += 1
            cycle_num = self.current_cycle
            self.is_active_syncing = True

        start_cycle_time = datetime.now()
        prefix = "⚡ On-Demand" if cycle_type == "on_demand" else "🔄 Auto-Loop"

        try:
            configs = ConfigManager.get_all_raw()
            if not configs:
                self.add_log("WARNING", f"{prefix}: Tidak ada node database dalam sync_config.json.")
            else:
                self.add_log("INFO", f"{prefix} #{cycle_num} dimulai: memproses {len(configs)} node database.")
                for cfg in configs:
                    if self._stop_event.is_set() and cycle_type == "auto":
                        break
                    self._sync_single_node(cfg)

            self.last_sync_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            duration = round((datetime.now() - start_cycle_time).total_seconds(), 2)
            self.add_log("SUCCESS", f"✅ {prefix} #{cycle_num} selesai dalam {duration}s.")
        except Exception as e:
            if cycle_type == "auto":
                self.state = "ERROR"
            self.add_log("ERROR", f"Kesalahan kritis pada siklus sync ({prefix}): {str(e)}")
        finally:
            with self._lock:
                self.is_active_syncing = False

    def _worker_loop(self):
        while not self._stop_event.is_set():
            # Tunggu jika sedang di-pause
            self._pause_event.wait()
            if self._stop_event.is_set():
                break

            self.state = "RUNNING"
            self._execute_sync_cycle(cycle_type="auto")

            if self._stop_event.is_set():
                break

            # Tetap berstatus RUNNING (loop aktif), jangan diubah ke IDLE saat menunggu jeda interval
            self._trigger_event.wait(timeout=self.interval_seconds)
            self._trigger_event.clear()

        self.state = "STOPPED"

    def _sync_single_node(self, config: Dict[str, Any]):
        comp_name = config.get("CompanyName", "UNKNOWN")
        # Dukungan dual istilah: Source/Target (Enterprise Standard) & Pusat/Lokal (Backward Compatibility)
        db_source = config.get("DatabaseSource") or config.get("DatabasePusat", "")
        db_target = config.get("DatabaseTarget") or config.get("DatabaseLokal", "")
        server_source = config.get("ServerSource") or config.get("ServerPusat", "")
        server_target = config.get("ServerTarget") or config.get("ServerLokal", "")
        user_source = config.get("UserSource") or config.get("UserPusat", "")
        pwd_source = config.get("PasswordSource") or config.get("PasswordPusat", "")
        user_target = config.get("UserTarget") or config.get("UserLokal", "")
        pwd_target = config.get("PasswordTarget") or config.get("PasswordLokal", "")

        node_key = f"{comp_name} - {db_source} ({server_target})" if server_target else f"{comp_name} - {db_source}"

        with self._lock:
            if node_key not in self.metrics_by_company:
                self.metrics_by_company[node_key] = {
                    "node_key": node_key,
                    "company_name": comp_name,
                    "database_pusat": db_source,
                    "database_lokal": db_target,
                    "server_pusat": server_source,
                    "server_lokal": server_target,
                    "total_inserts": 0,
                    "total_updates": 0,
                    "total_deletes": 0,
                    "total_tables_synced": 0,
                    "last_sync_time": None,
                    "status": "SYNCING"
                }
            self.metrics_by_company[node_key]["status"] = "SYNCING"
            self.metrics_by_company[node_key]["server_pusat"] = server_source
            self.metrics_by_company[node_key]["server_lokal"] = server_target

        conn_source_str = get_connection_string(server_source, db_source, user_source, pwd_source)
        conn_target_str = get_connection_string(server_target, db_target, user_target, pwd_target)

        node_inserts = 0
        node_updates = 0
        node_deletes = 0
        successful_tables = 0
        table_errors = 0

        try:
            conn_source = pyodbc.connect(conn_source_str, timeout=5)
            conn_source.add_output_converter(-155, handle_datetimeoffset)
            conn_target = pyodbc.connect(conn_target_str, timeout=5)
            conn_target.add_output_converter(-155, handle_datetimeoffset)

            cursor_source = conn_source.cursor()
            cursor_target = conn_target.cursor()

            # Ambil semua tabel dasar dari server source (pusat)
            cursor_source.execute("""
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_TYPE = 'BASE TABLE'
            """)
            tables = [row.TABLE_NAME for row in cursor_source.fetchall()]

            for table in tables:
                if self._stop_event.is_set():
                    break
                self._pause_event.wait()

                # PILAR 3: Per-Table Isolation (Isolasi setiap tabel dalam try-except tersendiri)
                try:
                    # 1. Cek apakah tabel ada di target. Jika belum ada, lakukan Self-Healing Table Creation
                    cursor_target.execute("""
                        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = ?
                    """, table)
                    target_table_exists = cursor_target.fetchone()[0] > 0

                    pk_col = get_primary_key(cursor_source, table)
                    source_col_details = get_table_columns_detail(cursor_source, table)
                    source_cols = list(source_col_details.keys())

                    if not pk_col or not source_cols or pk_col not in source_cols:
                        continue

                    if not target_table_exists:
                        # Auto create table di target jika belum ada
                        col_defs = []
                        for c_name, c_meta in source_col_details.items():
                            c_type = format_sql_column_type(c_meta)
                            c_null = "NOT NULL" if c_name == pk_col else "NULL"
                            col_defs.append(f"[{c_name}] {c_type} {c_null}")
                        col_defs.append(f"PRIMARY KEY ([{pk_col}])")
                        create_table_sql = f"CREATE TABLE [{table}] (\n    " + ",\n    ".join(col_defs) + "\n);"
                        cursor_target.execute(create_table_sql)
                        conn_target.commit()
                        self.add_log("INFO", f"[{comp_name}] 🛠️ Self-Healing DDL: Tabel baru [{table}] otomatis dibuat di server target.", comp_name, table)

                    # 2. PILAR 1: Self-Healing DDL (Pengecekan dan penambahan kolom yang kurang di target)
                    target_cols = set(get_table_columns(cursor_target, table))
                    missing_in_target = [c for c in source_cols if c not in target_cols]

                    if missing_in_target:
                        for missing_col in missing_in_target:
                            col_meta = source_col_details[missing_col]
                            col_sql_type = format_sql_column_type(col_meta)
                            try:
                                alter_sql = f"ALTER TABLE [{table}] ADD [{missing_col}] {col_sql_type} NULL;"
                                cursor_target.execute(alter_sql)
                                conn_target.commit()
                                target_cols.add(missing_col)
                                self.add_log(
                                    "INFO",
                                    f"[{comp_name}] 🛠️ Self-Healing DDL: Menambahkan kolom [{table}].[{missing_col}] ({col_sql_type}) ke target.",
                                    comp_name,
                                    table
                                )
                            except Exception as alt_err:
                                self.add_log(
                                    "WARNING",
                                    f"[{comp_name}] Gagal menambah kolom [{table}].[{missing_col}]: {str(alt_err)[:120]}",
                                    comp_name,
                                    table
                                )

                    # 3. PILAR 2: Safe Column Intersection (Hanya sinkronisasi kolom yang terverifikasi ada di KEDUA sisi)
                    sync_columns = [c for c in source_cols if c in target_cols]
                    if not sync_columns or pk_col not in sync_columns:
                        continue

                    col_list_str = ", ".join([f"[{c}]" for c in sync_columns])

                    cursor_source.execute(f"SELECT {col_list_str} FROM [{table}]")
                    source_rows = cursor_source.fetchall()

                    source_dict = {}
                    for row in source_rows:
                        row_dict = dict(zip(sync_columns, row))
                        pk_val = row_dict[pk_col]
                        source_dict[pk_val] = row_dict

                    tbl_inserted = 0
                    tbl_updated = 0
                    tbl_deleted = 0

                    # 4. INSERT & UPDATE
                    for pk_val, row_dict in source_dict.items():
                        cursor_target.execute(f"SELECT {col_list_str} FROM [{table}] WHERE [{pk_col}] = ?", pk_val)
                        target_row = cursor_target.fetchone()

                        if not target_row:
                            placeholders = ", ".join(["?" for _ in sync_columns])
                            insert_sql = f"INSERT INTO [{table}] ({col_list_str}) VALUES ({placeholders})"
                            values = [row_dict[c] for c in sync_columns]
                            try:
                                cursor_target.execute(insert_sql, values)
                                conn_target.commit()
                                tbl_inserted += 1
                            except Exception as ins_err:
                                self.add_log("WARNING", f"Gagal insert [{table}] PK={pk_val}: {str(ins_err)[:120]}", comp_name, table)
                        else:
                            target_dict = dict(zip(sync_columns, target_row))
                            changed_columns = []

                            for col in sync_columns:
                                if col == pk_col:
                                    continue
                                val_source = row_dict[col]
                                val_target = target_dict[col]

                                if isinstance(val_source, bytes):
                                    val_source = val_source.hex()
                                if isinstance(val_target, bytes):
                                    val_target = val_target.hex()

                                is_diff = False
                                if isinstance(val_source, (int, float)) or hasattr(val_source, 'as_tuple'):
                                    try:
                                        if float(val_source) != float(val_target):
                                            is_diff = True
                                    except:
                                        if str(val_source) != str(val_target):
                                            is_diff = True
                                elif type(val_source).__name__ in ['datetime', 'date']:
                                    if str(val_source) != str(val_target):
                                        is_diff = True
                                elif str(val_source) != str(val_target):
                                    is_diff = True

                                if is_diff:
                                    changed_columns.append(col)

                            if changed_columns:
                                set_clause = ", ".join([f"[{c}] = ?" for c in changed_columns])
                                update_sql = f"UPDATE [{table}] SET {set_clause} WHERE [{pk_col}] = ?"
                                update_values = [row_dict[c] for c in changed_columns]
                                update_values.append(pk_val)
                                try:
                                    cursor_target.execute(update_sql, update_values)
                                    conn_target.commit()
                                    tbl_updated += 1
                                except Exception as upd_err:
                                    self.add_log("WARNING", f"Gagal update [{table}] PK={pk_val}: {str(upd_err)[:120]}", comp_name, table)

                    # 5. DELETE
                    cursor_target.execute(f"SELECT [{pk_col}] FROM [{table}]")
                    target_pks = [row[0] for row in cursor_target.fetchall()]

                    for t_pk in target_pks:
                        if t_pk not in source_dict:
                            try:
                                cursor_target.execute(f"DELETE FROM [{table}] WHERE [{pk_col}] = ?", t_pk)
                                conn_target.commit()
                                tbl_deleted += 1
                            except Exception as del_err:
                                self.add_log("WARNING", f"Gagal delete [{table}] PK={t_pk}: {str(del_err)[:120]}", comp_name, table)

                    successful_tables += 1

                    # Catat log & update metrik realtime jika ada aktivitas DML
                    if tbl_inserted > 0 or tbl_updated > 0 or tbl_deleted > 0:
                        node_inserts += tbl_inserted
                        node_updates += tbl_updated
                        node_deletes += tbl_deleted
                        self.add_log(
                            "SUCCESS",
                            f"📊 Tabel [{table}] tersinkronisasi: +{tbl_inserted} Ins | ~{tbl_updated} Upd | -{tbl_deleted} Del",
                            comp_name,
                            table,
                            tbl_inserted,
                            tbl_updated,
                            tbl_deleted
                        )

                        # PILAR 3: Real-Time Metrics Saving (Simpan data transaksi secara berkala agar UI realtime)
                        with self._lock:
                            self.total_inserts += tbl_inserted
                            self.total_updates += tbl_updated
                            self.total_deletes += tbl_deleted
                            c_met = self.metrics_by_company[node_key]
                            c_met["total_inserts"] += tbl_inserted
                            c_met["total_updates"] += tbl_updated
                            c_met["total_deletes"] += tbl_deleted
                            c_met["total_tables_synced"] = successful_tables
                            c_met["last_sync_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            self._save_state()

                except Exception as tbl_err:
                    table_errors += 1
                    self.add_log(
                        "WARNING",
                        f"[{comp_name}] Kendala sinkronisasi pada tabel [{table}]: {str(tbl_err)[:150]}",
                        comp_name,
                        table
                    )
                    continue

            cursor_source.close()
            cursor_target.close()
            conn_source.close()
            conn_target.close()

            # Status akhir node setelah seluruh tabel selesai diproses
            with self._lock:
                c_met = self.metrics_by_company[node_key]
                c_met["total_tables_synced"] = successful_tables
                c_met["last_sync_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                if table_errors > 0 and successful_tables == 0:
                    c_met["status"] = "FAILED"
                elif table_errors > 0:
                    c_met["status"] = "WARNING"
                else:
                    c_met["status"] = "COMPLETED"
                self._save_state()

        except Exception as ex:
            with self._lock:
                if node_key in self.metrics_by_company:
                    self.metrics_by_company[node_key]["status"] = "FAILED"
            self.add_log("ERROR", f"[{node_key}] Error koneksi/sinkronisasi: {str(ex)}", comp_name, db_source)

# Singleton global instance
sync_engine = EnterpriseSyncEngine()
