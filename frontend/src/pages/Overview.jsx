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
  Pause,
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
  CheckCircle2,
  AlertCircle,
  XCircle
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
  // Sorting & Filtering for Aktivitas Transaksi
  const [nodeSortBy, setNodeSortBy] = useState(() => {
    return localStorage.getItem('agrosync_overview_node_sort') || 'alphabetical';
  });
  const [searchTx, setSearchTx] = useState('');
  const [filterCompanyTx, setFilterCompanyTx] = useState('ALL');
  const [isExpandedTx, setIsExpandedTx] = useState(false);

  const handleSortChange = (newSort) => {
    setNodeSortBy(newSort);
    localStorage.setItem('agrosync_overview_node_sort', newSort);
  };

  // Sorting & Filtering for Status Kesehatan
  const [healthSortBy, setHealthSortBy] = useState(() => {
    return localStorage.getItem('agrosync_overview_health_sort') || 'critical';
  });
  const [searchHealth, setSearchHealth] = useState('');
  const [filterCompanyHealth, setFilterCompanyHealth] = useState('ALL');
  const [isExpandedHealth, setIsExpandedHealth] = useState(false);

  const handleHealthSortChange = (newSort) => {
    setHealthSortBy(newSort);
    localStorage.setItem('agrosync_overview_health_sort', newSort);
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

  const uniqueCompanies = useMemo(() => {
    const set = new Set();
    (configs || []).forEach(c => { if (c.CompanyName) set.add(c.CompanyName); });
    (companyMetrics || []).forEach(m => { if (m.company_name) set.add(m.company_name); });
    (systemHealth?.nodes || []).forEach(n => { if (n.company_name) set.add(n.company_name); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [configs, companyMetrics, systemHealth?.nodes]);

  const filteredAndSortedTxNodes = useMemo(() => {
    let list = [...rawNodes].filter(n => n.is_active !== false);

    // Filter Perusahaan
    if (filterCompanyTx !== 'ALL') {
      list = list.filter(n => n.company_name === filterCompanyTx);
    }

    // Live Search
    if (searchTx.trim()) {
      const q = searchTx.toLowerCase();
      list = list.filter(n =>
        (n.company_name || '').toLowerCase().includes(q) ||
        (n.database_pusat || '').toLowerCase().includes(q) ||
        (n.database_lokal || '').toLowerCase().includes(q) ||
        (n.server_pusat || '').toLowerCase().includes(q) ||
        (n.server_lokal || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => {
      if (nodeSortBy === 'transactions') {
        const aTotal = (a.total_inserts || 0) + (a.total_updates || 0) + (a.total_deletes || 0);
        const bTotal = (b.total_inserts || 0) + (b.total_updates || 0) + (b.total_deletes || 0);
        if (bTotal !== aTotal) return bTotal - aTotal;
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

      const cmp = (a.company_name || '').localeCompare(b.company_name || '');
      if (cmp !== 0) return cmp;
      return (a.database_pusat || '').localeCompare(b.database_pusat || '', undefined, { numeric: true });
    });
  }, [rawNodes, filterCompanyTx, searchTx, nodeSortBy, configs]);

  // Batasi 6 kartu jika belum di-expand
  const displayedTxNodes = useMemo(() => {
    if (!isExpandedTx && filteredAndSortedTxNodes.length > 6) {
      return filteredAndSortedTxNodes.slice(0, 6);
    }
    return filteredAndSortedTxNodes;
  }, [filteredAndSortedTxNodes, isExpandedTx]);

  // Filter & Sort untuk Status Kesehatan Node
  const filteredAndSortedHealthNodes = useMemo(() => {
    let list = [...(systemHealth?.nodes || [])];

    if (filterCompanyHealth !== 'ALL') {
      list = list.filter(n => n.company_name === filterCompanyHealth);
    }

    if (searchHealth.trim()) {
      const q = searchHealth.toLowerCase();
      list = list.filter(n =>
        (n.company_name || '').toLowerCase().includes(q) ||
        (n.database_pusat || '').toLowerCase().includes(q) ||
        (n.database_lokal || '').toLowerCase().includes(q) ||
        (n.server_pusat || '').toLowerCase().includes(q) ||
        (n.server_lokal || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => {
      if (healthSortBy === 'critical') {
        const getScore = (s) => (s === 'HEALTHY' ? 2 : s === 'DEGRADED' ? 1 : 0);
        const aScore = getScore(a.overall_status);
        const bScore = getScore(b.overall_status);
        if (aScore !== bScore) return aScore - bScore; // Critical first
      } else if (healthSortBy === 'latency') {
        const aLat = Math.max(a.pusat_latency_ms || 9999, a.lokal_latency_ms || 9999);
        const bLat = Math.max(b.pusat_latency_ms || 9999, b.lokal_latency_ms || 9999);
        if (aLat !== bLat) return aLat - bLat;
      } else if (healthSortBy === 'config') {
        return (a.id || 0) - (b.id || 0);
      }

      const cmp = (a.company_name || '').localeCompare(b.company_name || '');
      if (cmp !== 0) return cmp;
      return (a.database_pusat || '').localeCompare(b.database_pusat || '', undefined, { numeric: true });
    });
  }, [systemHealth?.nodes, filterCompanyHealth, searchHealth, healthSortBy]);

  const displayedHealthNodes = useMemo(() => {
    if (!isExpandedHealth && filteredAndSortedHealthNodes.length > 6) {
      return filteredAndSortedHealthNodes.slice(0, 6);
    }
    return filteredAndSortedHealthNodes;
  }, [filteredAndSortedHealthNodes, isExpandedHealth]);

  const healthSummary = useMemo(() => {
    const nodes = systemHealth?.nodes || [];
    let healthy = 0;
    let degraded = 0;
    let offline = 0;
    nodes.forEach(n => {
      if (n.overall_status === 'HEALTHY') healthy++;
      else if (n.overall_status === 'DEGRADED') degraded++;
      else offline++;
    });
    return { healthy, degraded, offline, total: nodes.length };
  }, [systemHealth?.nodes]);

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
      ) : rawNodes.length > 0 && (
        <div className="card">
          {/* Header Row 1: Title & Main Info */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Aktivitas Transaksi Per Database Node
                </h3>
                <span className="badge badge-neutral" style={{ fontSize: '0.74rem' }}>
                  {filteredAndSortedTxNodes.length} Node Terpilih
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                Pelacakan metrik DML terpisah secara presisi untuk setiap database (misal: APIdb001, APIdb002, TTMdb002).
              </p>
            </div>
          </div>

          {/* Header Row 2: Filter Tabs, Live Search, & Sort Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '18px',
            flexWrap: 'wrap',
            gap: '10px',
            padding: '10px 14px',
            background: 'var(--bg-card-inner)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)'
          }}>
            {/* Quick Filter Perusahaan Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '2px' }}>
                Perusahaan:
              </span>
              <button
                type="button"
                onClick={() => setFilterCompanyTx('ALL')}
                style={{
                  background: filterCompanyTx === 'ALL' ? 'var(--primary, #0284c7)' : 'transparent',
                  color: filterCompanyTx === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                  border: filterCompanyTx === 'ALL' ? '1px solid var(--primary, #0284c7)' : '1px solid var(--border-subtle)',
                  padding: '3px 9px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.73rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Semua ({rawNodes.filter(n => n.is_active !== false).length})
              </button>
              {uniqueCompanies.map(comp => {
                const count = rawNodes.filter(n => n.is_active !== false && n.company_name === comp).length;
                const isSelected = filterCompanyTx === comp;
                return (
                  <button
                    key={comp}
                    type="button"
                    onClick={() => setFilterCompanyTx(comp)}
                    style={{
                      background: isSelected ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                      color: isSelected ? '#10b981' : 'var(--text-secondary)',
                      border: isSelected ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                      padding: '3px 9px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.73rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {comp} ({count})
                  </button>
                );
              })}
            </div>

            {/* Right Controls: Live Search & Sort */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Live Search Input */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '7px 10px'
              }}>
                <Search size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Cari database / host..."
                  value={searchTx}
                  onChange={(e) => setSearchTx(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.74rem',
                    color: 'var(--text-primary)',
                    width: '210px'
                  }}
                />
                {searchTx && (
                  <button
                    type="button"
                    onClick={() => setSearchTx('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.8rem', lineHeight: 1 }}
                    title="Hapus pencarian"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Sort Selector */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                background: 'var(--bg-card)',
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}>
                <ArrowUpDown size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Urutkan:
                </span>
                <select
                  value={nodeSortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none',
                    padding: '2px 0',
                    minWidth: '175px'
                  }}
                  title="Pilih standar pengurutan kartu aktivitas transaksi database"
                >
                  <option value="alphabetical" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Nama Database (A-Z)</option>
                  <option value="config" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Urutan Konfigurasi</option>
                  <option value="transactions" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Transaksi Terbanyak</option>
                </select>
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          {filteredAndSortedTxNodes.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '30px 16px',
              background: 'var(--bg-card-inner)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              fontSize: '0.82rem'
            }}>
              Tidak ada database node yang cocok dengan pencarian atau filter perusahaan saat ini.
              {(searchTx || filterCompanyTx !== 'ALL') && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem', padding: '3px 10px' }}
                    onClick={() => { setSearchTx(''); setFilterCompanyTx('ALL'); }}
                  >
                    Reset Filter & Pencarian
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {displayedTxNodes.map((cmp, i) => (
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
                      {/* Header Row 1: Full Company Name on Dedicated Single Line */}
                      <div style={{ marginBottom: '10px' }}>
                        <span
                          title={cmp.company_name}
                          style={{
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#10b981',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            letterSpacing: '0.02em',
                            border: '1px solid rgba(16, 185, 129, 0.28)',
                            display: 'inline-block',
                            wordBreak: 'break-word',
                            lineHeight: 1.35
                          }}
                        >
                          {cmp.company_name}
                        </span>
                      </div>

                      {/* Header Row 2: Database Name with Icon (Left) & Status Badges + Reload Actions (Right) */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '8px' }}>
                        <strong style={{ fontSize: '0.98rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                          <Database size={15} color="#0284c7" style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cmp.database_pusat || cmp.company_name}
                          </span>
                          {cmp.database_lokal && cmp.database_lokal !== cmp.database_pusat && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                              <span>➔</span>
                              <span>{cmp.database_lokal}</span>
                            </span>
                          )}
                        </strong>

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

              {/* Scalability Toggle: Expand / Collapse if > 6 nodes */}
              {filteredAndSortedTxNodes.length > 6 && (
                <div style={{ textAlign: 'center', marginTop: '16px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '14px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsExpandedTx(!isExpandedTx)}
                    style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px' }}
                  >
                    <span>
                      {isExpandedTx
                        ? 'Ciutkan Tampilan (Tampilkan 6 Node Teratas)'
                        : `Tampilkan Seluruh ${filteredAndSortedTxNodes.length} Database Node`}
                    </span>
                    {isExpandedTx ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Database Nodes Health Grid */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Status Kesehatan Node Database (Pusat & Lokal)
            </h3>
            {/* Global Health Indicator Strip (Mini KPI Pills) */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                {healthSummary.healthy} Normal
              </span>
              {healthSummary.degraded > 0 && (
                <span style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                  {healthSummary.degraded} Gangguan
                </span>
              )}
              {healthSummary.offline > 0 && (
                <span style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                  {healthSummary.offline} Terputus
                </span>
              )}
            </div>
          </div>

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

        {/* Toolbar: Company Filter, Live Search, & Sort */}
        {systemHealth?.nodes && systemHealth.nodes.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '10px',
            padding: '10px 14px',
            background: 'var(--bg-card-inner)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)'
          }}>
            {/* Quick Filter Perusahaan Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '2px' }}>
                Perusahaan:
              </span>
              <button
                type="button"
                onClick={() => setFilterCompanyHealth('ALL')}
                style={{
                  background: filterCompanyHealth === 'ALL' ? 'var(--primary, #0284c7)' : 'transparent',
                  color: filterCompanyHealth === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                  border: filterCompanyHealth === 'ALL' ? '1px solid var(--primary, #0284c7)' : '1px solid var(--border-subtle)',
                  padding: '3px 9px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.73rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Semua ({systemHealth.nodes.length})
              </button>
              {uniqueCompanies.map(comp => {
                const count = systemHealth.nodes.filter(n => n.company_name === comp).length;
                if (count === 0) return null;
                const isSelected = filterCompanyHealth === comp;
                return (
                  <button
                    key={comp}
                    type="button"
                    onClick={() => setFilterCompanyHealth(comp)}
                    style={{
                      background: isSelected ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                      color: isSelected ? '#10b981' : 'var(--text-secondary)',
                      border: isSelected ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                      padding: '3px 9px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.73rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {comp} ({count})
                  </button>
                );
              })}
            </div>

            {/* Right Controls: Live Search & Sort */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Search */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '7px 10px'
              }}>
                <Search size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Cari node / host / IP..."
                  value={searchHealth}
                  onChange={(e) => setSearchHealth(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.74rem',
                    color: 'var(--text-primary)',
                    width: '210px'
                  }}
                />
                {searchHealth && (
                  <button
                    type="button"
                    onClick={() => setSearchHealth('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.8rem', lineHeight: 1 }}
                    title="Hapus pencarian"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Sort Selector */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                background: 'var(--bg-card)',
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}>
                <ArrowUpDown size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Urutkan:
                </span>
                <select
                  value={healthSortBy}
                  onChange={(e) => handleHealthSortChange(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none',
                    padding: '2px 0',
                    minWidth: '240px'
                  }}
                  title="Pilih standar pengurutan kartu kesehatan database"
                >
                  <option value="critical" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Prioritas Masalah (Offline Teratas)</option>
                  <option value="latency" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Latency / Ping Tercepat</option>
                  <option value="alphabetical" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Nama Database (A-Z)</option>
                  <option value="config" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Urutan Konfigurasi</option>
                </select>
              </div>

              <span className="badge badge-neutral" style={{ fontSize: '0.74rem' }}>
                {filteredAndSortedHealthNodes.length} Node
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <SkeletonNodeHealthCards count={configs?.length || 3} />
        ) : systemHealth?.nodes && systemHealth.nodes.length > 0 ? (
          filteredAndSortedHealthNodes.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '30px 16px',
              background: 'var(--bg-card-inner)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              fontSize: '0.82rem'
            }}>
              Tidak ada node kesehatan yang cocok dengan pencarian atau filter perusahaan saat ini.
              {(searchHealth || filterCompanyHealth !== 'ALL') && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem', padding: '3px 10px' }}
                    onClick={() => { setSearchHealth(''); setFilterCompanyHealth('ALL'); }}
                  >
                    Reset Filter & Pencarian
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
                {displayedHealthNodes.map((node) => (
                  <NodeHealthCard key={node.id} node={node} />
                ))}
              </div>

              {/* Scalability Toggle: Expand / Collapse if > 6 nodes */}
              {filteredAndSortedHealthNodes.length > 6 && (
                <div style={{ textAlign: 'center', marginTop: '16px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '14px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsExpandedHealth(!isExpandedHealth)}
                    style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px' }}
                  >
                    <span>
                      {isExpandedHealth
                        ? 'Ciutkan Tampilan (Tampilkan 6 Node Teratas)'
                        : `Tampilkan Seluruh ${filteredAndSortedHealthNodes.length} Node Kesehatan`}
                    </span>
                    {isExpandedHealth ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              )}
            </>
          )
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
                    <span className={`badge ${log.level === 'SUCCESS' ? 'badge-success' :
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
