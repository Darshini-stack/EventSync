import React, { useRef, useState, useEffect } from 'react';
import {
  QrCode,
  ShieldCheck,
  Calendar,
  Clock,
  MapPin,
  Users,
  Award,
  Download,
  Printer,
  X,
  Sparkles,
  CheckCircle2,
  User,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { Modal } from './common/Modal';
import { Button } from './common/Button';
import { Badge } from './common/Badge';

import { getTicketQrUrl } from '../services/api';

export const DigitalEventPassModal = ({
  isOpen,
  onClose,
  passData,
  loading = false,
}) => {
  const printRef = useRef(null);
  const [selectedMemberIdx, setSelectedMemberIdx] = useState('primary');
  const [downloading, setDownloading] = useState(false);
  const [qrBlobUrl, setQrBlobUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);

  const teamMembers = passData?.teamMembers || [];
  const primaryName = passData?.studentName || passData?.fullName || passData?.student?.name || 'Student';
  const primaryRoll = passData?.rollNumber || passData?.student?.studentId || passData?.rollNo || 'N/A';
  const primaryDept = passData?.department || passData?.student?.department || 'Other';
  const primaryYear = passData?.year || passData?.student?.year || '1st Year';
  const eventTitle = passData?.event?.title || passData?.eventTitle || 'Event';
  const eventId = passData?.event?._id || passData?.eventId || 'N/A';
  const registrationId = passData?.registrationId || passData?.registration?._id || passData?._id || 'N/A';
  const registrationCode = passData?.registrationCode || 'REG-2026';
  const passCode = passData?.passCode || passData?.ticketCode || 'ES-PASS';
  const ticketId = passData?.ticketId || (passData?.ticketCode ? passData?._id : null);
  const eventDate = passData?.event?.date ? new Date(passData.event.date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) : 'Scheduled';
  const eventVenue = passData?.event?.venue || 'Campus Venue';
  const eventMode = passData?.event?.mode || 'Offline';

  // Determine currently active attendee
  const isPrimary = selectedMemberIdx === 'primary';
  const activeMember = !isPrimary && teamMembers[selectedMemberIdx] ? teamMembers[selectedMemberIdx] : null;

  const currentAttendeeName = isPrimary ? primaryName : (activeMember?.name || 'Team Member');
  const currentAttendeeRoll = isPrimary ? primaryRoll : (activeMember?.rollNumber || 'N/A');
  const currentAttendeeDept = isPrimary ? primaryDept : (activeMember?.department || primaryDept);
  const currentAttendeeYear = isPrimary ? primaryYear : (activeMember?.year || primaryYear);
  const currentAttendeeRole = isPrimary ? (teamMembers.length > 0 ? 'Team Leader' : 'Student') : 'Team Member';

  // Unique real Pass Code:
  // Individual / Primary: passCode (e.g., ES-PASS-XXXXXXXX)
  // Team member: ES-PASS-XXXXXXXX-ROLLNUMBER
  const uniquePassCode = isPrimary
    ? passCode
    : `${passCode}-${currentAttendeeRoll}`;

  const [copiedPassCode, setCopiedPassCode] = useState(false);

  const handleCopyPassCode = () => {
    if (!uniquePassCode) return;
    navigator.clipboard.writeText(uniquePassCode);
    setCopiedPassCode(true);
    setTimeout(() => setCopiedPassCode(false), 2000);
  };

  // Construct target QR payload for display and download
  const currentQrPayload = isPrimary
    ? (passData?.qrPayload || `EVENTSYNC:PASS:${passCode}`)
    : `EVENTSYNC:PASS:${passCode}:${currentAttendeeRoll}`;

  // Fetch or generate QR Code URL for active attendee
  useEffect(() => {
    let active = true;
    if (!isOpen) return;

    if (ticketId) {
      setQrLoading(true);
      const token = localStorage.getItem('eventsync_token');
      const memberParam = isPrimary ? null : currentAttendeeRoll;
      const targetUrl = getTicketQrUrl(ticketId, null, memberParam);

      fetch(targetUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load QR');
          return res.blob();
        })
        .then((blob) => {
          if (active) {
            if (qrBlobUrl) URL.revokeObjectURL(qrBlobUrl);
            setQrBlobUrl(URL.createObjectURL(blob));
            setQrLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            // Fallback to passData.qrDataUrl if primary
            if (isPrimary && (passData?.qrDataUrl || passData?.dataUrl)) {
              setQrBlobUrl(passData.qrDataUrl || passData.dataUrl);
            }
            setQrLoading(false);
          }
        });
    } else if (passData?.qrDataUrl || passData?.dataUrl) {
      setQrBlobUrl(passData.qrDataUrl || passData.dataUrl);
    }

    return () => {
      active = false;
    };
  }, [isOpen, ticketId, selectedMemberIdx, currentAttendeeRoll]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // High-Resolution Canvas Download for verified digital ticket
  const handleDownloadTicket = async () => {
    setDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const width = 640;
      const height = 820;
      canvas.width = width;
      canvas.height = height;

      // 1. Dark Gradient Background
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#0F172A');
      bgGrad.addColorStop(0.5, '#1E293B');
      bgGrad.addColorStop(1, '#090D16');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Outer Border & Glowing Header Bar
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, width - 16, height - 16);

      const topBarGrad = ctx.createLinearGradient(0, 0, width, 0);
      topBarGrad.addColorStop(0, '#6366F1');
      topBarGrad.addColorStop(0.5, '#10B981');
      topBarGrad.addColorStop(1, '#EC4899');
      ctx.fillStyle = topBarGrad;
      ctx.fillRect(8, 8, width - 16, 8);

      // 3. Header Text: EventSync Admission Pass
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.fillText('EVENTSYNC OFFICIAL ADMISSION PASS', 36, 48);

      // Pass Code pill (top right)
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(uniquePassCode, width - 36, 48);
      ctx.textAlign = 'left';

      // 4. Event Title
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
      const maxTitleWidth = width - 72;
      let displayTitle = eventTitle;
      if (ctx.measureText(displayTitle).width > maxTitleWidth) {
        while (ctx.measureText(displayTitle + '...').width > maxTitleWidth && displayTitle.length > 0) {
          displayTitle = displayTitle.slice(0, -1);
        }
        displayTitle += '...';
      }
      ctx.fillText(displayTitle, 36, 88);

      // Divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(36, 108);
      ctx.lineTo(width - 36, 108);
      ctx.stroke();

      // 5. Attendee Information
      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillText('ATTENDEE NAME', 36, 138);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.fillText(currentAttendeeName, 36, 166);

      // Roll & Department Row
      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillText('ROLL NUMBER', 36, 204);
      ctx.fillText('DEPARTMENT & YEAR', 260, 204);

      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(currentAttendeeRoll, 36, 228);

      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${currentAttendeeDept} • ${currentAttendeeYear}`, 260, 228);

      // Venue & Date Row
      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillText('VENUE', 36, 268);
      ctx.fillText('DATE & TIME', 260, 268);

      ctx.fillStyle = '#F1F5F9';
      ctx.font = '600 15px system-ui, -apple-system, sans-serif';
      ctx.fillText(eventVenue, 36, 292);
      ctx.fillText(`${eventDate} • ${eventMode}`, 260, 292);

      // Reg Code
      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillText('REGISTRATION ID', 36, 332);
      ctx.fillStyle = '#CBD5E1';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(registrationCode, 36, 354);

      // Role Badge
      ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
      ctx.fillRect(260, 332, 140, 26);
      ctx.strokeStyle = '#6366F1';
      ctx.strokeRect(260, 332, 140, 26);
      ctx.fillStyle = '#A5B4FC';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      ctx.fillText(currentAttendeeRole.toUpperCase(), 274, 350);

      // 6. QR Code Box
      const qrBoxX = 170;
      const qrBoxY = 390;
      const qrBoxSize = 300;

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize + 60, 16) : ctx.rect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize + 60);
      ctx.fill();

      // Load QR Image onto canvas
      if (qrBlobUrl) {
        const qrImg = new Image();
        qrImg.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          qrImg.onload = resolve;
          qrImg.onerror = reject;
          qrImg.src = qrBlobUrl;
        });
        ctx.drawImage(qrImg, qrBoxX + 25, qrBoxY + 20, 250, 250);
      }

      // QR Caption inside white box
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SCAN FOR GATE CHECK-IN', qrBoxX + qrBoxSize / 2, qrBoxY + 295);

      ctx.fillStyle = '#64748B';
      ctx.font = '11px monospace';
      ctx.fillText(uniquePassCode, qrBoxX + qrBoxSize / 2, qrBoxY + 315);
      ctx.textAlign = 'left';

      // 7. Footer Watermark
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(36, height - 45);
      ctx.lineTo(width - 36, height - 45);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillText('EventSync Smart Pass System • PBR Visvodaya', 36, height - 20);

      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('✓ Verified Admission', width - 36, height - 20);
      ctx.textAlign = 'left';

      // Convert canvas to download link
      canvas.toBlob((blob) => {
        if (!blob) throw new Error('Canvas export failed');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const cleanName = currentAttendeeName.replace(/[^a-zA-Z0-9]/g, '_');
        const cleanRoll = currentAttendeeRoll.replace(/[^a-zA-Z0-9]/g, '_');
        a.href = url;
        a.download = `EventSync-Pass-${cleanName}-${cleanRoll}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setDownloading(false);
      }, 'image/png');
    } catch (err) {
      console.warn('Canvas ticket download fallback to direct QR:', err);
      // Fallback: direct download of QR blob
      if (qrBlobUrl) {
        const a = document.createElement('a');
        a.href = qrBlobUrl;
        a.download = `EventSync-QR-${currentAttendeeRoll}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setDownloading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Digital Event Pass"
      size="md"
      footer={
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Single Entry • Gate Check-In Pass
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              icon={Printer}
              onClick={handlePrint}
            >
              Print Pass
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Download}
              onClick={handleDownloadTicket}
              loading={downloading}
              style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
            >
              Download Ticket
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2.5rem' }}>
          <div className="spin" style={{ width: '32px', height: '32px', border: '3px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading your verified Digital Event Pass...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Team Member Selector Tabs (Per-Member Ticket Requirement) */}
          {teamMembers && teamMembers.length > 0 && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '0.5rem',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Select Team Member Ticket:
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setSelectedMemberIdx('primary')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: isPrimary ? '700' : '500',
                    border: isPrimary ? '1px solid #10B981' : '1px solid transparent',
                    background: isPrimary ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                    color: isPrimary ? '#10B981' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {primaryName} (Leader)
                </button>
                {teamMembers.map((tm, idx) => {
                  const isSelected = selectedMemberIdx === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedMemberIdx(idx)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: isSelected ? '700' : '500',
                        border: isSelected ? '1px solid #38BDF8' : '1px solid transparent',
                        background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                        color: isSelected ? '#38BDF8' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {tm.name} ({tm.rollNumber || `M${idx + 1}`})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ticket Card Container */}
          <div
            ref={printRef}
            className="digital-pass-card"
            style={{
              background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '16px',
              padding: '1.5rem',
              position: 'relative',
              overflow: 'hidden',
              color: '#F8FAFC',
            }}
          >
            {/* Glowing Top Edge */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #6366F1, #10B981, #EC4899)',
              }}
            />

            {/* Pass Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8', fontWeight: '700' }}>
                    Official Event Admission
                  </span>
                  <span style={{ background: '#10B981', color: '#000', fontSize: '0.65rem', fontWeight: '800', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    FREE PASS
                  </span>
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: '#fff' }}>
                  {eventTitle}
                </h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Pass Code</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.92rem', fontWeight: '800', color: '#38BDF8' }}>
                  {uniquePassCode}
                </div>
                <button
                  type="button"
                  id="btn-copy-pass-code"
                  onClick={handleCopyPassCode}
                  style={{
                    marginTop: '0.35rem',
                    background: copiedPassCode ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.15)',
                    border: copiedPassCode ? '1px solid #10B981' : '1px solid rgba(56, 189, 248, 0.4)',
                    color: copiedPassCode ? '#10B981' : '#38BDF8',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.2s ease',
                  }}
                  title="Copy Pass Code"
                >
                  {copiedPassCode ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedPassCode ? 'Copied!' : 'Copy Pass Code'}</span>
                </button>
              </div>
            </div>

            {/* Pass Body: Two-Column Info + QR */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', alignItems: 'center' }}>
              {/* Attendee & Event Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {currentAttendeeRole}
                    </span>
                    <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38BDF8', fontSize: '0.68rem', fontWeight: '700', padding: '0.05rem 0.35rem', borderRadius: '4px' }}>
                      Individual Ticket
                    </span>
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#fff' }}>
                    {currentAttendeeName}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#CBD5E1', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                    <span>Roll: <strong style={{ color: '#F1F5F9' }}>{currentAttendeeRoll}</strong></span>
                    <span>•</span>
                    <span>Year: <strong style={{ color: '#F1F5F9' }}>{currentAttendeeYear}</strong></span>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Department
                  </span>
                  <div style={{ marginTop: '0.2rem' }}>
                    <span
                      style={{
                        background: 'rgba(99, 102, 241, 0.2)',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        color: '#A5B4FC',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.84rem',
                        fontWeight: '700',
                        display: 'inline-block',
                      }}
                    >
                      {currentAttendeeDept}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.25)', padding: '0.65rem', borderRadius: '8px' }}>
                  <div>
                    <span style={{ color: '#94A3B8', fontSize: '0.7rem' }}>Venue</span>
                    <div style={{ fontWeight: '600', color: '#E2E8F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {eventVenue}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: '#94A3B8', fontSize: '0.7rem' }}>Date & Mode</span>
                    <div style={{ fontWeight: '600', color: '#E2E8F0' }}>
                      {eventDate} • {eventMode}
                    </div>
                  </div>
                </div>

                {/* Registration ID & Code */}
                <div style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                  <span>Reg ID: </span>
                  <code style={{ color: '#E2E8F0', background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                    {registrationCode || String(registrationId).slice(-8)}
                  </code>
                </div>
              </div>

              {/* Attendance Check-in QR */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', padding: '1rem', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                {qrLoading ? (
                  <div style={{ width: '180px', height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#0F172A' }}>
                    <Loader2 size={32} className="spin" color="#4F46E5" />
                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Generating QR...</span>
                  </div>
                ) : qrBlobUrl ? (
                  <img
                    src={qrBlobUrl}
                    alt={`QR Check-in Pass ${passCode}`}
                    style={{ width: '180px', height: '180px', display: 'block', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9', color: '#0F172A', flexDirection: 'column', gap: '0.5rem' }}>
                    <QrCode size={48} />
                    <span style={{ fontSize: '0.72rem', fontWeight: '700' }}>{passCode}</span>
                  </div>
                )}
                <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#0F172A', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Scan for Gate Check-In
                  </span>
                  <div style={{ fontSize: '0.66rem', color: '#64748B', fontFamily: 'monospace' }}>
                    {uniquePassCode}
                  </div>
                </div>
              </div>
            </div>

            {/* Team Members List (Overview) */}
            {teamMembers && teamMembers.length > 0 && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', fontWeight: '700', color: '#CBD5E1', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  <Users size={14} color="#38BDF8" />
                  <span>All Registered Team Members ({teamMembers.length})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
                  {teamMembers.map((tm, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedMemberIdx(idx)}
                      style={{
                        background: selectedMemberIdx === idx ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)',
                        border: selectedMemberIdx === idx ? '1px solid #38BDF8' : '1px solid transparent',
                        padding: '0.4rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontWeight: '600', color: '#F1F5F9' }}>{tm.name}</span>
                      <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '0.74rem' }}>{tm.rollNumber || tm.rollNo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer watermark */}
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#64748B' }}>
              <span>EventSync Smart Pass System</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#10B981' }}>
                <ShieldCheck size={12} /> Verified Registration
              </span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
