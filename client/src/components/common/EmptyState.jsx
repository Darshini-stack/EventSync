import React from 'react';
import { CalendarX } from 'lucide-react';

/**
 * Reusable Empty State component for lists, search results, or uninitialized entities.
 */
export const EmptyState = ({
  icon: Icon = CalendarX,
  title = 'No items found',
  description = 'There are currently no items available to display.',
  action,
  className = '',
}) => {
  return (
    <div
      className={`glass-panel ${className}`}
      style={{
        padding: '3rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        border: '1px dashed var(--border-subtle)',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          marginBottom: '1rem',
        }}
      >
        <Icon size={28} />
      </div>

      <h3 style={{ fontSize: '1.15rem', fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
        {title}
      </h3>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', marginBottom: action ? '1.5rem' : 0 }}>
        {description}
      </p>

      {action && <div>{action}</div>}
    </div>
  );
};
