import json
import os
import shutil
import socket
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

    @staticmethod
    def get_canonical_endpoint(server_str: str) -> str:
        """
        Normalisasi endpoint server (host,port atau host:port) sehingga:
        - Hostname lokal (.local), IP LAN aktif, localhost, dan 127.0.0.1 pada mesin yang sama
          dinormalisasi ke canonical identifier '__LOCAL__:<port>'.
        - Server remote dengan port dan IP resolusi yang sama akan cocok.
        """
        s = (server_str or "").strip()
        if not s:
            return ""

        port = "1433"
        if "," in s:
            parts = s.split(",")
            host = parts[0].strip()
            if len(parts) > 1 and parts[1].strip().isdigit():
                port = parts[1].strip()
        elif ":" in s and not s.startswith("["):
            parts = s.split(":")
            host = parts[0].strip()
            if len(parts) > 1 and parts[1].strip().isdigit():
                port = parts[1].strip()
        else:
            host = s

        host_lower = host.lower()
        if host_lower in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
            return f"__LOCAL__:{port}"

        try:
            local_hostname = socket.gethostname().lower()
            if host_lower in (local_hostname, f"{local_hostname}.local"):
                return f"__LOCAL__:{port}"

            from .subnet_scanner import get_local_network_info
            local_info = get_local_network_info()
            local_ip = local_info.get("local_ip", "")
            if host_lower == local_ip.lower():
                return f"__LOCAL__:{port}"

            resolved_ip = socket.gethostbyname(host)
            if resolved_ip in ("127.0.0.1", "127.0.1.1", "0.0.0.0") or (local_ip and resolved_ip == local_ip):
                return f"__LOCAL__:{port}"

            return f"{resolved_ip}:{port}"
        except Exception:
            clean_host = host_lower.replace(".local", "")
            return f"{clean_host}:{port}"

    @staticmethod
    def check_duplicate(node_data: Dict[str, Any], existing_nodes: List[Dict[str, Any]], exclude_id: Optional[int] = None) -> Optional[str]:
        """
        Memeriksa apakah terdapat duplikasi konfigurasi database node:
        1. Exact duplicate: ServerPusat + DatabasePusat + ServerLokal + DatabaseLokal persis sama.
        2. Target collision: ServerLokal + DatabaseLokal persis sama (satu database lokal tidak boleh menerima 2 sync worker).
        Menggunakan canonical endpoint normalization sehingga IP LAN, mDNS (.local), dan localhost pada mesin yang sama terdeteksi ekuivalen.
        """
        def norm(srv: str, db: str) -> str:
            canonical_srv = ConfigManager.get_canonical_endpoint(srv)
            return f"{canonical_srv}/{(db or '').strip().lower()}"

        new_src = norm(node_data.get("ServerPusat", ""), node_data.get("DatabasePusat", ""))
        new_tgt = norm(node_data.get("ServerLokal", ""), node_data.get("DatabaseLokal", ""))
        new_comp = (node_data.get("CompanyName", "")).strip().upper()

        for idx, ex in enumerate(existing_nodes):
            if exclude_id is not None and idx == exclude_id:
                continue
            ex_src = norm(ex.get("ServerPusat", ""), ex.get("DatabasePusat", ""))
            ex_tgt = norm(ex.get("ServerLokal", ""), ex.get("DatabaseLokal", ""))
            ex_comp = (ex.get("CompanyName", "")).strip().upper()

            # Cek jika source dan destination persis sama
            if new_src == ex_src and new_tgt == ex_tgt:
                return (
                    f"Duplikasi Terdeteksi: Konfigurasi untuk database pusat '{node_data.get('DatabasePusat')}' "
                    f"menuju target '{node_data.get('DatabaseLokal')}' pada server lokal '{node_data.get('ServerLokal')}' "
                    f"sudah terdaftar di Node #{idx + 1} ({ex_comp})."
                )

            # Cek jika target server + target database sama persis
            if new_tgt == ex_tgt:
                return (
                    f"Konflik Target: Database lokal '{node_data.get('DatabaseLokal')}' pada host '{node_data.get('ServerLokal')}' "
                    f"sudah digunakan sebagai target sinkronisasi oleh Node #{idx + 1} ({ex_comp} - {ex.get('DatabasePusat')}). "
                    f"Satu database lokal tidak dapat menerima sinkronisasi dari dua sumber berbeda."
                )

        return None

    @classmethod
    def add_node(cls, node: DatabaseNodeConfig) -> DatabaseNodeMasked:
        raw = cls._read_raw()
        new_data = node.model_dump()

        dup_err = cls.check_duplicate(new_data, raw)
        if dup_err:
            raise ValueError(dup_err)

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
    def add_nodes_batch(cls, nodes: List[DatabaseNodeConfig]) -> List[DatabaseNodeMasked]:
        """Menambahkan banyak konfigurasi node sekaligus dalam satu batch atomik."""
        raw = cls._read_raw()
        new_nodes_data = []

        # Validasi seluruh node dalam batch terhadap data yang ada dan antar sesama di batch
        for i, node in enumerate(nodes):
            data = node.model_dump()
            dup_err = cls.check_duplicate(data, raw)
            if dup_err:
                raise ValueError(dup_err)

            dup_batch_err = cls.check_duplicate(data, new_nodes_data)
            if dup_batch_err:
                raise ValueError(f"Duplikasi dalam daftar input: {dup_batch_err}")

            new_nodes_data.append(data)

        start_idx = len(raw)
        raw.extend(new_nodes_data)
        cls._write_raw(raw)

        created_masked = []
        for offset, data in enumerate(new_nodes_data):
            created_masked.append(DatabaseNodeMasked(
                id=start_idx + offset,
                CompanyName=data["CompanyName"],
                ServerPusat=data["ServerPusat"],
                DatabasePusat=data["DatabasePusat"],
                UserPusat=data["UserPusat"],
                PasswordPusat="••••••••",
                ServerLokal=data["ServerLokal"],
                DatabaseLokal=data["DatabaseLokal"],
                UserLokal=data["UserLokal"],
                PasswordLokal="••••••••"
            ))
        return created_masked

    @classmethod
    def update_node(cls, node_id: int, updates: DatabaseNodeUpdate) -> DatabaseNodeMasked:
        raw = cls._read_raw()
        if not (0 <= node_id < len(raw)):
            raise ValueError(f"Node dengan ID {node_id} tidak ditemukan.")

        current = raw[node_id].copy()
        update_dict = updates.model_dump(exclude_unset=True)

        for key, val in update_dict.items():
            if val is not None:
                # Jangan override password jika dikirim tanda masking
                if key in ("PasswordPusat", "PasswordLokal") and (val == "••••••••" or val == "********" or val == ""):
                    continue
                current[key] = val

        dup_err = cls.check_duplicate(current, raw, exclude_id=node_id)
        if dup_err:
            raise ValueError(dup_err)

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

    @classmethod
    def update_credentials_batch(cls, node_ids: List[int], updates: Dict[str, Any]) -> List[DatabaseNodeMasked]:
        """
        Memperbarui kredensial server pusat/lokal bersamaan untuk kumpulan node yang dipilih,
        tanpa mengubah CompanyName, DatabasePusat, maupun DatabaseLokal masing-masing.
        """
        raw = cls._read_raw()
        valid_ids = [nid for nid in set(node_ids) if 0 <= nid < len(raw)]
        if not valid_ids:
            raise ValueError("Tidak ada ID node valid yang dipilih untuk diperbarui.")

        clean_updates = {}
        for k, v in updates.items():
            if v is not None and str(v).strip() != "":
                if k in ("PasswordPusat", "PasswordLokal") and v in ("••••••••", "********"):
                    continue
                clean_updates[k] = v

        if not clean_updates:
            raise ValueError("Tidak ada parameter kredensial atau server baru yang diisi untuk diperbarui.")

        for nid in valid_ids:
            current = raw[nid].copy()
            for k, v in clean_updates.items():
                current[k] = v
            dup_err = cls.check_duplicate(current, raw, exclude_id=nid)
            if dup_err:
                raise ValueError(f"Konflik pada Node #{nid + 1} ({raw[nid].get('CompanyName')} - {raw[nid].get('DatabasePusat')}): {dup_err}")
            raw[nid] = current

        cls._write_raw(raw)
        return cls.get_all_masked()

