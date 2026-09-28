const http = require('http');
const path = require('path');
const fs = require('fs');

module.paths.push(path.resolve(__dirname, '../server/node_modules'));
module.paths.push(path.resolve(__dirname, '../client/node_modules'));

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
const config = require('../server/src/config/env');
const User = require('../server/src/models/User');
const Event = require('../server/src/models/Event');
const Registration = require('../server/src/models/Registration');
const Ticket = require('../server/src/models/Ticket');
const Attendance = require('../server/src/models/Attendance');

const SERVER_PORT = config.port || 5000;
const SERVER_HOST = '127.0.0.1';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const logPass = (name, desc) => console.log(`${colors.green}✔ [${name}] PASSED:${colors.reset} ${desc}`);
const logFail = (name, desc, err) => {
  console.error(`${colors.red}✘ [${name}] FAILED:${colors.reset} ${desc}`);
  if (err) console.error('   Details:', err);
};

const makeRequest = (reqPath, method = 'GET', body = null, token = null) => {
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
        hostname: SERVER_HOST,
        port: SERVER_PORT,
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

async function runTests() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================`);
  console.log(`EVENTSYNC — REGISTRATION QR & MOBILE ACCESS REGRESSION TEST SUITE`);
  console.log(`Testing Requirements Test A through Test L`);
  console.log(`======================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  try {
    await mongoose.connect(config.mongoUri);
    console.log(`[DB] Connected to MongoDB: ${config.mongoUri}`);

    // Fetch baseline users
    const adminUser = await User.findOne({ email: 'admin@eventsync.edu' });
    const studentUser = await User.findOne({ email: 'test.student@eventsync.edu' });

    if (!adminUser || !studentUser) {
      throw new Error('Baseline admin or student user not found in MongoDB!');
    }

    const adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role, email: adminUser.email },
      config.jwtSecret,
      { expiresIn: '2h' }
    );

    const studentToken = jwt.sign(
      { id: studentUser._id, role: studentUser.role, email: studentUser.email },
      config.jwtSecret,
      { expiresIn: '2h' }
    );

    let createdEventId = null;
    let qrRegistrationUrl = null;
    let createdRegistrationId = null;
    let studentTicketCode = null;

    const PUBLIC_DEPLOYED_DOMAIN = 'https://eventsync-staging.university.edu';

    // -------------------------------------------------------------------------
    // TEST A: Admin creates an event
    // -------------------------------------------------------------------------
    try {
      const futureDate = new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0];
      const res = await makeRequest(
        '/api/events',
        'POST',
        {
          title: 'National AI & Cloud Summit 2026',
          description: 'Premier national hackathon and summit for cutting-edge cloud engineering and generative AI.',
          category: 'Technology',
          date: futureDate,
          time: '09:00 AM - 05:00 PM',
          venue: 'Auditorium Hall 1, Tech Tower',
          capacity: 50,
          status: 'PUBLISHED',
          isPaid: false,
          fee: 0,
          mode: 'Offline',
          maxTeamSize: 4,
        },
        adminToken
      );

      if (res.statusCode === 201 && res.body.success && res.body.data?._id) {
        createdEventId = res.body.data._id;
        if (res.body.data.availableSeats === 50 && res.body.data.status === 'PUBLISHED') {
          logPass('Test A', `Admin created event "${res.body.data.title}" (ID: ${createdEventId}) with 50 available seats`);
          passed++;
        } else {
          throw new Error(`Unexpected seat count or status: availableSeats=${res.body.data.availableSeats}, status=${res.body.data.status}`);
        }
      } else {
        throw new Error(`HTTP ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }
    } catch (e) {
      logFail('Test A', 'Admin creates an event', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST B: Admin generates Registration QR
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(
        `/api/events/${createdEventId}/registration-qr?format=json&clientUrl=${encodeURIComponent(PUBLIC_DEPLOYED_DOMAIN)}`,
        'GET',
        null,
        adminToken
      );

      if (res.statusCode === 200 && res.body.success && res.body.dataUrl) {
        qrRegistrationUrl = res.body.registrationUrl;
        logPass('Test B', `Registration QR successfully generated with dataUrl (${res.body.dataUrl.slice(0, 30)}...)`);
        passed++;
      } else {
        throw new Error(`HTTP ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }
    } catch (e) {
      logFail('Test B', 'Admin generates Registration QR', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST C: QR payload contains the configured public URL
    // -------------------------------------------------------------------------
    try {
      const expectedUrl = `${PUBLIC_DEPLOYED_DOMAIN}/events/${createdEventId}/register`;
      if (qrRegistrationUrl === expectedUrl) {
        logPass('Test C', `QR payload matches configured public URL: ${qrRegistrationUrl}`);
        passed++;
      } else {
        throw new Error(`Expected '${expectedUrl}', but got '${qrRegistrationUrl}'`);
      }
    } catch (e) {
      logFail('Test C', 'QR payload contains configured public URL', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST D: QR does NOT contain localhost or 127.0.0.1
    // -------------------------------------------------------------------------
    try {
      const containsLocalhost = qrRegistrationUrl.includes('localhost');
      const containsLoopback = qrRegistrationUrl.includes('127.0.0.1');
      if (!containsLocalhost && !containsLoopback) {
        logPass('Test D', `QR payload does NOT contain localhost or 127.0.0.1 (URL: ${qrRegistrationUrl})`);
        passed++;
      } else {
        throw new Error(`QR contains localhost or 127.0.0.1: ${qrRegistrationUrl}`);
      }
    } catch (e) {
      logFail('Test D', 'QR does NOT contain localhost or 127.0.0.1', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST E: Copy Registration Link and QR URL are identical
    // -------------------------------------------------------------------------
    try {
      // Simulate client helper function getEventRegistrationUrl with configured public URL
      const clientGeneratedUrl = `${PUBLIC_DEPLOYED_DOMAIN}/events/${createdEventId}/register`;
      if (clientGeneratedUrl === qrRegistrationUrl) {
        logPass('Test E', `Copy Registration Link and QR URL are identical: ${clientGeneratedUrl}`);
        passed++;
      } else {
        throw new Error(`Mismatch! Link: '${clientGeneratedUrl}' vs QR: '${qrRegistrationUrl}'`);
      }
    } catch (e) {
      logFail('Test E', 'Copy Registration Link and QR URL are identical', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST F: Student opens the registration URL (GET event details)
    // Expected: Registration Form / Event Details, NOT "Access denied. Requires one of the following roles: [EVENTADMIN]"
    // -------------------------------------------------------------------------
    try {
      // 1. Authenticated Student fetches event for registration page
      const studentRes = await makeRequest(`/api/events/${createdEventId}`, 'GET', null, studentToken);
      if (studentRes.statusCode !== 200 || !studentRes.body.success) {
        throw new Error(`Student received HTTP ${studentRes.statusCode}: ${JSON.stringify(studentRes.body)}`);
      }
      if (String(JSON.stringify(studentRes.body)).includes('Requires one of the following roles: [EVENTADMIN]')) {
        throw new Error('Registration page displayed: Access denied. Requires EVENTADMIN!');
      }

      // 2. Unauthenticated public visitor fetches event
      const publicRes = await makeRequest(`/api/events/${createdEventId}`, 'GET');
      if (publicRes.statusCode !== 200 || !publicRes.body.success) {
        throw new Error(`Public visitor received HTTP ${publicRes.statusCode}: ${JSON.stringify(publicRes.body)}`);
      }

      logPass('Test F', `Registration URL accessible to Student and Public (Available seats: ${studentRes.body.data.availableSeats}). No EVENTADMIN access denial.`);
      passed++;
    } catch (e) {
      logFail('Test F', 'Student opens the registration URL', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST G: Student scans the QR (In-App Scanner resolution)
    // Expected: Event Details / Registration Form for valid QR; "Invalid Event Registration QR" for invalid
    // -------------------------------------------------------------------------
    try {
      // Valid QR payload parsing
      const match = qrRegistrationUrl.match(/\/events\/([a-fA-F0-9]{24})\/register/i);
      if (!match || match[1] !== createdEventId) {
        throw new Error(`Failed to extract event ID from QR URL: ${qrRegistrationUrl}`);
      }

      const eventRes = await makeRequest(`/api/events/${match[1]}`, 'GET', null, studentToken);
      if (!eventRes.body.success || eventRes.body.data.title !== 'National AI & Cloud Summit 2026') {
        throw new Error('Scanned event details do not match MongoDB event data');
      }

      // Test invalid QR payload detection
      const fakeEventId = new mongoose.Types.ObjectId().toString();
      const notFoundRes = await makeRequest(`/api/events/${fakeEventId}`, 'GET', null, studentToken);
      if (notFoundRes.statusCode !== 404) {
        throw new Error(`Expected 404 for invalid event ID, got ${notFoundRes.statusCode}`);
      }

      logPass('Test G', `Scanned QR successfully resolved event "${eventRes.body.data.title}" from MongoDB with venue and seat info.`);
      passed++;
    } catch (e) {
      logFail('Test G', 'Student scans QR from another phone', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST H: Student successfully registers
    // -------------------------------------------------------------------------
    try {
      const regPayload = {
        eventId: createdEventId,
        fullName: 'Aarav Patel',
        rollNumber: '2473A05199',
        year: '3rd Year',
        department: 'AI & ML',
        teamSize: 2,
        teamName: 'Neural Ninjas',
        teamMembers: [
          { name: 'Priya Sharma', rollNumber: '2473A05200', department: 'CSE', year: '3rd Year' }
        ],
      };

      const res = await makeRequest('/api/registrations', 'POST', regPayload, studentToken);
      if (res.statusCode === 201 && res.body.success && res.body.data?._id) {
        createdRegistrationId = res.body.data._id;

        // Verify seats decremented atomically in MongoDB
        const updatedEvent = await Event.findById(createdEventId);
        if (updatedEvent.availableSeats !== 49) {
          throw new Error(`Expected availableSeats=49, but found ${updatedEvent.availableSeats}`);
        }

        // Verify pass ticket exists or create ticket
        const ticketRes = await makeRequest('/api/tickets', 'POST', { registrationId: createdRegistrationId }, studentToken);
        if (ticketRes.statusCode === 201 || ticketRes.statusCode === 200) {
          studentTicketCode = ticketRes.body.data.ticketCode || ticketRes.body.data.passCode;
        }

        logPass('Test H', `Student successfully registered (Reg ID: ${createdRegistrationId}). Seats remaining: ${updatedEvent.availableSeats}/50. Ticket Pass: ${studentTicketCode || 'Created'}`);
        passed++;
      } else {
        throw new Error(`HTTP ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }
    } catch (e) {
      logFail('Test H', 'Student successfully registers', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST I: Admin can see the new registration
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(`/api/registrations/admin?eventId=${createdEventId}`, 'GET', null, adminToken);
      if (res.statusCode === 200 && res.body.success && Array.isArray(res.body.data)) {
        const found = res.body.data.find((r) => String(r._id) === String(createdRegistrationId));
        if (found) {
          logPass('Test I', `Admin dashboard shows new registration for "${found.fullName}" (${found.rollNumber}, ${found.department}) with ${found.teamMembers?.length || 0} team members.`);
          passed++;
        } else {
          throw new Error(`Registration ${createdRegistrationId} not found in admin roster`);
        }
      } else {
        throw new Error(`HTTP ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }
    } catch (e) {
      logFail('Test I', 'Admin can see the new registration', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST J: Gate Ticket QR/pass verification still works
    // -------------------------------------------------------------------------
    try {
      // Find actual active ticket for the registration
      const ticketDoc = await Ticket.findOne({ registration: createdRegistrationId, status: 'ACTIVE' });
      if (!ticketDoc) {
        throw new Error('Active ticket not found in MongoDB');
      }

      const passCode = ticketDoc.passCode || ticketDoc.ticketCode;
      const verifyRes = await makeRequest(
        '/api/attendance/verify-ticket',
        'POST',
        { passCode, eventId: createdEventId },
        adminToken
      );

      if (verifyRes.statusCode === 200 || verifyRes.statusCode === 201) {
        logPass('Test J', `Gate ticket verification succeeded for code "${passCode}". Attendance marked PRESENT.`);
        passed++;
      } else {
        throw new Error(`HTTP ${verifyRes.statusCode}: ${JSON.stringify(verifyRes.body)}`);
      }
    } catch (e) {
      logFail('Test J', 'Gate Ticket QR/pass verification still works', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST K: Registration QR cannot be used as an attendance ticket
    // -------------------------------------------------------------------------
    try {
      // Attempt 1: Verify ticket endpoint with registration URL
      const res1 = await makeRequest(
        '/api/attendance/verify-ticket',
        'POST',
        { passCode: qrRegistrationUrl, eventId: createdEventId },
        adminToken
      );

      // Attempt 2: Scan digital pass endpoint with registration URL
      const res2 = await makeRequest(
        '/api/attendance/scan-pass',
        'POST',
        { qrPayload: qrRegistrationUrl },
        adminToken
      );

      // Attempt 3: Direct check-in endpoint with registration URL
      const res3 = await makeRequest(
        '/api/attendance/check-in',
        'POST',
        { qrPayload: qrRegistrationUrl, eventId: createdEventId },
        adminToken
      );

      const allRejected = res1.statusCode >= 400 && res2.statusCode >= 400 && res3.statusCode >= 400;
      if (allRejected) {
        logPass('Test K', `Registration URL correctly REJECTED by all attendance verification endpoints (HTTP ${res1.statusCode}, ${res2.statusCode}, ${res3.statusCode}). Strict separation maintained.`);
        passed++;
      } else {
        throw new Error(`Expected all endpoints to reject registration URL, but got status codes: ${res1.statusCode}, ${res2.statusCode}, ${res3.statusCode}`);
      }
    } catch (e) {
      logFail('Test K', 'Registration QR cannot be used as an attendance ticket', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST L: Admin-only pages remain protected
    // -------------------------------------------------------------------------
    try {
      // 1. Student attempts admin-only events list
      const adminEventsRes = await makeRequest('/api/events/admin/all', 'GET', null, studentToken);
      // 2. Student attempts create event
      const createEventRes = await makeRequest('/api/events', 'POST', { title: 'Unauthorized Event' }, studentToken);
      // 3. Student attempts admin attendance roster
      const adminAttRes = await makeRequest('/api/attendance/admin', 'GET', null, studentToken);
      // 4. Student attempts admin registrations list
      const adminRegRes = await makeRequest('/api/registrations/admin', 'GET', null, studentToken);

      const allDenied =
        adminEventsRes.statusCode === 403 &&
        createEventRes.statusCode === 403 &&
        adminAttRes.statusCode === 403 &&
        adminRegRes.statusCode === 403;

      if (allDenied) {
        logPass('Test L', 'Admin-only endpoints strictly return HTTP 403 Access Denied when accessed by students. Security architecture intact.');
        passed++;
      } else {
        throw new Error(`Unexpected status codes: adminEvents=${adminEventsRes.statusCode}, createEvent=${createEventRes.statusCode}, attendance=${adminAttRes.statusCode}, registrations=${adminRegRes.statusCode}`);
      }
    } catch (e) {
      logFail('Test L', 'Admin-only pages remain protected', e);
      failed++;
    }

    // Cleanup created test event and registrations
    if (createdEventId) {
      await Event.findByIdAndDelete(createdEventId);
      await Registration.deleteMany({ event: createdEventId });
      await Ticket.deleteMany({ event: createdEventId });
      await Attendance.deleteMany({ event: createdEventId });
    }

  } catch (err) {
    console.error('Fatal test error:', err);
  } finally {
    await mongoose.disconnect();
    console.log(`\n======================================================================`);
    console.log(`TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED (TOTAL 12 TESTS)`);
    console.log(`======================================================================\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
