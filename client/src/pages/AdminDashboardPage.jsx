

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  PlusCircle,
  Calendar,
  Clock,
  MapPin,
  Users,
  Activity,
  ArrowLeft,
  Mail,
  Phone,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  FileText,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Tag,
  DollarSign,
  CreditCard,
  Check,
  X,
  FileCheck,
  QrCode,
  UserCheck,
  Link2,
  Copy,
  Download,
  Upload,
  Search,
  Award,
  Ticket,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchAdminEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  fetchAdminRegistrations,
  fetchRegistrationById,
  fetchAdminTickets,
  fetchAdminAttendance,
  fetchAdminAttendanceRoster,
  markAttendance,
  markAllAttendance,
  scanDigitalPass,
  fetchAdminCertificates,
  updateCertificateStatus,
  getEventPosterUrl,
  getEventRegistrationQrUrl,
  fetchEventRegistrationQr,
  checkInTicket,
  verifyTicketPassCode,
  getPublicAppUrl,
  getEventRegistrationUrl,
} from '../services/api';
import { getSocket } from '../services/socket';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { Alert } from '../components/common/Alert';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { ChatWidget } from '../components/ChatWidget';

const CATEGORIES = [
  'Technology',
  'Workshop',
  'Seminar',
  'Hackathon',
  'Cultural',
  'Sports',
  'College',
  'Other',
];

