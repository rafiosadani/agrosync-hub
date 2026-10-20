# 🌾 AgroSync Hub - Enterprise Database Synchronization & Monitoring System

AgroSync Hub adalah platform replikasi dan pemantauan database enterprise cerdas berbasis arsitektur **Hub-and-Spoke**. Dirancang khusus untuk sinkronisasi multi-entitas/perusahaan (misal: API, TTM, ANR) antara **Server Pusat (Hub)** dan berbagai **Server Lokal / Remote Spokes** (Localhost maupun IP Jaringan LAN/WAN) dengan DDL Non-Destruktif dan pelacakan DML tingkat kolom (*column-level*) secara real-time.

---

## 🌟 Fitur Utama

- **Replikasi Hub-and-Spoke Multi-Node**: Mengakomodasi skenario di mana satu database pusat disinkronkan ke beberapa spoke lokal berbeda (misal: `localhost:1434` dan remote network `192.168.2.99:1435`).
- **Batch Multi-Database Auto-Discovery**: Kemampuan menarik seluruh daftar database yang tersedia di SQL Server Pusat secara otomatis (`sys.databases`) dengan multi-select filter, auto-mapping 1:1 ke target server lokal, dan pencegahan duplikasi database terdaftar.
- **Enterprise Anti-Collision & Canonical IP/Hostname Resolution**: Memvalidasi kesamaan host target (`localhost`, `127.0.0.1`, `IP LAN`, `Hostname.local`) pada port yang sama untuk mencegah terjadinya tabrakan duplikasi target database.
- **Navigasi Rute SPA Modern (React Router DOM)**: URL bar selalu tersinkronisasi (`/`, `/nodes`, `/logs`, `/migration`, `/network`), mendukung tombol browser Back/Forward, serta aman di-refresh (`F5`) tanpa kehilangan state halaman aktif.
- **Observabilitas Real-Time & Pengurutan Transaksi Cerdas**:
  - **Status Kesehatan Node**: Latensi live ping (ms), ketersediaan socket koneksi, dan pemetaan rute host/port ringkas tanpa clutter.
  - **Aktivitas Transaksi Presisi**: Pelacakan metrik `INSERT`, `UPDATE`, dan `DELETE` terisolasi per database node.
  - **Pengurutan Fleksibel**: Standar pengurutan alfabetis natural A-Z (`APIdb001`, `APIdb002`, `APIdb010`) dengan prioritas node aktif, urutan konfigurasi, atau transaksi terbanyak.
  - **Reset & Clean Per Node**: Kontrol granular untuk mereset angka transaksi per node atau membersihkan node non-aktif/pensiun.
- **Smart Dynamic Re-binding**: Perubahan IP jaringan pada node aktif di [`sync_config.json`](sync_config.json) secara cerdas memindahkan riwayat transaksi tanpa menimbulkan kartu hantu (*ghost/orphan cards*).
- **Form Kredensial Ergonomis & Sensor Masking**: Tampilan 2 kolom berdampingan untuk User & Password di bawah Host & Port, dilengkapi tombol intip password (*Show/Hide Password*) tanpa default value membingungkan.
- **DDL Non-Destruktif & Auto-Healing**: Penambahan kolom baru di server pusat otomatis dimigrasikan ke server lokal tanpa menghapus data yang ada (*Zero Data Loss*).
- **Background Worker & Resilience**: Sinkronisasi berjalan otomatis dengan timer siklus, dukungan tombol On-Demand Trigger, Start, Pause, dan Resume.

---

## 🏗️ Arsitektur Teknologi

- **Backend**: Python 3.9+, FastAPI, PyODBC, Uvicorn, ThreadPoolExecutor parallel health ping.
- **Frontend**: React 19, Vite, React Router DOM v7 (SPA Client Routing), Lucide React Icons, JetBrains Mono & Plus Jakarta Sans typography.
- **Database Engine**: Microsoft SQL Server 2022 (Docker / Bare-metal / Windows Server).
- **Protokol**: TCP/IP Port 1433/1434/1435, REST API JSON, Real-Time Polling & Smart In-Memory Caching (10s TTL).

---

## 🚀 Panduan Memulai Cepat

### 1. Prasyarat
- Python 3.9+
- Node.js 18+ & npm
- Microsoft ODBC Driver 17/18 for SQL Server

### 2. Konfigurasi Database Node
Salin file konfigurasi contoh dan sesuaikan kredensial server:
```bash
cp sync_config.example.json sync_config.json
```
Atau cukup gunakan form dialog **Tambah Database Node** di web dashboard untuk mendaftarkan node baru secara grafis.

### 3. Menjalankan Backend API
```bash
python3 run_backend.py
```
- API Server: `http://localhost:8000`
- Swagger UI Docs: `http://localhost:8000/docs`

### 4. Menjalankan Web Dashboard
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```
Buka browser di `http://localhost:5173` untuk mengakses dashboard enterprise.

---

## 📁 Struktur Direktori

```
agrosync-hub/
├── backend/
│   └── app/
│       ├── api/routers/        # REST Endpoints (Configs, Health, Metrics, Sync, Logs)
│       ├── core/               # Sync Engine, Config Manager, Connection Tester, Schema Migrator
│       └── models/             # Pydantic Schemas & Data Contracts
├── frontend/
│   ├── src/
│   │   ├── components/         # NodeHealthCard, MetricCard, Navbar, Sidebar, Modal, Toast
│   │   ├── pages/              # Overview, NodeManager, LiveLogs, SchemaMigration, NetworkGuide
│   │   ├── context/            # ThemeContext (Dark/Light/Auto OS)
│   │   └── api.js              # REST Client & Error Handling
│   └── index.html
├── logs/                       # Persistent Sync State & Activity History
├── sync_config.json            # Active Node Configuration
├── sync_config.example.json    # Example Template Configuration
├── PANDUAN_SETUP_NODE_DAN_RESOLUSI_IP.md # Panduan Lengkap Operasional Pengguna
├── run_backend.py              # Backend Startup Script
└── start_system.sh             # Full-Stack Launch Script
```

---

## 📄 Lisensi
Dikembangkan untuk kebutuhan Enterprise Database Synchronization & Real-Time Monitoring.
