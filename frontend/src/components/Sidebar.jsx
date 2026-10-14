import React from 'react';
import { 
  Activity, 
  Database, 
  Terminal, 
  Layers, 
  Network, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

export default function Sidebar({ currentTab, setCurrentTab, systemHealth }) {
  const navItems = [
    { id: 'overview', label: 'Overview Monitoring', icon: Activity, badge: null },
    { id: 'nodes', label: 'Config & Node Manager', icon: Database, badge: systemHealth?.total_nodes || 0 },
    { id: 'logs', label: 'Live Activity Logs', icon: Terminal, badge: null },
    { id: 'migration', label: 'Smart DDL Migration', icon: Layers, badge: '330+ Tables' },
    { id: 'network', label: 'Multi-Device Guide', icon: Network, badge: 'LAN' },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <RefreshCw size={24} />
        </div>
        <div className="brand-text">
          <h1>AgroSync Hub</h1>
          <p>Enterprise Sync v1.0</p>
        </div>
      </div>

      <ul className="nav-menu">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <li key={item.id}>
              <button
                className={`nav-item-btn ${isActive ? 'active' : ''}`}
                onClick={() => setCurrentTab(item.id)}
              >
                <Icon size={18} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge !== null && (
                  <span className={`badge ${isActive ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* System Health Card Footer */}
      <div style={{ padding: '20px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              System Health
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`pulse-dot ${systemHealth?.status === 'HEALTHY' ? 'pulse-dot-green' : 'pulse-dot-yellow'}`} />
              <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                color: systemHealth?.status === 'HEALTHY' ? '#34d399' : '#fbbf24' 
              }}>
                {systemHealth?.status || 'CHECKING'}
              </span>
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Nodes: <strong style={{ color: 'var(--text-primary)' }}>{systemHealth?.healthy_nodes || 0}</strong> / {systemHealth?.total_nodes || 0} Online
          </div>
        </div>
      </div>
    </aside>
  );
}
