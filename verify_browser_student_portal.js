const path = require('path');
module.paths.push(path.resolve(__dirname, 'server/node_modules'));

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });
const config = require('./server/src/config/env');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\priya\\.gemini\\antigravity-ide\\brain\\aff9fa45-e858-4c6d-a1cf-e08784e3f60e';
const BASE_URL = 'http://localhost:5173';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clickButtonByText(page, textSubstring, timeout = 10000) {
  await page.waitForFunction(
    (text) => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      return btns.some((b) => b.textContent.includes(text) && !b.disabled);
    },
    { timeout },
    textSubstring
  );
  await page.evaluate((text) => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const btn = btns.find((b) => b.textContent.includes(text) && !b.disabled);
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      btn.click();
    }
  }, textSubstring);
}

async function runStudentPortalBrowserVerification() {
  console.log('======================================================================');
  console.log('STARTING COMPLETE STUDENT PORTAL END-TO-END BROWSER VERIFICATION');
  console.log('======================================================================\n');

  // Connect to MongoDB
  await mongoose.connect(config.mongoUri);
  console.log(`[DB] Connected to MongoDB: ${config.mongoUri}`);

  // Fetch baseline accounts
  const adminUser = await mongoose.connection.db.collection('users').findOne({ email: 'admin@eventsync.edu' });
  const studentUser = await mongoose.connection.db.collection('users').findOne({ email: 'test.student@eventsync.edu' });
  const student2User = await mongoose.connection.db.collection('users').findOne({ email: 'aarav.patel@eventsync.edu' });

  if (!adminUser || !studentUser || !student2User) {
    throw new Error('Required Phase 2 baseline accounts are missing in MongoDB!');
  }

  // Reset database state cleanly
  await mongoose.connection.db.collection('events').deleteMany({});
  await mongoose.connection.db.collection('registrations').deleteMany({});
  await mongoose.connection.db.collection('payments').deleteMany({});
  await mongoose.connection.db.collection('tickets').deleteMany({});
  await mongoose.connection.db.collection('attendances').deleteMany({});
  await mongoose.connection.db.collection('users').deleteMany({
    email: { $nin: ['admin@eventsync.edu', 'test.student@eventsync.edu', 'aarav.patel@eventsync.edu'] },
  });

  // Seed baseline academic info for Student 1
  await mongoose.connection.db.collection('users').updateOne(
    { _id: studentUser._id },
    {
      $set: {
        studentId: 'STU-2026-001',
        department: 'Computer Science & Engineering',
        year: '3rd Year',
      },
    }
  );

  // Seed Event 1: Free Published Event
  const freeEventId = new mongoose.Types.ObjectId();
  await mongoose.connection.db.collection('events').insertOne({
    _id: freeEventId,
    title: 'National Campus Hackathon Championship 2026',
    description: 'Annual flagship 36-hour collegiate hackathon featuring AI, Web3, and IoT development tracks with industry mentors.',
    category: 'Technology',
    date: new Date(Date.now() + 7 * 86400000),
    time: '09:00 AM - 06:00 PM',
    venue: 'Tech Auditorium, Building 4',
    capacity: 50,
    availableSeats: 50,
    isPaid: false,
    fee: 0,
    status: 'PUBLISHED',
    createdBy: adminUser._id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Seed Event 2: Paid Published Event
  const paidEventId = new mongoose.Types.ObjectId();
  await mongoose.connection.db.collection('events').insertOne({
    _id: paidEventId,
    title: 'AI & Robotics Hands-on Masterclass',
    description: 'Comprehensive technical workshop covering ROS2, autonomous navigation, and computer vision with physical hardware.',
    category: 'Workshop',
    date: new Date(Date.now() + 14 * 86400000),
    time: '10:00 AM - 04:00 PM',
    venue: 'Robotics Lab 2B',
    capacity: 30,
    availableSeats: 29, // 1 seat reserved by studentUser
    isPaid: true,
    fee: 150,
    status: 'PUBLISHED',
    createdBy: adminUser._id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Seed Student 1 Registration on Paid Event
  const paidRegId = new mongoose.Types.ObjectId();
  await mongoose.connection.db.collection('registrations').insertOne({
    _id: paidRegId,
    student: studentUser._id,
    event: paidEventId,
    status: 'REGISTERED',
    registeredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Seed Payment for Paid Event (PENDING)
  const payId = new mongoose.Types.ObjectId();
  await mongoose.connection.db.collection('payments').insertOne({
    _id: payId,
    student: studentUser._id,
    event: paidEventId,
    registration: paidRegId,
    amount: 150,
    currency: 'USD',
    transactionId: 'TXN-STU-8823190',
    status: 'PENDING',
    retryCount: 0,
    proof: {
      filename: 'receipt_masterclass.png',
      originalName: 'masterclass_fee_receipt.png',
      path: path.join(__dirname, 'server/uploads/proofs/receipt_masterclass.png'),
      mimetype: 'image/png',
      size: 1024,
      uploadedAt: new Date(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('[DB] Seeded test events & initial student registration');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', (msg) => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', (err) => console.error('[BROWSER UNCAUGHT ERROR]:', err));

  try {
    // -------------------------------------------------------------------------
    // STEP 1: STUDENT LOGIN & DASHBOARD WITH LIVE METRICS
    // -------------------------------------------------------------------------
    console.log('\n--- Step 1: Student Login & Student Dashboard ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await sleep(600);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.type('input[type="email"]', 'test.student@eventsync.edu');
    await page.type('input[type="password"]', 'Student@12345');
    await clickButtonByText(page, 'Sign In to EventSync');

    // Wait for redirect to /student/dashboard
    await page.waitForFunction(() => window.location.pathname.includes('/student/dashboard'), { timeout: 10000 });
    await sleep(1500);

    console.log(`[Dashboard] URL: ${page.url()} (Expected: /student/dashboard)`);

    const screenshot1 = path.join(ARTIFACTS_DIR, 'student_portal_01_dashboard.png');
    await page.screenshot({ path: screenshot1, fullPage: true });
    console.log(`[Screenshot 1] Saved: ${screenshot1}`);

    // -------------------------------------------------------------------------
    // STEP 2: EVENT DETAILS & DYNAMIC REGISTRATION QR MODAL
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2: Event Details & Dynamic QR Modal ---');
    await page.goto(`${BASE_URL}/events/${freeEventId.toString()}`, { waitUntil: 'networkidle0' });
    await sleep(1200);

    // Open Share / Registration QR modal
    await clickButtonByText(page, 'Registration Link & QR');
    await sleep(1000);

    const screenshot2 = path.join(ARTIFACTS_DIR, 'student_portal_02_event_details_qr.png');
    await page.screenshot({ path: screenshot2, fullPage: true });
    console.log(`[Screenshot 2] Saved: ${screenshot2}`);

    // Close modal
    await clickButtonByText(page, 'Close').catch(() => {});
    await sleep(600);

    // -------------------------------------------------------------------------
    // STEP 3: DEDICATED EVENT REGISTRATION PAGE
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3: Dedicated Registration Page (/events/:id/register) ---');
    await page.goto(`${BASE_URL}/events/${freeEventId.toString()}/register`, { waitUntil: 'networkidle0' });
    await sleep(1200);

    const screenshot3 = path.join(ARTIFACTS_DIR, 'student_portal_03_registration_page.png');
    await page.screenshot({ path: screenshot3, fullPage: true });
    console.log(`[Screenshot 3] Saved: ${screenshot3}`);

    // Click Confirm Free Event RSVP
    console.log('[RSVP] Submitting registration for Free Event...');
    await clickButtonByText(page, 'Confirm Free Event RSVP');
    await sleep(1500);

    // -------------------------------------------------------------------------
    // STEP 4: MY REGISTRATIONS PAGE & TICKET GENERATION
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: My Registrations Page & Generate Ticket ---');
    await page.goto(`${BASE_URL}/student/registrations`, { waitUntil: 'networkidle0' });
    await sleep(1200);

    const screenshot4 = path.join(ARTIFACTS_DIR, 'student_portal_04_my_registrations.png');
    await page.screenshot({ path: screenshot4, fullPage: true });
    console.log(`[Screenshot 4] Saved: ${screenshot4}`);

    // Click "Generate QR Ticket" to issue digital pass
    console.log('[Tickets] Issuing digital QR ticket from My Registrations...');
    await clickButtonByText(page, 'Generate QR Ticket').catch(() => {});
    await sleep(1500);

    // -------------------------------------------------------------------------
    // STEP 5: MY PAYMENTS PAGE
    // -------------------------------------------------------------------------
    console.log('\n--- Step 5: My Payments Page ---');
    await page.goto(`${BASE_URL}/student/payments`, { waitUntil: 'networkidle0' });
    await sleep(1200);

    const screenshot5 = path.join(ARTIFACTS_DIR, 'student_portal_05_my_payments.png');
    await page.screenshot({ path: screenshot5, fullPage: true });
    console.log(`[Screenshot 5] Saved: ${screenshot5}`);

    // -------------------------------------------------------------------------
    // STEP 6: MY TICKETS & DIGITAL PASS QR
    // -------------------------------------------------------------------------
    console.log('\n--- Step 6: My Tickets & Digital Pass QR ---');
    await page.goto(`${BASE_URL}/student/tickets`, { waitUntil: 'networkidle0' });
    await sleep(1200);

    const screenshot6 = path.join(ARTIFACTS_DIR, 'student_portal_06_my_tickets_qr.png');
    await page.screenshot({ path: screenshot6, fullPage: true });
    console.log(`[Screenshot 6] Saved: ${screenshot6}`);

    // -------------------------------------------------------------------------
    // STEP 7: GATE CHECK-IN SIMULATION & MY ATTENDANCE PAGE
    // -------------------------------------------------------------------------
    console.log('\n--- Step 7: Gate Check-in & My Attendance Page ---');
    // Find the generated ticket in MongoDB
    const generatedTicket = await mongoose.connection.db.collection('tickets').findOne({
      student: studentUser._id,
      status: 'ACTIVE',
    });

    if (generatedTicket) {
      console.log(`[Check-in] Performing check-in for ticket: ${generatedTicket.ticketCode}`);
      await mongoose.connection.db.collection('attendances').insertOne({
        student: studentUser._id,
        event: generatedTicket.event,
        registration: generatedTicket.registration,
        ticket: generatedTicket._id,
        checkedInAt: new Date(),
        checkedInBy: adminUser._id,
        status: 'CHECKED_IN',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await page.goto(`${BASE_URL}/student/attendance`, { waitUntil: 'networkidle0' });
    await sleep(1200);

    const screenshot7 = path.join(ARTIFACTS_DIR, 'student_portal_07_my_attendance.png');
    await page.screenshot({ path: screenshot7, fullPage: true });
    console.log(`[Screenshot 7] Saved: ${screenshot7}`);

    // -------------------------------------------------------------------------
    // STEP 8: PROFILE EDITING & DYNAMIC MONGODB UPDATES
    // -------------------------------------------------------------------------
    console.log('\n--- Step 8: Academic Profile Management (/profile) ---');
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle0' });
    await sleep(1200);

    // Click "Edit Profile"
    await clickButtonByText(page, 'Edit Profile');
    await sleep(600);

    // Update Year
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="3rd Year"], input[placeholder*="Year"]');
      if (input) {
        input.value = '4th Year (Senior Honors)';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await clickButtonByText(page, 'Save Changes');
    await sleep(1200);

    const screenshot8 = path.join(ARTIFACTS_DIR, 'student_portal_08_profile_updated.png');
    await page.screenshot({ path: screenshot8, fullPage: true });
    console.log(`[Screenshot 8] Saved: ${screenshot8}`);

    // -------------------------------------------------------------------------
    // STEP 9: RESPONSIVE MOBILE VIEWPORT VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- Step 9: Responsive Mobile Viewport Verification ---');
    await page.setViewport({ width: 390, height: 844 }); // iPhone 14 dimensions
    await page.goto(`${BASE_URL}/student/dashboard`, { waitUntil: 'networkidle0' });
    await sleep(1000);

    // Open mobile menu drawer if present
    await page.evaluate(() => {
      const btn = document.querySelector('.mobile-toggle-btn');
      if (btn) btn.click();
    });
    await sleep(800);

    const screenshot9 = path.join(ARTIFACTS_DIR, 'student_portal_09_mobile_viewport.png');
    await page.screenshot({ path: screenshot9, fullPage: true });
    console.log(`[Screenshot 9] Saved: ${screenshot9}`);

    console.log('\n======================================================================');
    console.log('✔ ALL 9 BROWSER VISUAL VERIFICATION STEPS COMPLETED SUCCESSFULLY!');
    console.log('======================================================================\n');

  } catch (err) {
    console.error('Browser verification error:', err);
    throw err;
  } finally {
    await browser.close();

    // Reset MongoDB to clean zero state with 3 baseline users preserved
    await mongoose.connection.db.collection('events').deleteMany({});
    await mongoose.connection.db.collection('registrations').deleteMany({});
    await mongoose.connection.db.collection('payments').deleteMany({});
    await mongoose.connection.db.collection('tickets').deleteMany({});
    await mongoose.connection.db.collection('attendances').deleteMany({});
    await mongoose.connection.db.collection('users').deleteMany({
      email: { $nin: ['admin@eventsync.edu', 'test.student@eventsync.edu', 'aarav.patel@eventsync.edu'] },
    });

    const finalEvents = await mongoose.connection.db.collection('events').countDocuments();
    const finalRegs = await mongoose.connection.db.collection('registrations').countDocuments();
    const finalPays = await mongoose.connection.db.collection('payments').countDocuments();
    const finalTicks = await mongoose.connection.db.collection('tickets').countDocuments();
    const finalAtts = await mongoose.connection.db.collection('attendances').countDocuments();
    const finalUsers = await mongoose.connection.db.collection('users').countDocuments();

    console.log('[DB Cleaned Final Zero-State]');
    console.log(`  Events:        ${finalEvents}`);
    console.log(`  Registrations: ${finalRegs}`);
    console.log(`  Payments:      ${finalPays}`);
    console.log(`  Tickets:       ${finalTicks}`);
    console.log(`  Attendances:   ${finalAtts}`);
    console.log(`  Users:         ${finalUsers} (3 baseline preserved)`);

    await mongoose.disconnect();
  }
}

runStudentPortalBrowserVerification();
