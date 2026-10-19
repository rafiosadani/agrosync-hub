import React from 'react';

/**
 * Base Skeleton element with shimmer gradient
 */
export function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = 'var(--radius-sm)',
  variant = 'text',
  style = {},
  className = ''
}) {
  const getRadius = () => {
    if (variant === 'circular') return '50%';
    if (variant === 'rounded') return 'var(--radius-md)';
    return borderRadius;
  };

  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius: getRadius(),
        ...style
      }}
    />
  );
}

/**
 * Skeleton placeholder for 4 Global DML Metric Cards
 */
export function SkeletonMetricCards() {
  return (
    <div className="metrics-grid">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="metric-card skeleton-box" style={{ gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Skeleton width="110px" height="14px" />
            <Skeleton width="28px" height="28px" variant="rounded" />
          </div>
          <div style={{ margin: '6px 0' }}>
            <Skeleton width="120px" height="32px" borderRadius="var(--radius-sm)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
            <Skeleton width="140px" height="12px" />
            <Skeleton width="50px" height="16px" borderRadius="var(--radius-sm)" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton placeholder for Node Health Cards
 */
export function SkeletonNodeHealthCards({ count = 3 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-box" style={{ gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Skeleton width="50px" height="20px" borderRadius="var(--radius-sm)" />
              <Skeleton width="100px" height="18px" />
            </div>
            <Skeleton width="70px" height="20px" borderRadius="var(--radius-sm)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Skeleton width="130px" height="14px" />
              <Skeleton width="60px" height="14px" />
            </div>
            <Skeleton width="100%" height="6px" borderRadius="999px" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Skeleton width="130px" height="14px" />
              <Skeleton width="60px" height="14px" />
            </div>
            <Skeleton width="100%" height="6px" borderRadius="999px" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
            <Skeleton width="120px" height="12px" />
            <Skeleton width="90px" height="12px" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton placeholder for Recent Activity Log list
 */
export function SkeletonActivityLog({ count = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--bg-card-inner)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-card, var(--shadow-sm))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <Skeleton width="65px" height="20px" borderRadius="var(--radius-sm)" />
            <Skeleton width="45px" height="16px" borderRadius="var(--radius-sm)" />
            <Skeleton width="55%" height="14px" />
          </div>
          <Skeleton width="120px" height="12px" style={{ marginLeft: '16px' }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton placeholder for Per-Node DML breakdown
 */
export function SkeletonNodeBreakdown({ count = 2 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-box" style={{ gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Skeleton width="45px" height="20px" />
              <Skeleton width="120px" height="18px" />
            </div>
            <Skeleton width="80px" height="20px" />
          </div>
          <Skeleton width="100%" height="24px" borderRadius="var(--radius-sm)" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <Skeleton width="100%" height="45px" borderRadius="var(--radius-sm)" />
            <Skeleton width="100%" height="45px" borderRadius="var(--radius-sm)" />
            <Skeleton width="100%" height="45px" borderRadius="var(--radius-sm)" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px' }}>
            <Skeleton width="90px" height="12px" />
            <Skeleton width="110px" height="12px" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
