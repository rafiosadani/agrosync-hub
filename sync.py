import json
import os
import time
import pyodbc

# Dapatkan direktori file konfigurasi
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(BASE_DIR, "sync_config.json")

def handle_datetimeoffset(value):
    """Fungsi konverter agar pyodbc tidak error membaca DATETIMEOFFSET (-155)"""
    return str(value) if value else None

def get_primary_key(cursor, table_name):
    query = """
        SELECT c.name AS ColumnName
        FROM sys.indexes ind
        INNER JOIN sys.index_columns ic ON ind.object_id = ic.object_id AND ind.index_id = ic.index_id
        INNER JOIN sys.tables tab ON ind.object_id = tab.object_id
        INNER JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
        INNER JOIN sys.columns c ON tab.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE ind.is_primary_key = 1 AND tab.name = ?
    """
    cursor.execute(query, table_name)
    row = cursor.fetchone()
    return row.ColumnName if row else None

def get_table_columns(cursor, table_name):
    query = """
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
    """
    cursor.execute(query, table_name)
    return [row.COLUMN_NAME for row in cursor.fetchall()]

def run_sync_for_database(config):
    comp_name = config["CompanyName"]
    db_pusat = config["DatabasePusat"]
    db_lokal = config["DatabaseLokal"]
    
    conn_pusat_str = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={config['ServerPusat']};"
        f"DATABASE={db_pusat};"
        f"UID={config['UserPusat']};"
        f"PWD={config['PasswordPusat']};"
        f"TrustServerCertificate=yes;"
    )

    conn_lokal_str = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={config['ServerLokal']};"
        f"DATABASE={db_lokal};"
        f"UID={config['UserLokal']};"
        f"PWD={config['PasswordLokal']};"
        f"TrustServerCertificate=yes;"
    )

    print(f"\n[{comp_name}] 🔄 Memeriksa sinkronisasi ({db_pusat} ➔ {db_lokal})...")
    try:
        conn_pusat = pyodbc.connect(conn_pusat_str)
        conn_pusat.add_output_converter(-155, handle_datetimeoffset)
        conn_lokal = pyodbc.connect(conn_lokal_str)
        
        cursor_pusat = conn_pusat.cursor()
        cursor_lokal = conn_lokal.cursor()

        cursor_pusat.execute("""
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
        """)
        tables = [row.TABLE_NAME for row in cursor_pusat.fetchall()]

        for table in tables:
            pk_col = get_primary_key(cursor_pusat, table)
            columns = get_table_columns(cursor_pusat, table)
            
            if not pk_col or not columns or pk_col not in columns:
                continue

            col_list_str = ", ".join([f"[{c}]" for c in columns])

            try:
                cursor_pusat.execute(f"SELECT {col_list_str} FROM [{table}]")
                pusat_rows = cursor_pusat.fetchall()
            except Exception as err:
                continue

            pusat_dict = {}
            for row in pusat_rows:
                row_dict = dict(zip(columns, row))
                pk_val = row_dict[pk_col]
                pusat_dict[pk_val] = row_dict

            inserted_count = 0
            updated_count = 0
            deleted_count = 0

            # 1. Proses INSERT & UPDATE
            for pk_val, row_dict in pusat_dict.items():
                cursor_lokal.execute(f"SELECT {col_list_str} FROM [{table}] WHERE [{pk_col}] = ?", pk_val)
                lokal_row = cursor_lokal.fetchone()

                if not lokal_row:
                    placeholders = ", ".join(["?" for _ in columns])
                    insert_sql = f"INSERT INTO [{table}] ({col_list_str}) VALUES ({placeholders})"
                    values = [row_dict[c] for c in columns]
                    try:
                        cursor_lokal.execute(insert_sql, values)
                        conn_lokal.commit()
                        inserted_count += 1
                    except Exception as e:
                        pass
                else:
                    lokal_dict = dict(zip(columns, lokal_row))
                    changed_columns = []
                    
                    for col in columns:
                        if col == pk_col:
                            continue

                        val_pusat = row_dict[col]
                        val_lokal = lokal_dict[col]

                        if isinstance(val_pusat, bytes):
                            val_pusat = val_pusat.hex()
                        if isinstance(val_lokal, bytes):
                            val_lokal = val_lokal.hex()

                        is_diff = False
                        if isinstance(val_pusat, (int, float)) or hasattr(val_pusat, 'as_tuple'):
                            try:
                                if float(val_pusat) != float(val_lokal):
                                    is_diff = True
                            except:
                                if str(val_pusat) != str(val_lokal):
                                    is_diff = True
                        elif type(val_pusat).__name__ in ['datetime', 'date']:
                            if str(val_pusat) != str(val_lokal):
                                is_diff = True
                        elif str(val_pusat) != str(val_lokal):
                            is_diff = True

                        if is_diff:
                            changed_columns.append(col)
                    
                    if changed_columns:
                        set_clause = ", ".join([f"[{c}] = ?" for c in changed_columns])
                        update_sql = f"UPDATE [{table}] SET {set_clause} WHERE [{pk_col}] = ?"
                        update_values = [row_dict[c] for c in changed_columns]
                        update_values.append(pk_val)

                        try:
                            cursor_lokal.execute(update_sql, update_values)
                            conn_lokal.commit()
                            updated_count += 1
                        except Exception as e:
                            pass

            # 2. Proses DELETE
            cursor_lokal.execute(f"SELECT [{pk_col}] FROM [{table}]")
            lokal_pks = [row[0] for row in cursor_lokal.fetchall()]

            for l_pk in lokal_pks:
                if l_pk not in pusat_dict:
                    try:
                        cursor_lokal.execute(f"DELETE FROM [{table}] WHERE [{pk_col}] = ?", l_pk)
                        conn_lokal.commit()
                        deleted_count += 1
                    except Exception as e:
                        pass

            # Tampilkan ringkasan hanya jika ada perubahan pada tabel tersebut
            if inserted_count > 0 or updated_count > 0 or deleted_count > 0:
                print(f"   📊 [{table:<40}] ➔ ➕ Insert: {inserted_count} | 🔄 Update: {updated_count} | ❌ Delete: {deleted_count}")

        cursor_pusat.close()
        cursor_lokal.close()
        conn_pusat.close()
        conn_lokal.close()
        print(f"[{comp_name}] ✅ Sinkronisasi selesai dengan aman.")

    except Exception as ex:
        print(f"[{comp_name}] ❌ Error koneksi/sinkronisasi: {ex}")

def main_loop():
    if not os.path.exists(config_path):
        print(f"❌ Error: File konfigurasi '{config_path}' tidak ditemukan!")
        return

    with open(config_path, "r", encoding="utf-8") as f:
        configs = json.load(f)

    print(f"🎯 Memuat {len(configs)} perusahaan (API, ANR, TTM) untuk sinkronisasi otomatis.")

    while True:
        print(f"\n==================================================")
        print(f"🔄 [Enterprise Sync] Memulai siklus sinkronisasi...")
        print(f"==================================================")
        
        for cfg in configs:
            run_sync_for_database(cfg)

        print("\n💤 Siklus selesai. Menunggu 10 detik untuk siklus berikutnya...")
        time.sleep(10)

if __name__ == "__main__":
    main_loop()