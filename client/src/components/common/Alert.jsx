import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Reusable Alert banner for success, warning, error, and info notification states.
 */
export const Alert = ({
  variant = 'info', // 'success' | 'warning' | 'error' | 'info'
  title,
  children,
  onDismiss,
  className = '',
}) => {
  const configs = {
    success: {
      icon: CheckCircle2,
      bg: 'rgba(16, 185, 129, 0.1)',
      border: 'rgba(16, 185, 129, 0.25)',
      color: '#34D399',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.25)',
      color: '#FBBF24',
    },
    error: {
      icon: AlertCircle,
      bg: 'rgba(239, 68, 68, 0.1)',
      border: 'rgba(239, 68, 68, 0.25)',
      color: '#F87171',
    },
    info: {
      icon: Info,
      bg: 'rgba(99, 102, 241, 0.1)',
      border: 'rgba(99, 102, 241, 0.25)',
      color: '#A5B4FC',
    },
  };

  const cfg = configs[variant] || configs.info;
  const Icon = cfg.icon;

  return (
    <div
      className={`alert-banner ${className}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.85rem',
        padding: '1rem 1.25rem',
        borderRadius: 'var(--radius-md)',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: 'var(--text-primary)',
        position: 'relative',
      }}
    >
      <div style={{ color: cfg.color, marginTop: '2px', flexShrink: 0 }}>
        <Icon size={18} />
      </div>

      <div style={{ flex: 1, fontSize: '0.88rem' }}>
        {title && <div style={{ fontWeight: '600', marginBottom: '0.2rem', color: cfg.color }}>{title}</div>}
        <div style={{ color: 'var(--text-secondary)' }}>{children}</div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{ color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}
          aria-label="Dismiss alert"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
};
