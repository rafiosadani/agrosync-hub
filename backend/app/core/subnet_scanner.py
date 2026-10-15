import socket
import platform
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional
from .config_manager import ConfigManager
from .connection_tester import test_sql_connection

def get_local_network_info() -> Dict[str, Any]:
    """Mendeteksi IP LAN aktif, Hostname, dan OS laptop pengguna tanpa perintah command line"""
    local_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        try:
            local_ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            local_ip = "127.0.0.1"

    hostname = socket.gethostname()
    local_hostname = hostname if hostname.endswith(".local") else f"{hostname}.local"

    ip_parts = local_ip.split(".")
    subnet_prefix = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}" if len(ip_parts) == 4 else "192.168.1"
    subnet_cidr = f"{subnet_prefix}.0/24"

    return {
        "local_ip": local_ip,
        "hostname": hostname,
        "local_hostname": local_hostname,
        "subnet_prefix": subnet_prefix,
        "subnet_cidr": subnet_cidr,
        "os_name": platform.system(),
        "os_release": platform.release()
    }

def probe_tcp_port(ip: str, port: int, timeout: float = 0.35) -> Optional[Dict[str, Any]]:
    """Memeriksa apakah port terbuka pada IP target dalam timeout singkat"""
    start = time.time()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(timeout)
            res = s.connect_ex((ip, port))
            if res == 0:
                latency = round((time.time() - start) * 1000.0, 1)
                hostname = ""
                try:
                    hostname = socket.gethostbyaddr(ip)[0]
                except Exception:
                    hostname = ""
                return {
                    "ip": ip,
                    "port": port,
                    "server_address": f"{ip},{port}",
                    "hostname": hostname,
                    "latency_ms": latency,
                    "matched_nodes": []
                }
    except Exception:
        pass
    return None

def scan_subnet_sql_servers(subnet_prefix: Optional[str] = None, port: int = 1433, max_workers: int = 60) -> Dict[str, Any]:
    """
    Memindai seluruh 254 IP dalam subnet lokal untuk menemukan instance SQL Server yang aktif.
    Selesai dalam 1-2 detik menggunakan ThreadPoolExecutor paralel.
    """
    net_info = get_local_network_info()
    prefix = subnet_prefix or net_info["subnet_prefix"]
    start_time = time.time()

    ips_to_scan = [f"{prefix}.{i}" for i in range(1, 255)]
    found_devices: List[Dict[str, Any]] = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(probe_tcp_port, ip, port) for ip in ips_to_scan]
        for f in as_completed(futures):
            res = f.result()
            if res:
                found_devices.append(res)

    # Urutkan berdasarkan alamat IP secara numerik
    found_devices.sort(key=lambda x: [int(p) for p in x["ip"].split(".")])

    # Cocokkan dengan konfigurasi database node yang ada di sync_config.json
    configs = ConfigManager.get_all_raw()
    for dev in found_devices:
        dev_ip = dev["ip"]
        for idx, cfg in enumerate(configs):
            comp = cfg.get("CompanyName", "")
            db_p = cfg.get("DatabasePusat", "")
            srv_p = cfg.get("ServerPusat", "")
            srv_l = cfg.get("ServerLokal", "")

            # Cek apakah device ini adalah server pusat atau server lokal yang sedang terkonfigurasi
            is_pusat = dev_ip in srv_p or (dev["hostname"] and dev["hostname"] in srv_p)
            is_lokal = dev_ip in srv_l or (dev["hostname"] and dev["hostname"] in srv_l)

            if is_pusat or is_lokal:
                dev["matched_nodes"].append({
                    "node_id": idx,
                    "company_name": comp,
                    "database_pusat": db_p,
                    "role": "Server Pusat" if is_pusat else "Server Lokal",
                    "configured_server": srv_p if is_pusat else srv_l
                })

    duration_sec = round(time.time() - start_time, 2)
    return {
        "status": "SUCCESS",
        "scanned_subnet": f"{prefix}.0/24",
        "scanned_port": port,
        "duration_seconds": duration_sec,
        "total_found": len(found_devices),
        "local_machine_ip": net_info["local_ip"],
        "devices": found_devices
    }
