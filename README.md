# 🌾 AgroSync Hub - Enterprise Database Synchronization & Monitoring System

AgroSync Hub adalah platform replikasi dan pemantauan database enterprise cerdas berbasis arsitektur **Hub-and-Spoke**. Dirancang khusus untuk sinkronisasi multi-entitas/perusahaan (misal: API, TTM, ANR) antara **Server Pusat (Hub)** dan berbagai **Server Lokal / Remote Spokes** (Localhost maupun IP Jaringan LAN/WAN) dengan DDL Non-Destruktif dan pelacakan DML tingkat kolom (*column-level*) secara real-time.

---

## 🌟 Fitur Utama

- **Replikasi Hub-and-Spoke Multi-Node**: Mengakomodasi skenario di mana satu database pusat disinkronkan ke beberapa spoke lokal berbeda (misal: `localhost:1434` dan remote network `192.168.2.99:1435`).
- **Observabilitas Real-Time**:
  - **Status Kesehatan Node**: Latensi live ping (ms), ketersediaan socket koneksi, dan pemetaan rute host/port ringkas tanpa clutter.
  - **Aktivitas Transaksi Presisi**: Pelacakan metrik `INSERT`, `UPDATE`, dan `DELETE` terisolasi per database node.
  - **Reset & Clean Per Node**: Kontrol granular untuk mereset angka transaksi per node atau membersihkan node non-aktif/pensiun.
- **Smart Dynamic Re-binding**: Perubahan IP jaringan pada node aktif di [`sync_config.json`](sync_config.json) secara cerdas memindahkan riwayat transaksi tanpa menimbulkan kartu hantu (*ghost/orphan cards*).
- **Masking Kredensial & Fitur Intip Password**: Form UI dilengkapi sensor masking dan tombol mata (*Show/Hide Password*) untuk mencegah kesalahan ketik pada kredensial SQL Server yang kompleks.
- **DDL Non-Destruktif & Auto-Healing**: Penambahan kolom baru di server pusat otomatis dimigrasikan ke server lokal tanpa menghapus data yang ada (*zero data loss*).
- **Background Worker & Resilience**: Sinkronisasi berjalan otomatis dengan timer siklus, dukungan tombol On-Demand Trigger, Start, Pause, dan Resume.

---

## 🏗️ Arsitektur Teknologi

- **Backend**: Python 3, FastAPI, PyODBC, Uvicorn, ThreadPoolExecutor parallel health ping.
- **Frontend**: React 18, Vite, Lucide React Icons, JetBrains Mono & Plus Jakarta Sans typography.
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
Edit `sync_config.json` sesuai target database Anda:
```json
[
  {
    "CompanyName": "API",
    "ServerPusat": "localhost,1433",
    "DatabasePusat": "APIdb001",
    "UserPusat": "sa",
    "PasswordPusat": "YourStrongPassword!",
    "ServerLokal": "192.168.2.99,1435",
    "DatabaseLokal": "APIdb001",
    "UserLokal": "sa",
    "PasswordLokal": "YourStrongPassword!"
  }
]
```

### 3. Menjalankan Backend API
```bash
python3 run_backend.py
```
- API Server: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`

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
│   │   ├── components/         # NodeHealthCard, MetricCard, Navbar, Sidebar, Modal
│   │   ├── pages/              # Overview, NodeManager, LiveLogs, SchemaMigration, NetworkGuide
│   │   └── api.js              # REST Client & Error Handling
│   └── index.html
├── logs/                       # Persistent Sync State & Activity History
├── sync_config.json            # Active Node Configuration
├── sync_config.example.json    # Example Template Configuration
├── run_backend.py              # Backend Startup Script
└── start_system.sh             # Full-Stack Launch Script
```

---

## 📄 Lisensi
Dikembangkan untuk kebutuhan Enterprise Database Synchronization & Real-Time Monitoring.
