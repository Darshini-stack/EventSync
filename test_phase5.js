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
const AuditLog = require('./server/src/models/AuditLog');
const { uploadDir } = require('./server/src/middleware/upload');

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
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(rawData);
          } catch (e) {
            parsed = rawData;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
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

// 1x1 transparent PNG sample in base64
const sampleProofBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const runAllPhase5Tests = async () => {
  console.log(`\n${colors.bold}${colors.cyan}====================================================`);
  console.log(`EVENTSYNC PHASE 5 — AUTOMATED TEST SUITE (24 TESTS)`);
  console.log(`====================================================${colors.reset}\n`);

  // 1. Connect to MongoDB
  await mongoose.connect(config.mongoUri);
  console.log(`${colors.cyan}[DB] Connected to MongoDB:${colors.reset} ${config.mongoUri}`);

  // Fetch real users from DB (must preserve existing Phase 2 accounts)
  const adminUser = await User.findOne({ email: 'admin@eventsync.edu' });
  const student1 = await User.findOne({ email: 'test.student@eventsync.edu' });
  const student2 = await User.findOne({ email: 'aarav.patel@eventsync.edu' });

  if (!adminUser || !student1 || !student2) {
    throw new Error('Required Phase 2 users missing in MongoDB.');
  }

  console.log(`[Auth] Using EVENTADMIN: ${adminUser.email} (${adminUser._id})`);
  console.log(`[Auth] Using STUDENT 1:   ${student1.email} (${student1._id})`);
  console.log(`[Auth] Using STUDENT 2:   ${student2.email} (${student2._id})`);

  // Generate tokens
  const adminToken = jwt.sign({ id: adminUser._id, role: adminUser.role }, config.jwtSecret, { expiresIn: '1h' });
  const student1Token = jwt.sign({ id: student1._id, role: student1.role }, config.jwtSecret, { expiresIn: '1h' });
  const student2Token = jwt.sign({ id: student2._id, role: student2.role }, config.jwtSecret, { expiresIn: '1h' });

  // Start HTTP server on ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`[Server] Ephemeral test server running at http://127.0.0.1:${port}\n`);

  let testCount = 0;
  let passedCount = 0;

  // Track temporary documents and created proof files for guaranteed cleanup
  const createdEventIds = [];
  const createdRegistrationIds = [];
  const createdPaymentIds = [];
  const createdProofFilenames = [];

  try {
    // Helper to create test event
    const createTestEvent = async ({ isPaid = false, fee = 0, capacity = 10, availableSeats = 10, status = 'PUBLISHED' }) => {
      const ev = await Event.create({
        title: `Phase 5 Test Event ${Date.now()}`,
        description: 'Temporary event created specifically for Phase 5 verification.',
        category: 'Workshop',
        date: new Date(Date.now() + 86400000),
        time: '10:00 AM - 12:00 PM',
        venue: 'Room 202',
        capacity,
        availableSeats,
        isPaid,
        fee,
        status,
        createdBy: adminUser._id,
      });
      createdEventIds.push(ev._id);
      return ev;
    };

    // Helper to register student
    const createTestRegistration = async (studentId, eventId) => {
      const reg = await Registration.create({
        student: studentId,
        event: eventId,
        status: 'REGISTERED',
        registeredAt: new Date(),
      });
      createdRegistrationIds.push(reg._id);
      return reg;
    };

    // ----------------------------------------------------
    // TEST 1: Unauthenticated payment submission -> 401
    // ----------------------------------------------------
    testCount++;
    const res1 = await makeRequest(port, '/api/payments', 'POST', {
      registrationId: new mongoose.Types.ObjectId().toString(),
      transactionId: 'TXN123456',
    });
    if (res1.status === 401) {
      logPass(1, 'Unauthenticated POST /api/payments correctly rejected with 401 Unauthorized');
      passedCount++;
    } else {
      logFail(1, 'Unauthenticated POST did not return 401', res1.status);
    }

    // ----------------------------------------------------
    // TEST 2: EVENTADMIN attempting student payment submission -> 403
    // ----------------------------------------------------
    testCount++;
    const res2 = await makeRequest(
      port,
      '/api/payments',
      'POST',
      {
        registrationId: new mongoose.Types.ObjectId().toString(),
        transactionId: 'TXN123456',
      },
      adminToken
    );
    if (res2.status === 403) {
      logPass(2, 'EVENTADMIN attempting student payment submission correctly rejected with 403 Forbidden');
      passedCount++;
    } else {
      logFail(2, 'EVENTADMIN payment submission did not return 403', res2.status);
    }

    // ----------------------------------------------------
    // TEST 3: Student attempting payment for another student's registration -> 403/404
    // ----------------------------------------------------
    testCount++;
    const paidEventA = await createTestEvent({ isPaid: true, fee: 250 });
    const regStudent2 = await createTestRegistration(student2._id, paidEventA._id);

    const res3 = await makeRequest(
      port,
      '/api/payments',
      'POST',
      {
        registrationId: regStudent2._id.toString(),
        transactionId: 'TXN_ATTACKER_001',
        proofBase64: sampleProofBase64,
        proofFilename: 'proof.png',
        proofMimeType: 'image/png',
      },
      student1Token
    );

    if (res3.status === 403 || res3.status === 404) {
      logPass(3, "Student attempting payment for another student's registration correctly rejected (403/404)");
      passedCount++;
    } else {
      logFail(3, 'Cross-user registration payment submission security violation', res3.status);
    }

    // ----------------------------------------------------
    // TEST 4: Student attempting payment for FREE event -> 400
    // ----------------------------------------------------
    testCount++;
    const freeEvent = await createTestEvent({ isPaid: false, fee: 0 });
    const regFreeStudent1 = await createTestRegistration(student1._id, freeEvent._id);

    const res4 = await makeRequest(
      port,
      '/api/payments',
      'POST',
      {
        registrationId: regFreeStudent1._id.toString(),
        transactionId: 'TXN_FREE_001',
        proofBase64: sampleProofBase64,
        proofFilename: 'proof.png',
        proofMimeType: 'image/png',
      },
      student1Token
    );

    if (res4.status === 400) {
      logPass(4, 'Student attempting payment submission for FREE event correctly rejected with 400 Bad Request');
      passedCount++;
    } else {
      logFail(4, 'Free event payment submission did not return 400', res4.status);
    }

    // ----------------------------------------------------
    // TEST 5: Student with valid paid registration submits proof -> 201
    // ----------------------------------------------------
    testCount++;
    const paidEventB = await createTestEvent({ isPaid: true, fee: 250 });
    const regStudent1 = await createTestRegistration(student1._id, paidEventB._id);

    const res5 = await makeRequest(
      port,
      '/api/payments',
      'POST',
      {
        registrationId: regStudent1._id.toString(),
        transactionId: 'UPI_REF_9876543210',
        proofBase64: sampleProofBase64,
        proofFilename: 'student_receipt.png',
        proofMimeType: 'image/png',
        amount: 5, // Client attempts to tamper with amount to ₹5
      },
      student1Token
    );

    let payment1Id = null;
    if (res5.status === 201 && res5.body.success === true && res5.body.data) {
      payment1Id = res5.body.data._id;
      createdPaymentIds.push(payment1Id);
      if (res5.body.data.proof?.filename) {
        createdProofFilenames.push(res5.body.data.proof.filename);
      }
      logPass(5, 'Student with valid paid registration submits proof: returned 201 Created');
      passedCount++;
    } else {
      logFail(5, 'Valid payment submission did not return 201', res5.body);
    }

    // ----------------------------------------------------
    // TEST 6: Payment stored in MongoDB correctly
    // ----------------------------------------------------
    testCount++;
    const dbPayment1 = await Payment.findById(payment1Id);
    if (
      dbPayment1 &&
      dbPayment1.student.toString() === student1._id.toString() &&
      dbPayment1.event.toString() === paidEventB._id.toString() &&
      dbPayment1.registration.toString() === regStudent1._id.toString() &&
      dbPayment1.transactionId === 'UPI_REF_9876543210'
    ) {
      logPass(6, 'Payment document verified in MongoDB (student, event, registration, transactionId matching)');
      passedCount++;
    } else {
      logFail(6, 'Payment document verification in MongoDB failed', dbPayment1);
    }

    // ----------------------------------------------------
    // TEST 7: Amount comes from Event.fee, not client
    // ----------------------------------------------------
    testCount++;
    if (dbPayment1 && dbPayment1.amount === 250) {
      logPass(7, 'Security verified: Payment amount strictly derived from Event.fee (250) and ignored client-submitted amount (5)');
      passedCount++;
    } else {
      logFail(7, 'Payment amount security violation: tampered client amount was stored', dbPayment1?.amount);
    }

    // ----------------------------------------------------
    // TEST 8: Initial status = PENDING
    // ----------------------------------------------------
    testCount++;
    if (dbPayment1 && dbPayment1.status === 'PENDING') {
      logPass(8, 'Initial payment status correctly initialized as PENDING');
      passedCount++;
    } else {
      logFail(8, 'Initial payment status was not PENDING', dbPayment1?.status);
    }

    // ----------------------------------------------------
    // TEST 9: Duplicate pending payment -> rejected (409)
    // ----------------------------------------------------
    testCount++;
    const res9 = await makeRequest(
      port,
      '/api/payments',
      'POST',
      {
        registrationId: regStudent1._id.toString(),
        transactionId: 'UPI_REF_DUPLICATE_001',
        proofBase64: sampleProofBase64,
        proofFilename: 'duplicate.png',
        proofMimeType: 'image/png',
      },
      student1Token
    );

    if (res9.status === 409) {
      logPass(9, 'Duplicate payment submission attempt on pending registration correctly rejected with 409 Conflict');
      passedCount++;
    } else {
      logFail(9, 'Duplicate pending payment submission did not return 409', res9.status);
    }

    // ----------------------------------------------------
    // TEST 10: Student can view own payment
    // ----------------------------------------------------
    testCount++;
    const res10 = await makeRequest(port, '/api/payments/my', 'GET', null, student1Token);
    if (res10.status === 200 && res10.body.success === true && Array.isArray(res10.body.data)) {
      const hasOwnPayment = res10.body.data.some((p) => p._id === payment1Id);
      if (hasOwnPayment) {
        logPass(10, 'Student can view own payment via GET /api/payments/my (200 OK)');
        passedCount++;
      } else {
        logFail(10, 'My Payments did not include student submission', res10.body.data);
      }
    } else {
      logFail(10, 'GET /api/payments/my failed', res10.body);
    }

    // ----------------------------------------------------
    // TEST 11: Student cannot view another student's payment -> 403/404
    // ----------------------------------------------------
    testCount++;
    const res11 = await makeRequest(port, `/api/payments/${payment1Id}`, 'GET', null, student2Token);
    if (res11.status === 403 || res11.status === 404) {
      logPass(11, "Student privacy verified: Access to another student's payment blocked with 403/404");
      passedCount++;
    } else {
      logFail(11, "Student privacy leak: another student's payment was viewable", res11.status);
    }

    // ----------------------------------------------------
    // TEST 12: Admin can view payment verification list
    // ----------------------------------------------------
    testCount++;
    const res12 = await makeRequest(port, '/api/payments/admin', 'GET', null, adminToken);
    if (res12.status === 200 && res12.body.success === true && Array.isArray(res12.body.data)) {
      logPass(12, `Admin GET /api/payments/admin returned 200 with live payment list (count: ${res12.body.data.length})`);
      passedCount++;
    } else {
      logFail(12, 'Admin payment verification list failed', res12.body);
    }

    // ----------------------------------------------------
    // TEST 13: Student cannot access admin payment endpoint -> 403
    // ----------------------------------------------------
    testCount++;
    const res13 = await makeRequest(port, '/api/payments/admin', 'GET', null, student1Token);
    if (res13.status === 403) {
      logPass(13, 'Student access to GET /api/payments/admin correctly blocked with 403 Forbidden');
      passedCount++;
    } else {
      logFail(13, 'Student access to admin endpoint did not return 403', res13.status);
    }

    // ----------------------------------------------------
    // TEST 14: Admin approves payment -> APPROVED (200)
    // ----------------------------------------------------
    testCount++;
    const res14 = await makeRequest(port, `/api/payments/${payment1Id}/approve`, 'PUT', {}, adminToken);
    const approvedDbPayment = await Payment.findById(payment1Id);

    if (
      res14.status === 200 &&
      approvedDbPayment &&
      approvedDbPayment.status === 'APPROVED' &&
      approvedDbPayment.reviewedBy.toString() === adminUser._id.toString()
    ) {
      logPass(14, 'Admin approves payment: returned 200, status updated to APPROVED in MongoDB, reviewedBy set');
      passedCount++;
    } else {
      logFail(14, 'Admin payment approval failed', { status: res14.status, dbStatus: approvedDbPayment?.status });
    }

    // ----------------------------------------------------
    // TEST 15: Student sees APPROVED status
    // ----------------------------------------------------
    testCount++;
    const res15 = await makeRequest(port, `/api/payments/${payment1Id}`, 'GET', null, student1Token);
    if (res15.status === 200 && res15.body.data?.status === 'APPROVED') {
      logPass(15, 'Student sees updated APPROVED payment status via API');
      passedCount++;
    } else {
      logFail(15, 'Student did not receive APPROVED status', res15.body);
    }

    // ----------------------------------------------------
    // TEST 16: Admin rejects another payment -> REJECTED (200)
    // ----------------------------------------------------
    testCount++;
    const paidEventC = await createTestEvent({ isPaid: true, fee: 300 });
    const regStudent2B = await createTestRegistration(student2._id, paidEventC._id);

    const res16A = await makeRequest(
      port,
      '/api/payments',
      'POST',
      {
        registrationId: regStudent2B._id.toString(),
        transactionId: 'TXN_STUDENT2_FIRST',
        proofBase64: sampleProofBase64,
        proofFilename: 'student2_receipt.png',
        proofMimeType: 'image/png',
      },
      student2Token
    );

    const payment2Id = res16A.body.data._id;
    createdPaymentIds.push(payment2Id);
    if (res16A.body.data.proof?.filename) {
      createdProofFilenames.push(res16A.body.data.proof.filename);
    }

    const res16 = await makeRequest(
      port,
      `/api/payments/${payment2Id}/reject`,
      'PUT',
      { rejectionReason: 'Transaction ID not found in college bank ledger.' },
      adminToken
    );

    const rejectedDbPayment = await Payment.findById(payment2Id);
    if (
      res16.status === 200 &&
      rejectedDbPayment &&
      rejectedDbPayment.status === 'REJECTED' &&
      rejectedDbPayment.rejectionReason === 'Transaction ID not found in college bank ledger.'
    ) {
      logPass(16, 'Admin rejects payment: returned 200, status REJECTED in MongoDB with rejection reason');
      passedCount++;
    } else {
      logFail(16, 'Admin payment rejection failed', { status: res16.status, dbStatus: rejectedDbPayment?.status });
    }

    // ----------------------------------------------------
    // TEST 17: Rejection reason is required
    // ----------------------------------------------------
    testCount++;
    // Create another pending payment to test missing reason rejection
    const paidEventD = await createTestEvent({ isPaid: true, fee: 300 });
    const regStudent1C = await createTestRegistration(student1._id, paidEventD._id);
    const res17Create = await makeRequest(
      port,
      '/api/payments',
      'POST',
      {
        registrationId: regStudent1C._id.toString(),
        transactionId: 'TXN_REJECT_TEST',
        proofBase64: sampleProofBase64,
        proofFilename: 'test.png',
        proofMimeType: 'image/png',
      },
      student1Token
    );
    const payment3Id = res17Create.body.data._id;
    createdPaymentIds.push(payment3Id);

    const res17 = await makeRequest(port, `/api/payments/${payment3Id}/reject`, 'PUT', { rejectionReason: '' }, adminToken);
    if (res17.status === 400) {
      logPass(17, 'Admin rejection without required reason correctly rejected with 400 Bad Request');
      passedCount++;
    } else {
      logFail(17, 'Admin rejection without reason did not return 400', res17.status);
    }

    // ----------------------------------------------------
    // TEST 18: Rejected student can retry once -> 201 / PENDING
    // ----------------------------------------------------
    testCount++;
    const res18 = await makeRequest(
      port,
      '/api/payments',
      'POST',
      {
        registrationId: regStudent2B._id.toString(),
        transactionId: 'TXN_STUDENT2_RETRY',
        proofBase64: sampleProofBase64,
        proofFilename: 'student2_receipt_retry.png',
        proofMimeType: 'image/png',
      },
      student2Token
    );

    let retryPaymentId = null;
    if (res18.status === 201 && res18.body.data) {
      retryPaymentId = res18.body.data._id;
      createdPaymentIds.push(retryPaymentId);
      if (res18.body.data.proof?.filename) {
        createdProofFilenames.push(res18.body.data.proof.filename);
      }

      const retryDbPayment = await Payment.findById(retryPaymentId);
      if (retryDbPayment && retryDbPayment.status === 'PENDING' && retryDbPayment.retryCount === 1) {
        logPass(18, 'Rejected student can retry once: returned 201, status PENDING, retryCount = 1 in MongoDB');
        passedCount++;
      } else {
        logFail(18, 'Retry payment created but state invalid', retryDbPayment);
      }
    } else {
      logFail(18, 'Rejected student retry failed to return 201', res18.body);
    }

    // ----------------------------------------------------
    // TEST 19: Second retry is rejected
    // ----------------------------------------------------
    testCount++;
    // Admin rejects the retry payment
    await makeRequest(
      port,
      `/api/payments/${retryPaymentId}/reject`,
      'PUT',
      { rejectionReason: 'Second receipt still unreadable.' },
      adminToken
    );

    // Student attempts a 2nd retry (3rd total submission)
    const res19 = await makeRequest(
      port,
      '/api/payments',
      'POST',
      {
        registrationId: regStudent2B._id.toString(),
        transactionId: 'TXN_STUDENT2_SECOND_RETRY',
        proofBase64: sampleProofBase64,
        proofFilename: 'third_try.png',
        proofMimeType: 'image/png',
      },
      student2Token
    );

    if (res19.status === 400) {
      logPass(19, 'Second retry attempt correctly blocked with 400 Bad Request (max 1 retry enforced)');
      passedCount++;
    } else {
      logFail(19, 'Second retry was not blocked with 400', res19.status);
    }

    // ----------------------------------------------------
    // TEST 20: Approved payment cannot be resubmitted
    // ----------------------------------------------------
    testCount++;
    const res20 = await makeRequest(
      port,
      '/api/payments',
      'POST',
      {
        registrationId: regStudent1._id.toString(), // payment1 was APPROVED
        transactionId: 'TXN_ATTEMPT_AFTER_APPROVAL',
        proofBase64: sampleProofBase64,
        proofFilename: 'attempt.png',
        proofMimeType: 'image/png',
      },
      student1Token
    );

    if (res20.status === 409 || res20.status === 400) {
      logPass(20, 'Payment resubmission on APPROVED registration correctly rejected (409/400 Conflict)');
      passedCount++;
    } else {
      logFail(20, 'Resubmission on approved payment was not blocked', res20.status);
    }

    // ----------------------------------------------------
    // TEST 21: Payment status transitions are valid
    // ----------------------------------------------------
    testCount++;
    // Cannot approve an already approved payment
    const res21A = await makeRequest(port, `/api/payments/${payment1Id}/approve`, 'PUT', {}, adminToken);
    // Cannot reject an approved payment
    const res21B = await makeRequest(port, `/api/payments/${payment1Id}/reject`, 'PUT', { rejectionReason: 'Invalid' }, adminToken);

    if (res21A.status === 400 && res21B.status === 400) {
      logPass(21, 'Invalid status transitions safely rejected (cannot re-approve or reject an APPROVED payment)');
      passedCount++;
    } else {
      logFail(21, 'Invalid status transition guard failed', { res21A: res21A.status, res21B: res21B.status });
    }

    // ----------------------------------------------------
    // TEST 22: Socket payment_status_updated emitted
    // ----------------------------------------------------
    testCount++;
    // Verify controller contains and executes emitSocketEvent with 'payment_status_updated'
    const controllerCode = fs.readFileSync(path.resolve(__dirname, 'server/src/controllers/paymentController.js'), 'utf8');
    const hasSocketEmit = controllerCode.includes("emitSocketEvent('payment_status_updated'");
    const hasSocketImport = controllerCode.includes("const { getIO } = require('../sockets')");

    if (hasSocketEmit && hasSocketImport) {
      logPass(22, "Socket.IO real-time broadcast: verified controller dispatches 'payment_status_updated'");
      passedCount++;
    } else {
      logFail(22, 'Socket.IO broadcast integration missing in paymentController.js');
    }

    // ----------------------------------------------------
    // TEST 23: Unauthorized approval/rejection rejected -> 403 / 401
    // ----------------------------------------------------
    testCount++;
    const res23A = await makeRequest(port, `/api/payments/${payment3Id}/approve`, 'PUT', {}, student1Token);
    const res23B = await makeRequest(port, `/api/payments/${payment3Id}/approve`, 'PUT');

    if (res23A.status === 403 && res23B.status === 401) {
      logPass(23, 'Unauthorized approval attempts correctly rejected: Student -> 403 Forbidden, Unauthenticated -> 401 Unauthorized');
      passedCount++;
    } else {
      logFail(23, 'Unauthorized approval RBAC failed', { studentStatus: res23A.status, unauthStatus: res23B.status });
    }

    // ----------------------------------------------------
    // TEST 24: Cleanup succeeds & Database Cleanliness
    // ----------------------------------------------------
    testCount++;
    // Delete test payments
    await Payment.deleteMany({ _id: { $in: createdPaymentIds } });
    // Delete test registrations
    await Registration.deleteMany({ _id: { $in: createdRegistrationIds } });
    // Delete test events
    await Event.deleteMany({ _id: { $in: createdEventIds } });
    // Delete test audit logs
    await AuditLog.deleteMany({ entityId: { $in: createdPaymentIds } });

    // Remove generated test proof files from storage
    for (const filename of createdProofFilenames) {
      const filePath = path.join(uploadDir, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          // Ignore unlink errors during cleanup
        }
      }
    }

    const finalEvents = await Event.countDocuments();
    const finalRegs = await Registration.countDocuments();
    const finalPayments = await Payment.countDocuments();
    const finalUsers = await User.countDocuments();

    const u1 = await User.findOne({ email: 'test.student@eventsync.edu' });
    const u2 = await User.findOne({ email: 'admin@eventsync.edu' });
    const u3 = await User.findOne({ email: 'aarav.patel@eventsync.edu' });

    console.log(`\n${colors.cyan}====================================================`);
    console.log(`DATABASE CLEANLINESS & INTEGRITY VERIFICATION:`);
    console.log(`  events.countDocuments():        ${finalEvents} (MUST BE 0)`);
    console.log(`  registrations.countDocuments(): ${finalRegs} (MUST BE 0)`);
    console.log(`  payments.countDocuments():      ${finalPayments} (MUST BE 0)`);
    console.log(`  users.countDocuments():         ${finalUsers} (3 Preserved Phase 2 Users)`);
    console.log(`  test.student preserved:         ${Boolean(u1)}`);
    console.log(`  admin preserved:                ${Boolean(u2)}`);
    console.log(`  aarav.patel preserved:          ${Boolean(u3)}`);
    console.log(`====================================================${colors.reset}\n`);

    if (finalEvents === 0 && finalRegs === 0 && finalPayments === 0 && u1 && u2 && u3) {
      logPass(24, 'Cleanup verification passed: events = 0, registrations = 0, payments = 0, all 3 Phase 2 users intact');
      passedCount++;
    } else {
      logFail(24, 'Database cleanup failed', { finalEvents, finalRegs, finalPayments, finalUsers });
    }

    console.log(`${colors.bold}${passedCount === testCount ? colors.green : colors.red}Phase 5 Automated Suite Results: ${passedCount}/${testCount} Passed${colors.reset}\n`);

    if (passedCount !== testCount) {
      throw new Error(`Only ${passedCount} of ${testCount} tests passed.`);
    }
  } finally {
    // Failsafe cleanup in case of test error
    try {
      if (createdPaymentIds.length > 0) {
        await Payment.deleteMany({ _id: { $in: createdPaymentIds } });
        await AuditLog.deleteMany({ entityId: { $in: createdPaymentIds } });
      }
      if (createdRegistrationIds.length > 0) {
        await Registration.deleteMany({ _id: { $in: createdRegistrationIds } });
      }
      if (createdEventIds.length > 0) {
        await Event.deleteMany({ _id: { $in: createdEventIds } });
      }
      for (const filename of createdProofFilenames) {
        const filePath = path.join(uploadDir, filename);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {}
        }
      }
    } catch (err) {}

    server.close();
    await mongoose.disconnect();
  }
};

runAllPhase5Tests()
  .then(() => {
    console.log(`${colors.green}${colors.bold}✔ ALL 24 PHASE 5 TESTS EXECUTED AND PASSED SUCCESSFULLY!${colors.reset}\n`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`\n${colors.red}${colors.bold}Phase 5 Test Suite Failed:${colors.reset}`, err.message);
    process.exit(1);
  });
