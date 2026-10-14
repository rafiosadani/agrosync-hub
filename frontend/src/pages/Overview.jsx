import React from 'react';
import { 
  PlusCircle, 
  RefreshCw, 
  Trash2, 
  ArrowUpRight, 
  Database, 
  Server, 
  Activity, 
  CheckCircle2, 
  TrendingUp,
  Layers,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import MetricCard from '../components/MetricCard';
import NodeHealthCard from '../components/NodeHealthCard';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

export default function Overview({ 
  systemHealth, 
  metricsSummary, 
  companyMetrics, 
  recentLogs, 
  onNavigateToNodes,
  onNavigateToLogs,
  onRefreshMetrics
}) {
  const toast = useToast();
  const confirm = useConfirm();

  // Daftar database node untuk metrik: prioritaskan companyMetrics, atau fallback ke systemHealth.nodes
  const displayNodes = (companyMetrics && companyMetrics.length > 0)
    ? companyMetrics
    : (systemHealth?.nodes?.map(n => ({
        node_key: `${n.company_name} - ${n.database_pusat} (${n.server_lokal})`,
        company_name: n.company_name,
        database_pusat: n.database_pusat,
        database_lokal: n.database_lokal,
        server_pusat: n.server_pusat,
        server_lokal: n.server_lokal,
        total_inserts: 0,
        total_updates: 0,
        total_deletes: 0,
        total_tables_synced: 0,
        last_sync_time: '-',
        status: 'STANDBY'
      })) || []);

  const handleResetNode = async (nodeKey) => {
    const isConfirmed = await confirm({
      title: 'Reset Akumulasi Transaksi',
      description: `Apakah Anda yakin ingin mereset seluruh akumulasi transaksi DML (Insert, Update, Delete) untuk node:\n\n${nodeKey}\n\nmenjadi 0? Riwayat sync tetap tercatat di log.`,
      confirmText: 'Reset Metrik ke 0',
      variant: 'warning'
    });

    if (isConfirmed) {
      try {
        await api.resetNodeMetrics(nodeKey);
        toast.success('Metrik Direset', `Akumulasi transaksi untuk ${nodeKey} berhasil disetel ke 0.`);
        onRefreshMetrics?.();
      } catch (err) {
        toast.error('Gagal Mereset Metrik', err.message);
      }
    }
  };

  const handleDeleteNodeMetric = async (nodeKey) => {
    const isConfirmed = await confirm({
      title: 'Hapus Kartu Metrik Node',
      description: `Apakah Anda yakin ingin menghapus kartu riwayat metrik node:\n\n${nodeKey}\n\ndari dashboard? Tindakan ini akan membersihkan kartu non-aktif.`,
      confirmText: 'Hapus Kartu',
      variant: 'danger'
    });

    if (isConfirmed) {
      try {
        await api.deleteNodeMetrics(nodeKey);
        toast.success('Kartu Dihapus', `Kartu metrik node berhasil dibersihkan dari dashboard.`);
        onRefreshMetrics?.();
      } catch (err) {
        toast.error('Gagal Menghapus Kartu Metrik', err.message);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner / Header */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              AgroSync Enterprise Hub & Monitoring
            </h2>
            <span className="badge badge-success">Production v1.0</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Sistem sinkronisasi database cerdas hub-and-spoke multi-perusahaan (API, ANR, TTM) dengan DDL Non-Destruktif dan pelacakan DML tingkat kolom secara real-time.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onNavigateToNodes}>
            <Database size={13} />
            <span>Kelola {systemHealth?.total_nodes || 0} Node Database</span>
          </button>
        </div>
      </div>

      {/* Global DML Transaction Metrics */}
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
          Statistik Transaksi DML Global
        </h3>
        <div className="metrics-grid">
          <MetricCard
            title="Total Inserted"
            value={metricsSummary?.total_inserts || 0}
            subtitle="Baris baru disisipkan ke lokal"
            icon={PlusCircle}
            accentColor="#10b981"
            trend="+ Real-time"
          />
          <MetricCard
            title="Total Updated"
            value={metricsSummary?.total_updates || 0}
            subtitle="Baris disinkronkan perbedaan kolom"
            icon={RefreshCw}
            accentColor="#06b6d4"
            trend="Column-Level"
          />
          <MetricCard
            title="Total Deleted"
            value={metricsSummary?.total_deletes || 0}
            subtitle="Baris usang dibersihkan"
            icon={Trash2}
            accentColor="#f43f5e"
            trend="Zero-Orphan"
          />
          <MetricCard
            title="Total Transaksi DML"
            value={metricsSummary?.total_transactions || 0}
            subtitle={`Siklus #${metricsSummary?.current_cycle || 0} Berjalan`}
            icon={Activity}
            accentColor="#6366f1"
            trend="Active Loop"
          />
        </div>
      </div>

      {/* Per Database Node Breakdown */}
      {displayNodes.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Aktivitas Transaksi Per Database Node
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Pelacakan metrik DML terpisah secara presisi untuk setiap database (misal: APIdb001, APIdb002, TTMdb002).
              </p>
            </div>
            <span className="badge badge-neutral" style={{ fontSize: '0.78rem' }}>
              {displayNodes.length} Database Node Aktif
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {displayNodes.map((cmp, i) => (
              <div 
                key={cmp.node_key || i} 
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#34d399',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        flexShrink: 0
                      }}>
                        {cmp.company_name}
                      </span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Database size={14} color="#38bdf8" style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cmp.database_pusat || cmp.company_name}</span>
                      </strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {cmp.is_active === false && (
                        <span className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                          NON-AKTIF
                        </span>
                      )}
                      <span className={`badge ${cmp.status === 'COMPLETED' ? 'badge-success' : cmp.status === 'FAILED' ? 'badge-danger' : 'badge-info'}`}>
                        {cmp.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleResetNode(cmp.node_key)}
                        title="Reset akumulasi transaksi node ini ke 0"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-muted)',
                          padding: '4px 6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <RotateCcw size={12} />
                      </button>
                      {cmp.is_active === false && (
                        <button
                          type="button"
                          onClick={() => handleDeleteNodeMetric(cmp.node_key)}
                          title="Hapus riwayat kartu node non-aktif ini"
                          style={{
                            background: 'rgba(244, 63, 94, 0.1)',
                            border: '1px solid rgba(244, 63, 94, 0.3)',
                            borderRadius: 'var(--radius-sm)',
                            color: '#fb7185',
                            padding: '4px 6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Route Info: Server Pusat -> Server Lokal */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.73rem',
                    fontFamily: 'monospace',
                    color: 'var(--text-secondary)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '5px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    marginBottom: '12px'
                  }}>
                    <span style={{ color: '#38bdf8' }}>{cmp.server_pusat || 'localhost,1433'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>➔</span>
                    <span style={{ color: '#34d399', fontWeight: 700 }}>{cmp.server_lokal || 'Port Lokal'}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', margin: '14px 0' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>INSERT</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{cmp.total_inserts}</div>
                    </div>
                    <div style={{ background: 'rgba(6, 182, 212, 0.08)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>UPDATE</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{cmp.total_updates}</div>
                    </div>
                    <div style={{ background: 'rgba(244, 63, 94, 0.08)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.72rem', color: '#fb7185', fontWeight: 600 }}>DELETE</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{cmp.total_deletes}</div>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginTop: '6px' }}>
                  <span>Diproses: <strong style={{ color: 'var(--text-secondary)' }}>{cmp.total_tables_synced} Tabel</strong></span>
                  <span>Terakhir: <strong style={{ color: 'var(--text-secondary)' }}>{cmp.last_sync_time || '-'}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Database Nodes Health Grid */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Status Kesehatan Node Database (Pusat & Lokal)
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Live Latency & Connection Ping
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
          {systemHealth?.nodes?.map((node) => (
            <NodeHealthCard key={node.id} node={node} />
          ))}
        </div>
      </div>

      {/* Recent Activity Log Preview */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Aktivitas Sinkronisasi Terkini
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={onNavigateToLogs}>
            <span>Buka Live Logs Lengkap</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recentLogs && recentLogs.length > 0 ? (
            recentLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.84rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className={`badge ${
                    log.level === 'SUCCESS' ? 'badge-success' :
                    log.level === 'ERROR' ? 'badge-danger' :
                    log.level === 'WARNING' ? 'badge-warning' : 'badge-info'
                  }`} style={{ fontSize: '0.7rem' }}>
                    {log.level}
                  </span>
                  {log.company_name && (
                    <strong style={{ color: '#34d399' }}>[{log.company_name}]</strong>
                  )}
                  <span style={{ color: 'var(--text-primary)' }}>{log.message}</span>
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '16px' }}>
                  {log.timestamp}
                </span>
              </div>
            ))
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Belum ada log aktivitas tercatat. Jalankan siklus sinkronisasi untuk memantau.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
