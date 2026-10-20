import React, { useState, useEffect, useMemo } from 'react';
import { 
  PlusCircle, 
  RefreshCw, 
  Database, 
  Activity, 
  ArrowRight,
  RotateCcw,
  Wifi,
  Radar,
  ArrowUpDown,
  Trash2,
  Pause
} from 'lucide-react';
import MetricCard from '../components/MetricCard';
import NodeHealthCard from '../components/NodeHealthCard';
import SubnetScannerModal from '../components/SubnetScannerModal';
import { 
  SkeletonMetricCards, 
  SkeletonNodeHealthCards, 
  SkeletonActivityLog, 
  SkeletonNodeBreakdown 
} from '../components/Skeleton';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

export default function Overview({ 
  systemHealth, 
  metricsSummary, 
  companyMetrics, 
  configs,
  recentLogs, 
  syncStatus,
  isLoading = false,
  onNavigateToNodes,
  onNavigateToLogs,
  onRefreshMetrics
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [networkInfo, setNetworkInfo] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [nodeSortBy, setNodeSortBy] = useState(() => {
    return localStorage.getItem('agrosync_overview_node_sort') || 'alphabetical';
  });

  const handleSortChange = (newSort) => {
    setNodeSortBy(newSort);
    localStorage.setItem('agrosync_overview_node_sort', newSort);
  };

  const state = syncStatus?.state || 'IDLE';
  const isLoopActive = state === 'RUNNING' || (Boolean(syncStatus?.is_loop_running) && state !== 'PAUSED');
  const isPaused = state === 'PAUSED';
  const isOnDemandSyncing = (state === 'SYNCING' || Boolean(syncStatus?.is_syncing_once)) && !isLoopActive && !isPaused;

  useEffect(() => {
    api.getNetworkInfo().then(info => {
      if (info && (info.local_ip || info.status === 'success')) {
        setNetworkInfo(info);
      }
    }).catch(err => {
      console.debug("Gagal memuat network info:", err);
    });
  }, []);

  // Daftar database node untuk metrik: prioritaskan companyMetrics, atau fallback ke systemHealth.nodes
  const rawNodes = (companyMetrics && companyMetrics.length > 0)
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
        status: 'STANDBY',
        is_active: n.is_active !== false
      })) || []);

  const displayNodes = useMemo(() => {
    const list = [...rawNodes];
    return list.sort((a, b) => {
      // 1. Prioritaskan Node Aktif di atas Node Non-Aktif
      const aActive = a.is_active !== false;
      const bActive = b.is_active !== false;
      if (aActive !== bActive) return aActive ? -1 : 1;

      // 2. Berdasarkan pilihan sort
      if (nodeSortBy === 'transactions') {
        const aTotal = (a.total_inserts || 0) + (a.total_updates || 0) + (a.total_deletes || 0);
        const bTotal = (b.total_inserts || 0) + (b.total_updates || 0) + (b.total_deletes || 0);
        if (bTotal !== aTotal) return bTotal - aTotal; // Terbanyak di atas
      } else if (nodeSortBy === 'config') {
        if (configs && configs.length > 0) {
          const getCfgIndex = (item) => configs.findIndex(c => 
            (c.CompanyName === item.company_name) && 
            (c.DatabasePusat === item.database_pusat || c.DatabaseLokal === item.database_lokal)
          );
          const aIdx = getCfgIndex(a);
          const bIdx = getCfgIndex(b);
          if (aIdx !== -1 && bIdx !== -1 && aIdx !== bIdx) return aIdx - bIdx;
          if (aIdx !== -1) return -1;
          if (bIdx !== -1) return 1;
        }
      }

      // Default: 'alphabetical' (Nama Perusahaan lalu Nama Database secara Natural A-Z)
      const cmp = (a.company_name || '').localeCompare(b.company_name || '');
      if (cmp !== 0) return cmp;
      return (a.database_pusat || '').localeCompare(b.database_pusat || '', undefined, { numeric: true });
    });
  }, [rawNodes, nodeSortBy, configs]);

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
      {/* Top Banner / Header (Stable Stacked Layout as in Image 3) */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '18px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: 'var(--shadow-card, var(--shadow-sm))'
      }}>
        {/* Row 1: Title & Version Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.22rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0 }}>
            AgroSync Enterprise Hub & Monitoring
          </h2>
          <span className="badge badge-success" style={{ fontSize: '0.74rem', padding: '3px 9px' }}>
            Production v1.0
          </span>
        </div>

        {/* Row 2: Subtitle Description */}
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.5, margin: 0 }}>
          Sistem sinkronisasi database cerdas hub-and-spoke multi-perusahaan (API, AGC, TTM) dengan DDL Non-Destruktif dan pelacakan DML tingkat kolom secara real-time.
        </p>

        {/* Row 3: Action & Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
          {networkInfo && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              color: '#0284c7'
            }}>
              <Wifi size={13} />
              <span>Host Lokal: <strong>{networkInfo.local_ip}</strong> <span style={{ color: 'var(--text-muted)' }}>({networkInfo.local_hostname})</span></span>
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setIsScannerOpen(true)}>
            <Radar size={13} />
            <span>Scan SQL Server di WiFi</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onNavigateToNodes}>
            <Database size={13} />
            <span>Kelola {systemHealth?.total_nodes || 0} Node Database</span>
          </button>
        </div>
      </div>

      {/* Live Sync Progress Indicator Banner (Task 3) */}
      {isOnDemandSyncing && (
        <div className="sync-live-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="icon-wrapper">
              <RefreshCw size={20} className="animate-spin" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚡ Sedang Mengeksekusi Sinkronisasi On-Demand (1 Siklus)...</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Engine sedang memindai delta skema & mentransfer perubahan DML (INSERT/UPDATE/DELETE) secara instan 1 kali jalan.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'rgba(56, 189, 248, 0.15)', color: '#0284c7', border: '1px solid rgba(56, 189, 248, 0.4)' }}>
              <span className="pulse-dot pulse-dot-blue" />
              <span>LIVE ON-DEMAND</span>
            </span>
          </div>
        </div>
      )}

      {isLoopActive && (
        <div className="sync-live-banner" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
              <Activity size={20} className="animate-pulse" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🔄 Siklus Sinkronisasi Otomatis Aktif (Loop Berulang)</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Engine aktif memantau perubahan data secara berkala tiap {syncStatus?.interval_seconds || 10} detik. Tekan 'Jeda Siklus' atau 'Stop' di navbar jika ingin menghentikan.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px' }}>
              <span className="pulse-dot pulse-dot-green" />
              <span>LOOP AKTIF</span>
            </span>
          </div>
        </div>
      )}

      {isPaused && (
        <div className="sync-live-banner" style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
              <Pause size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⏸️ Siklus Sinkronisasi Otomatis Sedang Dijeda (Paused)</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Engine ditahan sementara oleh pengguna. Klik tombol 'Lanjutkan Siklus' berwarna hijau di navbar untuk melanjutkan.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px' }}>
              <span>DIJEDA (PAUSED)</span>
            </span>
          </div>
        </div>
      )}

      {/* Global DML Transaction Metrics */}
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
          Statistik Transaksi DML Global
        </h3>
        {isLoading ? (
          <SkeletonMetricCards />
        ) : (
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
        )}
      </div>

      {/* Per Database Node Breakdown */}
      {isLoading ? (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Aktivitas Transaksi Per Database Node
            </h3>
          </div>
          <SkeletonNodeBreakdown count={configs?.length || 2} />
        </div>
      ) : displayNodes.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Aktivitas Transaksi Per Database Node
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Pelacakan metrik DML terpisah secara presisi untuk setiap database (misal: APIdb001, APIdb002, TTMdb002).
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px',
                background: 'var(--bg-card-inner)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}>
                <ArrowUpDown size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Urutkan:
                </span>
                <select
                  value={nodeSortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none',
                    padding: '2px 0'
                  }}
                  title="Pilih standar pengurutan kartu aktivitas transaksi database"
                >
                  <option value="alphabetical" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Nama Database (A-Z)</option>
                  <option value="config" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Urutan Konfigurasi</option>
                  <option value="transactions" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Transaksi Terbanyak</option>
                </select>
              </div>

              <span className="badge badge-neutral" style={{ fontSize: '0.78rem' }}>
                {displayNodes.length} Database Node
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {displayNodes.map((cmp, i) => (
              <div 
                key={cmp.node_key || i} 
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow-card, var(--shadow-sm))'
                }}
              >
                <div>
                  {/* Header Row 1: Company Badge & Status/Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                    <span 
                      title={cmp.company_name}
                      style={{
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        border: '1px solid rgba(16, 185, 129, 0.28)',
                        maxWidth: '220px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'inline-block'
                      }}
                    >
                      {cmp.company_name}
                    </span>
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
                          background: 'var(--bg-card-hover)',
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

                  {/* Header Row 2: Database Name with Icon & Target */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <strong style={{ fontSize: '0.98rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <Database size={15} color="#0284c7" style={{ flexShrink: 0 }} />
                      <span>{cmp.database_pusat || cmp.company_name}</span>
                      {cmp.database_lokal && cmp.database_lokal !== cmp.database_pusat && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>➔</span>
                          <span>{cmp.database_lokal}</span>
                        </span>
                      )}
                    </strong>
                  </div>

                  {/* Route Info: Server Pusat -> Server Lokal (Responsive Pill) */}
                  <div className="node-route-container">
                    <div className="node-route-item">
                      <span className="node-route-tag pusat">PUSAT</span>
                      <span className="node-route-address">{cmp.server_pusat || 'localhost,1433'}</span>
                    </div>
                    <span className="node-route-arrow">➔</span>
                    <div className="node-route-item">
                      <span className="node-route-tag lokal">LOKAL</span>
                      <span className="node-route-address">{cmp.server_lokal || 'Port Lokal'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', margin: '14px 0' }}>
                    <div style={{ background: 'var(--bg-card-inner)', border: '1px solid var(--border-subtle)', padding: '10px 6px', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, letterSpacing: '0.04em' }}>INSERT</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{cmp.total_inserts?.toLocaleString() || 0}</div>
                    </div>
                    <div style={{ background: 'var(--bg-card-inner)', border: '1px solid var(--border-subtle)', padding: '10px 6px', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 700, letterSpacing: '0.04em' }}>UPDATE</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{cmp.total_updates?.toLocaleString() || 0}</div>
                    </div>
                    <div style={{ background: 'var(--bg-card-inner)', border: '1px solid var(--border-subtle)', padding: '10px 6px', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700, letterSpacing: '0.04em' }}>DELETE</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{cmp.total_deletes?.toLocaleString() || 0}</div>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Status Kesehatan Node Database (Pusat & Lokal)
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setIsScannerOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Radar size={13} />
              <span>Pindai Port 1433 Subnet</span>
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Live Latency & Connection Ping
            </span>
          </div>
        </div>

        {isLoading ? (
          <SkeletonNodeHealthCards count={configs?.length || 3} />
        ) : systemHealth?.nodes && systemHealth.nodes.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
            {systemHealth.nodes.map((node) => (
              <NodeHealthCard key={node.id} node={node} />
            ))}
          </div>
        ) : (
          <div className="card" style={{
            textAlign: 'center',
            padding: '36px 20px',
            border: '1px dashed var(--border-subtle)',
            background: 'var(--bg-card-inner)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.1)',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Database size={22} />
            </div>
            <div>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Belum Ada Node Database yang Dikonfigurasi
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto', lineHeight: 1.5 }}>
                Database destination (lokal) atau source (pusat) belum terhubung ke sistem. Silakan daftarkan database node baru untuk memulai sinkronisasi DML & migrasi DDL.
              </p>
            </div>
            <button 
              type="button" 
              className="btn btn-primary btn-sm" 
              onClick={onNavigateToNodes}
              style={{ marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <PlusCircle size={14} />
              <span>+ Konfigurasi Node Database Pertama</span>
            </button>
          </div>
        )}
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

        {isLoading ? (
          <SkeletonActivityLog count={5} />
        ) : (
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
                    background: 'var(--bg-card-inner)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.84rem',
                    boxShadow: 'var(--shadow-card, var(--shadow-sm))'
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
                      <strong style={{ color: '#10b981' }}>[{log.company_name}]</strong>
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
        )}
      </div>

      {/* Subnet Scanner Modal */}
      <SubnetScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        networkInfo={networkInfo}
        configs={configs}
        onNodeUpdated={onRefreshMetrics}
      />
    </div>
  );
}
