import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Upload,
  ExternalLink,
  ShieldCheck,
  FileCheck,
  Loader2,
  Compass
} from 'lucide-react';
import { fetchMyPayments, fetchMyRegistrations, submitPaymentProof, getPaymentProofUrl } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { Alert } from '../components/common/Alert';

export const MyPaymentsPage = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [txnInput, setTxnInput] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const loadPayments = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const [payRes, regRes] = await Promise.all([
        fetchMyPayments(),
        fetchMyRegistrations(),
      ]);

      if (payRes.success && Array.isArray(payRes.data)) {
        setPayments(payRes.data);
      } else {
        setPayments([]);
      }

      if (regRes.success && Array.isArray(regRes.data)) {
        setRegistrations(regRes.data);
      } else {
        setRegistrations([]);
      }
    } catch (err) {
      setPayments([]);
      setRegistrations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();

    const socket = getSocket();
    const handleUpdate = () => {
      loadPayments(true);
    };

    socket.on('payment_status_updated', handleUpdate);
    socket.on('registration_created', handleUpdate);

    return () => {
      socket.off('payment_status_updated', handleUpdate);
      socket.off('registration_created', handleUpdate);
    };
  }, [loadPayments]);

  const handleOpenRetry = (payment) => {
    setSelectedPayment(payment);
    setTxnInput('');
    setProofFile(null);
    setErrorMsg(null);
    setRetryModalOpen(true);
  };

  const handleRetrySubmit = async (e) => {
    e.preventDefault();
    if (!txnInput.trim()) {
      setErrorMsg('Please enter your updated transaction reference ID.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const regId = selectedPayment.registration?._id || selectedPayment.registration;
      let res;

      if (proofFile) {
        const formData = new FormData();
        formData.append('registrationId', regId);
        formData.append('transactionId', txnInput.trim());
        formData.append('proof', proofFile);
        res = await submitPaymentProof(formData);
      } else {
        res = await submitPaymentProof({
          registrationId: regId,
          transactionId: txnInput.trim(),
        });
      }

      if (res.success && res.data) {
        setFeedback({
          type: 'success',
          message: 'Payment proof re-submitted successfully! Status updated to PENDING verification.',
        });
        setRetryModalOpen(false);
        await loadPayments(true);
      } else {
        setErrorMsg(res.message || 'Failed to submit payment verification proof.');
      }
    } catch (err) {
      setErrorMsg('Network error occurred during payment submission.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Header & Breadcrumbs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Link
          to="/student/dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Student Portal</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => loadPayments()}
            loading={refreshing}
          >
            Refresh
          </Button>
          <Link to="/student/registrations">
            <Button variant="outline" size="sm">
              My Registrations
            </Button>
          </Link>
          <Link to="/student/tickets">
            <Button variant="primary" size="sm">
              My Tickets
            </Button>
          </Link>
        </div>
      </div>

      {/* Page Title & Intro */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(245, 158, 11, 0.3)',
            }}
          >
            <CreditCard size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>My Payment Records</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              Track payment proof verification status for paid campus events, review transaction IDs, and retry rejected submissions.
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <Alert
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Payment Records List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Submitted Payment Transactions</h2>
          {payments.length > 0 && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Total: <strong>{payments.length}</strong> transactions
            </span>
          )}
        </div>

        {loading ? (
          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <LoadingSkeleton height="120px" />
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payment submissions recorded"
            description="When you register for paid campus events and upload payment receipts, your transactions and verification status will appear here."
            action={
              <Link to="/events">
                <Button variant="primary" size="md" icon={Compass}>
                  Browse Campus Events
                </Button>
              </Link>
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {payments.map((p) => {
              const event = p.event || {};
              const isApproved = p.status === 'APPROVED';
              const isPending = p.status === 'PENDING';
              const isRejected = p.status === 'REJECTED';

              const submittedDate = p.createdAt
                ? new Date(p.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recently';

              return (
                <div
                  key={p._id}
                  className="glass-panel"
                  style={{
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    borderLeft: isApproved
                      ? '4px solid #10B981'
                      : isPending
                      ? '4px solid #F59E0B'
                      : '4px solid #EF4444',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>
                          {event.title || 'Campus Event'}
                        </h3>
                        {event.category && (
                          <span
                            style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: 'var(--radius-full)',
                              background: 'var(--bg-tertiary)',
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {event.category}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        Submitted on {submittedDate} &bull; Payment ID: {p._id}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isApproved && (
                        <Badge variant="success" dot>
                          PAYMENT APPROVED
                        </Badge>
                      )}
                      {isPending && (
                        <Badge variant="warning" dot>
                          VERIFICATION PENDING
                        </Badge>
                      )}
                      {isRejected && (
                        <Badge variant="danger" dot>
                          PAYMENT REJECTED
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Transaction Details Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '1rem',
                      background: 'var(--bg-tertiary)',
                      padding: '1rem 1.25rem',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fee Amount (From Event)</div>
                      <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#F59E0B' }}>
                        ₹{p.amount || event.fee || 0}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Transaction Reference ID</div>
                      <div style={{ fontWeight: '700', fontSize: '0.92rem', fontFamily: 'monospace' }}>
                        {p.transactionId}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Proof Document</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: '600' }}>
                        {p.proof?.originalName || 'Payment Screenshot'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Retry Submissions</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: '600' }}>
                        {p.retryCount || 0} of 1 used
                      </div>
                    </div>
                  </div>

                  {/* Rejection Alert & Retry Action */}
                  {isRejected && (
                    <div
                      style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#F87171', fontWeight: '700', fontSize: '0.9rem' }}>
                        <XCircle size={18} />
                        <span>Rejection Reason:</span>
                      </div>
                      <p style={{ color: '#FCA5A5', fontSize: '0.88rem', margin: 0 }}>
                        "{p.rejectionReason || 'Receipt was unreadable or transaction could not be verified by organizers.'}"
                      </p>

                      {p.retryCount < 1 ? (
                        <div style={{ marginTop: '0.35rem' }}>
                          <Button
                            variant="primary"
                            size="sm"
                            icon={Upload}
                            onClick={() => handleOpenRetry(p)}
                            style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}
                          >
                            Retry Payment Submission (1 Attempt Remaining)
                          </Button>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          * Maximum retry attempts reached. Please contact campus EventAdmin for assistance.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Shortcuts */}
                  <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
                    {event._id && (
                      <Link to={`/events/${event._id}`}>
                        <Button variant="outline" size="sm">
                          View Event
                        </Button>
                      </Link>
                    )}

                    {isApproved && (
                      <Link to="/student/tickets">
                        <Button variant="primary" size="sm" style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>
                          View Digital QR Pass
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Retry Modal */}
      {retryModalOpen && selectedPayment && (
        <Modal
          isOpen={retryModalOpen}
          onClose={() => setRetryModalOpen(false)}
          title="Retry Payment Verification Submission"
          subtitle={selectedPayment.event?.title || 'Campus Event'}
        >
          <form onSubmit={handleRetrySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Please correct your transaction reference or upload a clear screenshot of your transaction receipt.
            </div>

            {errorMsg && <Alert type="error" message={errorMsg} />}

            <div className="form-group">
              <label className="form-label">Updated Transaction / UPI Reference ID *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. UPI/123456789012 or IMPS-987654"
                value={txnInput}
                onChange={(e) => setTxnInput(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Payment Proof Image (Optional)</label>
              <input
                type="file"
                accept="image/*"
                className="form-input"
                onChange={(e) => setProofFile(e.target.files[0] || null)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Upload JPEG, PNG or WebP receipt (up to 5MB).
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="secondary" onClick={() => setRetryModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={submitting} icon={Upload}>
                Submit Updated Proof
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
