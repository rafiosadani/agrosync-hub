from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routers import configs, health, sync_control, metrics, logs, migration
from .core.sync_engine import sync_engine
from .config import CURRENT_ODBC_DRIVER

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Server API siap melayani request
    print("🚀 [AgroSync Hub API] Memulai server API enterprise...")
    print(f"🔌 [ODBC Driver Terdeteksi]: {CURRENT_ODBC_DRIVER}")
    print("💤 [Mode Aman]: Engine dalam status STANDBY. Siklus sinkronisasi siap dipicu dari Web Dashboard.")
    # Safe Boot: Tidak langsung dipaksa start otomatis agar tidak memicu error jika SQL Server belum dinyalakan
    yield
    # Shutdown: Stop sync engine dengan rapi jika sedang berjalan
    print("🛑 [AgroSync Hub API] Menghentikan background sync engine...")
    sync_engine.stop()

app = FastAPI(
    title="AgroSync Hub Enterprise API",
    description="Backend API wrapper untuk pemantauan, konfigurasi node, dan kontrol sinkronisasi database hub-and-spoke.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration - mengizinkan akses dari browser lokal dan perangkat mentor di LAN
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Fleksibel untuk pengujian LAN / multi-device
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Daftarkan Router
app.include_router(health.router)
app.include_router(configs.router)
app.include_router(sync_control.router)
app.include_router(metrics.router)
app.include_router(logs.router)
app.include_router(migration.router)

@app.get("/")
def root():
    return {
        "app": "AgroSync Hub Enterprise API",
        "version": "1.0.0",
        "status": "ONLINE",
        "detected_odbc_driver": CURRENT_ODBC_DRIVER,
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    # Bind to 0.0.0.0 so other devices on the LAN can access it
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
