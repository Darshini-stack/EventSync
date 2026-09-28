import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Users, ArrowRight, Sparkles, QrCode, Copy, Check } from 'lucide-react';
import { Button } from './common/Button';
import { Modal } from './common/Modal';
import { EventCountdown } from './EventCountdown';
import { getEventPosterUrl, getEventRegistrationQrUrl, getEventRegistrationUrl } from '../services/api';

export const EventCard = ({ event }) => {
  const eventId = event._id;
  const availableSeats = event.availableSeats;
  const capacity = event.capacity;
  const percentageSeatsClaimed = capacity > 0 ? Math.min(100, Math.max(0, Math.round(((capacity - availableSeats) / capacity) * 100))) : 0;
  const hasPoster = Boolean(event.poster && event.poster.filename);
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Format date if ISO or timestamp
  const displayDate = event.date 
    ? (new Date(event.date).toString() !== 'Invalid Date' && typeof event.date !== 'string' || event.date.includes('T')
        ? new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : event.date)
    : 'TBA';

  const defaultGradient = 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)';

  return (
    <div className="glass-panel event-card">
      {/* Event Poster Thumbnail */}
      <div
        className="event-poster-thumb"
        style={{
          background: event.gradient || defaultGradient,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {hasPoster ? (
          <img
            src={getEventPosterUrl(eventId)}
            alt={event.title}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
          >
            <Calendar size={28} />
          </div>
        )}

        {/* Badges Overlay */}
        <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '0.5rem', zIndex: 2 }}>
          <span
            style={{
              padding: '0.25rem 0.65rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(8px)',
              fontSize: '0.74rem',
              fontWeight: '600',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            {event.category || 'General'}
          </span>
          <span
            style={{
              padding: '0.25rem 0.65rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(16, 185, 129, 0.95)',
              fontSize: '0.74rem',
              fontWeight: '700',
              color: 'white',
            }}
          >
            FREE
          </span>
          {event.prizeMoney > 0 && (
            <span
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                fontSize: '0.74rem',
                fontWeight: '700',
                color: 'white',
              }}
            >
              ₹{Number(event.prizeMoney).toLocaleString('en-IN')}
            </span>
          )}
          {event.participationCertificateAvailable !== false && (
            <span
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(99, 102, 241, 0.85)',
                fontSize: '0.74rem',
                fontWeight: '600',
                color: 'white',
              }}
            >
              Certificate
            </span>
          )}
        </div>
      </div>

      {/* Card Content Body */}
      <div className="event-card-body">
        <div style={{ marginBottom: '0.45rem' }}>
          <EventCountdown event={event} variant="compact" />
        </div>
        <h3 className="event-title">{event.title}</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '0.25rem 0' }}>
          <div className="event-meta-row">
            <Calendar size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span>{displayDate}</span>
          </div>
          <div className="event-meta-row">
            <Clock size={14} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
            <span>{event.time || 'TBA'}</span>
          </div>
          <div className="event-meta-row">
            <MapPin size={14} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.venue || 'Campus Venue'}</span>
          </div>
        </div>

        {/* Seat Availability Meter */}
        <div style={{ marginTop: 'auto', paddingTop: '0.65rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Users size={13} />
              <span>Available Seats</span>
            </span>
            <span style={{ fontWeight: '700', color: availableSeats <= 5 ? '#F87171' : '#34D399' }}>
              {availableSeats} of {capacity} left
            </span>
          </div>

          <div className="event-seats-progress">
            <div
              className="event-seats-fill"
              style={{
                width: `${percentageSeatsClaimed}%`,
                background: availableSeats <= 5 ? '#EF4444' : 'var(--gradient-brand)',
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ paddingTop: '0.85rem', display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
          <Link to={`/events/${eventId}`} style={{ flex: 1, textDecoration: 'none' }}>
            <Button variant="secondary" size="sm" style={{ width: '100%' }}>
              Details
            </Button>
          </Link>
          <Link to={`/events/${eventId}/register`} style={{ flex: 1, textDecoration: 'none' }}>
            <Button variant="primary" size="sm" style={{ width: '100%' }}>
              Register
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            icon={QrCode}
            onClick={() => setQrOpen(true)}
            title="View Registration QR"
            style={{ padding: '0.45rem 0.65rem' }}
          />
        </div>
      </div>

      {/* Registration QR Modal */}
      {qrOpen && (
        <Modal
          isOpen={qrOpen}
          onClose={() => {
            setQrOpen(false);
            setCopied(false);
          }}
          title="Event Registration QR & Link"
          subtitle={event.title}
          maxWidth="460px"
          actions={
            <Button variant="secondary" onClick={() => { setQrOpen(false); setCopied(false); }}>
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
                src={getEventRegistrationQrUrl(eventId)}
                alt={`Registration QR for ${event.title}`}
                style={{ width: '190px', height: '190px', display: 'block' }}
              />
            </div>

            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                Scan to Register
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Registration Link:
              </div>
              <code
                style={{
                  display: 'block',
                  background: 'var(--bg-tertiary)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  wordBreak: 'break-all',
                  color: 'var(--accent-cyan)',
                }}
              >
                {getEventRegistrationUrl(eventId)}
              </code>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem', width: '100%' }}>
              <Link to={`/events/${eventId}/register`} style={{ flex: 1, textDecoration: 'none' }}>
                <Button variant="primary" size="sm" style={{ width: '100%' }}>
                  Open Registration Page
                </Button>
              </Link>
              <Button
                variant="secondary"
                size="sm"
                icon={copied ? Check : Copy}
                onClick={async () => {
                  try {
                    const url = getEventRegistrationUrl(eventId);
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  } catch (e) {}
                }}
                style={{ flex: 1 }}
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
