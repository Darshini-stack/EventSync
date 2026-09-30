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
  'Artificial Intelligence (AI)',
  'Computer Science and Engineering (CSE)',
  'Information Technology (IT)',
  'Electronics and Communication Engineering (ECE)',
  'Electrical and Electronics Engineering (EEE)',
  'Mechanical Engineering (ME)',
  'Civil Engineering (CE)',
  'Other',
];

const normalizeDepartment = (dept) => {
  if (!dept) return '';
  const trimmed = String(dept).trim();
  const direct = DEPARTMENTS.find((d) => d.toLowerCase() === trimmed.toLowerCase());
  if (direct) return direct;
  if (/^ai\b/i.test(trimmed) || /artificial/i.test(trimmed)) return 'Artificial Intelligence (AI)';
  if (/^cse\b/i.test(trimmed) || /computer/i.test(trimmed)) return 'Computer Science and Engineering (CSE)';
  if (/^it\b/i.test(trimmed) || /information/i.test(trimmed)) return 'Information Technology (IT)';
  if (/^ece\b/i.test(trimmed) || /electronics and comm/i.test(trimmed)) return 'Electronics and Communication Engineering (ECE)';
  if (/^eee\b/i.test(trimmed) || /electrical/i.test(trimmed)) return 'Electrical and Electronics Engineering (EEE)';
  if (/^me\b/i.test(trimmed) || /mechanical/i.test(trimmed)) return 'Mechanical Engineering (ME)';
  if (/^civil\b/i.test(trimmed) || /^ce\b/i.test(trimmed)) return 'Civil Engineering (CE)';
  return 'Other';
};

const YEARS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
];

