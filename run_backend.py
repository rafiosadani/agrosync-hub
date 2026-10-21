#!/usr/bin/env python3
import sys
import os
import uvicorn

# Tambahkan direktori root ke sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

if __name__ == "__main__":
    print("==================================================")
    print("🌾 AgroSync Hub Enterprise API Server")
    print("📡 Listening on: http://0.0.0.0:8000 (Local & LAN)")
    print("📚 Swagger Docs: http://localhost:8000/docs")
    print("==================================================")
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True, reload_dirs=[os.path.join(BASE_DIR, "backend")])
