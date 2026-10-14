import json
import os
import pyodbc

# Dapatkan direktori tempat file migrate_schema.py ini berada
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(BASE_DIR, "sync_config.json")
json_metadata_path = os.path.join(BASE_DIR, "database_schema_audit.json") # File metadata audit DDL

def map_sql_type(col_metadata):
    """Penerjemah tipe data SQL Server secara akurat berdasarkan metadata audit"""
    dt = col_metadata["DataType"].lower()
    max_length = col_metadata["MaxLength"]
    
    if dt in ('varchar', 'char'):
        return f"VARCHAR({max_length})" if str(max_length) != 'MAX' else "VARCHAR(MAX)"
    elif dt in ('nvarchar', 'nchar'):
        return f"NVARCHAR({max_length})" if str(max_length) != 'MAX' else "NVARCHAR(MAX)"
    elif dt in ('varbinary', 'binary', 'image'):
        # Menangani tipe data biner secara presisi (termasuk kolom Model di __MigrationHistory)
        return f"VARBINARY({max_length})" if str(max_length) != 'MAX' else "VARBINARY(MAX)"
    elif dt in ('decimal', 'numeric'):
        precision = col_metadata.get("NumericPrecision", 25)
        scale = col_metadata.get("NumericScale", 5)
        if precision == 0:
            precision = 25
        return f"DECIMAL({precision}, {scale})"
    elif dt == 'float':
        return "FLOAT"
    elif dt == 'int':
        return "INT"
    elif dt == 'datetime' or dt == 'smalldatetime':
        return "DATETIME"
    elif dt == 'date':
        return "DATE"
    elif dt == 'bit':
        return "BIT"
    elif dt == 'uniqueidentifier':
        return "UNIQUEIDENTIFIER"
    elif dt in ('timestamp', 'rowversion'):
        return "VARBINARY(8)"
    else:
        return f"VARCHAR(MAX)"

