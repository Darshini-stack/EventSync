import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Zap, 
  GraduationCap, 
  ShieldCheck, 
  Compass, 
  ArrowRight, 
  Sparkles, 
  QrCode, 
  Users, 
  CheckCircle2, 
  Activity,
  Bot
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export const LandingPage = () => {
  const { user, isAuthenticated, isStudent, isAdmin } = useAuth();
  const navigate = useNavigate();

  // If user is already authenticated, provide quick access or auto-direct
  const dashboardPath = isStudent ? '/student/dashboard' : isAdmin ? '/admin/dashboard' : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem', minHeight: '75vh', justifyContent: 'center' }}>
      {/* 1. PROFESSIONAL WELCOME SCREEN (Requirement 1) */}
      <section className="welcome-screen-animate" style={{ maxWidth: '860px', margin: '1rem auto 0', width: '100%' }}>
        <div className="welcome-hero-card glass-panel">
          {/* Glowing Brand Icon */}
          <div className="welcome-logo-badge">
            <Zap size={36} color="#FFFFFF" />
          </div>

          {/* Platform Tag */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <div className="hero-pill-badge" style={{ margin: 0 }}>
              <Sparkles size={14} color="var(--accent-primary)" />
              <span>Smart Event Management & Real-Time Sync</span>
            </div>
          </div>

          {/* EventSync Logo / Branding Heading */}
          <h1
            style={{
              fontSize: 'clamp(2.2rem, 5.5vw, 3.4rem)',
              fontWeight: '900',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              marginBottom: '1rem',
              background: 'linear-gradient(135deg, #FFFFFF 0%, #E2E8F0 50%, #A5B4FC 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Welcome to EventSync
          </h1>

          {/* Short Welcome Message */}
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: 'clamp(0.95rem, 2.2vw, 1.12rem)',
              lineHeight: 1.65,
              maxWidth: '640px',
              margin: '0 auto 1.5rem',
            }}
          >
            The centralized campus portal for college workshops, hackathons, and cultural fests.
            Experience real-time seat tracking, dynamic team registrations, and instant digital QR passes.
          </p>

          {/* Authenticated State Quick Route Indicator */}
          {isAuthenticated && user && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.55rem 1.1rem',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: 'var(--radius-full)',
                marginBottom: '1.25rem',
                fontSize: '0.86rem',
              }}
            >
              <CheckCircle2 size={16} color="#10B981" />
              <span>
                Signed in as <strong style={{ color: '#34D399' }}>{user.name}</strong> ({user.role})
              </span>
            </div>
          )}

          {/* Core Action Buttons: Student Login & Admin Login (Requirement 1) */}
          <div className="welcome-actions-row">
            {isAuthenticated && dashboardPath ? (
              <>
                <Link to={dashboardPath}>
                  <Button
                    variant="primary"
                    size="lg"
                    icon={isStudent ? GraduationCap : ShieldCheck}
                    style={{ minWidth: '220px', padding: '0.85rem 1.75rem', fontSize: '1rem' }}
                  >
                    Go to {isStudent ? 'Student Dashboard' : 'Admin Dashboard'}
                  </Button>
                </Link>
                <Link to="/events">
                  <Button
                    variant="secondary"
                    size="lg"
                    icon={Compass}
                    style={{ minWidth: '200px' }}
                  >
                    Browse Campus Events
                  </Button>
                </Link>
              </>
            ) : (
              <>
                {/* Student Login Button */}
                <Link to="/login" id="student-login-welcome-btn">
                  <Button
                    variant="primary"
                    size="lg"
                    icon={GraduationCap}
                    style={{
                      minWidth: '200px',
                      padding: '0.85rem 1.6rem',
                      fontSize: '1rem',
                      fontWeight: '700',
                      background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                    }}
                  >
                    Student Login
                  </Button>
                </Link>

                {/* Admin Login Button */}
                <Link to="/admin/login" id="admin-login-welcome-btn">
                  <Button
                    variant="secondary"
                    size="lg"
                    icon={ShieldCheck}
                    style={{
                      minWidth: '200px',
                      padding: '0.85rem 1.6rem',
                      fontSize: '1rem',
                      fontWeight: '700',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: '#FBBF24',
                    }}
                  >
                    Admin Login
                  </Button>
                </Link>

                {/* Public Events Directory Link */}
                <Link to="/events" id="explore-events-welcome-btn">
                  <Button
                    variant="outline"
                    size="lg"
                    icon={Compass}
                    style={{ minWidth: '180px', padding: '0.85rem 1.4rem' }}
                  >
                    Explore Events
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 2. THREE CORE PILLARS (Clean showcase, NO event cards displayed on initial screen) */}
      <section style={{ maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: '1.25rem',
          }}
        >
          <div className="glass-panel" style={{ padding: '1.75rem 1.5rem', borderRadius: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <QrCode size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.4rem' }}>
              Instant Digital QR Passes
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              Register individually or with dynamic teams ($1 \dots N$). Digital event passes with unique security codes are generated automatically upon seat confirmation.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '1.75rem 1.5rem', borderRadius: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <Activity size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.4rem' }}>
              Real-Time Concurrency Sync
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              Powered by Socket.IO and atomic MongoDB transactions. Zero overbooking, live seat decrementing, and instant status updates across devices.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '1.75rem 1.5rem', borderRadius: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.4rem' }}>
              Organizer Operations Suite
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              Role-restricted admin suite with attendance checking, roster verification, dynamic QR code management, and automated certificate distribution.
            </p>
          </div>
        </div>
      </section>

      {/* 3. QUICK NAVIGATION FOOTNOTE */}
      <section style={{ textAlign: 'center', paddingBottom: '1rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Need to register for an event via QR code? Use the direct link provided on event posters or{' '}
          <Link to="/events" style={{ color: 'var(--accent-primary)', fontWeight: '600', textDecoration: 'none' }}>
            browse upcoming events &rarr;
          </Link>
        </p>
      </section>
    </div>
  );
};
