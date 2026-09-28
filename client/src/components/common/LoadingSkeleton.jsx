import React from 'react';

/**
 * Reusable Loading Skeleton and Spinner components for accessible UI loading states.
 */
export const LoadingSkeleton = ({ height = '120px', width = '100%', borderRadius = 'var(--radius-md)', count = 1 }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="skeleton-pulse"
          style={{
            height,
            width,
            borderRadius,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
          }}
        />
      ))}
    </div>
  );
};
