// API Client Service with Dynamic LAN & Localhost Resolution + JWT Bearer Injection
import { getPublicAppUrl, getEventRegistrationUrl } from '../utils/url';
export { getPublicAppUrl, getEventRegistrationUrl };

export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  // If explicitly configured with a non-localhost URL (e.g. deployed production backend), use it directly
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // When running in the browser, leverage the Vite proxy (/api -> backend) for seamless localhost and LAN access
  if (typeof window !== 'undefined') {
    return '/api';
  }

  return envUrl || 'http://localhost:5000/api';
};

// Generic request helper with automatic Authorization header injection
const request = async (endpoint, options = {}) => {
  const baseUrl = getApiBaseUrl();
  const token = typeof window !== 'undefined' ? localStorage.getItem('eventsync_token') : null;

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: data.message || 'An error occurred during the request.',
        data: data.data || null,
        ...data,
      };
    }

    return {
      success: true,
      status: response.status,
      message: data.message || 'Success',
      data: data.data !== undefined ? data.data : data,
      counts: data.counts,
      count: data.count,
      token: data.token,
      user: data.user,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: error.message || 'Network unreachable. Please ensure the backend server is running.',
      data: null,
    };
  }
};

// Health Check API
export const fetchHealth = async () => {
  return request('/health', { method: 'GET' });
};

// --- AUTHENTICATION APIS ---

// POST /api/auth/register
export const registerStudent = async ({ name, email, phone, password, confirmPassword }) => {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, phone, password, confirmPassword }),
  });
};

// POST /api/auth/admin/register
export const registerAdmin = async ({ name, email, phone, password, confirmPassword, accessCode }) => {
  return request('/auth/admin/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, phone, password, confirmPassword, accessCode }),
  });
};

// POST /api/auth/login
export const loginStudent = async ({ email, password }) => {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};

// POST /api/auth/admin/login
export const loginAdmin = async ({ email, password, accessCode }) => {
  return request('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, accessCode }),
  });
};

// GET /api/auth/me
export const fetchCurrentUser = async () => {
  return request('/auth/me', { method: 'GET' });
};

// PUT /api/auth/profile
export const updateUserProfile = async (profileData) => {
  return request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
};

// POST /api/auth/logout
export const logoutUser = async () => {
  return request('/auth/logout', { method: 'POST' });
};

// --- EVENTS APIS ---

// GET /api/events (Queries live published MongoDB events)
export const fetchEvents = async () => {
  return request('/events', { method: 'GET' });
};

// GET /api/events/:id (Fetch single event detail)
export const fetchEventById = async (id) => {
  return request(`/events/${id}`, { method: 'GET' });
};

// GET /api/events/admin/all (EventAdmin only: all events + status counts)
export const fetchAdminEvents = async () => {
  return request('/events/admin/all', { method: 'GET' });
};

// POST /api/events (EventAdmin only: create new real event, supports JSON or FormData)
export const createEvent = async (eventData) => {
  const isFormData = typeof FormData !== 'undefined' && eventData instanceof FormData;
  return request('/events', {
    method: 'POST',
    body: isFormData ? eventData : JSON.stringify(eventData),
  });
};

// PUT /api/events/:id (EventAdmin only: update existing event, supports JSON or FormData)
export const updateEvent = async (id, eventData) => {
  const isFormData = typeof FormData !== 'undefined' && eventData instanceof FormData;
  return request(`/events/${id}`, {
    method: 'PUT',
    body: isFormData ? eventData : JSON.stringify(eventData),
  });
};

// DELETE /api/events/:id (EventAdmin only: delete event)
export const deleteEvent = async (id) => {
  return request(`/events/${id}`, {
    method: 'DELETE',
  });
};

// GET /api/events/:id/poster (Stream event poster image URL)
export const getEventPosterUrl = (eventId) => {
  return `${getApiBaseUrl()}/events/${eventId}/poster`;
};

// GET /api/events/:id/registration-qr (Stream registration QR image URL)
export const getEventRegistrationQrUrl = (eventId, clientUrl = null) => {
  const targetUrl = clientUrl || getPublicAppUrl();
  const base = `${getApiBaseUrl()}/events/${eventId}/registration-qr`;
  return targetUrl ? `${base}?clientUrl=${encodeURIComponent(targetUrl)}` : base;
};

