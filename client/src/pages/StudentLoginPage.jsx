import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Lock, Mail, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { loginStudent } from '../services/api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Alert } from '../components/common/Alert';

export const StudentLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await loginStudent({ email, password });

      if (res.success && res.token && res.user) {
        login(res.token, res.user);
        // Student must never be redirected to /admin/dashboard
        let redirectPath = '/student/dashboard';
        if (res.user.role === 'STUDENT') {
          const rawFrom = location.state?.from;
          const from = typeof rawFrom === 'string' ? rawFrom : rawFrom?.pathname;
          if (from && !from.startsWith('/admin') && from !== '/login') {
            redirectPath = from;
          } else {
            redirectPath = '/student/dashboard';
          }
        } else if (res.user.role === 'EVENTADMIN') {
          redirectPath = '/admin/dashboard';
        }
        navigate(redirectPath, { replace: true });
      } else {
        setErrorMsg(res.message || 'Invalid email or password.');
      }
    } catch (err) {
      setErrorMsg('Failed to connect to authentication server. Please verify backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '460px', margin: '2rem auto', width: '100%' }}>
      <div className="glass-panel" style={{ padding: '2.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--accent-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <GraduationCap size={28} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.4rem' }}>
            <Badge variant="info">Student Portal</Badge>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.35rem' }}>
            Welcome Back
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Sign in to manage your RSVPs, QR tickets, and event notifications.
          </p>
        </div>

        {errorMsg && (
          <Alert variant="error" onDismiss={() => setErrorMsg(null)} style={{ marginBottom: '1.25rem' }}>
            {errorMsg}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">College Email Address</label>
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
                placeholder="student@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Password</label>
            </div>
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

          <Button
            type="submit"
            variant="primary"
            size="lg"
            icon={LogIn}
            loading={loading}
            style={{ width: '100%', marginTop: '0.75rem' }}
          >
            {loading ? 'Signing In...' : 'Sign In to EventSync'}
          </Button>
        </form>

        <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Don't have a student account?{' '}
          <Link to="/register" style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>
            Register here
          </Link>
        </div>

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Link to="/admin/login" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Are you a campus event organizer? <strong>EventAdmin Portal &rarr;</strong>
          </Link>
        </div>
      </div>
    </div>
  );
};
