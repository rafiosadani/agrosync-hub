import time
import re
from typing import Tuple, Optional
import pyodbc
from ..config import CURRENT_ODBC_DRIVER, PREFERRED_ODBC_DRIVERS

import socket

def normalize_server_address(server: str) -> str:
    """
    Normalisasi alamat server SQL Server:
    1. 'localhost' -> '127.0.0.1' (menghindari delay IPv6 ::1 pada macOS/Linux).
    2. Hostname Windows tunggal tanpa dot (misal 'WIN-SERVER-01') -> dicoba resolve as-is,
       jika gagal, otomatis dicoba dengan suffix '.local' (mDNS Bonjour di macOS/Linux).
    """
    if not server:
        return server
    s = server.strip()
    if s.lower().startswith("localhost"):
        return s.replace("localhost", "127.0.0.1").replace("LOCALHOST", "127.0.0.1")

    # Pisahkan host dan port
    host = s
    port_part = ""
    if "," in s:
        parts = s.split(",", 1)
        host = parts[0].strip()
        port_part = f",{parts[1].strip()}"
    elif ":" in s and not s.startswith("["):
        parts = s.split(":")
        if len(parts) == 2 and parts[1].isdigit():
            host = parts[0].strip()
            port_part = f",{parts[1].strip()}"

    # Cek apakah host adalah IP address numerik
    try:
        socket.inet_aton(host)
        return s
    except Exception:
        pass

    # Jika hostname tanpa dot (misal 'WIN-SERVER-01')
    if "." not in host:
        try:
            socket.gethostbyname(host)
            return s
        except Exception:
            # Gagal resolve nama NetBIOS standar di Unix/macOS, coba mDNS (.local)
            try:
                candidate = f"{host}.local"
                socket.gethostbyname(candidate)
                return f"{candidate}{port_part}"
            except Exception:
                pass

    return s

def test_sql_connection(server: str, database: str, user: str, password: str, timeout: int = 5) -> Tuple[bool, float, str, Optional[str], bool, bool]:
    """
    Menguji koneksi ke SQL Server dengan 2-Tier Diagnostic:
    1. Mencoba koneksi ke database target.
    2. Jika gagal karena database belum ada (Error 4060), mencoba koneksi ke master untuk memvalidasi server & kredensial login.
    Return: (success: bool, latency_ms: float, message: str, version: Optional[str], server_online: bool, database_exists: bool)
    """
    target_server = normalize_server_address(server)
    drivers_to_try = [CURRENT_ODBC_DRIVER] + [d for d in PREFERRED_ODBC_DRIVERS if d != CURRENT_ODBC_DRIVER]
    last_err = ""
    start_time = time.time()

    for driver in drivers_to_try:
        conn_str = (
            f"DRIVER={{{driver}}};"
            f"SERVER={target_server};"
            f"DATABASE={database};"
            f"UID={user};"
            f"PWD={password};"
            f"TrustServerCertificate=yes;"
        )
        try:
            conn = pyodbc.connect(conn_str, timeout=timeout)
            cursor = conn.cursor()
            cursor.execute("SELECT @@VERSION")
            ver_row = cursor.fetchone()
            version = ver_row[0] if ver_row else "SQL Server Unknown"
            latency = (time.time() - start_time) * 1000.0
            cursor.close()
            conn.close()
            return True, round(latency, 2), "Koneksi berhasil dan responsif", version.split("\n")[0], True, True
        except Exception as e:
            last_err = str(e)
            # If driver not found, continue to next driver
            if "Data source name not found" in last_err or "driver not found" in last_err.lower():
                continue

            latency = (time.time() - start_time) * 1000.0

            # Cek apakah masalah spesifik Error 4060: Database belum dibuat di server
            if "4060" in last_err or "Cannot open database" in last_err:
                master_conn_str = (
                    f"DRIVER={{{driver}}};"
                    f"SERVER={target_server};"
                    f"DATABASE=master;"
                    f"UID={user};"
                    f"PWD={password};"
                    f"TrustServerCertificate=yes;"
                )
                try:
                    m_conn = pyodbc.connect(master_conn_str, timeout=timeout)
                    m_cursor = m_conn.cursor()
                    m_cursor.execute("SELECT @@VERSION")
                    m_ver_row = m_cursor.fetchone()
                    m_version = m_ver_row[0] if m_ver_row else "SQL Server Unknown"
                    m_cursor.close()
                    m_conn.close()
                    # Server online & login valid, tetapi database belum ada!
                    return (
                        False,
                        round(latency, 2),
                        f"Server online & login valid, namun database '{database}' belum dibuat di server ini.",
                        m_version.split("\n")[0],
                        True,
                        False
                    )
                except Exception:
                    # Jika koneksi ke master juga gagal, berarti memang server/kredensial bermasalah
                    pass

            return False, round(latency, 2), f"Gagal: {last_err}", None, False, False

    return False, 0.0, f"Gagal menginisialisasi driver ODBC. Error terakhir: {last_err}", None, False, False


