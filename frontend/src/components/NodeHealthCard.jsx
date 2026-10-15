import React, { useState } from 'react';
import { Server, ArrowRight, CheckCircle2, XCircle, AlertCircle, Wifi, Copy, Check } from 'lucide-react';
import { useToast } from './Toast';

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

  return (
    <div className="card" style={{ padding: '20px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#34d399',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 800,
            fontSize: '0.85rem',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            flexShrink: 0
          }}>
            {node.company_name}
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.database_pusat} ➔ {node.database_lokal}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Node #{node.id + 1}</span>
              <span>•</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                Lokal: {node.server_lokal || 'Port Lokal'}
              </span>
            </div>
          </div>
        </div>

        <span className={`badge ${isHealthy ? 'badge-success' : isDegraded ? 'badge-warning' : 'badge-danger'}`} style={{ flexShrink: 0 }}>
          {node.overall_status}
        </span>
      </div>

      {/* Grid Server Pusat & Server Lokal */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(0, 0, 0, 0.25)',
        padding: '14px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)'
      }}>
        {/* Server Pusat */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Server size={14} color="#38bdf8" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
              Server Pusat
            </span>
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {node.database_pusat}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '4px'
          }}>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '0.74rem',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              padding: '2px 6px',
              borderRadius: '4px',
              wordBreak: 'break-all'
            }}>
              {node.server_pusat || 'localhost,1433'}
            </div>
            <button
              type="button"
              onClick={() => handleCopy(node.server_pusat || 'localhost,1433', `pusat-${node.id}`, 'Alamat Server Pusat')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s ease'
              }}
              title="Salin Alamat Server Pusat"
            >
              {copiedKey === `pusat-${node.id}` ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
            {node.pusat_online ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>
                <CheckCircle2 size={13} /> {node.pusat_latency_ms} ms
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#fb7185', fontWeight: 600 }}>
                <XCircle size={13} /> Offline
              </span>
            )}
          </div>
        </div>

        {/* Separator Arrow */}
        <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowRight size={18} />
        </div>

        {/* Server Lokal */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Server size={14} color="#34d399" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>
              Server Lokal
            </span>
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {node.database_lokal}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '4px'
          }}>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '0.74rem',
              color: '#34d399',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '2px 6px',
              borderRadius: '4px',
              wordBreak: 'break-all'
            }}>
              {node.server_lokal || 'Port Lokal'}
            </div>
            <button
              type="button"
              onClick={() => handleCopy(node.server_lokal || '127.0.0.1,1435', `lokal-${node.id}`, 'Alamat Server Lokal')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s ease'
              }}
              title="Salin Alamat Server Lokal"
            >
              {copiedKey === `lokal-${node.id}` ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
            {node.lokal_online ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>
                <CheckCircle2 size={13} /> {node.lokal_latency_ms} ms
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#fb7185', fontWeight: 600 }}>
                <XCircle size={13} /> Offline
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Error note if degraded or offline */}
      {(node.pusat_error || node.lokal_error) && (
        <div style={{
          marginTop: '12px',
          background: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.25)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          fontSize: '0.75rem',
          color: '#fb7185'
        }}>
          {node.pusat_error && <div>Pusat: {node.pusat_error}</div>}
          {node.lokal_error && <div>Lokal: {node.lokal_error}</div>}
        </div>
      )}
    </div>
  );
}
