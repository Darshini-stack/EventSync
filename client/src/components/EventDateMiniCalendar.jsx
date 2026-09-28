import React, { useMemo } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

/**
 * EventDateMiniCalendar
 * 
 * A compact, non-interactive event date widget (~4cm x 4cm / ~165px)
 * designed for EventDetailsPage.
 * 
 * - Displays the event's month and year
 * - Displays a 7-day compact week header (S M T W T F S)
 * - Displays days of that month in a clean 7-column grid
 * - Highlights ONLY the actual event date with an EventSync gradient
 * - Does NOT highlight today unless today is the event date
 * - Does NOT show other events
 * - Fully responsive with clean fallback if date is missing/invalid
 */
export const EventDateMiniCalendar = ({ event }) => {
  const dateInfo = useMemo(() => {
    if (!event || !event.date) return null;

    try {
      const d = new Date(event.date);
      if (isNaN(d.getTime())) return null;

      const year = d.getFullYear();
      const monthIndex = d.getMonth(); // 0 - 11
      const eventDay = d.getDate(); // 1 - 31

      // Month name and year (e.g. "September 2026")
      const monthName = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      // First day of month (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
      const firstDayIndex = new Date(year, monthIndex, 1).getDay();

      // Total days in month
      const totalDays = new Date(year, monthIndex + 1, 0).getDate();

      // Leading empty cells
      const emptyCells = Array.from({ length: firstDayIndex }, (_, i) => i);

      // Month day numbers
      const days = Array.from({ length: totalDays }, (_, i) => i + 1);

      return {
        year,
        monthIndex,
        eventDay,
        monthName,
        emptyCells,
        days,
        fullFormattedDate: d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      };
    } catch {
      return null;
    }
  }, [event]);

  // Fallback state if date is invalid or missing
  if (!dateInfo) {
    return (
      <div
        className="mini-date-calendar"
        style={{
          width: '160px',
          minWidth: '160px',
          height: '160px',
          borderRadius: 'var(--radius-lg, 0.75rem)',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.75rem',
          textAlign: 'center',
          color: 'var(--text-muted, #94A3B8)',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
        }}
      >
        <CalendarIcon size={24} style={{ opacity: 0.5, marginBottom: '0.35rem' }} />
        <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Date TBA</span>
      </div>
    );
  }

  const weekHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div
      className="mini-date-calendar"
      style={{
        width: '164px',
        minWidth: '164px',
        borderRadius: 'var(--radius-lg, 0.75rem)',
        background: 'linear-gradient(180deg, rgba(20, 26, 46, 0.95) 0%, rgba(13, 17, 32, 0.95) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.22)',
        padding: '0.65rem 0.55rem 0.55rem',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        userSelect: 'none',
      }}
      title={`Event Date: ${dateInfo.fullFormattedDate}`}
    >
      {/* Month & Year Header */}
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: '700',
          color: '#F1F5F9',
          letterSpacing: '0.02em',
          marginBottom: '0.35rem',
          textAlign: 'center',
          width: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {dateInfo.monthName}
      </div>

      {/* Weekday Header Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          width: '100%',
          gap: '2px',
          textAlign: 'center',
          marginBottom: '0.2rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          paddingBottom: '0.2rem',
        }}
      >
        {weekHeaders.map((dayLabel, idx) => (
          <span
            key={idx}
            style={{
              fontSize: '0.6rem',
              fontWeight: '700',
              color: 'var(--text-muted, #94A3B8)',
              lineHeight: 1,
            }}
          >
            {dayLabel}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          width: '100%',
          gap: '2px',
          textAlign: 'center',
        }}
      >
        {/* Leading blanks */}
        {dateInfo.emptyCells.map((_, idx) => (
          <div key={`empty-${idx}`} style={{ height: '17px' }} />
        ))}

        {/* Days */}
        {dateInfo.days.map((dayNumber) => {
          const isEventDate = dayNumber === dateInfo.eventDay;

          return (
            <div
              key={dayNumber}
              style={{
                height: '17px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.64rem',
                fontWeight: isEventDate ? '800' : '500',
                borderRadius: isEventDate ? '50%' : '3px',
                background: isEventDate
                  ? 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)'
                  : 'transparent',
                color: isEventDate
                  ? '#FFFFFF'
                  : 'rgba(226, 232, 240, 0.7)',
                boxShadow: isEventDate
                  ? '0 0 10px rgba(99, 102, 241, 0.75), 0 0 2px #FFFFFF'
                  : 'none',
                position: 'relative',
              }}
            >
              {dayNumber}
            </div>
          );
        })}
      </div>

      {/* Footer Indicator: ● Event Date */}
      <div
        style={{
          marginTop: '0.45rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
          fontSize: '0.65rem',
          color: '#A5B4FC',
          fontWeight: '600',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '0.3rem',
          width: '100%',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#6366F1',
            boxShadow: '0 0 6px #6366F1',
          }}
        />
        <span>Event Date</span>
      </div>
    </div>
  );
};
