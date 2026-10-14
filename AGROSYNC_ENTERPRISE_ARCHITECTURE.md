# 🌾 AgroSync Hub — Enterprise Architecture & Integration Guide

**AgroSync Hub** adalah platform sinkronisasi database *Hub-and-Spoke* multi-perusahaan (API, ANR, TTM) terintegrasi dengan mesin DDL Non-Destruktif (*Smart Alter Table*), DML *Change Tracking* tingkat kolom, serta antarmuka web modern berbasis **FastAPI** dan **React**.

---

## 📑 Daftar Isi
1. [Hasil Tinjauan & Audit Kode Eksisting](#1-hasil-tinjauan--audit-kode-eksisting)
2. [Arsitektur Sistem Enterprise AgroSync Hub](#2-arsitektur-sistem-enterprise-agrosync-hub)
3. [Spesifikasi Lapisan API Backend (FastAPI)](#3-spesifikasi-lapisan-api-backend-fastapi)
4. [Antarmuka Dashboard Frontend Web](#4-antarmuka-dashboard-frontend-web)
5. [Panduan Integrasi & Pengujian Multi-Device (Tahap 2)](#5-panduan-integrasi--pengujian-multi-device-tahap-2)
6. [Panduan Menjalankan Sistem](#6-panduan-menjalankan-sistem)

---

## 1. Hasil Tinjauan & Audit Kode Eksisting

Sebelum merancang dan mengintegrasikan dashboard web, telah dilakukan peninjauan mendalam terhadap file inti yang ada di repositori:

### A. Skrip Sinkronisasi DML (`sync.py`)
* **Kelebihan yang Dipertahankan:**
  - Konverter output `DATETIMEOFFSET` (-155) untuk mencegah crash pada driver `pyodbc`.
  - Penanganan tipe biner/varbinary menggunakan `.hex()` secara akurat.
  - Perbandingan nilai float/decimal dan tipe tanggal/waktu yang andal.
  - Skema DML 3 tahap: INSERT baris baru, UPDATE perbedaan kolom secara spesifik, dan DELETE baris usang (*Zero-Orphan*).
* **Identifikasi Masalah & Solusi Penyelarasan:**
  1. *Tightly Coupled Loop*: Kode asli menggunakan loop tak berujung `while True:` dengan `time.sleep(10)` tanpa antarmuka kontrol eksternal. Kami mengabstraksikannya ke dalam `backend/app/core/sync_engine.py` dengan thread controller aman berbasis `threading.RLock()` dan event flags (`_stop_event`, `_pause_event`, `_trigger_event`), sehingga pengguna dapat melakukan **Start**, **Pause**, **Resume**, **Stop**, dan **Trigger On-Demand** langsung dari Web Dashboard.
  2. *Error Suppression*: Kode asli memiliki blok `except Exception as e: pass` yang menelan error constraint/koneksi tanpa jejak. Kami menambahkan pencatatan event log terstruktur ke dalam buffer log dengan level `WARNING`/`ERROR` agar operator sistem segera mengetahui kegagalan DML tertentu.
  3. *Driver Hardcoding*: Skrip asli mengikat kaku `ODBC Driver 18 for SQL Server`. Kami menambahkan deteksi driver dinamis dengan fallback ke driver ODBC yang terpasang di OS (misal Driver 17 atau FreeTDS) agar portabel saat dipindahkan ke mesin mentor.

### B. Skrip Migrasi DDL Cerdas (`migrate_schema.py`)
* **Kelebihan yang Dipertahankan:**
  - Skema *Smart Alter Table*: Memisahkan tabel yang belum ada (`CREATE TABLE`) dan tabel yang sudah ada (`ALTER TABLE ADD COLUMN NULL`) sehingga menjamin **Zero Data Loss** untuk 330+ tabel.
  - Pemetaan tipe data SQL Server yang presisi (`VARCHAR`, `DECIMAL(25,5)`, `UNIQUEIDENTIFIER`, `VARBINARY`, dll).
* **Penyelarasan:**
  - Dibungkus dalam modul `backend/app/core/schema_migrator.py` dan dihubungkan ke endpoint `/api/migration/run` serta `/api/migration/audit-summary` sehingga pengguna dapat memicu migrasi skema langsung dari dashboard dan melihat progresnya secara visual.

### C. File Konfigurasi Node (`sync_config.json`)
* **Penyelarasan & Keamanan:**
  - Dilengkapi modul `backend/app/core/config_manager.py` yang menyediakan mekanisme baca/tulis *thread-safe* dengan **Atomic File Swap** (`sync_config.json.tmp` ➔ `sync_config.json`) dan **Auto-Backup** (`sync_config.json.bak`) sebelum menulis data baru.
  - Masking password otomatis (`••••••••`) pada response API dan UI agar kredensial database tidak terekspos sembarangan.

---

## 2. Arsitektur Sistem Enterprise AgroSync Hub

```
┌──────────────────────────────────────────────────────────────┐
│                    Web Dashboard (React)                     │
│  - Overview Monitoring       - Node & Config Manager         │
│  - Live Activity Viewer      - Smart DDL Migration Runner    │
│  - Multi-Device LAN Guide                                    │
└──────────────────────────────┬───────────────────────────────┘
                               │ REST API / JSON (CORS Enabled)
┌──────────────────────────────▼───────────────────────────────┐
│                 FastAPI Enterprise Backend                   │
│  - /api/health (Ping, Latency, Dual Server Status)           │
│  - /api/configs (CRUD sync_config.json + Masking)            │
│  - /api/sync (Start / Pause / Resume / Stop / Trigger)       │
│  - /api/metrics (Inserts, Updates, Deletes, per Company)     │
│  - /api/logs (In-Memory Ring Buffer & Filter Stream)         │
│  - /api/migration (Smart Alter Table Runner)                 │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
        PyODBC Driver                   PyODBC Driver
               │                               │
┌──────────────▼──────────────┐ ┌──────────────▼──────────────┐
│     Server Pusat (Hub)      │ │     Server Lokal (Spoke)    │
│   SQL Server (:1433)        │ │   SQL Server (:1434/:1433)  │
│   APIdb001, APIdb002, ...   │ │   APIdb001, APIdb002, ...   │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## 3. Spesifikasi Lapisan API Backend (FastAPI)

API berjalan di host `0.0.0.0` pada port `8000` (terbuka untuk akses lokal dan LAN).

| Metode | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Status kesehatan sistem, total node, online/offline, dan latensi ping (ms). |
| `GET` | `/api/configs` | Mengambil seluruh node database dengan password ter-masking (`••••••••`). |
| `POST` | `/api/configs` | Menambahkan node baru secara aman ke `sync_config.json`. |
| `PUT` | `/api/configs/{node_id}` | Memperbarui node (password lama tetap aman jika tidak diubah). |
| `DELETE` | `/api/configs/{node_id}` | Menghapus node dari `sync_config.json`. |
| `POST` | `/api/configs/test-connection` | Menguji konektivitas SQL Server dan mengukur latensi instan. |
| `GET` | `/api/sync/status` | Status siklus (`RUNNING`, `PAUSED`, `IDLE`, `STOPPED`), siklus ke-N, last sync. |
| `POST` | `/api/sync/start` | Menjalankan background sync worker. |
| `POST` | `/api/sync/pause` | Menjeda siklus sinkronisasi sementara. |
| `POST` | `/api/sync/resume` | Melanjutkan siklus sinkronisasi yang dijeda. |
| `POST` | `/api/sync/stop` | Menghentikan siklus sinkronisasi. |
| `POST` | `/api/sync/trigger` | Memicu sinkronisasi on-demand tanpa menunggu interval timer. |
| `GET` | `/api/metrics/summary` | Total Insert, Update, Delete global dan total transaksi. |
| `GET` | `/api/metrics/by-company` | Ringkasan metrik DML per entitas perusahaan (API, ANR, TTM). |
| `GET` | `/api/logs` | Mengambil riwayat log dengan filter `company`, `level`, `search`, `limit`. |
| `DELETE` | `/api/logs` | Membersihkan buffer log. |
| `GET` | `/api/migration/audit-summary` | Ringkasan 330+ tabel dari `database_schema_audit.json`. |
| `POST` | `/api/migration/run` | Menjalankan Smart DDL migration ke seluruh database lokal. |

---

## 4. Antarmuka Dashboard Frontend Web

Dibangun dengan **React**, arsitektur komponen modular, dan sistem desain CSS Dark Enterprise yang elegan:
1. **Overview Monitoring**:
   - Status badge kesehatan sistem (`HEALTHY`, `WARNING`, `CRITICAL`).
   - Kartu metrik transaksi DML global (Insert, Update, Delete, Total Transactions).
   - Rincian metrik per entitas perusahaan (API, ANR, TTM).
   - Kartu kesehatan node dengan status koneksi Server Pusat & Server Lokal serta latensi real-time.
   - Cuplikan aktivitas terkini.
2. **Config & Node Manager**:
   - Tabel node interaktif dari `sync_config.json`.
   - Masking password demi keamanan enterprise.
   - Form modal untuk Tambah dan Edit node.
   - Fitur **Test Connection** langsung di dalam modal untuk memverifikasi host/port/kredensial sebelum disimpan.
3. **Live Activity Logs**:
   - Dual View: **Terminal Output View** (tampilan terminal warna-warni yang rapi) dan **Table View**.
   - Filter dinamis berdasarkan CompanyName, Log Level (`SUCCESS`, `INFO`, `WARNING`, `ERROR`), dan pencarian teks nama tabel.
   - Toggle **Live Auto-Polling (2.5s)**.
4. **Smart DDL Migration**:
   - Visualisasi ringkasan audit skema metadata 330+ tabel.
   - Tombol eksekusi *Smart Alter Table* dengan jaminan Zero Data Loss.
5. **Multi-Device Guide**:
   - Dokumentasi topologi jaringan dan panduan interaktif pengujian antar-perangkat.

---

## 5. Panduan Integrasi & Pengujian Multi-Device (Tahap 2)

Tahap ini menguji komunikasi jaringan nyata antara laptop Anda (host backend/database) dengan laptop mentor:

### Langkah 1: Hubungkan ke Jaringan Wi-Fi/LAN yang Sama
Pastikan kedua laptop terhubung ke router Wi-Fi atau hotspot yang sama.
Cari alamat IP lokal laptop Anda:
```bash
# Pada macOS / Linux:
ifconfig | grep "inet " | grep -v 127.0.0.1

# Pada Windows (CMD / PowerShell):
ipconfig
```
*Catat IPv4 Anda, contoh: `192.168.2.158`.*

### Langkah 2: Verifikasi Listener Port SQL Server
Pastikan SQL Server mendengarkan koneksi TCP/IP pada semua interface (`0.0.0.0`):
- Port 1433: Server Pusat
- Port 1434: Server Lokal
*(Jika menggunakan Docker, mapping port sudah aktif: `0.0.0.0:1433->1433/tcp` dan `0.0.0.0:1434->1433/tcp`).*

### Langkah 3: Konfigurasi Firewall Laptop Anda
Buka port-port berikut agar dapat diakses dari laptop mentor:
- **Port 8000** : FastAPI Backend REST API
- **Port 5173** : Frontend Web Dashboard (Vite)
- **Port 1433 & 1434** : SQL Server Instance
*Pada macOS: Pengaturan Sistem ➔ Jaringan ➔ Firewall. Pastikan "Block all incoming connections" nonaktif untuk port tersebut.*

### Langkah 4: Jalankan Backend & Frontend dengan Binding `0.0.0.0`
```bash
# Terminal 1: Backend API
python3 run_backend.py

# Terminal 2: Frontend Web
cd frontend && npm run dev -- --host 0.0.0.0
```

### Langkah 5: Akses dari Browser Laptop Mentor
Di laptop mentor, buka browser dan masukkan URL:
```text
http://192.168.2.158:5173
```
Dan dokumentasi API interaktif (Swagger):
```text
http://192.168.2.158:8000/docs
```

### Langkah 6: Skenario Uji Coba Bersama Mentor
1. Pada menu **Config & Node Manager**, mentor dapat melihat konfigurasi node yang sedang aktif.
2. Mentor dapat memasukkan alamat IP laptopnya sendiri jika ingin menjadikan laptopnya sebagai salah satu node SQL Server.
3. Klik tombol **Test Koneksi** untuk melihat latensi antar-laptop.
4. Lakukan penambahan atau perubahan baris data pada salah satu tabel di database pusat.
5. Klik **Sync Now (On-Demand)** atau biarkan siklus berjalan otomatis.
6. Pantau di **Live Activity Logs**: baris baru akan tersinkronisasi dengan indikator `+1 Ins` atau `~1 Upd` secara instan.

---

## 6. Panduan Menjalankan Sistem

### A. Menjalankan Backend API:
```bash
python3 run_backend.py
```
*(Backend akan aktif di `http://0.0.0.0:8000`, Swagger docs di `http://localhost:8000/docs`)*

### B. Menjalankan Frontend Web Dashboard:
```bash
cd frontend
npm run dev -- --host 0.0.0.0
```
*(Frontend akan aktif di `http://localhost:5173` dan `http://<IP_LAN>:5173`)*

### C. Menjalankan Skrip CLI Standalone Asli (Kompatibel 100%):
```bash
# Sinkronisasi Terminal CLI Tradisional
python3 sync.py

# Migrasi Skema Terminal Tradisional
python3 migrate_schema.py
```
Semua file asli tetap bekerja 100% tanpa ada gangguan atau *breaking changes*.
