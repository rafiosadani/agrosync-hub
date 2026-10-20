import React from 'react';
import { 
  Activity, 
  Database, 
  Terminal, 
  Layers, 
  Network, 
  RefreshCw, 
  PanelLeftClose, 
  PanelLeftOpen 
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Sidebar({ 
  systemHealth,
  isCollapsed,
  onToggleCollapse
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { id: 'overview', path: '/', label: 'Overview Monitoring', icon: Activity, badge: null },
    { id: 'nodes', path: '/nodes', label: 'Config & Nodes', icon: Database, badge: systemHealth?.total_nodes ? `${systemHealth.total_nodes}` : null },
    { id: 'logs', path: '/logs', label: 'Live Activity Logs', icon: Terminal, badge: null },
    { id: 'migration', path: '/migration', label: 'Smart DDL Migration', icon: Layers, badge: '330' },
    { id: 'network', path: '/network', label: 'Multi-Device LAN', icon: Network, badge: null },
  ];

  const isItemActive = (item) => {
    if (item.path === '/') {
      return location.pathname === '/' || location.pathname === '/overview';
    }
    return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Brand Header */}
      <div className="brand" style={{ padding: isCollapsed ? '16px 12px' : '16px 18px', justifyContent: isCollapsed ? 'center' : 'space-between' }}>
        <div className="brand-left" style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', width: isCollapsed ? '100%' : 'auto' }}>
          <div 
            className="brand-icon" 
            title={isCollapsed ? "Klik untuk membuka sidebar" : "AgroSync Hub v1.0"}
            onClick={isCollapsed ? onToggleCollapse : undefined}
            style={{ cursor: isCollapsed ? 'pointer' : 'default' }}
          >
            <RefreshCw size={18} />
          </div>
          {!isCollapsed && (
            <div className="brand-text">
              <h1>AgroSync Hub</h1>
              <p>Enterprise Sync v1.0</p>
            </div>
          )}
        </div>

        {/* Toggle Minimize Button (Hanya di dalam sidebar saat posisi expanded) */}
        {!isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="brand-toggle-btn"
            title="Kecilkan Sidebar (Minimize)"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* Nav Menu */}
      <ul className="nav-menu" style={{ padding: isCollapsed ? '16px 8px' : '16px 12px' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isItemActive(item);
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`nav-item-btn ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
                title={item.label}
              >
                <Icon size={17} style={{ flexShrink: 0 }} />
                {!isCollapsed && (
                  <span className="nav-label">
                    {item.label}
                  </span>
                )}
                {!isCollapsed && item.badge !== null && (
                  <span className={`badge ${isActive ? 'badge-active' : 'badge-neutral'} nav-badge`}>
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* System Health Card Footer */}
      <div style={{ padding: isCollapsed ? '12px' : '16px', borderTop: '1px solid var(--border-subtle)' }}>
        {isCollapsed ? (
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '10px 0',
              cursor: 'pointer'
            }}
            title={`System Health: ${systemHealth?.status || 'CHECKING'} (${systemHealth?.healthy_nodes || 0}/${systemHealth?.total_nodes || 0} Nodes Online)`}
          >
            <span className={`pulse-dot ${systemHealth?.status === 'HEALTHY' ? 'pulse-dot-green' : 'pulse-dot-yellow'}`} />
          </div>
        ) : (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                System Health
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={`pulse-dot ${systemHealth?.status === 'HEALTHY' ? 'pulse-dot-green' : 'pulse-dot-yellow'}`} />
                <span style={{ 
                  fontSize: '0.73rem', 
                  fontWeight: 700, 
                  color: systemHealth?.status === 'HEALTHY' ? '#10b981' : '#f59e0b' 
                }}>
                  {systemHealth?.status || 'CHECKING'}
                </span>
              </div>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              Nodes: <strong style={{ color: 'var(--text-primary)' }}>{systemHealth?.healthy_nodes || 0}</strong> / {systemHealth?.total_nodes || 0} Online
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
