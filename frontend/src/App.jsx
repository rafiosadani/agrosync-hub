import React, { useState, useEffect } from 'react';
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
  const [currentTab, setCurrentTab] = useState('overview');
  const [systemHealth, setSystemHealth] = useState(null);
  const [metricsSummary, setMetricsSummary] = useState(null);
  const [companyMetrics, setCompanyMetrics] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    }
  };

  useEffect(() => {
    fetchDashboardData(true);
    // Auto polling dashboard state every 10s (menggunakan cached health ping)
    const interval = setInterval(() => fetchDashboardData(false), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerSync = async () => {
    try {
      toast.info('Sinkronisasi Dipicu', 'Memulai siklus sinkronisasi data DML on-demand...');
      await api.triggerSync();
      toast.success('Sinkronisasi Berjalan', 'Engine sinkronisasi sedang memproses tabel.');
      setTimeout(() => fetchDashboardData(true), 500);
    } catch (err) {
      toast.error('Gagal Memicu Sinkronisasi', err.message);
    }
  };

  return (
    <div className="app-container">
      {/* Fixed Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        systemHealth={systemHealth}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <Navbar
          syncStatus={syncStatus}
          systemHealth={systemHealth}
          onTriggerSync={handleTriggerSync}
          onRefreshAll={() => fetchDashboardData(true)}
          isRefreshing={isRefreshing}
          onNavigateToMigration={() => setCurrentTab('migration')}
        />

        <main className="content-body">
          {currentTab === 'overview' && (
            <Overview
              systemHealth={systemHealth}
              metricsSummary={metricsSummary}
              companyMetrics={companyMetrics}
              recentLogs={recentLogs}
              onNavigateToNodes={() => setCurrentTab('nodes')}
              onNavigateToLogs={() => setCurrentTab('logs')}
              onRefreshMetrics={fetchDashboardData}
            />
          )}

          {currentTab === 'nodes' && (
            <NodeManager
              configs={configs}
              onRefreshConfigs={fetchDashboardData}
            />
          )}

          {currentTab === 'logs' && (
            <LiveLogs />
          )}

          {currentTab === 'migration' && (
            <SchemaMigration />
          )}

          {currentTab === 'network' && (
            <NetworkGuide />
          )}
        </main>
      </div>
    </div>
  );
}
