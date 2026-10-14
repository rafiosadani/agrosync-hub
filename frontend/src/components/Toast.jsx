import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, message, description = '') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, description }]);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, desc) => addToast('success', msg, desc),
    error: (msg, desc) => addToast('error', msg, desc),
    warning: (msg, desc) => addToast('warning', msg, desc),
    info: (msg, desc) => addToast('info', msg, desc),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Viewport (Bottom Right) */}
      <div 
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '420px',
          width: 'calc(100vw - 48px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';

          const iconColor = isSuccess 
            ? '#10b981' 
            : isError 
              ? '#f43f5e' 
              : isWarning 
                ? '#f59e0b' 
                : '#38bdf8';

          const borderColor = isSuccess 
            ? 'rgba(16, 185, 129, 0.3)' 
            : isError 
              ? 'rgba(244, 63, 94, 0.3)' 
              : isWarning 
                ? 'rgba(245, 158, 11, 0.3)' 
                : 'rgba(56, 189, 248, 0.3)';

          const IconComponent = isSuccess 
            ? CheckCircle2 
            : isError 
              ? XCircle 
              : isWarning 
                ? AlertTriangle 
                : Info;

          return (
            <div
              key={t.id}
              style={{
                pointerEvents: 'auto',
                background: 'var(--bg-card)',
                border: `1px solid ${borderColor}`,
                borderRadius: '8px',
                padding: '12px 14px',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                animation: 'toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                color: 'var(--text-primary)',
              }}
            >
              <IconComponent size={18} color={iconColor} style={{ marginTop: '2px', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.4' }}>
                  {t.message}
                </div>
                {t.description && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: '1.4' }}>
                    {t.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#71717a',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px',
                  transition: 'color 0.15s ease',
                  flexShrink: 0
                }}
                onMouseOver={(e) => { e.currentTarget.style.color = '#e4e4e7'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = '#71717a'; }}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
