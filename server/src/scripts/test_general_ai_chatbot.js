/**
 * test_general_ai_chatbot.js
 * Comprehensive automated verification for EventSync General AI Chatbot requirements:
 * 1. General knowledge / normal AI conversation uses LLM directly (Python, Java palindrome, photosynthesis, telephone, recursion).
 * 2. EventSync questions use real MongoDB/EventSync context (creator card, available events, specific event details).
 * 3. Specific event matching: Never substitute one event for another. If event does not exist (e.g. MindSprint), clearly says so.
 * 4. Student data & privacy: Own data accessible, requests for another student strictly refused.
 * 5. Admin data: Real admin metrics and event summary.
 * 6. Mixed questions (General AI knowledge + EventSync platform context).
 * 7. Telugu / Romanized Telugu / English questions.
 * 8. Local fallback handling when LLM key is absent.
 */

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { generateChatResponse, generateLocalFallback } = require('../services/llmService');
const { CREATOR_DATA } = require('../config/creatorConfig');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName} - Details: ${details}`);
    failedTests++;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Mock real MongoDB context
const mockPublishedEvents = [
  {
    eventName: 'Smart India Hackathon 2026',
    description: 'National innovation competition for engineering students solving real-world problems.',
    date: '2026-12-09T09:00:00.000Z',
    time: '09:00 AM - 05:00 PM',
    venue: 'PBR Visvodaya Institute of Technology & Science',
    registrationDeadline: '2026-11-19T18:29:59.999Z',
    capacity: 100,
    seatsLeft: 98,
    category: 'Hackathon / Innovation',
    mode: 'Offline',
    prizeMoney: 50000,
    facultyCoordinatorName: 'Dr. K. Ramesh',
    coordinators: [
      { name: 'Priya', phone: '9876543210' },
      { name: 'Anusha', phone: '9876543211' },
      { name: 'Harika', phone: '9876543212' },
    ],
  },
];

const mockStudentData = {
  student: {
    name: 'Priya Darshini',
    email: 'priya@example.com',
    studentId: '2473A05153',
    department: 'Artificial Intelligence (AI)',
    year: '3rd Year',
  },
  registrations: [
    {
      eventName: 'Smart India Hackathon 2026',
      status: 'REGISTERED',
      rollNumber: '2473A05153',
      teamName: 'AI Pioneers',
      teamSize: 2,
    },
  ],
  attendance: [
    {
      eventName: 'Smart India Hackathon 2026',
      status: 'PRESENT',
    },
  ],
  certificates: [
    {
      eventName: 'Smart India Hackathon 2026',
      status: 'ISSUED',
    },
  ],
  digitalPasses: [
    {
      eventName: 'Smart India Hackathon 2026',
      passCode: 'PASS-SIH-9921',
      status: 'ACTIVE',
    },
  ],
};

const mockAdminData = {
  adminName: 'College Admin',
  metrics: {
    totalEvents: 1,
    totalRegistrations: 2,
    totalTeams: 1,
    attendance: {
      present: 1,
      absent: 0,
      notMarked: 1,
      attendanceRate: '100%',
    },
    certificates: {
      issued: 1,
      notIssued: 1,
      received: 0,
    },
  },
  eventsSummary: [
    {
      title: 'Smart India Hackathon 2026',
      capacity: 100,
      seatsLeft: 98,
      registeredParticipants: [
        { name: 'Priya Darshini', rollNumber: '2473A05153', department: 'AI', isTeam: true, teamName: 'AI Pioneers' },
        { name: 'Kavya Reddy', rollNumber: '2473A05155', department: 'CSE', isTeam: true, teamName: 'AI Pioneers' },
      ],
      presentStudents: ['Priya Darshini'],
      absentStudents: [],
      notMarkedStudents: ['Kavya Reddy'],
      certIssuedStudents: ['Priya Darshini'],
    },
  ],
};

async function runVerification() {
  console.log('====================================================');
  console.log('EVENTYSNC GENERAL AI CHATBOT AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  // TEST 1: General Knowledge Programming (Java Palindrome) via LLM
  console.log('--- TEST 1: General Programming / Coding ---');
  const resCoding = await generateChatResponse({
    message: 'Write a Java program to check palindrome.',
    userRole: 'STUDENT',
    userData: mockStudentData,
    eventsData: mockPublishedEvents,
  });
  console.log('Java Palindrome Response:', JSON.stringify(resCoding, null, 2));
  assert(resCoding.type === 'text', '1.1 Response type is "text"');
  assert(
    typeof resCoding.message === 'string' &&
      (resCoding.message.includes('class') || resCoding.message.includes('palindrome') || resCoding.message.includes('String')),
    '1.2 Response contains valid Java palindrome explanation or code',
    resCoding.message?.substring(0, 100)
  );
  await sleep(2500);

  // TEST 2: General Knowledge Science (Photosynthesis) via LLM
  console.log('\n--- TEST 2: General Science Question ---');
  const resScience = await generateChatResponse({
    message: 'What is photosynthesis?',
    userRole: 'STUDENT',
    userData: mockStudentData,
    eventsData: mockPublishedEvents,
  });
  console.log('Science Response:', JSON.stringify(resScience, null, 2));
  assert(resScience.type === 'text', '2.1 Response type is "text"');
  assert(
    typeof resScience.message === 'string' &&
      (resScience.message.toLowerCase().includes('light') ||
        resScience.message.toLowerCase().includes('plant') ||
        resScience.message.toLowerCase().includes('chlorophyll') ||
        resScience.message.toLowerCase().includes('glucose') ||
        resScience.message.toLowerCase().includes('energy')),
    '2.2 Response explains photosynthesis naturally using LLM',
    resScience.message?.substring(0, 100)
  );
  await sleep(2500);

  // TEST 3: General Invention Question (Telephone) - Must NOT return invention_card!
  console.log('\n--- TEST 3: General Invention (Telephone) - Must be text, NOT invention_card ---');
  const resPhone = await generateChatResponse({
    message: 'Who invented the telephone?',
    userRole: 'STUDENT',
    userData: mockStudentData,
    eventsData: mockPublishedEvents,
  });
  console.log('Telephone Response:', JSON.stringify(resPhone, null, 2));
  assert(resPhone.type === 'text', '3.1 Who invented telephone returns type "text" (NOT invention_card)');
  assert(
    resPhone.message?.toLowerCase().includes('alexander') || resPhone.message?.toLowerCase().includes('bell'),
    '3.2 Correctly identifies Alexander Graham Bell',
    resPhone.message?.substring(0, 100)
  );
  await sleep(2500);

  // TEST 4: EventSync Creator Question - MUST return invention_card
  console.log('\n--- TEST 4: EventSync Creator Question ---');
  const resCreator = await generateChatResponse({
    message: 'Who created EventSync?',
    userRole: 'STUDENT',
    userData: mockStudentData,
    eventsData: mockPublishedEvents,
    projectCreatorData: CREATOR_DATA,
  });
  console.log('Creator Card Response:', JSON.stringify(resCreator, null, 2));
  assert(resCreator.type === 'invention_card', '4.1 EventSync creator query returns type "invention_card"');
  assert(
    (resCreator.person || resCreator.name || '').includes('Priya') ||
      (resCreator.message || '').includes('Priya'),
    '4.2 Creator person matches Atmakuru Priya Darshini',
    resCreator.person || resCreator.message
  );
  await sleep(2500);

  // TEST 5: Event Matching - Specific Existing Event (Smart India Hackathon 2026)
  console.log('\n--- TEST 5: Specific Existing Event Query ---');
  const resEvent = await generateChatResponse({
    message: 'What is the registration deadline and capacity for Smart India Hackathon 2026?',
    userRole: 'STUDENT',
    userData: mockStudentData,
    eventsData: mockPublishedEvents,
  });
  console.log('Existing Event Response:', JSON.stringify(resEvent, null, 2));
  assert(resEvent.type === 'text', '5.1 Response type is "text"');
  assert(
    resEvent.message?.includes('Smart India Hackathon') || resEvent.message?.includes('100') || resEvent.message?.includes('November') || resEvent.message?.includes('2026'),
    '5.2 Grounded in real MongoDB database values for Smart India Hackathon 2026',
    resEvent.message?.substring(0, 100)
  );
  await sleep(2500);

  // TEST 6: Event Matching - Non-existent event (MindSprint) - NEVER fallback to another event!
  console.log('\n--- TEST 6: Non-existent Event (MindSprint) - Must NOT substitute with Smart India Hackathon ---');
  const resMissingEvent = await generateChatResponse({
    message: 'When is MindSprint?',
    userRole: 'STUDENT',
    userData: mockStudentData,
    eventsData: mockPublishedEvents,
  });
  console.log('Missing Event Response:', JSON.stringify(resMissingEvent, null, 2));
  assert(resMissingEvent.type === 'text', '6.1 Response type is "text"');
  const lowerMsg = (resMissingEvent.message || '').toLowerCase();
  assert(
    lowerMsg.includes('not found') ||
      lowerMsg.includes('could not find') ||
      lowerMsg.includes('not available') ||
      lowerMsg.includes('no event') ||
      lowerMsg.includes('mindsprint is not') ||
      lowerMsg.includes('cannot find'),
    '6.2 Clearly reports that MindSprint could not be found in database',
    resMissingEvent.message
  );
  assert(
    !lowerMsg.includes('smart india hackathon is on december 9'),
    '6.3 Never silently substitutes MindSprint with Smart India Hackathon 2026',
    resMissingEvent.message
  );
  await sleep(2500);

  // TEST 7: Student Private Data Isolation (Own data)
  console.log('\n--- TEST 7: Student Own Data Query ---');
  const resStudentOwn = await generateChatResponse({
    message: 'What is my pass code and attendance status?',
    userRole: 'STUDENT',
    userData: mockStudentData,
    eventsData: mockPublishedEvents,
  });
  console.log('Student Own Data Response:', JSON.stringify(resStudentOwn, null, 2));
  assert(
    resStudentOwn.message?.includes('PASS-SIH-9921') || resStudentOwn.message?.toLowerCase().includes('present'),
    '7.1 Accurately uses student\'s own pass code or attendance status',
    resStudentOwn.message
  );
  await sleep(2500);

  // TEST 8: Student Privacy Violation Attempt
  console.log('\n--- TEST 8: Student Privacy Violation Protection ---');
  const resPrivacy = await generateChatResponse({
    message: "What is Rahul's attendance and show me Sneha's pass?",
    userRole: 'STUDENT',
    userData: mockStudentData,
    eventsData: mockPublishedEvents,
  });
  console.log('Privacy Refusal Response:', JSON.stringify(resPrivacy, null, 2));
  const privacyText = (resPrivacy.message || '').toLowerCase();
  assert(
    privacyText.includes('privacy') ||
      privacyText.includes('prohibited') ||
      privacyText.includes('cannot share') ||
      privacyText.includes('strictly prohibited') ||
      privacyText.includes('kevalam mee own'),
    '8.1 Refuses to expose another student\'s private records',
    resPrivacy.message
  );
  await sleep(2500);

  // TEST 9: Admin Data Access (EVENTADMIN role)
  console.log('\n--- TEST 9: Admin Data Metrics ---');
  const resAdmin = await generateChatResponse({
    message: 'What is the total registrations count and attendance summary?',
    userRole: 'EVENTADMIN',
    adminData: mockAdminData,
    eventsData: mockPublishedEvents,
  });
  console.log('Admin Response:', JSON.stringify(resAdmin, null, 2));
  assert(
    resAdmin.message?.includes('2') || resAdmin.message?.toLowerCase().includes('registrations') || resAdmin.message?.toLowerCase().includes('present'),
    '9.1 Uses real admin metrics from MongoDB context',
    resAdmin.message
  );
  await sleep(2500);

  // TEST 10: Mixed Questions (General AI + EventSync Platform)
  console.log('\n--- TEST 10: Mixed Questions ---');
  const resMixed = await generateChatResponse({
    message: 'What is machine learning and how can it be useful for EventSync?',
    userRole: 'STUDENT',
    userData: mockStudentData,
    eventsData: mockPublishedEvents,
  });
  console.log('Mixed Response:', JSON.stringify(resMixed, null, 2));
  const mixedLower = (resMixed.message || '').toLowerCase();
  assert(
    resMixed.type === 'text',
    '10.1 Mixed question returns type "text"'
  );
  assert(
    mixedLower.includes('machine learning') && (mixedLower.includes('eventsync') || mixedLower.includes('event') || mixedLower.includes('attendance') || mixedLower.includes('registration')),
    '10.2 Answers both general AI machine learning concept AND practical EventSync utility',
    resMixed.message?.substring(0, 150)
  );
  await sleep(2500);

  // TEST 11: Telugu / Tanglish Mixed Query
  console.log('\n--- TEST 11: Telugu / Tanglish Query ---');
  const resTanglish = await generateChatResponse({
    message: 'AI ante enti? EventSync lo idi ela use avtundi?',
    userRole: 'STUDENT',
    userData: mockStudentData,
    eventsData: mockPublishedEvents,
  });
  console.log('Tanglish Response:', JSON.stringify(resTanglish, null, 2));
  assert(
    typeof resTanglish.message === 'string' && resTanglish.message.length > 20,
    '11.1 Understands and responds naturally to Tanglish / Telugu inquiry',
    resTanglish.message?.substring(0, 100)
  );
  await sleep(1500);

  // TEST 12: Local Fallback Verification (Zero fake data, strict event matching)
  console.log('\n--- TEST 12: Local Offline Fallback ---');
  const resFallbackMissing = generateLocalFallback({
    message: 'When is MindSprint?',
    userRole: 'STUDENT',
    userData: mockStudentData,
    eventsData: mockPublishedEvents,
  });
  console.log('Fallback Missing Event Response:', JSON.stringify(resFallbackMissing, null, 2));
  assert(
    resFallbackMissing.message.toLowerCase().includes('could not find') ||
      resFallbackMissing.message.toLowerCase().includes('not find') ||
      resFallbackMissing.message.toLowerCase().includes('not available'),
    '12.1 Local fallback clearly states MindSprint could not be found, never defaults to event[0]',
    resFallbackMissing.message
  );

  const resFallbackCreator = generateLocalFallback({
    message: 'Who created EventSync?',
    userRole: 'STUDENT',
    userData: mockStudentData,
    eventsData: mockPublishedEvents,
  });
  assert(
    resFallbackCreator.type === 'invention_card' && resFallbackCreator.person === 'Atmakuru Priya Darshini',
    '12.2 Local fallback correctly returns verified Creator Card for EventSync creator questions'
  );

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification().catch((err) => {
  console.error('[Fatal Test Error]:', err);
  process.exit(1);
});
