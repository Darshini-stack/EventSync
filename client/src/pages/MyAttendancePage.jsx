import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  QrCode,
  ArrowLeft,
  RefreshCw,
  Ticket,
  ShieldCheck,
  Compass,
  AlertCircle
} from 'lucide-react';
import { fetchMyAttendance, fetchMyRegistrations } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';

export const MyAttendancePage = () => {
  const { user } = useAuth();
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAttendance = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await fetchMyAttendance();
      if (res.success && Array.isArray(res.data)) {
        setAttendances(res.data);
      } else {
        setAttendances([]);
      }
    } catch (err) {
      setAttendances([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAttendance();

    const socket = getSocket();
    const handleUpdate = () => {
      loadAttendance(true);
    };

    socket.on('attendance_checked_in', handleUpdate);

    return () => {
      socket.off('attendance_checked_in', handleUpdate);
    };
  }, [loadAttendance]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header & Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Link
          to="/student/dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Student Portal</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => loadAttendance()}
            loading={refreshing}
          >
            Refresh
          </Button>
          <Link to="/student/registrations">
            <Button variant="outline" size="sm">
              My Registrations
            </Button>
          </Link>
          <Link to="/student/tickets">
            <Button variant="primary" size="sm" icon={QrCode}>
              My Tickets
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero Card */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)',
            }}
          >
            <CheckCircle2 size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>My Event Attendance Record</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              Official verified record of campus event admissions confirmed via Student Ticket QR gate check-in.
            </p>
          </div>
        </div>
      </div>

      {/* Attendance Records List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Verified Event Check-Ins</h2>
          {attendances.length > 0 && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Total Verified: <strong>{attendances.length}</strong> events
            </span>
          )}
        </div>

        {loading ? (
          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <LoadingSkeleton height="120px" />
          </div>
        ) : attendances.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No attendance records yet"
            description="When you attend campus events and an EventAdmin scans your Student Ticket QR pass at the entrance, verified attendance records will appear here."
            action={
              <Link to="/events">
                <Button variant="primary" size="md" icon={Compass}>
                  Browse Campus Events
                </Button>
              </Link>
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {attendances.map((att) => {
              const event = att.event || {};
              const ticket = att.ticket || {};
              const checkedInTime = att.checkedInAt
                ? new Date(att.checkedInAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recently';

              const eventDate = event.date
                ? new Date(event.date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'TBA';

              return (
                <div
                  key={att._id}
                  className="glass-panel"
                  style={{
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    borderLeft: '4px solid #10B981',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>
                          {event.title || 'Campus Event'}
                        </h3>
                        {event.category && (
                          <span
                            style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: 'var(--radius-full)',
                              background: 'var(--bg-tertiary)',
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {event.category}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        EventSync Verified Admission Record &bull; Record ID: {att._id}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Badge variant="success" style={{ background: '#10B981', color: 'white', fontWeight: '800' }}>
                        CHECKED IN ✓
                      </Badge>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '1rem',
                      background: 'var(--bg-tertiary)',
                      padding: '1.1rem 1.25rem',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Check-in Verified Timestamp</div>
                      <div style={{ fontWeight: '700', fontSize: '0.92rem', color: '#10B981' }}>
                        {checkedInTime}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gate Admission Verified By</div>
                      <div style={{ fontWeight: '600', fontSize: '0.88rem' }}>
                        {att.checkedInBy?.name || 'Campus EventAdmin'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Scanned Ticket Code</div>
                      <div style={{ fontWeight: '700', fontSize: '0.88rem', fontFamily: 'monospace' }}>
                        {ticket.ticketCode || 'Verified Ticket'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Event Date & Venue</div>
                      <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                        {eventDate} &bull; {event.venue || 'Campus Venue'}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
                    {event._id && (
                      <Link to={`/events/${event._id}`}>
                        <Button variant="outline" size="sm">
                          View Event Details
                        </Button>
                      </Link>
                    )}
                    <Link to="/student/tickets">
                      <Button variant="secondary" size="sm" icon={Ticket}>
                        View Ticket Pass
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