export const EventRegistrationPage = () => {
  const params = useParams();
  const id = params.id || params.eventId;
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

  // Dynamic Registration Form State
  const [teamSize, setTeamSize] = useState(1);
  const [fullName, setFullName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [college, setCollege] = useState('');
  const [year, setYear] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamMembers, setTeamMembers] = useState([]); // [{ name, rollNumber, college, department, year, email, phone }]

  // Pre-fill student defaults if authenticated
  useEffect(() => {
    if (user) {
      if (!fullName) setFullName(user.name || '');
      if (!rollNumber) setRollNumber(user.studentId || '');
      if (!year && user.year && YEARS.includes(user.year)) setYear(user.year);
      if (!department && user.department) {
        setDepartment(normalizeDepartment(user.department));
      }
      if (!college) setCollege(user.college || 'PBR Visvodaya Institute of Technology & Science');
      if (!email) setEmail(user.email || '');
      if (!phone) setPhone(user.phone || '');
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

  // Handle Team Size change (Dynamically generates N student forms)
  const handleTeamSizeChange = (newSize) => {
    const maxAllowed = Math.max(1, event?.maxTeamSize || 1);
    const targetSize = Math.max(1, Math.min(maxAllowed, newSize));
    setTeamSize(targetSize);
    setErrorMsg(null);
    setTeamMembers((prev) => {
      const neededMembers = targetSize - 1;
      if (neededMembers <= 0) return [];
      const updated = [...prev];
      while (updated.length < neededMembers) {
        updated.push({
          name: '',
          rollNumber: '',
          college: college || user?.college || 'PBR Visvodaya Institute of Technology & Science',
          department: department || 'Artificial Intelligence (AI)',
          year: year || '1st Year',
          email: '',
          phone: '',
        });
      }
      return updated.slice(0, neededMembers);
    });
  };

  // Update specific team member field
  const handleTeamMemberChange = (index, field, value) => {
    setTeamMembers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Clear form logic
  const handleClearClick = () => {
    const hasData = fullName || rollNumber || year || department || college || email || phone || teamName || teamMembers.some((m) => m.name || m.rollNumber);
    if (!hasData) {
      resetForm();
    } else {
      setClearConfirmOpen(true);
    }
  };

  const resetForm = () => {
    setFullName(user?.name || '');
    setRollNumber(user?.studentId || '');
    setCollege(user?.college || 'PBR Visvodaya Institute of Technology & Science');
    setDepartment(normalizeDepartment(user?.department) || '');
    setYear(user?.year || '');
    setEmail(user?.email || '');
    setPhone(user?.phone || '');
    setTeamName('');
    setTeamSize(1);
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

    // 1. Validate Student 1 Details
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMsg('Please enter Student 1 Full Name (at least 2 characters).');
      return;
    }
    if (!rollNumber.trim() || rollNumber.trim().length < 2) {
      setErrorMsg('Please enter Student 1 Roll Number (at least 2 characters).');
      return;
    }
    if (!department) {
      setErrorMsg('Please select Branch / Department for Student 1.');
      return;
    }
    if (!year) {
      setErrorMsg('Please select Academic Year for Student 1.');
      return;
    }

    // 2. Validate Dynamic Team Members (Student 2..N)
    for (let i = 0; i < teamMembers.length; i++) {
      const tm = teamMembers[i];
      const studentNum = i + 2;
      if (!tm.name || tm.name.trim().length < 2) {
        setErrorMsg(`Please enter Full Name for Student ${studentNum}.`);
        return;
      }
      if (!tm.rollNumber || tm.rollNumber.trim().length < 2) {
        setErrorMsg(`Please enter Roll Number for Student ${studentNum}.`);
        return;
      }
      if (!tm.department) {
        setErrorMsg(`Please select Branch / Department for Student ${studentNum}.`);
        return;
      }
      if (!tm.year) {
        setErrorMsg(`Please select Academic Year for Student ${studentNum}.`);
        return;
      }
    }

    // 3. Validate Unique Roll Numbers
    const allRolls = [rollNumber.trim().toUpperCase()];
    for (let i = 0; i < teamMembers.length; i++) {
      const mRoll = teamMembers[i].rollNumber.trim().toUpperCase();
      if (allRolls.includes(mRoll)) {
        setErrorMsg(`Duplicate roll number "${teamMembers[i].rollNumber.trim()}" found. Each participant must have a unique roll number.`);
        return;
      }
      allRolls.push(mRoll);
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        eventId: id,
        fullName: fullName.trim(),
        rollNumber: rollNumber.trim(),
        college: college.trim(),
        year,
        department,
        email: email.trim(),
        phone: phone.trim(),
        teamSize,
        teamName: teamSize > 1 ? (teamName.trim() || `Team ${fullName.trim()}`) : '',
        teamMembers: teamMembers.map((m) => ({
          name: m.name.trim(),
          rollNumber: m.rollNumber.trim(),
          college: m.college ? m.college.trim() : (college.trim() || ''),
          department: m.department || department,
          year: m.year || year,
          email: m.email ? m.email.trim() : '',
          phone: m.phone ? m.phone.trim() : '',
        })),
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
    <div className="registration-container">
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
        /* STATE 4: THE DYNAMIC REGISTRATION FORM (Requirement 2, 3, 4) */
        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* SECTION A: TEAM SIZE / NUMBER OF STUDENTS SELECTOR */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} color="var(--accent-primary)" />
                <span>Registration Details & Team Size</span>
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Maximum Team Size: <strong style={{ color: 'var(--text-primary)' }}>{maxTeamMembers}</strong> {maxTeamMembers === 1 ? 'student' : 'students'}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginBottom: '1rem' }}>
              {maxTeamMembers > 1
                ? `Select the total number of students in your team (1 to ${maxTeamMembers}). The form will automatically generate detail sections for each student.`
                : 'Individual event registration. Please confirm your student details below.'}
            </p>

            {maxTeamMembers > 1 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Number of Students Participating <span style={{ color: 'var(--accent-rose)' }}>*</span>
                </label>
                <div className="team-size-selector-wrap">
                  {Array.from({ length: maxTeamMembers }, (_, i) => i + 1).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`team-size-pill ${teamSize === s ? 'active' : ''}`}
                      onClick={() => handleTeamSizeChange(s)}
                    >
                      {s === 1 ? '1 Student (Individual)' : `${s} Students`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Team Name (shown when team size > 1) */}
            {teamSize > 1 && (
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '0.4rem' }}>
                  Team Name (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. AI Innovators, Code Warriors"
                />
              </div>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '0.25rem 0' }} />

          {/* SECTION B: STUDENT 1 (PRIMARY CONTACT / TEAM LEADER) */}
          <div className="student-section-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Badge variant="primary" style={{ fontWeight: '800', fontSize: '0.78rem' }}>
                  Student 1
                </Badge>
                <span style={{ fontWeight: '700', fontSize: '0.98rem' }}>
                  {teamSize > 1 ? 'Team Leader / Primary Contact' : 'Individual Participant'}
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                Primary RSVP
              </span>
            </div>

            <div className="form-grid-2col">
              {/* Student 1 Full Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                  Student Name <span style={{ color: 'var(--accent-rose)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter full name"
                  required
                />
              </div>

              {/* Student 1 Roll Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                  Roll Number / Student ID <span style={{ color: 'var(--accent-rose)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g. 2473A05153"
                  required
                />
              </div>

              {/* Student 1 College / Institution */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                  College / Institution
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  placeholder="e.g. PBR Visvodaya Institute of Technology & Science"
                />
              </div>

              {/* Student 1 Branch / Department */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                  Branch / Department <span style={{ color: 'var(--accent-rose)' }}>*</span>
                </label>
                <select
                  className="form-input"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                >
                  <option value="">Select Branch / Department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Student 1 Academic Year */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                  Academic Year <span style={{ color: 'var(--accent-rose)' }}>*</span>
                </label>
                <select
                  className="form-input"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  required
                >
                  <option value="">Select Year</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Student 1 Contact Email */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@college.edu"
                />
              </div>

              {/* Student 1 Phone Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  className="form-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                />
              </div>
            </div>
          </div>

          {/* SECTION C: DYNAMIC TEAM MEMBERS (Student 2, Student 3, ... Student N) */}
          {teamMembers.map((member, idx) => {
            const studentNumber = idx + 2;
            return (
              <div key={idx} className="student-section-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Badge variant="info" style={{ fontWeight: '800', fontSize: '0.78rem' }}>
                      Student {studentNumber}
                    </Badge>
                    <span style={{ fontWeight: '700', fontSize: '0.98rem' }}>
                      Team Member {idx + 1} Details
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Team Member
                  </span>
                </div>

                <div className="form-grid-2col">
                  {/* Student Name */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                      Student Name <span style={{ color: 'var(--accent-rose)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={member.name}
                      onChange={(e) => handleTeamMemberChange(idx, 'name', e.target.value)}
                      placeholder={`Enter student ${studentNumber} full name`}
                      required
                    />
                  </div>

                  {/* Roll Number */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                      Roll Number / Student ID <span style={{ color: 'var(--accent-rose)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={member.rollNumber}
                      onChange={(e) => handleTeamMemberChange(idx, 'rollNumber', e.target.value)}
                      placeholder={`e.g. 2473A0515${4 + idx}`}
                      required
                    />
                  </div>

                  {/* College / Institution */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                      College / Institution
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={member.college !== undefined ? member.college : college}
                      onChange={(e) => handleTeamMemberChange(idx, 'college', e.target.value)}
                      placeholder="e.g. PBR Visvodaya Institute of Technology & Science"
                    />
                  </div>

                  {/* Branch / Department */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                      Branch / Department <span style={{ color: 'var(--accent-rose)' }}>*</span>
                    </label>
                    <select
                      className="form-input"
                      value={member.department || department || 'Artificial Intelligence (AI)'}
                      onChange={(e) => handleTeamMemberChange(idx, 'department', e.target.value)}
                      required
                    >
                      <option value="">Select Branch / Department</option>
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Academic Year */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                      Academic Year <span style={{ color: 'var(--accent-rose)' }}>*</span>
                    </label>
                    <select
                      className="form-input"
                      value={member.year || year || '1st Year'}
                      onChange={(e) => handleTeamMemberChange(idx, 'year', e.target.value)}
                      required
                    >
                      <option value="">Select Year</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Email */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      value={member.email || ''}
                      onChange={(e) => handleTeamMemberChange(idx, 'email', e.target.value)}
                      placeholder={`member${idx + 1}@college.edu`}
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      className="form-input"
                      value={member.phone || ''}
                      onChange={(e) => handleTeamMemberChange(idx, 'phone', e.target.value)}
                      placeholder="e.g. 9876543211"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Validation Alert (Prominently visible directly above submit buttons) */}
          {errorMsg && (
            <Alert variant="error" onDismiss={() => setErrorMsg(null)}>
              {errorMsg}
            </Alert>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '0.25rem 0' }} />

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
              style={{ minWidth: '220px' }}
            >
              {teamSize === 1 ? 'Submit Registration' : `Submit Registration (${teamSize} Students)`}
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
