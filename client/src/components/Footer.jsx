import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Terminal, Shield, ExternalLink, Heart } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          {/* Brand Info */}
          <div style={{ maxWidth: '340px' }}>
            <Link to="/" className="brand-logo" style={{ marginBottom: '0.75rem' }}>
              <div className="brand-icon">
                <Zap size={20} />
              </div>
              <div>
                <span className="brand-text">EventSync</span>
              </div>
            </Link>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.85rem' }}>
              Smart Event Management & RSVP Platform. Connecting campus organizers and students with real-time RSVPs, payment verification, and digital QR tickets.
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--accent-primary)', fontWeight: '500' }}>
              Built for seamless event experiences.
            </p>
          </div>

          {/* Quick Links Columns */}
          <div className="footer-links-group">
            <div className="footer-col">
              <span className="footer-col-title">Platform</span>
              <Link to="/" className="footer-link">Home</Link>
              <Link to="/events" className="footer-link">Explore Events</Link>
              <Link to="/#features" className="footer-link">Features</Link>
              <Link to="/#how-it-works" className="footer-link">How It Works</Link>
            </div>

            <div className="footer-col">
              <span className="footer-col-title">Portals</span>
              <Link to="/login" className="footer-link">Student Login</Link>
              <Link to="/register" className="footer-link">Student Register</Link>
              <Link to="/admin/login" className="footer-link">EventAdmin Login</Link>
            </div>

            <div className="footer-col">
              <span className="footer-col-title">Resources</span>
              <a href="#about" className="footer-link" onClick={(e) => { e.preventDefault(); alert('EventSync: Smart Campus Event Management System - Phase 1 Foundation Active.'); }}>About</a>
              <a href="#help" className="footer-link" onClick={(e) => { e.preventDefault(); alert('Need assistance? Email support@eventsync.edu or contact campus organizers.'); }}>Help & FAQ</a>
              <a href="#privacy" className="footer-link" onClick={(e) => { e.preventDefault(); alert('Privacy Notice: Student data and payment screenshots are strictly protected.'); }}>Privacy Policy</a>
              <a href="#terms" className="footer-link" onClick={(e) => { e.preventDefault(); alert('Terms of Service: Standard campus event registration guidelines apply.'); }}>Terms of Service</a>
            </div>

            <div className="footer-col">
              <span className="footer-col-title">Engineering</span>
              <Link
                to="/diagnostics"
                className="footer-link"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: '#FBBF24',
                }}
              >
                <Terminal size={14} />
                <span>System Diagnostics</span>
              </Link>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Phase 1 Verified
              </span>
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <div>
            &copy; {new Date().getFullYear()} EventSync Platform. All rights reserved.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>Node.js &bull; Express &bull; MongoDB &bull; Socket.IO &bull; React Vite</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
