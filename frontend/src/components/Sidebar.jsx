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
import logoEmblem from '../assets/logo-emblem.png';

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
    { id: 'network', path: '/network', label: 'Panduan & Jaringan', icon: Network, badge: null },
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
      <div 
        className="brand" 
        style={{ 
          padding: isCollapsed ? '16px 8px' : '16px 16px', 
          justifyContent: isCollapsed ? 'center' : 'space-between',
          minHeight: '68px'
        }}
      >
        <div 
          className="brand-left" 
          style={{ 
            justifyContent: isCollapsed ? 'center' : 'flex-start', 
            width: isCollapsed ? '100%' : 'auto',
            gap: '11px',
            alignItems: 'center'
          }}
        >
          {/* Logo Emblem (Both Collapsed & Expanded) */}
          <div 
            className="brand-emblem-wrap" 
            title={isCollapsed ? "Klik untuk memperluas sidebar" : "AgroFarm - AgroSync Hub"}
            onClick={isCollapsed ? onToggleCollapse : undefined}
            style={{ 
              cursor: isCollapsed ? 'pointer' : 'default',
              width: isCollapsed ? '38px' : '36px',
              height: isCollapsed ? '38px' : '36px',
              borderRadius: '50%',
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(234, 179, 8, 0.35)',
              background: '#09090b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.18s ease, box-shadow 0.18s ease'
            }}
          >
            <img 
              src={logoEmblem} 
              alt="AgroFarm Emblem" 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'contain',
                display: 'block' 
              }} 
            />
          </div>

          {!isCollapsed && (
            <div className="brand-text" style={{ minWidth: 0 }}>
              <h1 style={{ 
                fontSize: '1rem', 
                fontWeight: 800, 
                letterSpacing: '-0.02em', 
                lineHeight: 1.2,
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                margin: 0
              }}>
                <span style={{ color: '#10b981' }}>Agro</span>
                <span style={{ color: 'var(--text-primary)' }}>Sync Hub</span>
              </h1>
              <p style={{ 
                fontSize: '0.66rem', 
                color: 'var(--text-muted)', 
                letterSpacing: '0.04em', 
                textTransform: 'uppercase', 
                fontWeight: 700,
                margin: '2px 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span>AGROFARM</span>
                <span style={{ opacity: 0.4 }}>•</span>
                <span>v1.0</span>
              </p>
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
