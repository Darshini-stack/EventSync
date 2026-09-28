import React, { useState, useEffect, useCallback } from 'react';
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
  ArrowRight,
  RefreshCw,
  Sparkles,
  Info,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  MailOpen
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
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export const NotificationsPage = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterUnread, setFilterUnread] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [actionLoading, setActionLoading] = useState(false);

  // Helper to format date
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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

  // Map notification type to icon and color
  const getTypeMeta = (type) => {
    switch (type) {
      case 'EVENT_CREATED':
      case 'EVENT_PUBLISHED':
        return { icon: Sparkles, color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)', category: 'Event' };
      case 'REGISTRATION_SUCCESS':
      case 'REGISTRATION_OPEN':
      case 'REGISTRATION_CONFIRMED':
        return { icon: Calendar, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', category: 'Registration' };
      case 'PAYMENT_SUBMITTED':
        return { icon: DollarSign, color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', category: 'Payment' };
      case 'PAYMENT_APPROVED':
        return { icon: DollarSign, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', category: 'Payment' };
      case 'PAYMENT_REJECTED':
      case 'EVENT_CANCELLED':
      case 'REGISTRATION_DEADLINE':
      case 'REGISTRATION_CLOSED':
        return { icon: AlertTriangle, color: '#F43F5E', bg: 'rgba(244, 63, 94, 0.15)', category: 'Alert' };
      case 'PAYMENT_RETRY_AVAILABLE':
        return { icon: DollarSign, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', category: 'Payment' };
      case 'TICKET_ISSUED':
        return { icon: Ticket, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', category: 'Ticket' };
      case 'ATTENDANCE_UPDATED':
      case 'ATTENDANCE_CONFIRMED':
        return { icon: Award, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', category: 'Attendance' };
      case 'CERTIFICATE_ISSUED':
      case 'CERTIFICATE_RECEIVED':
        return { icon: Award, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', category: 'Certificate' };
      case 'SEATS_NEARLY_FULL':
      case 'EVENT_ALMOST_FULL':
      case 'EVENT_REMINDER_24H':
      case 'EVENT_REMINDER_1H':
        return { icon: Clock, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', category: 'Reminder' };
      case 'CAPACITY_INCREASED':
      case 'EVENT_UPDATED':
        return { icon: Calendar, color: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)', category: 'Event' };
      default:
        return { icon: Info, color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.15)', category: 'System' };
    }
  };

  // Get action details (link + label) for notification
  const getAction = (item) => {
    if (item.ticket) {
      return { label: 'View Ticket', link: '/student/tickets' };
    }
    if (item.certificate) {
      return { label: 'View Certificate', link: '/student/certificates' };
    }
    if (item.attendance) {
      return { label: 'View Attendance', link: '/student/attendance' };
    }
    if (item.payment) {
      return { label: 'View Payment', link: '/student/payments' };
    }
    if (item.registration) {
      return { label: 'View Registration', link: '/student/registrations' };
    }
    if (item.event) {
      const eventId = typeof item.event === 'object' ? item.event._id : item.event;
      return { label: 'View Event', link: `/events/${eventId}` };
    }
    return null;
  };

  // Load data
  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [notifsRes, countRes] = await Promise.all([
        fetchNotifications({ page, limit: 10, unreadOnly: filterUnread }),
        fetchUnreadNotificationCount(),
      ]);

      if (notifsRes?.data) {
        setNotifications(notifsRes.data);
        if (notifsRes.pagination) {
          setPagination(notifsRes.pagination);
        }
      }

      if (countRes && typeof countRes.unreadCount === 'number') {
        setUnreadCount(countRes.unreadCount);
      } else if (typeof notifsRes?.unreadCount === 'number') {
        setUnreadCount(notifsRes.unreadCount);
      }
    } catch (err) {
      console.error('[NotificationsPage] Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, page, filterUnread]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (actionLoading || unreadCount === 0) return;
    setActionLoading(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      if (filterUnread) {
        setNotifications([]);
      }
    } catch (err) {
      console.error('[NotificationsPage] Error marking all read:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Mark single as read
  const handleMarkAsRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (filterUnread) {
        setNotifications((prev) => prev.filter((n) => n._id !== id));
      }
    } catch (err) {
      console.error('[NotificationsPage] Error marking read:', err);
    }
  };

  // Delete single notification
  const handleDelete = async (id) => {
    try {
      await deleteNotification(id);
      const target = notifications.find((n) => n._id === id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      if (target && !target.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      setPagination((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }));
    } catch (err) {
      console.error('[NotificationsPage] Error deleting notification:', err);
    }
  };

  // Socket.IO real-time listener
  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();
    if (!socket) return;

    const onNotificationCreated = (newNotif) => {
      if (!newNotif || !newNotif._id) return;
      setNotifications((prev) => {
        if (prev.some((n) => n._id === newNotif._id)) return prev;
        setUnreadCount((c) => c + 1);
        if (page === 1) {
          if (!filterUnread || !newNotif.isRead) {
            return [newNotif, ...prev.slice(0, 9)];
          }
        }
        return prev;
      });
    };

    const onNotificationRead = ({ notificationId }) => {
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (filterUnread) {
        setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
      }
    };

    const onNotificationReadAll = () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      if (filterUnread) {
        setNotifications([]);
      }
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
      loadData();
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
  }, [isAuthenticated, page, filterUnread]);

  return (
    <div className="page-container" style={{ padding: '2.5rem 1.5rem', minHeight: 'calc(100vh - 80px)' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        {/* Page Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1.5rem',
            flexWrap: 'wrap',
            marginBottom: '2rem',
            paddingBottom: '1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                }}
              >
                <Bell size={22} />
              </div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span
                  id="notifications-page-unread-badge"
                  style={{
                    background: 'linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)',
                    color: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    boxShadow: '0 0 10px rgba(244, 63, 94, 0.4)',
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              Real-time alerts for seat reservations, payment verifications, digital passes, and event schedule updates.
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={loadData}
              disabled={loading}
              title="Refresh"
            >
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button
                id="mark-all-read-page-btn"
                variant="primary"
                size="sm"
                icon={CheckCheck}
                onClick={handleMarkAllAsRead}
                disabled={actionLoading}
              >
                Mark All as Read
              </Button>
            )}
          </div>
        </div>

        {/* Filter Tabs & Stats Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '1.5rem',
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(26, 34, 52, 0.6)',
              borderRadius: 'var(--radius-md)',
              padding: '0.3rem',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              id="tab-all-notifications"
              onClick={() => {
                setFilterUnread(false);
                setPage(1);
              }}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: !filterUnread ? 'var(--accent-primary)' : 'transparent',
                color: !filterUnread ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: !filterUnread ? '600' : '500',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all var(--transition-fast)',
              }}
            >
              All Notifications
            </button>
            <button
              id="tab-unread-notifications"
              onClick={() => {
                setFilterUnread(true);
                setPage(1);
              }}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: filterUnread ? 'var(--accent-primary)' : 'transparent',
                color: filterUnread ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: filterUnread ? '600' : '500',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all var(--transition-fast)',
              }}
            >
              <span>Unread Only</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: filterUnread ? '#FFFFFF' : 'rgba(99, 102, 241, 0.3)',
                    color: filterUnread ? 'var(--accent-primary)' : '#FFFFFF',
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    padding: '0.05rem 0.4rem',
                    borderRadius: '9999px',
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Counts Info */}
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing {notifications.length} of {pagination.total} records
          </div>
        </div>

        {/* Notifications Content */}
        {loading ? (
          <div
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <RefreshCw
              size={32}
              style={{ animation: 'spin 1.2s linear infinite', color: 'var(--accent-primary)', margin: '0 auto 1rem' }}
            />
            <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Loading notifications...</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
              Fetching your latest live alerts from MongoDB
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div
            id="notifications-empty-state"
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                color: 'var(--accent-primary)',
              }}
            >
              {filterUnread ? <MailOpen size={28} /> : <Bell size={28} />}
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              {filterUnread ? 'No Unread Notifications' : 'No Notifications Found'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
              {filterUnread
                ? "You're completely caught up! All your event notifications have been marked as read."
                : 'You have no notifications yet. Register for campus events, submit payments, or check attendance to see real-time updates.'}
            </p>
            {filterUnread ? (
              <Button variant="secondary" onClick={() => setFilterUnread(false)}>
                View All Notifications
              </Button>
            ) : (
              <Link to="/events">
                <Button variant="primary" icon={Calendar}>
                  Explore Events
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {notifications.map((item) => {
              const meta = getTypeMeta(item.type);
              const IconComponent = meta.icon;
              const action = getAction(item);

              return (
                <div
                  key={item._id}
                  id={`notification-card-${item._id}`}
                  className="notification-card"
                  style={{
                    background: item.isRead ? 'var(--bg-secondary)' : 'rgba(26, 34, 52, 0.85)',
                    border: '1px solid',
                    borderColor: item.isRead ? 'var(--border-subtle)' : 'rgba(99, 102, 241, 0.35)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.2rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    transition: 'all var(--transition-fast)',
                    position: 'relative',
                    boxShadow: item.isRead ? 'none' : '0 4px 15px rgba(99, 102, 241, 0.1)',
                  }}
                >
                  {/* Left Icon */}
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: meta.bg,
                      color: meta.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconComponent size={20} />
                  </div>

                  {/* Body Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Top Row: Category + Unread status + Date */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            padding: '0.1rem 0.5rem',
                            borderRadius: '4px',
                            background: meta.bg,
                            color: meta.color,
                          }}
                        >
                          {meta.category}
                        </span>

                        {!item.isRead && (
                          <span
                            style={{
                              background: 'rgba(99, 102, 241, 0.25)',
                              color: 'var(--accent-primary)',
                              fontSize: '0.68rem',
                              fontWeight: '700',
                              padding: '0.1rem 0.45rem',
                              borderRadius: '9999px',
                              border: '1px solid rgba(99, 102, 241, 0.4)',
                            }}
                          >
                            NEW
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <Clock size={13} />
                        <span title={formatDateTime(item.createdAt)}>
                          {formatTimeAgo(item.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3
                      style={{
                        fontSize: '1rem',
                        fontWeight: item.isRead ? '600' : '700',
                        color: item.isRead ? 'var(--text-primary)' : '#FFFFFF',
                        marginBottom: '0.35rem',
                      }}
                    >
                      {item.title}
                    </h3>

                    {/* Message */}
                    <p
                      style={{
                        fontSize: '0.86rem',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.45',
                        marginBottom: action ? '0.85rem' : '0.2rem',
                        wordBreak: 'break-word',
                      }}
                    >
                      {item.message}
                    </p>

                    {/* Context Action */}
                    {action && (
                      <Link
                        to={action.link}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.82rem',
                          fontWeight: '600',
                          color: 'var(--accent-primary)',
                          textDecoration: 'none',
                          padding: '0.3rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(99, 102, 241, 0.1)',
                          border: '1px solid rgba(99, 102, 241, 0.25)',
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        <span>{action.label}</span>
                        <ArrowRight size={13} />
                      </Link>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      flexShrink: 0,
                    }}
                  >
                    {!item.isRead && (
                      <button
                        id={`mark-read-btn-${item._id}`}
                        onClick={() => handleMarkAsRead(item._id)}
                        title="Mark as read"
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        <Check size={13} />
                        <span className="hide-mobile">Read</span>
                      </button>
                    )}

                    <button
                      id={`delete-btn-${item._id}`}
                      onClick={() => handleDelete(item._id)}
                      title="Delete notification"
                      style={{
                        background: 'rgba(244, 63, 94, 0.08)',
                        border: '1px solid rgba(244, 63, 94, 0.2)',
                        color: '#F43F5E',
                        cursor: 'pointer',
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      <Trash2 size={13} />
                      <span className="hide-mobile">Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <Button
              id="prev-page-btn"
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.hasPrevPage || loading}
            >
              Previous
            </Button>

            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Page <strong style={{ color: 'var(--text-primary)' }}>{pagination.page}</strong> of{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{pagination.totalPages}</strong>
            </span>

            <Button
              id="next-page-btn"
              variant="secondary"
              size="sm"
              icon={ChevronRight}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={!pagination.hasNextPage || loading}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
