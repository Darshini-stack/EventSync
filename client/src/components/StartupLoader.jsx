import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';

export const StartupLoader = () => {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    // Check prefers-reduced-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
    // Check if already displayed this session
    return !sessionStorage.getItem('eventsync_splash_shown');
  });

  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!visible) return;

    // Start fade out after 450ms
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 450);

    // Complete removal after 700ms
    const hideTimer = setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem('eventsync_splash_shown', 'true');
      } catch (e) {
        // Ignore storage exceptions
      }
    }, 700);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`startup-loader-backdrop ${fading ? 'fade-out' : ''}`}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#0A0E1A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 250ms cubic-bezier(0.4, 0, 0.2, 1), transform 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: fading ? 0 : 1,
        transform: fading ? 'scale(1.02)' : 'scale(1)',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          transform: 'translateY(-10px)',
        }}
      >
        <div
          className="startup-icon-wrapper"
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            boxShadow: '0 0 35px rgba(99, 102, 241, 0.5)',
            animation: 'startupPopIn 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          <Zap size={32} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: 'var(--font-heading, "Outfit", sans-serif)',
              fontSize: '1.85rem',
              fontWeight: '800',
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #FFFFFF 30%, #C7D2FE 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '0.2rem',
            }}
          >
            EventSync
          </h1>
          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted, #94A3B8)',
              fontWeight: '500',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Smart Event Management
          </p>
        </div>

        {/* Subtle quick loader bar */}
        <div
          style={{
            width: '140px',
            height: '3px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '9999px',
            overflow: 'hidden',
            marginTop: '0.5rem',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #6366F1, #8B5CF6, #EC4899)',
              borderRadius: '9999px',
              animation: 'startupBarFill 450ms ease-out forwards',
            }}
          />
        </div>
      </div>
    </div>
  );
};
