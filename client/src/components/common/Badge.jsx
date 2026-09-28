import React from 'react';

/**
 * Reusable Status Badge component supporting multiple semantic themes and optional live pulsing dot.
 */
export const Badge = ({
  children,
  variant = 'info', // 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  dot = false,
  pulse = false,
  icon: Icon,
  className = '',
  style = {},
}) => {
  const variantClasses = {
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    neutral: 'badge-neutral',
  };

  return (
    <span className={`badge ${variantClasses[variant] || 'badge-info'} ${className}`} style={style}>
      {dot && <span className={`status-dot ${variant === 'success' ? 'online' : variant === 'danger' ? 'offline' : 'pending'}`}></span>}
      {Icon && <Icon size={13} />}
      <span>{children}</span>
    </span>
  );
};
