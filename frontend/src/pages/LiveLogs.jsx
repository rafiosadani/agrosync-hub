import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  Table, 
  Trash2, 
  Filter, 
  Search, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  XCircle,
  Play,
  Pause
} from 'lucide-react';
import { api } from '../api';

export default function LiveLogs() {
  const [logs, setLogs] = useState([]);
  const [viewMode, setViewMode] = useState('terminal'); // 'terminal' | 'table'
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    try {
      const data = await api.getLogs({
        limit: 200,
        company: selectedCompany || undefined,
        level: selectedLevel || undefined,
        search: searchQuery || undefined
      });
      setLogs(data);
    } catch (err) {
      console.error("Gagal memuat logs:", err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedCompany, selectedLevel, searchQuery]);

  // Polling auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchLogs();
    }, 2500);
    return () => clearInterval(timer);
  }, [autoRefresh, selectedCompany, selectedLevel, searchQuery]);

  const handleClear = async () => {
    if (confirm("Apakah Anda yakin ingin mengosongkan riwayat log aktivitas?")) {
      await api.clearLogs();
      fetchLogs();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Live Activity & Transaction Viewer
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
            Pemantauan langsung siklus sinkronisasi data DML tingkat baris dan tabel enterprise secara real-time.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Toggle View Mode */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '3px',
            display: 'flex',
            gap: '4px'
          }}>
            <button
              className={`btn btn-sm ${viewMode === 'terminal' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', padding: '6px 12px' }}
              onClick={() => setViewMode('terminal')}
            >
              <Terminal size={14} />
              <span>Terminal</span>
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', padding: '6px 12px' }}
              onClick={() => setViewMode('table')}
            >
              <Table size={14} />
              <span>Table</span>
            </button>
          </div>

          {/* Toggle Auto Refresh */}
          <button
            className={`btn btn-sm ${autoRefresh ? 'btn-secondary' : 'btn-warning'}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <>
                <span className="pulse-dot pulse-dot-green" />
                <span>Live Polling (2.5s)</span>
              </>
            ) : (
              <>
                <Pause size={13} />
                <span>Paused</span>
              </>
            )}
          </button>

          <button className="btn btn-secondary btn-sm" onClick={fetchLogs} title="Refresh Log Manual">
            <RefreshCw size={13} />
          </button>

          <button className="btn btn-danger btn-sm" onClick={handleClear} title="Bersihkan Buffer Log">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={15} color="var(--text-muted)" />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter:</span>
        </div>

        {/* Company filter */}
        <select
          className="form-input"
          style={{ width: 'auto', padding: '6px 12px', fontSize: '0.84rem' }}
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
        >
          <option value="">Semua Perusahaan</option>
          <option value="API">API</option>
          <option value="ANR">ANR</option>
          <option value="TTM">TTM</option>
        </select>

        {/* Level filter */}
        <select
          className="form-input"
          style={{ width: 'auto', padding: '6px 12px', fontSize: '0.84rem' }}
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
        >
          <option value="">Semua Level</option>
          <option value="SUCCESS">SUCCESS (Perubahan DML)</option>
          <option value="INFO">INFO (Siklus Berjalan)</option>
          <option value="WARNING">WARNING</option>
          <option value="ERROR">ERROR</option>
        </select>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '32px', padding: '6px 12px 6px 32px', fontSize: '0.84rem' }}
            placeholder="Cari nama tabel atau kata kunci log..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Menampilkan <strong>{logs.length}</strong> event
        </span>
      </div>

      {/* Main View: Terminal vs Table */}
      {viewMode === 'terminal' ? (
        <div className="terminal-window">
          <div className="terminal-header">
            <div className="terminal-dots">
              <span className="terminal-dot terminal-dot-red" />
              <span className="terminal-dot terminal-dot-yellow" />
              <span className="terminal-dot terminal-dot-green" />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              agrosync-dml-stream.log • Terminal Output
            </span>
            <span style={{ fontSize: '0.72rem', color: '#10b981' }}>STREAMING</span>
          </div>

          <div className="terminal-body">
            {logs.length > 0 ? (
              logs.map((log) => {
                let color = '#94a3b8';
                if (log.level === 'SUCCESS') color = '#34d399';
                if (log.level === 'ERROR') color = '#fb7185';
                if (log.level === 'WARNING') color = '#fbbf24';
                if (log.level === 'INFO') color = '#38bdf8';

                return (
                  <div key={log.id} className="terminal-line" style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ color: '#475569', userSelect: 'none' }}>[{log.timestamp}]</span>
                    <span style={{ color: color, fontWeight: 700, width: '70px' }}>[{log.level}]</span>
                    {log.company_name && (
                      <span style={{ color: '#a7f3d0', fontWeight: 600 }}>[{log.company_name}]</span>
                    )}
                    <span style={{ color: '#f1f5f9', flex: 1 }}>{log.message}</span>
                  </div>
                );
              })
            ) : (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '30px' }}>
                -- Tidak ada log yang cocok dengan kriteria pencarian --
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Timestamp</th>
                  <th style={{ width: '100px' }}>Level</th>
                  <th style={{ width: '90px' }}>Perusahaan</th>
                  <th>Pesan / Aktivitas</th>
                  <th style={{ width: '220px', textAlign: 'right' }}>Rincian DML</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {log.timestamp}
                      </td>
                      <td>
                        <span className={`badge ${
                          log.level === 'SUCCESS' ? 'badge-success' :
                          log.level === 'ERROR' ? 'badge-danger' :
                          log.level === 'WARNING' ? 'badge-warning' : 'badge-info'
                        }`} style={{ fontSize: '0.7rem' }}>
                          {log.level}
                        </span>
                      </td>
                      <td>
                        {log.company_name ? (
                          <strong style={{ color: '#34d399' }}>{log.company_name}</strong>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>GLOBAL</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-primary)' }}>
                        {log.message}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {(log.inserts > 0 || log.updates > 0 || log.deletes > 0) ? (
                          <div style={{ display: 'inline-flex', gap: '6px', fontSize: '0.74rem' }}>
                            <span style={{ color: '#34d399', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                              +{log.inserts} Ins
                            </span>
                            <span style={{ color: '#38bdf8', background: 'rgba(6, 182, 212, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                              ~{log.updates} Upd
                            </span>
                            <span style={{ color: '#fb7185', background: 'rgba(244, 63, 94, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                              -{log.deletes} Del
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      Tidak ada log tercatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