def migrate_database_for_config(config, schema_data):
    comp_name = config["CompanyName"]
    db_lokal = config["DatabaseLokal"]
    server_lokal = config["ServerLokal"]
    user_lokal = config["UserLokal"]
    pwd_lokal = config["PasswordLokal"]

    print(f"\n[{comp_name}] 🔄 Memulai migrasi skema cerdas untuk database: {db_lokal}...")

    # 1. Pastikan database lokal ada (Auto-Create Database)
    master_conn_str = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={server_lokal};"
        f"DATABASE=master;"
        f"UID={user_lokal};"
        f"PWD={pwd_lokal};"
        f"TrustServerCertificate=yes;"
    )

    try:
        master_conn = pyodbc.connect(master_conn_str, autocommit=True)
        master_cursor = master_conn.cursor()
        master_cursor.execute(f"SELECT database_id FROM sys.databases WHERE name = '{db_lokal}'")
        if not master_cursor.fetchone():
            print(f"[{comp_name}] 🛠️ Database '{db_lokal}' belum ada. Membuat database baru...")
            master_cursor.execute(f"CREATE DATABASE [{db_lokal}];")
            print(f"[{comp_name}] ✅ Database '{db_lokal}' berhasil dibuat!")
        master_cursor.close()
        master_conn.close()
    except Exception as e:
        print(f"[{comp_name}] ❌ Gagal membuat database: {e}")
        return

    # 2. Koneksi ke database lokal untuk migrasi tabel cerdas (Smart Alter / Create)
    db_conn_str = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={server_lokal};"
        f"DATABASE={db_lokal};"
        f"UID={user_lokal};"
        f"PWD={pwd_lokal};"
        f"TrustServerCertificate=yes;"
    )

    # Kelompokkan metadata berdasarkan nama tabel dari file audit
    tables = {}
    for row in schema_data:
        t_name = row["TableName"]
        if t_name not in tables:
            tables[t_name] = []
        tables[t_name].append(row)

    try:
        conn = pyodbc.connect(db_conn_str)
        cursor = conn.cursor()
        print(f"[{comp_name}] 🚀 Memeriksa dan memperbarui {len(tables)} tabel (Data Anda aman)...")

        updated_count = 0
        created_count = 0

        for table_name, columns in tables.items():
            # Cek apakah tabel sudah ada di database lokal
            cursor.execute("""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = ?
            """, table_name)
            table_exists = cursor.fetchone()[0] > 0

            if not table_exists:
                # --- SKENARIO 1: Tabel belum ada, buat baru secara utuh ---
                sql_columns = []
                primary_keys = []
                unique_constraints = []

                for col in columns:
                    c_name = col["ColumnName"]
                    d_type = map_sql_type(col)
                    nullable = "NULL" if col["IsNullable"] == "YES" else "NOT NULL"
                    sql_columns.append(f"    [{c_name}] {d_type} {nullable}")

                    if col["IsPrimaryKey"] == "YES":
                        primary_keys.append(f"[{c_name}]")
                    if col.get("IsUnique") == "YES":
                        unique_constraints.append(f"CONSTRAINT UQ_{table_name}_{c_name} UNIQUE ([{c_name}])")

                if primary_keys:
                    sql_columns.append(f"    PRIMARY KEY ({', '.join(primary_keys)})")
                for uq in unique_constraints:
                    sql_columns.append(f"    {uq}")

                create_sql = f"CREATE TABLE [{table_name}] (\n" + ",\n".join(sql_columns) + "\n);"
                try:
                    cursor.execute(create_sql)
                    conn.commit()
                    created_count += 1
                except Exception as err:
                    print(f"[{comp_name}]   ⚠️ [Gagal Buat Tabel {table_name}]: {err}")
            
            else:
                # --- SKENARIO 2: Tabel sudah ada, cek kolom baru (Smart Alter Table) ---
                # Ambil daftar kolom yang sudah ada di lokal
                cursor.execute("""
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = ?
                """, table_name)
                existing_cols = {row[0].lower() for row in cursor.fetchall()}

                # Periksa apakah ada kolom di metadata pusat yang belum ada di lokal
                for col in columns:
                    c_name = col["ColumnName"]
                    if c_name.lower() not in existing_cols:
                        d_type = map_sql_type(col)
                        # Kolom baru yang ditambahkan harus bersifat NULL atau memiliki DEFAULT agar tidak error pada data eksisting
                        alter_sql = f"ALTER TABLE [{table_name}] ADD [{c_name}] {d_type} NULL;"
                        try:
                            cursor.execute(alter_sql)
                            conn.commit()
                            print(f"[{comp_name}]   ➕ [Alter Table] Menambahkan kolom baru [{c_name}] ke tabel [{table_name}]")
                        except Exception as alt_err:
                            print(f"[{comp_name}]   ⚠️ [Gagal Alter {table_name}.{c_name}]: {alt_err}")
                
                updated_count += 1

        print(f"[{comp_name}] 🎉 Selesai! {created_count} tabel baru dibuat, {updated_count} tabel diperbarui dengan aman (Tanpa kehilangan data).")
        cursor.close()
        conn.close()

    except Exception as ex:
        print(f"[{comp_name}] ❌ Error pada migrasi skema: {ex}")

def main():
    if not os.path.exists(config_path):
        print(f"❌ Error: File konfigurasi '{config_path}' tidak ditemukan!")
        return
    if not os.path.exists(json_metadata_path):
        print(f"❌ Error: File metadata schema '{json_metadata_path}' tidak ditemukan!")
        return

    with open(config_path, "r", encoding="utf-8") as f:
        configs = json.load(f)

    with open(json_metadata_path, "r", encoding="utf-8") as f:
        schema_data = json.load(f)

    print(f"🎯 Memuat {len(configs)} konfigurasi perusahaan untuk migrasi skema cerdas.")

    for cfg in configs:
        migrate_database_for_config(cfg, schema_data)

    print("\n🏁 Seluruh proses migrasi skema multi-database aman & selesai!")

if __name__ == "__main__":
    main()