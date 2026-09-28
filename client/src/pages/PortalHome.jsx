import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Zap, 
  Activity, 
  CheckCircle2, 
  Calendar, 
  Layers, 
  ShieldCheck, 
  Smartphone, 
  Laptop, 
  ArrowRight,
  SlidersHorizontal,
  Bell,
  Sparkles,
  Search
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Alert } from '../components/common/Alert';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';

export const PortalHome = ({ socketConnected }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [showAlert, setShowAlert] = useState(true);

  const toggleLoading = () => {
    setIsLoadingState(true);
    setTimeout(() => setIsLoadingState(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Alert Banner */}
      {showAlert && (
        <Alert
          variant="info"
          title="Phase 1 Foundation Operational"
          onDismiss={() => setShowAlert(false)}
        >
          EventSync backend (Express, MongoDB, Socket.IO) and frontend design architecture are active. Application modules (Auth, Events, RSVP, Payments, QR, AI) unlock in subsequent phases.
        </Alert>
      )}

      {/* Main Hero Showcase */}
      <div className="glass-panel" style={{ padding: '2.5rem 2rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: '780px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <Badge variant="success" dot>
              Phase 1 Active & Ready
            </Badge>
            <Badge variant="info">
              Cross-Device LAN Ready
            </Badge>
          </div>

          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', lineHeight: 1.15, marginBottom: '1rem' }}>
            Smart Event Management, QR Attendance & Real-Time Sync
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
            EventSync connects students and campus organizers with real-time seat availability, payment proof verification, atomic concurrency-safe RSVPs, secure QR ticketing, and an integrated AI assistant.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <Link to="/diagnostics">
              <Button variant="primary" size="lg" icon={Activity}>
                Open System Diagnostics Console
              </Button>
            </Link>

            <Button variant="secondary" size="lg" icon={SlidersHorizontal} onClick={() => setIsModalOpen(true)}>
              Preview Modal Component
            </Button>

            <Button variant="outline" size="lg" onClick={toggleLoading} loading={isLoadingState}>
              {isLoadingState ? 'Simulating Load...' : 'Test Loading State'}
            </Button>
          </div>
        </div>
      </div>

      {/* Design System & Reusable Components Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>Core UI Design System & Component Library</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Standardized, accessible UI primitives ready for Student and EventAdmin features.
            </p>
          </div>
          <Link to="/diagnostics" style={{ fontSize: '0.88rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span>Diagnostics Gateway</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Card Component Grid */}
        <div className="grid-cards">
          {isLoadingState ? (
            <>
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <LoadingSkeleton height="180px" />
              </div>
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <LoadingSkeleton height="180px" />
              </div>
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <LoadingSkeleton height="180px" />
              </div>
            </>
          ) : (
            <>
              <Card
                title="Student Experience"
                subtitle="Upcoming in Phase 2"
                icon={Calendar}
                badge={<Badge variant="info">Student Role</Badge>}
                actions={
                  <Button variant="outline" size="sm" disabled>
                    Unlock with Phase 2
                  </Button>
                }
              >
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Discover upcoming college hackathons, technical seminars, and cultural festivals. One-click RSVP with instant QR ticket delivery.
                </p>
              </Card>

              <Card
                title="EventAdmin Suite"
                subtitle="Upcoming in Phase 2 & 3"
                icon={ShieldCheck}
                badge={<Badge variant="warning">Admin Access Code</Badge>}
                actions={
                  <Button variant="outline" size="sm" disabled>
                    Unlock with Phase 2
                  </Button>
                }
              >
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Manage capacities, review uploaded payment receipts, promote waitlists deterministically, and scan QR tickets with duplicate prevention.
                </p>
              </Card>

              <Card
                title="Real-Time Socket Sync"
                subtitle="Phase 1 Verified"
                icon={Zap}
                badge={
                  <Badge variant={socketConnected ? 'success' : 'danger'} dot>
                    {socketConnected ? 'Gateway Active' : 'Offline'}
                  </Badge>
                }
                actions={
                  <Link to="/diagnostics">
                    <Button variant="secondary" size="sm" icon={Activity}>
                      Test Ping/Pong
                    </Button>
                  </Link>
                }
              >
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Bidirectional WebSocket synchronization ensures laptop and mobile views reflect live attendance, capacity changes, and payment approvals instantaneously.
                </p>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Accessible States Showcase: Empty State Preview */}
      <div>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>Application State Handling</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1rem' }}>
          Graceful handling of empty collections, searches, and loading states without mock data.
        </p>

        <EmptyState
          icon={Search}
          title="Events Module Unlocked in Phase 3"
          description="In accordance with the phased development roadmap, actual event browsing, search, and categorization will be initialized upon approval of Phase 2 (Authentication)."
          action={
            <Link to="/diagnostics">
              <Button variant="secondary" size="md" icon={Activity}>
                Inspect Live System Health & Sockets
              </Button>
            </Link>
          }
        />
      </div>

      {/* Sample Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="EventSync Modal Architecture"
        subtitle="Reusable accessible dialog component"
        actions={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Dismiss
            </Button>
            <Button variant="primary" onClick={() => setIsModalOpen(false)}>
              Acknowledge
            </Button>
          </>
        }
      >
        <p style={{ marginBottom: '0.85rem' }}>
          This modal demonstrates the accessible dialog system built for EventSync. It features:
        </p>
        <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li>Backdrop blur and click-to-dismiss</li>
          <li>Keyboard <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>ESC</kbd> listener for accessibility</li>
          <li>Customizable title, subtitle, content body, and action buttons</li>
          <li>Mobile-first responsive sizing</li>
        </ul>
      </Modal>
    </div>
  );
};
