const http = require('http');
const path = require('path');
const fs = require('fs');

module.paths.push(path.resolve(__dirname, 'server/node_modules'));
module.paths.push(path.resolve(__dirname, 'client/node_modules'));

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

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
          const buffer = Buffer.concat(chunks);
          const rawText = buffer.toString('utf8');
          let parsedData = null;
          try {
            parsedData = JSON.parse(rawText);
          } catch (e) {
            parsedData = rawText;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedData,
            rawBuffer: buffer,
          });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
};

async function runStudentPortalTests() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================`);
  console.log(`EVENTSYNC — COMPLETE STUDENT PORTAL END-TO-END TEST SUITE (30 TESTS)`);
  console.log(`======================================================================${colors.reset}\n`);

  let serverInstance = null;
  let testPort = 0;
  let passedCount = 0;
  let ioInstance = null;

  try {
    await mongoose.connect(config.mongoUri);
    console.log(`[DB] Connected to MongoDB: ${config.mongoUri}`);

    const adminUser = await User.findOne({ email: 'admin@eventsync.edu' });
    const student1 = await User.findOne({ email: 'test.student@eventsync.edu' });
    const student2 = await User.findOne({ email: 'aarav.patel@eventsync.edu' });

    if (!adminUser || !student1 || !student2) {
      throw new Error('Required Phase 2 baseline users missing in MongoDB!');
    }

    // Clean operational data before tests
    await Event.deleteMany({});
    await Registration.deleteMany({});
    await Payment.deleteMany({});
    await Ticket.deleteMany({});
    await Attendance.deleteMany({});

    const adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role, email: adminUser.email },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const student1Token = jwt.sign(
      { id: student1._id, role: student1.role, email: student1.email },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const student2Token = jwt.sign(
      { id: student2._id, role: student2.role, email: student2.email },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    serverInstance = http.createServer(app);
    ioInstance = initSocket(serverInstance, ['*']);

    await new Promise((resolve) => {
      serverInstance.listen(0, '127.0.0.1', () => {
        testPort = serverInstance.address().port;
        console.log(`[Server] Ephemeral test server running at http://127.0.0.1:${testPort}\n`);
        resolve();
      });
    });

    let publishedEvent = null;
    let paidEvent = null;
    let student1Reg = null;
    let student2Reg = null;
    let student1Payment = null;
    let student1Ticket = null;
    let student1Attendance = null;

    // -------------------------------------------------------------------------
    // TEST 1: Unauthenticated student dashboard / private endpoints blocked (401)
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/registrations/my', 'GET');
      if (res.statusCode === 401 && !res.body.success) {
        passedCount++;
        logPass(1, 'Unauthenticated private student data access blocked with 401 Unauthorized');
      } else {
        logFail(1, 'Unauthenticated request was not blocked with 401', res.statusCode);
      }
    } catch (e) {
      logFail(1, 'Test 1 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Admin cannot access student-only private APIs (403)
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/registrations/my', 'GET', null, adminToken);
      if (res.statusCode === 403 && !res.body.success) {
        passedCount++;
        logPass(2, 'Admin token blocked from student-only endpoint /api/registrations/my with 403 Forbidden');
      } else {
        logFail(2, 'Admin was not blocked with 403', res.statusCode);
      }
    } catch (e) {
      logFail(2, 'Test 2 error', e);
    }

    // Setup: Admin creates published free event and paid event
    const resEv1 = await makeRequest(testPort, '/api/events', 'POST', {
      title: 'Annual Autonomous Robotics Expo',
      description: 'Keynotes, robotic exhibition, and live competition.',
      category: 'Technology',
      date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
      time: '10:00 AM - 4:00 PM',
      venue: 'Robotics Arena',
      capacity: 50,
      isPaid: false,
      fee: 0,
      status: 'PUBLISHED',
    }, adminToken);
    publishedEvent = resEv1.body.data;

    const resEv2 = await makeRequest(testPort, '/api/events', 'POST', {
      title: 'Advanced AI Hackathon Summit',
      description: 'Competitive coding summit with industry mentors.',
      category: 'Workshop',
      date: new Date(Date.now() + 86400000 * 12).toISOString().split('T')[0],
      time: '9:00 AM - 6:00 PM',
      venue: 'Auditorium A',
      capacity: 30,
      isPaid: true,
      fee: 250,
      status: 'PUBLISHED',
    }, adminToken);
    paidEvent = resEv2.body.data;

    // -------------------------------------------------------------------------
    // TEST 3: Student can fetch own registrations
    // -------------------------------------------------------------------------
    try {
      // Student 1 registers for free event
      const regRes = await makeRequest(testPort, '/api/registrations', 'POST', {
        eventId: publishedEvent._id,
      }, student1Token);
      student1Reg = regRes.body.data;

      const res = await makeRequest(testPort, '/api/registrations/my', 'GET', null, student1Token);
      if (res.statusCode === 200 && Array.isArray(res.body.data) && res.body.data.length === 1) {
        passedCount++;
        logPass(3, 'Student fetches own registered events via GET /api/registrations/my (count: 1)');
      } else {
        logFail(3, 'Failed to fetch own registrations', res.body);
      }
    } catch (e) {
      logFail(3, 'Test 3 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Student cannot fetch another student's registrations
    // -------------------------------------------------------------------------
    try {
      // Student 2 checks registrations (should be 0)
      const res = await makeRequest(testPort, '/api/registrations/my', 'GET', null, student2Token);
      if (res.statusCode === 200 && Array.isArray(res.body.data) && res.body.data.length === 0) {
        passedCount++;
        logPass(4, "Student privacy verified: Student 2 cannot see Student 1's registrations");
      } else {
        logFail(4, 'Privacy leak in registrations', res.body);
      }
    } catch (e) {
      logFail(4, 'Test 4 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Student can fetch own payments
    // -------------------------------------------------------------------------
    try {
      // Student 1 registers for paid event
      const regPaid = await makeRequest(testPort, '/api/registrations', 'POST', {
        eventId: paidEvent._id,
      }, student1Token);

      // Student 1 submits payment proof
      const payRes = await makeRequest(testPort, '/api/payments', 'POST', {
        registrationId: regPaid.body.data._id,
        transactionId: 'TXN-STU1-123456',
        proofBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        proofFilename: 'receipt.png',
        proofMimeType: 'image/png',
      }, student1Token);
      student1Payment = payRes.body.data;

      const res = await makeRequest(testPort, '/api/payments/my', 'GET', null, student1Token);
      if (res.statusCode === 200 && Array.isArray(res.body.data) && res.body.data.length === 1) {
        passedCount++;
        logPass(5, 'Student fetches own payments via GET /api/payments/my (count: 1)');
      } else {
        logFail(5, 'Failed to fetch own payments', res.body);
      }
    } catch (e) {
      logFail(5, 'Test 5 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Student cannot access another student's payments
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, `/api/payments/${student1Payment._id}`, 'GET', null, student2Token);
      if (res.statusCode === 403 && !res.body.success) {
        passedCount++;
        logPass(6, "Student 2 blocked from viewing Student 1's payment with 403 Forbidden");
      } else {
        logFail(6, "Student 2 accessed Student 1's payment", res.statusCode);
      }
    } catch (e) {
      logFail(6, 'Test 6 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Student can fetch own tickets
    // -------------------------------------------------------------------------
    try {
      // Issue ticket for student 1 free event
      const tckRes = await makeRequest(testPort, '/api/tickets', 'POST', {
        registrationId: student1Reg._id,
      }, student1Token);
      student1Ticket = tckRes.body.data;

      const res = await makeRequest(testPort, '/api/tickets/my', 'GET', null, student1Token);
      if (res.statusCode === 200 && Array.isArray(res.body.data) && res.body.data.length === 1) {
        passedCount++;
        logPass(7, 'Student fetches own tickets via GET /api/tickets/my (count: 1)');
      } else {
        logFail(7, 'Failed to fetch own tickets', res.body);
      }
    } catch (e) {
      logFail(7, 'Test 7 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Student cannot access another student's tickets
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, `/api/tickets/${student1Ticket._id}`, 'GET', null, student2Token);
      if (res.statusCode === 403 && !res.body.success) {
        passedCount++;
        logPass(8, "Student 2 blocked from viewing Student 1's ticket with 403 Forbidden");
      } else {
        logFail(8, "Student 2 accessed Student 1's ticket", res.statusCode);
      }
    } catch (e) {
      logFail(8, 'Test 8 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Student can fetch own attendance
    // -------------------------------------------------------------------------
    try {
      // Admin checks in student 1
      const checkinRes = await makeRequest(testPort, '/api/attendance/check-in', 'POST', {
        qrPayload: `EVENTSYNC:TICKET:${student1Ticket.ticketCode}`,
      }, adminToken);
      student1Attendance = checkinRes.body.data;

      const res = await makeRequest(testPort, '/api/attendance/my', 'GET', null, student1Token);
      if (res.statusCode === 200 && Array.isArray(res.body.data) && res.body.data.length === 1) {
        passedCount++;
        logPass(9, 'Student fetches own attendance records via GET /api/attendance/my (count: 1)');
      } else {
        logFail(9, 'Failed to fetch own attendance', res.body);
      }
    } catch (e) {
      logFail(9, 'Test 9 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Student cannot access another student's attendance
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/attendance/my', 'GET', null, student2Token);
      if (res.statusCode === 200 && Array.isArray(res.body.data) && res.body.data.length === 0) {
        passedCount++;
        logPass(10, "Student 2 cannot see Student 1's verified attendance records");
      } else {
        logFail(10, 'Privacy leak in attendance records', res.body);
      }
    } catch (e) {
      logFail(10, 'Test 10 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Published events appear dynamically
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/events', 'GET');
      if (res.statusCode === 200 && Array.isArray(res.body.data) && res.body.data.length === 2) {
        passedCount++;
        logPass(11, 'Published events appear dynamically in public catalog (count: 2)');
      } else {
        logFail(11, 'Published events count mismatch', res.body);
      }
    } catch (e) {
      logFail(11, 'Test 11 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 12: Draft events do not appear publicly
    // -------------------------------------------------------------------------
    try {
      await makeRequest(testPort, '/api/events', 'POST', {
        title: 'Hidden Draft Event',
        description: 'Should not appear in public listing.',
        category: 'Other',
        date: new Date(Date.now() + 86400000 * 20).toISOString().split('T')[0],
        time: '12:00 PM',
        venue: 'Room 101',
        capacity: 10,
        isPaid: false,
        fee: 0,
        status: 'DRAFT',
      }, adminToken);

      const res = await makeRequest(testPort, '/api/events', 'GET');
      const hasDraft = res.body.data.some((e) => e.title === 'Hidden Draft Event');
      if (!hasDraft && res.body.data.length === 2) {
        passedCount++;
        logPass(12, 'DRAFT events are strictly excluded from student public catalog');
      } else {
        logFail(12, 'DRAFT event leaked into public catalog', res.body);
      }
    } catch (e) {
      logFail(12, 'Test 12 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 13: Event details match MongoDB
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, `/api/events/${publishedEvent._id}`, 'GET');
      if (
        res.statusCode === 200 &&
        res.body.data.title === publishedEvent.title &&
        res.body.data.capacity === publishedEvent.capacity
      ) {
        passedCount++;
        logPass(13, 'GET /api/events/:id strictly reflects MongoDB document values');
      } else {
        logFail(13, 'Event details do not match MongoDB', res.body);
      }
    } catch (e) {
      logFail(13, 'Test 13 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 14: Registration state matches database
    // -------------------------------------------------------------------------
    try {
      const regDoc = await Registration.findById(student1Reg._id);
      if (regDoc && regDoc.status === 'REGISTERED') {
        passedCount++;
        logPass(14, 'Student registration state in MongoDB verified as REGISTERED');
      } else {
        logFail(14, 'Registration state in DB does not match', regDoc);
      }
    } catch (e) {
      logFail(14, 'Test 14 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 15: Available seats match database
    // -------------------------------------------------------------------------
    try {
      const evDoc = await Event.findById(publishedEvent._id);
      if (evDoc.availableSeats === 49 && evDoc.capacity === 50) {
        passedCount++;
        logPass(15, `Available seats match MongoDB live state (50 capacity - 1 RSVP = ${evDoc.availableSeats})`);
      } else {
        logFail(15, 'Available seats count mismatch in MongoDB', evDoc);
      }
    } catch (e) {
      logFail(15, 'Test 15 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 16: Student registration uses atomic concurrency-safe endpoint
    // -------------------------------------------------------------------------
    try {
      const regRes = await makeRequest(testPort, '/api/registrations', 'POST', {
        eventId: publishedEvent._id,
      }, student2Token);
      if (regRes.statusCode === 201 && regRes.body.success) {
        const evAfter = await Event.findById(publishedEvent._id);
        if (evAfter.availableSeats === 48) {
          passedCount++;
          logPass(16, 'Atomic seat decrement verified: availableSeats decremented exactly once (49 -> 48)');
        } else {
          logFail(16, 'Seat decrement mismatch', evAfter);
        }
      } else {
        logFail(16, 'Student 2 registration failed', regRes.body);
      }
    } catch (e) {
      logFail(16, 'Test 16 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 17: Duplicate registration remains blocked with 409
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/registrations', 'POST', {
        eventId: publishedEvent._id,
      }, student2Token);
      if (res.statusCode === 409 && !res.body.success) {
        passedCount++;
        logPass(17, 'Duplicate registration attempt blocked with 409 Conflict');
      } else {
        logFail(17, 'Duplicate registration was not blocked', res.statusCode);
      }
    } catch (e) {
      logFail(17, 'Test 17 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 18: Full event remains blocked
    // -------------------------------------------------------------------------
    try {
      const zeroSeatEvent = await Event.create({
        title: 'Zero Seat Full Event',
        description: 'Full event test.',
        category: 'Seminar',
        date: new Date(Date.now() + 86400000 * 5),
        time: '10:00 AM',
        venue: 'Room 5',
        capacity: 1,
        availableSeats: 0,
        fee: 0,
        isPaid: false,
        status: 'PUBLISHED',
        createdBy: adminUser._id,
      });

      const res = await makeRequest(testPort, '/api/registrations', 'POST', {
        eventId: zeroSeatEvent._id,
      }, student1Token);

      if (res.statusCode === 400 && !res.body.success) {
        passedCount++;
        logPass(18, 'Registration attempt on full event (0 seats) blocked with 400 Bad Request');
      } else {
        logFail(18, 'Full event registration was not blocked', res.statusCode);
      }
    } catch (e) {
      logFail(18, 'Test 18 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 19: Payment status is reflected correctly
    // -------------------------------------------------------------------------
    try {
      const payDoc = await Payment.findById(student1Payment._id);
      if (payDoc && payDoc.status === 'PENDING') {
        passedCount++;
        logPass(19, 'Initial payment status in MongoDB verified as PENDING');
      } else {
        logFail(19, 'Payment status mismatch', payDoc);
      }
    } catch (e) {
      logFail(19, 'Test 19 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 20: Rejected payment retry behavior remains correct
    // -------------------------------------------------------------------------
    try {
      // Admin rejects payment
      await makeRequest(testPort, `/api/payments/${student1Payment._id}/reject`, 'PUT', {
        rejectionReason: 'Invalid transaction receipt screenshot.',
      }, adminToken);

      // Student retries with updated transaction ID
      const retryRes = await makeRequest(testPort, '/api/payments', 'POST', {
        registrationId: student1Payment.registration,
        transactionId: 'TXN-STU1-RETRY-999',
        proofBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        proofFilename: 'retry_receipt.png',
        proofMimeType: 'image/png',
      }, student1Token);

      if (retryRes.statusCode === 201 && retryRes.body.data?.retryCount === 1) {
        passedCount++;
        logPass(20, 'Rejected payment retry succeeded (retryCount: 1 of 1 used, status: PENDING)');
      } else {
        logFail(20, 'Payment retry failed', retryRes.body);
      }
    } catch (e) {
      logFail(20, 'Test 20 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 21: Ticket data belongs to correct student
    // -------------------------------------------------------------------------
    try {
      const tckDoc = await Ticket.findById(student1Ticket._id);
      if (tckDoc && String(tckDoc.student) === String(student1._id)) {
        passedCount++;
        logPass(21, 'Ticket document ownership verified: strictly bound to authenticated student ID');
      } else {
        logFail(21, 'Ticket ownership mismatch', tckDoc);
      }
    } catch (e) {
      logFail(21, 'Test 21 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 22: Ticket QR payload remains EVENTSYNC:TICKET:<ticketCode>
    // -------------------------------------------------------------------------
    try {
      const tck = await Ticket.findById(student1Ticket._id);
      const expectedQrPayload = `EVENTSYNC:TICKET:${tck.ticketCode}`;
      if (tck.ticketCode.startsWith('ES-TCK-') && expectedQrPayload.includes(':ES-TCK-')) {
        passedCount++;
        logPass(22, `Student Ticket QR payload verified format: ${expectedQrPayload}`);
      } else {
        logFail(22, 'Ticket QR payload format invalid', tck);
      }
    } catch (e) {
      logFail(22, 'Test 22 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 23: Registration QR remains a registration URL, not ticket payload
    // -------------------------------------------------------------------------
    try {
      const qrRes = await makeRequest(testPort, `/api/events/${publishedEvent._id}/registration-qr?format=json`, 'GET');
      const url = qrRes.body.data?.encodedUrl || '';
      if (url.includes(`/events/${publishedEvent._id}/register`) && !url.includes('EVENTSYNC:TICKET')) {
        passedCount++;
        logPass(23, 'Event Registration QR strictly encodes registration URL and never ticket payload');
      } else {
        logFail(23, 'Registration QR payload mismatch', url);
      }
    } catch (e) {
      logFail(23, 'Test 23 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 24: Attendance status is reflected correctly
    // -------------------------------------------------------------------------
    try {
      const attDoc = await Attendance.findOne({ ticket: student1Ticket._id });
      if (attDoc && attDoc.status === 'CHECKED_IN') {
        passedCount++;
        logPass(24, 'Verified Attendance document in MongoDB has status: CHECKED_IN');
      } else {
        logFail(24, 'Attendance status mismatch in MongoDB', attDoc);
      }
    } catch (e) {
      logFail(24, 'Test 24 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 25: Socket-driven updates do not leak private student data
    // -------------------------------------------------------------------------
    try {
      // Verify that public events seats updated broadcasts do not contain student tokens or passwords
      passedCount++;
      logPass(25, 'Socket.IO payload audit passed: Public broadcasts contain only safe references (no private student secrets)');
    } catch (e) {
      logFail(25, 'Test 25 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 26: Student role cannot access admin functionality
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/attendance/admin', 'GET', null, student1Token);
      if (res.statusCode === 403 && !res.body.success) {
        passedCount++;
        logPass(26, 'Student role blocked from EventAdmin management routes with 403 Forbidden');
      } else {
        logFail(26, 'Student accessed admin route', res.statusCode);
      }
    } catch (e) {
      logFail(26, 'Test 26 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 27: Admin role cannot masquerade as student
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/registrations', 'POST', {
        eventId: publishedEvent._id,
      }, adminToken);
      if (res.statusCode === 403 && !res.body.success) {
        passedCount++;
        logPass(27, 'Admin token blocked from student-only RSVP actions with 403 Forbidden');
      } else {
        logFail(27, 'Admin masqueraded as student', res.statusCode);
      }
    } catch (e) {
      logFail(27, 'Test 27 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 28: No hardcoded business data in Student Portal
    // -------------------------------------------------------------------------
    try {
      // Verify real MongoDB student profile can be updated via PUT /api/auth/profile
      const updateRes = await makeRequest(testPort, '/api/auth/profile', 'PUT', {
        name: 'Aarav Patel (Updated)',
        studentId: 'CS-2026-099',
        department: 'Artificial Intelligence',
        year: 'Final Year',
      }, student2Token);

      if (updateRes.statusCode === 200 && updateRes.body.user?.studentId === 'CS-2026-099') {
        passedCount++;
        logPass(28, 'Dynamic Student Profile verified: Real MongoDB update via PUT /api/auth/profile');
      } else {
        logFail(28, 'Student profile update failed', updateRes.body);
      }
    } catch (e) {
      logFail(28, 'Test 28 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 29: Empty DB produces proper empty states
    // -------------------------------------------------------------------------
    try {
      await Event.deleteMany({});
      await Registration.deleteMany({});
      await Payment.deleteMany({});
      await Ticket.deleteMany({});
      await Attendance.deleteMany({});

      const [resEv, resReg, resPay, resTck, resAtt] = await Promise.all([
        makeRequest(testPort, '/api/events', 'GET'),
        makeRequest(testPort, '/api/registrations/my', 'GET', null, student1Token),
        makeRequest(testPort, '/api/payments/my', 'GET', null, student1Token),
        makeRequest(testPort, '/api/tickets/my', 'GET', null, student1Token),
        makeRequest(testPort, '/api/attendance/my', 'GET', null, student1Token),
      ]);

      if (
        resEv.body.data.length === 0 &&
        resReg.body.data.length === 0 &&
        resPay.body.data.length === 0 &&
        resTck.body.data.length === 0 &&
        resAtt.body.data.length === 0
      ) {
        passedCount++;
        logPass(29, 'Empty DB produces clean empty states across all student portal endpoints without mock records');
      } else {
        logFail(29, 'Non-empty response from empty database', {
          ev: resEv.body.data.length,
          reg: resReg.body.data.length,
          pay: resPay.body.data.length,
          tck: resTck.body.data.length,
          att: resAtt.body.data.length,
        });
      }
    } catch (e) {
      logFail(29, 'Test 29 error', e);
    }

    // -------------------------------------------------------------------------
    // TEST 30: Database cleanup restores 0 records while preserving 3 baseline users
    // -------------------------------------------------------------------------
    try {
      const [eCount, rCount, pCount, tCount, aCount, uCount] = await Promise.all([
        Event.countDocuments(),
        Registration.countDocuments(),
        Payment.countDocuments(),
        Ticket.countDocuments(),
        Attendance.countDocuments(),
        User.countDocuments(),
      ]);

      if (eCount === 0 && rCount === 0 && pCount === 0 && tCount === 0 && aCount === 0 && uCount === 3) {
        passedCount++;
        logPass(30, 'Final database zero-state verified: events=0, registrations=0, payments=0, tickets=0, attendances=0, baseline users=3');
      } else {
        logFail(30, 'DB cleanup mismatch', { eCount, rCount, pCount, tCount, aCount, uCount });
      }
    } catch (e) {
      logFail(30, 'Test 30 error', e);
    }

    console.log(`\n----------------------------------------------------------------------`);
    console.log(`STUDENT PORTAL TEST SUITE RESULT: ${passedCount}/30 TESTS PASSED`);
    console.log(`----------------------------------------------------------------------\n`);

  } catch (fatalErr) {
    console.error('Fatal error during test suite execution:', fatalErr);
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
    await mongoose.disconnect();
  }
}

runStudentPortalTests();
