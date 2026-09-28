import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Server, 
  Database, 
  Radio, 
  RefreshCw, 
  Send, 
  CheckCircle2, 
  ShieldCheck, 
  Smartphone, 
  Laptop, 
  ExternalLink, 
  Copy, 
  Check, 
  AlertCircle,
  ArrowLeft,
  Terminal
} from 'lucide-react';
import { fetchHealth, getApiBaseUrl } from '../services/api';
import { getSocket } from '../services/socket';
import { StatusCard } from '../components/StatusCard';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';

export const FoundationDashboard = ({ socketConnected, socketId }) => {
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [copied, setCopied] = useState(false);

  // Ping/Pong state
  const [pingLatency, setPingLatency] = useState(null);
  const [isPinging, setIsPinging] = useState(false);
  const [pingHistory, setPingHistory] = useState([]);

  // Fetch Health status from Express backend
  const loadHealthStatus = async () => {
    setLoadingHealth(true);
    const result = await fetchHealth();
    if (result.success) {
      setHealthData(result.data);
    } else {
      setHealthData(null);
    }
    setLastRefreshed(new Date().toLocaleTimeString());
    setLoadingHealth(false);
  };

  useEffect(() => {
    loadHealthStatus();
    const interval = setInterval(loadHealthStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // Dynamic LAN Address Resolution (Zero Hardcoded Private IPs)
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const isLanAccess = currentHostname !== 'localhost' && currentHostname !== '127.0.0.1';
  
  // If user is accessing via phone/LAN, currentHostname is the phone-visible LAN IP.
  // If accessing on laptop localhost, use the server-reported network.lanIp if available.
  const resolvedLanIp = isLanAccess 
    ? currentHostname 
    : (healthData?.network?.lanIp || currentHostname);

  const clientPort = typeof window !== 'undefined' ? window.location.port || '5173' : '5173';
  const dynamicLanClientUrl = `http://${resolvedLanIp}:${clientPort}`;

  // Socket Ping-Pong Listener
  useEffect(() => {
    const socket = getSocket();

    const handleServerPong = (data) => {
      const receiveTime = Date.now();
      if (data && data.clientTimestamp) {
        const roundTripMs = receiveTime - data.clientTimestamp;
        setPingLatency(roundTripMs);
        setPingHistory((prev) => [
          {
            id: Date.now(),
            latency: roundTripMs,
            time: new Date().toLocaleTimeString(),
          },
          ...prev.slice(0, 4), // keep last 5 entries
        ]);
      }
      setIsPinging(false);
    };

    socket.on('server_pong', handleServerPong);

    return () => {
      socket.off('server_pong', handleServerPong);
    };
  }, []);

  const triggerSocketPing = () => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;

    setIsPinging(true);
    socket.emit('client_ping', { timestamp: Date.now() });
  };

  const copyLanUrl = () => {
    navigator.clipboard.writeText(dynamicLanClientUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Dev Console Tag Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          color: '#FBBF24',
          fontSize: '0.88rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Terminal size={16} />
          <strong>Developer & System Diagnostics Console</strong> &mdash; 
          <span style={{ color: 'var(--text-secondary)' }}>Diagnostic utility for Phase 1 verification (Not final application UI)</span>
        </div>

        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)', fontWeight: '600' }}>
          <ArrowLeft size={14} />
          <span>Return to Application Portal</span>
        </Link>
      </div>

      {/* Hero Welcome & Phase 1 Header */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <Badge variant="success" dot>
                Phase 1 Verified & Running
              </Badge>
              <Badge variant="info">
                Node.js + Express + MongoDB + Socket.IO
              </Badge>
            </div>
            <h1 style={{ fontSize: '1.85rem', marginBottom: '0.35rem' }}>
              EventSync Operational Health & WebSocket Gateway
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '720px' }}>
              Real-time operational verification for the EventSync core platform. Monorepo backend, live MongoDB persistence, and Socket.IO bidirectional gateway verified across laptop and mobile devices.
            </p>
          </div>

          <button
            onClick={loadHealthStatus}
            disabled={loadingHealth}
            className="btn btn-secondary"
            title="Refresh Diagnostic Health Check"
          >
            <RefreshCw size={16} className={loadingHealth ? 'spin' : ''} />
            <span>{loadingHealth ? 'Querying...' : 'Refresh Health'}</span>
          </button>
        </div>
      </div>

      {/* LAN & Multi-Device Access Banner (Dynamic URL, Zero Hardcoded IPs) */}
      <div className="network-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '0.65rem', borderRadius: '10px', color: '#A5B4FC' }}>
            <Smartphone size={24} />
          </div>
          <div>
            <div style={{ fontWeight: '600', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Multi-Device & Mobile Access Ready</span>
              <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                Dynamic 0.0.0.0 Bind
              </span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Open this dynamic network URL on your phone connected to the same Wi-Fi:
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="code-pill">
            <span>{dynamicLanClientUrl}</span>
          </div>
          <button onClick={copyLanUrl} className="btn btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
            {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy URL'}</span>
          </button>
        </div>
      </div>

      {/* System Status Cards Grid */}
      <div className="grid-cards">
        {/* Backend API Card */}
        <StatusCard
          title="Express REST API"
          status={healthData ? 'Operational' : 'Unreachable'}
          isOnline={!!healthData}
          icon={Server}
          details={[
            { label: 'Status', value: healthData?.status || 'Offline', highlight: true },
            { label: 'API Version', value: healthData?.version ? `v${healthData.version}` : 'v1.0.0' },
            { label: 'Uptime', value: healthData ? `${healthData.uptime} seconds` : '—' },
            { label: 'Host/Port', value: healthData ? `${healthData.server.host}:${healthData.server.port}` : '0.0.0.0:5000', mono: true },
            { label: 'PID / Node', value: healthData ? `${healthData.server.pid} (${healthData.server.nodeVersion})` : '—' },
            { label: 'Environment', value: healthData?.environment || 'development' },
          ]}
          action={
            <a
              href={`${getApiBaseUrl()}/health`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              <ExternalLink size={14} />
              <span>Inspect Raw /api/health JSON</span>
            </a>
          }
        />

        {/* MongoDB Database Card */}
        <StatusCard
          title="MongoDB Database"
          status={healthData?.database?.isConnected ? 'Connected' : 'Disconnected'}
          isOnline={!!healthData?.database?.isConnected}
          icon={Database}
          details={[
            { label: 'Engine', value: 'MongoDB Server' },
            { label: 'State', value: healthData?.database?.status || 'disconnected', highlight: healthData?.database?.isConnected },
            { label: 'Database Name', value: healthData?.database?.databaseName || 'eventsync' },
            { label: 'Host', value: healthData?.database?.host || '127.0.0.1:27017', mono: true },
            { label: 'Driver', value: 'Mongoose v8.5' },
          ]}
        />

        {/* Real-time Socket.IO Card */}
        <StatusCard
          title="Socket.IO Gateway"
          status={socketConnected ? 'Connected' : 'Connecting'}
          isOnline={socketConnected}
          icon={Radio}
          details={[
            { label: 'Gateway State', value: socketConnected ? 'Connected & Listening' : 'Connecting...', highlight: socketConnected },
            { label: 'Socket ID', value: socketId ? `${socketId.substring(0, 14)}...` : 'Assigning...', mono: true },
            { label: 'Connected Clients', value: healthData?.socket?.connectedClients ?? (socketConnected ? '1' : '0') },
            { label: 'Protocol', value: 'WebSocket / Polling' },
            { label: 'Last Ping Latency', value: pingLatency !== null ? `${pingLatency} ms` : 'Not tested yet', highlight: pingLatency !== null },
          ]}
          action={
            <button
              onClick={triggerSocketPing}
              disabled={!socketConnected || isPinging}
              className="btn btn-primary"
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              <Send size={14} />
              <span>{isPinging ? 'Pinging Gateway...' : 'Send Live Socket Ping'}</span>
            </button>
          }
        />
      </div>

      {/* Socket Latency Verification Log */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem' }}>Real-time Bidirectional Socket Verification</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Tests round-trip WebSocket packet transmission: Client (ping) &rarr; Express Server &rarr; Client (pong).
            </p>
          </div>
          <button
            onClick={triggerSocketPing}
            disabled={!socketConnected || isPinging}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
          >
            <Send size={14} />
            <span>{isPinging ? 'Testing...' : 'Test Ping'}</span>
          </button>
        </div>

        {pingHistory.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pingHistory.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="status-dot online"></span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Round-trip acknowledgment received at {item.time}
                  </span>
                </div>
                <div className="code-pill" style={{ color: '#34D399', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                  Latency: {item.latency} ms
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '1.5rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            Click <strong>"Send Live Socket Ping"</strong> above to measure bidirectional latency to the EventSync server.
          </div>
        )}
      </div>

      {/* EventSync Roadmap Progression Guardrails */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.4rem' }}>Engineering Roadmap & Phase Guardrails</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Strict phase-by-phase implementation enforcement. Phase 2 (Authentication) is locked until Phase 1 foundation verification is approved.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>PHASE 1</span>
              <Badge variant="success">COMPLETE</Badge>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.25rem' }}>
              Project Foundation
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Express, Mongoose, Socket.IO, Vite React, LAN 0.0.0.0 networking, and health endpoints.
            </div>
          </div>

          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              opacity: 0.85,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>PHASE 2</span>
              <Badge variant="info">NEXT IN QUEUE</Badge>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.25rem' }}>
              Authentication & Roles
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Student registration/login, EventAdmin access-code verification, JWT tokens, and RBAC.
            </div>
          </div>

          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              opacity: 0.6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-muted)' }}>PHASE 3 &ndash; 12</span>
              <Badge variant="warning">LOCKED</Badge>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '0.25rem' }}>
              Events, RSVP, QR & AI
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Overbooking prevention, payment verification, QR check-in scanner, and EventSync AI.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
