import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Reusable Button component supporting variants, loading state, and sizes.
 */
export const Button = ({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'outline'
  size = 'md', // 'sm' | 'md' | 'lg'
  loading = false,
  disabled = false,
  icon: Icon,
  className = '',
  onClick,
  type = 'button',
  ...props
}) => {
  const sizeStyles = {
    sm: { padding: '0.4rem 0.85rem', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' },
    md: { padding: '0.65rem 1.25rem', fontSize: '0.9rem', borderRadius: 'var(--radius-md)' },
    lg: { padding: '0.85rem 1.75rem', fontSize: '1rem', borderRadius: 'var(--radius-md)' },
  };

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    outline: 'btn-outline',
  };

  return (
    <button
      type={type}
      className={`btn ${variantClasses[variant] || 'btn-primary'} ${className}`}
      style={{
        ...sizeStyles[size],
        opacity: disabled || loading ? 0.65 : 1,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
      }}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 size={size === 'sm' ? 14 : 18} className="spin" />
          <span>Processing...</span>
        </>
      ) : (
        <>
          {Icon && <Icon size={size === 'sm' ? 14 : 18} />}
          {children}
        </>
      )}
    </button>
  );
};
