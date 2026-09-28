import React from 'react';

export const StatusCard = ({ title, status, isOnline, icon: Icon, details = [], action }) => {
  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {Icon && (
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isOnline ? '#34D399' : '#F87171',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={22} />
            </div>
          )}
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '600' }}>{title}</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Core Foundation Service</span>
          </div>
        </div>

        <div className={`badge ${isOnline ? 'badge-success' : 'badge-danger'}`}>
          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
          <span>{status}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
        {details.map((item, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
            <span style={{ fontWeight: '500', color: item.highlight ? 'var(--accent-primary)' : 'var(--text-primary)', fontFamily: item.mono ? 'monospace' : 'inherit' }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {action && <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>{action}</div>}
    </div>
  );
};
