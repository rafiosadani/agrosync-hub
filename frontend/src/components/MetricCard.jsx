import React from 'react';

export default function MetricCard({ title, value, subtitle, icon: Icon, accentColor = '#10b981', trend }) {
  return (
    <div className="metric-card" style={{ '--card-accent': accentColor }}>
      <div className="metric-header">
        <span className="metric-title">{title}</span>
        <div className="metric-icon-box" style={{ color: accentColor }}>
          <Icon size={18} />
        </div>
      </div>
      <div className="metric-value">{value?.toLocaleString() || 0}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
        <div 
          className="metric-sub" 
          title={subtitle}
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
        >
          {subtitle}
        </div>
        {trend && (
          <span 
            style={{ 
              fontSize: '0.74rem', 
              fontWeight: 600, 
              color: accentColor, 
              whiteSpace: 'nowrap', 
              flexShrink: 0 
            }}
          >
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
