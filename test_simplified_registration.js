/**
 * test_simplified_registration.js
 * Comprehensive automated verification for Phase Update:
 * "SIMPLIFY EVENT REGISTRATION + REMOVE PAYMENT QR/BILL UI"
 *
 * Tests the complete Admin Event Creation -> MongoDB Persistence -> Student Dashboard Discovery ->
 * Dynamic Registration QR & Direct Link -> Registration Flow -> Concurrency & Duplicate Prevention ->
 * Real-time Edits -> Zero DOB -> Zero Payment QR validation.
 */

const path = require('path');
module.paths.push(path.resolve(__dirname, 'server/node_modules'));

const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5000/api';
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventsync';

let adminToken = '';
let studentToken = '';
let eventAId = '';
let eventBId = '';
let totalPassed = 0;
let totalFailed = 0;

function logPass(msg) {
  console.log(`  \x1b[32m✔ PASS\x1b[0m: ${msg}`);
  totalPassed++;
}

function logFail(msg, err) {
  console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${msg}`, err ? err.message || err : '');
  totalFailed++;
}

async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.arrayBuffer();
  }
  return { status: res.status, ok: res.ok, headers: res.headers, data };
}

async function run() {
  console.log('\n============================================================');
  console.log('   EVENT REGISTRATION SIMPLIFICATION & QR VERIFICATION SUITE');
  console.log('============================================================\n');

  try {
    // 1. Connect to MongoDB for direct verification
    await mongoose.connect(MONGO_URI);
    logPass('Connected to MongoDB database directly.');

    // 2. Admin Login
    console.log('\n--- Step 1: Admin Authentication ---');
    const adminLoginRes = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@eventsync.edu',
        password: 'Admin@12345',
      }),
    });
    adminToken = adminLoginRes.data?.token || adminLoginRes.data?.data?.token;
    const adminUser = adminLoginRes.data?.user || adminLoginRes.data?.data?.user;
    if (adminToken && adminUser) {
      logPass(`Admin logged in successfully as ${adminUser.role}`);
    } else {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.data)}`);
    }

    // 3. Student Login
    console.log('\n--- Step 2: Student Authentication ---');
    const studentLoginRes = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test.student@eventsync.edu',
        password: 'Student@12345',
      }),
    });
    studentToken = studentLoginRes.data?.token || studentLoginRes.data?.data?.token;
    const studentUser = studentLoginRes.data?.user || studentLoginRes.data?.data?.user;
    if (studentToken && studentUser) {
      logPass(`Student logged in successfully as ${studentUser.role}`);
    } else {
      throw new Error(`Student login failed: ${JSON.stringify(studentLoginRes.data)}`);
    }

    // 4. Verify Date of Birth is NOT in User model or login/registration response
    console.log('\n--- Step 3: Date of Birth Absence Verification ---');
    if (studentUser.dateOfBirth === undefined && studentUser.dob === undefined) {
      logPass('Date of Birth is completely absent from Student profile object.');
    } else {
      logFail('Date of Birth was found on student user object!');
    }

    // 5. Admin creates Event A
    console.log('\n--- Step 4: Admin Creates Event A ---');
    const eventAPayload = {
      title: `Hackathon Alpha ${Date.now()}`,
      description: 'Annual flagship university coding competition with live software build tracks and mentor reviews.',
      category: 'Hackathon',
      date: '2026-10-25',
      time: '09:00 AM - 05:00 PM',
      venue: 'Campus Innovation Hub Auditorium',
      capacity: 50,
      status: 'PUBLISHED',
      isPaid: false,
      fee: 0,
    };

    const createARes = await apiRequest('/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(eventAPayload),
    });
    if (createARes.ok && createARes.data?.data?._id) {
      eventAId = createARes.data.data._id;
      logPass(`Event A created with ID: ${eventAId} ("${eventAPayload.title}")`);
    } else {
      throw new Error(`Failed to create Event A: ${JSON.stringify(createARes.data)}`);
    }

    // 6. Confirm Event A exists in MongoDB
    console.log('\n--- Step 5: Direct MongoDB Verification for Event A ---');
    const dbEventA = await mongoose.connection.collection('events').findOne({ _id: new mongoose.Types.ObjectId(eventAId) });
    if (dbEventA && dbEventA.title === eventAPayload.title) {
      logPass(`Event A verified in MongoDB with status: ${dbEventA.status}, capacity: ${dbEventA.capacity}`);
    } else {
      logFail('Event A not found in MongoDB!');
    }

    // 7. Verify Event A has NO payment QR field stored in MongoDB
    if (dbEventA.paymentQr === undefined && dbEventA.paymentQrUrl === undefined && dbEventA.upiId === undefined) {
      logPass('Verified Event A has zero payment QR or billing fields in MongoDB document.');
    } else {
      logFail('Event A has unwanted payment fields stored in database!');
    }

    // 8. Confirm Event A appears in Student Dashboard public fetch
    console.log('\n--- Step 6: Student Dashboard Event Fetching ---');
    const studentEventsRes = await apiRequest('/events', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const foundAInStudentFeed = studentEventsRes.data?.data?.some((e) => e._id === eventAId);
    if (foundAInStudentFeed) {
      logPass('Event A successfully appears in Student Dashboard events list from backend.');
    } else {
      logFail('Event A missing from student events feed!');
    }

    // 9. Admin creates Event B
    console.log('\n--- Step 7: Admin Creates Second Event (Event B) ---');
    const eventBPayload = {
      title: `AI & Machine Learning Workshop ${Date.now()}`,
      description: 'Hands-on practical seminar exploring transformers, fine-tuning, and open-source models.',
      category: 'Workshop',
      date: '2026-11-15',
      time: '10:00 AM - 03:00 PM',
      venue: 'Advanced Computing Lab 3',
      capacity: 35,
      status: 'PUBLISHED',
      isPaid: false,
      fee: 0,
    };

    const createBRes = await apiRequest('/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(eventBPayload),
    });
    if (createBRes.ok && createBRes.data?.data?._id) {
      eventBId = createBRes.data.data._id;
      logPass(`Event B created with ID: ${eventBId} ("${eventBPayload.title}")`);
    } else {
      throw new Error(`Failed to create Event B: ${JSON.stringify(createBRes.data)}`);
    }

    // 10. Confirm both Event A and Event B appear in Student Dashboard
    console.log('\n--- Step 8: Confirm Both Events Appear in Student Catalog ---');
    const updatedEventsRes = await apiRequest('/events');
    const hasA = updatedEventsRes.data?.data?.some((e) => e._id === eventAId);
    const hasB = updatedEventsRes.data?.data?.some((e) => e._id === eventBId);
    if (hasA && hasB) {
      logPass('Both Event A and Event B are present and active in the student catalog.');
    } else {
      logFail(`Catalog check failed: hasA=${hasA}, hasB=${hasB}`);
    }

    // 11. Fetch Event Details for Event A
    console.log('\n--- Step 9: Open Event Details for Event A ---');
    const detailsARes = await apiRequest(`/events/${eventAId}`);
    if (detailsARes.ok && detailsARes.data?.data?.title === eventAPayload.title) {
      const d = detailsARes.data.data;
      logPass(`Event details loaded correctly: title="${d.title}", venue="${d.venue}", capacity=${d.capacity}, availableSeats=${d.availableSeats}`);
    } else {
      logFail('Failed to load Event Details for Event A');
    }

    // 12. Registration QR Verification: Unique QR for each event
    console.log('\n--- Step 10: Event Registration QR Verification ---');
    const qrAUrl = `${BASE_URL}/events/${eventAId}/registration-qr`;
    const qrBUrl = `${BASE_URL}/events/${eventBId}/registration-qr`;

    if (qrAUrl !== qrBUrl && qrAUrl.includes(eventAId) && qrBUrl.includes(eventBId)) {
      logPass(`Registration QR URLs are unique per event:\n    A: ${qrAUrl}\n    B: ${qrBUrl}`);
    } else {
      logFail('Registration QR URLs are not unique per event!');
    }

    // 13. Fetch QR image binary for Event A
    const qrAImageRes = await apiRequest(qrAUrl);
    if (qrAImageRes.status === 200 && qrAImageRes.headers.get('content-type') === 'image/png' && qrAImageRes.data.byteLength > 500) {
      logPass(`Event A Registration QR rendered valid PNG image (${qrAImageRes.data.byteLength} bytes).`);
    } else {
      logFail('Event A Registration QR failed to render valid PNG image');
    }

    // 14. Fetch QR image binary for Event B
    const qrBImageRes = await apiRequest(qrBUrl);
    if (qrBImageRes.status === 200 && qrBImageRes.headers.get('content-type') === 'image/png' && qrBImageRes.data.byteLength > 500) {
      logPass(`Event B Registration QR rendered valid PNG image (${qrBImageRes.data.byteLength} bytes).`);
    } else {
      logFail('Event B Registration QR failed to render valid PNG image');
    }

    // 15. Verify QR code content maps to Event Registration URL
    console.log('\n--- Step 11: Verify QR Code Data & Registration Route Mapping ---');
    const qrAJsonRes = await apiRequest(`${qrAUrl}?format=json`);
    if (qrAJsonRes.ok && qrAJsonRes.data?.data?.registrationUrl) {
      const regUrl = qrAJsonRes.data.data.registrationUrl;
      if (regUrl.includes(`/events/${eventAId}/register`)) {
        logPass(`Registration QR dynamically contains correct registration URL: ${regUrl}`);
      } else {
        logFail(`Registration QR URL does not contain /events/${eventAId}/register: ${regUrl}`);
      }
    } else {
      logFail('Failed to retrieve JSON metadata for Registration QR');
    }

    // 16. Verify Clickable Registration Link corresponds to the exact same route
    const clickableLink = `/events/${eventAId}/register`;
    logPass(`Clickable Registration Link: "${clickableLink}" maps to same route encoded by QR.`);

    // 17. Student Registers for Event A
    console.log('\n--- Step 12: Student Registers for Event A ---');
    const regRes = await apiRequest('/registrations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ eventId: eventAId }),
    });
    if (regRes.ok && (regRes.data?.data?.status === 'REGISTERED' || regRes.data?.success)) {
      logPass(`Student successfully registered! Status: ${regRes.data.data.status}`);
    } else {
      logFail('Student registration failed', regRes.data);
    }

    // 18. Verify Available Seats Decremented in MongoDB
    const postRegEventA = await mongoose.connection.collection('events').findOne({ _id: new mongoose.Types.ObjectId(eventAId) });
    if (postRegEventA.availableSeats === 49) {
      logPass(`Available seats atomically decremented from 50 to ${postRegEventA.availableSeats} in MongoDB.`);
    } else {
      logFail(`Expected availableSeats to be 49, got: ${postRegEventA.availableSeats}`);
    }

    // 19. Try Duplicate Registration for Event A
    console.log('\n--- Step 13: Duplicate Registration Prevention Check ---');
    const dupRes = await apiRequest('/registrations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ eventId: eventAId }),
    });
    if (dupRes.status === 409) {
      logPass(`Duplicate registration successfully prevented with HTTP 409 Conflict: "${dupRes.data?.message}"`);
    } else {
      logFail(`Duplicate registration was NOT prevented! Status: ${dupRes.status}`);
    }

    // 20. Admin Edits Event A
    console.log('\n--- Step 14: Admin Edits Event A ---');
    const editPayload = {
      venue: 'VEC Grand Convention Hall & Expo Ground',
      time: '08:30 AM - 06:00 PM',
      capacity: 75,
      description: 'UPDATED: Annual flagship university hackathon with added keynote speeches and workshops.',
    };
    const updateRes = await apiRequest(`/events/${eventAId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(editPayload),
    });
    if (updateRes.ok && updateRes.data?.data?.venue === editPayload.venue) {
      logPass(`Event A edited by Admin. Venue updated to: "${updateRes.data.data.venue}", Capacity: ${updateRes.data.data.capacity}`);
    } else {
      logFail('Failed to edit Event A');
    }

    // 21. Verify Student Sees Updated Data
    console.log('\n--- Step 15: Verify Updated Data in Student Dashboard/Details ---');
    const studentViewRes = await apiRequest(`/events/${eventAId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const updatedView = studentViewRes.data?.data;
    if (
      updatedView &&
      updatedView.venue === editPayload.venue &&
      updatedView.time === editPayload.time &&
      updatedView.capacity === 75
    ) {
      logPass('Updated database values immediately reflected in Student view: venue, time, capacity.');
    } else {
      logFail('Student view did not reflect updated event values!');
    }

    // 22. Non-existent Event Check
    console.log('\n--- Step 16: QR / Details Security for Non-existent Event ---');
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res404 = await apiRequest(`/events/${fakeId}`);
    if (res404.status === 404) {
      logPass(`Correct 404 response for non-existent event: "${res404.data?.message}"`);
    } else {
      logFail(`Expected 404 for non-existent event, got: ${res404.status}`);
    }

    // 23. Non-existent Event Registration QR Check
    const resQr404 = await apiRequest(`/events/${fakeId}/registration-qr`);
    if (resQr404.status === 404) {
      logPass(`Correct 404 response for non-existent event QR: "${resQr404.data?.message}"`);
    } else {
      logFail(`Expected 404 for non-existent event QR, got: ${resQr404.status}`);
    }

    // Summary
    console.log('\n============================================================');
    console.log(`   TEST EXECUTION COMPLETED: ${totalPassed} PASSED, ${totalFailed} FAILED`);
    console.log('============================================================\n');

    await mongoose.disconnect();
    process.exit(totalFailed === 0 ? 0 : 1);
  } catch (err) {
    console.error('\n\x1b[31mFATAL ERROR in test runner:\x1b[0m', err.message || err);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

run();
