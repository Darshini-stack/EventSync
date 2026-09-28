import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, User, Mail, Lock, Phone, GraduationCap, ShieldCheck, Key, ArrowRight, CheckCircle2 } from 'lucide-react';
import { registerStudent, registerAdmin } from '../services/api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Alert } from '../components/common/Alert';

export const StudentRegisterPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRole = searchParams.get('role') === 'admin' ? 'admin' : 'student';

  // Selected registration mode: 'student' or 'admin'
  const [regMode, setRegMode] = useState(initialRole);

  // Common Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Admin-Only Field (Access Code)
  const [accessCode, setAccessCode] = useState('');

  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleModeChange = (mode) => {
    setRegMode(mode);
    setErrorMsg(null);
    setSuccessMsg(null);
    setSearchParams(mode === 'admin' ? { role: 'admin' } : {});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (regMode === 'admin' && (!accessCode || accessCode.trim() === '')) {
      setErrorMsg('EventAdmin Access Code is required for admin registration.');
      return;
    }

    setLoading(true);

    try {
      if (regMode === 'student') {
        // Student Registration: Strictly calls student registration endpoint (no access code)
        const res = await registerStudent({
          name,
          email,
          phone,
          password,
          confirmPassword,
        });

        if (res.success) {
          setSuccessMsg('Student account created successfully! Redirecting to Student Login...');
          setTimeout(() => {
            navigate('/login', { replace: true, state: { registered: true, email } });
          }, 1400);
        } else {
          setErrorMsg(res.message || 'Registration failed. Please check your inputs.');
        }
      } else {
        // Admin Registration: Backend strictly validates access code against server env
        const res = await registerAdmin({
          name,
          email,
          phone,
          password,
          confirmPassword,
          accessCode,
        });

        if (res.success) {
          setSuccessMsg('EventAdmin account created successfully! Redirecting to Admin Login...');
          setTimeout(() => {
            navigate('/admin/login', { replace: true, state: { registered: true, email } });
          }, 1400);
        } else {
          setErrorMsg(res.message || 'Admin registration failed. Please verify your access code.');
        }
      }
    } catch (err) {
      setErrorMsg('Unable to connect to server. Please verify backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = regMode === 'admin';

  return (
    <div style={{ maxWidth: '500px', margin: '2rem auto', width: '100%', padding: '0 1rem' }}>
      <div
        className="glass-panel"
        style={{
          padding: '2.5rem 2rem',
          borderColor: isAdmin ? 'rgba(245, 158, 11, 0.35)' : 'rgba(99, 102, 241, 0.25)',
          transition: 'border-color 0.3s ease',
        }}
      >
        {/* Header Icon & Title */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: isAdmin ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.15)',
              color: isAdmin ? '#FBBF24' : 'var(--accent-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              transition: 'all 0.3s ease',
            }}
          >
            {isAdmin ? <ShieldCheck size={30} /> : <GraduationCap size={30} />}
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.35rem' }}>
            {isAdmin ? 'Register Event Organizer' : 'Create Student Account'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            {isAdmin
              ? 'Authorized faculty and organizers with a verified access code.'
              : 'Join EventSync to register for campus events, access digital tickets, and track attendance.'}
          </p>
        </div>

        {/* 1. REGISTER PAGE: TWO CLEAR OPTIONS [ Student ] [ Admin ] */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem',
            background: 'var(--bg-card)',
            padding: '0.35rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            id="register-tab-student"
            onClick={() => handleModeChange('student')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
              transition: 'all 0.2s ease',
              background: !isAdmin ? 'var(--accent-primary)' : 'transparent',
              color: !isAdmin ? '#FFFFFF' : 'var(--text-secondary)',
              boxShadow: !isAdmin ? '0 2px 8px rgba(99, 102, 241, 0.4)' : 'none',
            }}
          >
            <GraduationCap size={17} />
            <span>Student</span>
          </button>

          <button
            type="button"
            id="register-tab-admin"
            onClick={() => handleModeChange('admin')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
              transition: 'all 0.2s ease',
              background: isAdmin ? '#F59E0B' : 'transparent',
              color: isAdmin ? '#000000' : 'var(--text-secondary)',
              boxShadow: isAdmin ? '0 2px 8px rgba(245, 158, 11, 0.4)' : 'none',
            }}
          >
            <ShieldCheck size={17} />
            <span>Admin</span>
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <Alert variant="error" onDismiss={() => setErrorMsg(null)} style={{ marginBottom: '1.25rem' }}>
            {errorMsg}
          </Alert>
        )}

        {successMsg && (
          <Alert variant="success" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={18} />
              <span>{successMsg}</span>
            </div>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          {/* Full Name */}
          <div className="form-group">
            <label className="form-label">{isAdmin ? 'Organizer Full Name' : 'Full Name'}</label>
            <div style={{ position: 'relative' }}>
              <User
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
                type="text"
                required
                placeholder={isAdmin ? 'e.g. Prof. Arvind Rao' : 'e.g. Alex Sharma'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                disabled={loading || !!successMsg}
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="form-group">
            <label className="form-label">{isAdmin ? 'Official Admin Email' : 'College Email Address'}</label>
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
                placeholder={isAdmin ? 'admin@eventsync.edu' : 'student@college.edu'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                disabled={loading || !!successMsg}
              />
            </div>
          </div>

          {/* Phone Number */}
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <div style={{ position: 'relative' }}>
              <Phone
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
                type="tel"
                required
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                disabled={loading || !!successMsg}
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Create Password</label>
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
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                disabled={loading || !!successMsg}
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
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
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                disabled={loading || !!successMsg}
              />
            </div>
          </div>

          {/* 3. ADMIN REGISTRATION: Admin Access Code field (REQUIRED when Admin is selected) */}
          {isAdmin && (
            <div className="form-group" style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ color: '#FBBF24', fontWeight: '700' }}>
                  Admin Access Code <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Validated securely on server
                </span>
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
                  placeholder="Enter secret campus access code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="form-input"
                  style={{
                    paddingLeft: '2.5rem',
                    borderColor: 'rgba(245, 158, 11, 0.45)',
                    background: 'rgba(245, 158, 11, 0.04)',
                  }}
                  disabled={loading || !!successMsg}
                />
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Authorization code issued by campus administration. Validated strictly on backend.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            icon={isAdmin ? ShieldCheck : UserPlus}
            loading={loading}
            disabled={!!successMsg}
            style={{
              width: '100%',
              marginTop: '0.75rem',
              ...(isAdmin
                ? {
                    background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                    boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)',
                    color: '#000000',
                    fontWeight: '700',
                  }
                : {}),
            }}
          >
            {loading
              ? 'Creating Account...'
              : isAdmin
              ? 'Register EventAdmin Account'
              : 'Create Student Account'}
          </Button>
        </form>

        {/* Redirection Links */}
        <div
          style={{
            marginTop: '1.75rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'center',
            fontSize: '0.88rem',
            color: 'var(--text-secondary)',
          }}
        >
          {isAdmin ? (
            <div>
              Already have an organizer account?{' '}
              <Link to="/admin/login" style={{ color: '#FBBF24', fontWeight: '600' }}>
                Admin Login here &rarr;
              </Link>
            </div>
          ) : (
            <div>
              Already registered as a student?{' '}
              <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>
                Student Login here &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* Quick Cross-Portal Switch */}
        <div style={{ marginTop: '0.85rem', textAlign: 'center' }}>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => handleModeChange('student')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.82rem', cursor: 'pointer' }}
            >
              Are you a student? Switch to <strong>Student Registration</strong>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleModeChange('admin')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.82rem', cursor: 'pointer' }}
            >
              Are you an event organizer? Switch to <strong>Admin Registration</strong>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const RegisterPage = StudentRegisterPage;
export default StudentRegisterPage;
