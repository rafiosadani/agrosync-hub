// Dynamic API Base URL: works seamlessly on localhost and across LAN/Wi-Fi devices
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // If accessing from another device via LAN IP (e.g. 192.168.1.50), connect to port 8000 on that same IP
    return `http://${hostname}:8000`;
  }
  return 'http://localhost:8000';
};

export const API_BASE = getApiBaseUrl();

export const api = {
  // System Health
  async getHealth(force = false) {
    const res = await fetch(`${API_BASE}/api/health${force ? '?force=true' : ''}`);
    if (!res.ok) throw new Error('Gagal mengambil status kesehatan sistem');
    return res.json();
  },

  // Node Configurations
  async getConfigs() {
    const res = await fetch(`${API_BASE}/api/configs`);
    if (!res.ok) throw new Error('Gagal mengambil daftar node database');
    return res.json();
  },

  async createConfig(nodeData) {
    const res = await fetch(`${API_BASE}/api/configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nodeData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Gagal menambahkan node baru');
    }
    return res.json();
  },

  async updateConfig(nodeId, nodeData) {
    const res = await fetch(`${API_BASE}/api/configs/${nodeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nodeData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Gagal memperbarui node');
    }
    return res.json();
  },

  async deleteConfig(nodeId) {
    const res = await fetch(`${API_BASE}/api/configs/${nodeId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Gagal menghapus node');
    return res.json();
  },

  async testConnection(server, database, user, password, nodeId = null, role = 'pusat') {
    const res = await fetch(`${API_BASE}/api/configs/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        server, 
        database, 
        user, 
        password,
        node_id: nodeId,
        role: role
      })
    });
    if (!res.ok) throw new Error('Pengujian koneksi gagal dijalankan');
    return res.json();
  },

  async createDatabase(server, database, user, password) {
    const res = await fetch(`${API_BASE}/api/configs/create-database`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server, database, user, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Gagal membuat database di SQL Server');
    }
    return res.json();
  },

  // Sync Control
  async getSyncStatus() {
    const res = await fetch(`${API_BASE}/api/sync/status`);
    if (!res.ok) throw new Error('Gagal mengambil status sync');
    return res.json();
  },

  async startSync() {
    const res = await fetch(`${API_BASE}/api/sync/start`, { method: 'POST' });
    return res.json();
  },

  async pauseSync() {
    const res = await fetch(`${API_BASE}/api/sync/pause`, { method: 'POST' });
    return res.json();
  },

  async resumeSync() {
    const res = await fetch(`${API_BASE}/api/sync/resume`, { method: 'POST' });
    return res.json();
  },

  async stopSync() {
    const res = await fetch(`${API_BASE}/api/sync/stop`, { method: 'POST' });
    return res.json();
  },

  async triggerSync() {
    const res = await fetch(`${API_BASE}/api/sync/trigger`, { method: 'POST' });
    return res.json();
  },

  // Metrics
  async getMetricsSummary() {
    const res = await fetch(`${API_BASE}/api/metrics/summary`);
    return res.json();
  },

  async getMetricsByCompany() {
    const res = await fetch(`${API_BASE}/api/metrics/by-company`);
    return res.json();
  },

  async resetNodeMetrics(nodeKey) {
    const res = await fetch(`${API_BASE}/api/metrics/node/reset?node_key=${encodeURIComponent(nodeKey)}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Gagal mereset metrik node');
    return res.json();
  },

  async deleteNodeMetrics(nodeKey) {
    const res = await fetch(`${API_BASE}/api/metrics/node?node_key=${encodeURIComponent(nodeKey)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Gagal menghapus riwayat metrik node');
    return res.json();
  },

  // Activity Logs
  async getLogs(params = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.append('limit', params.limit);
    if (params.company) query.append('company', params.company);
    if (params.level) query.append('level', params.level);
    if (params.search) query.append('search', params.search);

    const res = await fetch(`${API_BASE}/api/logs?${query.toString()}`);
    if (!res.ok) throw new Error('Gagal mengambil log aktivitas');
    return res.json();
  },

  async clearLogs() {
    const res = await fetch(`${API_BASE}/api/logs`, { method: 'DELETE' });
    return res.json();
  },

  // Migration
  async getAuditSummary() {
    const res = await fetch(`${API_BASE}/api/migration/audit-summary`);
    return res.json();
  },

  async runMigration() {
    const res = await fetch(`${API_BASE}/api/migration/run`, { method: 'POST' });
    if (!res.ok) throw new Error('Migrasi gagal dijalankan');
    return res.json();
  },

  // Network Discovery & Subnet Scanner
  async getNetworkInfo() {
    const res = await fetch(`${API_BASE}/api/health/network-info`);
    if (!res.ok) throw new Error('Gagal mengambil info jaringan lokal');
    return res.json();
  },

  async scanSubnet(params = {}) {
    const res = await fetch(`${API_BASE}/api/health/scan-subnet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Gagal memindai subnet jaringan');
    return res.json();
  },

  async updateNodeAddress(data) {
    const res = await fetch(`${API_BASE}/api/health/update-node-address`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Gagal memperbarui alamat node');
    }
    return res.json();
  }
};
