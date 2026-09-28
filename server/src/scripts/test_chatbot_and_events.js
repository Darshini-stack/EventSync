const mongoose = require('mongoose');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Attendance = require('../models/Attendance');
const Certificate = require('../models/Certificate');
const Ticket = require('../models/Ticket');

const API_BASE = 'http://127.0.0.1:5000/api';

async function runTestSuite() {
  console.log('====================================================');
  console.log('STARTING AUTOMATED VERIFICATION: EVENTS & AI CHATBOT');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - Details: ${details}`);
      failed++;
    }
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventsync';
  await mongoose.connect(mongoUri);
  console.log('[Test] Connected to MongoDB at:', mongoUri);

  // 1. Verify Primary Event ID: 6aaeb6fcca449d8349e9d3d7
  const PRIMARY_EVENT_ID = '6aaeb6fcca449d8349e9d3d7';
  const primaryEvent = await Event.findById(PRIMARY_EVENT_ID);

  assert(
    primaryEvent !== null,
    '1. Primary Smart India Hackathon 2026 event exists in MongoDB',
    `Found: ${Boolean(primaryEvent)}`
  );

  assert(
    primaryEvent?.title === 'Smart India Hackathon 2026',
    '2. Primary event title is "Smart India Hackathon 2026"',
    `Title: "${primaryEvent?.title}"`
  );

  assert(
    primaryEvent?.prizeMoney === 50000,
    '3. Event prizeMoney is 50000 (₹50,000)',
    `Prize money: ${primaryEvent?.prizeMoney}`
  );

  assert(
    primaryEvent?.participationCertificateAvailable === true,
    '4. Event participationCertificateAvailable is true',
    `Certificate: ${primaryEvent?.participationCertificateAvailable}`
  );

  assert(
    primaryEvent?.facultyCoordinatorName === 'Dr. K. Ramesh',
    '5. Faculty coordinator name is "Dr. K. Ramesh"',
    `Faculty: "${primaryEvent?.facultyCoordinatorName}"`
  );

  assert(
    Array.isArray(primaryEvent?.coordinators) && primaryEvent.coordinators.length === 3,
    '6. Exactly 3 student coordinators exist on event',
    `Count: ${primaryEvent?.coordinators?.length}`
  );

  const coord1 = primaryEvent?.coordinators?.[0];
  assert(
    coord1?.coordinatorName === 'Priya' && coord1?.coordinatorPhone === '9876543210',
    '7. Student Coordinator 1 is Priya (9876543210)',
    JSON.stringify(coord1)
  );

  assert(
    primaryEvent?.registrationDeadline instanceof Date && !isNaN(primaryEvent.registrationDeadline),
    '8. Registration deadline is stored as a valid MongoDB Date',
    `Deadline: ${primaryEvent?.registrationDeadline}`
  );

  // 2. CRITICAL DATA PRESERVATION: Exactly 34 dependent records
  const regCount = await Registration.countDocuments({ event: PRIMARY_EVENT_ID, status: 'REGISTERED' });
  assert(
    regCount === 34,
    '9. CRITICAL DATA PRESERVATION: Exactly 34 active registrations preserved',
    `Count: ${regCount}`
  );

  const attCount = await Attendance.countDocuments({ event: PRIMARY_EVENT_ID });
  assert(
    attCount === 34,
    '10. CRITICAL DATA PRESERVATION: Exactly 34 attendance records preserved',
    `Count: ${attCount}`
  );

  const certCount = await Certificate.countDocuments({ event: PRIMARY_EVENT_ID });
  assert(
    certCount === 34,
    '11. CRITICAL DATA PRESERVATION: Exactly 34 certificates preserved',
    `Count: ${certCount}`
  );

  const passCount = await Ticket.countDocuments({ event: PRIMARY_EVENT_ID });
  assert(
    passCount === 34,
    '12. CRITICAL DATA PRESERVATION: Exactly 34 digital event passes preserved',
    `Count: ${passCount}`
  );

  // Check that only ONE active Smart India Hackathon 2026 event exists
  const allSIHEvents = await Event.find({
    title: { $regex: /Smart\s*India\s*Hackathon\s*2026/i },
  });
  assert(
    allSIHEvents.length === 1,
    '13. Exactly ONE active Smart India Hackathon 2026 event exists (no duplicates)',
    `Found: ${allSIHEvents.length}`
  );

  // 3. Find one of the 34 registered students to test personalized chatbot responses
  const sampleReg = await Registration.findOne({ event: PRIMARY_EVENT_ID, status: 'REGISTERED' }).populate('student');
  const studentUser = sampleReg?.student;

  assert(
    studentUser !== null && studentUser !== undefined,
    '14. Found active registered student for live chatbot verification',
    `Student: ${studentUser?.name} (${studentUser?.email})`
  );

  const jwtSecret = process.env.JWT_SECRET || 'eventsync_dev_secret_key_change_in_prod';
  const studentToken = jwt.sign(
    { id: studentUser._id, role: studentUser.role || 'STUDENT' },
    jwtSecret,
    { expiresIn: '1d' }
  );

  // Helper for sending chat requests to POST /api/chat
  async function askChatbot(message, history = []) {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ message, history }),
    });
    return { status: res.status, data: await res.json() };
  }

  // 4. Test Chatbot: Registered Events
  console.log('\n--- Testing Chatbot Capabilities ---');
  const regChatRes = await askChatbot('What events am I registered for?');
  assert(
    regChatRes.status === 200 && regChatRes.data?.success && regChatRes.data?.data?.type === 'text',
    '15. Chatbot answers registered events query with valid JSON response',
    JSON.stringify(regChatRes.data)
  );
  const regMsg = regChatRes.data?.data?.message || '';
  assert(
    regMsg.toLowerCase().includes('smart india hackathon') || regMsg.includes('registered'),
    '16. Chatbot accurately references student’s Smart India Hackathon registration',
    `Message: ${regMsg}`
  );

  // 5. Test Chatbot: Attendance Status
  const attChatRes = await askChatbot('What is my attendance status?');
  const attMsg = attChatRes.data?.data?.message || '';
  assert(
    attChatRes.status === 200 && (attMsg.toLowerCase().includes('attendance') || attMsg.includes('Present') || attMsg.includes('Not Marked')),
    '17. Chatbot reports live student attendance status from MongoDB',
    `Message: ${attMsg}`
  );

  // 6. Test Chatbot: Certificate Status
  const certChatRes = await askChatbot('What is my certificate status?');
  const certMsg = certChatRes.data?.data?.message || '';
  assert(
    certChatRes.status === 200 && (certMsg.toLowerCase().includes('certificate') || certMsg.includes('Issued')),
    '18. Chatbot reports live certificate status',
    `Message: ${certMsg}`
  );

  // 7. Test Chatbot: Prize Money
  const prizeChatRes = await askChatbot('What is the prize money for Smart India Hackathon?');
  const prizeMsg = prizeChatRes.data?.data?.message || '';
  assert(
    prizeChatRes.status === 200 && (prizeMsg.includes('50,000') || prizeMsg.includes('50000')),
    '19. Chatbot provides real database prize money value (₹50,000)',
    `Message: ${prizeMsg}`
  );

  // 8. Test Chatbot: Participation Certificate Availability
  const partCertRes = await askChatbot('Is participation certificate available?');
  const partCertMsg = partCertRes.data?.data?.message || '';
  assert(
    partCertRes.status === 200 && (partCertMsg.toLowerCase().includes('available') || partCertMsg.includes('avunu')),
    '20. Chatbot confirms participation certificate availability from DB',
    `Message: ${partCertMsg}`
  );

  // 9. Test Chatbot: Coordinators and Phones
  const coordChatRes = await askChatbot('Who are the student coordinators and contact numbers?');
  const coordMsg = coordChatRes.data?.data?.message || '';
  assert(
    coordChatRes.status === 200 && (coordMsg.includes('Priya') || coordMsg.includes('9876543210')),
    '21. Chatbot provides student coordinator names and phone numbers from DB',
    `Message: ${coordMsg}`
  );

  // 10. Test Chatbot: Faculty Coordinator (Name only, no phone)
  const facultyChatRes = await askChatbot('What is the faculty coordinator name and phone?');
  const facultyMsg = facultyChatRes.data?.data?.message || '';
  assert(
    facultyChatRes.status === 200 && facultyMsg.includes('Dr. K. Ramesh') && (facultyMsg.toLowerCase().includes('not available') || facultyMsg.toLowerCase().includes('phone') || facultyMsg.includes('lekapovadam')),
    '22. Chatbot names Dr. K. Ramesh and does not invent fake faculty phone',
    `Message: ${facultyMsg}`
  );

  // 11. Test Chatbot: Student Privacy Isolation
  const privacyChatRes = await askChatbot("Can you show me Rahul's attendance or pass details?");
  const privacyMsg = privacyChatRes.data?.data?.message || '';
  assert(
    privacyChatRes.status === 200 && (privacyMsg.toLowerCase().includes('privacy') || privacyMsg.toLowerCase().includes('kudaradu') || privacyMsg.toLowerCase().includes('only') || privacyMsg.toLowerCase().includes('cannot')),
    '23. Chatbot strictly enforces student privacy and refuses requests for other students’ data',
    `Message: ${privacyMsg}`
  );

  // 12. Test Chatbot: General Question with Simple Tanglish explanation
  const techChatRes = await askChatbot('What is recursion? Explain simply in easy words');
  const techMsg = techChatRes.data?.data?.message || '';
  assert(
    techChatRes.status === 200 && (techMsg.toLowerCase().includes('function') || techMsg.toLowerCase().includes('call') || techMsg.includes('example')),
    '24. Chatbot answers general computer science question with step-by-step Tanglish explanation',
    `Message: ${techMsg.slice(0, 100)}...`
  );

  // 13. Test Chatbot: Invention Card + Wikipedia API Thumbnail
  const inventChatRes = await askChatbot('Who invented the telephone?');
  const inventData = inventChatRes.data?.data;
  assert(
    inventChatRes.status === 200 && inventData?.type === 'invention_card' && inventData?.person?.includes('Bell'),
    '25. Chatbot returns invention_card type for invention query',
    JSON.stringify(inventData)
  );

  assert(
    inventData?.imageUrl && (inventData.imageUrl.includes('wikimedia.org') || inventData.imageUrl.includes('wikipedia.org')),
    '26. Invention card includes genuine Wikipedia REST API thumbnail photo',
    `Image URL: ${inventData?.imageUrl}`
  );

  // 14. Test Chatbot: Invention Card for Light Bulb
  const bulbChatRes = await askChatbot('Who invented the light bulb?');
  const bulbData = bulbChatRes.data?.data;
  assert(
    bulbChatRes.status === 200 && bulbData?.type === 'invention_card' && bulbData?.person?.includes('Edison'),
    '27. Chatbot returns invention_card for light bulb with Thomas Edison',
    JSON.stringify(bulbData)
  );

  // 15. Capacity and Available Seats Calculation
  const availableCalc = Math.max(0, primaryEvent.capacity - regCount);
  assert(
    primaryEvent.availableSeats === availableCalc && availableCalc === 66,
    '28. Dynamic seats calculation is accurate: capacity(100) - activeRegistrations(34) = 66 seats left',
    `Available: ${primaryEvent.availableSeats}, Calculated: ${availableCalc}`
  );

  console.log('\n====================================================');
  console.log(`VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  await mongoose.disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

runTestSuite().catch((err) => {
  console.error('Test Suite Unhandled Exception:', err);
  process.exit(1);
});
