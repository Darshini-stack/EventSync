/**
 * Automated Verification Script for Manual Ticket Pass Code Verification
 * Tests:
 * 1. POST /api/attendance/verify-ticket with { passCode, eventId }
 * 2. Individual ticket verification (SUCCESS)
 * 3. Duplicate ticket entry (ALREADY VERIFIED, 409)
 * 4. Wrong event verification (INVALID FOR THIS EVENT, 400)
 * 5. Invalid/nonexistent ticket (INVALID TICKET, 404)
 * 6. Team registration individual member isolation:
 *    - Priya (22CS001) verified -> only Priya PRESENT, Anu and Ravi unchanged
 *    - Priya duplicate -> 409
 *    - Anu (22CS002) verified -> only Anu PRESENT, Ravi unchanged
 * 7. Clean teardown so NO test records remain in MongoDB
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'd:/EventSync/server/.env' });

const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Ticket = require('../models/Ticket');
const Attendance = require('../models/Attendance');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'eventsync_dev_jwt_secret_key_2026_super_secure';

let passed = 0;
let failed = 0;

function assert(condition, testName, extra = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName} - ${extra}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== RUNNING MANUAL TICKET VERIFICATION TESTS ===\n');

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/eventsync');

  const testIds = [];

  try {
    // 1. Setup Admin and Students
    const adminUser = await User.create({
      name: 'Test Event Admin',
      email: `admin_test_${Date.now()}@eventsync.edu`,
      passwordHash: 'test_pw_hash',
      phone: '9876543200',
      role: 'EVENTADMIN',
      department: 'CSE',
      studentId: `ADM${Date.now().toString().slice(-4)}`,
    });
    testIds.push({ model: User, id: adminUser._id });

    const studentSingle = await User.create({
      name: 'Kavya Reddy',
      email: `kavya_${Date.now()}@eventsync.edu`,
      passwordHash: 'test_pw_hash',
      phone: '9876543201',
      role: 'STUDENT',
      department: 'CSE',
      year: '2nd Year',
      studentId: `22CS${Math.floor(100 + Math.random() * 900)}`,
    });
    testIds.push({ model: User, id: studentSingle._id });

    const studentTeamLead = await User.create({
      name: 'Priya Leader',
      email: `priya_lead_${Date.now()}@eventsync.edu`,
      passwordHash: 'test_pw_hash',
      phone: '9876543202',
      role: 'STUDENT',
      department: 'CSE',
      year: '3rd Year',
      studentId: '22CS001',
    });
    testIds.push({ model: User, id: studentTeamLead._id });

    // Generate JWT Admin token
    const adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role, email: adminUser.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. Setup Events
    const eventA = await Event.create({
      title: `Hackathon Alpha ${Date.now().toString().slice(-4)}`,
      description: 'Annual Hackathon Event A',
      category: 'Hackathon',
      date: new Date(Date.now() + 86400000),
      time: '10:00 AM',
      venue: 'Main Seminar Hall',
      capacity: 100,
      availableSeats: 100,
      mode: 'Offline',
      status: 'PUBLISHED',
      createdBy: adminUser._id,
    });
    testIds.push({ model: Event, id: eventA._id });

    const eventB = await Event.create({
      title: `Robotics Expo ${Date.now().toString().slice(-4)}`,
      description: 'Annual Robotics Expo Event B',
      category: 'Workshop',
      date: new Date(Date.now() + 172800000),
      time: '02:00 PM',
      venue: 'Mech Lab',
      capacity: 50,
      availableSeats: 50,
      mode: 'Offline',
      status: 'PUBLISHED',
      createdBy: adminUser._id,
    });
    testIds.push({ model: Event, id: eventB._id });

    // 3. Create Individual Registration & Ticket for Event A
    const singleReg = await Registration.create({
      student: studentSingle._id,
      event: eventA._id,
      fullName: studentSingle.name,
      rollNumber: studentSingle.studentId,
      department: studentSingle.department,
      year: studentSingle.year,
      email: studentSingle.email,
      phone: '9876543210',
      status: 'REGISTERED',
      registrationCode: `REG-${Date.now().toString().slice(-6)}`,
      teamSize: 1,
    });
    testIds.push({ model: Registration, id: singleReg._id });

    const singlePassCode = `ES-PASS-S${Date.now().toString().slice(-7)}`;
    const singleTicket = await Ticket.create({
      ticketCode: singlePassCode,
      passCode: singlePassCode,
      student: studentSingle._id,
      event: eventA._id,
      registration: singleReg._id,
      status: 'ACTIVE',
      qrPayload: `EVENTSYNC:PASS:${singlePassCode}`,
    });
    testIds.push({ model: Ticket, id: singleTicket._id });

    // 4. Create Team Registration & Ticket for Event A (3 members: Priya, Anu, Ravi)
    const teamReg = await Registration.create({
      student: studentTeamLead._id,
      event: eventA._id,
      fullName: studentTeamLead.name,
      rollNumber: '22CS001',
      department: 'CSE',
      year: '3rd Year',
      email: studentTeamLead.email,
      phone: '9876543211',
      status: 'REGISTERED',
      registrationCode: `TEAM-${Date.now().toString().slice(-6)}`,
      teamSize: 3,
      teamName: 'CyberKnights',
      teamMembers: [
        { name: 'Priya Leader', rollNumber: '22CS001', department: 'CSE', year: '3rd Year', attendanceStatus: 'NOT_MARKED' },
        { name: 'Anu Sharma', rollNumber: '22CS002', department: 'CSE', year: '3rd Year', attendanceStatus: 'NOT_MARKED' },
        { name: 'Ravi Teja', rollNumber: '22CS003', department: 'CSE', year: '3rd Year', attendanceStatus: 'NOT_MARKED' },
      ],
    });
    testIds.push({ model: Registration, id: teamReg._id });

    const teamPassCode = `ES-PASS-T${Date.now().toString().slice(-7)}`;
    const teamTicket = await Ticket.create({
      ticketCode: teamPassCode,
      passCode: teamPassCode,
      student: studentTeamLead._id,
      event: eventA._id,
      registration: teamReg._id,
      status: 'ACTIVE',
      qrPayload: `EVENTSYNC:PASS:${teamPassCode}`,
    });
    testIds.push({ model: Ticket, id: teamTicket._id });

    // 5. Create Ticket for Event B (to test WRONG EVENT)
    const eventBPassCode = `ES-PASS-B${Date.now().toString().slice(-7)}`;
    const regB = await Registration.create({
      student: studentSingle._id,
      event: eventB._id,
      fullName: studentSingle.name,
      rollNumber: studentSingle.studentId,
      department: 'CSE',
      year: '2nd Year',
      status: 'REGISTERED',
      registrationCode: `REGB-${Date.now().toString().slice(-6)}`,
      teamSize: 1,
    });
    testIds.push({ model: Registration, id: regB._id });

    const ticketB = await Ticket.create({
      ticketCode: eventBPassCode,
      passCode: eventBPassCode,
      student: studentSingle._id,
      event: eventB._id,
      registration: regB._id,
      status: 'ACTIVE',
      qrPayload: `EVENTSYNC:PASS:${eventBPassCode}`,
    });
    testIds.push({ model: Ticket, id: ticketB._id });

    console.log('\n--- TEST 1: Verify Individual Pass Code (SUCCESS) ---');
    const res1 = await fetch(`${API_BASE}/attendance/verify-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        passCode: singlePassCode,
        eventId: eventA._id.toString(),
      }),
    });
    const data1 = await res1.json();
    assert(res1.status === 200 && data1.success === true, '1.1: HTTP 200 returned on valid pass code');
    assert(data1.data?.studentName === studentSingle.name, '1.2: Returns exact student name', data1.data?.studentName);
    assert(data1.data?.rollNumber === studentSingle.studentId, '1.3: Returns exact roll number', data1.data?.rollNumber);
    assert(data1.data?.attendanceStatus === 'PRESENT', '1.4: Attendance status marked PRESENT');

    const dbAtt1 = await Attendance.findOne({ registration: singleReg._id });
    assert(dbAtt1?.status === 'PRESENT', '1.5: Attendance updated to PRESENT in MongoDB');

    console.log('\n--- TEST 2: Duplicate Pass Code Entry (ALREADY VERIFIED) ---');
    const res2 = await fetch(`${API_BASE}/attendance/verify-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        passCode: singlePassCode,
        eventId: eventA._id.toString(),
      }),
    });
    const data2 = await res2.json();
    assert(res2.status === 409 && data2.alreadyCheckedIn === true, '2.1: HTTP 409 returned on duplicate pass code');
    assert(data2.message.includes('Attendance was already marked PRESENT.'), '2.2: Message matches "Attendance was already marked PRESENT."', data2.message);
    assert(data2.data?.studentName === studentSingle.name, '2.3: Returns participant details on duplicate');

    const attCount1 = await Attendance.countDocuments({ registration: singleReg._id });
    assert(attCount1 === 1, '2.4: No duplicate Attendance document created in MongoDB');

    console.log('\n--- TEST 3: Wrong Event Verification (INVALID FOR THIS EVENT) ---');
    const res3 = await fetch(`${API_BASE}/attendance/verify-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        passCode: eventBPassCode, // Belongs to Event B
        eventId: eventA._id.toString(), // Selected Event A
      }),
    });
    const data3 = await res3.json();
    assert(res3.status === 400 && data3.wrongEvent === true, '3.1: HTTP 400 with wrongEvent: true');
    assert(data3.message.includes('This ticket belongs to another event.'), '3.2: Message says "This ticket belongs to another event."', data3.message);

    const dbAttB = await Attendance.findOne({ registration: regB._id });
    assert(!dbAttB || dbAttB.status !== 'PRESENT', '3.3: Attendance was NOT modified for wrong event');

    console.log('\n--- TEST 4: Invalid Pass Code (INVALID TICKET) ---');
    const res4 = await fetch(`${API_BASE}/attendance/verify-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        passCode: 'ES-PASS-NONEXISTENT',
        eventId: eventA._id.toString(),
      }),
    });
    const data4 = await res4.json();
    assert(res4.status === 404 && data4.invalidTicket === true, '4.1: HTTP 404 with invalidTicket: true');
    assert(data4.message.includes('Ticket/Pass Code could not be verified.'), '4.2: Message says "Ticket/Pass Code could not be verified."', data4.message);

    console.log('\n--- TEST 5: Team Registration - Individual Member Attendance Tracking ---');
    // 5A. Enter Priya's Pass Code (22CS001): ES-PASS-XXXX-22CS001
    const priyaCode = `${teamPassCode}-22CS001`;
    console.log(`  Submitting Priya's code: ${priyaCode}`);
    const res5A = await fetch(`${API_BASE}/attendance/verify-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        passCode: priyaCode,
        eventId: eventA._id.toString(),
      }),
    });
    const data5A = await res5A.json();
    assert(res5A.status === 200 && data5A.success === true, '5A.1: HTTP 200 for Priya check-in');
    assert(data5A.data?.studentName === 'Priya Leader', '5A.2: Identifies Priya Leader as attendee', data5A.data?.studentName);
    assert(data5A.data?.rollNumber === '22CS001', '5A.3: Identifies roll 22CS001', data5A.data?.rollNumber);

    // Verify MongoDB team status: Priya PRESENT, Anu NOT_MARKED, Ravi NOT_MARKED
    const teamRegAfterPriya = await Registration.findById(teamReg._id);
    const priyaMember = teamRegAfterPriya.teamMembers.find(m => m.rollNumber === '22CS001');
    const anuMember = teamRegAfterPriya.teamMembers.find(m => m.rollNumber === '22CS002');
    const raviMember = teamRegAfterPriya.teamMembers.find(m => m.rollNumber === '22CS003');

    assert(priyaMember?.attendanceStatus === 'PRESENT', '5A.4: Priya attendanceStatus in teamMembers is PRESENT');
    assert(anuMember?.attendanceStatus === 'NOT_MARKED', '5A.5: CRITICAL: Anu attendanceStatus remains NOT_MARKED');
    assert(raviMember?.attendanceStatus === 'NOT_MARKED', '5A.6: CRITICAL: Ravi attendanceStatus remains NOT_MARKED');

    // 5B. Duplicate Priya entry
    const res5B = await fetch(`${API_BASE}/attendance/verify-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        passCode: priyaCode,
        eventId: eventA._id.toString(),
      }),
    });
    const data5B = await res5B.json();
    assert(res5B.status === 409 && data5B.alreadyCheckedIn === true, '5B.1: Duplicate Priya entry returns 409 ALREADY VERIFIED');

    // 5C. Enter Anu's Pass Code (22CS002): ES-PASS-XXXX-22CS002
    const anuCode = `${teamPassCode}-22CS002`;
    console.log(`  Submitting Anu's code: ${anuCode}`);
    const res5C = await fetch(`${API_BASE}/attendance/verify-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        passCode: anuCode,
        eventId: eventA._id.toString(),
      }),
    });
    const data5C = await res5C.json();
    assert(res5C.status === 200 && data5C.success === true, '5C.1: HTTP 200 for Anu check-in');
    assert(data5C.data?.studentName === 'Anu Sharma', '5C.2: Identifies Anu Sharma as attendee', data5C.data?.studentName);
    assert(data5C.data?.rollNumber === '22CS002', '5C.3: Identifies roll 22CS002', data5C.data?.rollNumber);

    const teamRegAfterAnu = await Registration.findById(teamReg._id);
    const anuMemberAfter = teamRegAfterAnu.teamMembers.find(m => m.rollNumber === '22CS002');
    const raviMemberAfter = teamRegAfterAnu.teamMembers.find(m => m.rollNumber === '22CS003');

    assert(anuMemberAfter?.attendanceStatus === 'PRESENT', '5C.4: Anu attendanceStatus in teamMembers is now PRESENT');
    assert(raviMemberAfter?.attendanceStatus === 'NOT_MARKED', '5C.5: CRITICAL: Ravi attendanceStatus STILL remains NOT_MARKED');

    console.log('\n--- TEST 6: Backward Compatibility with /api/attendance/check-in ---');
    const res6 = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        passCode: `${teamPassCode}-22CS003`,
        eventId: eventA._id.toString(),
      }),
    });
    const data6 = await res6.json();
    assert(res6.status === 200 && data6.success === true, '6.1: /check-in route succeeds with passCode for Ravi');
    assert(data6.data?.rollNumber === '22CS003', '6.2: Ravi marked present via /check-in');

  } finally {
    // 7. Clean teardown
    console.log('\n--- Cleaning up test records from MongoDB ---');
    await Attendance.deleteMany({ event: { $in: testIds.filter(t => t.model === Event).map(t => t.id) } });
    await Ticket.deleteMany({ _id: { $in: testIds.filter(t => t.model === Ticket).map(t => t.id) } });
    await Registration.deleteMany({ _id: { $in: testIds.filter(t => t.model === Registration).map(t => t.id) } });
    await Event.deleteMany({ _id: { $in: testIds.filter(t => t.model === Event).map(t => t.id) } });
    await User.deleteMany({ _id: { $in: testIds.filter(t => t.model === User).map(t => t.id) } });
    console.log('Cleanup completed: 0 test records left in MongoDB.');
    await mongoose.disconnect();
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
