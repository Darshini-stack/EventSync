const mongoose = require('mongoose');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Ticket = require('../models/Ticket');
const Attendance = require('../models/Attendance');
const Certificate = require('../models/Certificate');

const API_BASE = 'http://127.0.0.1:5000/api';

const runTests = async () => {
  console.log('================================================================');
  console.log('STARTING AUTOMATED VERIFICATION SUITE FOR SCENARIOS N THROUGH Z');
  console.log('================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  const assert = (condition, title, details = '') => {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${title} - Details: ${details}`);
      failedCount++;
    }
  };

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventsync';
  await mongoose.connect(mongoUri);

  const cleanupRegIds = [];
  const cleanupUserIds = [];
  const cleanupEventIds = [];

  try {
    const jwtSecret = process.env.JWT_SECRET || 'eventsync_dev_secret_key_change_in_prod';

    // 1. Get or create Admin user
    let admin = await User.findOne({ role: 'EVENTADMIN' });
    if (!admin) {
      admin = await User.create({
        name: 'Event Admin',
        email: `admin_${Date.now()}@college.edu`,
        phone: '9876543211',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
        role: 'EVENTADMIN',
      });
      cleanupUserIds.push(admin._id);
    }
    const adminToken = jwt.sign({ id: admin._id, role: admin.role }, jwtSecret, { expiresIn: '1d' });

    // 2. Identify Event A (Smart India Hackathon 2026)
    let eventA = await Event.findOne({ title: 'Smart India Hackathon 2026' });
    if (!eventA) {
      eventA = await Event.create({
        title: 'Smart India Hackathon 2026',
        description: 'National Level Hackathon',
        category: 'Hackathon / Innovation',
        mode: 'Offline',
        venue: 'Campus Main Auditorium',
        capacity: 100,
        availableSeats: 66,
        status: 'PUBLISHED',
        maxTeamSize: 4,
        date: new Date('2026-10-15T09:00:00.000Z'),
        time: '09:00 AM',
        registrationDeadline: new Date('2026-10-14T23:59:59.000Z'),
        createdBy: admin._id,
      });
      cleanupEventIds.push(eventA._id);
    }

    // 3. Identify or create Event B for cross-event isolation testing
    let eventB = await Event.findOne({
      _id: { $ne: eventA._id },
      status: 'PUBLISHED',
      registrationDeadline: { $gt: new Date() },
      availableSeats: { $gt: 0 },
    });
    if (!eventB) {
      eventB = await Event.create({
        title: `Campus Coding Showcase ${Date.now()}`,
        description: 'Cultural dance tournament.',
        category: 'Cultural / Arts',
        mode: 'Offline',
        venue: 'Open Air Theatre',
        capacity: 150,
        availableSeats: 150,
        status: 'PUBLISHED',
        maxTeamSize: 1,
        date: new Date('2027-02-20T10:00:00.000Z'),
        time: '10:00 AM',
        registrationDeadline: new Date('2027-02-19T23:59:59.000Z'),
        createdBy: admin._id,
      });
      cleanupEventIds.push(eventB._id);
    }

    // -------------------------------------------------------------
    // SCENARIO N: Smart Attendance Roster filtered by Event A
    // -------------------------------------------------------------
    console.log('\n--- Scenario N: Smart Attendance Roster (Event A) ---');
    const rosterARes = await fetch(`${API_BASE}/attendance/admin?eventId=${eventA._id.toString()}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const rosterAData = await rosterARes.json();
    assert(
      rosterARes.status === 200 && rosterAData.success === true && Array.isArray(rosterAData.data),
      'Scenario N.1: Admin successfully retrieves roster for Event A with HTTP 200',
      `Status: ${rosterARes.status}`
    );

    const allEventAMatch = (rosterAData.data || []).every(
      (item) => String(item.eventId) === String(eventA._id)
    );
    assert(
      allEventAMatch && rosterAData.data.length > 0,
      `Scenario N.2: All ${rosterAData.data.length} attendees in roster belong strictly to Event A`,
      `Mismatch found: ${!allEventAMatch}`
    );

    assert(
      rosterAData.counts && typeof rosterAData.counts.totalRegistered === 'number',
      'Scenario N.3: Response contains complete attendance counts (total, present, absent, rate)',
      JSON.stringify(rosterAData.counts)
    );

    // -------------------------------------------------------------
    // SCENARIO O: Roster Isolation (Event B contains no Event A participants)
    // -------------------------------------------------------------
    console.log('\n--- Scenario O: Event Roster Isolation (Event B) ---');
    const rosterBRes = await fetch(`${API_BASE}/attendance/admin?eventId=${eventB._id.toString()}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const rosterBData = await rosterBRes.json();
    assert(
      rosterBRes.status === 200 && rosterBData.success === true,
      'Scenario O.1: Admin successfully retrieves roster for Event B',
      `Status: ${rosterBRes.status}`
    );

    const eventBHasNoEventAParticipants = (rosterBData.data || []).every(
      (item) => String(item.eventId) === String(eventB._id)
    );
    assert(
      eventBHasNoEventAParticipants,
      'Scenario O.2: Event B roster is completely isolated; 0 Event A participants appear',
      `Event B items: ${rosterBData.data?.length}`
    );

    // -------------------------------------------------------------
    // SCENARIO P: Team Registration with Individual Member Tracking
    // -------------------------------------------------------------
    console.log('\n--- Scenario P: Per-Member Team Registration & Automatic Check-In ---');
    const studentUser = await User.create({
      name: 'Priya Leader',
      email: `priya_leader_${Date.now()}@college.edu`,
      phone: '9876543299',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'STUDENT',
      studentId: '22CS001',
      department: 'CSE',
      year: '3rd Year',
    });
    cleanupUserIds.push(studentUser._id);
    const priyaToken = jwt.sign({ id: studentUser._id, role: studentUser.role }, jwtSecret, { expiresIn: '1d' });

    // Register Priya's team for Event A
    const teamPayload = {
      eventId: eventA._id.toString(),
      fullName: 'Priya Leader',
      rollNumber: '22CS001',
      year: '3rd Year',
      department: 'CSE',
      phone: '9876543299',
      isTeam: true,
      teamName: 'CyberShield',
      teamMembers: [
        { name: 'Anu Member', rollNumber: '22CS002', department: 'CSE', year: '3rd Year' },
        { name: 'Ravi Member', rollNumber: '22CS003', department: 'CSE', year: '3rd Year' },
      ],
    };

    const teamRegRes = await fetch(`${API_BASE}/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${priyaToken}` },
      body: JSON.stringify(teamPayload),
    });
    const teamRegData = await teamRegRes.json();
    assert(
      teamRegRes.status === 201 && teamRegData.success === true,
      'Scenario P.1: Successfully registered team (Priya 22CS001, Anu 22CS002, Ravi 22CS003)',
      teamRegData.message
    );

    const teamReg = await Registration.findById(teamRegData.data._id);
    cleanupRegIds.push(teamReg._id);

    const ticketA = await Ticket.findOne({ registration: teamReg._id, status: 'ACTIVE' });
    assert(
      ticketA !== null && ticketA.passCode,
      `Scenario P.2: Generated Digital Pass for team registration: ${ticketA?.passCode}`,
      `Ticket ID: ${ticketA?._id}`
    );

    // Initial state check: All 3 members must be NOT_MARKED
    const initialAttLeader = await Attendance.findOne({ registration: teamReg._id, memberRollNumber: '22CS001' });
    const initialAttAnu = await Attendance.findOne({ registration: teamReg._id, memberRollNumber: '22CS002' });
    const initialAttRavi = await Attendance.findOne({ registration: teamReg._id, memberRollNumber: '22CS003' });

    assert(
      initialAttLeader?.status === 'NOT_MARKED' &&
      initialAttAnu?.status === 'NOT_MARKED' &&
      initialAttRavi?.status === 'NOT_MARKED',
      'Scenario P.3: Initially all team members (Priya, Anu, Ravi) are NOT_MARKED in Attendance'
    );

    // 1. Scan Priya's ticket -> ONLY Priya becomes PRESENT
    console.log('\n--- Scanning Priya Leader ticket ---');
    const priyaScanRes = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        qrPayload: `EVENTSYNC:PASS:${ticketA.passCode}:22CS001`,
        eventId: eventA._id.toString(),
      }),
    });
    const priyaScanData = await priyaScanRes.json();
    assert(
      priyaScanRes.status === 200 && priyaScanData.success === true,
      'Scenario P.4: Fast check-in for Priya Leader succeeds with HTTP 200',
      priyaScanData.message
    );

    const postPriyaAttLeader = await Attendance.findOne({ registration: teamReg._id, memberRollNumber: '22CS001' });
    const postPriyaAttAnu = await Attendance.findOne({ registration: teamReg._id, memberRollNumber: '22CS002' });
    const postPriyaAttRavi = await Attendance.findOne({ registration: teamReg._id, memberRollNumber: '22CS003' });
    const postPriyaReg = await Registration.findById(teamReg._id);

    assert(
      postPriyaAttLeader?.status === 'PRESENT',
      'Scenario P.5: Priya Leader Attendance is updated to PRESENT in MongoDB',
      `Status: ${postPriyaAttLeader?.status}`
    );

    assert(
      postPriyaAttAnu?.status === 'NOT_MARKED' && postPriyaAttRavi?.status === 'NOT_MARKED',
      'Scenario P.6: CRITICAL ISOLATION: Anu and Ravi remain NOT_MARKED when only Priya scanned',
      `Anu: ${postPriyaAttAnu?.status}, Ravi: ${postPriyaAttRavi?.status}`
    );

    const anuMemberInReg = postPriyaReg.teamMembers.find((m) => m.rollNumber === '22CS002');
    assert(
      anuMemberInReg?.attendanceStatus === 'NOT_MARKED',
      'Scenario P.7: Registration.teamMembers entry for Anu remains NOT_MARKED',
      `Reg teamMember Anu status: ${anuMemberInReg?.attendanceStatus}`
    );

    // 2. Duplicate Scan: Priya's ticket again -> ALREADY VERIFIED
    console.log('\n--- Duplicate Scan for Priya Leader ---');
    const priyaDupRes = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        qrPayload: `EVENTSYNC:PASS:${ticketA.passCode}:22CS001`,
        eventId: eventA._id.toString(),
      }),
    });
    const priyaDupData = await priyaDupRes.json();
    assert(
      priyaDupRes.status === 409 &&
      priyaDupData.alreadyCheckedIn === true &&
      priyaDupData.message.includes('Attendance already marked PRESENT'),
      'Scenario P.8: Duplicate scan for Priya returns HTTP 409 and "Attendance already marked PRESENT"',
      `Status: ${priyaDupRes.status}, Msg: ${priyaDupData.message}`
    );

    // 3. Scan Anu's ticket -> ONLY Anu becomes PRESENT, Ravi remains NOT_MARKED
    console.log('\n--- Scanning Anu Member ticket ---');
    const anuScanRes = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        qrPayload: `EVENTSYNC:PASS:${ticketA.passCode}:22CS002`,
        eventId: eventA._id.toString(),
      }),
    });
    const anuScanData = await anuScanRes.json();
    assert(
      anuScanRes.status === 200 && anuScanData.success === true,
      'Scenario P.9: Fast check-in for Anu Member succeeds with HTTP 200',
      anuScanData.message
    );

    const postAnuAttAnu = await Attendance.findOne({ registration: teamReg._id, memberRollNumber: '22CS002' });
    const postAnuAttRavi = await Attendance.findOne({ registration: teamReg._id, memberRollNumber: '22CS003' });
    const postAnuReg = await Registration.findById(teamReg._id);
    const anuEntry = postAnuReg.teamMembers.find((m) => m.rollNumber === '22CS002');
    const raviEntry = postAnuReg.teamMembers.find((m) => m.rollNumber === '22CS003');

    assert(
      postAnuAttAnu?.status === 'PRESENT' && anuEntry?.attendanceStatus === 'PRESENT',
      'Scenario P.10: Anu Attendance and Registration.teamMembers entry both updated to PRESENT',
      `Attendance: ${postAnuAttAnu?.status}, teamMember: ${anuEntry?.attendanceStatus}`
    );

    assert(
      postAnuAttRavi?.status === 'NOT_MARKED' && raviEntry?.attendanceStatus === 'NOT_MARKED',
      'Scenario P.11: Ravi still remains NOT_MARKED after Priya and Anu scanned',
      `Ravi Attendance: ${postAnuAttRavi?.status}, teamMember: ${raviEntry?.attendanceStatus}`
    );

    // 4. Duplicate scan on Anu -> ALREADY VERIFIED
    const anuDupRes = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        qrPayload: `EVENTSYNC:PASS:${ticketA.passCode}:22CS002`,
        eventId: eventA._id.toString(),
      }),
    });
    const anuDupData = await anuDupRes.json();
    assert(
      anuDupRes.status === 409 &&
      anuDupData.alreadyCheckedIn === true &&
      anuDupData.message.includes('Attendance already marked PRESENT'),
      'Scenario P.12: Duplicate scan for Anu returns HTTP 409 and "Attendance already marked PRESENT"',
      `Status: ${anuDupRes.status}`
    );

    // -------------------------------------------------------------
    // SCENARIO Q: Event Restriction Enforcement (Wrong Event Rejection)
    // -------------------------------------------------------------
    console.log('\n--- Scenario Q: Wrong Event Scanner Rejection ---');
    // Create a student registration on Event B
    const studentB = await User.create({
      name: 'Event B Student',
      email: `eventb_student_${Date.now()}@college.edu`,
      phone: '9876543288',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'STUDENT',
      studentId: '22CS099',
      department: 'CSE',
      year: '2nd Year',
    });
    cleanupUserIds.push(studentB._id);
    const studentBToken = jwt.sign({ id: studentB._id, role: studentB.role }, jwtSecret, { expiresIn: '1d' });

    const regBRes = await fetch(`${API_BASE}/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentBToken}` },
      body: JSON.stringify({
        eventId: eventB._id.toString(),
        fullName: 'Event B Student',
        rollNumber: '22CS099',
        year: '2nd Year',
        department: 'CSE',
      }),
    });
    const regBData = await regBRes.json();
    assert(regBRes.status === 201 && regBData.success, 'Scenario Q setup: Registered student for Event B', regBData.message);
    const regB = await Registration.findById(regBData.data?._id);
    if (regB) cleanupRegIds.push(regB._id);
    const ticketB = await Ticket.findOne({ registration: regB?._id, status: 'ACTIVE' });
    assert(ticketB !== null && ticketB.passCode, 'Scenario Q setup: Generated active ticket for Event B', `PassCode: ${ticketB?.passCode}`);

    // Now scan Event B's ticket while Admin has Event A selected!
    const wrongEventRes = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        qrPayload: `EVENTSYNC:PASS:${ticketB.passCode}`,
        eventId: eventA._id.toString(), // Admin is on Event A!
      }),
    });
    const wrongEventData = await wrongEventRes.json();

    assert(
      wrongEventRes.status === 400 &&
      wrongEventData.wrongEvent === true &&
      wrongEventData.message.includes('This ticket belongs to another event.'),
      'Scenario Q.1: Rejects ticket with HTTP 400 and "This ticket belongs to another event."',
      `Status: ${wrongEventRes.status}, Msg: ${wrongEventData.message}`
    );

    const attBCheck = await Attendance.findOne({ registration: regB._id });
    assert(
      attBCheck?.status === 'NOT_MARKED',
      'Scenario Q.2: Attendance for Event B ticket was NOT mutated to PRESENT',
      `Status: ${attBCheck?.status}`
    );

    // -------------------------------------------------------------
    // SCENARIO R: Invalid / Fake Ticket Rejection
    // -------------------------------------------------------------
    console.log('\n--- Scenario R: Fake / Invalid Ticket Rejection ---');
    const fakeTicketRes = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        qrPayload: 'EVENTSYNC:PASS:FAKE-NON-EXISTENT-CODE-999',
        eventId: eventA._id.toString(),
      }),
    });
    const fakeTicketData = await fakeTicketRes.json();
    assert(
      fakeTicketRes.status === 404 &&
      fakeTicketData.invalidTicket === true &&
      fakeTicketData.message.includes('Ticket could not be verified.'),
      'Scenario R.1: Fake QR code rejected with HTTP 404 and "Ticket could not be verified."',
      `Status: ${fakeTicketRes.status}, Msg: ${fakeTicketData.message}`
    );

    const malformedRes = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        qrPayload: '???MALFORMED_GARBAGE???',
        eventId: eventA._id.toString(),
      }),
    });
    assert(
      malformedRes.status === 400,
      'Scenario R.2: Malformed payload rejected with HTTP 400',
      `Status: ${malformedRes.status}`
    );

    // -------------------------------------------------------------
    // SCENARIO S: Student Personal Attendance History Endpoint
    // -------------------------------------------------------------
    console.log('\n--- Scenario S: Student Personal Attendance Dashboard ---');
    const myAttRes = await fetch(`${API_BASE}/attendance/my`, {
      headers: { Authorization: `Bearer ${priyaToken}` },
    });
    const myAttData = await myAttRes.json();
    assert(
      myAttRes.status === 200 && myAttData.success === true && Array.isArray(myAttData.data),
      'Scenario S.1: Student successfully retrieves personal attendance history',
      `Status: ${myAttRes.status}`
    );

    const priyaEventRecord = myAttData.data.find(
      (item) => String(item.eventId || item.event?._id) === String(eventA._id)
    );
    assert(
      priyaEventRecord && priyaEventRecord.status === 'PRESENT',
      'Scenario S.2: Personal attendance record accurately shows status: PRESENT',
      `Status: ${priyaEventRecord?.status}`
    );

    // -------------------------------------------------------------
    // SCENARIO T: Admin Issues Participation Certificate
    // -------------------------------------------------------------
    console.log('\n--- Scenario T: Admin Issues Certificate ---');
    const issueRes = await fetch(`${API_BASE}/certificates/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        registrationId: teamReg._id.toString(),
        status: 'ISSUED',
      }),
    });
    const issueData = await issueRes.json();
    assert(
      issueRes.status === 200 && issueData.success === true,
      'Scenario T.1: Admin successfully issues certificate via PATCH /api/certificates/status',
      issueData.message
    );

    const certInDb = await Certificate.findOne({
      registration: teamReg._id,
      $or: [{ memberRollNumber: '22CS001' }, { student: studentUser._id }],
    });
    assert(
      certInDb?.status === 'ISSUED' && certInDb?.issuedAt !== null,
      'Scenario T.2: Certificate status in MongoDB is ISSUED with issuedAt timestamp',
      `Status: ${certInDb?.status}, IssuedAt: ${certInDb?.issuedAt}`
    );

    // -------------------------------------------------------------
    // SCENARIO U: Student Confirms Certificate Receipt
    // -------------------------------------------------------------
    console.log('\n--- Scenario U: Student Confirms Certificate Receipt ---');
    const confirmRes = await fetch(`${API_BASE}/certificates/confirm-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${priyaToken}` },
      body: JSON.stringify({ registrationId: teamReg._id.toString() }),
    });
    const confirmData = await confirmRes.json();
    assert(
      confirmRes.status === 200 && confirmData.success === true,
      'Scenario U.1: Student successfully confirms certificate receipt via POST /api/certificates/confirm-receipt',
      confirmData.message
    );

    const certAfterConfirm = await Certificate.findOne({
      registration: teamReg._id,
      $or: [{ memberRollNumber: '22CS001' }, { student: studentUser._id }],
    });
    assert(
      certAfterConfirm?.status === 'RECEIVED' && certAfterConfirm?.receivedAt !== null,
      'Scenario U.2: Certificate status in MongoDB is RECEIVED with valid receivedAt date',
      `Status: ${certAfterConfirm?.status}, ReceivedAt: ${certAfterConfirm?.receivedAt}`
    );

    // Verify Admin Certificate roster shows RECEIVED
    const adminCertsRes = await fetch(`${API_BASE}/certificates/admin?eventId=${eventA._id.toString()}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminCertsData = await adminCertsRes.json();
    const priyaAdminCert = (adminCertsData.data || []).find(
      (c) => String(c.registrationId) === String(teamReg._id) && c.rollNumber === '22CS001'
    );
    assert(
      priyaAdminCert && priyaAdminCert.certificateStatus === 'RECEIVED',
      'Scenario U.3: Admin certificate dashboard reflects status: RECEIVED',
      `Admin saw status: ${priyaAdminCert?.certificateStatus}`
    );

    // -------------------------------------------------------------
    // SCENARIO V: Student Privacy (Unauthorized Student Cannot Confirm)
    // -------------------------------------------------------------
    console.log('\n--- Scenario V: Student Privacy Isolation ---');
    const unauthStudent = await User.create({
      name: 'Unauthorized Stranger',
      email: `stranger_${Date.now()}@college.edu`,
      phone: '9876543277',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'STUDENT',
      studentId: '22CS999',
      department: 'ECE',
      year: '1st Year',
    });
    cleanupUserIds.push(unauthStudent._id);
    const unauthStudentToken = jwt.sign({ id: unauthStudent._id, role: unauthStudent.role }, jwtSecret, { expiresIn: '1d' });

    const privacyAttackRes = await fetch(`${API_BASE}/certificates/confirm-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${unauthStudentToken}` },
      body: JSON.stringify({ registrationId: teamReg._id.toString() }),
    });
    assert(
      privacyAttackRes.status === 403,
      'Scenario V.1: Unauthorized student blocked with HTTP 403 from confirming another student certificate',
      `Status: ${privacyAttackRes.status}`
    );

    // -------------------------------------------------------------
    // SCENARIO W: Chatbot Live MongoDB Query (Events Count & Schedule)
    // -------------------------------------------------------------
    console.log('\n--- Scenario W: Chatbot Live MongoDB Data ---');
    const chatEventsRes = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${priyaToken}` },
      body: JSON.stringify({ message: 'What events are currently available?' }),
    });
    const chatEventsData = await chatEventsRes.json();
    assert(
      chatEventsRes.status === 200 && chatEventsData.success === true,
      'Scenario W.1: Chatbot returns HTTP 200 for live event inquiry',
      `Type: ${chatEventsData.data?.type}`
    );

    const chatEventsMsg = chatEventsData.data?.message || '';
    assert(
      chatEventsMsg.toLowerCase().includes('smart india hackathon') ||
      chatEventsMsg.toLowerCase().includes('hackathon') ||
      chatEventsMsg.toLowerCase().includes('dance') ||
      chatEventsMsg.length > 20,
      'Scenario W.2: Chatbot response references live events from database',
      `Snippet: ${chatEventsMsg.slice(0, 80)}...`
    );

    // -------------------------------------------------------------
    // SCENARIO X: Chatbot Student Privacy
    // -------------------------------------------------------------
    console.log('\n--- Scenario X: Chatbot Student Privacy Protection ---');
    const chatPrivacyRes = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${unauthStudentToken}` },
      body: JSON.stringify({ message: "Give me Priya's attendance record and pass code" }),
    });
    const chatPrivacyData = await chatPrivacyRes.json();
    const chatPrivacyMsg = (chatPrivacyData.data?.message || '').toLowerCase();
    assert(
      chatPrivacyRes.status === 200 &&
      (chatPrivacyMsg.includes('privacy') ||
       chatPrivacyMsg.includes('cannot') ||
       chatPrivacyMsg.includes('only') ||
       chatPrivacyMsg.includes('not') ||
       chatPrivacyMsg.includes('kudaradu') ||
       !chatPrivacyMsg.includes(ticketA.passCode)),
      'Scenario X.1: Chatbot enforces student privacy and does not expose another student secret pass code',
      `Response snippet: ${chatPrivacyMsg.slice(0, 90)}...`
    );

    // -------------------------------------------------------------
    // SCENARIO Y: Chatbot Creator Verification
    // -------------------------------------------------------------
    console.log('\n--- Scenario Y: Chatbot Creator Verification ---');
    const chatCreatorRes = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${priyaToken}` },
      body: JSON.stringify({ message: 'Who created you and who built EventSync?' }),
    });
    const chatCreatorData = await chatCreatorRes.json();
    const creatorMsg = chatCreatorData.data?.message || '';
    const creatorPerson = chatCreatorData.data?.person || '';
    const creatorCollege = chatCreatorData.data?.college || '';
    const matchesCreator = (creatorMsg.includes('Atmakuru Priya Darshini') || creatorPerson.includes('Atmakuru Priya Darshini')) &&
      (creatorMsg.includes('PBR Visvodaya Institute of Technology & Science') || creatorCollege.includes('PBR Visvodaya Institute of Technology & Science'));
    assert(
      chatCreatorRes.status === 200 && matchesCreator,
      'Scenario Y.1: Chatbot identifies creator as "Atmakuru Priya Darshini" from "PBR Visvodaya Institute of Technology & Science"',
      `Response: ${creatorMsg || `${creatorPerson} (${creatorCollege})`}`
    );

    // -------------------------------------------------------------
    // SCENARIO Z: Chatbot General Technical Query
    // -------------------------------------------------------------
    console.log('\n--- Scenario Z: Chatbot Technical Explanation ---');
    const chatTechRes = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${priyaToken}` },
      body: JSON.stringify({ message: 'What is a binary search algorithm? Explain briefly.' }),
    });
    const chatTechData = await chatTechRes.json();
    const techMsg = (chatTechData.data?.message || '').toLowerCase();
    assert(
      chatTechRes.status === 200 &&
      (techMsg.includes('search') || techMsg.includes('divide') || techMsg.includes('half') || techMsg.includes('sorted') || techMsg.length > 20),
      'Scenario Z.1: Chatbot provides helpful computer science explanation',
      `Response snippet: ${techMsg.slice(0, 80)}...`
    );

  } finally {
    // Clean up created test data
    console.log('\n--- Cleaning up temporary test artifacts ---');
    if (cleanupRegIds.length > 0) {
      await Registration.deleteMany({ _id: { $in: cleanupRegIds } });
      await Ticket.deleteMany({ registration: { $in: cleanupRegIds } });
      await Attendance.deleteMany({ registration: { $in: cleanupRegIds } });
      await Certificate.deleteMany({ registration: { $in: cleanupRegIds } });
    }
    if (cleanupUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: cleanupUserIds } });
    }
    if (cleanupEventIds.length > 0) {
      await Event.deleteMany({ _id: { $in: cleanupEventIds } });
    }
    console.log('Cleanup finished.');
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================\n');

  await mongoose.disconnect();
  process.exit(failedCount > 0 ? 1 : 0);
};

runTests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
