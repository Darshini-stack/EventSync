import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Safely parses event start and end Date objects from event.date and event.time.
 * Handles formats: "9:00 AM - 6:00 PM", "10:00 AM", "14:30", "2:00 PM", etc.
 */
export function getEventDateRange(event) {
  if (!event || !event.date) return { start: null, end: null, isValid: false };

  try {
    const baseDate = new Date(event.date);
    if (isNaN(baseDate.getTime())) {
      return { start: null, end: null, isValid: false };
    }

    // Default: start of the date
    const start = new Date(baseDate);
    const end = new Date(baseDate);

    const timeStr = typeof event.time === 'string' ? event.time.trim() : '';

    if (!timeStr) {
      // No time string: default to full day (09:00 to 18:00)
      start.setHours(9, 0, 0, 0);
      end.setHours(18, 0, 0, 0);
      return { start, end, isValid: true };
    }

    // Check for range with separator: "9:00 AM - 6:00 PM" or "9:00 AM to 6:00 PM"
    const parts = timeStr.split(/\s*[-–—to]\s*/i);

    const parseTimeComponent = (str, targetDate) => {
      if (!str) return false;
      // Match "9:30 AM", "09:30", "9 AM", "14:30"
      const match = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (!match) return false;

      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const meridiem = match[3] ? match[3].toLowerCase() : null;

      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;

      targetDate.setHours(hours, minutes, 0, 0);
      return true;
    };

    let hasStart = parseTimeComponent(parts[0], start);

    if (parts.length > 1) {
      const hasEnd = parseTimeComponent(parts[1], end);
      if (!hasEnd) {
        // Fallback end = start + 3 hours
        end.setTime(start.getTime() + 3 * 60 * 60 * 1000);
      }
    } else if (hasStart) {
      // Single time: assume 3 hours duration
      end.setTime(start.getTime() + 3 * 60 * 60 * 1000);
    } else {
      // Time format was non-clock string (e.g. "TBA" or "Morning"): default to 9:00 - 18:00
      start.setHours(9, 0, 0, 0);
      end.setHours(18, 0, 0, 0);
      hasStart = true;
    }

    return { start, end, isValid: hasStart };
  } catch (err) {
    return { start: null, end: null, isValid: false };
  }
}

/**
 * Computes live countdown state based on current time and event date/time.
 */
