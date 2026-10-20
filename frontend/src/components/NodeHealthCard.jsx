import React, { useState } from 'react';
import { Server, ArrowRight, CheckCircle2, XCircle, AlertCircle, Copy, Check, Database } from 'lucide-react';
import { useToast } from './Toast';

// Helper pembersih pesan error teknis SQL Server agar ramah dipahami pengguna
function formatErrorMessage(raw) {
  if (!raw) return null;
  const str = String(raw);
  if (str.includes('Login timeout expired')) {
    return 'Koneksi timeout: Server pusat tidak merespons (periksa apakah IP/hostname server pusat aktif & port 1433 dibuka).';
  }
  if (str.includes('belum dibuat di server ini')) {
    return str; // Pesan ramah yang sudah kita buat
  }
  if (str.includes('Login failed for user')) {
    return 'Login gagal: Username atau password SQL Server salah.';
  }
  if (str.includes('Server tidak ditemukan') || str.includes('SQL Server does not exist')) {
    return 'Server tidak ditemukan: Pastikan alamat IP/hostname benar dan SQL Server menyala.';
  }
  // Bersihkan format tuple Python kasar jika ada
  return str.replace(/^Gagal:\s*\([^\)]+\)/i, '').replace(/^\('HYT00',\s*'/i, '').replace(/'\)$/, '').trim() || str;
}

export default function NodeHealthCard({ node, onEdit }) {
  const toast = useToast();
  const [copiedKey, setCopiedKey] = useState(null);
  const isHealthy = node.overall_status === 'HEALTHY';
  const isDegraded = node.overall_status === 'DEGRADED';

  const handleCopy = (text, key, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Disalin ke Clipboard', `${label}: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const cleanPusatError = formatErrorMessage(node.pusat_error);
  const cleanLokalError = formatErrorMessage(node.lokal_error);

  return (
    <div className="card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        {/* Card Header: 2-Row Responsive Layout */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span 
              title={node.company_name}
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                padding: '3px 10px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.78rem',
                border: '1px solid rgba(16, 185, 129, 0.28)',
                maxWidth: '200px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'inline-block'
              }}
            >
              {node.company_name}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Node #{node.id + 1}
            </span>
          </div>

          <span className={`badge ${isHealthy ? 'badge-success' : isDegraded ? 'badge-warning' : 'badge-danger'}`} style={{ flexShrink: 0 }}>
            {node.overall_status}
          </span>
        </div>

        {/* Header Row 2: Database Name Route */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
          <Database size={15} color="#0284c7" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{node.database_pusat}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>➔</span>
            <span>{node.database_lokal}</span>
          </div>
        </div>

        {/* Dedicated Responsive Server Panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Server Pusat Box */}
          <div className="health-server-panel">
            <div className="health-server-header">
              <div className="health-server-title">
                <Server size={13} color="#38bdf8" />
                <span className="health-server-label pusat">Pusat</span>
                <strong className="health-server-db">{node.database_pusat}</strong>
              </div>
              <div className="health-server-status">
                {node.pusat_online ? (
                  <span className="status-ping-online">
                    <CheckCircle2 size={12} /> {node.pusat_latency_ms} ms
                  </span>
                ) : (
                  <span className="status-ping-offline">
                    <XCircle size={12} /> Offline
                  </span>
                )}
              </div>
            </div>
            <div className="health-server-addr-box">
              <span className="health-server-addr">{node.server_pusat || 'localhost,1433'}</span>
              <button
                type="button"
                className="btn-copy-chip"
                onClick={() => handleCopy(node.server_pusat || 'localhost,1433', `pusat-${node.id}`, 'Alamat Server Pusat')}
                title="Salin Alamat Server Pusat"
              >
                {copiedKey === `pusat-${node.id}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          {/* Flow Direction Indicator */}
          <div className="health-flow-divider">
            <div className="health-flow-line" />
            <span className="health-flow-arrow">➔ Target Lokal</span>
            <div className="health-flow-line" />
          </div>

          {/* Server Lokal Box */}
          <div className="health-server-panel">
            <div className="health-server-header">
              <div className="health-server-title">
                <Server size={13} color="#10b981" />
                <span className="health-server-label lokal">Lokal</span>
                <strong className="health-server-db">{node.database_lokal}</strong>
              </div>
              <div className="health-server-status">
                {node.lokal_online ? (
                  <span className="status-ping-online">
                    <CheckCircle2 size={12} /> {node.lokal_latency_ms} ms
                  </span>
                ) : (
                  <span className="status-ping-offline">
                    <XCircle size={12} /> Offline
                  </span>
                )}
              </div>
            </div>
            <div className="health-server-addr-box">
              <span className="health-server-addr">{node.server_lokal || 'Port Lokal'}</span>
              <button
                type="button"
                className="btn-copy-chip"
                onClick={() => handleCopy(node.server_lokal || '127.0.0.1,1433', `lokal-${node.id}`, 'Alamat Server Lokal')}
                title="Salin Alamat Server Lokal"
              >
                {copiedKey === `lokal-${node.id}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Note (jika ada kendala koneksi) */}
      {(cleanPusatError || cleanLokalError) && (
        <div className="health-error-box">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {cleanPusatError && (
                <div style={{ marginBottom: cleanLokalError ? '4px' : '0' }}>
                  <strong>Pusat:</strong> {cleanPusatError}
                </div>
              )}
              {cleanLokalError && (
                <div>
                  <strong>Lokal:</strong> {cleanLokalError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
