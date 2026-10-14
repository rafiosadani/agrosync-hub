import json
import os
import shutil
import threading
from typing import List, Dict, Any, Optional
from ..config import CONFIG_PATH, BACKUP_CONFIG_PATH
from ..models.config_models import DatabaseNodeConfig, DatabaseNodeMasked, DatabaseNodeUpdate

_lock = threading.Lock()

class ConfigManager:
    @staticmethod
    def _read_raw() -> List[Dict[str, Any]]:
        with _lock:
            if not os.path.exists(CONFIG_PATH):
                return []
            try:
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                # If backup exists, try to recover
                if os.path.exists(BACKUP_CONFIG_PATH):
                    with open(BACKUP_CONFIG_PATH, "r", encoding="utf-8") as bf:
                        return json.load(bf)
                raise RuntimeError(f"Gagal membaca file konfigurasi: {e}")

    @staticmethod
    def _write_raw(configs: List[Dict[str, Any]]) -> None:
        with _lock:
            # 1. Backup file yang ada sebelumnya jika file ada
            if os.path.exists(CONFIG_PATH):
                shutil.copyfile(CONFIG_PATH, BACKUP_CONFIG_PATH)

            # 2. Tulis atomic dengan file sementara
            temp_path = f"{CONFIG_PATH}.tmp"
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(configs, f, indent=2, ensure_ascii=False)
            
            # 3. Ganti file asli
            os.replace(temp_path, CONFIG_PATH)

    @classmethod
    def get_all_raw(cls) -> List[Dict[str, Any]]:
        """Mendapatkan konfigurasi asli (dengan password asli) untuk sync engine"""
        return cls._read_raw()

    @classmethod
    def get_all_masked(cls) -> List[DatabaseNodeMasked]:
        """Mendapatkan konfigurasi dengan password ter-masking untuk konsumsi API/UI"""
        raw = cls._read_raw()
        masked_list = []
        for idx, item in enumerate(raw):
            masked_list.append(DatabaseNodeMasked(
                id=idx,
                CompanyName=item.get("CompanyName", ""),
                ServerPusat=item.get("ServerPusat", ""),
                DatabasePusat=item.get("DatabasePusat", ""),
                UserPusat=item.get("UserPusat", ""),
                PasswordPusat="••••••••",
                ServerLokal=item.get("ServerLokal", ""),
                DatabaseLokal=item.get("DatabaseLokal", ""),
                UserLokal=item.get("UserLokal", ""),
                PasswordLokal="••••••••"
            ))
        return masked_list

    @classmethod
    def get_by_id(cls, node_id: int) -> Optional[Dict[str, Any]]:
        raw = cls._read_raw()
        if 0 <= node_id < len(raw):
            return raw[node_id]
        return None

    @classmethod
    def add_node(cls, node: DatabaseNodeConfig) -> DatabaseNodeMasked:
        raw = cls._read_raw()
        new_data = node.model_dump()
        raw.append(new_data)
        cls._write_raw(raw)
        idx = len(raw) - 1
        return DatabaseNodeMasked(
            id=idx,
            CompanyName=new_data["CompanyName"],
            ServerPusat=new_data["ServerPusat"],
            DatabasePusat=new_data["DatabasePusat"],
            UserPusat=new_data["UserPusat"],
            PasswordPusat="••••••••",
            ServerLokal=new_data["ServerLokal"],
            DatabaseLokal=new_data["DatabaseLokal"],
            UserLokal=new_data["UserLokal"],
            PasswordLokal="••••••••"
        )

    @classmethod
    def update_node(cls, node_id: int, updates: DatabaseNodeUpdate) -> DatabaseNodeMasked:
        raw = cls._read_raw()
        if not (0 <= node_id < len(raw)):
            raise ValueError(f"Node dengan ID {node_id} tidak ditemukan.")

        current = raw[node_id]
        update_dict = updates.model_dump(exclude_unset=True)

        for key, val in update_dict.items():
            if val is not None:
                # Jangan override password jika dikirim tanda masking
                if key in ("PasswordPusat", "PasswordLokal") and (val == "••••••••" or val == "********" or val == ""):
                    continue
                current[key] = val

        raw[node_id] = current
        cls._write_raw(raw)

        return DatabaseNodeMasked(
            id=node_id,
            CompanyName=current["CompanyName"],
            ServerPusat=current["ServerPusat"],
            DatabasePusat=current["DatabasePusat"],
            UserPusat=current["UserPusat"],
            PasswordPusat="••••••••",
            ServerLokal=current["ServerLokal"],
            DatabaseLokal=current["DatabaseLokal"],
            UserLokal=current["UserLokal"],
            PasswordLokal="••••••••"
        )

    @classmethod
    def delete_node(cls, node_id: int) -> bool:
        raw = cls._read_raw()
        if not (0 <= node_id < len(raw)):
            return False
        raw.pop(node_id)
        cls._write_raw(raw)
        return True
