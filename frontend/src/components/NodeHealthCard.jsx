import React from 'react';
import { Server, ArrowRight, CheckCircle2, XCircle, AlertCircle, Wifi } from 'lucide-react';

export default function NodeHealthCard({ node, onEdit }) {
  const isHealthy = node.overall_status === 'HEALTHY';
  const isDegraded = node.overall_status === 'DEGRADED';

  return (
    <div className="card" style={{ padding: '20px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#34d399',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 800,
            fontSize: '0.9rem',
            border: '1px solid rgba(16, 185, 129, 0.25)'
          }}>
            {node.company_name}
          </div>
          <div>
            <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {node.database_pusat} ➔ {node.database_lokal}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Node #{node.id + 1}</span>
              <span>•</span>
              <span style={{ fontFamily: 'monospace', color: '#6ee7b7' }}>
                Lokal: {node.server_lokal || 'Port Lokal'}
              </span>
            </div>
          </div>
        </div>

        <span className={`badge ${isHealthy ? 'badge-success' : isDegraded ? 'badge-warning' : 'badge-danger'}`}>
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
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {node.database_pusat}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            {node.pusat_online ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#34d399' }}>
                <CheckCircle2 size={12} /> {node.pusat_latency_ms} ms
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#fb7185' }}>
                <XCircle size={12} /> Offline
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
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {node.database_lokal}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            {node.lokal_online ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#34d399' }}>
                <CheckCircle2 size={12} /> {node.lokal_latency_ms} ms
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#fb7185' }}>
                <XCircle size={12} /> Offline
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