// GET /api/events/:id/registration-qr?format=json (Fetch JSON data URL of registration QR)
export const fetchEventRegistrationQr = async (eventId, clientUrl = null) => {
  const targetUrl = clientUrl || getPublicAppUrl();
  const query = targetUrl
    ? `?format=json&clientUrl=${encodeURIComponent(targetUrl)}`
    : '?format=json';
  return request(`/events/${eventId}/registration-qr${query}`, { method: 'GET' });
};

// --- REGISTRATIONS APIS (PHASE 4) ---

// --- REGISTRATIONS APIS ---

// POST /api/events/:id/register or /api/registrations
export const registerForEvent = async (eventId, formData = {}) => {
  const actualId = typeof eventId === 'object' && eventId !== null ? eventId.eventId : eventId;
  const payload = typeof eventId === 'object' ? eventId : { eventId, ...formData };
  const endpoint = actualId ? `/events/${actualId}/register` : '/registrations';
  return request(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

// DELETE /api/registrations/:id (Student only: cancel own registration)
export const cancelRegistration = async (id) => {
  return request(`/registrations/${id}`, {
    method: 'DELETE',
  });
};

// GET /api/registrations/my (Student only: fetch own registrations)
export const fetchMyRegistrations = async () => {
  return request('/registrations/my', { method: 'GET' });
};

// GET /api/registrations/admin (EventAdmin only: view registrations)
export const fetchAdminRegistrations = async (eventId = null) => {
  const query = eventId ? `?eventId=${eventId}` : '';
  return request(`/registrations/admin${query}`, { method: 'GET' });
};

// --- DIGITAL EVENT PASSES (FORMER TICKETS) APIS ---

// GET /api/tickets/my (Student only: fetch own digital passes)
export const fetchMyPasses = async () => {
  return request('/tickets/my', { method: 'GET' });
};
export const fetchMyTickets = fetchMyPasses; // Backward compatibility alias

// GET /api/tickets/registration/:registrationId (Fetch digital pass by registrationId)
export const fetchPassByRegistration = async (registrationId) => {
  return request(`/tickets/registration/${registrationId}`, { method: 'GET' });
};

// POST /api/tickets (Student only: generate or retrieve active pass)
export const createTicket = async (registrationId) => {
  return request('/tickets', {
    method: 'POST',
    body: JSON.stringify({ registrationId }),
  });
};

// GET /api/tickets/admin (EventAdmin only: view passes roster and counts)
export const fetchAdminTickets = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.append('status', params.status);
  if (params.eventId) queryParams.append('eventId', params.eventId);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  return request(`/tickets/admin${query}`, { method: 'GET' });
};

// GET /api/tickets/:id (Student owner or EventAdmin)
export const fetchTicketById = async (id) => {
  return request(`/tickets/${id}`, { method: 'GET' });
};

// Helper: Get pass QR streaming URL
export const getTicketQrUrl = (id, format = null, memberRollNumber = null) => {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams();
  if (format) params.append('format', format);
  if (memberRollNumber) params.append('memberRollNumber', memberRollNumber);
  const query = params.toString() ? `?${params.toString()}` : '';
  return `${baseUrl}/tickets/${id}/qr${query}`;
};
export const getPassQrUrl = getTicketQrUrl;

// --- SMART ATTENDANCE APIS ---

// GET /api/attendance/admin (EventAdmin only: smart attendance roster & metrics)
export const fetchAdminAttendanceRoster = async (eventId = null) => {
  const query = eventId ? `?eventId=${eventId}` : '';
  return request(`/attendance/admin${query}`, { method: 'GET' });
};
export const fetchAdminAttendance = fetchAdminAttendanceRoster; // Alias

// POST /api/attendance/mark (EventAdmin only: mark student Present or Absent)
export const markAttendance = async (registrationId, status) => {
  const payload = typeof registrationId === 'object' && registrationId !== null
    ? registrationId
    : { registrationId, status };
  return request('/attendance/mark', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

// POST /api/attendance/mark-all (EventAdmin only: bulk mark all Present or Absent)
export const markAllAttendance = async (eventId, status) => {
  const payload = typeof eventId === 'object' && eventId !== null
    ? eventId
    : { eventId, status };
  return request('/attendance/mark-all', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

// POST /api/attendance/scan-pass (EventAdmin only: identify attendee from QR without auto-marking)
export const scanDigitalPass = async (qrPayload) => {
  const payload = typeof qrPayload === 'object' && qrPayload !== null
    ? qrPayload
    : { qrPayload };
  return request('/attendance/scan-pass', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

// POST /api/attendance/verify-ticket (EventAdmin only: manual ticket pass code verification)
export const verifyTicketPassCode = async (passCode, eventId = null) => {
  const payload = typeof passCode === 'object' && passCode !== null
    ? passCode
    : { passCode, eventId };
  return request('/attendance/verify-ticket', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

// POST /api/attendance/scan-ticket & /api/attendance/check-in (Gate check-in & verification)
export const checkInTicket = async (qrPayload, eventId = null) => {
  const payload = typeof qrPayload === 'object' && qrPayload !== null
    ? qrPayload
    : { qrPayload, eventId };
  return request('/attendance/scan-ticket', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const scanTicket = checkInTicket;

// GET /api/attendance/my (Student only: authenticated personal attendance history)
export const fetchMyAttendance = async () => {
  return request('/attendance/my', { method: 'GET' });
};

// --- CERTIFICATES APIS ---

// GET /api/certificates/admin (EventAdmin only: certificate roster, counts, and not-received list)
export const fetchAdminCertificates = async (eventId = null) => {
  const query = eventId ? `?eventId=${eventId}` : '';
  return request(`/certificates/admin${query}`, { method: 'GET' });
};

// PATCH /api/certificates/status (EventAdmin only: issue or update certificate)
export const updateCertificateStatus = async (registrationId, status, certificateId = null) => {
  const payload = typeof registrationId === 'object' && registrationId !== null
    ? registrationId
    : { registrationId, status, certificateId };
  return request('/certificates/status', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

// POST /api/certificates/confirm-receipt (Student only: confirm certificate received)
export const confirmCertificateReceived = async (registrationId, certificateId = null) => {
  const payload = typeof registrationId === 'object' && registrationId !== null
    ? registrationId
    : { registrationId, certificateId };
  return request('/certificates/confirm-receipt', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

// GET /api/certificates/my (Student only: view own certificates)
export const fetchMyCertificates = async () => {
  return request('/certificates/my', { method: 'GET' });
};

// --- LEGACY PAYMENT SAFE FALLBACKS (NO ACTIVE PAYMENT WORKFLOW) ---
export const fetchMyPayments = async () => ({ success: true, count: 0, data: [] });
export const fetchAdminPayments = async () => ({
  success: true,
  count: 0,
  data: [],
  counts: { total: 0, pending: 0, approved: 0, rejected: 0 },
});
export const submitPaymentProof = async () => ({ success: false, message: 'Payments are not required.' });
export const approvePayment = async () => ({ success: false, message: 'Payments are not required.' });
export const rejectPayment = async () => ({ success: false, message: 'Payments are not required.' });
export const getPaymentProofUrl = () => '';

// --- NOTIFICATION APIS (PHASE 8) ---

// GET /api/notifications (Fetch paginated notifications with optional unread filter)
export const fetchNotifications = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append('page', params.page);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.unreadOnly !== undefined && params.unreadOnly !== null) {
    queryParams.append('unreadOnly', params.unreadOnly);
  }
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  return request(`/notifications${query}`, { method: 'GET' });
};

// GET /api/notifications/unread-count (Fetch live unread count)
export const fetchUnreadNotificationCount = async () => {
  return request('/notifications/unread-count', { method: 'GET' });
};

// PATCH /api/notifications/:id/read (Mark single notification as read)
export const markNotificationAsRead = async (id) => {
  return request(`/notifications/${id}/read`, { method: 'PATCH' });
};

// PATCH /api/notifications/read-all (Mark all notifications as read)
export const markAllNotificationsAsRead = async () => {
  return request('/notifications/read-all', { method: 'PATCH' });
};

// DELETE /api/notifications/:id (Delete a notification)
export const deleteNotification = async (id) => {
  return request(`/notifications/${id}`, { method: 'DELETE' });
};

// --- AI CHATBOT APIS ---

// POST /api/chat (Send chat prompt with latest 10 messages history)
export const sendChatMessage = async ({ message, history = [] }) => {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  });
};

