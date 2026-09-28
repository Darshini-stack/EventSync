const http = require('http');
const path = require('path');

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

const runAllTests = async () => {
  console.log(`\n${colors.bold}${colors.cyan}====================================================`);
  console.log(`EVENTSYNC PHASE 4 — AUTOMATED TEST SUITE (18 TESTS)`);
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

  // Track temporary test documents for guaranteed cleanup
  const createdEventIds = [];
  const createdRegistrationIds = [];

  try {
    // Helper to create test events
    const createTestEvent = async (status = 'PUBLISHED', capacity = 10, availableSeats = 10) => {
      const ev = await Event.create({
        title: `Phase 4 Test Event ${Date.now()}`,
        description: 'Temporary event created specifically for Phase 4 RSVP verification.',
        category: 'Workshop',
        date: new Date(Date.now() + 86400000),
        time: '10:00 AM - 12:00 PM',
        venue: 'Room 101',
        capacity,
        availableSeats,
        isPaid: false,
        fee: 0,
        status,
        createdBy: adminUser._id,
      });
      createdEventIds.push(ev._id);
      return ev;
    };

    // ----------------------------------------------------
    // TEST 1: Unauthenticated POST /api/registrations
    // Expected: 401
    // ----------------------------------------------------
    testCount++;
    const res1 = await makeRequest(port, '/api/registrations', 'POST', { eventId: new mongoose.Types.ObjectId().toString() });
    if (res1.status === 401) {
      logPass(1, 'Unauthenticated POST /api/registrations correctly rejected with 401 Unauthorized');
      passedCount++;
    } else {
      logFail(1, 'Unauthenticated POST did not return 401', res1.status);
    }

    // ----------------------------------------------------
    // TEST 2: EVENTADMIN attempts student registration
    // Expected: 403 Forbidden
    // ----------------------------------------------------
    testCount++;
    const res2 = await makeRequest(port, '/api/registrations', 'POST', { eventId: new mongoose.Types.ObjectId().toString() }, adminToken);
    if (res2.status === 403) {
      logPass(2, 'EVENTADMIN attempting student registration correctly rejected with 403 Forbidden');
      passedCount++;
    } else {
      logFail(2, 'EVENTADMIN registration did not return 403', res2.status);
    }

    // ----------------------------------------------------
    // TEST 3: Student registers for DRAFT event
    // Expected: 400 Bad Request
    // ----------------------------------------------------
    testCount++;
    const draftEvent = await createTestEvent('DRAFT', 10, 10);
    const res3 = await makeRequest(port, '/api/registrations', 'POST', { eventId: draftEvent._id.toString() }, student1Token);
    if (res3.status === 400) {
      logPass(3, 'Student registration for DRAFT event correctly rejected with 400 Bad Request');
      passedCount++;
    } else {
      logFail(3, 'Student registration for DRAFT event did not return 400', res3.status);
    }

    // ----------------------------------------------------
    // TEST 4: Student registers for CANCELLED event
    // Expected: 400 Bad Request
    // ----------------------------------------------------
    testCount++;
    const cancelledEvent = await createTestEvent('CANCELLED', 10, 10);
    const res4 = await makeRequest(port, '/api/registrations', 'POST', { eventId: cancelledEvent._id.toString() }, student1Token);
    if (res4.status === 400) {
      logPass(4, 'Student registration for CANCELLED event correctly rejected with 400 Bad Request');
      passedCount++;
    } else {
      logFail(4, 'Student registration for CANCELLED event did not return 400', res4.status);
    }

    // ----------------------------------------------------
    // TEST 5: Student registers for PUBLISHED event with available seat
    // Expected: 201, MongoDB verified, student == student1, availableSeats decremented by exactly 1
    // ----------------------------------------------------
    testCount++;
    const pubEvent = await createTestEvent('PUBLISHED', 5, 5);
    const res5 = await makeRequest(port, '/api/registrations', 'POST', { eventId: pubEvent._id.toString() }, student1Token);

    if (res5.status === 201 && res5.body.success === true && res5.body.data) {
      const regId = res5.body.data._id;
      createdRegistrationIds.push(regId);
      const dbReg = await Registration.findById(regId);
      const dbEvent = await Event.findById(pubEvent._id);

      const isStudentMatch = dbReg && dbReg.student.toString() === student1._id.toString();
      const isStatusRegistered = dbReg && dbReg.status === 'REGISTERED';
      const isSeatDecremented = dbEvent && dbEvent.availableSeats === 4;

      if (dbReg && isStudentMatch && isStatusRegistered && isSeatDecremented) {
        logPass(5, 'Student registers for PUBLISHED event: returned 201, verified in MongoDB (student match, status: REGISTERED, availableSeats 5 -> 4)');
        passedCount++;
      } else {
        logFail(5, 'Registration succeeded but MongoDB assertions failed', { isStudentMatch, isStatusRegistered, isSeatDecremented });
      }
    } else {
      logFail(5, 'Student registration did not return 201', res5.body);
    }

    // ----------------------------------------------------
    // TEST 6: Same student attempts duplicate registration
    // Expected: 409 Conflict, no duplicate active registration
    // ----------------------------------------------------
    testCount++;
    const res6 = await makeRequest(port, '/api/registrations', 'POST', { eventId: pubEvent._id.toString() }, student1Token);
    const activeRegCount = await Registration.countDocuments({ student: student1._id, event: pubEvent._id, status: 'REGISTERED' });

    if (res6.status === 409 && activeRegCount === 1) {
      logPass(6, 'Duplicate registration attempt correctly rejected with 409 Conflict (exactly 1 active record exists in DB)');
      passedCount++;
    } else {
      logFail(6, 'Duplicate registration test failed', { status: res6.status, activeRegCount });
    }

    // ----------------------------------------------------
    // TEST 7: Second student registers
    // Expected: 201, availableSeats decremented again (4 -> 3)
    // ----------------------------------------------------
    testCount++;
    const res7 = await makeRequest(port, '/api/registrations', 'POST', { eventId: pubEvent._id.toString() }, student2Token);
    if (res7.status === 201 && res7.body.data) {
      createdRegistrationIds.push(res7.body.data._id);
      const dbEvent = await Event.findById(pubEvent._id);
      if (dbEvent && dbEvent.availableSeats === 3) {
        logPass(7, 'Second student registration returned 201. Available seats decremented 4 -> 3');
        passedCount++;
      } else {
        logFail(7, 'Second student registration did not decrement seat properly', dbEvent?.availableSeats);
      }
    } else {
      logFail(7, 'Second student registration failed', res7.body);
    }

    // ----------------------------------------------------
    // TEST 8: Student requests My Registrations
    // Expected: 200, only that student's registrations returned
    // ----------------------------------------------------
    testCount++;
    const res8 = await makeRequest(port, '/api/registrations/my', 'GET', null, student1Token);
    if (res8.status === 200 && res8.body.success === true && Array.isArray(res8.body.data)) {
      const allBelongToStudent1 = res8.body.data.every((r) => r.student.toString() === student1._id.toString());
      if (allBelongToStudent1) {
        logPass(8, `GET /api/registrations/my returned 200. Privacy verified (only student 1's records returned: ${res8.body.data.length})`);
        passedCount++;
      } else {
        logFail(8, 'Privacy leak: My Registrations contained records for another student');
      }
    } else {
      logFail(8, 'GET /api/registrations/my failed', res8.body);
    }

    // ----------------------------------------------------
    // TEST 9: Student attempts to cancel another student's registration
    // Expected: 404/403, registration remains unchanged
    // ----------------------------------------------------
    testCount++;
    const student1Reg = await Registration.findOne({ student: student1._id, event: pubEvent._id, status: 'REGISTERED' });
    const res9 = await makeRequest(port, `/api/registrations/${student1Reg._id}`, 'DELETE', null, student2Token);
    const unchangedReg = await Registration.findById(student1Reg._id);

    if ((res9.status === 404 || res9.status === 403) && unchangedReg && unchangedReg.status === 'REGISTERED') {
      logPass(9, 'Student attempting to cancel another student registration correctly rejected (status: REGISTERED unchanged)');
      passedCount++;
    } else {
      logFail(9, 'Cross-user cancellation security check failed', { status: res9.status, regStatus: unchangedReg?.status });
    }

    // ----------------------------------------------------
    // TEST 10: Student cancels own registration
    // Expected: 200, status CANCELLED, availableSeats restored exactly once (3 -> 4)
    // ----------------------------------------------------
    testCount++;
    const res10 = await makeRequest(port, `/api/registrations/${student1Reg._id}`, 'DELETE', null, student1Token);
    const cancelledDbReg = await Registration.findById(student1Reg._id);
    const dbEventPostCancel = await Event.findById(pubEvent._id);

    if (
      res10.status === 200 &&
      cancelledDbReg &&
      cancelledDbReg.status === 'CANCELLED' &&
      dbEventPostCancel &&
      dbEventPostCancel.availableSeats === 4
    ) {
      logPass(10, 'Student cancels own registration: returned 200, status CANCELLED, availableSeats restored exactly once (3 -> 4)');
      passedCount++;
    } else {
      logFail(10, 'Student cancellation test failed', { resStatus: res10.status, regStatus: cancelledDbReg?.status, seats: dbEventPostCancel?.availableSeats });
    }

    // ----------------------------------------------------
    // TEST 11: Student attempts to cancel the same registration again
    // Expected: 400 Bad Request, availableSeats does NOT increase twice (remains 4)
    // ----------------------------------------------------
    testCount++;
    const res11 = await makeRequest(port, `/api/registrations/${student1Reg._id}`, 'DELETE', null, student1Token);
    const dbEventPostSecondCancel = await Event.findById(pubEvent._id);

    if (res11.status === 400 && dbEventPostSecondCancel && dbEventPostSecondCancel.availableSeats === 4) {
      logPass(11, 'Repeat cancellation attempt correctly rejected with 400. Available seats safely unchanged (remains 4)');
      passedCount++;
    } else {
      logFail(11, 'Repeat cancellation allowed duplicate seat restoration', { status: res11.status, seats: dbEventPostSecondCancel?.availableSeats });
    }

    // ----------------------------------------------------
    // TEST 12: Capacity enforcement (Capacity 1 full event)
    // Expected: When availableSeats === 0, next registration rejected, availableSeats never negative
    // ----------------------------------------------------
    testCount++;
    const fullTestEvent = await createTestEvent('PUBLISHED', 1, 1);
    // Student 1 claims the 1 seat
    const claimRes = await makeRequest(port, '/api/registrations', 'POST', { eventId: fullTestEvent._id.toString() }, student1Token);
    if (claimRes.body && claimRes.body.data) createdRegistrationIds.push(claimRes.body.data._id);

    // Event is now at 0 seats. Student 2 attempts registration.
    const overflowRes = await makeRequest(port, '/api/registrations', 'POST', { eventId: fullTestEvent._id.toString() }, student2Token);
    const fullDbEvent = await Event.findById(fullTestEvent._id);

    if (overflowRes.status === 400 && fullDbEvent && fullDbEvent.availableSeats === 0) {
      logPass(12, 'Capacity enforcement: Registration on 0-seat event rejected with 400. availableSeats remains 0 (never negative)');
      passedCount++;
    } else {
      logFail(12, 'Capacity enforcement test failed', { status: overflowRes.status, availableSeats: fullDbEvent?.availableSeats });
    }

    // ----------------------------------------------------
    // TEST 13: CRITICAL CONCURRENCY TEST
    // - Create a PUBLISHED event with exactly 1 available seat
    // - Two DIFFERENT students send registration requests concurrently
    // - Exactly ONE request must succeed with HTTP 201
    // - The other request must fail safely with HTTP 400 or 409
    // - MongoDB must contain exactly ONE active REGISTERED record for that event
    // - Event.availableSeats must equal 0 (NEVER negative)
    // ----------------------------------------------------
    testCount++;
    const raceEvent = await createTestEvent('PUBLISHED', 1, 1);

    // Send two concurrent registration requests simultaneously
    const [raceRes1, raceRes2] = await Promise.all([
      makeRequest(port, '/api/registrations', 'POST', { eventId: raceEvent._id.toString() }, student1Token),
      makeRequest(port, '/api/registrations', 'POST', { eventId: raceEvent._id.toString() }, student2Token),
    ]);

    if (raceRes1.body?.data) createdRegistrationIds.push(raceRes1.body.data._id);
    if (raceRes2.body?.data) createdRegistrationIds.push(raceRes2.body.data._id);

    const statuses = [raceRes1.status, raceRes2.status];
    const successCount = statuses.filter((s) => s === 201).length;
    const failureCount = statuses.filter((s) => s === 400 || s === 409).length;

    // Verify directly from MongoDB
    const raceDbEvent = await Event.findById(raceEvent._id);
    const activeRegistrationsForRace = await Registration.find({ event: raceEvent._id, status: 'REGISTERED' });

    const isExactlyOneWinner = successCount === 1 && failureCount === 1;
    const isDbActiveCountOne = activeRegistrationsForRace.length === 1;
    const isZeroSeatsLeft = raceDbEvent && raceDbEvent.availableSeats === 0;

    if (isExactlyOneWinner && isDbActiveCountOne && isZeroSeatsLeft) {
      logPass(13, `CRITICAL CONCURRENCY TEST PASSED: Exactly 1 student won seat (201), other failed (${failureCount === 1 ? '400/409' : 'err'}). MongoDB verified: exactly 1 active registration, availableSeats === 0 (never negative)`);
      passedCount++;
    } else {
      logFail(13, 'CRITICAL CONCURRENCY TEST FAILED', {
        statuses,
        activeRegistrationsInDb: activeRegistrationsForRace.length,
        availableSeats: raceDbEvent?.availableSeats,
      });
    }

    // ----------------------------------------------------
    // TEST 14: Admin registration endpoint
    // Expected: EVENTADMIN token accesses GET /api/registrations/admin, returns live data
    // ----------------------------------------------------
    testCount++;
    const res14 = await makeRequest(port, '/api/registrations/admin', 'GET', null, adminToken);
    if (res14.status === 200 && res14.body.success === true && Array.isArray(res14.body.data)) {
      logPass(14, `EVENTADMIN GET /api/registrations/admin returned 200. Live data verified (count: ${res14.body.data.length})`);
      passedCount++;
    } else {
      logFail(14, 'Admin registration endpoint test failed', res14.body);
    }

    // ----------------------------------------------------
    // TEST 15: Student cannot access admin registration endpoint
    // Expected: 403 Forbidden
    // ----------------------------------------------------
    testCount++;
    const res15 = await makeRequest(port, '/api/registrations/admin', 'GET', null, student1Token);
    if (res15.status === 403) {
      logPass(15, 'Student access to GET /api/registrations/admin correctly blocked with 403 Forbidden');
      passedCount++;
    } else {
      logFail(15, 'Student access to admin registrations did not return 403', res15.status);
    }

    // ----------------------------------------------------
    // TEST 16: Unauthenticated My Registrations
    // Expected: 401 Unauthorized
    // ----------------------------------------------------
    testCount++;
    const res16 = await makeRequest(port, '/api/registrations/my');
    if (res16.status === 401) {
      logPass(16, 'Unauthenticated GET /api/registrations/my correctly rejected with 401 Unauthorized');
      passedCount++;
    } else {
      logFail(16, 'Unauthenticated GET /api/registrations/my did not return 401', res16.status);
    }

    // ----------------------------------------------------
    // TEST 17: Student identity security
    // - Client attempts to send another student's ID in body
    // - Backend MUST use req.user._id and ignore client-supplied studentId
    // ----------------------------------------------------
    testCount++;
    const spoofEvent = await createTestEvent('PUBLISHED', 5, 5);
    const spoofRes = await makeRequest(
      port,
      '/api/registrations',
      'POST',
      {
        eventId: spoofEvent._id.toString(),
        studentId: student2._id.toString(), // Attacking field
        student: student2._id.toString(),   // Attacking field
      },
      student1Token
    );

    if (spoofRes.status === 201 && spoofRes.body.data) {
      createdRegistrationIds.push(spoofRes.body.data._id);
      const spoofDbReg = await Registration.findById(spoofRes.body.data._id);
      if (spoofDbReg && spoofDbReg.student.toString() === student1._id.toString()) {
        logPass(17, 'Student identity security verified: Backend strictly bound student to authenticated JWT user (ignored malicious client studentId)');
        passedCount++;
      } else {
        logFail(17, 'Identity spoofing vulnerability: registration created with attacker student ID', spoofDbReg?.student);
      }
    } else {
      logFail(17, 'Registration failed during spoofing test', spoofRes.body);
    }

    // ----------------------------------------------------
    // TEST 18: Cleanup & Database Integrity Verification
    // - Delete all temporary Phase 4 test events and registrations
    // - Verify events collection contains 0
    // - Verify registrations collection contains 0
    // - Verify existing 3 users are preserved
    // ----------------------------------------------------
    testCount++;
    // Clean up temporary registrations
    await Registration.deleteMany({ _id: { $in: createdRegistrationIds } });
    // Clean up temporary events
    await Event.deleteMany({ _id: { $in: createdEventIds } });

    const finalEventsCount = await Event.countDocuments();
    const finalRegsCount = await Registration.countDocuments();
    const finalUsersCount = await User.countDocuments();

    const u1 = await User.findOne({ email: 'test.student@eventsync.edu' });
    const u2 = await User.findOne({ email: 'admin@eventsync.edu' });
    const u3 = await User.findOne({ email: 'aarav.patel@eventsync.edu' });

    console.log(`\n${colors.cyan}====================================================`);
    console.log(`DATABASE CLEANLINESS & INTEGRITY VERIFICATION:`);
    console.log(`  events.countDocuments():        ${finalEventsCount} (MUST BE 0)`);
    console.log(`  registrations.countDocuments(): ${finalRegsCount} (MUST BE 0)`);
    console.log(`  users.countDocuments():         ${finalUsersCount} (3 Phase 2 Users Preserved)`);
    console.log(`  test.student preserved:         ${Boolean(u1)}`);
    console.log(`  admin preserved:                ${Boolean(u2)}`);
    console.log(`  aarav.patel preserved:          ${Boolean(u3)}`);
    console.log(`====================================================${colors.reset}\n`);

    if (finalEventsCount === 0 && finalRegsCount === 0 && u1 && u2 && u3) {
      logPass(18, 'Cleanup verification passed: events = 0, registrations = 0, all 3 Phase 2 users intact');
      passedCount++;
    } else {
      logFail(18, 'Database cleanup failed', { finalEventsCount, finalRegsCount, finalUsersCount });
    }

    console.log(`${colors.bold}${passedCount === testCount ? colors.green : colors.red}Automated Suite Results: ${passedCount}/${testCount} Passed${colors.reset}\n`);

    if (passedCount !== testCount) {
      throw new Error(`Only ${passedCount} of ${testCount} tests passed.`);
    }
  } finally {
    // Failsafe cleanup in case of test error
    try {
      if (createdRegistrationIds.length > 0) {
        await Registration.deleteMany({ _id: { $in: createdRegistrationIds } });
      }
      if (createdEventIds.length > 0) {
        await Event.deleteMany({ _id: { $in: createdEventIds } });
      }
    } catch (err) {
      // Ignore errors in failsafe
    }
    server.close();
    await mongoose.disconnect();
  }
};

runAllTests()
  .then(() => {
    console.log(`${colors.green}${colors.bold}✔ ALL 18 PHASE 4 TESTS EXECUTED AND PASSED SUCCESSFULLY!${colors.reset}\n`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`\n${colors.red}${colors.bold}Test Suite Failed:${colors.reset}`, err.message);
    process.exit(1);
  });
