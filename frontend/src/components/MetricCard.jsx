import React from 'react';

export default function MetricCard({ title, value, subtitle, icon: Icon, accentColor = '#10b981', trend }) {
  return (
    <div className="metric-card" style={{ '--card-accent': accentColor }}>
      <div className="metric-header">
        <span className="metric-title">{title}</span>
        <div className="metric-icon-box" style={{ color: accentColor }}>
          <Icon size={20} />
        </div>
      </div>
      <div className="metric-value">{value?.toLocaleString() || 0}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="metric-sub">{subtitle}</div>
        {trend && (
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: accentColor }}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
