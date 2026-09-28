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
  console.log(`EVENTSYNC PHASE 3 — ROOT MANDATORY AUTOMATED TEST SUITE`);
  console.log(`====================================================${colors.reset}\n`);

  // 1. Connect to MongoDB
  await mongoose.connect(config.mongoUri);
  console.log(`${colors.cyan}[DB] Connected to MongoDB:${colors.reset} ${config.mongoUri}`);

  // Fetch real users from DB (must preserve existing Phase 2 accounts)
  const adminUser = await User.findOne({ role: 'EVENTADMIN' });
  const studentUser = await User.findOne({ role: 'STUDENT' });

  if (!adminUser) {
    throw new Error('No EVENTADMIN user found in database. Required for Phase 3 testing.');
  }
  if (!studentUser) {
    throw new Error('No STUDENT user found in database. Required for Phase 3 testing.');
  }

  console.log(`[Auth] Using existing EVENTADMIN: ${adminUser.email} (${adminUser._id})`);
  console.log(`[Auth] Using existing STUDENT:    ${studentUser.email} (${studentUser._id})`);

  // Generate tokens for both roles
  const adminToken = jwt.sign({ id: adminUser._id, role: adminUser.role }, config.jwtSecret, { expiresIn: '1h' });
  const studentToken = jwt.sign({ id: studentUser._id, role: studentUser.role }, config.jwtSecret, { expiresIn: '1h' });

  // Start HTTP server on ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`[Server] Ephemeral test server running at http://127.0.0.1:${port}\n`);

  let createdEventId = null;
  let testCount = 0;
  let passedCount = 0;

  try {
    // ----------------------------------------------------
    // TEST 1: GET /api/events with empty database
    // Expected: 200, success === true, count === 0, data === []
    // ----------------------------------------------------
    testCount++;
    const res1 = await makeRequest(port, '/api/events');
    if (res1.status === 200 && res1.body.success === true && res1.body.count === 0 && Array.isArray(res1.body.data) && res1.body.data.length === 0) {
      logPass(1, 'GET /api/events on empty database returned 200, success: true, count: 0, data: []');
      passedCount++;
    } else {
      logFail(1, 'GET /api/events on clean DB failed', res1.body);
    }

    // ----------------------------------------------------
    // TEST 2: Unauthenticated POST /api/events
    // Expected: 401
    // ----------------------------------------------------
    testCount++;
    const res2 = await makeRequest(port, '/api/events', 'POST', {
      title: 'Unauth Event Test',
      description: 'Testing 401 unauthenticated block.',
      category: 'Hackathon',
      date: new Date(Date.now() + 86400000).toISOString(),
      time: '10:00 AM',
      venue: 'Lab 1',
      capacity: 100,
    });
    if (res2.status === 401 && res2.body.success === false) {
      logPass(2, 'Unauthenticated POST /api/events correctly rejected with 401 Unauthorized');
      passedCount++;
    } else {
      logFail(2, 'Unauthenticated POST /api/events did not return 401', `Status: ${res2.status}`);
    }

    // ----------------------------------------------------
    // TEST 3: Authenticated STUDENT POST /api/events
    // Expected: 403 Forbidden
    // ----------------------------------------------------
    testCount++;
    const res3 = await makeRequest(
      port,
      '/api/events',
      'POST',
      {
        title: 'Student Attempted Event',
        description: 'Testing student 403 restriction.',
        category: 'Workshop',
        date: new Date(Date.now() + 86400000).toISOString(),
        time: '2:00 PM',
        venue: 'Room 201',
        capacity: 50,
      },
      studentToken
    );
    if (res3.status === 403 && res3.body.success === false) {
      logPass(3, 'Authenticated STUDENT POST /api/events correctly blocked with 403 Forbidden');
      passedCount++;
    } else {
      logFail(3, 'Student POST /api/events did not return 403', `Status: ${res3.status}`);
    }

    // ----------------------------------------------------
    // TEST 4: EVENTADMIN POST with capacity 0 or -5
    // Expected: 400 Bad Request
    // ----------------------------------------------------
    testCount++;
    const res4 = await makeRequest(
      port,
      '/api/events',
      'POST',
      {
        title: 'Invalid Capacity Event',
        description: 'Testing validation rejection with capacity <= 0.',
        category: 'Seminar',
        date: new Date(Date.now() + 86400000).toISOString(),
        time: '3:00 PM',
        venue: 'Auditorium',
        capacity: -5,
      },
      adminToken
    );
    if (res4.status === 400 && res4.body.success === false) {
      logPass(4, 'EVENTADMIN POST with invalid capacity (-5) rejected with 400 Bad Request');
      passedCount++;
    } else {
      logFail(4, 'EVENTADMIN POST with invalid capacity did not return 400', `Status: ${res4.status}`);
    }

    // ----------------------------------------------------
    // TEST 5: EVENTADMIN POST valid temporary verification event
    // Expected: 201, MongoDB document exists, createdBy === adminUser._id
    // ----------------------------------------------------
    testCount++;
    const testEventPayload = {
      title: 'Temporary Verification Coding Marathon',
      description: 'A 24-hour campus competitive coding marathon created strictly for automated test validation.',
      category: 'Hackathon',
      date: new Date(Date.now() + 7 * 86400000).toISOString(),
      time: '09:00 AM - 05:00 PM',
      venue: 'Main Innovation Center',
      capacity: 120,
      isPaid: false,
      fee: 0,
      gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
      status: 'DRAFT',
      // Client attempt to inject malicious createdBy is overridden by req.user._id
      createdBy: new mongoose.Types.ObjectId().toString(),
    };

    const res5 = await makeRequest(port, '/api/events', 'POST', testEventPayload, adminToken);
    if (res5.status === 201 && res5.body.success === true && res5.body.data) {
      createdEventId = res5.body.data._id;
      const dbEvent = await Event.findById(createdEventId);

      const isCreatedByAdmin = dbEvent && dbEvent.createdBy.toString() === adminUser._id.toString();
      const hasCorrectSeats = dbEvent && dbEvent.availableSeats === 120;
      const isDraft = dbEvent && dbEvent.status === 'DRAFT';

      if (dbEvent && isCreatedByAdmin && hasCorrectSeats && isDraft) {
        logPass(5, `EVENTADMIN POST valid event returned 201. MongoDB document verified (createdBy: ${adminUser._id}, availableSeats: 120, status: DRAFT)`);
        passedCount++;
      } else {
        logFail(5, 'EVENTADMIN POST created event but MongoDB assertions failed', { isCreatedByAdmin, hasCorrectSeats, isDraft });
      }
    } else {
      logFail(5, 'EVENTADMIN POST valid event did not return 201', res5.body);
    }

    // ----------------------------------------------------
    // TEST 6: GET /api/events while event is DRAFT
    // Expected: event NOT included, count === 0
    // ----------------------------------------------------
    testCount++;
    const res6 = await makeRequest(port, '/api/events');
    if (res6.status === 200 && res6.body.count === 0 && res6.body.data.length === 0) {
      logPass(6, 'GET /api/events confirms DRAFT event is hidden from public view (count: 0)');
      passedCount++;
    } else {
      logFail(6, 'DRAFT event leaked into public GET /api/events', res6.body);
    }

    // ----------------------------------------------------
    // TEST 7: EVENTADMIN PUT event status → PUBLISHED
    // Expected: 200 OK
    // ----------------------------------------------------
    testCount++;
    const res7 = await makeRequest(port, `/api/events/${createdEventId}`, 'PUT', { status: 'PUBLISHED' }, adminToken);
    if (res7.status === 200 && res7.body.success === true && res7.body.data.status === 'PUBLISHED') {
      logPass(7, 'EVENTADMIN PUT status → PUBLISHED returned 200 OK');
      passedCount++;
    } else {
      logFail(7, 'EVENTADMIN PUT status update failed', res7.body);
    }

    // ----------------------------------------------------
    // TEST 8: GET /api/events
    // Expected: published event appears, count === 1
    // ----------------------------------------------------
    testCount++;
    const res8 = await makeRequest(port, '/api/events');
    if (res8.status === 200 && res8.body.count === 1 && res8.body.data[0]._id.toString() === createdEventId) {
      logPass(8, 'GET /api/events returns newly PUBLISHED event (count: 1)');
      passedCount++;
    } else {
      logFail(8, 'GET /api/events did not return published event', res8.body);
    }

    // ----------------------------------------------------
    // TEST 9: STUDENT PUT /api/events/:id
    // Expected: 403 Forbidden
    // ----------------------------------------------------
    testCount++;
    const res9 = await makeRequest(
      port,
      `/api/events/${createdEventId}`,
      'PUT',
      { title: 'Student Hijacked Title' },
      studentToken
    );
    if (res9.status === 403 && res9.body.success === false) {
      logPass(9, 'STUDENT PUT /api/events/:id correctly blocked with 403 Forbidden');
      passedCount++;
    } else {
      logFail(9, 'STUDENT PUT /api/events/:id did not return 403', `Status: ${res9.status}`);
    }

    // ----------------------------------------------------
    // TEST 10: STUDENT DELETE /api/events/:id
    // Expected: 403 Forbidden
    // ----------------------------------------------------
    testCount++;
    const res10 = await makeRequest(port, `/api/events/${createdEventId}`, 'DELETE', null, studentToken);
    if (res10.status === 403 && res10.body.success === false) {
      logPass(10, 'STUDENT DELETE /api/events/:id correctly blocked with 403 Forbidden');
      passedCount++;
    } else {
      logFail(10, 'STUDENT DELETE /api/events/:id did not return 403', `Status: ${res10.status}`);
    }

    // ----------------------------------------------------
    // TEST 11: EVENTADMIN PUT title + capacity
    // Expected: 200 OK, MongoDB contains updated values (reconciling availableSeats to capacity)
    // ----------------------------------------------------
    testCount++;
    const res11 = await makeRequest(
      port,
      `/api/events/${createdEventId}`,
      'PUT',
      {
        title: 'Updated Test Hackathon Title 2026',
        capacity: 180,
      },
      adminToken
    );
    if (res11.status === 200 && res11.body.success === true) {
      const updatedDb = await Event.findById(createdEventId);
      if (
        updatedDb &&
        updatedDb.title === 'Updated Test Hackathon Title 2026' &&
        updatedDb.capacity === 180 &&
        updatedDb.availableSeats === 180
      ) {
        logPass(11, 'EVENTADMIN PUT title + capacity returned 200. Verified in MongoDB (title & availableSeats reconciled to 180)');
        passedCount++;
      } else {
        logFail(11, 'EVENTADMIN PUT succeeded but MongoDB document failed assertion', updatedDb);
      }
    } else {
      logFail(11, 'EVENTADMIN PUT title + capacity failed', res11.body);
    }

    // ----------------------------------------------------
    // TEST 12: EVENTADMIN DELETE event
    // Expected: 200 OK
    // ----------------------------------------------------
    testCount++;
    const res12 = await makeRequest(port, `/api/events/${createdEventId}`, 'DELETE', null, adminToken);
    if (res12.status === 200 && res12.body.success === true) {
      logPass(12, 'EVENTADMIN DELETE /api/events/:id returned 200 OK');
      passedCount++;
    } else {
      logFail(12, 'EVENTADMIN DELETE event failed', res12.body);
    }

    // ----------------------------------------------------
    // TEST 13: GET deleted event
    // Expected: 404 Not Found
    // ----------------------------------------------------
    testCount++;
    const res13 = await makeRequest(port, `/api/events/${createdEventId}`);
    if (res13.status === 404 && res13.body.success === false) {
      logPass(13, 'GET /api/events/:deletedId correctly returned 404 Not Found');
      passedCount++;
    } else {
      logFail(13, 'GET /api/events/:deletedId did not return 404', `Status: ${res13.status}`);
    }

    // ----------------------------------------------------
    // TEST 14: GET /api/events
    // Expected: count === 0, data === []
    // ----------------------------------------------------
    testCount++;
    const res14 = await makeRequest(port, '/api/events');
    if (res14.status === 200 && res14.body.count === 0 && Array.isArray(res14.body.data) && res14.body.data.length === 0) {
      logPass(14, 'GET /api/events confirmed empty catalog post-deletion (count: 0, data: [])');
      passedCount++;
    } else {
      logFail(14, 'GET /api/events was not empty after delete', res14.body);
    }

    // Explicit verification of database cleanliness
    const finalEventsCount = await Event.countDocuments();
    const finalUsersCount = await User.countDocuments();

    // Verify existing users are intact
    const studentExists = await User.findOne({ email: 'test.student@eventsync.edu' });
    const adminExists = await User.findOne({ email: 'admin@eventsync.edu' });
    const student2Exists = await User.findOne({ email: 'aarav.patel@eventsync.edu' });

    console.log(`\n${colors.cyan}====================================================`);
    console.log(`DATABASE CLEANLINESS & INTEGRITY VERIFICATION:`);
    console.log(`  events.countDocuments(): ${finalEventsCount} (MUST BE 0)`);
    console.log(`  users.countDocuments():  ${finalUsersCount} (Preserved Phase 2 Users)`);
    console.log(`  test.student preserved:  ${Boolean(studentExists)}`);
    console.log(`  admin preserved:         ${Boolean(adminExists)}`);
    console.log(`  aarav.patel preserved:   ${Boolean(student2Exists)}`);
    console.log(`====================================================${colors.reset}\n`);

    if (finalEventsCount !== 0) {
      throw new Error(`Database cleanliness failed: ${finalEventsCount} events remain in MongoDB.`);
    }

    if (!studentExists || !adminExists || !student2Exists) {
      throw new Error('User preservation check failed: One or more Phase 2 users are missing.');
    }

    console.log(`${colors.bold}${passedCount === testCount ? colors.green : colors.red}Automated Suite Results: ${passedCount}/${testCount} Passed${colors.reset}\n`);

    if (passedCount !== testCount) {
      throw new Error(`Only ${passedCount} of ${testCount} tests passed.`);
    }
  } finally {
    // Safety cleanup in case of abrupt failure
    if (createdEventId) {
      try {
        await Event.findByIdAndDelete(createdEventId);
      } catch (err) {
        // Ignore error during cleanup
      }
    }
    server.close();
    await mongoose.disconnect();
  }
};

runAllTests()
  .then(() => {
    console.log(`${colors.green}${colors.bold}✔ ALL 14 PHASE 3 VERIFICATION TESTS PASSED SUCCESSFULLY!${colors.reset}\n`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`\n${colors.red}${colors.bold}Test Suite Failed:${colors.reset}`, err.message);
    process.exit(1);
  });
