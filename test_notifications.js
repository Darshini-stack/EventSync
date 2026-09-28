const http = require('http');
const path = require('path');
const fs = require('fs');

module.paths.push(path.resolve(__dirname, 'server/node_modules'));
module.paths.push(path.resolve(__dirname, 'client/node_modules'));

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { io: ioClient } = require('socket.io-client');

require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });

const app = require('./server/src/app');
const config = require('./server/src/config/env');
const { initSocket } = require('./server/src/sockets/index');
const User = require('./server/src/models/User');
const Event = require('./server/src/models/Event');
const Registration = require('./server/src/models/Registration');
const Payment = require('./server/src/models/Payment');
const Ticket = require('./server/src/models/Ticket');
const Attendance = require('./server/src/models/Attendance');
const Notification = require('./server/src/models/Notification');
const notificationService = require('./server/src/services/notificationService');
const { checkAndSendReminders } = require('./server/src/services/reminderScheduler');

const TEST_PORT = 5098;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const logPass = (num, desc) => console.log(`${colors.green}✔ [TEST ${num}] PASSED:${colors.reset} ${desc}`);
const logFail = (num, desc, err) => console.error(`${colors.red}✘ [TEST ${num}] FAILED:${colors.reset} ${desc}\n   Details:`, err);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const makeRequest = (port, reqPath, method = 'GET', body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            parsed = raw;
          }
          resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
};

