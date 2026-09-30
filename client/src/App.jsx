import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { EventScannerProvider } from './context/EventScannerContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { EventsPage } from './pages/EventsPage';
import { EventDetailsPage } from './pages/EventDetailsPage';
import { EventRegistrationPage } from './pages/EventRegistrationPage';
import { StudentLoginPage } from './pages/StudentLoginPage';
import { StudentRegisterPage } from './pages/StudentRegisterPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { StudentDashboardPage } from './pages/StudentDashboardPage';
import { MyRegistrationsPage } from './pages/MyRegistrationsPage';
import { MyPaymentsPage } from './pages/MyPaymentsPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { MyAttendancePage } from './pages/MyAttendancePage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { FoundationDashboard } from './pages/FoundationDashboard';
import { ChatPage } from './pages/ChatPage';
import { StartupLoader } from './components/StartupLoader';
import { initSocket } from './services/socket';

// Scroll to top upon route change
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketId, setSocketId] = useState(null);

  useEffect(() => {
    const socket = initSocket();

    const onConnect = () => {
      setSocketConnected(true);
      setSocketId(socket.id);
    };

    const onDisconnect = () => {
      setSocketConnected(false);
      setSocketId(null);
    };

    const onConnectionEstablished = (data) => {
      if (data && data.socketId) {
        setSocketId(data.socketId);
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connection_established', onConnectionEstablished);

    if (socket.connected) {
      setSocketConnected(true);
      setSocketId(socket.id);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connection_established', onConnectionEstablished);
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        <EventScannerProvider>
          <StartupLoader />
          <ScrollToTop />
          <div className="app-container">
            <Navbar />

          <main className="main-content">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/events/:id" element={<EventDetailsPage />} />
              <Route path="/events/:id/register" element={<EventRegistrationPage />} />
              <Route path="/events/:eventId/register" element={<EventRegistrationPage />} />
              <Route path="/login" element={<StudentLoginPage />} />
              <Route path="/register" element={<StudentRegisterPage />} />
              <Route path="/admin/login" element={<AdminLoginPage />} />

              {/* Protected Student Dashboard & Registrations */}
              <Route
                path="/student/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT']}>
                    <StudentDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/registrations"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT']}>
                    <MyRegistrationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-registrations"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT']}>
                    <MyRegistrationsPage />
                  </ProtectedRoute>
                }
              />
              {/* Student Payments Redirect */}
              <Route
                path="/student/payments"
                element={<Navigate to="/student/dashboard" replace />}
              />
              <Route
                path="/student/tickets"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT']}>
                    <MyTicketsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/attendance"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT']}>
                    <MyAttendancePage />
                  </ProtectedRoute>
                }
              />

              {/* Protected EventAdmin Dashboard */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['EVENTADMIN']}>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected User Profile */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'EVENTADMIN']}>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Notifications Center */}
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'EVENTADMIN']}>
                    <NotificationsPage />
                  </ProtectedRoute>
                }
              />

              {/* EventSync AI Assistant Chat */}
              <Route
                path="/chat"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'EVENTADMIN']}>
                    <ChatPage />
                  </ProtectedRoute>
                }
              />

              {/* Phase 1 Developer Diagnostics Console */}
              <Route
                path="/diagnostics"
                element={
                  <FoundationDashboard
                    socketConnected={socketConnected}
                    socketId={socketId}
                  />
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <Footer />
        </div>
      </EventScannerProvider>
    </Router>
  </AuthProvider>
  );
}
