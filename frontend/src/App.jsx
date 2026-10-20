import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Overview from './pages/Overview';
import NodeManager from './pages/NodeManager';
import LiveLogs from './pages/LiveLogs';
import SchemaMigration from './pages/SchemaMigration';
import NetworkGuide from './pages/NetworkGuide';
import { api } from './api';

import { useToast } from './components/Toast';

export default function App() {
  const toast = useToast();
  const navigate = useNavigate();
  const [systemHealth, setSystemHealth] = useState(null);
  const [metricsSummary, setMetricsSummary] = useState(null);
  const [companyMetrics, setCompanyMetrics] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('agrosync_sidebar_collapsed') === 'true';
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('agrosync_sidebar_collapsed', String(next));
      return next;
    });
  };

  const fetchDashboardData = async (forceHealth = false) => {
    setIsRefreshing(true);
    try {
      const [health, metrics, companies, cfgs, logs, status] = await Promise.all([
        api.getHealth(forceHealth).catch(() => null),
        api.getMetricsSummary().catch(() => null),
        api.getMetricsByCompany().catch(() => []),
        api.getConfigs().catch(() => []),
        api.getLogs({ limit: 10 }).catch(() => []),
        api.getSyncStatus().catch(() => null)
      ]);

      if (health) setSystemHealth(health);
      if (metrics) setMetricsSummary(metrics);
      if (companies) setCompanyMetrics(companies);
      if (cfgs) setConfigs(cfgs);
      if (logs) setRecentLogs(logs);
      if (status) setSyncStatus(status);
    } catch (err) {
      console.error("Gagal memuat data dashboard:", err);
    } finally {
      setIsRefreshing(false);
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(true);
    // Polling interval adaptif: jika RUNNING atau SYNCING polling tiap 3s, jika IDLE/STOPPED tiap 10s
    const isEngineActive = syncStatus?.state === 'RUNNING' || syncStatus?.state === 'SYNCING' || syncStatus?.is_loop_running;
    const intervalTime = isEngineActive ? 3000 : 10000;
    const interval = setInterval(() => fetchDashboardData(false), intervalTime);
    return () => clearInterval(interval);
  }, [syncStatus?.state, syncStatus?.is_loop_running]);

  const handleTriggerSync = async () => {
    try {
      const res = await api.triggerSync();
      if (res && res.success === false) {
        toast.warning('Sinkronisasi Ditolak', res.message || 'Tidak dapat memulai sinkronisasi on-demand saat ini.');
        return;
      }

      toast.info('Sinkronisasi Dipicu', res?.message || 'Memulai 1 siklus sinkronisasi data DML on-demand...');
      setSyncStatus(prev => ({
        ...prev,
        state: 'SYNCING',
        is_syncing_once: true,
        is_active_syncing: true
      }));

      // Polling cepat setiap 1.5 detik selama on-demand sync berlangsung
      const pollTimer = setInterval(async () => {
        try {
          const status = await api.getSyncStatus();
          if (status) {
            setSyncStatus(status);
            if (status.state !== 'SYNCING' && !status.is_syncing_once && !status.is_active_syncing) {
              clearInterval(pollTimer);
              toast.success('Sinkronisasi Selesai', 'Siklus sinkronisasi 1 kali jalan telah rampung.');
              fetchDashboardData(true);
            }
          }
        } catch (e) {
          clearInterval(pollTimer);
        }
      }, 1500);

      setTimeout(() => clearInterval(pollTimer), 60000);
    } catch (err) {
      toast.error('Gagal Memicu Sinkronisasi', err.message);
    }
  };

  return (
    <div className="app-container">
      {/* Collapsible Left Sidebar */}
      <Sidebar
        systemHealth={systemHealth}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main Content Area */}
      <div className={`main-content ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Navbar
          syncStatus={syncStatus}
          setSyncStatus={setSyncStatus}
          systemHealth={systemHealth}
          onTriggerSync={handleTriggerSync}
          onRefreshAll={() => fetchDashboardData(true)}
          isRefreshing={isRefreshing}
          onNavigateToMigration={() => navigate('/migration')}
          onNavigateToNodes={() => navigate('/nodes')}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
        />

        <main className="content-body">
          <Routes>
            <Route
              path="/"
              element={
                <Overview
                  systemHealth={systemHealth}
                  metricsSummary={metricsSummary}
                  companyMetrics={companyMetrics}
                  configs={configs}
                  recentLogs={recentLogs}
                  syncStatus={syncStatus}
                  isLoading={isInitialLoading}
                  onNavigateToNodes={() => navigate('/nodes')}
                  onNavigateToLogs={() => navigate('/logs')}
                  onRefreshMetrics={fetchDashboardData}
                />
              }
            />
            <Route path="/overview" element={<Navigate to="/" replace />} />
            <Route
              path="/nodes"
              element={
                <NodeManager
                  configs={configs}
                  onRefreshConfigs={fetchDashboardData}
                />
              }
            />
            <Route
              path="/logs"
              element={<LiveLogs configs={configs} />}
            />
            <Route
              path="/migration"
              element={<SchemaMigration />}
            />
            <Route
              path="/network"
              element={<NetworkGuide />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
