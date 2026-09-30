import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  QrCode,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Compass,
  ArrowRight,
  Mail,
  Phone,
  Search,
  Filter,
  Sparkles,
  Users,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Ticket,
  Copy,
  Check,
  Award,
  Bot
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEventScanner } from '../context/EventScannerContext';
import {
  fetchEvents,
  fetchMyRegistrations,
  fetchMyTickets,
  fetchMyAttendance,
  fetchMyCertificates,
  confirmCertificateReceived,
  fetchPassByRegistration,
  getEventPosterUrl,
  getEventRegistrationQrUrl,
  getPublicAppUrl,
  getEventRegistrationUrl,
} from '../services/api';
import { getSocket } from '../services/socket';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { DigitalEventPassModal } from '../components/DigitalEventPassModal';
import { ChatWidget } from '../components/ChatWidget';

export const StudentDashboardPage = () => {
  const { user } = useAuth();
  const { openEventScanner } = useEventScanner();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [selectedRegQrEvent, setSelectedRegQrEvent] = useState(null);
  const [copiedRegLink, setCopiedRegLink] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Digital Pass Modal State
  const [selectedPassData, setSelectedPassData] = useState(null);
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [confirmingCertId, setConfirmingCertId] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [regFilter, setRegFilter] = useState('ALL'); // 'ALL' | 'REGISTERED' | 'AVAILABLE'

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const [eventsRes, regRes, ticketRes, attRes, certRes] = await Promise.all([
        fetchEvents(),
        fetchMyRegistrations(),
        fetchMyTickets(),
        fetchMyAttendance(),
        fetchMyCertificates(),
      ]);

      if (eventsRes.success && Array.isArray(eventsRes.data)) {
        setEvents(eventsRes.data);
      } else {
        setEvents([]);
      }

      if (regRes.success && Array.isArray(regRes.data)) {
        setRegistrations(regRes.data);
      } else {
        setRegistrations([]);
      }

      if (ticketRes.success && Array.isArray(ticketRes.data)) {
        setTickets(ticketRes.data);
      } else {
        setTickets([]);
      }

      if (attRes.success && Array.isArray(attRes.data)) {
        setAttendances(attRes.data);
      } else {
        setAttendances([]);
      }

      if (certRes.success && Array.isArray(certRes.data)) {
        setCertificates(certRes.data);
      } else {
        setCertificates([]);
      }
    } catch (err) {
      console.error('Failed to load student dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleConfirmReceipt = async (certificateId) => {
    setConfirmingCertId(certificateId);
    try {
      const res = await confirmCertificateReceived(certificateId);
      if (res.success) {
        await loadData(true);
      }
    } catch (err) {
      console.error('Failed to confirm certificate receipt:', err);
    } finally {
      setConfirmingCertId(null);
    }
  };

  const handleOpenDigitalPass = async (reg) => {
    try {
      let matchedTicket = tickets.find(
        (t) => (t.registration?._id || t.registration) === reg._id
      );
      if (!matchedTicket) {
        const res = await fetchPassByRegistration(reg._id);
        if (res.success && res.data) {
          matchedTicket = res.data;
        }
      }

      const passData = {
        ...matchedTicket,
        fullName: reg.fullName || user?.name,
        rollNumber: reg.rollNumber || user?.studentId,
        department: reg.department || user?.department,
        year: reg.year || user?.year,
        teamMembers: reg.teamMembers || [],
        registrationCode: reg.registrationCode,
        passCode: matchedTicket?.passCode || matchedTicket?.ticketCode || `ES-PASS-${reg._id?.slice(-8).toUpperCase()}`,
        event: reg.event,
        registrationId: reg._id,
      };

      setSelectedPassData(passData);
      setPassModalOpen(true);
    } catch (err) {
      console.error('Error preparing digital pass:', err);
    }
  };

  useEffect(() => {
    loadData();

    const socket = getSocket();
    const handleUpdate = () => {
      loadData(true);
    };

    const handleSeatUpdate = (data) => {
      if (data && data.eventId) {
        setEvents((prev) =>
          prev.map((e) =>
            (e._id === data.eventId || String(e._id) === String(data.eventId))
              ? { ...e, availableSeats: data.availableSeats }
              : e
          )
        );
      }
    };

    socket.on('event_created', handleUpdate);
    socket.on('event_updated', handleUpdate);
    socket.on('event_deleted', handleUpdate);
    socket.on('event_seats_updated', handleSeatUpdate);
    socket.on('registration_created', handleUpdate);
    socket.on('registration_cancelled', handleUpdate);
    socket.on('ticket_issued', handleUpdate);
    socket.on('attendance_checked_in', handleUpdate);
    socket.on('attendance:updated', handleUpdate);
    socket.on('certificate:updated', handleUpdate);

    return () => {
      socket.off('event_created', handleUpdate);
      socket.off('event_updated', handleUpdate);
      socket.off('event_deleted', handleUpdate);
      socket.off('event_seats_updated', handleSeatUpdate);
      socket.off('registration_created', handleUpdate);
      socket.off('registration_cancelled', handleUpdate);
      socket.off('ticket_issued', handleUpdate);
      socket.off('attendance_checked_in', handleUpdate);
      socket.off('attendance:updated', handleUpdate);
      socket.off('certificate:updated', handleUpdate);
    };
  }, [loadData]);

  // Derived Metrics from live MongoDB state
  const activeRegistrations = registrations.filter((r) => r.status === 'REGISTERED');
  const activeTickets = tickets.filter((t) => t.status === 'ACTIVE' || t.status === 'VALID' || !t.status);
  const presentAttendances = attendances.filter((a) => a.status === 'PRESENT' || a.status === 'CHECKED_IN');
  const issuedCertificates = certificates.filter((c) => c.status === 'ISSUED' || c.status === 'RECEIVED');

  // Filtered Events
  const filteredEvents = events.filter((event) => {
    // Search filter
    const matchesSearch =
      !searchQuery.trim() ||
      event.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.venue?.toLowerCase().includes(searchQuery.toLowerCase());

    // Category filter
    const matchesCategory =
      categoryFilter === 'ALL' || event.category === categoryFilter;

    // Registration state filter
    const isRegistered = activeRegistrations.some(
      (r) => (r.event?._id || r.event) === event._id
    );

    let matchesReg = true;
    if (regFilter === 'REGISTERED') matchesReg = isRegistered;
    if (regFilter === 'AVAILABLE') matchesReg = !isRegistered && (event.availableSeats || 0) > 0;

    return matchesSearch && matchesCategory && matchesReg;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.25rem' }}>
      {/* Top Breadcrumb / Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Badge variant="success" dot>
            Student Session Active
          </Badge>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            &bull; Live Campus Network Connected
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => loadData()}
            loading={refreshing}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={QrCode}
            onClick={() => openEventScanner()}
            style={{
              borderColor: 'rgba(99, 102, 241, 0.45)',
              color: '#818CF8',
              background: 'rgba(99, 102, 241, 0.1)',
              fontWeight: '600',
            }}
            title="Scan Event Poster or Flyer QR Code"
          >
            Scan QR to Register
          </Button>
          <Link to="/student/registrations">
            <Button variant="outline" size="sm">
              My Registrations
            </Button>
          </Link>
          <Link to="/student/tickets">
            <Button variant="primary" size="sm" icon={Ticket}>
              Digital Event Passes
            </Button>
          </Link>
        </div>
      </div>

      {/* SECTION A: WELCOME & AUTHENTICATED STUDENT SUMMARY */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: 'var(--gradient-brand)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glow)',
              flexShrink: 0,
            }}
          >
            <GraduationCap size={34} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
              <h1 style={{ fontSize: '1.85rem', fontWeight: '800' }}>
                Welcome back, {user?.name || 'Campus Student'}!
              </h1>
              <Badge variant="info">STUDENT</Badge>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.88rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Mail size={15} style={{ color: 'var(--accent-primary)' }} />
                <span>{user?.email}</span>
              </span>

              {user?.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Phone size={15} style={{ color: 'var(--accent-emerald)' }} />
                  <span>{user?.phone}</span>
                </span>
              )}

              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Student ID:</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {user?.studentId || `ES-STU-${user?._id?.slice(-6).toUpperCase()}`}
                </strong>
              </span>

              {user?.department && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Dept:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{user.department}</strong>
                </span>
              )}

              {user?.year && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Year:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{user.year}</strong>
                </span>
              )}
            </div>
          </div>

          <Link to="/profile">
            <Button variant="outline" size="sm">
              View Profile
            </Button>
          </Link>
        </div>
      </div>

      {/* SECTION: AI ASSISTANT BANNER */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-xl)',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.15) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
              flexShrink: 0,
            }}
          >
            <Bot size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                Have questions about registrations, attendance, or events?
              </h3>
              <Badge variant="primary">AI Powered</Badge>
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Ask the EventSync Assistant in English or Tanglish (Telugu + English). Also answers general knowledge and coding questions!
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/chat">
            <Button variant="primary" size="sm" icon={Sparkles} style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' }}>
              Open Full AI Chat
            </Button>
          </Link>
        </div>
      </div>

      {/* SECTION B: DYNAMIC SUMMARY METRICS (Clean Metrics - Zero Payments) */}
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Portal Activity Metrics
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Metric 1: Total Published Events */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Published Events</span>
              <Compass size={16} color="var(--accent-primary)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>
              {events.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Active campus opportunities
            </div>
          </div>

          {/* Metric 2: My Registered Events */}
          <Link to="/student/registrations" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="glass-panel" style={{ padding: '1.25rem', height: '100%', cursor: 'pointer' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>My Registrations</span>
                <Calendar size={16} color="var(--accent-primary)" />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: activeRegistrations.length > 0 ? '#10B981' : 'inherit' }}>
                {activeRegistrations.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Confirmed seat RSVPs &rarr;
              </div>
            </div>
          </Link>

          {/* Metric 3: Active Digital Event Passes */}
          <Link to="/student/tickets" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="glass-panel" style={{ padding: '1.25rem', height: '100%', cursor: 'pointer' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Digital Passes</span>
                <QrCode size={16} color="#06B6D4" />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: activeTickets.length > 0 ? '#06B6D4' : 'inherit' }}>
                {activeTickets.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Gate check-in passes &rarr;
              </div>
            </div>
          </Link>

          {/* Metric 4: Verified Gate Attendance */}
          <Link to="/student/attendance" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="glass-panel" style={{ padding: '1.25rem', height: '100%', cursor: 'pointer', borderColor: presentAttendances.length > 0 ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Verified Attendance</span>
                <CheckCircle2 size={16} color="#10B981" />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: presentAttendances.length > 0 ? '#10B981' : 'inherit' }}>
                {presentAttendances.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Verified admissions &rarr;
              </div>
            </div>
          </Link>

          {/* Metric 5: Event Certificates */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Certificates</span>
              <Award size={16} color="#8B5CF6" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: issuedCertificates.length > 0 ? '#8B5CF6' : 'inherit' }}>
              {issuedCertificates.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Participation & completion
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: MY EVENTS (Requirement 21) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={22} color="var(--accent-primary)" />
              <span>My Events</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Real-time synchronization for your seat registration, department, Digital Event Pass, attendance, and certificates.
            </p>
          </div>
          {activeRegistrations.length > 0 && (
            <Badge variant="success" dot>
              {activeRegistrations.length} {activeRegistrations.length === 1 ? 'Event' : 'Events'} Registered
            </Badge>
          )}
        </div>

        {activeRegistrations.length === 0 ? (
          <div className="glass-panel" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', borderRadius: 'var(--radius-xl)' }}>
            <Calendar size={38} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem', opacity: 0.6 }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.35rem' }}>No Active Event Registrations</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto' }}>
              Explore the campus catalog below, scan dynamic event registration QR codes, and reserve your seat.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activeRegistrations.map((reg) => {
              const regEvent = reg.event || {};
              const eventTitle = regEvent.title || 'Campus Event';
              const eventDept = reg.department || user?.department || 'Other';

              // Find matching attendance
              const att = attendances.find((a) =>
                (a.registration?._id || a.registration) === reg._id ||
                (a.event?._id || a.event) === (regEvent._id || reg.event)
              );
              const attStatus = att?.status || 'NOT_MARKED';

              // Find matching certificate
              const cert = certificates.find((c) =>
                (c.registration?._id || c.registration) === reg._id ||
                (c.event?._id || c.event) === (regEvent._id || reg.event)
              );
              const certStatus = cert?.status || 'NOT_ISSUED';

              return (
                <div
                  key={reg._id}
                  className="glass-panel"
                  style={{
                    padding: '1.5rem',
                    borderRadius: 'var(--radius-xl)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1.25rem',
                    alignItems: 'center',
                    borderLeft: '4px solid var(--accent-primary)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  }}
                >
                  {/* Event Details & Department */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                        {eventTitle}
                      </span>
                      <span style={{ fontSize: '0.72rem', background: '#10B981', color: 'white', padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-full)', fontWeight: '700' }}>
                        ✓ Registered
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span>Department: <strong style={{ color: 'var(--accent-cyan)' }}>{eventDept}</strong></span>
                      <span>&bull;</span>
                      <span>Code: <code style={{ color: 'var(--text-primary)', background: 'var(--bg-tertiary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{reg.registrationCode || reg._id?.slice(-8).toUpperCase()}</code></span>
                    </div>

                    {reg.teamMembers && reg.teamMembers.length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                        Team: {reg.teamMembers.map(m => m.name).join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Digital Event Pass Button */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '700' }}>
                      Digital Event Pass
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={QrCode}
                      onClick={() => handleOpenDigitalPass(reg)}
                      style={{
                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        width: 'fit-content',
                      }}
                    >
                      Digital Event Pass
                    </Button>
                  </div>

                  {/* Attendance Status */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '700' }}>
                      Attendance
                    </div>
                    <div>
                      {attStatus === 'PRESENT' || attStatus === 'CHECKED_IN' ? (
                        <Badge variant="success" dot>✓ Present</Badge>
                      ) : attStatus === 'ABSENT' ? (
                        <Badge variant="danger">✕ Absent</Badge>
                      ) : (
                        <Badge variant="warning">Not Marked</Badge>
                      )}
                    </div>
                    {att?.markedAt && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Updated at {new Date(att.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {/* Certificate Status */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '700' }}>
                      Certificate
                    </div>
                    <div>
                      {certStatus === 'RECEIVED' ? (
                        <Badge variant="success" dot>✓ Certificate Received</Badge>
                      ) : certStatus === 'ISSUED' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', alignItems: 'flex-start' }}>
                          <Badge variant="info">Certificate Issued</Badge>
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => handleConfirmReceipt(cert._id)}
                            loading={confirmingCertId === cert._id}
                            style={{
                              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                              fontSize: '0.76rem',
                              padding: '0.25rem 0.65rem',
                            }}
                          >
                            Confirm Certificate Received
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="neutral">Certificate Not Issued</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION C: ALL PUBLISHED EVENTS CATALOG */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Compass size={22} color="var(--accent-primary)" />
              <span>Explore Published Campus Events</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Browse real campus events created by EventAdmins, inspect seat availability, and reserve your seat.
            </p>
          </div>

          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Showing <strong>{filteredEvents.length}</strong> of <strong>{events.length}</strong> published events
          </span>
        </div>

        {/* Search & Filter Bar */}
        <div
          className="glass-panel"
          style={{
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {/* Search Input */}
          <div style={{ flex: 2, minWidth: '220px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.5rem', marginBottom: 0 }}
              placeholder="Search events by title, description, or venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Dropdown */}
          <div style={{ flex: 1, minWidth: '160px' }}>
            <select
              className="form-input"
              style={{ marginBottom: 0 }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              <option value="Technology">Technology</option>
              <option value="Cultural">Cultural</option>
              <option value="Sports">Sports</option>
              <option value="Academic">Academic</option>
              <option value="Workshop">Workshop</option>
              <option value="Seminar">Seminar</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Registration Filter Dropdown */}
          <div style={{ flex: 1, minWidth: '160px' }}>
            <select
              className="form-input"
              style={{ marginBottom: 0 }}
              value={regFilter}
              onChange={(e) => setRegFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="REGISTERED">My Registrations</option>
              <option value="AVAILABLE">Seats Available</option>
            </select>
          </div>

          {(searchQuery || categoryFilter !== 'ALL' || regFilter !== 'ALL') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('ALL');
                setRegFilter('ALL');
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Events Cards Grid */}
        {loading ? (
          <div className="grid-cards">
            {[1, 2, 3].map((n) => (
              <div key={n} className="glass-panel" style={{ padding: '1.5rem' }}>
                <LoadingSkeleton height="240px" />
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={events.length === 0 ? 'No campus events published yet' : 'No events match your criteria'}
            description={
              events.length === 0
                ? 'EventAdmins have not published any upcoming campus events yet. Check back soon for hackathons, workshops, and sports tournaments.'
                : 'Try adjusting your search terms or category filters to find available events.'
            }
          />
        ) : (
          <div className="grid-cards">
            {filteredEvents.map((event) => {
              const hasPoster = Boolean(event.poster && event.poster.filename);
              const capacity = event.capacity || 0;
              const availableSeats = event.availableSeats !== undefined ? event.availableSeats : capacity;
              const isFull = availableSeats <= 0;

              const isRegistered = activeRegistrations.some(
                (r) => (r.event?._id || r.event) === event._id
              );

              const displayDate = event.date
                ? new Date(event.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'TBA';

              const defaultGradient = event.gradient || 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)';

              return (
                <div
                  key={event._id}
                  className="glass-panel"
                  style={{
                    borderRadius: 'var(--radius-xl)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    border: isRegistered ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
                  }}
                >
                  {/* Card Header Poster or Gradient */}
                  <div
                    style={{
                      height: '140px',
                      background: defaultGradient,
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '1rem',
                    }}
                  >
                    {hasPoster && (
                      <img
                        src={getEventPosterUrl(event._id)}
                        alt={event.title}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    )}

                    {/* Gradient Overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: hasPoster
                          ? 'linear-gradient(to bottom, rgba(5, 8, 16, 0.3) 0%, rgba(5, 8, 16, 0.8) 100%)'
                          : 'rgba(0,0,0,0.15)',
                      }}
                    />

                    {/* Top Badges */}
                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.65rem',
                          borderRadius: 'var(--radius-full)',
                          background: 'rgba(0,0,0,0.6)',
                          backdropFilter: 'blur(4px)',
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                        }}
                      >
                        {event.category || 'Event'}
                      </span>

                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: 'var(--radius-full)',
                            background: event.isPaid ? '#F59E0B' : '#10B981',
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: '800',
                          }}
                        >
                          {event.isPaid ? `₹${event.fee}` : 'FREE'}
                        </span>
                        {(event.prizeMoney > 0 || event.firstPrize > 0 || event.secondPrize > 0 || event.thirdPrize > 0) && (
                          <span
                            style={{
                              padding: '0.25rem 0.65rem',
                              borderRadius: 'var(--radius-full)',
                              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                              color: 'white',
                              fontSize: '0.75rem',
                              fontWeight: '800',
                            }}
                          >
                            🏆 ₹{Number(event.prizeMoney || ((Number(event.firstPrize) || 0) + (Number(event.secondPrize) || 0) + (Number(event.thirdPrize) || 0))).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Indicator on Header */}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      {isRegistered && (
                        <span
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: 'var(--radius-sm)',
                            background: '#10B981',
                            color: 'white',
                            fontSize: '0.72rem',
                            fontWeight: '800',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <CheckCircle2 size={12} />
                          REGISTERED ✓
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '0.85rem' }}>
                    <div>
                      <h3
                        style={{
                          fontSize: '1.15rem',
                          fontWeight: '800',
                          lineHeight: 1.3,
                          marginBottom: '0.35rem',
                        }}
                      >
                        {event.title}
                      </h3>

                      {/* 3 Prizes Breakdown */}
                      {(event.firstPrize > 0 || event.secondPrize > 0 || event.thirdPrize > 0) && (
                        <div
                          style={{
                            display: 'flex',
                            gap: '0.35rem',
                            flexWrap: 'wrap',
                            margin: '0.25rem 0 0.5rem',
                            padding: '0.3rem 0.5rem',
                            background: 'rgba(245, 158, 11, 0.08)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            fontSize: '0.74rem',
                          }}
                        >
                          {event.firstPrize > 0 && <span style={{ color: '#FCD34D', fontWeight: '700' }}>🥇 1st: ₹{event.firstPrize}</span>}
                          {event.secondPrize > 0 && <span style={{ color: '#E2E8F0', fontWeight: '600' }}>🥈 2nd: ₹{event.secondPrize}</span>}
                          {event.thirdPrize > 0 && <span style={{ color: '#FB923C', fontWeight: '600' }}>🥉 3rd: ₹{event.thirdPrize}</span>}
                        </div>
                      )}
                      <p
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.85rem',
                          lineHeight: 1.45,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {event.description || 'No detailed description provided.'}
                      </p>
                    </div>

                    {/* Schedule & Venue Specs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Calendar size={14} style={{ color: 'var(--accent-primary)' }} />
                        <span>{displayDate} &bull; {event.time || 'TBA'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <MapPin size={14} style={{ color: 'var(--accent-rose)' }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {event.venue || 'Campus Venue'}
                        </span>
                      </div>
                    </div>

                    {/* Live Seat Availability Gauge */}
                    <div
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.8rem',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Users size={14} />
                        <span>Seats Remaining:</span>
                      </span>
                      <strong style={{ color: isFull ? '#EF4444' : availableSeats <= 10 ? '#F59E0B' : '#10B981' }}>
                        {isFull ? 'Sold Out' : `${availableSeats} / ${capacity}`}
                      </strong>
                    </div>

                    {/* Action Buttons: View Details, Register / Open Registration, Registration QR */}
                    <div style={{ marginTop: 'auto', paddingTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link to={`/events/${event._id}`} style={{ flex: 1, textDecoration: 'none' }}>
                          <Button variant="secondary" size="sm" style={{ width: '100%' }}>
                            View Details
                          </Button>
                        </Link>
                        {isRegistered ? (
                          <Link to="/student/tickets" style={{ flex: 1, textDecoration: 'none' }}>
                            <Button variant="primary" size="sm" icon={Ticket} style={{ width: '100%', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>
                              My Pass
                            </Button>
                          </Link>
                        ) : isFull ? (
                          <Button variant="secondary" size="sm" disabled style={{ flex: 1, opacity: 0.6 }}>
                            Event Full
                          </Button>
                        ) : (
                          <Link to={`/events/${event._id}/register`} style={{ flex: 1, textDecoration: 'none' }}>
                            <Button
                              variant="primary"
                              size="sm"
                              icon={Sparkles}
                              style={{
                                width: '100%',
                                background: event.isPaid
                                  ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                                  : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                              }}
                            >
                              Register
                            </Button>
                          </Link>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={QrCode}
                          onClick={() => setSelectedRegQrEvent(event)}
                          style={{ flex: 1 }}
                        >
                          Registration QR
                        </Button>
                        <Link to={`/events/${event._id}/register`} style={{ flex: 1, textDecoration: 'none' }}>
                          <Button variant="secondary" size="sm" icon={ExternalLink} style={{ width: '100%' }}>
                            Open Registration
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Registration QR & Link Modal */}
      {selectedRegQrEvent && (
        <Modal
          isOpen={Boolean(selectedRegQrEvent)}
          onClose={() => {
            setSelectedRegQrEvent(null);
            setCopiedRegLink(false);
          }}
          title="Event Registration QR Code & Link"
          subtitle={selectedRegQrEvent.title}
          maxWidth="480px"
          actions={
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedRegQrEvent(null);
                setCopiedRegLink(false);
              }}
            >
              Close
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', textAlign: 'center' }}>
            <div
              style={{
                padding: '1.25rem',
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
              }}
            >
              <img
                src={getEventRegistrationQrUrl(selectedRegQrEvent._id)}
                alt={`Registration QR for ${selectedRegQrEvent.title}`}
                style={{ width: '200px', height: '200px', display: 'block' }}
              />
            </div>

            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                Scan to Register
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Registration Link:
              </div>
              <code
                style={{
                  display: 'block',
                  background: 'var(--bg-tertiary)',
                  padding: '0.5rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  wordBreak: 'break-all',
                  color: 'var(--accent-cyan)',
                }}
              >
                {getEventRegistrationUrl(selectedRegQrEvent._id)}
              </code>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem', width: '100%' }}>
              <Link to={`/events/${selectedRegQrEvent._id}/register`} style={{ flex: 1, textDecoration: 'none' }}>
                <Button variant="primary" size="sm" style={{ width: '100%' }}>
                  Open Registration Page
                </Button>
              </Link>
              <Button
                variant="secondary"
                size="sm"
                icon={copiedRegLink ? Check : Copy}
                onClick={async () => {
                  try {
                    const url = getEventRegistrationUrl(selectedRegQrEvent._id);
                    await navigator.clipboard.writeText(url);
                    setCopiedRegLink(true);
                    setTimeout(() => setCopiedRegLink(false), 2500);
                  } catch (e) {}
                }}
                style={{ flex: 1 }}
              >
                {copiedRegLink ? 'Copied!' : 'Copy Link'}
              </Button>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              * This QR code leads directly to the official event registration page.
            </div>
          </div>
        </Modal>
      )}

      {/* Digital Event Pass Modal (Requirement 9 & 21) */}
      {passModalOpen && (
        <DigitalEventPassModal
          isOpen={passModalOpen}
          onClose={() => {
            setPassModalOpen(false);
            setSelectedPassData(null);
          }}
          passData={selectedPassData}
        />
      )}

      {/* Floating Chatbot Widget (Requirement 13) */}
      <ChatWidget />
    </div>
  );
};
