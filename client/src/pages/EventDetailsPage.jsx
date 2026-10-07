import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  ArrowLeft, 
  ShieldCheck, 
  CalendarX,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Sparkles,
  CreditCard,
  Upload,
  FileCheck,
  AlertTriangle,
  QrCode,
  Download,
  Copy,
  Check,
  Share2,
  Image as ImageIcon,
  ImageOff,
  Maximize2,
} from 'lucide-react';
import { 
  fetchEventById, 
  registerForEvent, 
  cancelRegistration, 
  fetchMyRegistrations,
  fetchMyTickets,
  createTicket,
  getTicketQrUrl,
  fetchMyAttendance,
  getEventPosterUrl,
  getEventRegistrationQrUrl,
  submitPaymentProof,
  getPublicAppUrl,
  getEventRegistrationUrl,
} from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Alert } from '../components/common/Alert';
import { EmptyState } from '../components/common/EmptyState';
import { EventCountdown } from '../components/EventCountdown';
import { EventDateMiniCalendar } from '../components/EventDateMiniCalendar';
import { ChatWidget } from '../components/ChatWidget';

export const EventDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isStudent, isEventAdmin } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myRegistration, setMyRegistration] = useState(null);
  const [checkingReg, setCheckingReg] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Phase 5 Payment State
  const [payment, setPayment] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [txnInput, setTxnInput] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  // Phase 6 Ticket State
  const [ticket, setTicket] = useState(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [generatingTicket, setGeneratingTicket] = useState(false);
  const [ticketQrBlobUrl, setTicketQrBlobUrl] = useState('');
  const [ticketQrLoading, setTicketQrLoading] = useState(false);

  // Phase 7 Attendance State
  const [attendance, setAttendance] = useState(null);

  // Registration Link & QR Modal State
  const [regQrModalOpen, setRegQrModalOpen] = useState(false);
  const [copiedRegLink, setCopiedRegLink] = useState(false);

  // Event Poster Zoom Modal & Error State
  const [posterZoomOpen, setPosterZoomOpen] = useState(false);
  const [posterLoadError, setPosterLoadError] = useState(false);

  // Load single event details
  const loadEvent = useCallback(async () => {
    try {
      const res = await fetchEventById(id);
      if (res.success && res.data) {
        setEvent(res.data);
        setPosterLoadError(false);
      } else {
        setEvent(null);
      }
    } catch (err) {
      setEvent(null);
    }
  }, [id]);

  // Check if current authenticated student has an active registration for this event
  const checkStudentRegistration = useCallback(async () => {
    if (!isAuthenticated || !isStudent) {
      setMyRegistration(null);
      return;
    }

    setCheckingReg(true);
    try {
      const [regRes, ticketRes, attRes] = await Promise.all([
        fetchMyRegistrations(),
        fetchMyTickets(),
        fetchMyAttendance(),
      ]);

      let matchedReg = null;
      if (regRes.success && Array.isArray(regRes.data)) {
        matchedReg = regRes.data.find(
          (r) =>
            ((r.event && (r.event._id === id || r.event === id)) || r.event === id) &&
            r.status === 'REGISTERED'
        );
        setMyRegistration(matchedReg || null);
      } else {
        setMyRegistration(null);
      }

      if (ticketRes.success && Array.isArray(ticketRes.data) && matchedReg) {
        const matchedTicket = ticketRes.data.find(
          (t) =>
            (t.registration && (t.registration._id === matchedReg._id || t.registration === matchedReg._id)) &&
            t.status === 'ACTIVE'
        );
        setTicket(matchedTicket || null);
      } else {
        setTicket(null);
      }

      if (attRes.success && Array.isArray(attRes.data) && matchedReg) {
        const matchedAtt = attRes.data.find(
          (a) =>
            (a.registration && (a.registration._id === matchedReg._id || a.registration === matchedReg._id)) ||
            (a.event && (a.event._id === id || a.event === id))
        );
        setAttendance(matchedAtt || null);
      } else {
        setAttendance(null);
      }
    } catch (err) {
      setMyRegistration(null);
      setTicket(null);
      setAttendance(null);
    } finally {
      setCheckingReg(false);
    }
  }, [id, isAuthenticated, isStudent]);

  const myRegRef = useRef(myRegistration);
  useEffect(() => {
    myRegRef.current = myRegistration;
  }, [myRegistration]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoading(true);
      await Promise.all([loadEvent(), checkStudentRegistration()]);
      if (mounted) setLoading(false);
    };

    init();

    // Socket.IO real-time synchronization
    const socket = getSocket();
    const handleSeatUpdate = (data) => {
      if (data && data.eventId === id) {
        setEvent((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            availableSeats: data.availableSeats !== undefined ? data.availableSeats : prev.availableSeats,
            capacity: data.capacity !== undefined ? data.capacity : prev.capacity,
          };
        });
      }
    };

    const handleRegistrationChange = (data) => {
      if (data && data.eventId === id) {
        loadEvent();
        checkStudentRegistration();
      }
    };

    const handlePaymentChange = (data) => {
      if (data && data.eventId === id) {
        checkStudentRegistration();
      }
    };

    const handleTicketChange = (data) => {
      if (data && data.eventId === id) {
        checkStudentRegistration();
      }
    };

    const handleAttendanceChange = (data) => {
      if (data && (data.eventId === id || data.registrationId === (myRegRef.current && myRegRef.current._id))) {
        checkStudentRegistration();
      }
    };

    socket.on('event_seats_updated', handleSeatUpdate);
    socket.on('registration_created', handleRegistrationChange);
    socket.on('registration_cancelled', handleRegistrationChange);
    socket.on('payment_status_updated', handlePaymentChange);
    socket.on('ticket_issued', handleTicketChange);
    socket.on('attendance_checked_in', handleAttendanceChange);

    return () => {
      mounted = false;
      socket.off('event_seats_updated', handleSeatUpdate);
      socket.off('registration_created', handleRegistrationChange);
      socket.off('registration_cancelled', handleRegistrationChange);
      socket.off('payment_status_updated', handlePaymentChange);
      socket.off('ticket_issued', handleTicketChange);
      socket.off('attendance_checked_in', handleAttendanceChange);
    };
  }, [id, loadEvent, checkStudentRegistration]);

  // Handle RSVP / Registration
  const handleRegister = async () => {
    setFeedback(null);
    setSubmittingAction(true);
    try {
      const res = await registerForEvent(id);
      if (res.success) {
        setMyRegistration(res.data);
        setFeedback({
          type: 'success',
          message: 'Seat successfully reserved! You are registered for this event.',
        });
        await loadEvent();
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Unable to register for event.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Network error occurred while reserving seat. Please try again.',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Registration Cancellation
  const handleCancelRegistration = async () => {
    if (!myRegistration) return;
    setFeedback(null);
    setSubmittingAction(true);
    try {
      const res = await cancelRegistration(myRegistration._id);
      if (res.success) {
        setMyRegistration(null);
        setCancelModalOpen(false);
        setFeedback({
          type: 'success',
          message: 'Your registration has been cancelled and your seat has been released.',
        });
        await loadEvent();
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Unable to cancel registration.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Network error occurred while cancelling registration.',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Payment Proof Submission (Phase 5)
  const handleOpenPaymentModal = () => {
    setTxnInput('');
    setProofFile(null);
    setPaymentError(null);
    setPaymentModalOpen(true);
  };

  const handleSubmitPaymentProof = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setPaymentError(null);

    if (!txnInput.trim() || txnInput.trim().length < 3) {
      setPaymentError('Please enter a valid transaction or reference ID (at least 3 characters).');
      return;
    }

    if (!proofFile) {
      setPaymentError('Please select a payment proof document (PNG, JPG, WEBP, or PDF).');
      return;
    }

    if (!myRegistration) {
      setPaymentError('No active event registration found.');
      return;
    }

    setSubmittingPayment(true);
    try {
      const formData = new FormData();
      formData.append('registrationId', myRegistration._id);
      formData.append('transactionId', txnInput.trim());
      formData.append('proof', proofFile);

      const res = await submitPaymentProof(formData);
      if (res.success && res.data) {
        setPayment(res.data);
        setPaymentModalOpen(false);
        setFeedback({
          type: 'success',
          message: res.message || 'Payment proof submitted! Verification is now pending.',
        });
        await checkStudentRegistration();
      } else {
        setPaymentError(res.message || 'Unable to submit payment proof.');
      }
    } catch (err) {
      setPaymentError(err.message || 'Network error occurred while uploading proof.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Handle Ticket Generation or Viewing (Phase 6)
  const fetchTicketQr = async (ticketId) => {
    setTicketQrLoading(true);
    try {
      const token = localStorage.getItem('eventsync_token');
      const res = await fetch(getTicketQrUrl(ticketId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load QR');
      const blob = await res.blob();
      if (ticketQrBlobUrl) URL.revokeObjectURL(ticketQrBlobUrl);
      setTicketQrBlobUrl(URL.createObjectURL(blob));
    } catch (err) {
      setTicketQrBlobUrl('');
    } finally {
      setTicketQrLoading(false);
    }
  };

  const handleOpenTicketModal = async () => {
    if (!myRegistration) return;

    if (ticket) {
      setTicketModalOpen(true);
      fetchTicketQr(ticket._id);
      return;
    }

    setGeneratingTicket(true);
    try {
      const res = await createTicket(myRegistration._id);
      if (res.success && res.data) {
        setTicket(res.data);
        setTicketModalOpen(true);
        fetchTicketQr(res.data._id);
        setFeedback({
          type: 'success',
          message: 'Digital QR Ticket issued successfully!',
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Unable to generate digital ticket.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Network error occurred while generating digital ticket.',
      });
    } finally {
      setGeneratingTicket(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: '1rem' }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--accent-primary)' }} />
        <span style={{ color: 'var(--text-secondary)' }}>Retrieving event details from database...</span>
      </div>
    );
  }

  if (!event) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <Link to="/events" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={16} />
          <span>Back to All Events</span>
        </Link>
        <EmptyState
          icon={CalendarX}
          title="Event Not Found"
          description="The requested event does not exist in the database or has not been published yet."
          action={
            <Link to="/events">
              <Button variant="primary" size="md">
                Browse Campus Events
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const capacity = event.capacity;
  const availableSeats = event.availableSeats;
  const percentageClaimed = capacity > 0 ? Math.min(100, Math.max(0, Math.round(((capacity - availableSeats) / capacity) * 100))) : 0;
  const isFull = availableSeats <= 0;

  const displayDate = event.date
    ? (new Date(event.date).toString() !== 'Invalid Date' && (typeof event.date !== 'string' || event.date.includes('T'))
        ? new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : event.date)
    : 'TBA';

  const defaultGradient = 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)';

  const hasPosterData = Boolean(
    event &&
      event.poster &&
      (event.poster.filename ||
        event.poster.path ||
        event.poster.url ||
        (typeof event.poster === 'string' && event.poster.trim().length > 0))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Back Navigation & Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Link
          to="/events"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.88rem',
            color: 'var(--text-secondary)',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to All Events</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            icon={QrCode}
            onClick={() => setRegQrModalOpen(true)}
            title="View & Share Registration Link & QR"
          >
            Registration Link & QR
          </Button>

          {isAuthenticated && isStudent && (
            <Link to="/student/registrations" style={{ fontSize: '0.88rem', color: 'var(--accent-primary)', fontWeight: '600' }}>
              View My Registrations &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* User Action Feedback */}
      {feedback && (
        <Alert variant={feedback.type === 'success' ? 'success' : 'error'} onDismiss={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* Hero Poster Banner */}
      <div
        className="glass-panel"
        style={{
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          background: event.gradient || defaultGradient,
          padding: '3rem 2.5rem',
          position: 'relative',
          color: 'white',
        }}
      >
        {hasPosterData && !posterLoadError && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <img
              src={getEventPosterUrl(event._id)}
              alt={event.title}
              onError={() => setPosterLoadError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to right, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.8) 50%, rgba(15, 23, 42, 0.6) 100%)',
              }}
            />
          </div>
        )}

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(8px)',
              fontSize: '0.82rem',
              fontWeight: '600',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            {event.category || 'General'}
          </span>
          <span
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(16, 185, 129, 0.95)',
              fontSize: '0.82rem',
              fontWeight: '700',
              color: '#FFFFFF',
            }}
          >
            FREE ADMISSION
          </span>
          {(event.prizeMoney > 0 || event.firstPrize > 0 || event.secondPrize > 0 || event.thirdPrize > 0) && (
            <span
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                fontSize: '0.82rem',
                fontWeight: '700',
                color: '#FFFFFF',
              }}
            >
              🏆 ₹{Number(event.prizeMoney || (Number(event.firstPrize || 0) + Number(event.secondPrize || 0) + Number(event.thirdPrize || 0))).toLocaleString('en-IN')} Prize Pool
            </span>
          )}
          {myRegistration && (
            <span
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                background: attendance ? '#10B981' : '#10B981',
                fontSize: '0.82rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <CheckCircle2 size={14} />
              <span>{attendance ? 'ATTENDANCE VERIFIED (CHECKED IN ✓)' : 'CONFIRMED REGISTERED'}</span>
            </span>
          )}
        </div>

        <h1 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.75rem)', lineHeight: 1.2, marginBottom: '0.75rem' }}>
          {event.title}
        </h1>

        <p style={{ fontSize: '1rem', opacity: 0.9, maxWidth: '640px' }}>
          Campus Event &bull; Concurrency-Safe Live Seat Allocation
        </p>
        </div>
      </div>

      {/* Feature 1: Real-time Event Countdown */}
      <EventCountdown event={event} variant="full" />

      {/* Active Registration Notice Bar for Student */}
      {myRegistration && (
        <div
          className="glass-panel"
          style={{
            padding: '1.25rem 1.5rem',
            borderLeft: attendance ? '4px solid #10B981' : '4px solid #10B981',
            background: attendance ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle2 size={22} color="#10B981" />
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.96rem', color: '#34D399', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span>{attendance ? 'Attendance Verified — You are Checked In!' : 'You have a confirmed reservation for this event'}</span>
                {attendance && (
                  <span style={{ fontSize: '0.72rem', background: '#10B981', color: '#ffffff', padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-full)', fontWeight: '800' }}>
                    CHECKED IN ✓
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {attendance ? (
                  <>Venue entry verified on {new Date(attendance.checkedInAt).toLocaleDateString()} at {new Date(attendance.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                ) : (
                  <>Registered on {new Date(myRegistration.registeredAt || myRegistration.createdAt).toLocaleDateString()} at {new Date(myRegistration.registeredAt || myRegistration.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                )}
              </div>
            </div>
          </div>

          {!attendance && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelModalOpen(true)}
              style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#F87171' }}
            >
              Cancel Reservation
            </Button>
          )}
        </div>
      )}

      {/* Main Content Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '2rem' }}>
        {/* Left Column: Event Overview & Description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Feature: Dynamic Event Poster Display with fallback */}
          {hasPosterData && !posterLoadError ? (
            <div
              className="glass-panel"
              data-testid="event-poster"
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                borderRadius: 'var(--radius-xl)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ImageIcon size={18} color="var(--accent-primary, #6366F1)" />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>Official Event Poster</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Maximize2}
                  onClick={() => setPosterZoomOpen(true)}
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                >
                  Expand View
                </Button>
              </div>
              <div
                style={{
                  position: 'relative',
                  borderRadius: 'var(--radius-lg, 0.75rem)',
                  overflow: 'hidden',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  maxHeight: '440px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => setPosterZoomOpen(true)}
                title="Click to view full-size poster"
              >
                <img
                  src={getEventPosterUrl(event._id)}
                  alt={event.title}
                  onError={() => setPosterLoadError(true)}
                  style={{
                    width: '100%',
                    maxHeight: '440px',
                    objectFit: 'contain',
                    display: 'block',
                    borderRadius: 'var(--radius-lg, 0.75rem)',
                  }}
                />
              </div>
            </div>
          ) : (
            <div
              className="glass-panel"
              data-testid="no-poster-state"
              style={{
                padding: '1.5rem',
                borderRadius: 'var(--radius-xl)',
                background: 'rgba(15, 23, 42, 0.45)',
                border: '1px dashed rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: 'var(--radius-md, 0.5rem)',
                  background: 'rgba(148, 163, 184, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94A3B8',
                  flexShrink: 0,
                }}
              >
                <ImageOff size={22} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#E2E8F0' }}>
                  No poster available
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94A3B8)', marginTop: '0.15rem' }}>
                  Official campus event details and schedule are outlined below.
                </div>
              </div>
            </div>
          )}

          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '1rem' }}>About This Event</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.96rem', marginBottom: '1.5rem' }}>
              {event.description}
            </p>
          </div>

          {/* Prizes & Certification Availability */}
          <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} color="#F59E0B" />
              <span>Prizes & Certifications</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                }}
              >
                <div style={{ fontSize: '0.78rem', color: '#FBBF24', textTransform: 'uppercase', fontWeight: '600' }}>
                  Total Prize Pool
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#FFFFFF', marginTop: '0.25rem' }}>
                  {(event.prizeMoney > 0 || event.firstPrize > 0 || event.secondPrize > 0 || event.thirdPrize > 0)
                    ? `₹${Number(event.prizeMoney || ((Number(event.firstPrize) || 0) + (Number(event.secondPrize) || 0) + (Number(event.thirdPrize) || 0))).toLocaleString('en-IN')}`
                    : 'No prize money specified'}
                </div>
              </div>

              {(event.firstPrize > 0 || event.secondPrize > 0 || event.thirdPrize > 0) && (
                <>
                  {event.firstPrize > 0 && (
                    <div
                      style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.08) 100%)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', color: '#FCD34D', textTransform: 'uppercase', fontWeight: '700' }}>
                        🥇 1st Prize
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#FFFFFF', marginTop: '0.25rem' }}>
                        ₹{Number(event.firstPrize).toLocaleString('en-IN')}
                      </div>
                    </div>
                  )}
                  {event.secondPrize > 0 && (
                    <div
                      style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.15) 0%, rgba(100, 116, 139, 0.08) 100%)',
                        border: '1px solid rgba(148, 163, 184, 0.35)',
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', color: '#CBD5E1', textTransform: 'uppercase', fontWeight: '700' }}>
                        🥈 2nd Prize
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#FFFFFF', marginTop: '0.25rem' }}>
                        ₹{Number(event.secondPrize).toLocaleString('en-IN')}
                      </div>
                    </div>
                  )}
                  {event.thirdPrize > 0 && (
                    <div
                      style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.15) 0%, rgba(194, 65, 12, 0.08) 100%)',
                        border: '1px solid rgba(234, 88, 12, 0.35)',
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', color: '#FDBA74', textTransform: 'uppercase', fontWeight: '700' }}>
                        🥉 3rd Prize
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#FFFFFF', marginTop: '0.25rem' }}>
                        ₹{Number(event.thirdPrize).toLocaleString('en-IN')}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                <div style={{ fontSize: '0.78rem', color: '#34D399', textTransform: 'uppercase', fontWeight: '600' }}>
                  Participation Certificate
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#FFFFFF', marginTop: '0.35rem' }}>
                  {event.participationCertificateAvailable !== false
                    ? 'Participation Certificate: Available'
                    : 'Participation Certificate: Not Available'}
                </div>
              </div>
            </div>
          </div>

          {/* Event Leadership & Coordinators */}
          <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} color="var(--accent-primary)" />
              <span>Event Leadership & Coordinators</span>
            </h3>

            {/* Faculty Coordinator (No Phone Number) */}
            <div
              style={{
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(99, 102, 241, 0.08)',
                borderLeft: '4px solid #6366F1',
              }}
            >
              <div style={{ fontSize: '0.74rem', color: '#A5B4FC', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.04em' }}>
                FACULTY COORDINATOR
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#FFFFFF', marginTop: '0.2rem' }}>
                {event.facultyCoordinatorName || event.facultyCoordinator || 'Dr. K. Ramesh'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Faculty Coordinator oversee the event standards and academic verification.
              </div>
            </div>

            {/* Student Coordinators (Clickable Phone Links) */}
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.04em' }}>
                EVENT COORDINATORS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                {(Array.isArray(event.coordinators) && event.coordinators.length > 0
                  ? event.coordinators
                  : [
                      { coordinatorName: 'Priya', coordinatorPhone: '9876543210' },
                      { coordinatorName: 'Anusha', coordinatorPhone: '9876543211' },
                      { coordinatorName: 'Harika', coordinatorPhone: '9876543212' },
                    ]
                ).map((coord, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#F1F5F9' }}>
                      {idx + 1}. {coord.coordinatorName || coord.name}
                    </div>
                    {(coord.coordinatorPhone || coord.phone) && (
                      <div style={{ marginTop: '0.35rem' }}>
                        <a
                          href={`tel:${coord.coordinatorPhone || coord.phone}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            color: '#818CF8',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            textDecoration: 'none',
                          }}
                        >
                          <span>📞</span>
                          <span>{coord.coordinatorPhone || coord.phone}</span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>Registration & Attendance Rules</span>
            </h3>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>Atomic concurrency protection guarantees zero overbooking of seats.</li>
              <li>Every student may hold exactly one active reservation per event.</li>
              <li>Cancellations automatically and safely release seats back to the community.</li>
              <li>Digital Event Pass QR verifies check-in at the venue.</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Schedule Card & RSVP Action */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Registration Fee</span>
              <span style={{ fontSize: '1.6rem', fontWeight: '800', color: '#10B981' }}>
                Free
              </span>
            </div>

            {/* Seat Capacity Progress */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Live Seat Availability</span>
                <span style={{ fontWeight: '700', color: availableSeats <= 5 ? '#F87171' : '#34D399' }}>
                  {availableSeats} of {capacity} seats remaining
                </span>
              </div>
              <div className="event-seats-progress" style={{ height: '8px' }}>
                <div
                  className="event-seats-fill"
                  style={{
                    width: `${percentageClaimed}%`,
                    background: availableSeats <= 5 ? '#EF4444' : 'var(--gradient-brand)',
                  }}
                />
              </div>
            </div>

            {/* RSVP / Registration Interactive Action */}
            {checkingReg ? (
              <Button variant="secondary" size="lg" disabled style={{ width: '100%' }}>
                <Loader2 size={18} className="spin" />
                <span>Checking Registration Status...</span>
              </Button>
            ) : myRegistration ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {attendance ? (
                  <Button
                    variant="outline"
                    size="lg"
                    style={{
                      width: '100%',
                      borderColor: '#10B981',
                      color: '#34D399',
                      background: 'rgba(16, 185, 129, 0.15)',
                      cursor: 'default',
                      fontWeight: '700',
                    }}
                    icon={CheckCircle2}
                  >
                    CHECKED IN ✓ &bull; Admission Verified
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="lg"
                      style={{
                        width: '100%',
                        borderColor: '#10B981',
                        color: '#34D399',
                        background: 'rgba(16, 185, 129, 0.1)',
                        cursor: 'default',
                      }}
                      icon={CheckCircle2}
                    >
                      Seat Reserved
                    </Button>
                    <Button
                      variant="danger"
                      size="md"
                      style={{ width: '100%' }}
                      onClick={() => setCancelModalOpen(true)}
                      loading={submittingAction}
                    >
                      Cancel Registration
                    </Button>
                  </>
                )}

                {/* Post-Registration Digital Pass Passcode Card */}
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <QrCode size={16} color="var(--accent-primary)" />
                      <span>Digital Admission Pass</span>
                    </span>
                    <Badge variant={ticket ? 'success' : 'info'}>{ticket ? 'ACTIVE PASS' : 'READY'}</Badge>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {ticket
                      ? `Your ticket code is ${ticket.ticketCode}. Present your QR pass at the entrance gate for verified admission.`
                      : 'Your seat reservation is confirmed in MongoDB. View or generate your digital QR admission pass.'}
                  </p>
                  <Button
                    variant="primary"
                    size="md"
                    icon={QrCode}
                    onClick={handleOpenTicketModal}
                    loading={generatingTicket}
                    style={{ width: '100%', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                  >
                    {ticket ? 'View Digital Pass & QR' : 'Generate Digital QR Ticket'}
                  </Button>
                </div>
              </div>
            ) : isEventAdmin ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <Link to={`/events/${id}/register`} style={{ width: '100%', textDecoration: 'none' }}>
                  <Button
                    variant="primary"
                    size="lg"
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                    }}
                    icon={Sparkles}
                  >
                    Open Registration Page
                  </Button>
                </Link>
                <div style={{ padding: '0.4rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Viewing as <strong>EventAdmin</strong>
                </div>
              </div>
            ) : isFull ? (
              <Button
                variant="secondary"
                size="lg"
                disabled
                style={{ width: '100%', opacity: 0.6 }}
              >
                Event Full &bull; Capacity Reached
              </Button>
            ) : (
              <Link to={`/events/${id}/register`} style={{ width: '100%', textDecoration: 'none' }}>
                <Button
                  variant="primary"
                  size="lg"
                  style={{
                    width: '100%',
                    background: event.isPaid
                      ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                      : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                  }}
                  icon={Sparkles}
                >
                  REGISTER NOW
                </Button>
              </Link>
            )}
          </div>

          {/* Dedicated Registration QR & Link Section */}
          <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <QrCode size={18} color="var(--accent-primary)" />
                <span>Registration QR</span>
              </h3>
              <Badge variant="info">SCAN TO REGISTER</Badge>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                padding: '1.25rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  padding: '0.85rem',
                  background: '#FFFFFF',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                }}
              >
                <img
                  src={getEventRegistrationQrUrl(event._id)}
                  alt={`Registration QR for ${event.title}`}
                  style={{ width: '170px', height: '170px', display: 'block' }}
                />
              </div>

              <div style={{ textAlign: 'center', width: '100%' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  Scan to Register
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Registration Link:
                </div>
                <code
                  style={{
                    display: 'block',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '0.45rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    wordBreak: 'break-all',
                    color: 'var(--accent-cyan)',
                  }}
                >
                  {getEventRegistrationUrl(event._id)}
                </code>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', width: '100%', flexWrap: 'wrap' }}>
                <Link to={`/events/${event._id}/register`} style={{ flex: 1, minWidth: '130px', textDecoration: 'none' }}>
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
                      const url = getEventRegistrationUrl(event._id);
                      await navigator.clipboard.writeText(url);
                      setCopiedRegLink(true);
                      setTimeout(() => setCopiedRegLink(false), 2500);
                    } catch (e) {}
                  }}
                  style={{ flex: 1, minWidth: '130px' }}
                >
                  {copiedRegLink ? 'Copied!' : 'Copy Registration Link'}
                </Button>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Schedule & Venue</h3>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Feature: Small Event Date Calendar (~4cm x 4cm) */}
              <EventDateMiniCalendar event={event} />

              {/* Event Schedule Info */}
              <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <Calendar size={18} style={{ color: 'var(--accent-primary)', marginTop: '3px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.92rem' }}>Event Date</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>{displayDate}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <Clock size={18} style={{ color: 'var(--accent-secondary)', marginTop: '3px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.92rem' }}>Time Schedule</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>{event.time || 'TBA'}</div>
                  </div>
                </div>

                {event.registrationDeadline && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <Clock size={18} style={{ color: '#F59E0B', marginTop: '3px', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.92rem', color: '#FBBF24' }}>Registration Deadline</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                        {new Date(event.registrationDeadline).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <MapPin size={18} style={{ color: 'var(--accent-rose)', marginTop: '3px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.92rem' }}>Campus Venue</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>{event.venue || 'Campus Venue'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <Sparkles size={18} style={{ color: 'var(--accent-emerald)', marginTop: '3px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.92rem' }}>Mode & Category</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                      {event.mode || 'Offline'} &bull; {event.category || 'Technology'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancellation Confirmation Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel Event Reservation"
        subtitle="Seat Release Confirmation"
        maxWidth="480px"
        actions={
          <>
            <Button variant="secondary" onClick={() => setCancelModalOpen(false)} disabled={submittingAction}>
              Keep Reservation
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelRegistration}
              loading={submittingAction}
            >
              Confirm Cancellation
            </Button>
          </>
        }
      >
        <p style={{ lineHeight: 1.6 }}>
          Are you sure you want to cancel your reservation for <strong style={{ color: 'var(--text-primary)' }}>"{event.title}"</strong>?
        </p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
          Your seat will be released immediately and made available to other students.
        </p>
      </Modal>



      {/* Phase 6: Digital QR Ticket Modal */}
      <Modal
        isOpen={ticketModalOpen}
        onClose={() => {
          setTicketModalOpen(false);
          if (ticketQrBlobUrl) URL.revokeObjectURL(ticketQrBlobUrl);
          setTicketQrBlobUrl('');
        }}
        title="Digital Admission Ticket"
        subtitle={`Event: "${event.title}" • Pass Code: ${ticket?.ticketCode || ''}`}
        maxWidth="500px"
        actions={
          <>
            <Link to="/student/tickets">
              <Button variant="outline" size="sm">
                Open in My Tickets
              </Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                setTicketModalOpen(false);
                if (ticketQrBlobUrl) URL.revokeObjectURL(ticketQrBlobUrl);
                setTicketQrBlobUrl('');
              }}
            >
              Close
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
          <div
            style={{
              padding: '1.25rem',
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              border: '2px dashed #CBD5E1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '220px',
            }}
          >
            {ticketQrLoading ? (
              <div style={{ width: '200px', height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Loader2 size={24} className="spin" style={{ color: '#4F46E5' }} />
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Rendering Secure QR...</span>
              </div>
            ) : ticketQrBlobUrl ? (
              <img
                src={ticketQrBlobUrl}
                alt={`Ticket QR Code for ${ticket?.ticketCode}`}
                style={{ width: '200px', height: '200px', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                QR Unavailable
              </div>
            )}

            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                background: '#F1F5F9',
                fontSize: '0.95rem',
                fontFamily: 'monospace',
                fontWeight: '800',
                color: '#0F172A',
                letterSpacing: '0.05em',
              }}
            >
              {ticket?.ticketCode}
            </div>
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
              <Badge variant="success">ACTIVE</Badge>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Attendee:</span>
              <span style={{ fontWeight: '600' }}>{user?.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Date & Time:</span>
              <span>{displayDate} • {event.time}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Venue:</span>
              <span>{event.venue}</span>
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ShieldCheck size={14} color="var(--accent-emerald)" />
            <span>Present this QR pass at the gate for verified admission.</span>
          </div>
        </div>
      </Modal>

      {/* Registration QR & Link Modal */}
      {regQrModalOpen && (
        <Modal
          isOpen={regQrModalOpen}
          onClose={() => setRegQrModalOpen(false)}
          title="Event Registration QR Code & Link"
          subtitle={event.title}
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
                src={getEventRegistrationQrUrl(event._id)}
                alt={`Registration QR for ${event.title}`}
                style={{ width: '220px', height: '220px', display: 'block' }}
              />
            </div>

            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Scan to open the public registration page on any device
              </div>
              <code
                style={{
                  display: 'block',
                  background: 'var(--bg-tertiary)',
                  padding: '0.5rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  wordBreak: 'break-all',
                }}
              >
                {getEventRegistrationUrl(event._id)}
              </code>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem', width: '100%' }}>
              <Button
                variant="primary"
                size="sm"
                icon={copiedRegLink ? Check : Copy}
                onClick={async () => {
                  try {
                    const url = getEventRegistrationUrl(event._id);
                    await navigator.clipboard.writeText(url);
                    setCopiedRegLink(true);
                    setTimeout(() => setCopiedRegLink(false), 2500);
                  } catch (e) {}
                }}
                style={{ flex: 1 }}
              >
                {copiedRegLink ? 'Copied to Clipboard!' : 'Copy Registration Link'}
              </Button>

              <a
                href={getEventRegistrationQrUrl(event._id)}
                download={`registration_qr_${event.title.replace(/\s+/g, '_')}.png`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <Button variant="secondary" size="sm" icon={Download}>
                  Download QR
                </Button>
              </a>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              * This QR code leads directly to the Event Registration page. (Student ticket QR for gate check-in is issued post-registration).
            </div>
          </div>
        </Modal>
      )}

      {/* Event Poster Zoom Modal */}
      {posterZoomOpen && hasPosterData && !posterLoadError && (
        <Modal
          isOpen={posterZoomOpen}
          onClose={() => setPosterZoomOpen(false)}
          title={`Poster: ${event.title}`}
        >
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0.5rem' }}>
            <img
              src={getEventPosterUrl(event._id)}
              alt={event.title}
              style={{
                maxWidth: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: 'var(--radius-md, 0.5rem)',
              }}
            />
          </div>
        </Modal>
      )}

      {/* EventSync AI Assistant with Selected Event Context */}
      {isAuthenticated && (
        <ChatWidget eventId={id} eventContext={event} />
      )}
    </div>
  );
};
