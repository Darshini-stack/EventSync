import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Zap, 
  Menu, 
  X, 
  Shield, 
  LogIn, 
  UserPlus, 
  Calendar, 
  Home, 
  LayoutDashboard, 
  User, 
  LogOut,
  CheckCircle2,
  Bell,
  Bot,
  Sparkles,
  QrCode
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEventScanner } from '../context/EventScannerContext';
import { Button } from './common/Button';
import { Badge } from './common/Badge';
import { NotificationBell } from './NotificationBell';

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, isStudent, isEventAdmin, logout } = useAuth();
  const { openEventScanner } = useEventScanner();
  const location = useLocation();
  const navigate = useNavigate();

  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    closeMobileMenu();
    await logout();
    navigate('/');
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Brand Logo */}
        <Link to="/" className="brand-logo" onClick={closeMobileMenu}>
          <div className="brand-icon">
            <Zap size={20} />
          </div>
          <div>
            <span className="brand-text">EventSync</span>
            <span className="brand-tagline-subtle">Smart Events</span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="nav-links-desktop">
          <Link
            to="/"
            className={`nav-link-item ${isActive('/') ? 'active' : ''}`}
          >
            Home
          </Link>

          <Link
            to="/events"
            className={`nav-link-item ${isActive('/events') ? 'active' : ''}`}
          >
            Events
          </Link>

          {/* Student-Only Nav Links */}
          {isAuthenticated && isStudent && (
            <>
              <Link
                to="/student/dashboard"
                className={`nav-link-item ${isActive('/student/dashboard') ? 'active' : ''}`}
              >
                Dashboard
              </Link>
              <Link
                to="/student/registrations"
                className={`nav-link-item ${isActive('/student/registrations') || isActive('/my-registrations') ? 'active' : ''}`}
              >
                My Registrations
              </Link>
              <Link
                to="/student/tickets"
                className={`nav-link-item ${isActive('/student/tickets') ? 'active' : ''}`}
              >
                Digital Event Passes
              </Link>
              <Link
                to="/student/attendance"
                className={`nav-link-item ${isActive('/student/attendance') ? 'active' : ''}`}
              >
                My Attendance
              </Link>
              <Link
                to="/chat"
                className={`nav-link-item ${isActive('/chat') ? 'active' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#A78BFA' }}
              >
                <Bot size={15} />
                <span>AI Assistant</span>
              </Link>
            </>
          )}

          {/* EventAdmin-Only Nav Links */}
          {isAuthenticated && isEventAdmin && (
            <Link
              to="/admin/dashboard"
              className={`nav-link-item ${isActive('/admin/dashboard') ? 'active' : ''}`}
              style={{ color: '#FBBF24' }}
            >
              Admin Dashboard
            </Link>
          )}

          {/* Authenticated Profile Link */}
          {isAuthenticated && (
            <Link
              to="/profile"
              className={`nav-link-item ${isActive('/profile') ? 'active' : ''}`}
            >
              Profile
            </Link>
          )}

          {/* Authenticated Notifications Link */}
          {isAuthenticated && (
            <Link
              to="/notifications"
              className={`nav-link-item ${isActive('/notifications') ? 'active' : ''}`}
            >
              Notifications
            </Link>
          )}
        </nav>

        {/* Desktop Auth Actions */}
        <div className="nav-actions-desktop">
          <Button
            variant="outline"
            size="sm"
            icon={QrCode}
            onClick={() => openEventScanner()}
            style={{
              borderColor: 'rgba(99, 102, 241, 0.4)',
              color: '#818CF8',
              background: 'rgba(99, 102, 241, 0.08)',
              fontWeight: '600',
            }}
            title="Scan Event Poster / Registration QR Code"
          >
            Scan QR
          </Button>

          {!isAuthenticated ? (
            <>
              <Link to="/login">
                <Button variant="secondary" size="sm" icon={LogIn}>
                  Student Login
                </Button>
              </Link>

              <Link to="/register">
                <Button variant="primary" size="sm" icon={UserPlus}>
                  Register
                </Button>
              </Link>

              <Link to="/admin/login">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Shield}
                  style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#FBBF24' }}
                >
                  Admin Login
                </Button>
              </Link>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <NotificationBell />

              <Link to="/profile">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-full)',
                    background: isEventAdmin ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                    border: '1px solid',
                    borderColor: isEventAdmin ? 'rgba(245, 158, 11, 0.3)' : 'rgba(99, 102, 241, 0.3)',
                    cursor: 'pointer',
                  }}
                >
                  <User size={14} color={isEventAdmin ? '#FBBF24' : 'var(--accent-primary)'} />
                  <span style={{ fontSize: '0.84rem', fontWeight: '600', color: isEventAdmin ? '#FBBF24' : 'var(--text-primary)' }}>
                    {user?.name?.split(' ')[0] || 'Account'}
                  </span>
                  <Badge variant={isEventAdmin ? 'warning' : 'info'} style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                    {user?.role}
                  </Badge>
                </div>
              </Link>

              <Button
                variant="secondary"
                size="sm"
                icon={LogOut}
                onClick={handleLogout}
                title="Sign Out"
              >
                Logout
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <button
          className="mobile-toggle-btn"
          onClick={toggleMobileMenu}
          aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Sliding Navigation Drawer */}
      <div className={`mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <button
          className="mobile-nav-link"
          onClick={() => {
            closeMobileMenu();
            openEventScanner();
          }}
          style={{
            width: '100%',
            textAlign: 'left',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '10px',
            color: '#818CF8',
            cursor: 'pointer',
            padding: '0.65rem 0.85rem',
            marginBottom: '0.5rem',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <QrCode size={18} />
            <span style={{ fontWeight: '700' }}>Scan QR to Register</span>
          </span>
        </button>

        <Link to="/" className="mobile-nav-link" onClick={closeMobileMenu}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Home size={18} />
            <span>Home</span>
          </span>
        </Link>

        <Link to="/events" className="mobile-nav-link" onClick={closeMobileMenu}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Calendar size={18} />
            <span>Events</span>
          </span>
        </Link>

        {isAuthenticated && isStudent && (
          <>
            <Link to="/student/dashboard" className="mobile-nav-link" onClick={closeMobileMenu}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <LayoutDashboard size={18} />
                <span>Student Dashboard</span>
              </span>
            </Link>
            <Link to="/student/registrations" className="mobile-nav-link" onClick={closeMobileMenu}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Calendar size={18} />
                <span>My Registrations</span>
              </span>
            </Link>
            <Link to="/student/tickets" className="mobile-nav-link" onClick={closeMobileMenu}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Calendar size={18} />
                <span>Digital Event Passes</span>
              </span>
            </Link>
            <Link to="/student/attendance" className="mobile-nav-link" onClick={closeMobileMenu}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <CheckCircle2 size={18} />
                <span>My Attendance</span>
              </span>
            </Link>
            <Link to="/chat" className="mobile-nav-link" onClick={closeMobileMenu} style={{ color: '#A78BFA' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Bot size={18} />
                <span>AI Assistant</span>
              </span>
            </Link>
          </>
        )}

        {isAuthenticated && isEventAdmin && (
          <Link to="/admin/dashboard" className="mobile-nav-link" onClick={closeMobileMenu} style={{ color: '#FBBF24' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Shield size={18} />
              <span>EventAdmin Dashboard</span>
            </span>
          </Link>
        )}

        {isAuthenticated && (
          <Link to="/profile" className="mobile-nav-link" onClick={closeMobileMenu}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <User size={18} />
              <span>My Profile ({user?.name})</span>
            </span>
          </Link>
        )}

        {isAuthenticated && (
          <Link to="/notifications" className="mobile-nav-link" onClick={closeMobileMenu}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Bell size={18} />
              <span>Notifications</span>
            </span>
          </Link>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingTop: '0.75rem' }}>
          {!isAuthenticated ? (
            <>
              <Link to="/login" onClick={closeMobileMenu}>
                <Button variant="secondary" style={{ width: '100%' }} icon={LogIn}>
                  Student Login
                </Button>
              </Link>

              <Link to="/register" onClick={closeMobileMenu}>
                <Button variant="primary" style={{ width: '100%' }} icon={UserPlus}>
                  Student Register
                </Button>
              </Link>

              <Link to="/admin/login" onClick={closeMobileMenu}>
                <Button
                  variant="outline"
                  style={{ width: '100%', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#FBBF24' }}
                  icon={Shield}
                >
                  EventAdmin Login
                </Button>
              </Link>
            </>
          ) : (
            <Button
              variant="danger"
              style={{ width: '100%' }}
              icon={LogOut}
              onClick={handleLogout}
            >
              Sign Out ({user?.role})
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
