import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  QrCode,
  Camera,
  UploadCloud,
  Link as LinkIcon,
  CheckCircle2,
  AlertTriangle,
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  ArrowRight,
  RefreshCw,
  Zap,
  Info,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { fetchEventById } from '../services/api';
import { Button } from './common/Button';
import { Badge } from './common/Badge';

export const EventRegistrationScannerModal = ({
  isOpen,
  onClose,
  initialMode = 'camera',
  initialValue = '',
}) => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(initialMode || 'camera');
  const [resolving, setResolving] = useState(false);
  const [resolvedEvent, setResolvedEvent] = useState(null);
  const [ticketWarning, setTicketWarning] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [manualInput, setManualInput] = useState(initialValue || '');
  const [filePreview, setFilePreview] = useState(null);
  const [fileScanning, setFileScanning] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [isCameraRunning, setIsCameraRunning] = useState(false);

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const isStoppingRef = useRef(false);

  // Sync tab with initialMode when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode || 'camera');
      if (initialValue) {
        setManualInput(initialValue);
      }
    } else {
      // Clear states when closed
      setResolvedEvent(null);
      setTicketWarning(null);
      setScanError(null);
      setCameraError(null);
      setFilePreview(null);
      setManualInput('');
    }
  }, [isOpen, initialMode, initialValue]);

  // Clean stop of camera scanner
  const stopCameraScanner = useCallback(async () => {
    if (scannerRef.current && isCameraRunning && !isStoppingRef.current) {
      try {
        isStoppingRef.current = true;
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.debug('Error stopping scanner:', err);
      } finally {
        scannerRef.current = null;
        setIsCameraRunning(false);
        isStoppingRef.current = false;
      }
    }
  }, [isCameraRunning]);

  // Parse QR payload helper
  const parsePayload = (text) => {
    if (!text) return null;
    const trimmed = String(text).trim();

    // Check for Attendee Ticket QR payloads
    if (
      trimmed.startsWith('EVENTSYNC:TICKET:') ||
      trimmed.startsWith('EVENTSYNC:PASS:') ||
      trimmed.startsWith('ES-TCK-') ||
      trimmed.startsWith('ES-PASS-')
    ) {
      return { type: 'TICKET_PASS', code: trimmed };
    }

    // Match /events/:id/register
    const regMatch = trimmed.match(/\/events\/([a-fA-F0-9]{24})\/register/i);
    if (regMatch) return { type: 'EVENT_REGISTRATION', eventId: regMatch[1], originalUrl: trimmed };

    // Match /events/:id
    const eventMatch = trimmed.match(/\/events\/([a-fA-F0-9]{24})/i);
    if (eventMatch) return { type: 'EVENT_REGISTRATION', eventId: eventMatch[1], originalUrl: trimmed };

    // Match raw 24-character hexadecimal ObjectId
    if (/^[a-fA-F0-9]{24}$/.test(trimmed)) {
      return { type: 'EVENT_REGISTRATION', eventId: trimmed, originalUrl: null };
    }

    return { type: 'UNKNOWN', raw: trimmed };
  };

  // Resolve Event by ID
  const resolveEventById = useCallback(async (eventId) => {
    setResolving(true);
    setScanError(null);
    setTicketWarning(null);

    try {
      const res = await fetchEventById(eventId);
      if (res.success && res.data) {
        setResolvedEvent(res.data);
      } else {
        setScanError(res.message || 'Invalid Event Registration QR: Event not found or unavailable in database.');
      }
    } catch (err) {
      setScanError('Invalid Event Registration QR: Unable to connect to EventSync server.');
    } finally {
      setResolving(false);
    }
  }, []);

  // Handle successful payload decoded
  const handlePayloadDecoded = useCallback(
    async (decodedText) => {
      // Pause or stop camera once decoded
      await stopCameraScanner();

      const parsed = parsePayload(decodedText);
      if (!parsed) {
        setScanError('Invalid Event Registration QR: Scanned code contains empty data.');
        return;
      }

      if (parsed.type === 'TICKET_PASS') {
        setResolvedEvent(null);
        setTicketWarning({
          code: parsed.code,
          message:
            'This QR code is an Attendee Digital Pass / Gate Ticket for venue check-in, not an event registration code. If you already registered, view your pass under Digital Event Passes.',
        });
      } else if (parsed.type === 'EVENT_REGISTRATION') {
        resolveEventById(parsed.eventId);
      } else {
        setResolvedEvent(null);
        setScanError('Invalid Event Registration QR: The scanned QR code is not a recognized EventSync event registration link.');
      }
    },
    [resolveEventById, stopCameraScanner]
  );

  // Start Camera Scanner
  const startCameraScanner = useCallback(
    async (cameraId = null) => {
      if (!isOpen || activeTab !== 'camera' || resolvedEvent) return;

      const container = document.getElementById('event-registration-qr-reader');
      if (!container) return;

      try {
        await stopCameraScanner();

        const scanner = new Html5Qrcode('event-registration-qr-reader');
        scannerRef.current = scanner;

        // Query available cameras
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setAvailableCameras(devices);
            if (!cameraId && !selectedCameraId) {
              // Prefer back/environment camera
              const backCam = devices.find(
                (d) =>
                  d.label.toLowerCase().includes('back') ||
                  d.label.toLowerCase().includes('rear') ||
                  d.label.toLowerCase().includes('environment')
              );
              cameraId = backCam ? backCam.id : devices[0].id;
              setSelectedCameraId(cameraId);
            }
          }
        } catch (e) {
          console.debug('Failed to query camera devices:', e);
        }

        const cameraConfig = cameraId
          ? { deviceId: { exact: cameraId } }
          : { facingMode: 'environment' };

        const qrConfig = {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edgeSize = Math.max(180, Math.floor(minEdge * 0.7));
            return { width: edgeSize, height: edgeSize };
          },
          aspectRatio: 1.0,
        };

        await scanner.start(
          cameraConfig,
          qrConfig,
          (decodedText) => {
            handlePayloadDecoded(decodedText);
          },
          () => {
            // standard frame scan failure, silent
          }
        );

        setIsCameraRunning(true);
        setCameraError(null);
      } catch (err) {
        console.warn('Camera startup failed:', err);
        setIsCameraRunning(false);
        setCameraError(
          err.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access in your browser or use the "Upload QR Image" option.'
            : 'Unable to start camera. Please verify device camera availability or use "Upload QR Image".'
        );
      }
    },
    [isOpen, activeTab, resolvedEvent, selectedCameraId, handlePayloadDecoded, stopCameraScanner]
  );

  // Switch camera when user selects from dropdown
  const handleCameraChange = async (e) => {
    const newId = e.target.value;
    setSelectedCameraId(newId);
    await startCameraScanner(newId);
  };

  // Manage camera on tab/open change
  useEffect(() => {
    if (isOpen && activeTab === 'camera' && !resolvedEvent && !ticketWarning && !scanError) {
      // Delay camera start slightly for DOM rendering
      const timer = setTimeout(() => {
        startCameraScanner(selectedCameraId);
      }, 250);
      return () => clearTimeout(timer);
    } else {
      stopCameraScanner();
    }
  }, [isOpen, activeTab, resolvedEvent, ticketWarning, scanError, selectedCameraId, startCameraScanner, stopCameraScanner]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, [stopCameraScanner]);

  // Handle File Upload Scanner
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileScanning(true);
    setScanError(null);
    setTicketWarning(null);
    setResolvedEvent(null);

    const objectUrl = URL.createObjectURL(file);
    setFilePreview(objectUrl);

    try {
      const dummyContainer = document.getElementById('event-qr-file-dummy');
      if (!dummyContainer) {
        throw new Error('Scanner container not ready.');
      }

      const fileScanner = new Html5Qrcode('event-qr-file-dummy', false);
      const decodedText = await fileScanner.scanFile(file, false);
      await fileScanner.clear();

      handlePayloadDecoded(decodedText);
    } catch (err) {
      console.warn('File decode error:', err);
      setScanError(
        'No QR code could be detected in this image. Please ensure the QR code is clearly visible and well-lit.'
      );
    } finally {
      setFileScanning(false);
    }
  };

  // Handle Manual Link or Event ID Submit
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    setScanError(null);
    setTicketWarning(null);
    setResolvedEvent(null);

    handlePayloadDecoded(manualInput.trim());
  };

  // Reset Scanner to scan another code
  const handleReset = () => {
    setResolvedEvent(null);
    setTicketWarning(null);
    setScanError(null);
    setFilePreview(null);
    setManualInput('');
    if (activeTab === 'camera') {
      setTimeout(() => startCameraScanner(selectedCameraId), 150);
    }
  };

  // Proceed to Registration Page
  const handleProceedToRegistration = () => {
    if (!resolvedEvent?._id) return;
    onClose();
    navigate(`/events/${resolvedEvent._id}/register`);
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(5, 8, 16, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem 1rem',
        overflowY: 'auto',
      }}
    >
      {/* Hidden dummy container for file scanning */}
      <div id="event-qr-file-dummy" style={{ display: 'none' }} />

      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '1.25rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(99, 102, 241, 0.25)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(10, 14, 26, 0.98) 100%)',
          overflow: 'hidden',
          animation: 'fadeInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 0 16px rgba(99, 102, 241, 0.5)',
              }}
            >
              <QrCode size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: '#FFFFFF' }}>
                  Scan Event QR
                </h2>
                <Badge variant="primary" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                  Instant Register
                </Badge>
              </div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Scan posters, flyers, or registration QR codes to reserve your seat
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              padding: '0.45rem',
              borderRadius: '50%',
              color: 'var(--text-muted)',
              border: 'none',
              background: 'rgba(255, 255, 255, 0.06)',
            }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation (Hidden when event is successfully resolved) */}
        {!resolvedEvent && (
          <div
            style={{
              display: 'flex',
              padding: '0.6rem 1.25rem 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              background: 'rgba(15, 23, 42, 0.4)',
              gap: '0.5rem',
            }}
          >
            <button
              onClick={() => {
                setActiveTab('camera');
                setScanError(null);
                setTicketWarning(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.6rem 1rem',
                fontSize: '0.86rem',
                fontWeight: '600',
                color: activeTab === 'camera' ? '#818CF8' : 'var(--text-secondary)',
                borderBottom: activeTab === 'camera' ? '2px solid #6366F1' : '2px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Camera size={16} />
              <span>Camera Scanner</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('file');
                setScanError(null);
                setTicketWarning(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.6rem 1rem',
                fontSize: '0.86rem',
                fontWeight: '600',
                color: activeTab === 'file' ? '#818CF8' : 'var(--text-secondary)',
                borderBottom: activeTab === 'file' ? '2px solid #6366F1' : '2px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <UploadCloud size={16} />
              <span>Upload QR Image</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('manual');
                setScanError(null);
                setTicketWarning(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.6rem 1rem',
                fontSize: '0.86rem',
                fontWeight: '600',
                color: activeTab === 'manual' ? '#818CF8' : 'var(--text-secondary)',
                borderBottom: activeTab === 'manual' ? '2px solid #6366F1' : '2px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <LinkIcon size={16} />
              <span>Direct Link / ID</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            minHeight: '260px',
          }}
        >
          {/* 1. RESOLVING LOADER */}
          {resolving && (
            <div
              style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.85rem',
              }}
            >
              <Loader2 size={36} color="#6366F1" className="animate-spin" />
              <div style={{ fontWeight: '700', fontSize: '1rem', color: '#FFFFFF' }}>
                Verifying Event in Database...
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Fetching real-time seat availability and event information
              </div>
            </div>
          )}

          {/* 2. RESOLVED EVENT PREVIEW CARD */}
          {!resolving && resolvedEvent && (
            <div
              style={{
                borderRadius: '16px',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <Badge variant="primary">{resolvedEvent.category || 'General'}</Badge>
                    <Badge variant={resolvedEvent.isPaid ? 'warning' : 'success'}>
                      {resolvedEvent.isPaid ? `₹${resolvedEvent.fee}` : 'FREE'}
                    </Badge>
                    {resolvedEvent.availableSeats <= 0 && (
                      <Badge variant="danger">EVENT FULL</Badge>
                    )}
                  </div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#FFFFFF', margin: 0 }}>
                    {resolvedEvent.title}
                  </h3>
                </div>

                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10B981',
                    flexShrink: 0,
                  }}
                  title="Event Verified"
                >
                  <CheckCircle2 size={20} />
                </div>
              </div>

              {resolvedEvent.description && (
                <p
                  style={{
                    fontSize: '0.88rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.5',
                    margin: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {resolvedEvent.description}
                </p>
              )}

              {/* Event Details Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '0.75rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  fontSize: '0.84rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#CBD5E1' }}>
                  <Calendar size={16} color="#818CF8" />
                  <span>
                    {resolvedEvent.date ? new Date(resolvedEvent.date).toLocaleDateString() : 'TBA'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#CBD5E1' }}>
                  <Clock size={16} color="#818CF8" />
                  <span>{resolvedEvent.time || 'TBA'}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#CBD5E1' }}>
                  <MapPin size={16} color="#818CF8" />
                  <span>{resolvedEvent.venue || 'Campus Venue'}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#CBD5E1' }}>
                  <Users size={16} color={resolvedEvent.availableSeats > 0 ? '#10B981' : '#EF4444'} />
                  <span>
                    <strong>{resolvedEvent.availableSeats}</strong> / {resolvedEvent.capacity} Seats Left
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleProceedToRegistration}
                  disabled={resolvedEvent.availableSeats <= 0 && resolvedEvent.status !== 'PUBLISHED'}
                  style={{ flex: 1, justifyContent: 'center' }}
                  icon={ArrowRight}
                >
                  Proceed to Registration
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleReset}
                  icon={RefreshCw}
                  title="Scan Another Code"
                >
                  Scan Another
                </Button>
              </div>
            </div>
          )}

          {/* 3. TICKET CODE WARNING BANNER (Gate pass scanned in registration scanner) */}
          {!resolving && ticketWarning && (
            <div
              style={{
                borderRadius: '14px',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(180, 83, 9, 0.15) 100%)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#F59E0B',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#F59E0B' }}>
                    Gate Entry Ticket Detected
                  </h4>
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#E2E8F0', lineHeight: '1.4' }}>
                    {ticketWarning.message}
                  </p>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#CBD5E1' }}>
                    Code: <code style={{ color: '#F59E0B', fontWeight: '700' }}>{ticketWarning.code}</code>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem' }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    navigate('/student/tickets');
                  }}
                  icon={ExternalLink}
                >
                  View My Digital Passes
                </Button>
                <Button variant="secondary" size="sm" onClick={handleReset} icon={RefreshCw}>
                  Scan Another QR
                </Button>
              </div>
            </div>
          )}

          {/* 4. ERROR BANNER */}
          {!resolving && scanError && (
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
              }}
            >
              <AlertTriangle size={20} color="#EF4444" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '0.92rem', color: '#FCA5A5' }}>
                  Invalid Event Registration QR
                </div>
                <div style={{ fontSize: '0.84rem', color: '#E2E8F0', marginTop: '0.2rem' }}>
                  {scanError}
                </div>
                <div style={{ marginTop: '0.65rem' }}>
                  <Button variant="secondary" size="sm" onClick={handleReset} icon={RefreshCw}>
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 5. TAB 1: CAMERA SCANNER */}
          {!resolving && !resolvedEvent && activeTab === 'camera' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Camera selection dropdown if multiple cameras found */}
              {availableCameras.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Select Camera:</label>
                  <select
                    value={selectedCameraId || ''}
                    onChange={handleCameraChange}
                    style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#FFFFFF',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                    }}
                  >
                    {availableCameras.map((cam) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label || `Camera ${cam.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Camera viewport container */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '1',
                  maxHeight: '320px',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  background: '#0F172A',
                  border: '2px solid rgba(99, 102, 241, 0.3)',
                  boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* HTML5 QR reader element */}
                <div
                  id="event-registration-qr-reader"
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                />

                {/* Viewfinder Target Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    inset: '18%',
                    border: '2px dashed rgba(99, 102, 241, 0.8)',
                    borderRadius: '12px',
                    pointerEvents: 'none',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '2px',
                      background: 'linear-gradient(90deg, transparent, #818CF8, transparent)',
                      boxShadow: '0 0 8px #6366F1',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                </div>
              </div>

              {cameraError && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    fontSize: '0.82rem',
                    color: '#FCA5A5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <AlertTriangle size={16} />
                  <span>{cameraError}</span>
                </div>
              )}

              <p style={{ margin: 0, textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Point your camera directly at the event poster or registration QR code
              </p>
            </div>
          )}

          {/* 6. TAB 2: UPLOAD QR IMAGE */}
          {!resolving && !resolvedEvent && activeTab === 'file' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) {
                    handleFileSelect({ target: { files: e.dataTransfer.files } });
                  }
                }}
                style={{
                  border: '2px dashed rgba(99, 102, 241, 0.4)',
                  borderRadius: '16px',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  background: 'rgba(15, 23, 42, 0.5)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.85rem',
                }}
              >
                {fileScanning ? (
                  <>
                    <Loader2 size={36} color="#818CF8" className="animate-spin" />
                    <div style={{ fontWeight: '700', color: '#FFFFFF' }}>Decoding QR Code Image...</div>
                  </>
                ) : filePreview ? (
                  <>
                    <img
                      src={filePreview}
                      alt="Uploaded QR Code Preview"
                      style={{
                        maxHeight: '140px',
                        maxWidth: '100%',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    />
                    <div style={{ fontSize: '0.85rem', color: '#818CF8', fontWeight: '600' }}>
                      Click to choose a different image
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'rgba(99, 102, 241, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#818CF8',
                      }}
                    >
                      <UploadCloud size={28} />
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.98rem', color: '#FFFFFF' }}>
                        Click to upload or drag & drop QR image
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Supports PNG, JPG, JPEG, WEBP screenshots and poster photos
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 7. TAB 3: DIRECT LINK OR ID INPUT */}
          {!resolving && !resolvedEvent && activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#E2E8F0' }}>
                  Paste Event Registration URL or Event ID:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g. http://localhost:5173/events/6a.../register or 6a..."
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem 0.75rem 2.5rem',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      color: '#FFFFFF',
                      fontSize: '0.88rem',
                      fontFamily: 'monospace',
                    }}
                  />
                  <LinkIcon
                    size={16}
                    color="#818CF8"
                    style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Paste the web link encoded in the QR code or enter a 24-character MongoDB Event ID.
                </span>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!manualInput.trim()}
                icon={ArrowRight}
                style={{ justifyContent: 'center' }}
              >
                Resolve & Preview Event
              </Button>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(10, 14, 26, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Zap size={14} color="#818CF8" />
            <span>EventSync Smart QR Resolution</span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: '600',
              padding: '0.2rem 0.5rem',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
