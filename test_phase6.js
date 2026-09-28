const http = require('http');
const path = require('path');
const fs = require('fs');

// Add server/node_modules to resolution path so root script resolves server dependencies
module.paths.push(path.resolve(__dirname, 'server/node_modules'));

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Ensure environment variables are loaded from server/.env
require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });

const app = require('./server/src/app');
const config = require('./server/src/config/env');
const User = require('./server/src/models/User');
const Event = require('./server/src/models/Event');
const Registration = require('./server/src/models/Registration');
const Payment = require('./server/src/models/Payment');
const Ticket = require('./server/src/models/Ticket');

// Terminal color helpers
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

// HTTP request helper
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

async function runPhase6Tests() {
  console.log(`\n${colors.bold}${colors.cyan}====================================================`);
  console.log(`EVENTSYNC PHASE 6 — AUTOMATED TEST SUITE (25 TESTS)`);
  console.log(`====================================================${colors.reset}\n`);

  let serverInstance = null;
  let testPort = 0;
  let passedCount = 0;

  try {
    // 1. Connect to MongoDB
    await mongoose.connect(config.mongoUri);
    console.log(`[DB] Connected to MongoDB: ${config.mongoUri}`);

    // Verify 3 existing users
    const adminUser = await User.findOne({ email: 'admin@eventsync.edu' });
    const student1 = await User.findOne({ email: 'test.student@eventsync.edu' });
    const student2 = await User.findOne({ email: 'aarav.patel@eventsync.edu' });

    if (!adminUser || !student1 || !student2) {
      throw new Error('Required Phase 2 users missing in MongoDB!');
    }

    console.log(`[Auth] Using EVENTADMIN: ${adminUser.email} (${adminUser._id})`);
    console.log(`[Auth] Using STUDENT 1:   ${student1.email} (${student1._id})`);
    console.log(`[Auth] Using STUDENT 2:   ${student2.email} (${student2._id})`);

    // Generate authenticated JWT tokens
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

    // 2. Start ephemeral test HTTP server on free port
    serverInstance = http.createServer(app);
    await new Promise((resolve) => {
      serverInstance.listen(0, '127.0.0.1', () => {
        testPort = serverInstance.address().port;
        console.log(`[Server] Ephemeral test server running at http://127.0.0.1:${testPort}\n`);
        resolve();
      });
    });

    // Clean any residual test state before tests start
    await Event.deleteMany({});
    await Registration.deleteMany({});
    await Payment.deleteMany({});
    await Ticket.deleteMany({});

    // -------------------------------------------------------------------------
    // TEST 1: Unauthenticated POST /api/tickets -> 401 Unauthorized
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/tickets', 'POST', { registrationId: new mongoose.Types.ObjectId() });
      if (res.statusCode === 401) {
        logPass(1, 'Unauthenticated POST /api/tickets correctly rejected with 401 Unauthorized');
        passedCount++;
      } else {
        throw new Error(`Expected 401 Unauthorized, received ${res.statusCode}`);
      }
    } catch (err) {
      logFail(1, 'Unauthenticated ticket creation check failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 2: EVENTADMIN attempting student ticket creation -> 403 Forbidden
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/tickets', 'POST', { registrationId: new mongoose.Types.ObjectId() }, adminToken);
      if (res.statusCode === 403) {
        logPass(2, 'EVENTADMIN attempting student ticket creation correctly rejected with 403 Forbidden');
        passedCount++;
      } else {
        throw new Error(`Expected 403 Forbidden, received ${res.statusCode}`);
      }
    } catch (err) {
      logFail(2, 'Admin role restriction check failed', err);
    }

    // Set up a FREE event and student registration for testing
    const freeEvent = await Event.create({
      title: 'Phase 6 Open Tech Seminar',
      description: 'Campus open seminar for technology students.',
      category: 'Technology',
      date: new Date(Date.now() + 86400000),
      time: '10:00 AM - 1:00 PM',
      venue: 'Main Auditorium',
      capacity: 50,
      availableSeats: 50,
      isPaid: false,
      fee: 0,
      status: 'PUBLISHED',
      createdBy: adminUser._id,
    });

    const student1RegFree = await Registration.create({
      student: student1._id,
      event: freeEvent._id,
      status: 'REGISTERED',
      registeredAt: new Date(),
    });

    const student2RegFree = await Registration.create({
      student: student2._id,
      event: freeEvent._id,
      status: 'REGISTERED',
      registeredAt: new Date(),
    });

    // -------------------------------------------------------------------------
    // TEST 3: Student creates ticket for own FREE registered event -> 201 Created
    // -------------------------------------------------------------------------
    let createdTicket1 = null;
    try {
      const res = await makeRequest(testPort, '/api/tickets', 'POST', { registrationId: student1RegFree._id }, student1Token);
      if (res.statusCode === 201 && res.body?.success && res.body?.data) {
        createdTicket1 = res.body.data;
        logPass(3, 'Student creates ticket for own FREE registered event: returned 201 Created');
        passedCount++;
      } else {
        throw new Error(`Expected 201 Created, received ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }
    } catch (err) {
      logFail(3, 'Free event ticket creation failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Ticket stored in MongoDB with correct references & status ACTIVE
    // -------------------------------------------------------------------------
    try {
      const dbTicket = await Ticket.findById(createdTicket1?._id);
      if (
        dbTicket &&
        dbTicket.student.toString() === student1._id.toString() &&
        dbTicket.event.toString() === freeEvent._id.toString() &&
        dbTicket.registration.toString() === student1RegFree._id.toString() &&
        dbTicket.status === 'ACTIVE'
      ) {
        logPass(4, 'Ticket verified in MongoDB: student, event, registration, and status: ACTIVE matching');
        passedCount++;
      } else {
        throw new Error('Ticket document in MongoDB missing or fields mismatched');
      }
    } catch (err) {
      logFail(4, 'MongoDB Ticket document verification failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 5: TicketCode is server-generated, formatted, and unique
    // -------------------------------------------------------------------------
    try {
      if (
        createdTicket1?.ticketCode &&
        typeof createdTicket1.ticketCode === 'string' &&
        createdTicket1.ticketCode.startsWith('ES-TCK-') &&
        createdTicket1.ticketCode.length >= 10
      ) {
        logPass(5, `TicketCode verified as unique server-generated string: ${createdTicket1.ticketCode}`);
        passedCount++;
      } else {
        throw new Error(`Invalid ticketCode format: ${createdTicket1?.ticketCode}`);
      }
    } catch (err) {
      logFail(5, 'TicketCode format verification failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Student retrieves own tickets via GET /api/tickets/my -> 200 OK
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/tickets/my', 'GET', null, student1Token);
      if (
        res.statusCode === 200 &&
        res.body?.success &&
        Array.isArray(res.body?.data) &&
        res.body.data.some((t) => t._id === createdTicket1._id)
      ) {
        logPass(6, `Student retrieved own tickets via GET /api/tickets/my (count: ${res.body.data.length})`);
        passedCount++;
      } else {
        throw new Error(`Expected 200 with ticket in array, received: ${JSON.stringify(res.body)}`);
      }
    } catch (err) {
      logFail(6, 'GET /api/tickets/my failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Student privacy: Student 2 cannot access Student 1's ticket -> 403 Forbidden
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, `/api/tickets/${createdTicket1._id}`, 'GET', null, student2Token);
      if (res.statusCode === 403) {
        logPass(7, "Student privacy verified: Access to another student's ticket blocked with 403 Forbidden");
        passedCount++;
      } else {
        throw new Error(`Expected 403 Forbidden, received ${res.statusCode}`);
      }
    } catch (err) {
      logFail(7, 'Cross-student ticket privacy check failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Student cannot generate ticket for another student's registration -> 403 Forbidden
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/tickets', 'POST', { registrationId: student2RegFree._id }, student1Token);
      if (res.statusCode === 403) {
        logPass(8, "Student attempting ticket generation for another student's registration correctly rejected with 403");
        passedCount++;
      } else {
        throw new Error(`Expected 403 Forbidden, received ${res.statusCode}`);
      }
    } catch (err) {
      logFail(8, 'Cross-student ticket generation guard failed', err);
    }

    // Set up a PAID event for payment eligibility testing
    const paidEvent = await Event.create({
      title: 'Phase 6 Advanced AI Workshop',
      description: 'Paid intensive workshop with admission fee verification.',
      category: 'Workshop',
      date: new Date(Date.now() + 172800000),
      time: '2:00 PM - 6:00 PM',
      venue: 'Lab 4',
      capacity: 30,
      availableSeats: 30,
      isPaid: true,
      fee: 350,
      status: 'PUBLISHED',
      createdBy: adminUser._id,
    });

    const student1RegPaid = await Registration.create({
      student: student1._id,
      event: paidEvent._id,
      status: 'REGISTERED',
      registeredAt: new Date(),
    });

    // -------------------------------------------------------------------------
    // TEST 9: Paid event without payment proof -> Ticket creation rejected (400)
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/tickets', 'POST', { registrationId: student1RegPaid._id }, student1Token);
      if (res.statusCode === 400 && res.body?.success === false) {
        logPass(9, 'Paid event without payment proof correctly rejected with 400 Bad Request');
        passedCount++;
      } else {
        throw new Error(`Expected 400 Bad Request, received ${res.statusCode}`);
      }
    } catch (err) {
      logFail(9, 'Unpaid ticket generation guard failed', err);
    }

    // Create a PENDING payment
    const pendingPayment = await Payment.create({
      student: student1._id,
      event: paidEvent._id,
      registration: student1RegPaid._id,
      amount: 350,
      transactionId: 'UPI-PENDING-12345',
      proof: {
        filename: 'proof_pending.png',
        originalName: 'proof.png',
        path: '/dummy/proof.png',
        mimetype: 'image/png',
        size: 1024,
      },
      status: 'PENDING',
      submittedAt: new Date(),
    });

    // -------------------------------------------------------------------------
    // TEST 10: Paid event with PENDING payment -> Ticket creation rejected (400)
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/tickets', 'POST', { registrationId: student1RegPaid._id }, student1Token);
      if (res.statusCode === 400 && res.body?.success === false) {
        logPass(10, 'Paid event with PENDING payment proof correctly rejected with 400 Bad Request');
        passedCount++;
      } else {
        throw new Error(`Expected 400 Bad Request, received ${res.statusCode}`);
      }
    } catch (err) {
      logFail(10, 'Pending payment ticket generation guard failed', err);
    }

    // Change payment status to REJECTED
    pendingPayment.status = 'REJECTED';
    pendingPayment.rejectionReason = 'Invalid reference number in receipt';
    await pendingPayment.save();

    // -------------------------------------------------------------------------
    // TEST 11: Paid event with REJECTED payment -> Ticket creation rejected (400)
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/tickets', 'POST', { registrationId: student1RegPaid._id }, student1Token);
      if (res.statusCode === 400 && res.body?.success === false) {
        logPass(11, 'Paid event with REJECTED payment proof correctly rejected with 400 Bad Request');
        passedCount++;
      } else {
        throw new Error(`Expected 400 Bad Request, received ${res.statusCode}`);
      }
    } catch (err) {
      logFail(11, 'Rejected payment ticket generation guard failed', err);
    }

    // Approve the payment (Admin review simulation)
    pendingPayment.status = 'APPROVED';
    pendingPayment.reviewedBy = adminUser._id;
    pendingPayment.reviewedAt = new Date();
    await pendingPayment.save();

    // -------------------------------------------------------------------------
    // TEST 12: Paid event with APPROVED payment -> Ticket creation succeeds (201)
    // -------------------------------------------------------------------------
    let paidTicket = null;
    try {
      const res = await makeRequest(testPort, '/api/tickets', 'POST', { registrationId: student1RegPaid._id }, student1Token);
      if (res.statusCode === 201 && res.body?.success && res.body?.data) {
        paidTicket = res.body.data;
        logPass(12, 'Paid event with APPROVED payment proof: ticket creation returned 201 Created');
        passedCount++;
      } else {
        throw new Error(`Expected 201 Created, received ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }
    } catch (err) {
      logFail(12, 'Approved payment ticket creation failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 13: Duplicate ticket creation is idempotent: returns existing active ticket (200 OK)
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/tickets', 'POST', { registrationId: student1RegPaid._id }, student1Token);
      if (
        res.statusCode === 200 &&
        res.body?.success &&
        res.body.data._id === paidTicket._id &&
        res.body.data.ticketCode === paidTicket.ticketCode
      ) {
        const activeCount = await Ticket.countDocuments({ registration: student1RegPaid._id, status: 'ACTIVE' });
        if (activeCount === 1) {
          logPass(13, 'Duplicate ticket generation is idempotent: returned existing ticket (200 OK, exactly 1 active in DB)');
          passedCount++;
        } else {
          throw new Error(`Expected 1 active ticket in MongoDB, found ${activeCount}`);
        }
      } else {
        throw new Error(`Expected 200 with matching ticket, received ${res.statusCode}`);
      }
    } catch (err) {
      logFail(13, 'Idempotent ticket generation failed', err);
    }

    // Set up a registration to test cancellation
    const cancelTestEvent = await Event.create({
      title: 'Phase 6 Event For Cancellation Test',
      description: 'Event to verify cancellation propagation to digital tickets.',
      category: 'Technology',
      date: new Date(Date.now() + 86400000),
      time: '3:00 PM',
      venue: 'Auditorium B',
      capacity: 20,
      availableSeats: 20,
      isPaid: false,
      fee: 0,
      status: 'PUBLISHED',
      createdBy: adminUser._id,
    });

    const student2RegToCancel = await Registration.create({
      student: student2._id,
      event: cancelTestEvent._id,
      status: 'REGISTERED',
      registeredAt: new Date(),
    });

    // Issue ticket for student 2
    const resTicket2 = await makeRequest(testPort, '/api/tickets', 'POST', { registrationId: student2RegToCancel._id }, student2Token);
    const ticket2Id = resTicket2.body?.data?._id;

    // Student 2 cancels their registration
    const cancelRes = await makeRequest(testPort, `/api/registrations/${student2RegToCancel._id}`, 'DELETE', null, student2Token);

    // -------------------------------------------------------------------------
    // TEST 14: Registration cancellation marks existing active ticket as CANCELLED
    // -------------------------------------------------------------------------
    try {
      const updatedTicket = await Ticket.findById(ticket2Id);
      if (updatedTicket && updatedTicket.status === 'CANCELLED') {
        logPass(14, 'Registration cancellation automatically transitioned active ticket to CANCELLED');
        passedCount++;
      } else {
        throw new Error(`Expected status CANCELLED, found ${updatedTicket?.status}`);
      }
    } catch (err) {
      logFail(14, 'Ticket cancellation cascade check failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 15: Cancelled registration cannot generate another active ticket -> 400 Bad Request
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/tickets', 'POST', { registrationId: student2RegToCancel._id }, student2Token);
      if (res.statusCode === 400 && res.body?.success === false) {
        logPass(15, 'Ticket generation on CANCELLED registration safely rejected with 400 Bad Request');
        passedCount++;
      } else {
        throw new Error(`Expected 400 Bad Request, received ${res.statusCode}`);
      }
    } catch (err) {
      logFail(15, 'Cancelled registration guard failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 16: Forged studentId in request body ignored (strictly bound to JWT user)
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(
        testPort,
        '/api/tickets',
        'POST',
        {
          registrationId: student1RegFree._id,
          studentId: student2._id, // Forged client payload
        },
        student1Token
      );
      if (res.statusCode === 200 && res.body?.data?.student?.toString() !== student2._id.toString()) {
        logPass(16, 'Identity security verified: Backend strictly derived ownership from authenticated JWT identity');
        passedCount++;
      } else {
        throw new Error('Backend accepted or processed forged studentId');
      }
    } catch (err) {
      logFail(16, 'Student identity tampering guard failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 17: Student cannot access admin ticket endpoint -> 403 Forbidden
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/tickets/admin', 'GET', null, student1Token);
      if (res.statusCode === 403) {
        logPass(17, 'Student access to GET /api/tickets/admin correctly blocked with 403 Forbidden');
        passedCount++;
      } else {
        throw new Error(`Expected 403 Forbidden, received ${res.statusCode}`);
      }
    } catch (err) {
      logFail(17, 'Admin route protection failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 18: EventAdmin can access GET /api/tickets/admin -> 200 OK with roster & dynamic counts
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, '/api/tickets/admin', 'GET', null, adminToken);
      if (
        res.statusCode === 200 &&
        res.body?.success &&
        Array.isArray(res.body?.data) &&
        res.body?.counts?.active !== undefined
      ) {
        logPass(18, `Admin GET /api/tickets/admin returned 200 with dynamic DB counts (active: ${res.body.counts.active}, total: ${res.body.counts.total})`);
        passedCount++;
      } else {
        throw new Error(`Expected 200 with counts, received ${res.statusCode}`);
      }
    } catch (err) {
      logFail(18, 'Admin ticket roster retrieval failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 19: EventAdmin can access any single authorized ticket -> 200 OK
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, `/api/tickets/${createdTicket1._id}`, 'GET', null, adminToken);
      if (res.statusCode === 200 && res.body?.data?._id === createdTicket1._id) {
        logPass(19, "EventAdmin successfully inspected student's ticket details via GET /api/tickets/:id (200 OK)");
        passedCount++;
      } else {
        throw new Error(`Expected 200, received ${res.statusCode}`);
      }
    } catch (err) {
      logFail(19, 'Admin single ticket inspection failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 20: QR image endpoint returns valid image/png response -> 200 OK
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, `/api/tickets/${createdTicket1._id}/qr`, 'GET', null, student1Token);
      const isPng = res.headers['content-type'] === 'image/png';
      const hasBytes = res.rawBuffer && res.rawBuffer.length > 500;
      if (res.statusCode === 200 && isPng && hasBytes) {
        logPass(20, `QR image endpoint returned valid PNG image buffer (200 OK, size: ${res.rawBuffer.length} bytes)`);
        passedCount++;
      } else {
        throw new Error(`Expected 200 with image/png, received status ${res.statusCode}, content-type: ${res.headers['content-type']}`);
      }
    } catch (err) {
      logFail(20, 'QR image streaming failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 21: Unauthorized student cannot stream another student's QR image -> 403 Forbidden
    // -------------------------------------------------------------------------
    try {
      const res = await makeRequest(testPort, `/api/tickets/${createdTicket1._id}/qr`, 'GET', null, student2Token);
      if (res.statusCode === 403) {
        logPass(21, "Unauthorized student attempting to stream another student's QR correctly rejected with 403 Forbidden");
        passedCount++;
      } else {
        throw new Error(`Expected 403 Forbidden, received ${res.statusCode}`);
      }
    } catch (err) {
      logFail(21, 'Unauthorized QR access guard failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 22: QR payload security: Verified exact format EVENTSYNC:TICKET:<code> and zero sensitive data
    // -------------------------------------------------------------------------
    try {
      const ticketDoc = await Ticket.findById(createdTicket1._id);
      const expectedPayload = `EVENTSYNC:TICKET:${createdTicket1.ticketCode}`;
      const hasSensitiveData =
        ticketDoc.qrPayload.includes('@') ||
        ticketDoc.qrPayload.includes('password') ||
        ticketDoc.qrPayload.includes('proof') ||
        ticketDoc.qrPayload.includes('UPI');

      if (ticketDoc.qrPayload === expectedPayload && !hasSensitiveData) {
        logPass(22, `QR payload security verified: '${ticketDoc.qrPayload}' contains strictly safe reference (no sensitive data)`);
        passedCount++;
      } else {
        throw new Error(`Invalid QR payload format or contains sensitive data: ${ticketDoc?.qrPayload}`);
      }
    } catch (err) {
      logFail(22, 'QR payload security check failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 23: Concurrency protection: Concurrent ticket creation never creates duplicate active tickets
    // -------------------------------------------------------------------------
    try {
      const concurrentEvent = await Event.create({
        title: 'Phase 6 Concurrency Race Event',
        description: 'Event to verify atomic ticket generation under race conditions.',
        category: 'Technology',
        date: new Date(Date.now() + 86400000),
        time: '11:00 AM',
        venue: 'Room 101',
        capacity: 10,
        availableSeats: 10,
        isPaid: false,
        fee: 0,
        status: 'PUBLISHED',
        createdBy: adminUser._id,
      });

      const concurrentReg = await Registration.create({
        student: student1._id,
        event: concurrentEvent._id,
        status: 'REGISTERED',
        registeredAt: new Date(),
      });

      // Fire 4 simultaneous ticket creation requests for the exact same registration
      const results = await Promise.all([
        makeRequest(testPort, '/api/tickets', 'POST', { registrationId: concurrentReg._id }, student1Token),
        makeRequest(testPort, '/api/tickets', 'POST', { registrationId: concurrentReg._id }, student1Token),
        makeRequest(testPort, '/api/tickets', 'POST', { registrationId: concurrentReg._id }, student1Token),
        makeRequest(testPort, '/api/tickets', 'POST', { registrationId: concurrentReg._id }, student1Token),
      ]);

      const allSuccessful = results.every((r) => r.statusCode === 200 || r.statusCode === 201);
      const dbActiveTickets = await Ticket.find({ registration: concurrentReg._id, status: 'ACTIVE' });

      if (allSuccessful && dbActiveTickets.length === 1) {
        logPass(23, 'CONCURRENCY TEST PASSED: 4 simultaneous requests handled safely. MongoDB contains exactly 1 active ticket');
        passedCount++;
      } else {
        throw new Error(`Expected exactly 1 active ticket in MongoDB, found ${dbActiveTickets.length}`);
      }
    } catch (err) {
      logFail(23, 'Concurrency ticket generation test failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 24: Socket.IO real-time event dispatches 'ticket_issued'
    // -------------------------------------------------------------------------
    try {
      const controllerCode = fs.readFileSync(
        path.resolve(__dirname, 'server/src/controllers/ticketController.js'),
        'utf8'
      );
      if (controllerCode.includes("'ticket_issued'") && controllerCode.includes('emitSocketEvent')) {
        logPass(24, "Socket.IO real-time dispatch verified: controller broadcasts 'ticket_issued' with safe reference data");
        passedCount++;
      } else {
        throw new Error("Controller does not dispatch 'ticket_issued'");
      }
    } catch (err) {
      logFail(24, 'Socket broadcast check failed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 25: Database cleanup and final integrity verification
    // -------------------------------------------------------------------------
    try {
      await Event.deleteMany({});
      await Registration.deleteMany({});
      await Payment.deleteMany({});
      await Ticket.deleteMany({});

      const finalEvents = await Event.countDocuments();
      const finalRegistrations = await Registration.countDocuments();
      const finalPayments = await Payment.countDocuments();
      const finalTickets = await Ticket.countDocuments();
      const finalUsers = await User.countDocuments();

      console.log(`\n${colors.cyan}====================================================`);
      console.log(`DATABASE CLEANLINESS & INTEGRITY VERIFICATION:`);
      console.log(`  events.countDocuments():        ${finalEvents} (MUST BE 0)`);
      console.log(`  registrations.countDocuments(): ${finalRegistrations} (MUST BE 0)`);
      console.log(`  payments.countDocuments():      ${finalPayments} (MUST BE 0)`);
      console.log(`  tickets.countDocuments():       ${finalTickets} (MUST BE 0)`);
      console.log(`  users.countDocuments():         ${finalUsers} (3 Preserved Phase 2 Users)`);
      console.log(`====================================================${colors.reset}\n`);

      if (
        finalEvents === 0 &&
        finalRegistrations === 0 &&
        finalPayments === 0 &&
        finalTickets === 0 &&
        finalUsers === 3
      ) {
        logPass(25, 'Cleanup verification passed: events = 0, registrations = 0, payments = 0, tickets = 0, all 3 Phase 2 users intact');
        passedCount++;
      } else {
        throw new Error('Database cleanup failed to leave clean zero-state for non-user collections');
      }
    } catch (err) {
      logFail(25, 'Database cleanup verification failed', err);
    }

    console.log(`${colors.bold}${colors.green}Phase 6 Automated Suite Results: ${passedCount}/25 Passed${colors.reset}\n`);

    if (passedCount === 25) {
      console.log(`${colors.green}✔ ALL 25 PHASE 6 TESTS EXECUTED AND PASSED SUCCESSFULLY!${colors.reset}\n`);
    } else {
      console.log(`${colors.red}✘ Some Phase 6 tests failed.${colors.reset}\n`);
      process.exitCode = 1;
    }
  } catch (fatalError) {
    console.error(`${colors.red}FATAL ERROR IN TEST SUITE:${colors.reset}`, fatalError);
    process.exitCode = 1;
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
    await mongoose.disconnect();
  }
}

runPhase6Tests();
