import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode,
  Calendar,
  Clock,
  MapPin,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Download,
  AlertCircle,
  Compass,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { fetchMyTickets, getTicketQrUrl, fetchMyAttendance } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { Alert } from '../components/common/Alert';

// Individual Digital Ticket Card Component
const DigitalTicketCard = ({ ticket, attendance = null }) => {
  const [qrBlobUrl, setQrBlobUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState(false);
  const [copiedPassCode, setCopiedPassCode] = useState(false);

  const passCodeToDisplay = ticket.passCode || ticket.ticketCode || '';

  const handleCopyPassCode = () => {
    if (!passCodeToDisplay) return;
    navigator.clipboard.writeText(passCodeToDisplay);
    setCopiedPassCode(true);
    setTimeout(() => setCopiedPassCode(false), 2000);
  };

  useEffect(() => {
    let active = true;
    const fetchQr = async () => {
      setQrLoading(true);
      setQrError(false);
      try {
        const token = localStorage.getItem('eventsync_token');
        const res = await fetch(getTicketQrUrl(ticket._id), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) throw new Error('Failed to load QR');

        const blob = await res.blob();
        if (active) {
          const url = URL.createObjectURL(blob);
          setQrBlobUrl(url);
        }
      } catch (err) {
        if (active) setQrError(true);
      } finally {
        if (active) setQrLoading(false);
      }
    };

    fetchQr();

    return () => {
      active = false;
      if (qrBlobUrl) URL.revokeObjectURL(qrBlobUrl);
    };
  }, [ticket._id]);

  const event = ticket.event || {};
  const isActive = ticket.status === 'ACTIVE';
  const displayDate = event.date
    ? new Date(event.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'TBA';
  const issuedDate = ticket.issuedAt
    ? new Date(ticket.issuedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Recently';

  const defaultGradient = 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)';

  const handleDownloadTicket = async () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const width = 600;
      const height = 750;
      canvas.width = width;
      canvas.height = height;

      // Dark gradient background
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#0F172A');
      bgGrad.addColorStop(1, '#1E293B');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Top glowing bar
      const barGrad = ctx.createLinearGradient(0, 0, width, 0);
      barGrad.addColorStop(0, '#6366F1');
      barGrad.addColorStop(0.5, '#10B981');
      barGrad.addColorStop(1, '#EC4899');
      ctx.fillStyle = barGrad;
      ctx.fillRect(0, 0, width, 6);

      // Header
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('EVENTSYNC OFFICIAL ADMISSION TICKET', 36, 45);

      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(ticket.ticketCode || 'PASS', width - 36, 45);
      ctx.textAlign = 'left';

      // Event title
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText(event.title || 'Event', 36, 85);

      // Details
      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('VENUE', 36, 125);
      ctx.fillText('DATE & TIME', 280, 125);

      ctx.fillStyle = '#F1F5F9';
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillText(event.venue || 'Campus Venue', 36, 150);
      ctx.fillText(`${displayDate} • ${event.time || 'Scheduled'}`, 280, 150);

      // Draw QR Box
      const qrBoxX = 160;
      const qrBoxY = 190;
      const qrBoxSize = 280;
      ctx.fillStyle = '#FFFFFF';
      if (ctx.roundRect) ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize + 50, 12);
      else ctx.rect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize + 50);
      ctx.fill();

      if (qrBlobUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = qrBlobUrl;
        });
        ctx.drawImage(img, qrBoxX + 15, qrBoxY + 15, 250, 250);
      }

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SCAN FOR GATE CHECK-IN', qrBoxX + qrBoxSize / 2, qrBoxY + 295);
      ctx.textAlign = 'left';

      // Watermark
      ctx.fillStyle = '#64748B';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('EventSync Smart Pass System • Verified Ticket', 36, height - 30);

      canvas.toBlob((blob) => {
        if (!blob) throw new Error('Canvas export failed');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `EventSync-Ticket-${ticket.ticketCode || 'PASS'}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (e) {
      if (qrBlobUrl) {
        const a = document.createElement('a');
        a.href = qrBlobUrl;
        a.download = `EventSync-QR-${ticket.ticketCode}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  };

  return (
    <div
      className="glass-panel"
      style={{
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        border: isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        opacity: isActive ? 1 : 0.7,
        boxShadow: isActive ? '0 10px 30px rgba(0, 0, 0, 0.25)' : 'none',
      }}
    >
      {/* Top Banner with event theme */}
      <div
        style={{
          background: event.gradient || defaultGradient,
          padding: '1.5rem',
          color: 'white',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(0, 0, 0, 0.4)',
                fontSize: '0.78rem',
                fontWeight: '600',
              }}
            >
              {event.category || 'Campus Event'}
            </span>
            <span
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                background: event.isPaid ? 'rgba(245, 158, 11, 0.9)' : 'rgba(16, 185, 129, 0.9)',
                fontSize: '0.78rem',
                fontWeight: '700',
              }}
            >
              {event.isPaid ? `PAID PASS • ₹${event.fee}` : 'FREE PASS'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {attendance ? (
              <Badge variant="success" style={{ background: '#10B981', color: '#FFFFFF', fontWeight: '800' }}>
                CHECKED IN ✓
              </Badge>
            ) : (
              <Badge variant={isActive ? 'success' : 'neutral'} dot={isActive}>
                {ticket.status}
              </Badge>
            )}
          </div>
        </div>

        <h3 style={{ fontSize: '1.35rem', fontWeight: '800', lineHeight: 1.25, marginBottom: '0.25rem' }}>
          {event.title || 'Event Title'}
        </h3>
        <p style={{ fontSize: '0.82rem', opacity: 0.9 }}>
          Official EventSync Verified Admission Ticket
        </p>
      </div>

      {/* Ticket Details & QR Code Section */}
      <div
        style={{
          padding: '1.75rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.75rem',
          alignItems: 'center',
          background: 'var(--bg-secondary)',
        }}
      >
        {/* QR Code Container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            background: '#FFFFFF',
            border: '2px dashed #E2E8F0',
            maxWidth: '240px',
            margin: '0 auto',
          }}
        >
          {qrLoading ? (
            <div style={{ width: '180px', height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Loader2 size={24} className="spin" style={{ color: '#4F46E5' }} />
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Generating QR...</span>
            </div>
          ) : qrError || !qrBlobUrl ? (
            <div style={{ width: '180px', height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#EF4444' }}>
              <AlertCircle size={24} />
              <span style={{ fontSize: '0.75rem' }}>QR unavailable</span>
            </div>
          ) : (
            <img
              src={qrBlobUrl}
              alt={`QR Code for ${ticket.ticketCode}`}
              style={{ width: '180px', height: '180px', objectFit: 'contain' }}
            />
          )}

          <div
            style={{
              marginTop: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.35rem',
              width: '100%',
            }}
          >
            <div
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                background: '#F1F5F9',
                fontSize: '0.88rem',
                fontFamily: 'monospace',
                fontWeight: '800',
                color: '#0F172A',
                letterSpacing: '0.05em',
                textAlign: 'center',
                width: '100%',
              }}
            >
              {passCodeToDisplay}
            </div>
            <button
              type="button"
              onClick={handleCopyPassCode}
              style={{
                background: copiedPassCode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                border: copiedPassCode ? '1px solid #10B981' : '1px solid rgba(99, 102, 241, 0.3)',
                color: copiedPassCode ? '#10B981' : '#4F46E5',
                fontSize: '0.72rem',
                fontWeight: '700',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                transition: 'all 0.2s ease',
              }}
              title="Copy Pass Code"
            >
              {copiedPassCode ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedPassCode ? 'Copied!' : 'Copy Pass Code'}</span>
            </button>
          </div>
        </div>

        {/* Schedule & Venue Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <Calendar size={18} style={{ color: 'var(--accent-primary)', marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Date</div>
              <div style={{ fontWeight: '700', fontSize: '0.92rem' }}>{displayDate}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <Clock size={18} style={{ color: 'var(--accent-secondary)', marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Time</div>
              <div style={{ fontWeight: '700', fontSize: '0.92rem' }}>{event.time || 'TBA'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <MapPin size={18} style={{ color: 'var(--accent-rose)', marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Venue</div>
              <div style={{ fontWeight: '700', fontSize: '0.92rem' }}>{event.venue || 'Campus Venue'}</div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Issued on: <strong>{issuedDate}</strong>
          </div>

          {attendance && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#10B981',
                fontSize: '0.84rem',
                fontWeight: '600',
                padding: '0.5rem 0.75rem',
                background: 'rgba(16, 185, 129, 0.1)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
            >
              <CheckCircle2 size={16} />
              <span>
                Verified Check-In:{' '}
                {new Date(attendance.checkedInAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}

          {event._id && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                onClick={handleDownloadTicket}
                style={{ flex: 1, minWidth: '130px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
              >
                Download Ticket
              </Button>
              <Link to={`/events/${event._id}`} style={{ flex: 1, minWidth: '130px' }}>
                <Button variant="outline" size="sm" icon={ExternalLink} style={{ width: '100%' }}>
                  View Event Page
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Ticket Footer Security Note */}
      <div
        style={{
          padding: '0.85rem 1.5rem',
          background: 'var(--bg-tertiary)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ShieldCheck size={14} color="var(--accent-emerald)" />
          <span>Show this digital QR pass at the venue entrance gate for verified check-in.</span>
        </span>
        <span style={{ fontWeight: '600' }}>EventSync Digital Pass</span>
      </div>
    </div>
  );
};

export const MyTicketsPage = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadTickets = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const [ticketRes, attRes] = await Promise.all([
        fetchMyTickets(),
        fetchMyAttendance(),
      ]);

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
      setTickets([]);
      setAttendances([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();

    const socket = getSocket();
    const handleUpdate = () => {
      loadTickets(true);
    };

    socket.on('ticket_issued', handleUpdate);
    socket.on('registration_cancelled', handleUpdate);
    socket.on('attendance_checked_in', handleUpdate);

    return () => {
      socket.off('ticket_issued', handleUpdate);
      socket.off('registration_cancelled', handleUpdate);
      socket.off('attendance_checked_in', handleUpdate);
    };
  }, [loadTickets]);

  const activeTickets = tickets.filter((t) => t.status === 'ACTIVE');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Header & Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Link to="/student/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          <ArrowLeft size={16} />
          <span>Return to Dashboard</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Badge variant="success" dot>Student Passes</Badge>
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => loadTickets(false)}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Header Banner */}
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <QrCode size={30} color="var(--accent-primary)" />
          <span>My Digital Event Tickets</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Present these official digital passes with unique QR codes at campus gates for verified event entry.
        </p>
      </div>

      {feedback && (
        <Alert variant={feedback.type === 'success' ? 'success' : 'error'} onDismiss={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* Tickets Grid */}
      <div>
        {loading ? (
          <div className="grid-cards">
            <div className="glass-panel" style={{ padding: '1.5rem' }}><LoadingSkeleton height="260px" /></div>
            <div className="glass-panel" style={{ padding: '1.5rem' }}><LoadingSkeleton height="260px" /></div>
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={QrCode}
            title="No digital tickets yet"
            description="You do not have any active event tickets. Register for free campus events or complete admission verification for paid events to unlock your tickets."
            action={
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link to="/events">
                  <Button variant="primary" size="md" icon={Compass}>
                    Browse Campus Events
                  </Button>
                </Link>
                <Link to="/student/registrations">
                  <Button variant="secondary" size="md">
                    View My Registrations
                  </Button>
                </Link>
              </div>
            }
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.75rem' }}>
            {tickets.map((ticket) => {
              const matchedAtt = attendances.find(
                (a) =>
                  (a.ticket && (a.ticket._id === ticket._id || a.ticket === ticket._id)) ||
                  (a.registration &&
                    (a.registration._id === ticket.registration || a.registration === ticket.registration))
              );
              return (
                <DigitalTicketCard
                  key={ticket._id}
                  ticket={ticket}
                  attendance={matchedAtt}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
