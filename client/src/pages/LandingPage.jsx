import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Compass, 
  CheckCircle2, 
  CreditCard, 
  QrCode, 
  ScanLine, 
  Bell, 
  Bot, 
  ArrowRight, 
  Sparkles, 
  Calendar, 
  ShieldCheck, 
  GraduationCap, 
  PlusCircle, 
  Lock, 
  CalendarX,
  Users
} from 'lucide-react';
import { fetchEvents } from '../services/api';
import { EventCard } from '../components/EventCard';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';

export const LandingPage = () => {
  const [createEventModalOpen, setCreateEventModalOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      setLoadingEvents(true);
      try {
        const res = await fetchEvents();
        if (res.success && Array.isArray(res.data)) {
          setEvents(res.data);
        } else {
          setEvents([]);
        }
      } catch (err) {
        setEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    };

    loadEvents();
  }, []);

  const productFeatures = [
    {
      id: 1,
      title: 'Event Discovery',
      description: 'Find upcoming college events in one place.',
      icon: Compass,
      tag: 'Phase 3',
    },
    {
      id: 2,
      title: 'Easy RSVP',
      description: 'Register for events with a simple and secure process.',
      icon: CheckCircle2,
      tag: 'Phase 4',
    },
    {
      id: 3,
      title: 'Payment Verification',
      description: 'Upload payment proof and track verification status.',
      icon: CreditCard,
      tag: 'Phase 5',
    },
    {
      id: 4,
      title: 'Digital QR Ticket',
      description: 'Get your verified QR ticket after approval.',
      icon: QrCode,
      tag: 'Phase 6',
    },
    {
      id: 5,
      title: 'Smart Attendance',
      description: 'Check in quickly using your QR ticket.',
      icon: ScanLine,
      tag: 'Phase 7',
    },
    {
      id: 6,
      title: 'Real-Time Notifications',
      description: 'Receive instant updates about events, registration and approvals.',
      icon: Bell,
      tag: 'Phase 9',
    },
    {
      id: 7,
      title: 'AI Event Assistant',
      description: 'Ask EventSync about events and registration.',
      icon: Bot,
      tag: 'Phase 10',
    },
  ];

  const workflowSteps = [
    {
      number: '01',
      title: 'Discover Event',
      desc: 'Browse verified college workshops, hackathons, and cultural fests with live seat availability.',
    },
    {
      number: '02',
      title: 'Register & Submit Payment',
      desc: 'Reserve your seat immediately for free events, or upload your payment receipt for fee-based events.',
    },
    {
      number: '03',
      title: 'Get Verified QR Ticket',
      desc: 'Organizers verify payment and instantly generate your tamper-proof digital QR ticket.',
    },
    {
      number: '04',
      title: 'Attend & Check In',
      desc: 'Show your QR ticket at the campus venue for zero-friction attendance recording.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4.5rem' }}>
      {/* 1. HERO SECTION */}
      <section className="hero-container">
        <div className="hero-pill-badge">
          <Sparkles size={14} />
          <span>Smart Event Management & RSVP Platform</span>
        </div>

        <h1 className="hero-heading">
          Discover. Register. Experience.
        </h1>

        <p className="hero-subtext">
          Manage events, registrations, payments and attendance — all in one smart platform.
        </p>

        <div className="hero-actions">
          <Link to="/events">
            <Button variant="primary" size="lg" icon={Compass}>
              Explore Events
            </Button>
          </Link>

          <Button
            variant="secondary"
            size="lg"
            icon={PlusCircle}
            onClick={() => setCreateEventModalOpen(true)}
          >
            Create an Event
          </Button>
        </div>

        {/* Platform Metrics Bar */}
        <div className="hero-metrics-bar">
          <div className="metric-item">
            <span className="metric-value">Real-Time</span>
            <span className="metric-label">Socket.IO Bidirectional Sync</span>
          </div>
          <div className="metric-item">
            <span className="metric-value">Zero</span>
            <span className="metric-label">Overbooking / Atomic Concurrency</span>
          </div>
          <div className="metric-item">
            <span className="metric-value">QR Pass</span>
            <span className="metric-label">Instant Digital Check-In</span>
          </div>
          <div className="metric-item">
            <span className="metric-value">AI Guided</span>
            <span className="metric-label">Authorized Event Assistant</span>
          </div>
        </div>
      </section>

      {/* 2. UPCOMING EVENTS PREVIEW SECTION (100% DYNAMIC - ZERO MOCK DATA) */}
      <section id="events-preview">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Badge variant="info">Live Events Directory</Badge>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Synchronized with MongoDB</span>
            </div>
            <h2 style={{ fontSize: '1.85rem' }}>Upcoming Campus Events</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Browse scheduled campus hackathons, technical workshops, and student activities.
            </p>
          </div>

          <Link to="/events">
            <Button variant="secondary" size="md">
              <span>Explore All Events</span>
              <ArrowRight size={16} />
            </Button>
          </Link>
        </div>

        {loadingEvents ? (
          <div className="grid-cards">
            <div className="glass-panel" style={{ padding: '1.5rem' }}><LoadingSkeleton height="200px" /></div>
            <div className="glass-panel" style={{ padding: '1.5rem' }}><LoadingSkeleton height="200px" /></div>
            <div className="glass-panel" style={{ padding: '1.5rem' }}><LoadingSkeleton height="200px" /></div>
          </div>
        ) : events.length > 0 ? (
          <div className="grid-cards">
            {events.slice(0, 3).map((event) => (
              <EventCard key={event._id || event.id} event={event} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarX}
            title="No events published yet"
            description="Upcoming campus events will appear here once published by campus organizers."
            action={
              <Link to="/events">
                <Button variant="secondary" size="md">
                  View Events Directory
                </Button>
              </Link>
            }
          />
        )}
      </section>

      {/* 3. HOW EVENTSYNC WORKS */}
      <section id="how-it-works">
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 2.5rem' }}>
          <Badge variant="info" style={{ marginBottom: '0.75rem' }}>Simple 4-Step Process</Badge>
          <h2 style={{ fontSize: '1.85rem', marginBottom: '0.5rem' }}>How EventSync Works</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            From event discovery to attendance scanning, every step is automated and synchronized in real time.
          </p>
        </div>

        <div className="steps-grid">
          {workflowSteps.map((step, index) => (
            <div key={index} className="glass-panel step-card">
              <span className="step-number">{step.number}</span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>{step.title}</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. PRODUCT FEATURES SECTION (7 FEATURES) */}
      <section id="features">
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 2rem' }}>
          <Badge variant="info" style={{ marginBottom: '0.75rem' }}>Comprehensive Feature Suite</Badge>
          <h2 style={{ fontSize: '1.85rem', marginBottom: '0.5rem' }}>Built for Modern Campus Events</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Everything students and campus organizers need to host, register, and experience world-class college events.
          </p>
        </div>

        <div className="features-grid">
          {productFeatures.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.id} className="glass-panel feature-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="feature-icon-wrapper">
                    <Icon size={22} />
                  </div>
                  <Badge variant="neutral" style={{ fontSize: '0.72rem' }}>
                    {feat.tag}
                  </Badge>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                    {feat.title}
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {feat.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. ROLE ENTRY SECTION */}
      <section id="role-selection">
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 2.25rem' }}>
          <Badge variant="info" style={{ marginBottom: '0.75rem' }}>Role-Based Access</Badge>
          <h2 style={{ fontSize: '1.85rem', marginBottom: '0.5rem' }}>
            Choose your EventSync experience
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Dedicated interfaces designed specifically for students and authorized campus administrators.
          </p>
        </div>

        <div className="role-grid">
          {/* Student Experience Card */}
          <div className="glass-panel role-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <GraduationCap size={26} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '700' }}>Student / Participant</h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Self-Service Experience</span>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              Browse events, register, track your status and manage your tickets. Upload payment proof, receive instant confirmations, and query EventSync AI.
            </p>

            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
              <Link to="/login">
                <Button variant="primary" size="md" style={{ width: '100%' }}>
                  <span>Continue as Student</span>
                  <ArrowRight size={16} />
                </Button>
              </Link>
            </div>
          </div>

          {/* Admin Experience Card */}
          <div className="glass-panel role-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#FBBF24',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={26} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '700' }}>EventAdmin Portal</h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Authorized Access Required</span>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              Create events, verify registrations, manage attendance and monitor activity. Requires secure Admin Access Code verification.
            </p>

            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
              <Link to="/admin/login">
                <Button
                  variant="outline"
                  size="md"
                  style={{ width: '100%', borderColor: 'rgba(245, 158, 11, 0.5)', color: '#FBBF24' }}
                >
                  <Lock size={15} />
                  <span>Admin Portal</span>
                  <ArrowRight size={16} />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Modal: "Create an Event" Information dialog */}
      <Modal
        isOpen={createEventModalOpen}
        onClose={() => setCreateEventModalOpen(false)}
        title="Event Creation is an EventAdmin Action"
        subtitle="Role-Based Security Policy"
        actions={
          <>
            <Button variant="secondary" onClick={() => setCreateEventModalOpen(false)}>
              Close
            </Button>
            <Link to="/admin/login" onClick={() => setCreateEventModalOpen(false)}>
              <Button variant="primary">
                Proceed to EventAdmin Portal
              </Button>
            </Link>
          </>
        }
      >
        <p style={{ lineHeight: 1.6, marginBottom: '0.85rem' }}>
          In EventSync, event creation is restricted to verified campus organizers holding an active <strong>EventAdmin</strong> role and an authorized <strong>Admin Access Code</strong>.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
          Student accounts cannot create or publish events.
        </p>
      </Modal>
    </div>
  );
};
