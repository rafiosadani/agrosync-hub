#!/bin/bash
# ==============================================================
# 🌾 AgroSync Hub - Quick Start Launcher
# ==============================================================

echo "=================================================="
echo "🚀 MEMERIKSA STATUS SISTEM AGROSYNC HUB..."
echo "=================================================="

# 1. Periksa Docker Daemon & Start Containers jika ada
if command -v docker &> /dev/null; then
    echo "🐳 Memeriksa Docker SQL Server..."
    if docker ps -a | grep -q "sqlserver"; then
        echo "   Menyalakan container SQL Server..."
        docker start sqlserver sqlserver_local 2>/dev/null
        echo "   ✅ SQL Server Pusat & Lokal siap!"
    fi
fi

echo ""
echo "=================================================="
echo "📌 CARA MENJALANKAN LENGKAP:"
echo "=================================================="
echo "Buka 2 Jendela Terminal terpisah:"
echo ""
echo "🔹 TERMINAL 1 (Backend API):"
echo "   cd /Users/rafioosadani/Downloads/agrosync-hub"
echo "   python3 run_backend.py"
echo ""
echo "🔹 TERMINAL 2 (Frontend Dashboard):"
echo "   cd /Users/rafioosadani/Downloads/agrosync-hub/frontend"
echo "   npm run dev"
echo ""
echo "🌐 URL Akses:"
echo "   - Dashboard Web : http://localhost:5173"
echo "   - API Swagger   : http://localhost:8000/docs"
echo "=================================================="
