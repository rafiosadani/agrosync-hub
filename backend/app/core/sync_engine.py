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
        self.state: str = "IDLE"  # "IDLE", "RUNNING", "PAUSED", "STOPPED", "ERROR"
        self.last_sync_time: Optional[str] = None
        self.current_cycle: int = 0
        self.interval_seconds: int = 10

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
                "interval_seconds": self.interval_seconds
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

    def trigger_now(self):
        """Memaksa siklus sinkronisasi berjalan saat ini juga tanpa menunggu interval timer"""
        if self.state in ("STOPPED", "IDLE"):
            self.start()
        self._trigger_event.set()
        self.add_log("INFO", "Sinkronisasi on-demand dipicu secara manual.")
        return True

    def _worker_loop(self):
        while not self._stop_event.is_set():
            # Tunggu jika sedang di-pause
            self._pause_event.wait()
            if self._stop_event.is_set():
                break

            self.state = "RUNNING"
            self.current_cycle += 1
            start_cycle_time = datetime.now()

            try:
                configs = ConfigManager.get_all_raw()
                if not configs:
                    self.add_log("WARNING", "Tidak ada node database dalam sync_config.json.")
                else:
                    self.add_log("INFO", f"🔄 Siklus #{self.current_cycle} dimulai: memproses {len(configs)} node database.")
                    for cfg in configs:
                        if self._stop_event.is_set():
                            break
                        self._sync_single_node(cfg)

                self.last_sync_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                duration = round((datetime.now() - start_cycle_time).total_seconds(), 2)
                self.add_log("SUCCESS", f"✅ Siklus #{self.current_cycle} selesai dalam {duration}s.")
            except Exception as e:
                self.state = "ERROR"
                self.add_log("ERROR", f"Kesalahan kritis pada siklus sync: {str(e)}")

            if self.state != "PAUSED" and self.state != "STOPPED":
                self.state = "IDLE"

            # Tunggu interval atau hingga event on-demand trigger dipanggil
            self._trigger_event.wait(timeout=self.interval_seconds)
            self._trigger_event.clear()

        self.state = "STOPPED"

    def _sync_single_node(self, config: Dict[str, Any]):
        comp_name = config.get("CompanyName", "UNKNOWN")
        db_pusat = config.get("DatabasePusat", "")
        db_lokal = config.get("DatabaseLokal", "")
        server_pusat = config.get("ServerPusat", "")
        server_lokal = config.get("ServerLokal", "")

        node_key = f"{comp_name} - {db_pusat} ({server_lokal})" if server_lokal else f"{comp_name} - {db_pusat}"

        with self._lock:
            if node_key not in self.metrics_by_company:
                self.metrics_by_company[node_key] = {
                    "node_key": node_key,
                    "company_name": comp_name,
                    "database_pusat": db_pusat,
                    "database_lokal": db_lokal,
                    "server_pusat": server_pusat,
                    "server_lokal": server_lokal,
                    "total_inserts": 0,
                    "total_updates": 0,
                    "total_deletes": 0,
                    "total_tables_synced": 0,
                    "last_sync_time": None,
                    "status": "SYNCING"
                }
            self.metrics_by_company[node_key]["status"] = "SYNCING"
            self.metrics_by_company[node_key]["server_pusat"] = server_pusat
            self.metrics_by_company[node_key]["server_lokal"] = server_lokal

        conn_pusat_str = get_connection_string(
            config["ServerPusat"], db_pusat, config["UserPusat"], config["PasswordPusat"]
        )
        conn_lokal_str = get_connection_string(
            config["ServerLokal"], db_lokal, config["UserLokal"], config["PasswordLokal"]
        )

        node_inserts = 0
        node_updates = 0
        node_deletes = 0

        try:
            conn_pusat = pyodbc.connect(conn_pusat_str, timeout=5)
            conn_pusat.add_output_converter(-155, handle_datetimeoffset)
            conn_lokal = pyodbc.connect(conn_lokal_str, timeout=5)

            cursor_pusat = conn_pusat.cursor()
            cursor_lokal = conn_lokal.cursor()

            cursor_pusat.execute("""
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_TYPE = 'BASE TABLE'
            """)
            tables = [row.TABLE_NAME for row in cursor_pusat.fetchall()]

            for table in tables:
                if self._stop_event.is_set():
                    break
                self._pause_event.wait()

                pk_col = get_primary_key(cursor_pusat, table)
                columns = get_table_columns(cursor_pusat, table)

                if not pk_col or not columns or pk_col not in columns:
                    continue

                col_list_str = ", ".join([f"[{c}]" for c in columns])

                try:
                    cursor_pusat.execute(f"SELECT {col_list_str} FROM [{table}]")
                    pusat_rows = cursor_pusat.fetchall()
                except Exception as err:
                    continue

                pusat_dict = {}
                for row in pusat_rows:
                    row_dict = dict(zip(columns, row))
                    pk_val = row_dict[pk_col]
                    pusat_dict[pk_val] = row_dict

                tbl_inserted = 0
                tbl_updated = 0
                tbl_deleted = 0

                # 1. INSERT & UPDATE
                for pk_val, row_dict in pusat_dict.items():
                    cursor_lokal.execute(f"SELECT {col_list_str} FROM [{table}] WHERE [{pk_col}] = ?", pk_val)
                    lokal_row = cursor_lokal.fetchone()

                    if not lokal_row:
                        placeholders = ", ".join(["?" for _ in columns])
                        insert_sql = f"INSERT INTO [{table}] ({col_list_str}) VALUES ({placeholders})"
                        values = [row_dict[c] for c in columns]
                        try:
                            cursor_lokal.execute(insert_sql, values)
                            conn_lokal.commit()
                            tbl_inserted += 1
                        except Exception as e:
                            # Log jika gagal insert
                            self.add_log("WARNING", f"Gagal insert [{table}] PK={pk_val}: {str(e)[:120]}", comp_name, table)
                    else:
                        lokal_dict = dict(zip(columns, lokal_row))
                        changed_columns = []

                        for col in columns:
                            if col == pk_col:
                                continue
                            val_pusat = row_dict[col]
                            val_lokal = lokal_dict[col]

                            if isinstance(val_pusat, bytes):
                                val_pusat = val_pusat.hex()
                            if isinstance(val_lokal, bytes):
                                val_lokal = val_lokal.hex()

                            is_diff = False
                            if isinstance(val_pusat, (int, float)) or hasattr(val_pusat, 'as_tuple'):
                                try:
                                    if float(val_pusat) != float(val_lokal):
                                        is_diff = True
                                except:
                                    if str(val_pusat) != str(val_lokal):
                                        is_diff = True
                            elif type(val_pusat).__name__ in ['datetime', 'date']:
                                if str(val_pusat) != str(val_lokal):
                                    is_diff = True
                            elif str(val_pusat) != str(val_lokal):
                                is_diff = True

                            if is_diff:
                                changed_columns.append(col)

                        if changed_columns:
                            set_clause = ", ".join([f"[{c}] = ?" for c in changed_columns])
                            update_sql = f"UPDATE [{table}] SET {set_clause} WHERE [{pk_col}] = ?"
                            update_values = [row_dict[c] for c in changed_columns]
                            update_values.append(pk_val)
                            try:
                                cursor_lokal.execute(update_sql, update_values)
                                conn_lokal.commit()
                                tbl_updated += 1
                            except Exception as e:
                                self.add_log("WARNING", f"Gagal update [{table}] PK={pk_val}: {str(e)[:120]}", comp_name, table)

                # 2. DELETE
                cursor_lokal.execute(f"SELECT [{pk_col}] FROM [{table}]")
                lokal_pks = [row[0] for row in cursor_lokal.fetchall()]

                for l_pk in lokal_pks:
                    if l_pk not in pusat_dict:
                        try:
                            cursor_lokal.execute(f"DELETE FROM [{table}] WHERE [{pk_col}] = ?", l_pk)
                            conn_lokal.commit()
                            tbl_deleted += 1
                        except Exception as e:
                            self.add_log("WARNING", f"Gagal delete [{table}] PK={l_pk}: {str(e)[:120]}", comp_name, table)

                # Catat log jika ada aktivitas DML
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

            cursor_pusat.close()
            cursor_lokal.close()
            conn_pusat.close()
            conn_lokal.close()

            # Update metrics global & per database node
            with self._lock:
                self.total_inserts += node_inserts
                self.total_updates += node_updates
                self.total_deletes += node_deletes
                c_met = self.metrics_by_company[node_key]
                c_met["total_inserts"] += node_inserts
                c_met["total_updates"] += node_updates
                c_met["total_deletes"] += node_deletes
                c_met["total_tables_synced"] = len(tables)
                c_met["last_sync_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                c_met["status"] = "COMPLETED"
                self._save_state()

        except Exception as ex:
            with self._lock:
                if node_key in self.metrics_by_company:
                    self.metrics_by_company[node_key]["status"] = "FAILED"
            self.add_log("ERROR", f"[{node_key}] Error koneksi/sinkronisasi: {str(ex)}", comp_name, db_pusat)

# Singleton global instance
sync_engine = EnterpriseSyncEngine()
