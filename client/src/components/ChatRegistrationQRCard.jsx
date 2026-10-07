import React, { useState } from 'react';
import { QrCode, Download, ExternalLink, Check, Calendar, MapPin, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * ChatRegistrationQRCard
 * Renders the official EventSync event registration QR code inside the chat stream.
 *
 * Guarantees:
 * - Real live event registration URL / QR code data URL from MongoDB
 * - One-click "Open Registration Page" leading directly to the authentic registration flow
 * - One-click QR code image download
 * - No fake or simulated QR codes
 */
export const ChatRegistrationQRCard = ({ card }) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const {
    eventId,
    eventTitle = 'Campus Event',
    registrationUrl,
    dataUrl,
    qrDataUrl,
    venue,
    date,
    time,
    category,
    message,
  } = card || {};

  const effectiveQrUrl = dataUrl || qrDataUrl;

  const handleDownloadQR = () => {
    if (!effectiveQrUrl) return;

    try {
      const link = document.createElement('a');
      link.href = effectiveQrUrl;
      const cleanTitle = (eventTitle || 'event')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      link.download = `EventSync-${cleanTitle}-registration-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (e) {
      console.warn('[ChatRegistrationQRCard] Download failed:', e);
    }
  };

  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div
      className="chat-registration-qr-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        maxWidth: '100%',
        marginTop: '0.25rem',
      }}
    >
      {/* Intro message */}
      {message && (
        <div style={{ fontSize: '0.88rem', color: '#E2E8F0', lineHeight: 1.5 }}>
          {message}
        </div>
      )}

      {/* Main QR Card Container */}
      <div
        style={{
          borderRadius: '1rem',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 16px rgba(99, 102, 241, 0.15)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        {/* Header Tag */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}
            >
              <QrCode size={14} />
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#C7D2FE', letterSpacing: '0.02em' }}>
              OFFICIAL REGISTRATION QR
            </span>
          </div>

          {category && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: '600',
                color: '#94A3B8',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '0.15rem 0.5rem',
                borderRadius: '0.35rem',
              }}
            >
              {category}
            </span>
          )}
        </div>

        {/* Event Title */}
        <div style={{ textAlign: 'center', width: '100%' }}>
          <h4
            style={{
              margin: '0 0 0.35rem 0',
              fontSize: '1.15rem',
              fontWeight: '800',
              color: '#F8FAFC',
              letterSpacing: '-0.01em',
            }}
          >
            {eventTitle}
          </h4>

          {/* Metadata badges */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '0.6rem',
              fontSize: '0.76rem',
              color: '#94A3B8',
            }}
          >
            {formattedDate && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Calendar size={12} style={{ color: '#818CF8' }} />
                <span>{formattedDate}{time ? ` (${time})` : ''}</span>
              </span>
            )}
            {venue && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <MapPin size={12} style={{ color: '#EC4899' }} />
                <span>{venue}</span>
              </span>
            )}
          </div>
        </div>

        {/* QR Code Container */}
        <div
          style={{
            background: '#FFFFFF',
            padding: '0.85rem',
            borderRadius: '0.85rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {effectiveQrUrl ? (
            <img
              src={effectiveQrUrl}
              alt={`Registration QR Code for ${eventTitle}`}
              style={{
                width: '180px',
                height: '180px',
                display: 'block',
                borderRadius: '0.4rem',
              }}
            />
          ) : (
            <div
              style={{
                width: '180px',
                height: '180px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748B',
                fontSize: '0.8rem',
              }}
            >
              Generating QR...
            </div>
          )}

          <div
            style={{
              marginTop: '0.5rem',
              fontSize: '0.72rem',
              fontWeight: '700',
              color: '#475569',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Scan with camera to register
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            width: '100%',
          }}
        >
          {eventId && (
            <Link
              to={`/events/${eventId}/register`}
              style={{
                flex: 1,
                textDecoration: 'none',
              }}
            >
              <button
                type="button"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '0.6rem',
                  background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <ExternalLink size={14} />
                <span>Open Registration</span>
              </button>
            </Link>
          )}

          <button
            type="button"
            onClick={handleDownloadQR}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.6rem 0.85rem',
              borderRadius: '0.6rem',
              background: downloadSuccess
                ? 'linear-gradient(135deg, #059669 0%, #10B981 100%)'
                : 'rgba(30, 41, 59, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              fontSize: '0.82rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = downloadSuccess ? '#059669' : 'rgba(99, 102, 241, 0.2)')}
            onMouseOut={(e) => (e.currentTarget.style.background = downloadSuccess ? '#059669' : 'rgba(30, 41, 59, 0.85)')}
          >
            {downloadSuccess ? (
              <>
                <Check size={14} />
                <span>Saved QR!</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>Save QR Code</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
