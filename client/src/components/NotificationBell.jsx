import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Check,
  Trash2,
  Calendar,
  Ticket,
  DollarSign,
  AlertTriangle,
  Award,
  Clock,
  ExternalLink,
  Sparkles,
  Info
} from 'lucide-react';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

export const NotificationBell = () => {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Helper to get relative time string
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const now = new Date();
    const past = new Date(dateStr);
    const diffSec = Math.floor((now - past) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Helper to map notification type to visual style & icon
  const getTypeMeta = (type) => {
    switch (type) {
      case 'EVENT_CREATED':
      case 'EVENT_PUBLISHED':
        return { icon: Sparkles, color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)' };
      case 'REGISTRATION_SUCCESS':
      case 'REGISTRATION_OPEN':
      case 'REGISTRATION_CONFIRMED':
        return { icon: Calendar, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'PAYMENT_SUBMITTED':
        return { icon: DollarSign, color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' };
      case 'PAYMENT_APPROVED':
        return { icon: DollarSign, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'PAYMENT_REJECTED':
      case 'EVENT_CANCELLED':
      case 'REGISTRATION_DEADLINE':
      case 'REGISTRATION_CLOSED':
        return { icon: AlertTriangle, color: '#F43F5E', bg: 'rgba(244, 63, 94, 0.15)' };
      case 'PAYMENT_RETRY_AVAILABLE':
        return { icon: DollarSign, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
      case 'TICKET_ISSUED':
        return { icon: Ticket, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' };
      case 'ATTENDANCE_UPDATED':
      case 'ATTENDANCE_CONFIRMED':
        return { icon: Award, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'CERTIFICATE_ISSUED':
      case 'CERTIFICATE_RECEIVED':
        return { icon: Award, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' };
      case 'SEATS_NEARLY_FULL':
      case 'EVENT_ALMOST_FULL':
      case 'EVENT_REMINDER_24H':
      case 'EVENT_REMINDER_1H':
        return { icon: Clock, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
      case 'CAPACITY_INCREASED':
      case 'EVENT_UPDATED':
        return { icon: Calendar, color: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)' };
      default:
        return { icon: Info, color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.15)' };
    }
  };

  // Determine target route when clicking a notification
  const getNotificationLink = (item) => {
    if (item.ticket) return '/student/tickets';
    if (item.certificate) return '/student/certificates';
    if (item.attendance) return '/student/attendance';
    if (item.payment) return '/student/payments';
    if (item.registration) return '/student/registrations';
    if (item.event) {
      const eventId = typeof item.event === 'object' ? item.event._id : item.event;
      return `/events/${eventId}`;
    }
    return '/notifications';
  };

  // Fetch initial unread count
  const loadUnreadCount = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetchUnreadNotificationCount();
      if (res && typeof res.unreadCount === 'number') {
        setUnreadCount(res.unreadCount);
      }
    } catch (err) {
      console.warn('[NotificationBell] Could not load unread count:', err.message);
    }
  };

  // Fetch recent notifications for dropdown
  const loadNotifications = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await fetchNotifications({ page: 1, limit: 7 });
      if (res?.data) {
        setNotifications(res.data);
        if (typeof res.unreadCount === 'number') {
          setUnreadCount(res.unreadCount);
        }
      }
    } catch (err) {
      console.warn('[NotificationBell] Error fetching notifications:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Mark All Read
  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();
    if (actionLoading || unreadCount === 0) return;
    setActionLoading(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[NotificationBell] Failed to mark all as read:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Mark Single Read
  const handleMarkAsRead = async (e, id) => {
    e.stopPropagation();
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('[NotificationBell] Failed to mark as read:', err);
    }
  };

  // Handle Delete Notification
  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      const target = notifications.find((n) => n._id === id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      if (target && !target.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('[NotificationBell] Failed to delete notification:', err);
    }
  };

  // Handle Notification Item Click
  const handleItemClick = async (item) => {
    if (!item.isRead) {
      try {
        await markNotificationAsRead(item._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        // Continue navigation even if network mark-read fails
      }
    }
    setIsOpen(false);
    const link = getNotificationLink(item);
    navigate(link);
  };

  // Toggle Dropdown
  const handleToggle = () => {
    if (!isOpen) {
      loadNotifications();
    }
    setIsOpen((prev) => !prev);
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Initial load
  useEffect(() => {
    if (isAuthenticated) {
      loadUnreadCount();
    } else {
      setUnreadCount(0);
      setNotifications([]);
    }
  }, [isAuthenticated]);

  // Socket.IO Real-time Synchronization
  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = getSocket();
    if (!socket) return;

    const onNotificationCreated = (newNotif) => {
      if (!newNotif || !newNotif._id) return;
      setNotifications((prev) => {
        if (prev.some((n) => n._id === newNotif._id)) return prev;
        setUnreadCount((c) => c + 1);
        return [newNotif, ...prev.slice(0, 8)];
      });
    };

    const onNotificationRead = ({ notificationId }) => {
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    const onNotificationReadAll = () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    };

    const onNotificationDeleted = ({ notificationId }) => {
      setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
    };

    const onUnreadCountUpdated = (data) => {
      const count = typeof data?.unreadCount === 'number'
        ? data.unreadCount
        : (typeof data?.count === 'number' ? data.count : (typeof data === 'number' ? data : null));
      if (typeof count === 'number') {
        setUnreadCount(count);
      }
    };

    const onConnect = () => {
      loadUnreadCount();
      loadNotifications();
    };

    socket.on('notification_created', onNotificationCreated);
    socket.on('notification:new', onNotificationCreated);
    socket.on('notification_read', onNotificationRead);
    socket.on('notification_read_all', onNotificationReadAll);
    socket.on('notification_deleted', onNotificationDeleted);
    socket.on('unread_count_updated', onUnreadCountUpdated);
    socket.on('connect', onConnect);

    return () => {
      socket.off('notification_created', onNotificationCreated);
      socket.off('notification:new', onNotificationCreated);
      socket.off('notification_read', onNotificationRead);
      socket.off('notification_read_all', onNotificationReadAll);
      socket.off('notification_deleted', onNotificationDeleted);
      socket.off('unread_count_updated', onUnreadCountUpdated);
      socket.off('connect', onConnect);
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <div className="notification-bell-container" ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        className="notification-bell-button"
        onClick={handleToggle}
        aria-label="Notifications"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: isOpen ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.06)',
          border: '1px solid',
          borderColor: isOpen ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.12)',
          color: isOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            id="notification-unread-badge"
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)',
              color: '#FFFFFF',
              fontSize: '0.68rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 8px rgba(244, 63, 94, 0.6)',
              border: '2px solid var(--bg-primary)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          id="notification-dropdown-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '360px',
            maxWidth: 'calc(100vw - 32px)',
            background: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(99, 102, 241, 0.15)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem',
              background: 'rgba(26, 34, 52, 0.7)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: 'var(--accent-primary)',
                    fontSize: '0.72rem',
                    fontWeight: '600',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '9999px',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                id="mark-all-read-dropdown-btn"
                onClick={handleMarkAllAsRead}
                disabled={actionLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.2rem 0.4rem',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'background var(--transition-fast)',
                }}
                title="Mark all as read"
              >
                <CheckCheck size={14} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Notification Items List */}
          <div
            style={{
              maxHeight: '380px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '0.85rem' }}>Loading updates...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.75rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Bell size={20} />
                </div>
                <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  All Caught Up!
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  No new notifications at this time.
                </div>
              </div>
            ) : (
              notifications.map((item) => {
                const meta = getTypeMeta(item.type);
                const IconComponent = meta.icon;

                return (
                  <div
                    key={item._id}
                    className="notification-item"
                    onClick={() => handleItemClick(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.85rem 1rem',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      background: item.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.06)',
                      cursor: 'pointer',
                      transition: 'background var(--transition-fast)',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = item.isRead
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'rgba(99, 102, 241, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = item.isRead
                        ? 'transparent'
                        : 'rgba(99, 102, 241, 0.06)';
                    }}
                  >
                    {/* Unread indicator bar/dot */}
                    {!item.isRead && (
                      <div
                        style={{
                          position: 'absolute',
                          left: '4px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: '4px',
                          height: '24px',
                          borderRadius: '2px',
                          background: 'var(--accent-primary)',
                        }}
                      />
                    )}

                    {/* Icon */}
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: meta.bg,
                        color: meta.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      <IconComponent size={16} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.84rem',
                          fontWeight: item.isRead ? '500' : '700',
                          color: item.isRead ? 'var(--text-primary)' : '#FFFFFF',
                          marginBottom: '0.15rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0, fontWeight: '400' }}>
                          {formatTimeAgo(item.createdAt)}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: '0.76rem',
                          color: 'var(--text-secondary)',
                          lineHeight: '1.35',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {item.message}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        flexShrink: 0,
                        alignSelf: 'center',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!item.isRead && (
                        <button
                          onClick={(e) => handleMarkAsRead(e, item._id)}
                          title="Mark as read"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                          }}
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDelete(e, item._id)}
                        title="Delete"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'rgba(26, 34, 52, 0.7)',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              textAlign: 'center',
            }}
          >
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              style={{
                fontSize: '0.82rem',
                fontWeight: '600',
                color: 'var(--accent-primary)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>View All Notifications</span>
              <ExternalLink size={13} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