export function calculateCountdown(event, now = new Date()) {
  if (!event || !event.date) {
    return { state: 'UNKNOWN', label: '', days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  // Explicit COMPLETED or CANCELLED statuses
  if (event.status === 'COMPLETED') {
    return { state: 'COMPLETED', label: 'Event Completed', days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  if (event.status === 'CANCELLED') {
    return { state: 'CANCELLED', label: 'Event Cancelled', days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const { start, end, isValid } = getEventDateRange(event);
  if (!isValid || !start) {
    return { state: 'UNKNOWN', label: '', days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const nowMs = now.getTime();
  const startMs = start.getTime();
  const endMs = end ? end.getTime() : startMs + 3 * 3600 * 1000;

  // Event has ended
  if (nowMs > endMs) {
    return { state: 'COMPLETED', label: 'Event Completed', days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  // Event is currently live
  if (nowMs >= startMs && nowMs <= endMs) {
    return { state: 'LIVE', label: 'Event is Live', days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  // Event is in the future
  const diffMs = Math.max(0, startMs - nowMs);
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Format requested: "Starts in: DD Days HH Hours MM Minutes"
  const pad = (n) => String(Math.max(0, Math.floor(n || 0))).padStart(2, '0');
  const label = `Starts in: ${pad(days)} Days ${pad(hours)} Hours ${pad(minutes)} Minutes`;

  return {
    state: days === 0 ? 'NEAR' : 'UPCOMING',
    label,
    days,
    hours,
    minutes,
    seconds,
  };
}

/**
 * EventCountdown Component
 * @param {Object} event - Event document with date, time, and status.
 * @param {string} variant - 'compact' (badge for cards) | 'full' (prominent card for details).
 */
export const EventCountdown = ({ event, variant = 'compact', style = {}, className = '' }) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Live ticking every second without requiring page reload
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const countdown = useMemo(() => calculateCountdown(event, now), [event, now]);

  if (!event || !event.date || countdown.state === 'UNKNOWN') {
    return null;
  }

  // =========================================================================
  // COMPACT VARIANT (For EventCard and list items)
  // =========================================================================
  if (variant === 'compact') {
    if (countdown.state === 'LIVE') {
      return (
        <span
          className={`event-countdown-compact live ${className}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.25rem 0.65rem',
            borderRadius: 'var(--radius-full, 9999px)',
            background: 'rgba(16, 185, 129, 0.18)',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            color: '#34D399',
            fontSize: '0.78rem',
            fontWeight: '700',
            letterSpacing: '0.02em',
            ...style,
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10B981',
              boxShadow: '0 0 8px #10B981',
              animation: 'pulse 1.8s infinite',
            }}
          />
          <span>Event is Live</span>
        </span>
      );
    }

    if (countdown.state === 'COMPLETED') {
      return (
        <span
          className={`event-countdown-compact completed ${className}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.65rem',
            borderRadius: 'var(--radius-full, 9999px)',
            background: 'rgba(148, 163, 184, 0.15)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            color: '#94A3B8',
            fontSize: '0.76rem',
            fontWeight: '600',
            ...style,
          }}
        >
          <CheckCircle2 size={12} />
          <span>Event Completed</span>
        </span>
      );
    }

    if (countdown.state === 'CANCELLED') {
      return (
        <span
          className={`event-countdown-compact cancelled ${className}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.65rem',
            borderRadius: 'var(--radius-full, 9999px)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#F87171',
            fontSize: '0.76rem',
            fontWeight: '600',
            ...style,
          }}
        >
          <AlertCircle size={12} />
          <span>Event Cancelled</span>
        </span>
      );
    }

    // Upcoming or Near
    const isNear = countdown.state === 'NEAR';
    return (
      <span
        className={`event-countdown-compact ${isNear ? 'near' : 'upcoming'} ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.25rem 0.65rem',
          borderRadius: 'var(--radius-full, 9999px)',
          background: isNear ? 'rgba(245, 158, 11, 0.16)' : 'rgba(99, 102, 241, 0.14)',
          border: isNear ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(99, 102, 241, 0.3)',
          color: isNear ? '#FBBF24' : '#A5B4FC',
          fontSize: '0.78rem',
          fontWeight: '600',
          ...style,
        }}
      >
        <Clock size={13} style={{ color: isNear ? '#F59E0B' : '#818CF8' }} />
        <span>{countdown.label}</span>
      </span>
    );
  }

  // =========================================================================
  // FULL VARIANT (For EventDetailsPage)
  // =========================================================================

  // 1. Live State
  // 1. Live State
  if (countdown.state === 'LIVE') {
    return (
      <div
        className={`event-countdown-full live glass-panel ${className}`}
        data-testid="event-countdown-live"
        style={{
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-xl, 1rem)',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(5, 150, 105, 0.1) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
          ...style,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 0 16px rgba(16, 185, 129, 0.6)',
              animation: 'pulse 1.8s infinite',
              flexShrink: 0,
            }}
          >
            <Zap size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#34D399', letterSpacing: '0.01em' }}>
              Event is Live
            </div>
            <div style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.8)', marginTop: '0.15rem' }}>
              Check-in is active at {event.venue || 'the venue'}. Have your Digital Pass QR ready!
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '0.35rem 0.85rem',
            borderRadius: 'var(--radius-full, 9999px)',
            background: 'rgba(16, 185, 129, 0.25)',
            border: '1px solid #10B981',
            color: '#A7F3D0',
            fontSize: '0.8rem',
            fontWeight: '700',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          ● Active Session
        </div>
      </div>
    );
  }

  // 2. Completed State
  if (countdown.state === 'COMPLETED') {
    return (
      <div
        className={`event-countdown-full completed glass-panel ${className}`}
        data-testid="event-countdown-completed"
        style={{
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-xl, 1rem)',
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          ...style,
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(148, 163, 184, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94A3B8',
            flexShrink: 0,
          }}
        >
          <CheckCircle2 size={18} />
        </div>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#E2E8F0' }}>
            Event Completed
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94A3B8)', marginTop: '0.15rem' }}>
            This event has concluded. Attendance verified students can view their certificates.
          </div>
        </div>
      </div>
    );
  }

  // 3. Cancelled State
  if (countdown.state === 'CANCELLED') {
    return (
      <div
        className={`event-countdown-full cancelled glass-panel ${className}`}
        data-testid="event-countdown-cancelled"
        style={{
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-xl, 1rem)',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          ...style,
        }}
      >
        <AlertCircle size={22} color="#F87171" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#F87171' }}>
            Event Cancelled
          </div>
          <div style={{ fontSize: '0.82rem', color: '#FCA5A5', marginTop: '0.15rem' }}>
            This event has been cancelled by administration.
          </div>
        </div>
      </div>
    );
  }

  // 4. Upcoming / Near State (Live Countdown Digits + Human Summary)
  const isNear = countdown.state === 'NEAR';

  return (
    <div
      className={`event-countdown-full upcoming glass-panel ${className}`}
      data-testid="event-countdown"
      style={{
        padding: '1rem 1.25rem',
        borderRadius: 'var(--radius-xl, 1rem)',
        background: isNear
          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)',
        border: isNear ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(99, 102, 241, 0.3)',
        boxShadow: isNear ? '0 8px 24px rgba(245, 158, 11, 0.1)' : '0 8px 24px rgba(99, 102, 241, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.85rem',
        ...style,
      }}
    >
      {/* Title & Human-readable label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '220px', flex: '1 1 auto' }}>
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: isNear ? 'rgba(245, 158, 11, 0.2)' : 'rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isNear ? '#F59E0B' : '#818CF8',
            border: isNear ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(99, 102, 241, 0.4)',
            flexShrink: 0,
          }}
        >
          <Clock size={20} />
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em', color: isNear ? '#FBBF24' : '#A5B4FC' }}>
            {isNear ? 'Starting Soon' : 'Event Countdown'}
          </div>
          <div
            className="countdown-label"
            style={{
              fontSize: 'clamp(0.92rem, 2.2vw, 1.15rem)',
              fontWeight: '800',
              color: '#FFFFFF',
              marginTop: '0.1rem',
              letterSpacing: '0.01em',
              wordBreak: 'break-word',
            }}
          >
            {countdown.label}
          </div>
        </div>
      </div>

      {/* Live Ticking Time Blocks */}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'nowrap' }}>
        {[
          { value: countdown.days, label: 'DAYS' },
          { value: countdown.hours, label: 'HOURS' },
          { value: countdown.minutes, label: 'MINS' },
          { value: countdown.seconds, label: 'SECS' },
        ].map((unit, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '46px',
              padding: '0.35rem 0.45rem',
              borderRadius: 'var(--radius-md, 0.5rem)',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
            }}
          >
            <span style={{ fontSize: '1.15rem', fontWeight: '800', color: '#FFFFFF', lineHeight: 1 }}>
              {String(unit.value).padStart(2, '0')}
            </span>
            <span style={{ fontSize: '0.58rem', color: 'var(--text-muted, #94A3B8)', fontWeight: '700', marginTop: '0.15rem', letterSpacing: '0.04em' }}>
              {unit.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
