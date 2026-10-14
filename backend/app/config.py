import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = BASE_DIR / "sync_config.json"
SCHEMA_AUDIT_PATH = BASE_DIR / "database_schema_audit.json"
BACKUP_CONFIG_PATH = BASE_DIR / "sync_config.json.bak"
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)
STATE_FILE_PATH = LOG_DIR / "sync_state.json"

# ODBC Drivers to try in priority order
PREFERRED_ODBC_DRIVERS = [
    "ODBC Driver 18 for SQL Server",
    "ODBC Driver 17 for SQL Server",
    "SQL Server",
    "FreeTDS"
]

def get_installed_driver():
    """Detect available ODBC driver in the system"""
    try:
        import pyodbc
        available = pyodbc.drivers()
        for driver in PREFERRED_ODBC_DRIVERS:
            if driver in available:
                return driver
        if available:
            return available[0]
    except Exception:
        pass
    return "ODBC Driver 18 for SQL Server"

CURRENT_ODBC_DRIVER = get_installed_driver()