def create_sql_database(server: str, database: str, user: str, password: str, timeout: int = 10) -> Tuple[bool, str]:
    """
    Membuat database baru di SQL Server dengan menyambung ke database master.
    Menggunakan autocommit=True agar query DDL CREATE DATABASE dapat dijalankan secara legal.
    """
    # Validasi nama database agar aman dari SQL Injection
    if not re.match(r'^[a-zA-Z0-9_]+$', database):
        return False, "Nama database hanya boleh mengandung karakter alfanumerik dan underscore (_)."

    target_server = normalize_server_address(server)
    drivers_to_try = [CURRENT_ODBC_DRIVER] + [d for d in PREFERRED_ODBC_DRIVERS if d != CURRENT_ODBC_DRIVER]
    last_err = ""

    for driver in drivers_to_try:
        master_conn_str = (
            f"DRIVER={{{driver}}};"
            f"SERVER={target_server};"
            f"DATABASE=master;"
            f"UID={user};"
            f"PWD={password};"
            f"TrustServerCertificate=yes;"
        )
        try:
            conn = pyodbc.connect(master_conn_str, autocommit=True, timeout=timeout)
            cursor = conn.cursor()

            # Periksa apakah database sudah ada
            cursor.execute(f"SELECT database_id FROM sys.databases WHERE name = '{database}'")
            row = cursor.fetchone()
            if row:
                cursor.close()
                conn.close()
                return True, f"Database '{database}' sudah ada di server {server}."

            # Buat database baru
            cursor.execute(f"CREATE DATABASE [{database}];")
            cursor.close()
            conn.close()
            return True, f"Database '{database}' berhasil dibuat di server {server}."
        except Exception as e:
            last_err = str(e)
            if "Data source name not found" in last_err or "driver not found" in last_err.lower():
                continue
            return False, f"Gagal membuat database '{database}': {last_err}"

    return False, f"Gagal koneksi ODBC ke master: {last_err}"


def fetch_sql_databases(server: str, user: str, password: str, timeout: int = 5) -> Tuple[bool, list, str]:
    """
    Mengambil seluruh daftar database aktif non-sistem (user databases) dari SQL Server
    dengan membaca catalog view sys.databases melalui database master.
    """
    target_server = normalize_server_address(server)
    drivers_to_try = [CURRENT_ODBC_DRIVER] + [d for d in PREFERRED_ODBC_DRIVERS if d != CURRENT_ODBC_DRIVER]
    last_err = ""

    for driver in drivers_to_try:
        master_conn_str = (
            f"DRIVER={{{driver}}};"
            f"SERVER={target_server};"
            f"DATABASE=master;"
            f"UID={user};"
            f"PWD={password};"
            f"TrustServerCertificate=yes;"
        )
        try:
            conn = pyodbc.connect(master_conn_str, timeout=timeout)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sys.databases "
                "WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb') "
                "  AND state_desc = 'ONLINE' "
                "ORDER BY name ASC;"
            )
            rows = cursor.fetchall()
            databases = [row[0] for row in rows if row and row[0]]
            cursor.close()
            conn.close()
            return True, databases, f"Berhasil memuat {len(databases)} database dari {server}"
        except Exception as e:
            last_err = str(e)
            if "Data source name not found" in last_err or "driver not found" in last_err.lower():
                continue
            return False, [], f"Gagal mengambil database dari server: {last_err}"

    return False, [], f"Gagal koneksi ODBC: {last_err}"
