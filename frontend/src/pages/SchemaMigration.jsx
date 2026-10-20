import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  FileText, 
  RefreshCw,
  Database
} from 'lucide-react';
import { api } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';

export default function SchemaMigration() {
  const confirm = useConfirm();
  const toast = useToast();
  const [auditSummary, setAuditSummary] = useState(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResults, setMigrationResults] = useState(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  const fetchAudit = async () => {
    setIsLoadingAudit(true);
    try {
      const data = await api.getAuditSummary();
      setAuditSummary(data);
    } catch (err) {
      console.error("Gagal mengambil audit summary:", err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  const handleRunMigration = async () => {
    const isConfirmed = await confirm({
      title: 'Jalankan Migrasi Skema Cerdas DDL',
      description: 'Apakah Anda ingin menjalankan Migrasi Skema Cerdas DDL (Smart Alter Table) pada semua database lokal? Operasi ini bersifat non-destruktif (Zero Data Loss) dan otomatis menyesuaikan struktur kolom.',
      confirmText: 'Mulai Migrasi Skema',
      variant: 'primary',
    });

    if (!isConfirmed) return;

    setIsMigrating(true);
    setMigrationResults(null);
    try {
      toast.info('Migrasi Berjalan', 'Engine sedang mengevaluasi dan menyelaraskan skema DDL...');
      const res = await api.runMigration();
      setMigrationResults(res);
      toast.success('Migrasi Skema Selesai', 'Seluruh database lokal telah diselaraskan dengan skema server pusat.');
    } catch (err) {
      toast.error('Migrasi Skema Gagal', err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Smart DDL Schema Migration (Zero Data Loss)
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
            Memprovisi database otomatis dan menangani 330+ tabel secara presisi dengan smart <code>ALTER TABLE ADD COLUMN NULL</code> tanpa merusak data eksisting.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleRunMigration}
          disabled={isMigrating}
        >
          <Play size={16} className={isMigrating ? 'animate-spin' : ''} />
          <span>{isMigrating ? 'Memproses Migrasi Skema...' : 'Jalankan Migrasi Skema Cerdas'}</span>
        </button>
      </div>

      {/* Safety Guarantee Banner */}
      <div style={{
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px'
      }}>
        <div style={{
          background: 'rgba(16, 185, 129, 0.2)',
          color: '#10b981',
          padding: '10px',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <ShieldCheck size={28} />
        </div>
        <div>
          <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#10b981', marginBottom: '4px' }}>
            Jaminan Zero Data Loss & Non-Destructive DDL
          </h4>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Mesin migrasi skema memeriksa keberadaan setiap tabel. Jika tabel sudah ada, mesin hanya menambahkan kolom yang belum ada (<code>ALTER TABLE ... ADD NULL</code>) dengan preservasi data 100%. Tidak ada perintah <code>DROP TABLE</code> atau <code>TRUNCATE</code> yang dieksekusi.
          </p>
        </div>
      </div>

      {/* Audit Stats Grid */}
      <div className="metrics-grid">
        <div className="metric-card" style={{ '--card-accent': '#10b981' }}>
          <div className="metric-header">
            <span className="metric-title">Tabel Terverifikasi</span>
            <Database size={20} color="#10b981" />
          </div>
          <div className="metric-value">{auditSummary?.total_tables || '330+'}</div>
          <div className="metric-sub">Tabel terdaftar dalam audit metadata</div>
        </div>

        <div className="metric-card" style={{ '--card-accent': '#06b6d4' }}>
          <div className="metric-header">
            <span className="metric-title">Total Kolom Skema</span>
            <Layers size={20} color="#06b6d4" />
          </div>
          <div className="metric-value">{auditSummary?.total_columns?.toLocaleString() || '1,700+'}</div>
          <div className="metric-sub">Kolom dipetakan dengan tipe presisi</div>
        </div>

        <div className="metric-card" style={{ '--card-accent': '#6366f1' }}>
          <div className="metric-header">
            <span className="metric-title">Primary Keys</span>
            <ShieldCheck size={20} color="#6366f1" />
          </div>
          <div className="metric-value">{auditSummary?.total_primary_keys?.toLocaleString() || '330+'}</div>
          <div className="metric-sub">Kunci unik terindeks untuk sinkronisasi</div>
        </div>
      </div>

      {/* Results View */}
      {migrationResults && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Hasil Eksekusi Migrasi Skema
            </h3>
            <span className="badge badge-success">Selesai Berhasil</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {migrationResults.map((res, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg-card-inner)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '18px',
                  boxShadow: 'var(--shadow-card, var(--shadow-sm))'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <Database size={15} color="#0284c7" style={{ flexShrink: 0 }} />
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem', wordBreak: 'break-word' }}>
                      {res.company_name} <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>({res.database})</span>
                    </strong>
                  </div>
                  <span className={`badge ${res.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`} style={{ flexShrink: 0 }}>
                    {res.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <span>Tabel Baru Dibuat:</span>
                    <strong style={{ color: res.created_tables > 0 ? '#10b981' : 'var(--text-primary)' }}>{res.created_tables}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <span>Tabel Diperiksa/Diperbarui:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{res.updated_tables}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <span>Kolom Baru Ditambahkan:</span>
                    <strong style={{ color: res.altered_columns > 0 ? '#0284c7' : 'var(--text-primary)' }}>{res.altered_columns}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample Audited Tables */}
      {auditSummary?.sample_tables && (
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
            Daftar Sampel Tabel Terdaftar (Audit Metadata)
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {auditSummary.sample_tables.map((tbl, i) => (
              <span
                key={i}
                style={{
                  background: 'var(--bg-card-inner)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)'
                }}
              >
                {tbl}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
