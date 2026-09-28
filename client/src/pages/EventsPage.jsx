import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Calendar, CalendarX, Loader2, QrCode } from 'lucide-react';
import { useEventScanner } from '../context/EventScannerContext';
import { fetchEvents } from '../services/api';
import { getSocket } from '../services/socket';
import { EventCard } from '../components/EventCard';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { Button } from '../components/common/Button';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';

export const EventsPage = () => {
  const { openEventScanner } = useEventScanner();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Technology', 'Workshop', 'Seminar', 'Hackathon', 'Cultural', 'Sports', 'College', 'Other'];

  const loadEvents = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
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
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();

    const socket = getSocket();
    const handleSocketUpdate = () => {
      loadEvents(true);
    };

    socket.on('event_created', handleSocketUpdate);
    socket.on('event_updated', handleSocketUpdate);
    socket.on('event_deleted', handleSocketUpdate);

    return () => {
      socket.off('event_created', handleSocketUpdate);
      socket.off('event_updated', handleSocketUpdate);
      socket.off('event_deleted', handleSocketUpdate);
    };
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const title = event.title || '';
      const description = event.description || '';
      const venue = event.venue || '';
      const category = event.category || '';

      const matchesSearch =
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        venue.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === 'All' || category.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [events, searchQuery, selectedCategory]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      {/* Header Banner */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <Badge variant="info">Live Events Directory</Badge>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>MongoDB Synchronized</span>
        </div>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>
          Discover College Events
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '680px' }}>
          Browse upcoming campus hackathons, tech masterclasses, competitive robotics tournaments, and cultural celebrations.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          {/* Search Input */}
          <div style={{ flex: '1 1 280px', position: 'relative' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search by event title, venue, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {/* 100% Free Campus Events Badge & Scan Event QR Action */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
                whiteSpace: 'nowrap',
              }}
              title="Scan poster or flyer QR to register instantly"
            >
              Scan Event QR
            </Button>

            <Badge variant="success" style={{ padding: '0.55rem 0.95rem', fontSize: '0.82rem' }}>
              100% Free Admission
            </Badge>
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: '500',
                background: selectedCategory === cat ? 'var(--gradient-brand)' : 'rgba(255, 255, 255, 0.05)',
                color: selectedCategory === cat ? 'white' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: selectedCategory === cat ? 'transparent' : 'var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count & Event Grid */}
      <div>
        {loading ? (
          <div className="grid-cards">
            <div className="glass-panel" style={{ padding: '1.5rem' }}><LoadingSkeleton height="200px" /></div>
            <div className="glass-panel" style={{ padding: '1.5rem' }}><LoadingSkeleton height="200px" /></div>
            <div className="glass-panel" style={{ padding: '1.5rem' }}><LoadingSkeleton height="200px" /></div>
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={CalendarX}
            title="No events published yet"
            description="No events published yet."
          />
        ) : filteredEvents.length > 0 ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Showing <strong>{filteredEvents.length}</strong> events
              </span>
              {(searchQuery || selectedCategory !== 'All') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                  }}
                  style={{ fontSize: '0.82rem', color: 'var(--accent-primary)', cursor: 'pointer' }}
                >
                  Reset Filters
                </button>
              )}
            </div>
            <div className="grid-cards">
              {filteredEvents.map((event) => (
                <EventCard key={event._id || event.id} event={event} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="No matching events found"
            description="Try adjusting your search query or selecting a different category filter."
            action={
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
              >
                Clear Filters
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
};
