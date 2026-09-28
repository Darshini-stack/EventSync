const path = require('path');
module.paths.push(path.resolve(__dirname, 'server/node_modules'));

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });
const config = require('./server/src/config/env');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\priya\\.gemini\\antigravity-ide\\brain\\9289fb56-f889-45e3-a93d-b7ca964cbc5b';
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

async function runBrowserVerification() {
  console.log('======================================================================');
  console.log('STARTING PHASE 7 BROWSER FLOW VERIFICATION (AUTH & ATTENDANCE)');
  console.log('======================================================================\n');

  // Connect to DB and reset initial state
  await mongoose.connect(config.mongoUri);
  await mongoose.connection.db.collection('events').deleteMany({});
  await mongoose.connection.db.collection('registrations').deleteMany({});
  await mongoose.connection.db.collection('payments').deleteMany({});
  await mongoose.connection.db.collection('tickets').deleteMany({});
  await mongoose.connection.db.collection('attendances').deleteMany({});
  await mongoose.connection.db.collection('users').deleteMany({
    email: { $nin: ['admin@eventsync.edu', 'test.student@eventsync.edu', 'aarav.patel@eventsync.edu'] },
  });
  console.log('[DB] Cleaned business collections and preserved 3 baseline users');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // -------------------------------------------------------------------------
    // Step 1: Student Registration View at /register
    // -------------------------------------------------------------------------
    console.log('[Step 1] Navigating to /register to verify Student Registration UI...');
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle2' });
    await sleep(1000);

    const shot1Path = path.join(ARTIFACTS_DIR, 'phase7_01_student_registration.png');
    await page.screenshot({ path: shot1Path, fullPage: true });
    console.log(`[Screenshot 1] Saved student registration page: ${shot1Path}`);

    // -------------------------------------------------------------------------
    // Step 2: Switch to Admin Registration UI via Tab (Verify Access Code Field)
    // -------------------------------------------------------------------------
    console.log('[Step 2] Clicking [ Admin ] tab to verify Admin Registration UI with Access Code...');
    await page.click('#register-tab-admin');
    await page.waitForSelector('input[placeholder*="access code"]');
    await sleep(800);

    const shot2Path = path.join(ARTIFACTS_DIR, 'phase7_02_admin_registration.png');
    await page.screenshot({ path: shot2Path, fullPage: true });
    console.log(`[Screenshot 2] Saved admin registration page with access code: ${shot2Path}`);

    // -------------------------------------------------------------------------
    // Step 3: Seed Published Event in MongoDB for End-to-End Check-In Testing
    // -------------------------------------------------------------------------
    console.log('[Step 3] Seeding test published event in MongoDB...');
    const adminUser = await mongoose.connection.db.collection('users').findOne({ email: 'admin@eventsync.edu' });
    const eventInsert = await mongoose.connection.db.collection('events').insertOne({
      title: 'Phase 7 Live Campus Tech Showcase',
      description: 'Official Phase 7 end-to-end QR check-in and attendance verification event.',
      category: 'Technology',
      date: new Date('2026-10-25'),
      time: '10:00 AM - 1:00 PM',
      venue: 'Main Campus Auditorium',
      capacity: 50,
      availableSeats: 50,
      isPaid: false,
      fee: 0,
      status: 'PUBLISHED',
      createdBy: adminUser._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const eventId = eventInsert.insertedId.toString();
    console.log(`[Step 3] Test event created with ID: ${eventId}`);

    // -------------------------------------------------------------------------
    // Step 4: Student Logs In, RSVPs, and Generates QR Ticket
    // -------------------------------------------------------------------------
    console.log('[Step 4] Logging in as Student 1 to RSVP and generate QR pass...');
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });

    await page.type('input[type="email"]', 'test.student@eventsync.edu');
    await page.type('input[type="password"]', 'Student@12345');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/student/dashboard', { timeout: 10000 });
    console.log('[Step 4] Student logged in. Current URL:', page.url());

    const shot3Path = path.join(ARTIFACTS_DIR, 'phase7_03_student_dashboard.png');
    await page.screenshot({ path: shot3Path, fullPage: true });
    console.log(`[Screenshot 3] Saved student dashboard: ${shot3Path}`);

    // Navigate to event details directly
    console.log(`[Step 4] Navigating to /events/${eventId}...`);
    await page.goto(`${BASE_URL}/events/${eventId}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('h1', { timeout: 10000 });
    await sleep(1000);

    console.log('[Step 4] On Event Details page. Clicking RSVP for Free...');
    await clickButtonByText(page, 'RSVP for Free');
    await sleep(2000);

    console.log('[Step 4] Generating Digital QR Ticket...');
    await clickButtonByText(page, 'Generate Digital QR Ticket');
    await sleep(2500);

    const shot4Path = path.join(ARTIFACTS_DIR, 'phase7_04_ticket_generated.png');
    await page.screenshot({ path: shot4Path, fullPage: true });
    console.log(`[Screenshot 4] Saved generated QR ticket modal: ${shot4Path}`);

    // Extract ticketCode directly from DB for verified check-in
    let activeTicket = null;
    for (let i = 0; i < 15; i++) {
      activeTicket = await mongoose.connection.db.collection('tickets').findOne({ status: 'ACTIVE' });
      if (activeTicket) break;
      await sleep(500);
    }
    if (!activeTicket) {
      throw new Error('No active ticket found in MongoDB after generation!');
    }
    const targetPayload = `EVENTSYNC:TICKET:${activeTicket.ticketCode}`;
    console.log(`[Step 4] Active Ticket resolved: ${activeTicket.ticketCode}, QR Payload: ${targetPayload}`);

    // -------------------------------------------------------------------------
    // Step 5: Admin Dashboard Inspection (Initial Attendance Roster & Scanner)
    // -------------------------------------------------------------------------
    console.log('[Step 5] Logging into Admin Dashboard to verify attendance UI...');
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle2' });

    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@eventsync.edu');
    const pwdInputs2 = await page.$$('input[type="password"]');
    if (pwdInputs2.length >= 2) {
      await pwdInputs2[0].type('Admin@12345');
      await pwdInputs2[1].type(config.adminAccessCode);
    }
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/admin/dashboard', { timeout: 10000 });
    await sleep(1500);

    const shot5Path = path.join(ARTIFACTS_DIR, 'phase7_05_admin_dashboard_initial.png');
    await page.screenshot({ path: shot5Path, fullPage: true });
    console.log(`[Screenshot 5] Saved initial Admin Dashboard with Verified Attendance card: ${shot5Path}`);

    // -------------------------------------------------------------------------
    // Step 6: Admin Performs QR Check-In via Manual Fallback
    // -------------------------------------------------------------------------
    console.log('[Step 6] Entering QR payload into manual check-in field...');
    const manualInput = await page.waitForSelector('#manual-qr-input');
    await manualInput.type(targetPayload);

    console.log('[Step 6] Clicking Verify & Record Check-In button...');
    await page.click('#btn-verify-checkin');
    await page.waitForSelector('#checkin-result-card');
    await sleep(1500);

    const shot6Path = path.join(ARTIFACTS_DIR, 'phase7_06_checkin_success.png');
    await page.screenshot({ path: shot6Path, fullPage: true });
    console.log(`[Screenshot 6] Saved verified check-in success card: ${shot6Path}`);

    // -------------------------------------------------------------------------
    // Step 7: Duplicate Check-In Attempt (Warning Display)
    // -------------------------------------------------------------------------
    console.log('[Step 7] Re-submitting the same ticket to test duplicate rejection UI...');
    await manualInput.click({ clickCount: 3 });
    await manualInput.type(targetPayload);
    await page.click('#btn-verify-checkin');
    await sleep(1500);

    const shot7Path = path.join(ARTIFACTS_DIR, 'phase7_07_duplicate_checkin_warning.png');
    await page.screenshot({ path: shot7Path, fullPage: true });
    console.log(`[Screenshot 7] Saved duplicate check-in warning card: ${shot7Path}`);

    // -------------------------------------------------------------------------
    // Step 8: Student View of Checked-In Ticket
    // -------------------------------------------------------------------------
    console.log('[Step 8] Logging in as Student to verify CHECKED IN badge on My Tickets...');
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });

    await page.type('input[type="email"]', 'test.student@eventsync.edu');
    await page.type('input[type="password"]', 'Student@12345');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/student/dashboard', { timeout: 10000 });

    await page.goto(`${BASE_URL}/student/tickets`, { waitUntil: 'networkidle2' });
    await sleep(2000);

    const shot8Path = path.join(ARTIFACTS_DIR, 'phase7_08_student_checked_in_ticket.png');
    await page.screenshot({ path: shot8Path, fullPage: true });
    console.log(`[Screenshot 8] Saved student checked-in ticket view: ${shot8Path}`);

    console.log('\n✔ BROWSER FLOW VERIFICATION COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('✘ BROWSER FLOW VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();

    // Clean DB after tests
    await mongoose.connection.db.collection('events').deleteMany({});
    await mongoose.connection.db.collection('registrations').deleteMany({});
    await mongoose.connection.db.collection('payments').deleteMany({});
    await mongoose.connection.db.collection('tickets').deleteMany({});
    await mongoose.connection.db.collection('attendances').deleteMany({});
    await mongoose.connection.db.collection('users').deleteMany({
      email: { $nin: ['admin@eventsync.edu', 'test.student@eventsync.edu', 'aarav.patel@eventsync.edu'] },
    });

    const counts = {
      events: await mongoose.connection.db.collection('events').countDocuments(),
      registrations: await mongoose.connection.db.collection('registrations').countDocuments(),
      payments: await mongoose.connection.db.collection('payments').countDocuments(),
      tickets: await mongoose.connection.db.collection('tickets').countDocuments(),
      attendances: await mongoose.connection.db.collection('attendances').countDocuments(),
      users: await mongoose.connection.db.collection('users').countDocuments(),
    };

    console.log('\n======================================================================');
    console.log('FINAL DATABASE ZERO-STATE VERIFICATION:');
    console.log(JSON.stringify(counts, null, 2));
    console.log('======================================================================\n');

    await mongoose.disconnect();
  }
}

runBrowserVerification();
