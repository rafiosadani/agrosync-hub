import React, { useState } from 'react';
import { Play, Pause, Square, Zap, RefreshCw, Clock, AlertTriangle, Database, ArrowRight } from 'lucide-react';
import { api } from '../api';

import { useToast } from './Toast';

export default function Navbar({ 
  syncStatus, 
  systemHealth, 
  onTriggerSync, 
  onRefreshAll, 
  isRefreshing,
  onNavigateToMigration 
}) {
  const toast = useToast();
  const state = syncStatus?.state || 'IDLE';
  const [warningMessage, setWarningMessage] = useState(null);

  // Periksa apakah seluruh database online dan sehat
  const isDatabaseReady = systemHealth && (systemHealth.status === 'HEALTHY' || systemHealth.healthy_nodes > 0);
  const hasOfflineNodes = systemHealth && (systemHealth.offline_nodes > 0 || systemHealth.degraded_nodes > 0);

  const getStatusBadge = (currentState) => {
    switch (currentState) {
      case 'RUNNING':
        return (
          <span className="badge badge-success" title="Mesin aktif: sinkronisasi otomatis berputar tiap 10 detik">
            <span className="pulse-dot pulse-dot-green" /> LOOP AKTIF (SYNCING)
          </span>
        );
      case 'PAUSED':
        return (
          <span className="badge badge-warning" title="Mesin ditahan sementara oleh pengguna">
            PAUSED (DIJEDA)
          </span>
        );
      case 'STOPPED':
        return (
          <span className="badge badge-danger" title="Siklus otomatis dimatikan">
            STOPPED (BERHENTI)
          </span>
        );
      case 'IDLE':
      default:
        return (
          <span className="badge badge-info" title="Mesin siaga dan siap dijalankan kapan saja">
            STANDBY (SIAGA)
          </span>
        );
    }
  };

  // Validasi pra-koneksi sebelum mengeksekusi siklus sync
  const checkPreconditions = () => {
    if (!systemHealth) return true;

    // Jika seluruh node offline atau sistem berstatus CRITICAL
    if (systemHealth.status === 'CRITICAL' || systemHealth.healthy_nodes === 0) {
      const offlineDetail = systemHealth.nodes
        ?.filter(n => n.overall_status !== 'HEALTHY')
        .map(n => `• ${n.company_name} (${n.database_pusat} ➔ ${n.database_lokal}): ${n.pusat_error || n.lokal_error || 'Koneksi gagal'}`)
        .join('\n');

      setWarningMessage(
        `Koneksi database belum terhubung:\n${offlineDetail || 'Semua instance database berstatus offline'}\n\nSolusi:\n1. Pastikan Docker / SQL Server Pusat & Lokal sudah menyala.\n2. Jika database belum dibuat di server target, jalankan 'Smart DDL Schema Migration' terlebih dahulu.`
      );
      return false;
    }

    return true;
  };

  const handleStartOrResume = async () => {
    if (!checkPreconditions()) return;

    try {
      if (state === 'PAUSED') {
        await api.resumeSync();
        toast.info('Siklus Dilanjutkan', 'Engine sinkronisasi otomatis kembali aktif.');
      } else {
        await api.startSync();
        toast.success('Engine Dimulai', 'Siklus otomatis berputar tiap interval.');
      }
      onRefreshAll();
    } catch (err) {
      toast.error('Gagal Memulai Siklus', err.message);
    }
  };

  const handlePause = async () => {
    try {
      await api.pauseSync();
      toast.warning('Engine Dijeda', 'Siklus otomatis ditahan sementara.');
      onRefreshAll();
    } catch (err) {
      toast.error('Gagal Menjeda Siklus', err.message);
    }
  };

  const handleStop = async () => {
    try {
      await api.stopSync();
      toast.info('Engine Dihentikan', 'Siklus sinkronisasi otomatis dimatikan.');
      onRefreshAll();
    } catch (err) {
      toast.error('Gagal Menghentikan Siklus', err.message);
    }
  };

  const handleTrigger = async () => {
    if (!checkPreconditions()) return;

    try {
      await onTriggerSync();
    } catch (err) {
      toast.error('Gagal Sync On-Demand', err.message);
    }
  };

  return (
    <>
      <header className="navbar">
        {/* KIRI: Status Indikator Engine & Waktu Last Sync */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Engine State:
            </span>
            {getStatusBadge(state)}
          </div>

          {hasOfflineNodes && (
            <span 
              className="badge badge-warning" 
              style={{ cursor: 'pointer', fontSize: '0.72rem' }}
              onClick={() => checkPreconditions()}
              title="Klik untuk melihat detail kendala koneksi database"
            >
              <AlertTriangle size={12} />
              <span>{systemHealth?.degraded_nodes + systemHealth?.offline_nodes} Node Perlu Perhatian</span>
            </span>
          )}

          {syncStatus?.last_sync_time && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <Clock size={14} color="var(--text-muted)" />
              <span>Terakhir: <strong style={{ color: 'var(--text-primary)' }}>{syncStatus.last_sync_time}</strong></span>
            </div>
          )}
        </div>

        {/* KANAN: Tombol Kontrol Lengkap (Refresh, Play/Pause, Stop, Sync Now) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Tombol Refresh Data */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={onRefreshAll}
            disabled={isRefreshing}
            title="Perbarui data statistik & status ping latensi terkini di layar"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Tombol Play / Pause */}
          {state === 'RUNNING' ? (
            <button
              className="btn btn-warning btn-sm"
              onClick={handlePause}
              title="Tahan sementara siklus otomatis"
            >
              <Pause size={14} />
              <span>Jeda Siklus</span>
            </button>
          ) : (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleStartOrResume}
              title="Mulai menjalankan siklus sinkronisasi otomatis berulang"
            >
              <Play size={14} />
              <span>{state === 'PAUSED' ? 'Lanjutkan Siklus' : 'Mulai Siklus Otomatis'}</span>
            </button>
          )}

          {/* Tombol Stop (Hanya muncul jika sedang RUNNING atau PAUSED) */}
          {(state === 'RUNNING' || state === 'PAUSED') && (
            <button
              className="btn btn-danger btn-sm"
              onClick={handleStop}
              title="Hentikan total siklus otomatis dan kembali ke status Standby"
            >
              <Square size={13} />
              <span>Stop</span>
            </button>
          )}

          {/* Tombol Sync Now (On-Demand Single Trigger) */}
          <button
            className="btn btn-primary btn-sm"
            onClick={handleTrigger}
            title="Jalankan 1 kali siklus sinkronisasi instan saat ini juga (Ideal untuk testing data baru)"
          >
            <Zap size={14} />
            <span>Sync Now (On-Demand)</span>
          </button>
        </div>
      </header>

      {/* Modal Peringatan Jika Database Belum Siap / Belum Konek */}
      {warningMessage && (
        <div className="modal-overlay" onClick={() => setWarningMessage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="modal-header" style={{ borderBottomColor: 'rgba(245, 158, 11, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24' }}>
                <AlertTriangle size={20} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fbbf24' }}>
                  Pencegahan: Database Belum Siap
                </h3>
              </div>
            </div>
            
            <div className="modal-body" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <p style={{ marginBottom: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
                Sinkronisasi DML ditahan sementara demi keamanan sistem:
              </p>
              
              <div style={{
                background: 'rgba(0, 0, 0, 0.35)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: '#fb7185',
                whiteSpace: 'pre-wrap',
                marginBottom: '16px'
              }}>
                {warningMessage}
              </div>

              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                fontSize: '0.82rem',
                color: '#34d399'
              }}>
                💡 <strong>Tips Enterprise</strong>: Jika database baru di server tujuan belum dibuat, Anda cukup menjalankan menu <strong>Smart DDL Schema Migration</strong> untuk membuat database dan 330+ tabel secara otomatis.
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setWarningMessage(null)}>
                Tutup
              </button>
              {onNavigateToMigration && (
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => {
                    setWarningMessage(null);
                    onNavigateToMigration();
                  }}
                >
                  <Database size={14} />
                  <span>Buka Smart DDL Migration</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
