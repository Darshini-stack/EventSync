import React from 'react';

/**
 * Reusable Card component with glassmorphism, header, badge, content area, and action footer.
 */
export const Card = ({
  title,
  subtitle,
  badge,
  icon: Icon,
  actions,
  children,
  className = '',
  style = {},
  onClick,
}) => {
  return (
    <div
      className={`glass-panel card-container ${onClick ? 'clickable' : ''} ${className}`}
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      onClick={onClick}
    >
      {(title || Icon || badge) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {Icon && (
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={20} />
              </div>
            )}
            <div>
              {title && <h3 style={{ fontSize: '1.05rem', fontWeight: '600' }}>{title}</h3>}
              {subtitle && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{subtitle}</p>}
            </div>
          </div>
          {badge && <div>{badge}</div>}
        </div>
      )}

      {children && <div style={{ flex: 1 }}>{children}</div>}

      {actions && (
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
};
