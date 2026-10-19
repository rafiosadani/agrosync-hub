import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { AlertTriangle, AlertCircle, Info, HelpCircle } from 'lucide-react';

const ConfirmContext = createContext(null);

export function ConfirmDialogProvider({ children }) {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Lanjutkan',
    cancelText: 'Batal',
    variant: 'danger', // 'danger' | 'primary' | 'warning'
  });

  const resolverRef = useRef(null);

  const confirm = useCallback(({
    title = 'Konfirmasi Tindakan',
    description = '',
    confirmText = 'Lanjutkan',
    cancelText = 'Batal',
    variant = 'danger'
  }) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialogState({
        isOpen: true,
        title,
        description,
        confirmText,
        cancelText,
        variant
      });
    });
  }, []);

  const handleClose = () => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  const handleConfirm = () => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  const isDanger = dialogState.variant === 'danger';
  const isWarning = dialogState.variant === 'warning';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {dialogState.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              padding: '24px',
              animation: 'scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              color: 'var(--text-primary)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: isDanger 
                    ? 'rgba(244, 63, 94, 0.12)' 
                    : isWarning 
                      ? 'rgba(245, 158, 11, 0.12)' 
                      : 'rgba(16, 185, 129, 0.12)',
                  border: isDanger 
                    ? '1px solid rgba(244, 63, 94, 0.25)' 
                    : isWarning 
                      ? '1px solid rgba(245, 158, 11, 0.25)' 
                      : '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {isDanger ? (
                  <AlertTriangle size={18} color="#fb7185" />
                ) : isWarning ? (
                  <AlertCircle size={18} color="#fbbf24" />
                ) : (
                  <HelpCircle size={18} color="#34d399" />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  {dialogState.title}
                </h3>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                  {dialogState.description}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  background: '#27272a',
                  color: '#e4e4e7',
                  border: '1px solid #3f3f46',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '0.86rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#3f3f46'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#27272a'; }}
              >
                {dialogState.cancelText}
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  background: isDanger 
                    ? '#e11d48' 
                    : isWarning 
                      ? '#d97706' 
                      : '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: isDanger 
                    ? '0 2px 10px rgba(225, 29, 72, 0.3)' 
                    : '0 2px 10px rgba(16, 185, 129, 0.3)',
                  transition: 'filter 0.15s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
                onMouseOut={(e) => { e.currentTarget.style.filter = 'none'; }}
              >
                {dialogState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider');
  }
  return context;
}
