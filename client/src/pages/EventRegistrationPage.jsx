import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  QrCode,
  LogIn,
  UserCheck,
  Ticket,
  Plus,
  Trash2,
  RotateCcw,
  Check
} from 'lucide-react';
import {
  fetchEventById,
  registerForEvent,
  fetchMyRegistrations,
  fetchPassByRegistration,
  getEventPosterUrl,
  getEventRegistrationQrUrl,
} from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Alert } from '../components/common/Alert';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { DigitalEventPassModal } from '../components/DigitalEventPassModal';

const DEPARTMENTS = [
  'CSE',
  'AI & ML',
  'ECE',
  'EEE',
  'ME',
  'Civil',
  'Other',
];

const YEARS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
];

export const EventRegistrationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isStudent } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [myRegistration, setMyRegistration] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);

  // Digital Pass Modal
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [passData, setPassData] = useState(null);
  const [passLoading, setPassLoading] = useState(false);

  // Clear confirmation modal
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // Registration Form State
  const [fullName, setFullName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [year, setYear] = useState('');
  const [department, setDepartment] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamMembers, setTeamMembers] = useState([]); // [{ name, rollNumber, department, year }]

  // Pre-fill student defaults if authenticated
  useEffect(() => {
    if (user) {
      if (!fullName) setFullName(user.name || '');
      if (!rollNumber) setRollNumber(user.studentId || '');
      if (!year && user.year && YEARS.includes(user.year)) setYear(user.year);
      if (!department && user.department && DEPARTMENTS.includes(user.department)) {
        setDepartment(user.department);
      }
    }
  }, [user]);

  // Load Event
  const loadEvent = useCallback(async () => {
    try {
      const res = await fetchEventById(id);
      if (res.success && res.data) {
        setEvent(res.data);
      } else {
        setEvent(null);
        setErrorMsg(res.message || 'Event not found or unavailable.');
      }
    } catch (err) {
      setEvent(null);
      setErrorMsg('Failed to connect to EventSync server.');
    }
  }, [id]);

  // Check Registration Status
  const checkRegistration = useCallback(async () => {
    if (!isAuthenticated || !isStudent) {
      setMyRegistration(null);
      return;
    }
    try {
      const res = await fetchMyRegistrations();
      if (res.success && Array.isArray(res.data)) {
        const found = res.data.find(
          (r) =>
            ((r.event && (r.event._id === id || r.event === id)) || r.event === id) &&
            r.status === 'REGISTERED'
        );
        setMyRegistration(found || null);
        if (found) {
          // Pre-fetch pass data
          const passRes = await fetchPassByRegistration(found._id);
          if (passRes.success && passRes.data) {
            setPassData(passRes.data);
          }
        }
      }
    } catch (e) {
      console.warn('Could not check registration status:', e.message);
    }
  }, [id, isAuthenticated, isStudent]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadEvent(), checkRegistration()]);
      setLoading(false);
    };
    init();
  }, [loadEvent, checkRegistration]);

  // Socket seat updates
  useEffect(() => {
    const socket = getSocket();
    const handleSeats = (data) => {
      if (data && (data.eventId === id || String(data.eventId) === String(id))) {
        setEvent((prev) => (prev ? { ...prev, availableSeats: data.availableSeats } : prev));
      }
    };
    socket.on('event_seats_updated', handleSeats);
    socket.on('event_updated', loadEvent);
    return () => {
      socket.off('event_seats_updated', handleSeats);
      socket.off('event_updated', loadEvent);
    };
  }, [id, loadEvent]);

  // Add team member (Total members including primary <= event.maxTeamSize)
  const handleAddTeamMember = () => {
    const maxAllowed = event?.maxTeamSize || 1;
    if (1 + teamMembers.length >= maxAllowed) return;
    setTeamMembers((prev) => [
      ...prev,
      { name: '', rollNumber: '', department: department || 'CSE', year: year || '1st Year' },
    ]);
  };

  // Remove team member
  const handleRemoveTeamMember = (index) => {
    setTeamMembers((prev) => prev.filter((_, i) => i !== index));
  };

  // Update team member field
  const handleTeamMemberChange = (index, field, value) => {
    setTeamMembers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Clear form logic
  const handleClearClick = () => {
    const hasData = fullName || rollNumber || year || department || teamName || teamMembers.some((m) => m.name || m.rollNumber);
    if (!hasData) {
      resetForm();
    } else {
      setClearConfirmOpen(true);
    }
  };

  const resetForm = () => {
    setFullName('');
    setRollNumber('');
    setYear('');
    setDepartment('');
    setTeamName('');
    setTeamMembers([]);
    setErrorMsg(null);
    setClearConfirmOpen(false);
  };

  // View Digital Pass action
  const handleOpenPass = async (regId) => {
    const targetRegId = regId || myRegistration?._id || successData?._id;
    if (!targetRegId) return;

    setPassLoading(true);
    setPassModalOpen(true);
    try {
      const res = await fetchPassByRegistration(targetRegId);
      if (res.success && res.data) {
        setPassData(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch digital pass:', e);
    } finally {
      setPassLoading(false);
    }
  };

  // Submit Registration
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/events/${id}/register` } });
      return;
    }

    if (!fullName.trim()) {
      setErrorMsg('Please enter your Full Name.');
      return;
    }
    if (!rollNumber.trim()) {
      setErrorMsg('Please enter your Roll Number.');
      return;
    }
    if (!year) {
      setErrorMsg('Please select your Year.');
      return;
    }
    if (!department) {
      setErrorMsg('Please select your Department (e.g. AI & ML, CSE).');
      return;
    }

    // Filter out completely empty team member rows
    const cleanedTeamMembers = teamMembers
      .map((m) => ({
        name: m.name.trim(),
        rollNumber: m.rollNumber.trim(),
        department: m.department || department,
        year: m.year || year,
      }))
      .filter((m) => m.name || m.rollNumber);

    // Validate partial team member rows
    for (let i = 0; i < cleanedTeamMembers.length; i++) {
      const tm = cleanedTeamMembers[i];
      if (!tm.name || !tm.rollNumber) {
        setErrorMsg(`Team Member ${i + 1} must include both Name and Roll Number.`);
        return;
      }
    }

    // Validate duplicate roll numbers within the same registration
    const allRolls = [rollNumber.trim().toUpperCase()];
    for (let i = 0; i < cleanedTeamMembers.length; i++) {
      const mRoll = cleanedTeamMembers[i].rollNumber.toUpperCase();
      if (allRolls.includes(mRoll)) {
        setErrorMsg(`Duplicate roll number "${cleanedTeamMembers[i].rollNumber}" found. Each team member must have a unique roll number.`);
        return;
      }
      allRolls.push(mRoll);
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const totalTeamSize = 1 + cleanedTeamMembers.length;
      const payload = {
        eventId: id,
        fullName: fullName.trim(),
        rollNumber: rollNumber.trim(),
        year,
        department,
        teamSize: totalTeamSize,
        teamName: totalTeamSize > 1 ? (teamName.trim() || `Team ${fullName.trim()}`) : '',
        teamMembers: cleanedTeamMembers,
      };

      const res = await registerForEvent(id, payload);
      if (res.success && res.data) {
        setSuccessData(res.data);
        setMyRegistration(res.data);
        // Pre-fetch pass
        if (res.data._id) {
          const passRes = await fetchPassByRegistration(res.data._id);
          if (passRes.success && passRes.data) {
            setPassData(passRes.data);
          }
        }
        await loadEvent();
      } else {
        setErrorMsg(res.message || 'Registration could not be completed.');
      }
    } catch (err) {
      setErrorMsg('A network error occurred while submitting your registration.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '3rem auto', textAlign: 'center', padding: '3rem' }}>
        <div className="spin" style={{ width: '36px', height: '36px', border: '3px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading event registration...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div style={{ maxWidth: '800px', margin: '2rem auto' }}>
        <EmptyState
          icon={AlertCircle}
          title="Event Not Found"
          description={errorMsg || 'The requested event is unavailable.'}
          action={
            <Link to="/events">
              <Button variant="primary">Browse Events</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const capacity = event.capacity || 0;
  const availableSeats = event.availableSeats !== undefined ? event.availableSeats : capacity;
  const isFull = availableSeats <= 0;

  // Deadline check
  const now = new Date();
  const deadlineDate = event.registrationDeadline ? new Date(event.registrationDeadline) : null;
  const isDeadlinePassed = deadlineDate ? now > deadlineDate : false;
  const isClosed = isDeadlinePassed || event.status === 'REGISTRATION_CLOSED' || event.status === 'COMPLETED' || event.status === 'CANCELLED';

  const displayDate = event.date ? new Date(event.date).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) : 'Scheduled';

  const displayDeadline = deadlineDate ? deadlineDate.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) : 'Open Until Event';

  const maxTeamMembers = event.maxTeamSize || 1;

  return (
    <div style={{ maxWidth: '820px', margin: '2rem auto', width: '100%', padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Navigation Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link
          to={`/events/${id}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.88rem', fontWeight: '600' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Event Details</span>
        </Link>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Mode: <strong style={{ color: 'var(--text-primary)' }}>{event.mode || 'Offline'}</strong>
        </span>
      </div>

      {/* EVENT SUMMARY CARD */}
      <div
        className="glass-panel"
        style={{
          padding: '1.75rem 2rem',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
          <Badge variant="info">{event.category || 'Event'}</Badge>
          <Badge variant="success" dot>FREE REGISTRATION</Badge>
          {isClosed && <Badge variant="danger">REGISTRATION CLOSED</Badge>}
          {myRegistration && <Badge variant="success">✓ REGISTERED</Badge>}
        </div>

        <h1 style={{ fontSize: 'clamp(1.6rem, 3.2vw, 2.2rem)', fontWeight: '800', lineHeight: 1.25, marginBottom: '0.5rem' }}>
          {event.title}
        </h1>
        <div style={{ fontSize: '1rem', color: 'var(--accent-primary)', fontWeight: '700', marginBottom: '1.25rem' }}>
          Registration Form
        </div>

        {/* Quick Info Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Calendar size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Event Date</div>
              <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{displayDate}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <MapPin size={18} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Venue</div>
              <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{event.venue}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Clock size={18} style={{ color: '#F59E0B', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Deadline</div>
              <div style={{ fontWeight: '700', fontSize: '0.85rem', color: isDeadlinePassed ? '#F87171' : 'inherit' }}>
                {displayDeadline}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Users size={18} style={{ color: '#10B981', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Available Seats</div>
              <div style={{ fontWeight: '700', fontSize: '0.85rem', color: availableSeats <= 5 ? '#F87171' : '#34D399' }}>
                {availableSeats} of {capacity} remaining
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <Alert variant="error" onDismiss={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {/* STATE 1: REGISTRATION SUCCESSFUL */}
      {successData ? (
        <div
          className="glass-panel"
          style={{
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.3) 0%, rgba(15, 23, 42, 0.9) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={28} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#10B981', margin: 0 }}>
                ✓ Registration Successful
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
                Seat reserved! Your Digital Event Pass has been generated.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Team Leader</span>
              <div style={{ fontWeight: '700', color: '#fff' }}>{successData.fullName}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Department</span>
              <div style={{ fontWeight: '700', color: '#38BDF8' }}>{successData.department}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Year</span>
              <div style={{ fontWeight: '700', color: '#fff' }}>{successData.year}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Registration Code / ID</span>
              <div style={{ fontFamily: 'monospace', fontWeight: '700', color: '#F1F5F9' }}>
                {successData.registrationCode || successData._id}
              </div>
            </div>
          </div>

          {successData.teamMembers && successData.teamMembers.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '700' }}>
                Registered Team Members ({successData.teamMembers.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
                {successData.teamMembers.map((tm, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.06)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{tm.name}</strong>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{tm.rollNumber}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              size="lg"
              icon={Ticket}
              onClick={() => handleOpenPass(successData._id)}
              style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
            >
              View Digital Event Pass
            </Button>
            <Link to="/student/dashboard">
              <Button variant="outline" size="lg">
                Go to Student Dashboard
              </Button>
            </Link>
          </div>
        </div>
      ) : myRegistration ? (
        /* STATE 2: ALREADY REGISTERED (Section 6 & 10) */
        <div
          className="glass-panel"
          style={{
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid rgba(16, 185, 129, 0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={28} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#10B981', margin: 0 }}>
                ✓ Already Registered
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
                You have already confirmed your registration for this event.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'rgba(0,0,0,0.25)', padding: '1rem 1.25rem', borderRadius: '10px', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Event</span>
              <div style={{ fontWeight: '700' }}>{event.title}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Department</span>
              <div style={{ fontWeight: '700', color: '#38BDF8' }}>{myRegistration.department || 'Registered'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Status</span>
              <div>
                <Badge variant="success">{myRegistration.status}</Badge>
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Registration Code / ID</span>
              <div style={{ fontFamily: 'monospace', fontWeight: '700' }}>
                {myRegistration.registrationCode || myRegistration._id}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              size="lg"
              icon={Ticket}
              onClick={() => handleOpenPass(myRegistration._id)}
              style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
            >
              View Digital Event Pass
            </Button>
            <Link to="/student/dashboard">
              <Button variant="outline" size="lg">
                Student Dashboard
              </Button>
            </Link>
          </div>
        </div>
      ) : isClosed ? (
        /* STATE 3: REGISTRATION CLOSED (Section 6 & 11) */
        <div
          className="glass-panel"
          style={{
            padding: '2.5rem 2rem',
            textAlign: 'center',
            borderRadius: '16px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <AlertCircle size={28} />
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#EF4444', marginBottom: '0.35rem' }}>
            REGISTRATION CLOSED
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            {isDeadlinePassed
              ? `The registration deadline (${displayDeadline}) for this event has passed.`
              : 'This event is currently not accepting new student registrations.'}
          </p>
          <Link to="/events">
            <Button variant="outline">Browse Other Campus Events</Button>
          </Link>
        </div>
      ) : (
        /* STATE 4: THE REGISTRATION FORM (Section 2, 3, 4) */
        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Section: Personal Details */}
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} color="var(--accent-primary)" />
              <span>Personal Details</span>
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              You are the Team Leader submitting this event registration.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
              {/* Full Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '0.4rem' }}>
                  Full Name <span style={{ color: 'var(--accent-rose)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              {/* Roll Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '0.4rem' }}>
                  Roll Number <span style={{ color: 'var(--accent-rose)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g. 2473A05153"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              {/* Year */}
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '0.4rem' }}>
                  Year <span style={{ color: 'var(--accent-rose)' }}>*</span>
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="">Select Year</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department (Includes AI & ML as a separate first-class option) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '0.4rem' }}>
                  Department <span style={{ color: 'var(--accent-rose)' }}>*</span>
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '0.5rem 0' }} />

          {/* Section: Team Details (Dynamic based on event.maxTeamSize) */}
          {maxTeamMembers > 1 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="var(--accent-secondary)" />
                  <span>Team Details (Optional)</span>
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Max Team Size: <strong>{maxTeamMembers}</strong> (including Team Leader)
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                You can participate individually or add up to {maxTeamMembers - 1} additional team members.
              </p>

              {/* Optional Team Name */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '0.4rem' }}>
                  Team Name (Optional)
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Code Warriors, AI Innovators"
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              {teamMembers.length === 0 ? (
                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                  Participating individually. (Click below if you want to add team members)
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {teamMembers.map((member, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-subtle)',
                        padding: '1rem',
                        borderRadius: '10px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) 42px',
                        gap: '0.85rem',
                        alignItems: 'flex-end',
                      }}
                    >
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem' }}>
                          Team Member {idx + 1} Name <span style={{ color: 'var(--accent-rose)' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => handleTeamMemberChange(idx, 'name', e.target.value)}
                          placeholder="Enter member's full name"
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.8rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.86rem',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem' }}>
                          Roll Number <span style={{ color: 'var(--accent-rose)' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={member.rollNumber}
                          onChange={(e) => handleTeamMemberChange(idx, 'rollNumber', e.target.value)}
                          placeholder="e.g. 2473A05154"
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.8rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.86rem',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem' }}>
                          Department
                        </label>
                        <select
                          value={member.department || department || 'CSE'}
                          onChange={(e) => handleTeamMemberChange(idx, 'department', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.8rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.86rem',
                          }}
                        >
                          {DEPARTMENTS.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveTeamMember(idx)}
                        title="Remove Member"
                        style={{
                          height: '38px',
                          width: '38px',
                          borderRadius: '6px',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#EF4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {1 + teamMembers.length < maxTeamMembers && (
                <div style={{ marginTop: '0.85rem' }}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={Plus}
                    onClick={handleAddTeamMember}
                  >
                    Add Team Member ({1 + teamMembers.length}/{maxTeamMembers})
                  </Button>
                </div>
              )}
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '0.5rem 0' }} />

          {/* Form Actions: Submit & Clear */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <Button
              type="button"
              variant="outline"
              icon={RotateCcw}
              onClick={handleClearClick}
              disabled={submitting}
            >
              Clear Form
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              icon={CheckCircle2}
              style={{ minWidth: '200px' }}
            >
              Submit Registration
            </Button>
          </div>
        </form>
      )}

      {/* Clear Confirmation Modal */}
      <Modal
        isOpen={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="Clear Registration Form?"
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Button variant="outline" size="sm" onClick={() => setClearConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={resetForm}>
              Clear All Information
            </Button>
          </div>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Are you sure you want to clear all entered personal and team details? This cannot be undone.
        </p>
      </Modal>

      {/* Digital Event Pass Modal */}
      <DigitalEventPassModal
        isOpen={passModalOpen}
        onClose={() => setPassModalOpen(false)}
        passData={passData}
        loading={passLoading}
      />
    </div>
  );
};
