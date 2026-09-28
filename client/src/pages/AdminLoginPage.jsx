import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, Key, ArrowRight, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { loginAdmin } from '../services/api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Alert } from '../components/common/Alert';

export const AdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await loginAdmin({
        email,
        password,
        accessCode,
      });

      if (res.success && res.token && res.user) {
        login(res.token, res.user);
        navigate('/admin/dashboard', { replace: true });
      } else {
        setErrorMsg(res.message || 'Authentication failed. Please check your credentials and access code.');
      }
    } catch (err) {
      setErrorMsg('Failed to connect to authentication server. Please verify backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '2rem auto', width: '100%' }}>
      <div className="glass-panel" style={{ padding: '2.5rem 2rem', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#FBBF24',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <ShieldCheck size={30} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.4rem' }}>
            <Badge variant="warning">EventAdmin Authentication</Badge>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.35rem' }}>
            Organizer Access Portal
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Restricted access for authorized campus event organizers and faculty advisors.
          </p>
        </div>

        {errorMsg && (
          <Alert variant="error" onDismiss={() => setErrorMsg(null)} style={{ marginBottom: '1.25rem' }}>
            {errorMsg}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Admin Email</label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={17}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="email"
                required
                placeholder="admin@eventsync.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={17}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ color: '#FBBF24' }}>EventAdmin Access Code</label>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Backend verified</span>
            </div>
            <div style={{ position: 'relative' }}>
              <Key
                size={17}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#FBBF24',
                }}
              />
              <input
                type="password"
                required
                placeholder="Secret campus organizer key"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                disabled={loading}
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            icon={ShieldCheck}
            loading={loading}
            style={{
              width: '100%',
              marginTop: '1rem',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)',
            }}
          >
            {loading ? 'Verifying Access...' : 'Verify & Enter Admin Console'}
          </Button>
        </form>

        <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', textAlign: 'center', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div>
            Need an authorized account?{' '}
            <Link to="/register?role=admin" style={{ color: '#FBBF24', fontWeight: '600' }}>
              Register EventAdmin &rarr;
            </Link>
          </div>
          <div>
            <Link to="/login" style={{ color: 'var(--text-secondary)' }}>
              Not an administrator? <span style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>Student Login &rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
