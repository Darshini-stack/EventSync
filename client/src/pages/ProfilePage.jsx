import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Phone, Shield, Calendar, ArrowLeft, LogOut, Edit3, GraduationCap, Building2, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile } from '../services/api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Alert } from '../components/common/Alert';

export const ProfilePage = () => {
  const { user, isEventAdmin, logout, updateUser } = useAuth();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [studentId, setStudentId] = useState(user?.studentId || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [year, setYear] = useState(user?.year || '');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const formattedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Recently';

  const handleOpenEdit = () => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setStudentId(user?.studentId || '');
    setDepartment(user?.department || '');
    setYear(user?.year || '');
    setErrorMsg(null);
    setEditModalOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await updateUserProfile({
        name,
        phone,
        studentId,
        department,
        year,
      });

      if (res.success && res.user) {
        updateUser(res.user);
        setFeedback({
          type: 'success',
          message: 'Academic profile successfully updated in MongoDB.',
        });
        setEditModalOpen(false);
      } else {
        setErrorMsg(res.message || 'Failed to update profile.');
      }
    } catch (err) {
      setErrorMsg('Network error occurred while saving profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '1.5rem auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Back Link */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link
          to={isEventAdmin ? '/admin/dashboard' : '/student/dashboard'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>
        <Badge variant={isEventAdmin ? 'warning' : 'info'}>
          {user?.role}
        </Badge>
      </div>

      {feedback && (
        <Alert
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Profile Card */}
      <div className="glass-panel" style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: isEventAdmin
                  ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                  : 'var(--gradient-brand)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              <User size={32} />
            </div>

            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{user?.name || 'User Profile'}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Authenticated EventSync Account
              </p>
            </div>
          </div>

          <Button variant="secondary" size="sm" icon={Edit3} onClick={handleOpenEdit}>
            Edit Profile
          </Button>
        </div>

        {/* User Details Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={16} style={{ color: 'var(--accent-primary)' }} />
              <span>Email Address</span>
            </span>
            <span style={{ fontWeight: '600', fontSize: '0.92rem' }}>{user?.email}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Phone size={16} style={{ color: 'var(--accent-emerald)' }} />
              <span>Phone Number</span>
            </span>
            <span style={{ fontWeight: '600', fontSize: '0.92rem' }}>{user?.phone || 'Not specified'}</span>
          </div>

          {!isEventAdmin && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <GraduationCap size={16} style={{ color: 'var(--accent-primary)' }} />
                  <span>Student ID</span>
                </span>
                <span style={{ fontWeight: '600', fontSize: '0.92rem', fontFamily: 'monospace' }}>
                  {user?.studentId || `ES-STU-${user?._id?.slice(-6).toUpperCase()}`}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building2 size={16} style={{ color: 'var(--accent-secondary)' }} />
                  <span>Department</span>
                </span>
                <span style={{ fontWeight: '600', fontSize: '0.92rem' }}>
                  {user?.department || 'General Engineering'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BookOpen size={16} style={{ color: 'var(--accent-amber)' }} />
                  <span>Academic Year</span>
                </span>
                <span style={{ fontWeight: '600', fontSize: '0.92rem' }}>
                  {user?.year || '3rd Year'}
                </span>
              </div>
            </>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={16} style={{ color: isEventAdmin ? '#FBBF24' : 'var(--accent-cyan)' }} />
              <span>Assigned Role</span>
            </span>
            <span style={{ fontWeight: '700', fontSize: '0.92rem', color: isEventAdmin ? '#FBBF24' : 'var(--accent-primary)' }}>
              {user?.role}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={16} style={{ color: 'var(--accent-secondary)' }} />
              <span>Member Since</span>
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{formattedDate}</span>
          </div>
        </div>

        {/* Sign Out Action */}
        <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <Button
            variant="danger"
            size="md"
            icon={LogOut}
            style={{ width: '100%' }}
            onClick={logout}
          >
            Sign Out of EventSync
          </Button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <Modal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title="Edit Profile Information"
          subtitle="Update your contact and academic details"
        >
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {errorMsg && <Alert type="error" message={errorMsg} />}

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                required
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                type="text"
                required
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {!isEventAdmin && (
              <>
                <div className="form-group">
                  <label className="form-label">Student Roll Number / ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. CS2023-042"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Academic Department</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Computer Science & Engineering"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Current Academic Year</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 3rd Year"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="secondary" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={loading}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
