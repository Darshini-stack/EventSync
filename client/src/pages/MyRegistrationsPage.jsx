import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Compass,
  AlertCircle,
  RefreshCw,
  Trash2,
  Loader2,
  CreditCard,
  Upload,
  AlertTriangle,
  QrCode,
  ExternalLink,
  ShieldCheck,
  Ticket
} from 'lucide-react';
import { 
  fetchMyRegistrations, 
  cancelRegistration, 
  fetchMyTickets,
  createTicket,
  fetchMyAttendance,
  getEventPosterUrl
} from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Alert } from '../components/common/Alert';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { DigitalEventPassModal } from '../components/DigitalEventPassModal';

export const MyRegistrationsPage = () => {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedReg, setSelectedReg] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [generatingTicketId, setGeneratingTicketId] = useState(null);

  // Tab filter: 'ALL' | 'ACTIVE' | 'CANCELLED'
  const [activeTab, setActiveTab] = useState('ALL');

  // Digital Pass Modal State
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [selectedRegForPass, setSelectedRegForPass] = useState(null);

  const loadRegistrations = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const [regRes, ticketRes, attRes] = await Promise.all([
        fetchMyRegistrations(),
        fetchMyTickets(),
        fetchMyAttendance(),
      ]);

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
    } catch (err) {
      setRegistrations([]);
      setTickets([]);
      setAttendances([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRegistrations();

    const socket = getSocket();
    const handleUpdate = () => {
      loadRegistrations(true);
    };

    socket.on('registration_created', handleUpdate);
    socket.on('registration_cancelled', handleUpdate);
    socket.on('event_updated', handleUpdate);
    socket.on('payment_status_updated', handleUpdate);
    socket.on('ticket_issued', handleUpdate);
    socket.on('attendance_checked_in', handleUpdate);

    return () => {
      socket.off('registration_created', handleUpdate);
      socket.off('registration_cancelled', handleUpdate);
      socket.off('event_updated', handleUpdate);
      socket.off('payment_status_updated', handleUpdate);
      socket.off('ticket_issued', handleUpdate);
      socket.off('attendance_checked_in', handleUpdate);
    };
  }, [loadRegistrations]);

  const handleGenerateTicket = async (registrationId) => {
    setGeneratingTicketId(registrationId);
    setFeedback(null);
    try {
      const res = await createTicket(registrationId);
      if (res.success && res.data) {
        setFeedback({
          type: 'success',
          message: 'Digital QR Ticket successfully issued! You can view it in My Tickets.',
        });
        await loadRegistrations(true);
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Unable to generate ticket.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Network error occurred while generating digital ticket.',
      });
    } finally {
      setGeneratingTicketId(null);
    }
  };

  const handleOpenCancelModal = (reg) => {
    setSelectedReg(reg);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedReg) return;
    setCancelling(true);
    setFeedback(null);
    try {
      const res = await cancelRegistration(selectedReg._id);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Registration for "${selectedReg.event?.title || 'event'}" has been cancelled. Available seat restored.`,
        });
        setCancelModalOpen(false);
        setSelectedReg(null);
        await loadRegistrations(true);
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
      setCancelling(false);
    }
  };

  const activeRegistrations = registrations.filter((r) => r.status === 'REGISTERED');
  const cancelledRegistrations = registrations.filter((r) => r.status === 'CANCELLED');

  const displayedRegistrations =
    activeTab === 'ACTIVE'
      ? activeRegistrations
      : activeTab === 'CANCELLED'
      ? cancelledRegistrations
      : registrations;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header & Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Link
          to="/student/dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Student Portal</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => loadRegistrations()}
            loading={refreshing}
          >
            Refresh
          </Button>
          <Link to="/student/dashboard">
            <Button variant="primary" size="sm" icon={QrCode}>
              Digital Event Passes
            </Button>
          </Link>
        </div>
      </div>

      {/* Page Title & Intro */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)',
            }}
          >
            <Calendar size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>My Event Registrations</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              Track all campus event seat reservations, view payment verification status, and generate admission passes.
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <Alert
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Tab Navigation: All vs Active vs Cancelled */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('ALL')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: activeTab === 'ALL' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'ALL' ? '#FFFFFF' : 'var(--text-secondary)',
            border: 'none',
            fontWeight: '700',
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          All Registrations ({registrations.length})
        </button>
        <button
          onClick={() => setActiveTab('ACTIVE')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: activeTab === 'ACTIVE' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'ACTIVE' ? '#FFFFFF' : 'var(--text-secondary)',
            border: 'none',
            fontWeight: '700',
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          Active Confirmed ({activeRegistrations.length})
        </button>
        <button
          onClick={() => setActiveTab('CANCELLED')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: activeTab === 'CANCELLED' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'CANCELLED' ? '#FFFFFF' : 'var(--text-secondary)',
            border: 'none',
            fontWeight: '700',
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          Cancelled ({cancelledRegistrations.length})
        </button>
      </div>

      {/* Registrations List */}
      <div>
        {loading ? (
          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <LoadingSkeleton height="120px" />
          </div>
        ) : displayedRegistrations.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={activeTab === 'CANCELLED' ? 'No cancelled registrations' : 'No registrations found'}
            description={
              activeTab === 'CANCELLED'
                ? 'You have not cancelled any event registrations.'
                : "You haven't registered for any campus events yet. Explore upcoming hackathons, tech workshops, and sports tournaments."
            }
            action={
              activeTab !== 'CANCELLED' && (
                <Link to="/events">
                  <Button variant="primary" size="md" icon={Compass}>
                    Browse Campus Events
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {displayedRegistrations.map((reg) => {
              const event = reg.event;
              const eventTitle = event ? event.title : 'Event details unavailable';
              const isRegistered = reg.status === 'REGISTERED';
              const isCancelled = reg.status === 'CANCELLED';

              const displayDate = event && event.date
                ? new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : 'TBA';
              const registeredDate = reg.registeredAt || reg.createdAt
                ? new Date(reg.registeredAt || reg.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Recently';

              const isCheckedIn = attendances.some(
                (a) =>
                  (a.registration && (a.registration._id === reg._id || a.registration === reg._id)) ||
                  (a.event && event && (a.event._id === event._id || a.event === event._id))
              );

              const regTicket = tickets.find(
                (t) => (t.registration && (t.registration._id === reg._id || t.registration === reg._id)) && t.status === 'ACTIVE'
              );

              const isTicketEligible = isRegistered;
              const hasPoster = Boolean(event && event.poster && event.poster.filename);

              return (
                <div
                  key={reg._id}
                  className="glass-panel"
                  style={{
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    borderLeft: isCheckedIn
                      ? '4px solid #10B981'
                      : isRegistered
                      ? '4px solid #6366F1'
                      : '4px solid #9CA3AF',
                    opacity: isRegistered ? 1 : 0.75,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                      {/* Poster Thumbnail */}
                      {event && (
                        <div
                          style={{
                            width: '72px',
                            height: '72px',
                            borderRadius: 'var(--radius-lg)',
                            background: event.gradient || 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                            overflow: 'hidden',
                            position: 'relative',
                            flexShrink: 0,
                          }}
                        >
                          {hasPoster && (
                            <img
                              src={getEventPosterUrl(event._id)}
                              alt={eventTitle}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          )}
                        </div>
                      )}

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                          <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>{eventTitle}</h3>
                          
                          <Badge variant={isRegistered ? 'success' : 'neutral'} dot={isRegistered}>
                            {reg.status}
                          </Badge>

                          {isCheckedIn && (
                            <Badge variant="success" style={{ background: '#10B981', color: 'white', fontWeight: '800' }}>
                              CHECKED IN ✓
                            </Badge>
                          )}

                          {event && <Badge variant="info">{event.category}</Badge>}

                          {event && (
                            <Badge variant={event.isPaid ? 'warning' : 'success'}>
                              {event.isPaid ? `₹${event.fee}` : 'FREE'}
                            </Badge>
                          )}

                        </div>

                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          Reserved on {registeredDate} &bull; Confirmation ID: {reg.registrationCode || reg._id}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {/* View Digital Event Pass */}
                      {isRegistered && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={QrCode}
                          onClick={() => {
                            setSelectedRegForPass(reg);
                            setPassModalOpen(true);
                          }}
                          style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                        >
                          Digital Event Pass
                        </Button>
                      )}

                      {/* View Event Details */}
                      {event && (
                        <Link to={`/events/${event._id || event}`}>
                          <Button variant="outline" size="sm">
                            View Event
                          </Button>
                        </Link>
                      )}

                      {/* Cancel Active Registration */}
                      {isRegistered && (
                        <Button
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleOpenCancelModal(reg)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Event Schedule Footer */}
                  {event && (
                    <div
                      style={{
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: '0.75rem',
                        display: 'flex',
                        gap: '1.5rem',
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Calendar size={14} style={{ color: 'var(--accent-primary)' }} />
                        <span>{displayDate}</span>
                      </span>

                      {event.time && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Clock size={14} style={{ color: 'var(--accent-secondary)' }} />
                          <span>{event.time}</span>
                        </span>
                      )}

                      {event.venue && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <MapPin size={14} style={{ color: 'var(--accent-rose)' }} />
                          <span>{event.venue}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancellation Confirmation Modal */}
      {cancelModalOpen && selectedReg && (
        <Modal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          title="Confirm Registration Cancellation"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Are you sure you want to cancel your seat reservation for{' '}
              <strong>"{selectedReg.event?.title || 'this event'}"</strong>?
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Your reserved seat will be immediately returned to the campus event capacity for other students. Any active ticket will be cancelled.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setCancelModalOpen(false)}>
                Keep Reservation
              </Button>
              <Button variant="danger" loading={cancelling} onClick={handleConfirmCancel}>
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Digital Event Pass Modal (Requirements 9, 27) */}
      {selectedRegForPass && (
        <DigitalEventPassModal
          isOpen={passModalOpen}
          onClose={() => {
            setPassModalOpen(false);
            setSelectedRegForPass(null);
          }}
          pass={tickets.find(t => (t.registration && (t.registration === selectedRegForPass._id || t.registration?._id === selectedRegForPass._id)))}
          registration={selectedRegForPass}
          event={selectedRegForPass.event}
        />
      )}
    </div>
  );
};