const THEME_PRESETS = [
  { label: 'Indigo Purple', value: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' },
  { label: 'Cyan Emerald', value: 'linear-gradient(135deg, #06B6D4 0%, #10B981 100%)' },
  { label: 'Amber Orange', value: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)' },
  { label: 'Rose Pink', value: 'linear-gradient(135deg, #F43F5E 0%, #EC4899 100%)' },
  { label: 'Dark Slate', value: 'linear-gradient(135deg, #334155 0%, #1E293B 100%)' },
];

export const AdminDashboardPage = () => {
  const { user } = useAuth();

  // State: Events & Database Metrics
  const [events, setEvents] = useState([]);
  const [counts, setCounts] = useState({ total: 0, published: 0, draft: 0, cancelled: 0 });
  const [registrations, setRegistrations] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [ticketCounts, setTicketCounts] = useState({ total: 0, active: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Admin Tab Navigation: 'EVENTS' | 'ATTENDANCE' | 'CERTIFICATES' | 'REGISTRATIONS'
  const [activeAdminTab, setActiveAdminTab] = useState('EVENTS');

  // Smart Attendance State (Requirements 14, 15, 16)
  const [smartAttendanceList, setSmartAttendanceList] = useState([]);
  const [smartAttendanceStats, setSmartAttendanceStats] = useState({ total: 0, present: 0, absent: 0, notMarked: 0 });
  const [attendanceFilterEventId, setAttendanceFilterEventId] = useState('');
  const [markingAttendeeId, setMarkingAttendeeId] = useState(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkStatusToApply, setBulkStatusToApply] = useState(null); // 'PRESENT' | 'ABSENT'
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Digital Pass State
  const [manualQrPayload, setManualQrPayload] = useState('');
  const [passScanPreview, setPassScanPreview] = useState(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInResult, setCheckInResult] = useState(null);
  const [scannerError, setScannerError] = useState(null);

  // Certificates Tracking State (Requirements 17, 18, 20)
  const [adminCertificates, setAdminCertificates] = useState([]);
  const [certSummary, setCertSummary] = useState({
    totalRegistered: 0,
    present: 0,
    absent: 0,
    issued: 0,
    notIssued: 0,
    received: 0,
    notReceived: 0,
  });
  const [certEventFilter, setCertEventFilter] = useState('');
  const [certFilterTab, setCertFilterTab] = useState('ALL'); // 'ALL' | 'PRESENT' | 'ABSENT' | 'RECEIVED' | 'NOT_RECEIVED'
  const [issuingCertId, setIssuingCertId] = useState(null);

  // Poster Upload & Removal State
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState(null);
  const [removePoster, setRemovePoster] = useState(false);

  // Registration QR Modal State
  const [regQrModalOpen, setRegQrModalOpen] = useState(false);
  const [regQrEvent, setRegQrEvent] = useState(null);
  const [regQrDataUrl, setRegQrDataUrl] = useState('');
  const [regQrLoading, setRegQrLoading] = useState(false);
  const [copiedEventId, setCopiedEventId] = useState(null);

  // State: Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [activeEventId, setActiveEventId] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Registration Filter State
  const [registrationFilterEventId, setRegistrationFilterEventId] = useState('');

  // Form State (Starts completely empty for new events - NO fake business data)
  const initialFormState = {
    title: '',
    description: '',
    category: '',
    date: '',
    time: '',
    venue: '',
    capacity: '',
    maxTeamSize: '1',
    mode: 'Offline',
    registrationDeadline: '',
    prizeMoney: '0',
    firstPrize: '0',
    secondPrize: '0',
    thirdPrize: '0',
    participationCertificateAvailable: true,
    facultyCoordinatorName: '',
    coordinator1Name: '',
    coordinator1Phone: '',
    coordinator2Name: '',
    coordinator2Phone: '',
    coordinator3Name: '',
    coordinator3Phone: '',
    isPaid: false,
    fee: '0',
    status: 'DRAFT', // Default to DRAFT per Phase 3 specifications
    gradient: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  // State: Delete Confirmation Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // State: Status Confirmation Modal (for Cancel Event and Republish Event)
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusTargetEvent, setStatusTargetEvent] = useState(null);
  const [statusTargetAction, setStatusTargetAction] = useState(null); // 'CANCELLED' | 'PUBLISHED'
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  // Manual Ticket Pass Code Verification State
  const [manualVerifyPassCode, setManualVerifyPassCode] = useState('');
  const [manualVerifyLoading, setManualVerifyLoading] = useState(false);
  const [manualVerifyResult, setManualVerifyResult] = useState(null);

  // Registration Details Modal State (Requirement 7)
  const [selectedRegDetailsId, setSelectedRegDetailsId] = useState(null);
  const [regDetailsModalOpen, setRegDetailsModalOpen] = useState(false);
  const [regDetailsLoading, setRegDetailsLoading] = useState(false);
  const [regDetailsData, setRegDetailsData] = useState(null);
  const [regDetailsError, setRegDetailsError] = useState(null);

  const handleOpenRegistrationDetails = async (registrationId) => {
    if (!registrationId) return;
    setSelectedRegDetailsId(registrationId);
    setRegDetailsModalOpen(true);
    setRegDetailsLoading(true);
    setRegDetailsError(null);
    setRegDetailsData(null);

    try {
      const res = await fetchRegistrationById(registrationId);
      if (res && res.success && res.data) {
        setRegDetailsData(res.data);
      } else {
        setRegDetailsError(res?.message || 'Failed to load registration details from database.');
      }
    } catch (err) {
      setRegDetailsError('Server or network error loading registration details.');
    } finally {
      setRegDetailsLoading(false);
    }
  };

  // Fetch admin events, registrations, tickets, smart attendance, and certificates from MongoDB
  const loadAdminData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const [eventsRes, regsRes, ticketRes, attRes, certRes] = await Promise.all([
        fetchAdminEvents().catch(() => ({ success: false, data: [] })),
        fetchAdminRegistrations(registrationFilterEventId || null).catch(() => ({ success: false, data: [] })),
        fetchAdminTickets().catch(() => ({ success: false, data: [] })),
        fetchAdminAttendanceRoster(attendanceFilterEventId || null).catch(() => ({ success: false, data: [] })),
        fetchAdminCertificates(certEventFilter || null).catch(() => ({ success: false, data: [] })),
      ]);

      if (eventsRes?.success && Array.isArray(eventsRes.data)) {
        setEvents(eventsRes.data);
        if (eventsRes.counts) {
          setCounts(eventsRes.counts);
        }
      } else if (eventsRes?.status === 401 || eventsRes?.status === 403) {
        setFeedback({ type: 'error', message: eventsRes.message || 'Session expired. Please log in again.' });
      }

      if (regsRes?.success && Array.isArray(regsRes.data)) {
        setRegistrations(regsRes.data);
      }

      if (ticketRes?.success && Array.isArray(ticketRes.data)) {
        setTickets(ticketRes.data);
        if (ticketRes.counts) {
          setTicketCounts(ticketRes.counts);
        }
      }

      if (attRes?.success && Array.isArray(attRes.data)) {
        setSmartAttendanceList(attRes.data);
        if (attRes.stats) {
          setSmartAttendanceStats(attRes.stats);
        }
      }

      if (certRes?.success && Array.isArray(certRes.data)) {
        setAdminCertificates(certRes.data);
        if (certRes.summary) {
          setCertSummary(certRes.summary);
        }
      }
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [attendanceFilterEventId, certEventFilter, registrationFilterEventId]);

  useEffect(() => {
    loadAdminData();

    // Listen for real-time Socket.IO broadcasts
    const socket = getSocket();
    const handleSocketUpdate = () => {
      loadAdminData(true);
    };

    socket.on('event_created', handleSocketUpdate);
    socket.on('event_updated', handleSocketUpdate);
    socket.on('event_deleted', handleSocketUpdate);
    socket.on('registration_created', handleSocketUpdate);
    socket.on('registration_cancelled', handleSocketUpdate);
    socket.on('event_seats_updated', handleSocketUpdate);
    socket.on('ticket_issued', handleSocketUpdate);
    socket.on('attendance_checked_in', handleSocketUpdate);
    socket.on('attendance:updated', handleSocketUpdate);
    socket.on('certificate:updated', handleSocketUpdate);

    return () => {
      socket.off('event_created', handleSocketUpdate);
      socket.off('event_updated', handleSocketUpdate);
      socket.off('event_deleted', handleSocketUpdate);
      socket.off('registration_created', handleSocketUpdate);
      socket.off('registration_cancelled', handleSocketUpdate);
      socket.off('event_seats_updated', handleSocketUpdate);
      socket.off('ticket_issued', handleSocketUpdate);
      socket.off('attendance_checked_in', handleSocketUpdate);
      socket.off('attendance:updated', handleSocketUpdate);
      socket.off('certificate:updated', handleSocketUpdate);
    };
  }, [loadAdminData]);

  // Manual Ticket Pass Code Verification Handler (Requirement 1, 2, 3, 5, 6, 7)
  const handleManualVerifyTicket = async (e) => {
    if (e) e.preventDefault();
    const cleanCode = (manualVerifyPassCode || '').trim();
    if (!cleanCode) {
      setManualVerifyResult({
        type: 'INVALID_TICKET',
        message: 'Ticket/Pass Code could not be verified.',
      });
      return;
    }
    if (!attendanceFilterEventId) {
      setManualVerifyResult({
        type: 'INVALID_TICKET',
        message: 'Please select an event before verifying a ticket.',
      });
      return;
    }

    // Check if user entered an Event Registration QR or URL instead of an attendee ticket pass
    const regUrlMatch = cleanCode.match(/\/events\/([a-fA-F0-9]{24})\/register/i) || cleanCode.match(/\/events\/([a-fA-F0-9]{24})/i);
    if (regUrlMatch || cleanCode.toLowerCase().includes('/register')) {
      const detectedEventId = regUrlMatch ? regUrlMatch[1] : null;
      setManualVerifyResult({
        type: 'REGISTRATION_QR_NOT_TICKET',
        message: 'Event Registration URL Detected',
        data: {
          eventId: detectedEventId,
          registerUrl: detectedEventId ? `/events/${detectedEventId}/register` : cleanCode,
        },
      });
      return;
    }

    setManualVerifyLoading(true);
    setManualVerifyResult(null);

    try {
      const res = await verifyTicketPassCode(cleanCode, attendanceFilterEventId);

      if (res.success) {
        setManualVerifyResult({
          type: 'SUCCESS',
          message: 'Attendance Marked: PRESENT',
          data: res.data,
        });
        setManualVerifyPassCode('');
        loadAdminData(true);
      } else if (res.alreadyCheckedIn || res.status === 409) {
        setManualVerifyResult({
          type: 'ALREADY_VERIFIED',
          message: 'Attendance was already marked PRESENT.',
          data: res.data,
        });
        loadAdminData(true);
      } else if (res.wrongEvent || (res.message && res.message.toLowerCase().includes('another event'))) {
        setManualVerifyResult({
          type: 'WRONG_EVENT',
          message: 'This ticket belongs to another event.',
          data: res.data,
        });
      } else {
        setManualVerifyResult({
          type: 'INVALID_TICKET',
          message: 'Ticket/Pass Code could not be verified.',
          data: res.data,
        });
      }
    } catch (err) {
      const msg = err.message || '';
      if (err.wrongEvent || msg.toLowerCase().includes('another event')) {
        setManualVerifyResult({
          type: 'WRONG_EVENT',
          message: 'This ticket belongs to another event.',
          data: err.data,
        });
      } else if (err.alreadyCheckedIn || err.status === 409 || msg.includes('already')) {
        setManualVerifyResult({
          type: 'ALREADY_VERIFIED',
          message: 'Attendance was already marked PRESENT.',
          data: err.data,
        });
        loadAdminData(true);
      } else {
        setManualVerifyResult({
          type: 'INVALID_TICKET',
          message: 'Ticket/Pass Code could not be verified.',
          data: err.data,
        });
      }
    } finally {
      setManualVerifyLoading(false);
    }
  };

  const handleClearManualVerify = () => {
    setManualVerifyPassCode('');
    setManualVerifyResult(null);
  };

  // Phase 7: Event filter change for attendance
  const handleFilterAttendanceByEvent = async (eventId) => {
    setAttendanceFilterEventId(eventId);
    try {
      const res = await fetchAdminAttendance(eventId || null);
      if (res.success && Array.isArray(res.data)) {
        setSmartAttendanceList(res.data);
        if (res.stats || res.counts) setSmartAttendanceStats(res.stats || res.counts);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Phase 7: Execute Check-in via QR payload or code
  const handleExecuteCheckIn = async (customPayload = null) => {
    const raw = (customPayload || manualQrPayload || '').trim();
    if (!raw) {
      setCheckInResult({
        success: false,
        message: 'Please enter or scan a valid QR ticket payload or ticket code.',
      });
      return;
    }

    const qrPayload = raw.startsWith('EVENTSYNC:TICKET:') ? raw : `EVENTSYNC:TICKET:${raw.toUpperCase()}`;

    setCheckInLoading(true);
    setCheckInResult(null);

    try {
      const res = await checkInTicket({
        qrPayload,
        eventId: attendanceFilterEventId || null,
      });
      if (res.success) {
        setCheckInResult({
          success: true,
          message: res.message || 'Check-in verified and recorded successfully!',
          data: res.data,
        });
        setManualQrPayload('');
        loadAdminData(true);
      } else if (res.status === 409 || res.alreadyCheckedIn) {
        setCheckInResult({
          success: false,
          alreadyCheckedIn: true,
          message: res.message || 'Attendee has already been checked in for this event.',
          data: res.data,
        });
        loadAdminData(true);
      } else {
        setCheckInResult({
          success: false,
          message: res.message || 'Check-in failed. Please verify ticket status.',
        });
      }
    } catch (err) {
      setCheckInResult({
        success: false,
        message: err.message || 'Network error while checking in attendee.',
      });
    } finally {
      setCheckInLoading(false);
    }
  };


  // Open Create Event Modal
  const handleOpenCreateModal = () => {
    setFormData(initialFormState);
    setPosterFile(null);
    setPosterPreview(null);
    setRemovePoster(false);
    setFormError(null);
    setModalMode('CREATE');
    setActiveEventId(null);
    setIsModalOpen(true);
  };

  // Open Edit Event Modal with existing MongoDB event data
  const handleOpenEditModal = (event) => {
    // Format date for HTML date input: YYYY-MM-DD
    let formattedDate = '';
    if (event.date) {
      const d = new Date(event.date);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toISOString().split('T')[0];
      }
    }

    let formattedDeadline = '';
    if (event.registrationDeadline) {
      const dl = new Date(event.registrationDeadline);
      if (!isNaN(dl.getTime())) {
        formattedDeadline = dl.toISOString().split('T')[0];
      }
    }

    const coords = Array.isArray(event.coordinators) ? event.coordinators : [];

    setFormData({
      title: event.title || '',
      description: event.description || '',
      category: event.category || '',
      mode: event.mode || 'Offline',
      registrationDeadline: formattedDeadline,
      date: formattedDate,
      time: event.time || '',
      venue: event.venue || '',
      capacity: event.capacity !== undefined ? String(event.capacity) : '',
      maxTeamSize: event.maxTeamSize !== undefined ? String(event.maxTeamSize) : '1',
      isPaid: false,
      fee: '0',
      prizeMoney: event.prizeMoney !== undefined ? String(event.prizeMoney) : '0',
      firstPrize: event.firstPrize !== undefined ? String(event.firstPrize) : '0',
      secondPrize: event.secondPrize !== undefined ? String(event.secondPrize) : '0',
      thirdPrize: event.thirdPrize !== undefined ? String(event.thirdPrize) : '0',
      participationCertificateAvailable: event.participationCertificateAvailable !== false,
      facultyCoordinatorName: event.facultyCoordinatorName || event.facultyCoordinator || '',
      coordinator1Name: coords[0]?.coordinatorName || coords[0]?.name || '',
      coordinator1Phone: coords[0]?.coordinatorPhone || coords[0]?.phone || '',
      coordinator2Name: coords[1]?.coordinatorName || coords[1]?.name || '',
      coordinator2Phone: coords[1]?.coordinatorPhone || coords[1]?.phone || '',
      coordinator3Name: coords[2]?.coordinatorName || coords[2]?.name || '',
      coordinator3Phone: coords[2]?.coordinatorPhone || coords[2]?.phone || '',
      status: event.status || 'DRAFT',
      gradient: event.gradient || '',
    });
    setPosterFile(null);
    setRemovePoster(false);
    if (event.poster?.filename) {
      setPosterPreview(getEventPosterUrl(event._id));
    } else {
      setPosterPreview(null);
    }
    setFormError(null);
    setModalMode('EDIT');
    setActiveEventId(event._id);
    setIsModalOpen(true);
  };

  // Poster File Selection Handler
  const handlePosterChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setFormError('Poster image must be a JPEG, PNG, or WEBP file.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFormError('Poster image must be smaller than 5MB.');
        return;
      }
      setPosterFile(file);
      setPosterPreview(URL.createObjectURL(file));
      setRemovePoster(false);
    }
  };

  // Remove Poster Handler
  const handleRemovePoster = () => {
    setPosterFile(null);
    setPosterPreview(null);
    setRemovePoster(true);
  };

  // Open Dynamic Registration QR Modal
  const handleOpenRegQrModal = async (event) => {
    setRegQrEvent(event);
    setRegQrModalOpen(true);
    setRegQrLoading(true);
    setRegQrDataUrl('');
    const publicUrl = getPublicAppUrl();
    try {
      const res = await fetchEventRegistrationQr(event._id, publicUrl);
      if (res.success && res.data?.dataUrl) {
        setRegQrDataUrl(res.data.dataUrl);
      } else {
        setRegQrDataUrl(getEventRegistrationQrUrl(event._id, publicUrl));
      }
    } catch (err) {
      setRegQrDataUrl(getEventRegistrationQrUrl(event._id, publicUrl));
    } finally {
      setRegQrLoading(false);
    }
  };

  // Quick-Copy Dynamic Registration Link
  const handleCopyRegLink = async (eventId) => {
    const url = getEventRegistrationUrl(eventId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedEventId(eventId);
      setFeedback({
        type: 'success',
        message: `Event Registration Link copied to clipboard: ${url}`,
      });
      setTimeout(() => setCopiedEventId(null), 3000);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Unable to auto-copy to clipboard. Link: ${url}`,
      });
    }
  };

  // Form Submission (Create or Edit)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Client-side validation
    if (!formData.title.trim() || formData.title.trim().length < 3) {
      setFormError('Event title must be at least 3 characters.');
      return;
    }

    if (!formData.description.trim() || formData.description.trim().length < 10) {
      setFormError('Event description must be at least 10 characters.');
      return;
    }

    if (!formData.category) {
      setFormError('Please select a valid event category.');
      return;
    }

    if (!formData.date) {
      setFormError('Please select a valid event date.');
      return;
    }

    if (!formData.time.trim()) {
      setFormError('Event time is required (e.g. 10:00 AM - 1:00 PM).');
      return;
    }

    if (!formData.venue.trim()) {
      setFormError('Event venue is required.');
      return;
    }

    const numCapacity = parseInt(formData.capacity, 10);
    if (isNaN(numCapacity) || numCapacity < 1) {
      setFormError('Capacity must be a positive integer (at least 1).');
      return;
    }

    const numFirstPrize = Math.max(0, parseFloat(formData.firstPrize) || 0);
    const numSecondPrize = Math.max(0, parseFloat(formData.secondPrize) || 0);
    const numThirdPrize = Math.max(0, parseFloat(formData.thirdPrize) || 0);
    let numPrizeMoney = Math.max(0, parseFloat(formData.prizeMoney) || 0);
    if (!numPrizeMoney && (numFirstPrize || numSecondPrize || numThirdPrize)) {
      numPrizeMoney = numFirstPrize + numSecondPrize + numThirdPrize;
    }

    // Validate registration deadline if set
    if (formData.registrationDeadline) {
      const dlDate = new Date(formData.registrationDeadline);
      const evDate = new Date(formData.date);
      if (isNaN(dlDate.getTime())) {
        setFormError('Invalid registration deadline date.');
        return;
      }
      if (!isNaN(evDate.getTime()) && dlDate > evDate) {
        setFormError('Registration deadline cannot be after the event conducting date.');
        return;
      }
    }

    // Assemble up to 3 coordinators
    const coords = [];
    if (formData.coordinator1Name.trim() || formData.coordinator1Phone.trim()) {
      coords.push({
        coordinatorName: formData.coordinator1Name.trim(),
        coordinatorPhone: formData.coordinator1Phone.trim(),
      });
    }
    if (formData.coordinator2Name.trim() || formData.coordinator2Phone.trim()) {
      coords.push({
        coordinatorName: formData.coordinator2Name.trim(),
        coordinatorPhone: formData.coordinator2Phone.trim(),
      });
    }
    if (formData.coordinator3Name.trim() || formData.coordinator3Phone.trim()) {
      coords.push({
        coordinatorName: formData.coordinator3Name.trim(),
        coordinatorPhone: formData.coordinator3Phone.trim(),
      });
    }

    setFormSubmitting(true);

    const fd = new FormData();
    fd.append('title', formData.title.trim());
    fd.append('description', formData.description.trim());
    fd.append('category', formData.category);
    fd.append('mode', formData.mode || 'Offline');
    if (formData.registrationDeadline) {
      fd.append('registrationDeadline', formData.registrationDeadline);
    }
    fd.append('date', formData.date);
    fd.append('time', formData.time.trim());
    fd.append('venue', formData.venue.trim());
    fd.append('capacity', numCapacity);
    fd.append('maxTeamSize', Math.max(1, parseInt(formData.maxTeamSize, 10) || 1));
    fd.append('isPaid', 'false');
    fd.append('fee', '0');
    fd.append('prizeMoney', numPrizeMoney);
    fd.append('firstPrize', numFirstPrize);
    fd.append('secondPrize', numSecondPrize);
    fd.append('thirdPrize', numThirdPrize);
    fd.append('participationCertificateAvailable', String(formData.participationCertificateAvailable));
    fd.append('facultyCoordinatorName', formData.facultyCoordinatorName.trim());
    fd.append('coordinators', JSON.stringify(coords));
    fd.append('status', formData.status);
    if (formData.gradient) fd.append('gradient', formData.gradient.trim());
    if (posterFile) fd.append('poster', posterFile);
    if (removePoster) fd.append('removePoster', 'true');

    try {
      let res;
      if (modalMode === 'CREATE') {
        res = await createEvent(fd);
      } else {
        res = await updateEvent(activeEventId, fd);
      }

      if (res.success) {
        setIsModalOpen(false);
        setFeedback({
          type: 'success',
          message: modalMode === 'CREATE' ? 'Event created successfully.' : 'Event updated successfully.',
        });
        await loadAdminEvents(true);
      } else {
        setFormError(res.message || 'Operation failed. Please verify your inputs.');
      }
    } catch (err) {
      setFormError('Unable to connect to server. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Status Transitions (DRAFT -> PUBLISHED or PUBLISHED -> DRAFT)
  const handleSetStatus = async (event, newStatus) => {
    try {
      const res = await updateEvent(event._id, { status: newStatus });
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Event "${event.title}" status changed to ${newStatus}.`,
        });
        await loadAdminEvents(true);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to update event status.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to update event status.' });
    }
  };

  // Open confirmation modal for dangerous status transitions (Cancellation or Republishing)
  const handleOpenStatusConfirm = (event, targetAction) => {
    setStatusTargetEvent(event);
    setStatusTargetAction(targetAction);
    setStatusModalOpen(true);
  };

  // Execute confirmed status change
  const handleExecuteStatusConfirm = async () => {
    if (!statusTargetEvent || !statusTargetAction) return;
    setStatusSubmitting(true);
    try {
      const res = await updateEvent(statusTargetEvent._id, { status: statusTargetAction });
      if (res.success) {
        setStatusModalOpen(false);
        setStatusTargetEvent(null);
        setStatusTargetAction(null);
        setFeedback({
          type: 'success',
          message: `Event status successfully changed to ${statusTargetAction}.`,
        });
        await loadAdminEvents(true);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to update event status.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to update event status.' });
    } finally {
      setStatusSubmitting(false);
    }
  };

  const loadAdminEvents = loadAdminData;

  // Open Delete Confirmation
  const handleOpenDelete = (event) => {
    setEventToDelete(event);
    setDeleteModalOpen(true);
  };

  // Execute Delete
  const handleExecuteDelete = async () => {
    if (!eventToDelete) return;
    setDeleteSubmitting(true);
    try {
      const res = await deleteEvent(eventToDelete._id);
      if (res.success) {
        setDeleteModalOpen(false);
        setEventToDelete(null);
        setFeedback({ type: 'success', message: 'Event permanently deleted from MongoDB.' });
        await loadAdminData(true);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to delete event.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to delete event.' });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Smart Attendance Handlers (Requirements 14, 15, 16)
  const handleMarkAttendance = async (registrationId, attendanceId, status, memberRollNumber = null) => {
    const markKey = memberRollNumber ? `${registrationId}_${memberRollNumber}` : (registrationId || attendanceId);
    setMarkingAttendeeId(markKey);
    try {
      const res = await markAttendance({ registrationId, attendanceId, status, memberRollNumber });
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Attendance marked as ${status}.`,
        });
        if (passScanPreview && (passScanPreview.registrationId === registrationId || passScanPreview.attendanceId === attendanceId)) {
          setPassScanPreview(prev => prev ? { ...prev, currentStatus: status } : null);
        }
        await loadAdminData(true);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to update attendance.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error updating attendance.' });
    } finally {
      setMarkingAttendeeId(null);
    }
  };

  const handleOpenBulkModal = (status) => {
    setBulkStatusToApply(status);
    setBulkModalOpen(true);
  };

  const handleExecuteBulkAttendance = async () => {
    if (!bulkStatusToApply) return;
    setBulkSubmitting(true);
    try {
      const res = await markAllAttendance({
        eventId: attendanceFilterEventId || null,
        status: bulkStatusToApply,
      });
      if (res.success) {
        setBulkModalOpen(false);
        setFeedback({
          type: 'success',
          message: `Bulk update successful: ${res.count || 0} attendees marked as ${bulkStatusToApply}.`,
        });
        await loadAdminData(true);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to bulk mark attendance.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error during bulk attendance.' });
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Digital Pass Scanner Handler (Requirement 15)
  const handleScanPassPayload = async (payload) => {
    const raw = payload || manualQrPayload;
    if (!raw || !raw.trim()) return;
    setCheckInLoading(true);
    setScannerError(null);
    try {
      const res = await scanDigitalPass(raw.trim());
      if (res.success && res.data) {
        setPassScanPreview(res.data);
        setFeedback({
          type: 'success',
          message: 'Attendee pass verified! Please confirm attendance below.',
        });
      } else {
        setScannerError(res.message || 'Pass invalid or not found.');
        setPassScanPreview(null);
      }
    } catch (err) {
      setScannerError('Error verifying digital pass.');
      setPassScanPreview(null);
    } finally {
      setCheckInLoading(false);
    }
  };

  // Certificate Management Handlers (Requirements 18, 20)
  const handleIssueCertificate = async (certificateId, registrationId, memberRollNumber = null) => {
    const certKey = memberRollNumber ? `${registrationId}_${memberRollNumber}` : (certificateId || registrationId);
    setIssuingCertId(certKey);
    try {
      const res = await updateCertificateStatus({
        certificateId,
        registrationId,
        memberRollNumber,
        status: 'ISSUED',
      });
      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'Certificate officially ISSUED and recorded.',
        });
        await loadAdminData(true);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to issue certificate.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error issuing certificate.' });
    } finally {
      setIssuingCertId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Breadcrumb & Session Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          <ArrowLeft size={16} />
          <span>Return to Homepage</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Badge variant="warning" dot>EventAdmin Session Active</Badge>
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => loadAdminEvents(false)}
            title="Refresh database records"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Organizer Control Header */}
      <div
        className="glass-panel"
        style={{
          padding: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)',
            }}
          >
            <ShieldCheck size={32} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>
                {user ? user.name : 'EventAdmin Control Center'}
              </h1>
              <Badge variant="warning">EVENTADMIN</Badge>
            </div>
            <div style={{ display: 'flex', gap: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.88rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={14} />
                <span>{user?.email}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Phone size={14} />
                <span>{user?.phone}</span>
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          icon={PlusCircle}
          onClick={handleOpenCreateModal}
          style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}
        >
          Create New Event
        </Button>
      </div>

      {/* User Feedback Alerts */}
      {feedback && (
        <Alert
          variant={feedback.type === 'success' ? 'success' : 'error'}
          onDismiss={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      )}

      {/* Live MongoDB Database Metrics (100% Dynamic - ZERO Fake Numbers) */}
      <div className="grid-cards" style={{ marginTop: 0 }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Total Events</div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800' }}>{counts.total}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>All created events</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Published Events</div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#10B981' }}>{counts.published}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Publicly discoverable</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Total Registrations</div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#6366F1' }}>{registrations.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Confirmed student RSVPs</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Digital Passes</span>
            <FileCheck size={16} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: ticketCounts.active > 0 ? '#38BDF8' : '#9CA3AF' }}>
            {ticketCounts.active}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {ticketCounts.total} total issued
          </div>
        </div>

        <div
          className="glass-panel"
          style={{ padding: '1.25rem', cursor: 'pointer', borderColor: 'rgba(16, 185, 129, 0.25)' }}
          onClick={() => setActiveAdminTab('ATTENDANCE')}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Verified Present</span>
            <UserCheck size={16} color="#10B981" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: smartAttendanceStats.present > 0 ? '#10B981' : '#9CA3AF' }}>
            {smartAttendanceStats.present}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {smartAttendanceStats.total > 0 ? Math.round((smartAttendanceStats.present / smartAttendanceStats.total) * 100) : 0}% attendance rate &rarr;
          </div>
        </div>

        <div
          className="glass-panel"
          style={{ padding: '1.25rem', cursor: 'pointer', borderColor: 'rgba(139, 92, 246, 0.25)' }}
          onClick={() => setActiveAdminTab('CERTIFICATES')}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Certificates Issued</span>
            <Award size={16} color="#8B5CF6" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: certSummary.issued > 0 ? '#8B5CF6' : '#9CA3AF' }}>
            {certSummary.issued}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {certSummary.received} confirmed received &rarr;
          </div>
        </div>
      </div>

      {/* Admin Module Navigation Tabs (Requirement 14, 18, 22) */}
      <div
        className="glass-panel"
        style={{
          padding: '0.75rem',
          display: 'flex',
          gap: '0.65rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          borderRadius: 'var(--radius-lg)',
          marginTop: '0.5rem',
          marginBottom: '0.5rem',
        }}
      >
        <Button
          variant={activeAdminTab === 'EVENTS' ? 'primary' : 'secondary'}
          size="sm"
          icon={Calendar}
          onClick={() => setActiveAdminTab('EVENTS')}
          style={activeAdminTab === 'EVENTS' ? { background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' } : {}}
        >
          Event Operations ({events.length})
        </Button>
        <Button
          variant={activeAdminTab === 'ATTENDANCE' ? 'primary' : 'secondary'}
          size="sm"
          icon={UserCheck}
          onClick={() => setActiveAdminTab('ATTENDANCE')}
          style={activeAdminTab === 'ATTENDANCE' ? { background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' } : {}}
        >
          Smart Attendance ({smartAttendanceList.length})
        </Button>
        <Button
          variant={activeAdminTab === 'CERTIFICATES' ? 'primary' : 'secondary'}
          size="sm"
          icon={Award}
          onClick={() => setActiveAdminTab('CERTIFICATES')}
          style={activeAdminTab === 'CERTIFICATES' ? { background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' } : {}}
        >
          Certificates ({adminCertificates.length})
        </Button>
        <Button
          variant={activeAdminTab === 'REGISTRATIONS' ? 'primary' : 'secondary'}
          size="sm"
          icon={Users}
          onClick={() => setActiveAdminTab('REGISTRATIONS')}
        >
          Registrations Roster ({registrations.length})
        </Button>
      </div>

      {/* Active Event Operations Section (Requirement 7 & 22) */}
      {activeAdminTab === 'EVENTS' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '700' }}>Campus Event Operations</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                Create, edit, publish, or remove events stored in MongoDB.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {events.length > 0 && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Showing <strong>{events.length}</strong> events
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="grid-cards">
              <div className="glass-panel" style={{ padding: '1.5rem' }}><LoadingSkeleton height="160px" /></div>
              <div className="glass-panel" style={{ padding: '1.5rem' }}><LoadingSkeleton height="160px" /></div>
            </div>
          ) : events.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No events created yet"
              description="No events created yet. Create your first campus event."
              action={
                <Button
                  variant="primary"
                  icon={PlusCircle}
                  onClick={handleOpenCreateModal}
                  style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}
                >
                  Create First Event
                </Button>
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {events.map((event) => {
                const displayDate = event.date
                  ? new Date(event.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                  : 'TBA';

                const statusBadgeVariant =
                  event.status === 'PUBLISHED'
                    ? 'success'
                    : event.status === 'DRAFT'
                      ? 'neutral'
                      : 'danger';

                // Dynamic MongoDB metrics for this specific event
                const eventRegistrations = registrations.filter(
                  (r) => (r.event?._id || r.event) === event._id && r.status !== 'CANCELLED'
                );
                const registeredCount = eventRegistrations.length;
                const availableSeats = event.availableSeats !== undefined
                  ? event.availableSeats
                  : Math.max(0, event.capacity - registeredCount);
                const attendanceRecords = smartAttendanceList || [];
                const eventCheckIns = attendanceRecords.filter(
                  (a) => (a.event?._id || a.event) === event._id && (a.status === 'PRESENT' || a.status === 'CHECKED_IN' || a.attendanceStatus === 'PRESENT' || a.attendanceStatus === 'CHECKED_IN')
                ).length;
                const attendanceRate = registeredCount > 0
                  ? Math.round((eventCheckIns / registeredCount) * 100)
                  : 0;

                return (
                  <div
                    key={event._id}
                    className="glass-panel"
                    style={{
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                        {/* Event Poster Thumbnail or Theme Gradient */}
                        {event.poster?.filename ? (
                          <img
                            src={getEventPosterUrl(event._id)}
                            alt={event.title}
                            style={{
                              width: '56px',
                              height: '56px',
                              borderRadius: '12px',
                              objectFit: 'cover',
                              border: '1px solid var(--border-subtle)',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '56px',
                              height: '56px',
                              borderRadius: '12px',
                              background: event.gradient || THEME_PRESETS[0].value,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              flexShrink: 0,
                            }}
                          >
                            <Calendar size={26} />
                          </div>
                        )}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>{event.title}</h3>
                            <Badge variant={statusBadgeVariant} dot={event.status === 'PUBLISHED'}>
                              {event.status}
                            </Badge>
                            <Badge variant="info">{event.category}</Badge>
                            <Badge variant={event.isPaid ? 'warning' : 'success'}>
                              {event.isPaid ? `₹${event.fee}` : 'FREE'}
                            </Badge>
                            {(event.prizeMoney > 0 || event.firstPrize > 0 || event.secondPrize > 0 || event.thirdPrize > 0) && (
                              <span
                                style={{
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: 'var(--radius-full)',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  border: '1px solid rgba(245, 158, 11, 0.35)',
                                  color: '#FCD34D',
                                  fontSize: '0.75rem',
                                  fontWeight: '700',
                                }}
                              >
                                🏆 ₹{Number(event.prizeMoney || ((Number(event.firstPrize) || 0) + (Number(event.secondPrize) || 0) + (Number(event.thirdPrize) || 0))).toLocaleString('en-IN')}
                                {(event.firstPrize > 0 || event.secondPrize > 0 || event.thirdPrize > 0)
                                  ? ` (1st: ₹${event.firstPrize || 0}, 2nd: ₹${event.secondPrize || 0}, 3rd: ₹${event.thirdPrize || 0})`
                                  : ''}
                              </span>
                            )}
                            {event.poster?.filename && (
                              <Badge variant="neutral">Poster Attached</Badge>
                            )}
                          </div>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '720px', lineHeight: 1.5 }}>
                            {event.description}
                          </p>
                        </div>
                      </div>

                      {/* Operational Action Buttons (Row 1: General & Lifecycle) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {/* View details page */}
                        <Link to={`/events/${event._id}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" icon={Eye} title="Preview public event details">
                            View Details
                          </Button>
                        </Link>

                        {/* Edit event & poster */}
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Edit3}
                          onClick={() => handleOpenEditModal(event)}
                          title="Edit event details or change/remove poster"
                        >
                          Edit
                        </Button>

                        {/* Status Lifecycle Actions */}
                        {event.status === 'DRAFT' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetStatus(event, 'PUBLISHED')}
                            style={{
                              borderColor: 'rgba(16, 185, 129, 0.4)',
                              color: '#34D399',
                            }}
                          >
                            Publish
                          </Button>
                        )}

                        {event.status === 'PUBLISHED' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetStatus(event, 'DRAFT')}
                              style={{
                                borderColor: 'rgba(156, 163, 175, 0.4)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              Unpublish
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenStatusConfirm(event, 'CANCELLED')}
                              style={{
                                borderColor: 'rgba(239, 68, 68, 0.4)',
                                color: '#F87171',
                              }}
                            >
                              Cancel Event
                            </Button>
                          </>
                        )}

                        {event.status === 'CANCELLED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenStatusConfirm(event, 'PUBLISHED')}
                            style={{
                              borderColor: 'rgba(245, 158, 11, 0.4)',
                              color: '#FBBF24',
                            }}
                          >
                            Republish
                          </Button>
                        )}

                        {/* Delete button */}
                        <Button
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleOpenDelete(event)}
                          title="Permanently delete event"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    {/* Real-time Dynamic MongoDB Metrics for This Event */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: '0.75rem',
                        background: 'var(--bg-tertiary)',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Capacity</div>
                        <div style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--text-primary)' }}>{event.capacity}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Registered</div>
                        <div style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--accent-primary)' }}>{registeredCount}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Available Seats</div>
                        <div style={{ fontWeight: '800', fontSize: '1.1rem', color: availableSeats > 0 ? '#10B981' : '#EF4444' }}>{availableSeats}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Checked In</div>
                        <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#10B981' }}>{eventCheckIns}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Attendance Rate</div>
                        <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#38BDF8' }}>{attendanceRate}%</div>
                      </div>
                    </div>

                    {/* Per-Event Actions: Registration Link, QR, Rosters, Tickets & Gate Attendance */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                      {/* Copy dynamic student registration link */}
                      <Button
                        variant="outline"
                        size="sm"
                        icon={copiedEventId === event._id ? Check : Link2}
                        onClick={() => handleCopyRegLink(event._id)}
                        title="Copy dynamic student registration URL to clipboard"
                        style={{ borderColor: copiedEventId === event._id ? '#10B981' : undefined }}
                      >
                        {copiedEventId === event._id ? 'Copied!' : 'Registration Link'}
                      </Button>

                      {/* View registration QR */}
                      <Button
                        variant="outline"
                        size="sm"
                        icon={QrCode}
                        onClick={() => handleOpenRegQrModal(event)}
                        title="View & share dynamic registration QR code"
                      >
                        Registration QR
                      </Button>

                      {/* Switch to Registrations Roster */}
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Users}
                        onClick={() => {
                          setRegistrationFilterEventId(event._id);
                          setActiveAdminTab('REGISTRATIONS');
                        }}
                        title="View student registrations roster"
                      >
                        Registrations ({registeredCount})
                      </Button>

                      {/* Filter Attendance and Switch Tab */}
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={UserCheck}
                        onClick={() => {
                          setAttendanceFilterEventId(event._id);
                          setActiveAdminTab('ATTENDANCE');
                        }}
                        title="Open Smart Attendance roster for this event"
                      >
                        Attendance ({eventCheckIns})
                      </Button>

                      {/* Filter Certificates and Switch Tab */}
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Award}
                        onClick={() => {
                          setCertEventFilter(event._id);
                          setActiveAdminTab('CERTIFICATES');
                        }}
                        title="Open Certificates tracking for this event"
                      >
                        Certificates
                      </Button>
                    </div>

                    {/* Metadata Row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.5rem',
                        flexWrap: 'wrap',
                        fontSize: '0.84rem',
                        color: 'var(--text-muted)',
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: '0.75rem',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Calendar size={14} style={{ color: 'var(--accent-primary)' }} />
                        <span>{displayDate}</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={14} style={{ color: 'var(--accent-secondary)' }} />
                        <span>{event.time}</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <MapPin size={14} style={{ color: 'var(--accent-rose)' }} />
                        <span>{event.venue}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}



      {/* SMART ATTENDANCE SECTION (Requirements 14, 15, 16, 22) */}
      {activeAdminTab === 'ATTENDANCE' && (
        <div style={{ marginTop: '0.5rem' }} id="smart-attendance-section">
          {/* Header Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UserCheck size={24} color="#10B981" />
                <span>Smart Attendance Live Roster</span>
                <Badge variant="success">REAL-TIME SYNC</Badge>
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                Live attendance verification with instant Socket.IO synchronization across admin and student dashboards.
              </p>
            </div>

            {/* Event Filter & Bulk Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <select
                id="attendance-event-filter-select"
                value={attendanceFilterEventId}
                onChange={(e) => setAttendanceFilterEventId(e.target.value)}
                className="form-input"
                style={{ width: 'auto', minWidth: '220px', padding: '0.45rem 0.75rem', fontSize: '0.86rem' }}
              >
                <option value="">All Events (Overall Roster)</option>
                {events.map((ev) => (
                  <option key={ev._id} value={ev._id}>
                    {ev.title} ({ev.status})
                  </option>
                ))}
              </select>

              {attendanceFilterEventId && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={ShieldCheck}
                  onClick={() => {
                    document.getElementById('verify-ticket-passcode-input')?.focus();
                  }}
                >
                  Verify Ticket Code
                </Button>
              )}

              <Button
                variant="primary"
                size="sm"
                icon={CheckCircle2}
                onClick={() => handleOpenBulkModal('PRESENT')}
                style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                disabled={smartAttendanceList.length === 0}
              >
                Mark All Present
              </Button>

              <Button
                variant="danger"
                size="sm"
                icon={X}
                onClick={() => handleOpenBulkModal('ABSENT')}
                disabled={smartAttendanceList.length === 0}
              >
                Mark All Absent
              </Button>
            </div>
          </div>

          {/* Dynamic Attendance Metrics (Requirement 14) */}
          <div className="grid-cards" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Total Registered</div>
              <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {smartAttendanceStats.total || smartAttendanceList.length}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {attendanceFilterEventId ? 'In selected event' : 'Across all events'}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Present</div>
              <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#10B981' }}>
                {smartAttendanceStats.present}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Verified present
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Absent</div>
              <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#EF4444' }}>
                {smartAttendanceStats.absent}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Marked absent
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Not Marked</div>
              <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#F59E0B' }}>
                {smartAttendanceStats.notMarked}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Awaiting check-in
              </div>
            </div>
          </div>

          {/* MANUAL TICKET PASS CODE VERIFICATION CARD (Requirements 1, 3, 5, 6, 7, 11) */}
          <div
            id="manual-verify-ticket-card"
            className="glass-panel"
            style={{
              padding: '1.5rem',
              marginBottom: '1.5rem',
              borderRadius: '12px',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              background: 'var(--bg-secondary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <ShieldCheck size={22} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                  VERIFY TICKET
                </h3>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '0.25rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
                Manual Pass Code Verification
              </span>
            </div>

            <form
              onSubmit={handleManualVerifyTicket}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem', alignItems: 'flex-end' }}
            >
              {/* Select Event */}
              <div>
                <label
                  htmlFor="verify-ticket-event-select"
                  style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}
                >
                  Selected Event
                </label>
                <select
                  id="verify-ticket-event-select"
                  value={attendanceFilterEventId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    handleFilterAttendanceByEvent(newId);
                    setManualVerifyResult(null);
                  }}
                  className="form-input"
                  style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.9rem' }}
                >
                  <option value="">-- Choose Event --</option>
                  {events.map((ev) => (
                    <option key={ev._id} value={ev._id}>
                      {ev.title} ({ev.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Ticket Pass Code Input */}
              <div>
                <label
                  htmlFor="verify-ticket-passcode-input"
                  style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}
                >
                  Ticket Pass Code
                </label>
                <input
                  type="text"
                  id="verify-ticket-passcode-input"
                  placeholder="Enter Ticket Pass Code (e.g. ES-PASS-XXXXXXXX)"
                  value={manualVerifyPassCode}
                  onChange={(e) => setManualVerifyPassCode(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', fontFamily: 'monospace', fontWeight: '700', padding: '0.6rem 0.85rem', fontSize: '0.92rem' }}
                  disabled={manualVerifyLoading}
                  autoComplete="off"
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  type="submit"
                  id="btn-verify-ticket-submit"
                  variant="primary"
                  icon={CheckCircle2}
                  loading={manualVerifyLoading}
                  disabled={!manualVerifyPassCode.trim() || manualVerifyLoading}
                  style={{ flex: 1, minWidth: '150px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', fontWeight: '800' }}
                >
                  VERIFY TICKET
                </Button>
                {(manualVerifyPassCode || manualVerifyResult) && (
                  <Button
                    type="button"
                    id="btn-verify-ticket-clear"
                    variant="secondary"
                    onClick={handleClearManualVerify}
                  >
                    CLEAR
                  </Button>
                )}
              </div>
            </form>

            {/* Verification Feedback Result Cards */}
            {manualVerifyResult && (
              <div style={{ marginTop: '1.25rem', animation: 'fadeIn 0.2s ease-in-out' }}>
                {/* 1. VERIFIED (SUCCESS) */}
                {manualVerifyResult.type === 'SUCCESS' && (
                  <div
                    id="verify-result-success"
                    style={{
                      padding: '1.25rem 1.5rem',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(5, 150, 105, 0.22) 100%)',
                      border: '2px solid #10B981',
                      boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: '900' }}>
                        <CheckCircle2 size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#10B981', letterSpacing: '0.04em' }}>
                          ✓ VERIFIED
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#E2E8F0' }}>
                          Attendance Marked: PRESENT
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.35)', padding: '0.85rem 1.15rem', borderRadius: '8px', marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem', fontSize: '0.88rem' }}>
                      <div>
                        <span style={{ color: '#94A3B8' }}>Student Name:</span>{' '}
                        <strong style={{ color: '#FFFFFF', fontSize: '0.94rem' }}>
                          {manualVerifyResult.data?.studentName || manualVerifyResult.data?.memberName || 'Student'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#94A3B8' }}>Roll Number:</span>{' '}
                        <strong style={{ color: '#38BDF8' }}>
                          {manualVerifyResult.data?.rollNumber || manualVerifyResult.data?.memberRollNumber || 'N/A'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#94A3B8' }}>Event:</span>{' '}
                        <strong style={{ color: '#F1F5F9' }}>
                          {manualVerifyResult.data?.eventTitle || 'Selected Event'}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ALREADY VERIFIED */}
                {manualVerifyResult.type === 'ALREADY_VERIFIED' && (
                  <div
                    id="verify-result-already"
                    style={{
                      padding: '1.25rem 1.5rem',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(217, 119, 6, 0.2) 100%)',
                      border: '2px solid #F59E0B',
                      boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: '900' }}>
                        <CheckCircle2 size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#F59E0B', letterSpacing: '0.04em' }}>
                          ✓ ALREADY VERIFIED
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#E2E8F0' }}>
                          Attendance was already marked PRESENT.
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.35)', padding: '0.85rem 1.15rem', borderRadius: '8px', marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem', fontSize: '0.88rem' }}>
                      <div>
                        <span style={{ color: '#94A3B8' }}>Student Name:</span>{' '}
                        <strong style={{ color: '#FFFFFF', fontSize: '0.94rem' }}>
                          {manualVerifyResult.data?.studentName || manualVerifyResult.data?.memberName || 'Student'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#94A3B8' }}>Roll Number:</span>{' '}
                        <strong style={{ color: '#F59E0B' }}>
                          {manualVerifyResult.data?.rollNumber || manualVerifyResult.data?.memberRollNumber || 'N/A'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#94A3B8' }}>Event:</span>{' '}
                        <strong style={{ color: '#F1F5F9' }}>
                          {manualVerifyResult.data?.eventTitle || 'Selected Event'}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. WRONG EVENT */}
                {manualVerifyResult.type === 'WRONG_EVENT' && (
                  <div
                    id="verify-result-wrong-event"
                    style={{
                      padding: '1.25rem 1.5rem',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, rgba(185, 28, 28, 0.22) 100%)',
                      border: '2px solid #EF4444',
                      boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: '900' }}>
                        <X size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#EF4444', letterSpacing: '0.04em' }}>
                          ✕ INVALID FOR THIS EVENT
                        </div>
                        <div style={{ fontSize: '0.92rem', color: '#FCA5A5', fontWeight: '700', marginTop: '0.2rem' }}>
                          This ticket belongs to another event.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. INVALID TICKET */}
                {manualVerifyResult.type === 'INVALID_TICKET' && (
                  <div
                    id="verify-result-invalid-ticket"
                    style={{
                      padding: '1.25rem 1.5rem',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, rgba(185, 28, 28, 0.22) 100%)',
                      border: '2px solid #EF4444',
                      boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: '900' }}>
                        <X size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#EF4444', letterSpacing: '0.04em' }}>
                          ✕ INVALID TICKET
                        </div>
                        <div style={{ fontSize: '0.92rem', color: '#FCA5A5', fontWeight: '700', marginTop: '0.2rem' }}>
                          Ticket/Pass Code could not be verified.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. REGISTRATION QR / URL DETECTED IN TICKET SCANNER */}
                {manualVerifyResult.type === 'REGISTRATION_QR_NOT_TICKET' && (
                  <div
                    id="verify-result-registration-url"
                    style={{
                      padding: '1.25rem 1.5rem',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.22) 100%)',
                      border: '2px solid #F59E0B',
                      boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000000', fontWeight: '900', flexShrink: 0 }}>
                        <AlertTriangle size={22} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#F59E0B', letterSpacing: '0.03em' }}>
                          ⚠️ EVENT REGISTRATION QR CODE DETECTED
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#FDE68A', fontWeight: '600', marginTop: '0.25rem', lineHeight: '1.4' }}>
                          You scanned or pasted an Event Registration link, not an Attendee Entry Pass code.
                        </div>
                        <p style={{ fontSize: '0.82rem', color: '#E2E8F0', marginTop: '0.35rem', lineHeight: '1.4' }}>
                          This code is used by students to register for events. To mark attendance, please scan the attendee's <strong>Digital Event Pass</strong> (format: <code>EVENTSYNC:TICKET:...</code> or <code>ES-TCK-...</code>).
                        </p>
                        {manualVerifyResult.data?.registerUrl && (
                          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <a
                              href={manualVerifyResult.data.registerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ textDecoration: 'none' }}
                            >
                              <Button variant="primary" size="sm" icon={ExternalLink}>
                                Open Registration Page
                              </Button>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Event Real MongoDB Status Banner (Requirement 10) */}
          {attendanceFilterEventId && (() => {
            const currentSelectedEvent = events.find((e) => String(e._id) === String(attendanceFilterEventId));
            if (!currentSelectedEvent) return null;
            return (
              <div
                className="glass-panel"
                style={{
                  padding: '1.25rem 1.5rem',
                  marginBottom: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(99, 102, 241, 0.06) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#10B981', fontWeight: '800' }}>
                    Selected Event
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                    {currentSelectedEvent.title}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {currentSelectedEvent.venue} • {currentSelectedEvent.date && new Date(currentSelectedEvent.date).toLocaleDateString()} • {currentSelectedEvent.time}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
                      Registered Participants
                    </div>
                    <div style={{ fontSize: '1.55rem', fontWeight: '900', color: '#6366F1' }}>
                      {smartAttendanceStats.total || smartAttendanceList.length}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
                      Present
                    </div>
                    <div style={{ fontSize: '1.55rem', fontWeight: '900', color: '#10B981' }}>
                      {smartAttendanceStats.present}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
                      Not Marked
                    </div>
                    <div style={{ fontSize: '1.55rem', fontWeight: '900', color: '#F59E0B' }}>
                      {smartAttendanceStats.notMarked}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Participant Attendance Roster Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={19} color="var(--accent-primary)" />
              <span>Participant Attendance Roster</span>
            </h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Total Attendees: <strong style={{ color: '#10B981' }}>{smartAttendanceList.length}</strong>
            </span>
          </div>

          {smartAttendanceList.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="No participants registered yet for this event"
              description="When students register for this event, their live attendance profiles are recorded from MongoDB and displayed here."
            />
          ) : (
            (() => {
              const groups = [];
              const map = new Map();

              for (const item of smartAttendanceList) {
                const regId = String(item.registrationId || item.attendanceId);
                if (!map.has(regId)) {
                  map.set(regId, {
                    registrationId: regId,
                    registrationCode: item.registrationCode || '',
                    isTeam: item.isTeam,
                    teamName: item.teamName || '',
                    eventTitle: item.eventTitle || '',
                    members: [],
                  });
                  groups.push(map.get(regId));
                }
                map.get(regId).members.push(item);
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {groups.map((group, groupIdx) => {
                    const isTeam = group.isTeam && group.members.length > 0;

                    return (
                      <div
                        key={group.registrationId}
                        className="glass-panel"
                        style={{
                          borderRadius: '12px',
                          border: '1px solid var(--border-subtle)',
                          overflow: 'hidden',
                          background: isTeam
                            ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)'
                            : 'var(--bg-secondary)',
                        }}
                      >
                        {/* Team Header Bar if team registration */}
                        {isTeam && (
                          <div
                            style={{
                              padding: '0.75rem 1.25rem',
                              background: 'rgba(99, 102, 241, 0.12)',
                              borderBottom: '1px solid var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <Users size={18} color="#818CF8" />
                              <span style={{ fontWeight: '800', fontSize: '0.96rem', color: '#E2E8F0' }}>
                                {group.teamName ? `Team: ${group.teamName}` : `Team ${groupIdx + 1}`}
                              </span>
                              <Badge variant="primary">
                                {group.members.length} Members
                              </Badge>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Reg Code: <code>{group.registrationCode}</code>
                            </div>
                          </div>
                        )}

                        {/* Participant Members Table */}
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                                <th style={{ padding: '0.75rem 1rem' }}>Participant</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Roll Number</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Department & Year</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Contact</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Registration</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Attendance</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Certificate</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.members.map((member, memberIdx) => {
                                const isPresent = member.attendanceStatus === 'PRESENT' || member.attendanceStatus === 'CHECKED_IN';
                                const isAbsent = member.attendanceStatus === 'ABSENT';
                                const isLeader = !member.isTeamMember;
                                const markKey = member.isTeamMember ? `${member.registrationId}_${member.rollNumber}` : (member.registrationId || member.attendanceId);

                                return (
                                  <tr
                                    key={member.attendanceId || `${group.registrationId}_${member.rollNumber}`}
                                    style={{
                                      borderBottom: memberIdx === group.members.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                                      background: memberIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                                    }}
                                  >
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                                          {member.studentName}
                                        </div>
                                        {isTeam && (
                                          <Badge variant={isLeader ? 'primary' : 'neutral'}>
                                            {isLeader ? 'Leader' : `Member ${memberIdx + 1}`}
                                          </Badge>
                                        )}
                                      </div>
                                    </td>

                                    <td style={{ padding: '0.75rem 1rem' }}>
                                      <code style={{ fontSize: '0.82rem', padding: '0.2rem 0.45rem', borderRadius: '4px', background: 'var(--bg-tertiary)', fontWeight: '700', color: '#38BDF8' }}>
                                        {member.rollNumber}
                                      </code>
                                    </td>

                                    <td style={{ padding: '0.75rem 1rem' }}>
                                      <div style={{ fontWeight: '600', color: '#10B981' }}>{member.department}</div>
                                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{member.year}</div>
                                    </td>

                                    <td style={{ padding: '0.75rem 1rem' }}>
                                      {member.email ? <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{member.email}</div> : null}
                                      {member.phone ? <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{member.phone}</div> : null}
                                      {!member.email && !member.phone && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>}
                                    </td>

                                    <td style={{ padding: '0.75rem 1rem' }}>
                                      <Badge variant="success">
                                        {member.registrationStatus || 'REGISTERED'}
                                      </Badge>
                                    </td>

                                    <td style={{ padding: '0.75rem 1rem' }}>
                                      <Badge
                                        variant={isPresent ? 'success' : isAbsent ? 'danger' : 'warning'}
                                        dot={isPresent}
                                      >
                                        {isPresent ? 'Present' : isAbsent ? 'Absent' : 'Not Marked'}
                                      </Badge>
                                      {member.markedAt && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                          {new Date(member.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                      )}
                                    </td>

                                    <td style={{ padding: '0.75rem 1rem' }}>
                                      <Badge
                                        variant={
                                          member.certificateStatus === 'RECEIVED'
                                            ? 'success'
                                            : member.certificateStatus === 'ISSUED'
                                              ? 'primary'
                                              : 'neutral'
                                        }
                                      >
                                        {member.certificateStatus || 'NOT_ISSUED'}
                                      </Badge>
                                    </td>

                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                                        <Button
                                          variant={isPresent ? 'secondary' : 'primary'}
                                          size="sm"
                                          icon={CheckCircle2}
                                          onClick={() =>
                                            handleMarkAttendance(
                                              member.registrationId,
                                              member.attendanceId,
                                              'PRESENT',
                                              member.isTeamMember ? member.rollNumber : null
                                            )
                                          }
                                          disabled={markingAttendeeId === markKey || isPresent}
                                          style={!isPresent ? { background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', fontSize: '0.76rem', padding: '0.25rem 0.65rem' } : { fontSize: '0.76rem', padding: '0.25rem 0.65rem' }}
                                        >
                                          Present
                                        </Button>
                                        <Button
                                          variant={isAbsent ? 'secondary' : 'danger'}
                                          size="sm"
                                          icon={X}
                                          onClick={() =>
                                            handleMarkAttendance(
                                              member.registrationId,
                                              member.attendanceId,
                                              'ABSENT',
                                              member.isTeamMember ? member.rollNumber : null
                                            )
                                          }
                                          disabled={markingAttendeeId === markKey || isAbsent}
                                          style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem' }}
                                        >
                                          Absent
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* CERTIFICATES SECTION (Requirements 17, 18, 20, 22) */}
      {activeAdminTab === 'CERTIFICATES' && (
        <div style={{ marginTop: '0.5rem' }} id="certificates-section">
          {/* Header Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Award size={24} color="#8B5CF6" />
                <span>Certificates Management & Tracking</span>
                <Badge variant="neutral">LIFECYCLE TRACKER</Badge>
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                Manage certificate issuance (Admin) and monitor confirmation of receipt (Student) in real time.
              </p>
            </div>

            {/* Event Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Event:</span>
              <select
                id="cert-event-filter-select"
                value={certEventFilter}
                onChange={(e) => setCertEventFilter(e.target.value)}
                className="form-input"
                style={{ width: 'auto', minWidth: '220px', padding: '0.45rem 0.75rem', fontSize: '0.86rem' }}
              >
                <option value="">All Events (Overall Roster)</option>
                {events.map((ev) => (
                  <option key={ev._id} value={ev._id}>
                    {ev.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 7-Counter Summary Metrics (Requirement 18) */}
          <div className="grid-cards" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.15rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Total Registered</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>
                {certSummary.totalRegistered || adminCertificates.length}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1.15rem', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Present</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#10B981' }}>
                {certSummary.present}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1.15rem', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Absent</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#EF4444' }}>
                {certSummary.absent}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1.15rem', borderColor: 'rgba(139, 92, 246, 0.3)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Certificates Issued</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#8B5CF6' }}>
                {certSummary.issued || certSummary.certificatesIssued || 0}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1.15rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Not Issued</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#9CA3AF' }}>
                {certSummary.notIssued || certSummary.certificatesNotIssued || 0}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1.15rem', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Received</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#38BDF8' }}>
                {certSummary.received || certSummary.certificatesReceived || 0}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1.15rem', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Not Received</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#F59E0B' }}>
                {certSummary.notReceived || certSummary.certificatesNotReceived || 0}
              </div>
            </div>
          </div>

          {/* Filter Pills (Requirement 18) */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: `All (${adminCertificates.length})` },
              { id: 'PRESENT', label: `Present (${certSummary.present})` },
              { id: 'ABSENT', label: `Absent (${certSummary.absent})` },
              { id: 'RECEIVED', label: `Certificate Received (${certSummary.received || 0})` },
              { id: 'NOT_RECEIVED', label: `Certificate Not Received (${certSummary.notReceived || 0})` },
            ].map((f) => (
              <Button
                key={f.id}
                variant={certFilterTab === f.id ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setCertFilterTab(f.id)}
                style={certFilterTab === f.id ? { background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' } : {}}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* Certificates Roster Table */}
          {adminCertificates.length === 0 ? (
            <EmptyState
              icon={Award}
              title="No certificates initialized"
              description="Certificates are automatically initialized as NOT_ISSUED when students register."
            />
          ) : (
            <div className="glass-panel" style={{ padding: '0.5rem 1rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.85rem 0.75rem' }}>Student Name</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>Roll Number</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>Department</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>Attendance</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>Certificate Status</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminCertificates
                    .filter((c) => {
                      if (certFilterTab === 'PRESENT') return c.attendanceStatus === 'PRESENT' || c.attendanceStatus === 'CHECKED_IN';
                      if (certFilterTab === 'ABSENT') return c.attendanceStatus === 'ABSENT';
                      if (certFilterTab === 'RECEIVED') return c.certificateStatus === 'RECEIVED';
                      if (certFilterTab === 'NOT_RECEIVED') return c.certificateStatus !== 'RECEIVED';
                      return true;
                    })
                    .map((cert) => {
                      const isPresent = cert.attendanceStatus === 'PRESENT' || cert.attendanceStatus === 'CHECKED_IN';
                      const isAbsent = cert.attendanceStatus === 'ABSENT';
                      const isNotMarked = !isPresent && !isAbsent;

                      return (
                        <tr key={cert.certificateId || cert.registrationId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.85rem 0.75rem' }}>
                            <div style={{ fontWeight: '600' }}>{cert.studentName}</div>
                            {cert.email && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{cert.email}</div>}
                            {cert.eventTitle && <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{cert.eventTitle}</div>}
                          </td>
                          <td style={{ padding: '0.85rem 0.75rem' }}>
                            <code style={{ fontSize: '0.84rem', padding: '0.2rem 0.4rem', borderRadius: '4px', background: 'var(--bg-tertiary)', fontWeight: '600' }}>
                              {cert.rollNumber}
                            </code>
                          </td>
                          <td style={{ padding: '0.85rem 0.75rem' }}>
                            <Badge variant="neutral">
                              {cert.department}
                            </Badge>
                          </td>
                          <td style={{ padding: '0.85rem 0.75rem' }}>
                            <Badge variant={isPresent ? 'success' : isAbsent ? 'danger' : 'warning'}>
                              {isPresent ? 'Present' : isAbsent ? 'Absent' : 'Not Marked'}
                            </Badge>
                          </td>
                          <td style={{ padding: '0.85rem 0.75rem' }}>
                            <Badge
                              variant={
                                cert.certificateStatus === 'RECEIVED'
                                  ? 'success'
                                  : cert.certificateStatus === 'ISSUED'
                                    ? 'info'
                                    : 'neutral'
                              }
                              dot={cert.certificateStatus === 'ISSUED'}
                            >
                              {cert.certificateStatus === 'RECEIVED'
                                ? '✓ Received'
                                : cert.certificateStatus === 'ISSUED'
                                  ? 'Issued'
                                  : 'Not Issued'}
                            </Badge>
                            {cert.issuedAt && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Issued: {new Date(cert.issuedAt).toLocaleDateString()}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 0.75rem' }}>
                            {cert.certificateStatus === 'NOT_ISSUED' ? (
                              <Button
                                variant="primary"
                                size="sm"
                                icon={Award}
                                onClick={() => handleIssueCertificate(cert.certificateId, cert.registrationId)}
                                loading={issuingCertId === (cert.certificateId || cert.registrationId)}
                                style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }}
                              >
                                Issue Certificate
                              </Button>
                            ) : cert.certificateStatus === 'ISSUED' ? (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                Awaiting student receipt confirmation
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <CheckCircle2 size={15} /> Confirmed Received
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* REGISTRATIONS ROSTER SECTION */}
      {activeAdminTab === 'REGISTRATIONS' && (() => {
        const displayedRegistrations = registrationFilterEventId
          ? registrations.filter((r) => String(r.event?._id || r.event) === String(registrationFilterEventId))
          : registrations;

        const totalRegs = displayedRegistrations.length;
        const totalTeams = displayedRegistrations.filter(
          (r) => r.isTeam || (r.teamMembers && r.teamMembers.length > 0) || (r.teamSize && r.teamSize > 1)
        ).length;
        const totalIndividuals = totalRegs - totalTeams;
        const totalAttendees = displayedRegistrations.reduce((acc, r) => {
          if (r.attendees && Array.isArray(r.attendees)) return acc + r.attendees.length;
          return acc + 1 + (r.teamMembers ? r.teamMembers.length : 0);
        }, 0);

        const currentSelectedEvent = events.find((e) => e._id === registrationFilterEventId);

        return (
          <div style={{ marginTop: '0.5rem' }} id="registrations-roster-section">
            {/* Header & Filter Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Users size={24} color="var(--accent-primary)" />
                  <span>Registrations & Team Management</span>
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                  {currentSelectedEvent ? `Viewing participants registered for "${currentSelectedEvent.title}".` : 'Select an event to inspect isolated participant and team rosters.'}
                </p>
              </div>

              {/* Event Filter Dropdown & Scan Ticket Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Event:</span>
                <select
                  value={registrationFilterEventId}
                  onChange={(e) => setRegistrationFilterEventId(e.target.value)}
                  className="form-input"
                  style={{ minWidth: '220px', padding: '0.45rem 0.8rem', fontSize: '0.86rem' }}
                >
                  <option value="">All Events ({events.length})</option>
                  {events.map((ev) => (
                    <option key={ev._id} value={ev._id}>
                      {ev.title}
                    </option>
                  ))}
                </select>

                {currentSelectedEvent && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={ShieldCheck}
                    onClick={() => {
                      setActiveAdminTab('ATTENDANCE');
                      handleFilterAttendanceByEvent(currentSelectedEvent._id);
                      setTimeout(() => {
                        document.getElementById('verify-ticket-passcode-input')?.focus();
                      }, 100);
                    }}
                  >
                    Verify Tickets
                  </Button>
                )}
              </div>
            </div>

            {/* Live MongoDB Event / Roster Statistics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.85rem',
                marginBottom: '1.5rem',
              }}
            >
              <div className="glass-panel" style={{ padding: '0.85rem 1.1rem' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Registrations</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#6366F1' }}>{totalRegs}</div>
              </div>
              <div className="glass-panel" style={{ padding: '0.85rem 1.1rem' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Teams</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#10B981' }}>{totalTeams}</div>
              </div>
              <div className="glass-panel" style={{ padding: '0.85rem 1.1rem' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Individual</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#38BDF8' }}>{totalIndividuals}</div>
              </div>
              <div className="glass-panel" style={{ padding: '0.85rem 1.1rem' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Attendees</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#F59E0B' }}>{totalAttendees}</div>
              </div>
            </div>

            {/* Registrations Grouped by Team */}
            {displayedRegistrations.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No registrations yet for this event."
                description={registrationFilterEventId ? "No student registrations recorded in MongoDB for this event." : "Select an event above to inspect registrations."}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {displayedRegistrations.map((reg) => {
                  const passCode = reg.ticketCode || reg.digitalPass?.passCode || reg.digitalPass?.ticketCode || reg.registrationCode || '';
                  const attendeesList = reg.attendees && reg.attendees.length > 0 ? reg.attendees : [
                    {
                      name: reg.fullName || reg.student?.name || 'Primary Registrant',
                      rollNumber: reg.rollNumber || reg.student?.studentId || 'N/A',
                      department: reg.department || reg.student?.department || 'Other',
                      year: reg.year || reg.student?.year || '1st Year',
                      email: reg.student?.email || reg.email || '',
                      phone: reg.student?.phone || reg.phone || '',
                      role: 'Team Leader',
                      attendanceStatus: reg.attendanceStatus || 'NOT_MARKED',
                      certificateStatus: reg.certificateStatus || 'NOT_ISSUED',
                      digitalPassCode: passCode,
                    },
                    ...(reg.teamMembers || []).map((m) => ({
                      name: m.name,
                      rollNumber: m.rollNumber,
                      department: m.department || reg.department || 'Other',
                      year: m.year || reg.year || '1st Year',
                      email: '',
                      phone: '',
                      role: 'Team Member',
                      attendanceStatus: m.attendanceStatus || 'NOT_MARKED',
                      certificateStatus: m.certificateStatus || 'NOT_ISSUED',
                      digitalPassCode: '',
                    })),
                  ];

                  const isTeamReg = reg.isTeam || (reg.teamMembers && reg.teamMembers.length > 0) || (reg.teamSize > 1);

                  return (
                    <div
                      key={reg._id}
                      className="glass-panel"
                      style={{
                        borderRadius: '14px',
                        border: '1px solid var(--border-subtle)',
                        overflow: 'hidden',
                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)',
                      }}
                    >
                      {/* Registration / Team Header */}
                      <div
                        style={{
                          padding: '1rem 1.25rem',
                          background: 'rgba(30, 41, 59, 0.6)',
                          borderBottom: '1px solid var(--border-subtle)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                          <Badge
                            variant={isTeamReg ? 'primary' : 'neutral'}
                            style={{ fontSize: '0.84rem', fontWeight: '800' }}
                          >
                            {reg.displayTeamNumber || reg.teamNumber || (isTeamReg ? 'Team' : 'Individual')}
                          </Badge>

                          {reg.teamName && (
                            <span style={{ fontWeight: '700', fontSize: '1rem', color: '#F8FAFC' }}>
                              "{reg.teamName}"
                            </span>
                          )}

                          <Badge variant="info">{reg.event?.title || 'Event'}</Badge>

                          {passCode && (
                            <code style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              #{passCode}
                            </code>
                          )}

                          {isTeamReg && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              Primary: <strong>{reg.fullName || reg.student?.name || 'Primary'}</strong> ({reg.rollNumber || reg.student?.studentId || 'N/A'})
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Registered: <strong>{new Date(reg.registeredAt || reg.createdAt).toLocaleDateString()}</strong>
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Team Size: <strong style={{ color: 'var(--accent-primary)' }}>{reg.teamSize || attendeesList.length}</strong>
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Eye}
                            onClick={() => handleOpenRegistrationDetails(reg._id)}
                            style={{ padding: '0.3rem 0.75rem', fontSize: '0.82rem', fontWeight: '700' }}
                          >
                            Details
                          </Button>
                        </div>
                      </div>

                      {/* Team Members / Attendees Roster */}
                      <div style={{ padding: '0.5rem 1rem', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                              <th style={{ padding: '0.65rem 0.5rem', textAlign: 'left' }}>Attendee / Role</th>
                              <th style={{ padding: '0.65rem 0.5rem', textAlign: 'left' }}>Roll Number</th>
                              <th style={{ padding: '0.65rem 0.5rem', textAlign: 'left' }}>Department & Year</th>
                              <th style={{ padding: '0.65rem 0.5rem', textAlign: 'left' }}>Contact</th>
                              <th style={{ padding: '0.65rem 0.5rem', textAlign: 'left' }}>Pass / Ticket</th>
                              <th style={{ padding: '0.65rem 0.5rem', textAlign: 'left' }}>Attendance</th>
                              <th style={{ padding: '0.65rem 0.5rem', textAlign: 'left' }}>Certificate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendeesList.map((attendee, attIdx) => {
                              const isPresent = attendee.attendanceStatus === 'PRESENT' || attendee.attendanceStatus === 'CHECKED_IN';
                              const isAbsent = attendee.attendanceStatus === 'ABSENT';
                              const isCertIssued = attendee.certificateStatus === 'ISSUED';
                              const isCertReceived = attendee.certificateStatus === 'RECEIVED';
                              const attendeeKey = `${reg._id}_${attendee.rollNumber}`;
                              const isMarkingThis = markingAttendeeId === attendeeKey;
                              const isIssuingThis = issuingCertId === attendeeKey;

                              const contactEmail = attendee.email || (attIdx === 0 ? (reg.student?.email || reg.email) : '');
                              const contactPhone = attendee.phone || (attIdx === 0 ? (reg.student?.phone || reg.phone) : '');
                              const rowPass = attendee.passCode || attendee.digitalPassCode || (attIdx === 0 ? passCode : '');

                              return (
                                <tr key={attIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <td style={{ padding: '0.65rem 0.5rem' }}>
                                    <div style={{ fontWeight: '600', color: '#F8FAFC' }}>{attendee.name}</div>
                                    <div style={{ fontSize: '0.74rem', color: attendee.role === 'Team Leader' || attendee.isPrimary ? '#38BDF8' : 'var(--text-muted)' }}>
                                      {attendee.role || (attendee.isPrimary ? 'Primary Registrant' : 'Team Member')}
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.65rem 0.5rem' }}>
                                    <code style={{ fontSize: '0.8rem', padding: '0.15rem 0.35rem', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                                      {attendee.rollNumber || 'N/A'}
                                    </code>
                                  </td>
                                  <td style={{ padding: '0.65rem 0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem' }}>{attendee.department || 'N/A'} • {attendee.year || 'N/A'}</span>
                                  </td>
                                  <td style={{ padding: '0.65rem 0.5rem' }}>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                      {contactEmail && <div>{contactEmail}</div>}
                                      {contactPhone && <div style={{ color: 'var(--text-muted)' }}>{contactPhone}</div>}
                                      {!contactEmail && !contactPhone && <span style={{ color: 'var(--text-muted)' }}>-</span>}
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.65rem 0.5rem' }}>
                                    {rowPass ? (
                                      <Badge variant="neutral" style={{ fontFamily: 'monospace', fontSize: '0.74rem' }}>
                                        {rowPass}
                                      </Badge>
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Pass #{attIdx + 1}</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                      <Badge variant={isPresent ? 'success' : isAbsent ? 'danger' : 'neutral'}>
                                        {isPresent ? 'Present' : isAbsent ? 'Absent' : 'Not Marked'}
                                      </Badge>
                                      <div style={{ display: 'inline-flex', gap: '3px' }}>
                                        <button
                                          type="button"
                                          disabled={isMarkingThis}
                                          onClick={() => handleMarkAttendance(reg._id, null, 'PRESENT', attendee.rollNumber)}
                                          title="Mark Present"
                                          style={{
                                            padding: '2px 7px',
                                            borderRadius: '4px',
                                            border: '1px solid rgba(16, 185, 129, 0.4)',
                                            background: isPresent ? '#10B981' : 'rgba(16, 185, 129, 0.1)',
                                            color: isPresent ? '#FFF' : '#34D399',
                                            fontSize: '0.72rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          {isMarkingThis ? '..' : 'P'}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isMarkingThis}
                                          onClick={() => handleMarkAttendance(reg._id, null, 'ABSENT', attendee.rollNumber)}
                                          title="Mark Absent"
                                          style={{
                                            padding: '2px 7px',
                                            borderRadius: '4px',
                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                            background: isAbsent ? '#EF4444' : 'rgba(239, 68, 68, 0.1)',
                                            color: isAbsent ? '#FFF' : '#F87171',
                                            fontSize: '0.72rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          {isMarkingThis ? '..' : 'A'}
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.65rem 0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                      <Badge variant={isCertReceived ? 'success' : isCertIssued ? 'info' : 'neutral'}>
                                        {isCertReceived ? 'Received' : isCertIssued ? 'Issued' : 'Not Issued'}
                                      </Badge>
                                      {!isCertIssued && !isCertReceived && (
                                        <button
                                          type="button"
                                          disabled={isIssuingThis}
                                          onClick={() => handleIssueCertificate(null, reg._id, attendee.rollNumber)}
                                          title="Issue Certificate"
                                          style={{
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            border: '1px solid rgba(139, 92, 246, 0.4)',
                                            background: 'rgba(139, 92, 246, 0.15)',
                                            color: '#A78BFA',
                                            fontSize: '0.72rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          {isIssuingThis ? '...' : 'Issue'}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* CREATE / EDIT EVENT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'CREATE' ? 'Create New Campus Event' : 'Edit Campus Event'}
        subtitle={modalMode === 'CREATE' ? 'Add a new verified event to MongoDB' : `Updating event: ${formData.title}`}
        maxWidth="680px"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleFormSubmit}
              loading={formSubmitting}
              style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}
            >
              {modalMode === 'CREATE' ? 'Create Event' : 'Save Changes'}
            </Button>
          </>
        }
      >
        {formError && (
          <Alert variant="error" onDismiss={() => setFormError(null)} style={{ marginBottom: '1.25rem' }}>
            {formError}
          </Alert>
        )}

        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Title */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Event Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Annual Campus Hackathon 2026"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="form-input"
              disabled={formSubmitting}
            />
          </div>

          {/* Category & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="form-input"
                disabled={formSubmitting}
                required
              >
                <option value="">-- Select Category --</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Lifecycle Status *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="form-input"
                disabled={formSubmitting}
              >
                <option value="DRAFT">DRAFT (Hidden from Public)</option>
                <option value="PUBLISHED">PUBLISHED (Live on /events)</option>
                {modalMode === 'EDIT' && <option value="CANCELLED">CANCELLED (Suspended)</option>}
              </select>
            </div>
          </div>

          {/* Date & Time */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Date *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="form-input"
                disabled={formSubmitting}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Time Schedule *</label>
              <input
                type="text"
                required
                placeholder="e.g. 10:00 AM - 4:00 PM"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="form-input"
                disabled={formSubmitting}
              />
            </div>
          </div>

          {/* Venue & Capacity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Venue Location *</label>
              <input
                type="text"
                required
                placeholder="e.g. Main Auditorium / Tech Lab 3"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                className="form-input"
                disabled={formSubmitting}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Total Seat Capacity *</label>
              <input
                type="number"
                required
                min="1"
                placeholder="e.g. 150"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                className="form-input"
                disabled={formSubmitting}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Max Team Size (1 = Individual)</label>
              <input
                type="number"
                required
                min="1"
                max="20"
                placeholder="1 for Individual, 2+ for Teams"
                value={formData.maxTeamSize}
                onChange={(e) => setFormData({ ...formData, maxTeamSize: e.target.value })}
                className="form-input"
                disabled={formSubmitting}
              />
            </div>
          </div>

          {/* Mode & Registration Deadline */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Event Mode *</label>
              <select
                value={formData.mode || 'Offline'}
                onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                className="form-input"
                disabled={formSubmitting}
              >
                <option value="Offline">Offline (On Campus)</option>
                <option value="Online">Online (Virtual)</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Registration Deadline</label>
              <input
                type="date"
                value={formData.registrationDeadline || ''}
                onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
                className="form-input"
                disabled={formSubmitting}
              />
            </div>
          </div>

          {/* Prize Money & Positions (1st, 2nd, 3rd) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1.1rem', background: 'rgba(245, 158, 11, 0.04)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.22)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'center' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#FCD34D', fontWeight: '600' }}>Total Prize Money / Pool (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 500"
                  value={formData.prizeMoney}
                  onChange={(e) => setFormData({ ...formData, prizeMoney: e.target.value })}
                  className="form-input"
                  disabled={formSubmitting}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Participation Certificate</label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    cursor: 'pointer',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.participationCertificateAvailable}
                    onChange={(e) => setFormData({ ...formData, participationCertificateAvailable: e.target.checked })}
                    disabled={formSubmitting}
                    style={{ width: '18px', height: '18px', accentColor: '#10B981' }}
                  />
                  <span style={{ fontSize: '0.88rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                    Certificate Available
                  </span>
                </label>
              </div>
            </div>

            {/* 3 Prizes Optional Breakdown */}
            <div style={{ borderTop: '1px dashed rgba(245, 158, 11, 0.2)', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Prize Breakdown (Optional):
                </span>
                <span style={{ fontSize: '0.75rem', color: '#FBBF24' }}>
                  Auto-sums to Total Pool if unset
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.76rem', color: '#FCD34D' }}>🥇 1st Prize (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 300"
                    value={formData.firstPrize}
                    onChange={(e) => {
                      const val = e.target.value;
                      const sum = (parseFloat(val) || 0) + (parseFloat(formData.secondPrize) || 0) + (parseFloat(formData.thirdPrize) || 0);
                      setFormData({
                        ...formData,
                        firstPrize: val,
                        prizeMoney: formData.prizeMoney === '0' || !formData.prizeMoney ? String(sum) : formData.prizeMoney,
                      });
                    }}
                    className="form-input"
                    disabled={formSubmitting}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.76rem', color: '#CBD5E1' }}>🥈 2nd Prize (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 150"
                    value={formData.secondPrize}
                    onChange={(e) => {
                      const val = e.target.value;
                      const sum = (parseFloat(formData.firstPrize) || 0) + (parseFloat(val) || 0) + (parseFloat(formData.thirdPrize) || 0);
                      setFormData({
                        ...formData,
                        secondPrize: val,
                        prizeMoney: formData.prizeMoney === '0' || !formData.prizeMoney ? String(sum) : formData.prizeMoney,
                      });
                    }}
                    className="form-input"
                    disabled={formSubmitting}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.76rem', color: '#FDBA74' }}>🥉 3rd Prize (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 50"
                    value={formData.thirdPrize}
                    onChange={(e) => {
                      const val = e.target.value;
                      const sum = (parseFloat(formData.firstPrize) || 0) + (parseFloat(formData.secondPrize) || 0) + (parseFloat(val) || 0);
                      setFormData({
                        ...formData,
                        thirdPrize: val,
                        prizeMoney: formData.prizeMoney === '0' || !formData.prizeMoney ? String(sum) : formData.prizeMoney,
                      });
                    }}
                    className="form-input"
                    disabled={formSubmitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Faculty Coordinator (Name Only) */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Faculty Coordinator (Name Only)</label>
            <input
              type="text"
              placeholder="e.g. Dr. K. Ramesh (No phone number required)"
              value={formData.facultyCoordinatorName}
              onChange={(e) => setFormData({ ...formData, facultyCoordinatorName: e.target.value })}
              className="form-input"
              disabled={formSubmitting}
            />
          </div>

          {/* Student Coordinators (Up to 3) */}
          <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: '700', marginBottom: '0.75rem', color: '#A5B4FC' }}>
              Student / Event Coordinators (Max 3)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Coordinator 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <input
                  type="text"
                  placeholder="Coordinator 1 Name (e.g. Priya)"
                  value={formData.coordinator1Name}
                  onChange={(e) => setFormData({ ...formData, coordinator1Name: e.target.value })}
                  className="form-input"
                  style={{ fontSize: '0.85rem' }}
                  disabled={formSubmitting}
                />
                <input
                  type="text"
                  placeholder="Coordinator 1 Phone (e.g. 9876543210)"
                  value={formData.coordinator1Phone}
                  onChange={(e) => setFormData({ ...formData, coordinator1Phone: e.target.value })}
                  className="form-input"
                  style={{ fontSize: '0.85rem' }}
                  disabled={formSubmitting}
                />
              </div>

              {/* Coordinator 2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <input
                  type="text"
                  placeholder="Coordinator 2 Name (e.g. Anusha)"
                  value={formData.coordinator2Name}
                  onChange={(e) => setFormData({ ...formData, coordinator2Name: e.target.value })}
                  className="form-input"
                  style={{ fontSize: '0.85rem' }}
                  disabled={formSubmitting}
                />
                <input
                  type="text"
                  placeholder="Coordinator 2 Phone (e.g. 9876543211)"
                  value={formData.coordinator2Phone}
                  onChange={(e) => setFormData({ ...formData, coordinator2Phone: e.target.value })}
                  className="form-input"
                  style={{ fontSize: '0.85rem' }}
                  disabled={formSubmitting}
                />
              </div>

              {/* Coordinator 3 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <input
                  type="text"
                  placeholder="Coordinator 3 Name (e.g. Harika)"
                  value={formData.coordinator3Name}
                  onChange={(e) => setFormData({ ...formData, coordinator3Name: e.target.value })}
                  className="form-input"
                  style={{ fontSize: '0.85rem' }}
                  disabled={formSubmitting}
                />
                <input
                  type="text"
                  placeholder="Coordinator 3 Phone (e.g. 9876543212)"
                  value={formData.coordinator3Phone}
                  onChange={(e) => setFormData({ ...formData, coordinator3Phone: e.target.value })}
                  className="form-input"
                  style={{ fontSize: '0.85rem' }}
                  disabled={formSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Visual Theme Preset Selection */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Card Poster Theme (Optional)</label>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, gradient: '' })}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-tertiary)',
                  color: !formData.gradient ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  border: !formData.gradient ? '2px solid var(--accent-primary)' : '2px solid var(--border-subtle)',
                  cursor: 'pointer',
                }}
              >
                Default / None
              </button>
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setFormData({ ...formData, gradient: preset.value })}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: preset.value,
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    border: formData.gradient === preset.value ? '2px solid white' : '2px solid transparent',
                    cursor: 'pointer',
                    boxShadow: formData.gradient === preset.value ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Event Poster Image Upload (Optional) */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Event Poster Image (Optional)</span>
              {posterPreview && (
                <button
                  type="button"
                  onClick={handleRemovePoster}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#EF4444',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Remove Poster
                </button>
              )}
            </label>

            {posterPreview ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  background: 'var(--bg-tertiary)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <img
                  src={posterPreview}
                  alt="Poster Preview"
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: 'var(--radius-md)',
                    objectFit: 'cover',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {posterFile ? posterFile.name : 'Current Event Poster'}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {posterFile ? `${(posterFile.size / 1024).toFixed(1)} KB` : 'Stored in database'}
                  </div>
                  <label
                    style={{
                      display: 'inline-block',
                      marginTop: '0.35rem',
                      fontSize: '0.78rem',
                      color: 'var(--accent-primary)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Change Image
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePosterChange}
                      style={{ display: 'none' }}
                      disabled={formSubmitting}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div
                style={{
                  border: '2px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  textAlign: 'center',
                  background: 'var(--bg-tertiary)',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('poster-file-input')?.click()}
              >
                <Upload size={24} style={{ color: 'var(--text-muted)', marginBottom: '0.35rem' }} />
                <div style={{ fontSize: '0.86rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Click to select poster image
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  PNG, JPG, or WEBP (Max 5MB). If omitted, the theme gradient is displayed.
                </div>
                <input
                  id="poster-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePosterChange}
                  style={{ display: 'none' }}
                  disabled={formSubmitting}
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Event Description *</label>
            <textarea
              required
              rows={4}
              placeholder="Detailed schedule, agenda, prerequisites, or topics covered..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="form-input"
              style={{ resize: 'vertical' }}
              disabled={formSubmitting}
            />
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Event"
        subtitle="Permanent Database Action"
        maxWidth="480px"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={handleExecuteDelete}
              loading={deleteSubmitting}
            >
              Confirm Delete
            </Button>
          </>
        }
      >
        <p style={{ lineHeight: 1.6 }}>
          Are you sure you want to permanently delete{' '}
          <strong style={{ color: 'var(--text-primary)' }}>"{eventToDelete?.title}"</strong>?
        </p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
          This will permanently remove the event document from MongoDB. This action cannot be undone.
        </p>
      </Modal>

      {/* STATUS TRANSITION CONFIRMATION MODAL */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title={statusTargetAction === 'CANCELLED' ? 'Confirm Event Cancellation' : 'Confirm Event Republish'}
        subtitle="Lifecycle Status Transition"
        maxWidth="500px"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setStatusModalOpen(false)}
              disabled={statusSubmitting}
            >
              Back
            </Button>
            <Button
              variant={statusTargetAction === 'CANCELLED' ? 'danger' : 'primary'}
              onClick={handleExecuteStatusConfirm}
              loading={statusSubmitting}
            >
              {statusTargetAction === 'CANCELLED' ? 'Confirm Cancellation' : 'Confirm Republish'}
            </Button>
          </>
        }
      >
        <p style={{ lineHeight: 1.6 }}>
          {statusTargetAction === 'CANCELLED' ? (
            <>
              Are you sure you want to cancel <strong style={{ color: 'var(--text-primary)' }}>"{statusTargetEvent?.title}"</strong>? This will suspend public access and mark the event as CANCELLED.
            </>
          ) : (
            <>
              Are you sure you want to republish <strong style={{ color: 'var(--text-primary)' }}>"{statusTargetEvent?.title}"</strong>? This will make the event live again on the public events catalog.
            </>
          )}
        </p>
      </Modal>

      {/* SMART ATTENDANCE BULK ACTION CONFIRMATION MODAL (Requirement 14) */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title={`Confirm Bulk Attendance: Mark All ${bulkStatusToApply === 'PRESENT' ? 'Present' : 'Absent'}`}
        subtitle="Batch Attendance Update"
        maxWidth="500px"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setBulkModalOpen(false)}
              disabled={bulkSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant={bulkStatusToApply === 'PRESENT' ? 'primary' : 'danger'}
              onClick={handleExecuteBulkAttendance}
              loading={bulkSubmitting}
              style={bulkStatusToApply === 'PRESENT' ? { background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' } : {}}
            >
              Confirm Mark All {bulkStatusToApply === 'PRESENT' ? 'Present' : 'Absent'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <p style={{ lineHeight: 1.6, fontSize: '0.92rem' }}>
            Are you sure you want to mark <strong>ALL</strong> registered attendees{' '}
            {attendanceFilterEventId ? 'for this selected event' : 'across all events'} as{' '}
            <strong style={{ color: bulkStatusToApply === 'PRESENT' ? '#10B981' : '#EF4444' }}>
              {bulkStatusToApply === 'PRESENT' ? 'PRESENT' : 'ABSENT'}
            </strong>?
          </p>
          <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            This will update MongoDB attendance records and broadcast real-time updates via Socket.IO immediately to all connected student dashboards.
          </div>
        </div>
      </Modal>

      {/* EVENT REGISTRATION QR MODAL (PHASE 8 / WEBSITE COMPLETION) */}
      <Modal
        isOpen={regQrModalOpen}
        onClose={() => {
          setRegQrModalOpen(false);
          setRegQrEvent(null);
          setRegQrDataUrl('');
        }}
        title="Event Registration QR — Scan to Register"
        subtitle={regQrEvent ? `Dynamic QR Code for: ${regQrEvent.title}` : ''}
        maxWidth="540px"
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setRegQrModalOpen(false);
              setRegQrEvent(null);
              setRegQrDataUrl('');
            }}
          >
            Close
          </Button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
          {/* Strict Separation Notice */}
          <div
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: '#38BDF8' }}>Event Registration QR — Scan to Register:</strong> When students scan this QR code, it opens the dynamic registration page for this event (<code>/events/{regQrEvent?._id}/register</code>). <em>This QR is for student registration only. It is NOT the attendance/ticket QR.</em>
          </div>

          {/* High-Resolution QR Display */}
          <div
            style={{
              padding: '1.5rem',
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              border: '2px dashed #CBD5E1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '220px',
              minHeight: '220px',
            }}
          >
            {regQrLoading ? (
              <div style={{ width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LoadingSkeleton height="180px" width="180px" />
              </div>
            ) : regQrDataUrl ? (
              <img
                src={regQrDataUrl}
                alt={`Registration QR for ${regQrEvent?.title}`}
                style={{ width: '200px', height: '200px', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                QR Code Unavailable
              </div>
            )}

            <div
              style={{
                marginTop: '0.75rem',
                fontSize: '0.78rem',
                color: '#64748B',
                fontWeight: '600',
              }}
            >
              Scan to open registration page
            </div>
          </div>

          {/* Dynamic Registration URL Display & Actions */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Dynamic Event Registration Link</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  readOnly
                  value={regQrEvent ? getEventRegistrationUrl(regQrEvent._id) : ''}
                  className="form-input"
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
                <Button
                  variant="primary"
                  icon={copiedEventId === regQrEvent?._id ? Check : Copy}
                  onClick={() => regQrEvent && handleCopyRegLink(regQrEvent._id)}
                  style={{ flexShrink: 0 }}
                >
                  {copiedEventId === regQrEvent?._id ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link
                to={regQrEvent ? `/events/${regQrEvent._id}/register` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1 }}
              >
                <Button variant="outline" size="sm" icon={ExternalLink} style={{ width: '100%' }}>
                  Open Registration Page
                </Button>
              </Link>

              {regQrDataUrl && (
                <a
                  href={regQrDataUrl}
                  download={`registration-qr-${regQrEvent?._id}.png`}
                  style={{ flex: 1, textDecoration: 'none' }}
                >
                  <Button variant="outline" size="sm" icon={Download} style={{ width: '100%' }}>
                    Download QR Image
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* REGISTRATION DETAILS MODAL (Requirement 7) */}
      <Modal
        isOpen={regDetailsModalOpen}
        onClose={() => setRegDetailsModalOpen(false)}
        title="Registration Details"
        subtitle={
          regDetailsData
            ? `${regDetailsData.registrationCode || regDetailsData._id} • ${regDetailsData.event?.title || 'Campus Event'}`
            : 'Loading Registration...'
        }
        maxWidth="820px"
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', width: '100%' }}>
            {regDetailsData && (
              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                onClick={() => handleOpenRegistrationDetails(selectedRegDetailsId)}
                disabled={regDetailsLoading}
              >
                Refresh
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRegDetailsModalOpen(false)}
            >
              Close
            </Button>
          </div>
        }
      >
        {/* Loading State */}
        {regDetailsLoading && (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
            <LoadingSkeleton height="180px" />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '1rem' }}>
              Fetching verified registration records from MongoDB...
            </p>
          </div>
        )}

        {/* Error State */}
        {!regDetailsLoading && regDetailsError && (
          <div style={{ padding: '1rem 0' }}>
            <Alert variant="error" style={{ marginBottom: '1.25rem' }}>
              {regDetailsError}
            </Alert>
            <div style={{ textAlign: 'center' }}>
              <Button
                variant="primary"
                size="sm"
                icon={RefreshCw}
                onClick={() => handleOpenRegistrationDetails(selectedRegDetailsId)}
              >
                Retry Loading Details
              </Button>
            </div>
          </div>
        )}

        {/* Empty / Missing Registration State */}
        {!regDetailsLoading && !regDetailsError && !regDetailsData && (
          <EmptyState
            icon={AlertCircle}
            title="Registration Not Found"
            description="The requested registration could not be located in the database."
          />
        )}

        {/* Complete Registration Details View */}
        {!regDetailsLoading && !regDetailsError && regDetailsData && (() => {
          const reg = regDetailsData;
          const ev = reg.event || {};
          const isTeam = reg.isTeam || reg.teamSize > 1 || (reg.teamMembers && reg.teamMembers.length > 0);
          const passCode = reg.passCode || reg.ticketCode || reg.registrationCode || '';
          const isPaidEvent = ev.isPaid || (ev.fee && ev.fee > 0);
          const payment = reg.payment;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '72vh', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {/* Top Status & Summary Badges */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  padding: '0.9rem 1.15rem',
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <Badge variant={reg.status === 'REGISTERED' ? 'success' : 'danger'} dot>
                    {reg.status || 'REGISTERED'}
                  </Badge>
                  <Badge variant={isTeam ? 'primary' : 'neutral'}>
                    {isTeam ? `Team (${reg.teamSize || 2} Students)` : 'Individual Registration'}
                  </Badge>
                  {reg.teamName && (
                    <span style={{ fontWeight: '700', fontSize: '0.92rem', color: '#F1F5F9' }}>
                      Team: "{reg.teamName}"
                    </span>
                  )}
                  {passCode && (
                    <code style={{ fontSize: '0.8rem', padding: '0.15rem 0.45rem', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                      Pass: #{passCode}
                    </code>
                  )}
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Registered: <strong>{new Date(reg.registeredAt || reg.createdAt).toLocaleString()}</strong>
                </div>
              </div>

              {/* Event Information Box */}
              <div
                className="glass-panel"
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <Calendar size={18} color="var(--accent-primary)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                    Event Information
                  </h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.86rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Event Title</span>
                    <strong style={{ color: '#F8FAFC', fontSize: '0.95rem' }}>{ev.title || 'N/A'}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Category & Mode</span>
                    <span>{ev.category || 'General'} • {ev.mode || 'Offline'}</span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Date & Schedule</span>
                    <span>
                      {ev.date ? new Date(ev.date).toLocaleDateString() : 'N/A'}
                      {ev.time ? ` (${ev.time})` : ''}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Venue Location</span>
                    <span>{ev.venue || 'Campus Venue'}</span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Registration Fee</span>
                    <Badge variant={isPaidEvent ? 'warning' : 'success'}>
                      {isPaidEvent ? `₹${ev.fee || 0}` : 'FREE ENTRY'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Student 1: Primary Contact / Team Leader */}
              <div
                className="student-section-card"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Badge variant="primary" style={{ fontWeight: '800' }}>Student 1</Badge>
                    <strong style={{ fontSize: '1rem', color: '#F8FAFC' }}>
                      {reg.fullName || reg.student?.name || 'Primary Registrant'}
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: '#38BDF8' }}>
                      ({isTeam ? 'Team Leader / Primary Contact' : 'Individual Participant'})
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Badge variant={reg.attendanceStatus === 'PRESENT' ? 'success' : reg.attendanceStatus === 'ABSENT' ? 'danger' : 'neutral'}>
                      Attendance: {reg.attendanceStatus || 'NOT_MARKED'}
                    </Badge>
                    <Badge variant={reg.certificateStatus === 'ISSUED' || reg.certificateStatus === 'RECEIVED' ? 'info' : 'neutral'}>
                      Cert: {reg.certificateStatus || 'NOT_ISSUED'}
                    </Badge>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.85rem', fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Roll Number / Student ID</span>
                    <code style={{ fontSize: '0.84rem', color: '#F1F5F9', fontWeight: '700' }}>
                      {reg.rollNumber || reg.student?.studentId || 'N/A'}
                    </code>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Branch / Department</span>
                    <strong style={{ color: '#38BDF8' }}>{reg.department || reg.student?.department || 'N/A'}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Academic Year</span>
                    <span>{reg.year || reg.student?.year || 'N/A'}</span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>College / Institution</span>
                    <span>{reg.college || reg.student?.college || 'PBR Visvodaya Institute of Technology & Science'}</span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Email Address</span>
                    <span>{reg.student?.email || reg.email || 'N/A'}</span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Phone Number</span>
                    <span>{reg.student?.phone || reg.phone || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Team Members (Student 2..N) */}
              {reg.teamMembers && reg.teamMembers.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.98rem', fontWeight: '800', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={17} color="var(--accent-cyan)" />
                    <span>Registered Team Members ({reg.teamMembers.length})</span>
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {reg.teamMembers.map((member, mIdx) => {
                      const studentNum = mIdx + 2;
                      return (
                        <div
                          key={mIdx}
                          style={{
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: '10px',
                            border: '1px solid var(--border-subtle)',
                            padding: '1rem 1.15rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Badge variant="info">Student {studentNum}</Badge>
                              <strong style={{ fontSize: '0.95rem' }}>{member.name || `Team Member ${mIdx + 1}`}</strong>
                            </div>

                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <Badge variant={member.attendanceStatus === 'PRESENT' ? 'success' : member.attendanceStatus === 'ABSENT' ? 'danger' : 'neutral'}>
                                {member.attendanceStatus || 'NOT_MARKED'}
                              </Badge>
                              <Badge variant={member.certificateStatus === 'ISSUED' || member.certificateStatus === 'RECEIVED' ? 'info' : 'neutral'}>
                                {member.certificateStatus || 'NOT_ISSUED'}
                              </Badge>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem', fontSize: '0.82rem' }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>Roll Number</span>
                              <code style={{ fontSize: '0.82rem', fontWeight: '700' }}>{member.rollNumber || 'N/A'}</code>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>Department</span>
                              <span style={{ color: '#38BDF8' }}>{member.department || reg.department || 'N/A'}</span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>Year</span>
                              <span>{member.year || 'N/A'}</span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>College</span>
                              <span>{member.college || reg.college || 'PBR Visvodaya Tech'}</span>
                            </div>
                            {member.email && (
                              <div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>Email</span>
                                <span>{member.email}</span>
                              </div>
                            )}
                            {member.phone && (
                              <div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>Phone</span>
                                <span>{member.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Payment Information Box */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <CreditCard size={18} color="var(--accent-amber)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                    Payment & Verification Status
                  </h4>
                </div>

                {payment ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', fontSize: '0.85rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Status</span>
                      <Badge variant={payment.status === 'APPROVED' ? 'success' : payment.status === 'REJECTED' ? 'danger' : 'warning'}>
                        {payment.status}
                      </Badge>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Amount</span>
                      <strong style={{ color: '#F8FAFC' }}>₹{payment.amount}</strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Transaction ID / UTR</span>
                      <code style={{ fontSize: '0.85rem', color: '#F1F5F9' }}>{payment.transactionId}</code>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Submitted Date</span>
                      <span>{new Date(payment.submittedAt || payment.createdAt).toLocaleString()}</span>
                    </div>

                    {payment.rejectionReason && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ color: '#F87171', fontSize: '0.74rem', display: 'block' }}>Rejection Reason</span>
                        <p style={{ color: '#FCA5A5', margin: '0.2rem 0 0', fontSize: '0.84rem' }}>{payment.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                ) : isPaidEvent ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', margin: 0 }}>
                    Fee-based event (₹{ev.fee || 0}), but no payment transaction record was submitted yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10B981', fontSize: '0.88rem' }}>
                    <CheckCircle2 size={16} />
                    <span>Free Event Registration — No Payment Required.</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>



      {/* Admin Chatbot directly integrated in Admin Dashboard (Requirement 5) */}
      <ChatWidget />
    </div>
  );
};