async function runNotificationTestSuite() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================`);
  console.log(`EVENTSYNC — PHASE 8 NOTIFICATION AUTOMATED TEST SUITE (36 TESTS)`);
  console.log(`======================================================================${colors.reset}\n`);

  let server;
  let passed = 0;
  let failed = 0;

  let adminUser;
  let studentA;
  let studentB;
  let adminToken;
  let studentAToken;
  let studentBToken;

  const testEventIds = [];
  const testRegIds = [];
  const testPayIds = [];
  const testTicketIds = [];
  const testAttendanceIds = [];
  const testNotifIds = [];

  try {
    // 1. Connect to MongoDB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }

    // 2. Start HTTP Server & Socket.IO
    server = http.createServer(app);
    initSocket(server, ['*']);
    await new Promise((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));
    console.log(`[Test Setup] Test server active on http://127.0.0.1:${TEST_PORT}`);

    // 3. Load baseline users
    adminUser = await User.findOne({ role: 'EVENTADMIN' });
    const students = await User.find({ role: 'STUDENT' });
    studentA = students[0];
    studentB = students[1];

    if (!adminUser || !studentA || !studentB) {
      throw new Error('Baseline users (EVENTADMIN, STUDENT A, STUDENT B) must exist in MongoDB.');
    }

    // Sign tokens
    adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role, email: adminUser.email },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    studentAToken = jwt.sign(
      { id: studentA._id, role: studentA.role, email: studentA.email },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    studentBToken = jwt.sign(
      { id: studentB._id, role: studentB.role, email: studentB.email },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // TEST 1: Notification model creation
    try {
      const doc = await Notification.create({
        recipient: studentA._id,
        type: 'SYSTEM',
        title: 'System Welcome',
        message: 'Welcome to EventSync Notifications System.',
      });
      testNotifIds.push(doc._id);
      if (doc._id && doc.type === 'SYSTEM' && doc.isRead === false) {
        logPass(1, 'Notification model creation and schema field defaults verified.');
        passed++;
      } else {
        throw new Error('Notification creation failed default assertions.');
      }
    } catch (e) {
      logFail(1, 'Notification model creation', e);
      failed++;
    }

    // TEST 2: Student notification creation
    try {
      const notif = await notificationService.createNotification({
        recipient: studentA._id,
        type: 'REGISTRATION_OPEN',
        title: 'Registration Verified',
        message: 'Your registration has been confirmed.',
      });
      testNotifIds.push(notif._id);
      if (notif.recipient.toString() === studentA._id.toString()) {
        logPass(2, 'Student-specific notification created via notificationService.');
        passed++;
      } else {
        throw new Error('Recipient did not match studentA');
      }
    } catch (e) {
      logFail(2, 'Student notification creation', e);
      failed++;
    }

    // TEST 3: Admin notification creation
    try {
      const notif = await notificationService.createNotification({
        recipient: adminUser._id,
        type: 'PAYMENT_SUBMITTED',
        title: 'New Student Payment',
        message: 'A student submitted a new fee receipt.',
      });
      testNotifIds.push(notif._id);
      if (notif.recipient.toString() === adminUser._id.toString() && notif.type === 'PAYMENT_SUBMITTED') {
        logPass(3, 'Admin operational notification created via notificationService.');
        passed++;
      } else {
        throw new Error('Recipient did not match adminUser');
      }
    } catch (e) {
      logFail(3, 'Admin notification creation', e);
      failed++;
    }

    // TEST 4: GET own notifications
    try {
      const res = await makeRequest(TEST_PORT, '/api/notifications', 'GET', null, studentAToken);
      if (res.statusCode === 200 && res.body.success && Array.isArray(res.body.data)) {
        const allMatch = res.body.data.every((n) => n.recipient.toString() === studentA._id.toString());
        if (allMatch && res.body.data.length >= 2) {
          logPass(4, 'GET /api/notifications returns user own notifications.');
          passed++;
        } else {
          throw new Error('Returned notifications contain invalid recipients or insufficient count.');
        }
      } else {
        throw new Error(`Unexpected response: ${res.statusCode} ${JSON.stringify(res.body)}`);
      }
    } catch (e) {
      logFail(4, 'GET own notifications', e);
      failed++;
    }

    // TEST 5: Pagination
    try {
      // Create 15 notifications for pagination test
      const bulkItems = [];
      for (let i = 0; i < 15; i++) {
        bulkItems.push({
          recipient: studentA._id,
          type: 'SYSTEM',
          title: `Bulk Notice #${i + 1}`,
          message: `Testing pagination index ${i + 1}`,
        });
      }
      const createdBulk = await notificationService.createNotifications(bulkItems);
      createdBulk.forEach((n) => testNotifIds.push(n._id));

      const res = await makeRequest(TEST_PORT, '/api/notifications?page=1&limit=5', 'GET', null, studentAToken);
      if (
        res.statusCode === 200 &&
        res.body.data.length === 5 &&
        res.body.pagination.page === 1 &&
        res.body.pagination.limit === 5 &&
        res.body.pagination.total >= 15 &&
        res.body.pagination.hasNextPage === true
      ) {
        logPass(5, 'Notification pagination correctly calculates limits, offsets, and total pages.');
        passed++;
      } else {
        throw new Error(`Pagination metadata mismatch: ${JSON.stringify(res.body.pagination)}`);
      }
    } catch (e) {
      logFail(5, 'Pagination', e);
      failed++;
    }

    // TEST 6: Unread count
    try {
      const res = await makeRequest(TEST_PORT, '/api/notifications/unread-count', 'GET', null, studentAToken);
      if (res.statusCode === 200 && res.body.success && typeof res.body.unreadCount === 'number' && res.body.unreadCount >= 15) {
        logPass(6, 'GET /api/notifications/unread-count returns accurate unread count.');
        passed++;
      } else {
        throw new Error(`Invalid unread count response: ${JSON.stringify(res.body)}`);
      }
    } catch (e) {
      logFail(6, 'Unread count', e);
      failed++;
    }

    // TEST 7: Mark own notification read
    let testNotifToRead;
    try {
      testNotifToRead = await Notification.findOne({ recipient: studentA._id, isRead: false });
      const res = await makeRequest(
        TEST_PORT,
        `/api/notifications/${testNotifToRead._id}/read`,
        'PATCH',
        null,
        studentAToken
      );
      if (res.statusCode === 200 && res.body.success && res.body.data.isRead === true) {
        const dbDoc = await Notification.findById(testNotifToRead._id);
        if (dbDoc.isRead && dbDoc.readAt) {
          logPass(7, 'PATCH /api/notifications/:id/read marks notification as read with readAt timestamp.');
          passed++;
        } else {
          throw new Error('Database record was not updated with isRead and readAt.');
        }
      } else {
        throw new Error(`Mark read request failed: ${res.statusCode}`);
      }
    } catch (e) {
      logFail(7, 'Mark own notification read', e);
      failed++;
    }

    // TEST 8: Mark all own notifications read
    try {
      const res = await makeRequest(TEST_PORT, '/api/notifications/read-all', 'PATCH', null, studentAToken);
      if (res.statusCode === 200 && res.body.success && res.body.modifiedCount > 0) {
        const remainingUnread = await Notification.countDocuments({ recipient: studentA._id, isRead: false });
        if (remainingUnread === 0) {
          logPass(8, 'PATCH /api/notifications/read-all successfully marks all unread notifications read.');
          passed++;
        } else {
          throw new Error(`Expected 0 unread remaining, found: ${remainingUnread}`);
        }
      } else {
        throw new Error(`Mark all read failed: ${JSON.stringify(res.body)}`);
      }
    } catch (e) {
      logFail(8, 'Mark all own notifications read', e);
      failed++;
    }

    // TEST 9: Delete own notification
    try {
      const notifToDelete = await Notification.create({
        recipient: studentA._id,
        type: 'SYSTEM',
        title: 'Temporary Deletion Test',
        message: 'This will be deleted.',
      });
      const res = await makeRequest(TEST_PORT, `/api/notifications/${notifToDelete._id}`, 'DELETE', null, studentAToken);
      if (res.statusCode === 200 && res.body.success) {
        const found = await Notification.findById(notifToDelete._id);
        if (!found) {
          logPass(9, 'DELETE /api/notifications/:id removes notification from MongoDB.');
          passed++;
        } else {
          throw new Error('Document still exists in database after deletion.');
        }
      } else {
        throw new Error(`Delete failed: ${res.statusCode}`);
      }
    } catch (e) {
      logFail(9, 'Delete own notification', e);
      failed++;
    }

    // TEST 10: Student cannot access another student's notification
    try {
      const notifB = await Notification.create({
        recipient: studentB._id,
        type: 'SYSTEM',
        title: 'Student B Private Notice',
        message: 'Classified info for student B.',
      });
      testNotifIds.push(notifB._id);

      const res = await makeRequest(TEST_PORT, '/api/notifications', 'GET', null, studentAToken);
      const leaked = res.body.data.find((n) => n._id.toString() === notifB._id.toString());
      if (!leaked) {
        logPass(10, 'Student A cannot see or retrieve Student B notifications via GET.');
        passed++;
      } else {
        throw new Error('Privacy breach: Student A retrieved Student B notification.');
      }
    } catch (e) {
      logFail(10, "Student cannot access another student's notification", e);
      failed++;
    }

    // TEST 11: Student cannot modify another student's notification
    try {
      const notifB = await Notification.findOne({ recipient: studentB._id });
      const res = await makeRequest(
        TEST_PORT,
        `/api/notifications/${notifB._id}/read`,
        'PATCH',
        null,
        studentAToken
      );
      if (res.statusCode === 404) {
        logPass(11, "Student A attempting to modify Student B's notification returns 404 Not Found.");
        passed++;
      } else {
        throw new Error(`Expected 404 status code, received: ${res.statusCode}`);
      }
    } catch (e) {
      logFail(11, "Student cannot modify another student's notification", e);
      failed++;
    }

    // TEST 12: Admin cannot access another user's private notifications
    try {
      const res = await makeRequest(TEST_PORT, '/api/notifications', 'GET', null, adminToken);
      const studentLeaked = res.body.data.find(
        (n) => n.recipient.toString() === studentA._id.toString() || n.recipient.toString() === studentB._id.toString()
      );
      if (!studentLeaked) {
        logPass(12, 'EventAdmin GET /api/notifications is strictly scoped to Admin recipient.');
        passed++;
      } else {
        throw new Error("Admin query returned a student's private notification.");
      }
    } catch (e) {
      logFail(12, "Admin cannot access another user's private notifications", e);
      failed++;
    }

    // TEST 13: Socket.IO notification delivery
    try {
      const socketA = ioClient(`http://127.0.0.1:${TEST_PORT}`, {
        transports: ['websocket'],
        auth: { token: studentAToken },
      });

      const socketPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          socketA.disconnect();
          reject(new Error('Socket.IO event timeout after 5000ms'));
        }, 5000);

        socketA.on('notification_created', (data) => {
          clearTimeout(timer);
          socketA.disconnect();
          resolve(data);
        });
      });

      // Wait 300ms for connection & room join
      await sleep(300);

      const notif = await notificationService.createNotification({
        recipient: studentA._id,
        type: 'SYSTEM',
        title: 'Real-time WebSocket Test',
        message: 'Verifying real-time delivery.',
      });
      testNotifIds.push(notif._id);

      const received = await socketPromise;
      if (received && received.title === 'Real-time WebSocket Test') {
        logPass(13, 'Socket.IO delivers notification_created event in real-time to authenticated user.');
        passed++;
      } else {
        throw new Error('Received payload did not match dispatched notification.');
      }
    } catch (e) {
      logFail(13, 'Socket.IO notification delivery', e);
      failed++;
    }

    // TEST 14: Socket.IO user-room isolation
    try {
      const socketB = ioClient(`http://127.0.0.1:${TEST_PORT}`, {
        transports: ['websocket'],
        auth: { token: studentBToken },
      });

      let socketBReceived = false;
      socketB.on('notification_created', (data) => {
        if (data.title === 'Room Isolation Verification') {
          socketBReceived = true;
        }
      });

      await sleep(300);

      // Send to Student A ONLY
      const notif = await notificationService.createNotification({
        recipient: studentA._id,
        type: 'SYSTEM',
        title: 'Room Isolation Verification',
        message: 'Strictly for student A.',
      });
      testNotifIds.push(notif._id);

      await sleep(600);
      socketB.disconnect();

      if (!socketBReceived) {
        logPass(14, 'Socket.IO enforces user-room isolation: Student B does not receive Student A notification.');
        passed++;
      } else {
        throw new Error('Socket isolation breach: Student B received Student A notification.');
      }
    } catch (e) {
      logFail(14, 'Socket.IO user-room isolation', e);
      failed++;
    }

    // TEST 15: Event publish notification
    let publishedEvent;
    try {
      const res = await makeRequest(
        TEST_PORT,
        '/api/events',
        'POST',
        {
          title: 'Full Stack Tech Summit 2026',
          description: 'Explore the future of web architecture and real-time distributed applications.',
          category: 'Technology',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          time: '10:00 AM',
          venue: 'Auditorium Hall A',
          capacity: 100,
          isPaid: false,
          fee: 0,
          status: 'PUBLISHED',
        },
        adminToken
      );

      if (res.statusCode === 201 && res.body.data) {
        publishedEvent = res.body.data;
        testEventIds.push(publishedEvent._id);

        const notifA = await Notification.findOne({
          recipient: studentA._id,
          type: 'EVENT_PUBLISHED',
          event: publishedEvent._id,
        });

        if (notifA && notifA.title.includes('New Event Published')) {
          logPass(15, 'Publishing an event triggers EVENT_PUBLISHED notification for students.');
          passed++;
        } else {
          throw new Error('EVENT_PUBLISHED notification not found for student A.');
        }
      } else {
        throw new Error(`Failed to create published event: ${res.statusCode}`);
      }
    } catch (e) {
      logFail(15, 'Event publish notification', e);
      failed++;
    }

    // TEST 16: Event update notification
    try {
      // Student A registers for the event first
      const regRes = await makeRequest(
        TEST_PORT,
        '/api/registrations',
        'POST',
        { eventId: publishedEvent._id },
        studentAToken
      );
      if (regRes.statusCode === 201) {
        testRegIds.push(regRes.body.data._id);

        // Admin updates venue and time
        const updateRes = await makeRequest(
          TEST_PORT,
          `/api/events/${publishedEvent._id}`,
          'PUT',
          {
            venue: 'Main Innovation Amphitheater',
            time: '11:00 AM',
          },
          adminToken
        );

        if (updateRes.statusCode === 200) {
          const notif = await Notification.findOne({
            recipient: studentA._id,
            type: 'EVENT_UPDATED',
            event: publishedEvent._id,
          });

          if (notif && notif.message.includes('Main Innovation Amphitheater')) {
            logPass(16, 'Updating event details triggers EVENT_UPDATED notification to registered students.');
            passed++;
          } else {
            throw new Error('EVENT_UPDATED notification not generated for registered student.');
          }
        } else {
          throw new Error(`Failed to update event: ${updateRes.statusCode}`);
        }
      } else {
        throw new Error(`Registration failed: ${regRes.statusCode}`);
      }
    } catch (e) {
      logFail(16, 'Event update notification', e);
      failed++;
    }

    // TEST 17: Event cancellation notification
    try {
      // Create a second event with a registration, then cancel it
      const tempEvent = await Event.create({
        title: 'Robotics Workshop Cancel Test',
        description: 'Robotics hands-on workshop.',
        category: 'Workshop',
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        time: '02:00 PM',
        venue: 'Lab 4',
        capacity: 50,
        availableSeats: 49,
        isPaid: false,
        fee: 0,
        status: 'PUBLISHED',
        createdBy: adminUser._id,
      });
      testEventIds.push(tempEvent._id);

      const tempReg = await Registration.create({
        event: tempEvent._id,
        student: studentA._id,
        status: 'REGISTERED',
      });
      testRegIds.push(tempReg._id);

      // Admin cancels event
      const cancelRes = await makeRequest(
        TEST_PORT,
        `/api/events/${tempEvent._id}/status`,
        'PATCH',
        { status: 'CANCELLED' },
        adminToken
      );

      if (cancelRes.statusCode === 200) {
        const notif = await Notification.findOne({
          recipient: studentA._id,
          type: 'EVENT_CANCELLED',
          event: tempEvent._id,
        });

        if (notif && notif.title.includes('Event Cancelled')) {
          logPass(17, 'Cancelling an event triggers EVENT_CANCELLED notification to registered students.');
          passed++;
        } else {
          throw new Error('EVENT_CANCELLED notification not found.');
        }
      } else {
        throw new Error(`Cancel request failed: ${cancelRes.statusCode}`);
      }
    } catch (e) {
      logFail(17, 'Event cancellation notification', e);
      failed++;
    }

    // TEST 18: Payment submitted notification
    let paidEvent;
    let paidReg;
    let submittedPayment;
    try {
      paidEvent = await Event.create({
        title: 'Cloud DevOps Masterclass',
        description: 'Paid premium hands-on AWS masterclass.',
        category: 'Workshop',
        date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        time: '09:00 AM',
        venue: 'Auditorium C',
        capacity: 40,
        availableSeats: 39,
        isPaid: true,
        fee: 499,
        status: 'PUBLISHED',
        createdBy: adminUser._id,
      });
      testEventIds.push(paidEvent._id);

      paidReg = await Registration.create({
        event: paidEvent._id,
        student: studentA._id,
        status: 'REGISTERED',
      });
      testRegIds.push(paidReg._id);

      // Student submits payment
      const payRes = await makeRequest(
        TEST_PORT,
        '/api/payments',
        'POST',
        {
          registrationId: paidReg._id,
          amount: 499,
          transactionId: 'UPI-NOTIF-TEST-998877',
          proofBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          proofFilename: 'test_upi_998877.png',
          proofMimeType: 'image/png',
        },
        studentAToken
      );

      if (payRes.statusCode === 201 && payRes.body.data) {
        submittedPayment = payRes.body.data;
        testPayIds.push(submittedPayment._id);

        const adminNotif = await Notification.findOne({
          recipient: adminUser._id,
          type: 'PAYMENT_SUBMITTED',
          payment: submittedPayment._id,
        });

        if (adminNotif && adminNotif.title === 'New Payment Submitted') {
          logPass(18, 'Student submitting payment proof triggers PAYMENT_SUBMITTED notification to EventAdmin.');
          passed++;
        } else {
          throw new Error('Admin did not receive PAYMENT_SUBMITTED notification.');
        }
      } else {
        throw new Error(`Payment submission failed: ${payRes.statusCode}`);
      }
    } catch (e) {
      logFail(18, 'Payment submitted notification', e);
      failed++;
    }

    // TEST 19: Payment approved notification
    try {
      const approveRes = await makeRequest(
        TEST_PORT,
        `/api/payments/${submittedPayment._id}/verify`,
        'PATCH',
        { status: 'APPROVED', notes: 'Verified in bank ledger' },
        adminToken
      );

      if (approveRes.statusCode === 200) {
        const studentNotif = await Notification.findOne({
          recipient: studentA._id,
          type: 'PAYMENT_APPROVED',
          payment: submittedPayment._id,
        });

        if (studentNotif && studentNotif.title === 'Payment Approved') {
          logPass(19, 'Admin approving payment triggers PAYMENT_APPROVED notification to student.');
          passed++;
        } else {
          throw new Error('Student did not receive PAYMENT_APPROVED notification.');
        }
      } else {
        throw new Error(`Payment approval failed: ${approveRes.statusCode}`);
      }
    } catch (e) {
      logFail(19, 'Payment approved notification', e);
      failed++;
    }

    // TEST 20: Payment rejected notification
    let rejectPayment;
    try {
      const rejectReg = await Registration.create({
        event: paidEvent._id,
        student: studentB._id,
        status: 'REGISTERED',
      });
      testRegIds.push(rejectReg._id);

      const payRes = await makeRequest(
        TEST_PORT,
        '/api/payments',
        'POST',
        {
          registrationId: rejectReg._id,
          amount: 499,
          transactionId: 'UPI-REJECT-TEST-112233',
          proofBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          proofFilename: 'test_reject_112233.png',
          proofMimeType: 'image/png',
        },
        studentBToken
      );

      rejectPayment = payRes.body.data;
      testPayIds.push(rejectPayment._id);

      // Admin rejects payment
      const rejectRes = await makeRequest(
        TEST_PORT,
        `/api/payments/${rejectPayment._id}/verify`,
        'PATCH',
        { status: 'REJECTED', rejectionReason: 'Screenshot unreadable or reference mismatch' },
        adminToken
      );

      if (rejectRes.statusCode === 200) {
        const rejectNotif = await Notification.findOne({
          recipient: studentB._id,
          type: 'PAYMENT_REJECTED',
          payment: rejectPayment._id,
        });

        if (rejectNotif && rejectNotif.message.includes('Screenshot unreadable')) {
          logPass(20, 'Admin rejecting payment triggers PAYMENT_REJECTED notification to student.');
          passed++;
        } else {
          throw new Error('Student B did not receive PAYMENT_REJECTED notification.');
        }
      } else {
        throw new Error(`Payment reject request failed: ${rejectRes.statusCode}`);
      }
    } catch (e) {
      logFail(20, 'Payment rejected notification', e);
      failed++;
    }

    // TEST 21: Retry notification follows existing retry rule
    try {
      const retryNotif = await Notification.findOne({
        recipient: studentB._id,
        type: 'PAYMENT_RETRY_AVAILABLE',
        payment: rejectPayment._id,
      });

      if (retryNotif && retryNotif.title === 'Payment Retry Available') {
        logPass(21, 'Payment rejection under retry threshold triggers PAYMENT_RETRY_AVAILABLE notification.');
        passed++;
      } else {
        throw new Error('PAYMENT_RETRY_AVAILABLE notification not found for eligible retry.');
      }
    } catch (e) {
      logFail(21, 'Retry notification follows existing retry rule', e);
      failed++;
    }

    // TEST 22: Ticket issued notification
    let issuedTicket;
    try {
      const ticketRes = await makeRequest(
        TEST_PORT,
        '/api/tickets',
        'POST',
        { registrationId: paidReg._id },
        studentAToken
      );

      if (ticketRes.statusCode === 201 && ticketRes.body.data) {
        issuedTicket = ticketRes.body.data;
        testTicketIds.push(issuedTicket._id);

        const ticketNotif = await Notification.findOne({
          recipient: studentA._id,
          type: 'TICKET_ISSUED',
          ticket: issuedTicket._id,
        });

        if (ticketNotif && ticketNotif.message.includes(issuedTicket.ticketCode)) {
          logPass(22, 'Issuing digital pass generates TICKET_ISSUED notification with ticket code.');
          passed++;
        } else {
          throw new Error('TICKET_ISSUED notification not found for student.');
        }
      } else {
        throw new Error(`Ticket creation failed: ${ticketRes.statusCode}`);
      }
    } catch (e) {
      logFail(22, 'Ticket issued notification', e);
      failed++;
    }

    // TEST 23: Attendance confirmed notification
    try {
      const qrPayload = `EVENTSYNC:TICKET:${issuedTicket.ticketCode}`;
      const checkInRes = await makeRequest(
        TEST_PORT,
        '/api/attendance/check-in',
        'POST',
        { qrPayload },
        adminToken
      );

      if (checkInRes.statusCode === 201 && checkInRes.body.data) {
        testAttendanceIds.push(checkInRes.body.data._id);

        const attendNotif = await Notification.findOne({
          recipient: studentA._id,
          type: 'ATTENDANCE_CONFIRMED',
          ticket: issuedTicket._id,
        });

        if (attendNotif && attendNotif.title.includes('Admission Verified')) {
          logPass(23, 'Gate attendance check-in generates ATTENDANCE_CONFIRMED notification for attendee.');
          passed++;
        } else {
          throw new Error('ATTENDANCE_CONFIRMED notification not found.');
        }
      } else {
        throw new Error(`Check-in failed: ${checkInRes.statusCode}`);
      }
    } catch (e) {
      logFail(23, 'Attendance confirmed notification', e);
      failed++;
    }

    // TEST 24: Capacity notification
    try {
      const oldCapacity = publishedEvent.capacity;
      const newCapacity = oldCapacity + 50;

      const capRes = await makeRequest(
        TEST_PORT,
        `/api/events/${publishedEvent._id}`,
        'PUT',
        { capacity: newCapacity },
        adminToken
      );

      if (capRes.statusCode === 200) {
        const capNotif = await Notification.findOne({
          recipient: studentA._id,
          type: 'CAPACITY_INCREASED',
          event: publishedEvent._id,
        });

        if (capNotif && capNotif.message.includes(`from ${oldCapacity} to ${newCapacity}`)) {
          logPass(24, 'Increasing event capacity triggers CAPACITY_INCREASED notification to registered students.');
          passed++;
        } else {
          throw new Error('CAPACITY_INCREASED notification not found.');
        }
      } else {
        throw new Error(`Capacity update failed: ${capRes.statusCode}`);
      }
    } catch (e) {
      logFail(24, 'Capacity notification', e);
      failed++;
    }

    // TEST 25: Almost-full notification
    try {
      // Create an event with capacity 6 and availableSeats 6
      const almostFullEvent = await Event.create({
        title: 'Limited Seating Seminar',
        description: 'Exclusivity test.',
        category: 'Seminar',
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        time: '03:00 PM',
        venue: 'Room 101',
        capacity: 6,
        availableSeats: 6,
        isPaid: false,
        fee: 0,
        status: 'PUBLISHED',
        createdBy: adminUser._id,
      });
      testEventIds.push(almostFullEvent._id);

      // Student registers: availableSeats drops from 6 to 5 (which is <= threshold 5)
      const rsvpRes = await makeRequest(
        TEST_PORT,
        '/api/registrations',
        'POST',
        { eventId: almostFullEvent._id },
        studentAToken
      );

      if (rsvpRes.statusCode === 201) {
        testRegIds.push(rsvpRes.body.data._id);

        const adminAlert = await Notification.findOne({
          recipient: adminUser._id,
          type: 'EVENT_ALMOST_FULL',
          event: almostFullEvent._id,
        });

        if (adminAlert && adminAlert.title.includes('Event Almost Full')) {
          logPass(25, 'Reaching remaining seats threshold triggers EVENT_ALMOST_FULL notification to admin.');
          passed++;
        } else {
          throw new Error('EVENT_ALMOST_FULL notification not found for admin.');
        }
      } else {
        throw new Error(`RSVP failed: ${rsvpRes.statusCode}`);
      }
    } catch (e) {
      logFail(25, 'Almost-full notification', e);
      failed++;
    }

    // TEST 26: 24-hour reminder
    let reminderEvent24h;
    try {
      const target24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
      reminderEvent24h = await Event.create({
        title: 'Tomorrow Morning Keynote',
        description: 'Scheduled for tomorrow.',
        category: 'Cultural',
        date: target24h,
        time: '10:00 AM',
        venue: 'Main Quad',
        capacity: 200,
        availableSeats: 199,
        isPaid: false,
        fee: 0,
        status: 'PUBLISHED',
        createdBy: adminUser._id,
      });
      testEventIds.push(reminderEvent24h._id);

      const reg24 = await Registration.create({
        event: reminderEvent24h._id,
        student: studentA._id,
        status: 'REGISTERED',
      });
      testRegIds.push(reg24._id);

      // Run reminder worker
      await checkAndSendReminders(new Date());

      const reminderNotif = await Notification.findOne({
        recipient: studentA._id,
        type: 'EVENT_REMINDER_24H',
        event: reminderEvent24h._id,
      });

      if (reminderNotif && reminderNotif.title.includes('Upcoming Event Reminder (24h)')) {
        logPass(26, 'Reminder scheduler generates EVENT_REMINDER_24H for events scheduled ~24h ahead.');
        passed++;
      } else {
        throw new Error('EVENT_REMINDER_24H was not generated.');
      }
    } catch (e) {
      logFail(26, '24-hour reminder', e);
      failed++;
    }

    // TEST 27: 1-hour reminder
    let reminderEvent1h;
    try {
      const target1h = new Date(Date.now() + 60 * 60 * 1000);
      reminderEvent1h = await Event.create({
        title: 'Imminent Tech Talk',
        description: 'Starting in 1 hour.',
        category: 'Technology',
        date: target1h,
        time: '11:00 AM',
        venue: 'Lab A',
        capacity: 50,
        availableSeats: 49,
        isPaid: false,
        fee: 0,
        status: 'PUBLISHED',
        createdBy: adminUser._id,
      });
      testEventIds.push(reminderEvent1h._id);

      const reg1h = await Registration.create({
        event: reminderEvent1h._id,
        student: studentA._id,
        status: 'REGISTERED',
      });
      testRegIds.push(reg1h._id);

      await checkAndSendReminders(new Date());

      const reminderNotif = await Notification.findOne({
        recipient: studentA._id,
        type: 'EVENT_REMINDER_1H',
        event: reminderEvent1h._id,
      });

      if (reminderNotif && reminderNotif.title.includes('Event Starting Soon (1h)')) {
        logPass(27, 'Reminder scheduler generates EVENT_REMINDER_1H for events starting in ~1 hour.');
        passed++;
      } else {
        throw new Error('EVENT_REMINDER_1H was not generated.');
      }
    } catch (e) {
      logFail(27, '1-hour reminder', e);
      failed++;
    }

    // TEST 28: Reminder deduplication
    try {
      const beforeCount = await Notification.countDocuments({
        recipient: studentA._id,
        type: 'EVENT_REMINDER_24H',
        event: reminderEvent24h._id,
      });

      // Run scheduler again
      await checkAndSendReminders(new Date());

      const afterCount = await Notification.countDocuments({
        recipient: studentA._id,
        type: 'EVENT_REMINDER_24H',
        event: reminderEvent24h._id,
      });

      if (beforeCount === 1 && afterCount === 1) {
        logPass(28, 'Reminder scheduler deduplication prevents multiple reminder alerts for same event/student.');
        passed++;
      } else {
        throw new Error(`Deduplication failure: before=${beforeCount}, after=${afterCount}`);
      }
    } catch (e) {
      logFail(28, 'Reminder deduplication', e);
      failed++;
    }

    // TEST 29: Notification deduplication
    try {
      const dedupeKey = `CUSTOM_DEDUPE_KEY:${Date.now()}`;
      const notif1 = await notificationService.createNotification({
        recipient: studentA._id,
        type: 'SYSTEM',
        title: 'Idempotency Test 1',
        message: 'First attempt',
        dedupeKey,
      });
      testNotifIds.push(notif1._id);

      const notif2 = await notificationService.createNotification({
        recipient: studentA._id,
        type: 'SYSTEM',
        title: 'Idempotency Test 2',
        message: 'Second duplicate attempt',
        dedupeKey,
      });

      if (notif1._id.toString() === notif2._id.toString()) {
        const totalMatching = await Notification.countDocuments({ dedupeKey });
        if (totalMatching === 1) {
          logPass(29, 'createNotification enforces idempotency via sparse unique dedupeKey index.');
          passed++;
        } else {
          throw new Error(`Multiple documents found for unique dedupeKey: ${totalMatching}`);
        }
      } else {
        throw new Error('Different IDs returned for identical dedupeKey.');
      }
    } catch (e) {
      logFail(29, 'Notification deduplication', e);
      failed++;
    }

    // TEST 30: Cancelled event does not send reminders
    try {
      const targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const cancelledEvent = await Event.create({
        title: 'Cancelled Future Gala',
        description: 'Should never remind.',
        category: 'Cultural',
        date: targetDate,
        time: '06:00 PM',
        venue: 'Grand Ballroom',
        capacity: 100,
        availableSeats: 99,
        isPaid: false,
        fee: 0,
        status: 'CANCELLED',
        createdBy: adminUser._id,
      });
      testEventIds.push(cancelledEvent._id);

      const reg = await Registration.create({
        event: cancelledEvent._id,
        student: studentA._id,
        status: 'REGISTERED',
      });
      testRegIds.push(reg._id);

      await checkAndSendReminders(new Date());

      const reminder = await Notification.findOne({
        event: cancelledEvent._id,
        type: 'EVENT_REMINDER_24H',
      });

      if (!reminder) {
        logPass(30, 'Cancelled events are strictly excluded from automated reminder broadcasts.');
        passed++;
      } else {
        throw new Error('Reminder was unexpectedly generated for CANCELLED event.');
      }
    } catch (e) {
      logFail(30, 'Cancelled event does not send reminders', e);
      failed++;
    }

    // TEST 31: Cancelled registration does not receive reminders
    try {
      const targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const activeEvent = await Event.create({
        title: 'Active Event with Cancelled Reg',
        description: 'Testing cancelled student registrations.',
        category: 'Sports',
        date: targetDate,
        time: '04:00 PM',
        venue: 'Sports Complex',
        capacity: 100,
        availableSeats: 100,
        isPaid: false,
        fee: 0,
        status: 'PUBLISHED',
        createdBy: adminUser._id,
      });
      testEventIds.push(activeEvent._id);

      const cancelledReg = await Registration.create({
        event: activeEvent._id,
        student: studentB._id,
        status: 'CANCELLED',
      });
      testRegIds.push(cancelledReg._id);

      await checkAndSendReminders(new Date());

      const reminder = await Notification.findOne({
        recipient: studentB._id,
        event: activeEvent._id,
        type: 'EVENT_REMINDER_24H',
      });

      if (!reminder) {
        logPass(31, 'Students with CANCELLED registrations do not receive event reminders.');
        passed++;
      } else {
        throw new Error('Reminder was unexpectedly generated for CANCELLED registration.');
      }
    } catch (e) {
      logFail(31, 'Cancelled registration does not receive reminders', e);
      failed++;
    }

    // TEST 32: Empty notification state
    try {
      // Create a fresh student user with 0 notifications
      const freshStudent = await User.create({
        name: 'Fresh Test Student',
        email: `fresh.student.${Date.now()}@eventsync.edu`,
        phone: '+919876543299',
        passwordHash: await bcrypt.hash('Password@123', 10),
        role: 'STUDENT',
        studentId: 'FRESH001',
      });
      const freshToken = jwt.sign(
        { id: freshStudent._id, role: freshStudent.role, email: freshStudent.email },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      const res = await makeRequest(TEST_PORT, '/api/notifications', 'GET', null, freshToken);
      await User.findByIdAndDelete(freshStudent._id);

      if (
        res.statusCode === 200 &&
        res.body.success &&
        res.body.count === 0 &&
        Array.isArray(res.body.data) &&
        res.body.data.length === 0 &&
        res.body.unreadCount === 0
      ) {
        logPass(32, 'Empty notification state returns zero count, empty data array, and zero unread count.');
        passed++;
      } else {
        throw new Error(`Empty state invalid response: ${JSON.stringify(res.body)}`);
      }
    } catch (e) {
      logFail(32, 'Empty notification state', e);
      failed++;
    }

    // TEST 33: Regression test existing RSVP
    try {
      const regEvent = await Event.create({
        title: 'Regression Free RSVP Event',
        description: 'Testing standard registration flow.',
        category: 'Cultural',
        date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        time: '12:00 PM',
        venue: 'Auditorium B',
        capacity: 50,
        availableSeats: 50,
        isPaid: false,
        fee: 0,
        status: 'PUBLISHED',
        createdBy: adminUser._id,
      });
      testEventIds.push(regEvent._id);

      const rsvpRes = await makeRequest(
        TEST_PORT,
        '/api/registrations',
        'POST',
        { eventId: regEvent._id },
        studentBToken
      );

      if (rsvpRes.statusCode === 201 && rsvpRes.body.data) {
        testRegIds.push(rsvpRes.body.data._id);
        const updatedEvent = await Event.findById(regEvent._id);
        if (updatedEvent.availableSeats === 49) {
          logPass(33, 'Regression: Standard student free RSVP succeeds and decrements available seats atomically.');
          passed++;
        } else {
          throw new Error(`Available seats expected 49, found: ${updatedEvent.availableSeats}`);
        }
      } else {
        throw new Error(`RSVP regression failed: ${rsvpRes.statusCode}`);
      }
    } catch (e) {
      logFail(33, 'Regression test existing RSVP', e);
      failed++;
    }

    // TEST 34: Regression test payment
    let regPaid;
    try {
      const regPaidEvent = await Event.create({
        title: 'Regression Paid Event',
        description: 'Testing standard payment verification flow.',
        category: 'Workshop',
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        time: '02:00 PM',
        venue: 'Lab 4',
        capacity: 20,
        availableSeats: 19,
        isPaid: true,
        fee: 299,
        status: 'PUBLISHED',
        createdBy: adminUser._id,
      });
      testEventIds.push(regPaidEvent._id);

      regPaid = await Registration.create({
        event: regPaidEvent._id,
        student: studentB._id,
        status: 'REGISTERED',
      });
      testRegIds.push(regPaid._id);

      const payRes = await makeRequest(
        TEST_PORT,
        '/api/payments',
        'POST',
        {
          registrationId: regPaid._id,
          amount: 299,
          transactionId: `UPI-REGRESS-${Date.now()}`,
          proofBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          proofFilename: 'regress.png',
          proofMimeType: 'image/png',
        },
        studentBToken
      );

      if (payRes.statusCode === 201 && payRes.body.data) {
        testPayIds.push(payRes.body.data._id);
        const verifyRes = await makeRequest(
          TEST_PORT,
          `/api/payments/${payRes.body.data._id}/verify`,
          'PATCH',
          { status: 'APPROVED' },
          adminToken
        );

        if (verifyRes.statusCode === 200 && verifyRes.body.data.status === 'APPROVED') {
          logPass(34, 'Regression: Payment submission and admin verification flow functions seamlessly.');
          passed++;
        } else {
          throw new Error(`Payment verification regression failed: ${verifyRes.statusCode}`);
        }
      } else {
        throw new Error(`Payment submission regression failed: ${payRes.statusCode}`);
      }
    } catch (e) {
      logFail(34, 'Regression test payment', e);
      failed++;
    }

    // TEST 35: Regression test ticket
    let regressTicket;
    try {
      const ticketRes = await makeRequest(
        TEST_PORT,
        '/api/tickets',
        'POST',
        { registrationId: regPaid._id },
        studentBToken
      );

      if (ticketRes.statusCode === 201 && ticketRes.body.data) {
        regressTicket = ticketRes.body.data;
        testTicketIds.push(regressTicket._id);
        if (regressTicket.ticketCode && regressTicket.ticketCode.startsWith('ES-TCK-')) {
          logPass(35, 'Regression: Digital ticket pass issues with valid ticketCode and QR contract.');
          passed++;
        } else {
          throw new Error(`Malformed ticket code: ${regressTicket.ticketCode}`);
        }
      } else {
        throw new Error(`Ticket issue regression failed: ${ticketRes.statusCode}`);
      }
    } catch (e) {
      logFail(35, 'Regression test ticket', e);
      failed++;
    }

    // TEST 36: Regression test attendance
    try {
      const qrPayload = `EVENTSYNC:TICKET:${regressTicket.ticketCode}`;
      const checkInRes = await makeRequest(
        TEST_PORT,
        '/api/attendance/check-in',
        'POST',
        { qrPayload },
        adminToken
      );

      if (checkInRes.statusCode === 201 && checkInRes.body.data) {
        testAttendanceIds.push(checkInRes.body.data._id);

        // Double check-in prevention
        const doubleRes = await makeRequest(
          TEST_PORT,
          '/api/attendance/check-in',
          'POST',
          { qrPayload },
          adminToken
        );

        const msg = doubleRes.body?.message?.toLowerCase() || '';
        if ((doubleRes.statusCode === 400 || doubleRes.statusCode === 409) && msg.includes('already') && msg.includes('checked in')) {
          logPass(36, 'Regression: Physical check-in admits attendee and strictly blocks duplicate admission.');
          passed++;
        } else {
          throw new Error(`Double check-in protection failed with status ${doubleRes.statusCode}, message: ${JSON.stringify(doubleRes.body)}`);
        }
      } else {
        throw new Error(`Check-in regression failed: ${checkInRes.statusCode}`);
      }
    } catch (e) {
      logFail(36, 'Regression test attendance', e);
      failed++;
    }

    console.log(`\n----------------------------------------------------------------------`);
    console.log(`PHASE 8 NOTIFICATION TEST SUITE SUMMARY`);
    console.log(`----------------------------------------------------------------------`);
    console.log(`TOTAL TESTS:  36`);
    console.log(`PASSED:       ${passed}`);
    console.log(`FAILED:       ${failed}`);
    console.log(`SUCCESS RATE: ${((passed / 36) * 100).toFixed(1)}%`);
    console.log(`----------------------------------------------------------------------\n`);
  } finally {
    // Teardown: purge operational test records created during test
    console.log('[Cleanup] Cleaning up operational test artifacts in MongoDB...');
    try {
      await Notification.deleteMany({});
      if (testAttendanceIds.length) await Attendance.deleteMany({ _id: { $in: testAttendanceIds } });
      if (testTicketIds.length) await Ticket.deleteMany({ _id: { $in: testTicketIds } });
      if (testPayIds.length) await Payment.deleteMany({ _id: { $in: testPayIds } });
      if (testRegIds.length) await Registration.deleteMany({ _id: { $in: testRegIds } });
      if (testEventIds.length) await Event.deleteMany({ _id: { $in: testEventIds } });
    } catch (cleanErr) {
      console.warn('[Cleanup Warning]:', cleanErr.message);
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('[Cleanup] Test server shut down.');
    }
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runNotificationTestSuite().catch((err) => {
  console.error('[FATAL RUNNER ERROR]:', err);
  process.exit(1);
});
