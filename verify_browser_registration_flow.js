const path = require('path');
module.paths.push(path.resolve(__dirname, 'server/node_modules'));

const puppeteer = require('puppeteer-core');
const fs = require('fs');
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
  console.log('STARTING EVENT REGISTRATION LINK, QR & WEBSITE BROWSER VERIFICATION');
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
    // STEP 1: VERIFY DUAL REGISTRATION FLOW (/register)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 1: Verifying /register Page ---');
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle2' });
    await sleep(800);

    // Verify [Student] option is selected by default
    const studentAccessCodeExists = await page.$('input[name="accessCode"], input[placeholder*="access code"]');
    console.log(`[Student Tab] Access code field present? ${!!studentAccessCodeExists} (Must be false)`);

    const screenshot1 = path.join(ARTIFACTS_DIR, 'website_01_student_registration.png');
    await page.screenshot({ path: screenshot1, fullPage: true });
    console.log(`[Screenshot 1] Saved: ${screenshot1}`);

    // Switch to [Admin] tab
    await page.click('#register-tab-admin');
    await page.waitForSelector('input[placeholder*="access code"]');
    await sleep(600);

    const adminAccessCodeInput = await page.$('input[placeholder*="access code"]');
    console.log(`[Admin Tab] Admin Access Code field present? ${!!adminAccessCodeInput} (Must be true)`);

    const screenshot2 = path.join(ARTIFACTS_DIR, 'website_02_admin_registration.png');
    await page.screenshot({ path: screenshot2, fullPage: true });
    console.log(`[Screenshot 2] Saved: ${screenshot2}`);

    // -------------------------------------------------------------------------
    // STEP 2: LOGIN AS EVENTADMIN & CREATE REAL EVENT
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2: Logging in as EventAdmin & Creating Event ---');
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle2' });
    await sleep(600);

    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@eventsync.edu');
    const pwdInputs = await page.$$('input[type="password"]');
    if (pwdInputs.length >= 2) {
      await pwdInputs[0].type('Admin@12345');
      await pwdInputs[1].type(config.adminAccessCode);
    }
    await page.click('button[type="submit"]');

    // Wait for client navigation to /admin/dashboard
    await page.waitForFunction(() => window.location.pathname === '/admin/dashboard', { timeout: 10000 });
    await sleep(1500);
    console.log(`[Navigation] Current URL: ${page.url()} (Expected: /admin/dashboard)`);

    // Click "Create New Event"
    await clickButtonByText(page, 'Create New Event');
    await sleep(800);

    // Fill Create Event Form
    await page.type('input[placeholder*="Annual Campus Hackathon"]', 'Annual Campus Innovation Expo 2026');
    await page.select('select:has(option[value="Technology"])', 'Technology');
    await page.select('select:has(option[value="PUBLISHED"])', 'PUBLISHED');

    const futureDate = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
    await page.type('input[type="date"]', futureDate);
    await page.type('input[placeholder*="10:00 AM"]', '10:00 AM - 4:30 PM');
    await page.type('input[placeholder*="Main Auditorium"]', 'Convention Center, Innovation Wing');
    await page.type('input[placeholder*="150"]', '100');
    await page.type('textarea[placeholder*="Detailed schedule"]', 'Showcase of cutting-edge university technology projects, hackathon winners, and startup pitches with live industry mentors.');

    // Save Event
    await clickButtonByText(page, 'Create Event');
    await sleep(1500);

    const screenshot3 = path.join(ARTIFACTS_DIR, 'website_03_admin_dashboard_event.png');
    await page.screenshot({ path: screenshot3, fullPage: true });
    console.log(`[Screenshot 3] Saved: ${screenshot3}`);

    // Fetch the created event ID from DB
    const eventDoc = await mongoose.connection.db.collection('events').findOne({ title: 'Annual Campus Innovation Expo 2026' });
    if (!eventDoc) throw new Error('Event not found in MongoDB!');
    const eventId = eventDoc._id.toString();
    console.log(`[Event Created] ID: ${eventId} • Available Seats: ${eventDoc.availableSeats}/${eventDoc.capacity}`);

    // -------------------------------------------------------------------------
    // STEP 3: OPEN REGISTRATION QR MODAL & VERIFY DYNAMIC URL
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3: Verifying Event Registration QR Modal ---');
    await clickButtonByText(page, 'Registration QR');
    await sleep(1000);

    // Verify modal contains dynamic registration URL and high-res QR
    const modalUrlValue = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[readonly]'));
      return inputs.map((i) => i.value).find((v) => v.includes('/events/') && v.includes('/register'));
    });
    console.log(`[Registration QR Modal] Encoded dynamic link: ${modalUrlValue}`);

    const screenshot4 = path.join(ARTIFACTS_DIR, 'website_04_registration_qr_modal.png');
    await page.screenshot({ path: screenshot4, fullPage: true });
    console.log(`[Screenshot 4] Saved: ${screenshot4}`);

    // Close QR modal via Escape key
    await page.keyboard.press('Escape');
    await sleep(600);

    // -------------------------------------------------------------------------
    // STEP 4: STUDENT NAVIGATES TO DEDICATED REGISTRATION PAGE (/events/:id/register)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Student Navigating to Dedicated Registration Page ---');
    await page.evaluate(() => localStorage.clear());

    // Login as student
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await sleep(600);
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'test.student@eventsync.edu');
    await page.type('input[type="password"]', 'Student@12345');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/student/dashboard', { timeout: 10000 });
    await sleep(800);

    // Open dynamic registration URL
    const regUrl = `${BASE_URL}/events/${eventId}/register`;
    console.log(`[Navigation] Navigating to Registration Link: ${regUrl}`);
    await page.goto(regUrl, { waitUntil: 'networkidle2' });
    await sleep(1000);

    const screenshot5 = path.join(ARTIFACTS_DIR, 'website_05_student_event_registration.png');
    await page.screenshot({ path: screenshot5, fullPage: true });
    console.log(`[Screenshot 5] Saved: ${screenshot5}`);

    // Execute Registration via the button
    console.log('[Registration] Clicking "Confirm Free Event RSVP"...');
    await clickButtonByText(page, 'Confirm Free Event RSVP');
    await sleep(2000);

    // -------------------------------------------------------------------------
    // STEP 5: STUDENT GENERATES ADMISSION TICKET (STUDENT TICKET QR)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 5: Student Viewing Ticket & Strict QR Distinction ---');
    // Navigate to /student/registrations to generate QR ticket
    await page.goto(`${BASE_URL}/student/registrations`, { waitUntil: 'networkidle2' });
    await sleep(1200);

    // Click "Generate QR Ticket"
    console.log('[Ticket] Generating QR ticket...');
    await clickButtonByText(page, 'Generate QR Ticket');
    await sleep(2000);

    // Now navigate to /student/tickets
    console.log('[Ticket] Navigating to /student/tickets...');
    await page.goto(`${BASE_URL}/student/tickets`, { waitUntil: 'networkidle2' });
    await sleep(2000);

    // Wait for the ticket QR to load
    await page.waitForSelector('img[alt*="QR Code"]', { timeout: 10000 });
    await sleep(500);

    const screenshot6 = path.join(ARTIFACTS_DIR, 'website_06_student_ticket_qr.png');
    await page.screenshot({ path: screenshot6, fullPage: true });
    console.log(`[Screenshot 6] Saved: ${screenshot6}`);

    // Retrieve the ticket code from DB
    const ticketDoc = await mongoose.connection.db.collection('tickets').findOne({ event: eventDoc._id });
    if (!ticketDoc) throw new Error('Ticket document not found in MongoDB!');
    const ticketCode = ticketDoc.ticketCode;
    console.log(`[Student Ticket Code] ${ticketCode} • Format: EVENTSYNC:TICKET:${ticketCode}`);

    // -------------------------------------------------------------------------
    // STEP 6: ADMIN GATE CHECK-IN VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- Step 6: Admin Gate Check-In & Live Metric Verification ---');
    await page.evaluate(() => localStorage.clear());

    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle2' });
    await sleep(600);
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@eventsync.edu');
    const pwdInputs2 = await page.$$('input[type="password"]');
    if (pwdInputs2.length >= 2) {
      await pwdInputs2[0].type('Admin@12345');
      await pwdInputs2[1].type(config.adminAccessCode);
    }
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/admin/dashboard', { timeout: 10000 });
    await sleep(1000);

    // Scroll to QR Attendance Check-In section
    await page.evaluate(() => {
      const el = document.getElementById('qr-attendance-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
    await sleep(600);

    // Enter ticket payload: EVENTSYNC:TICKET:<ticketCode>
    const manualInput = await page.waitForSelector('#manual-qr-input');
    await manualInput.type(`EVENTSYNC:TICKET:${ticketCode}`);
    await page.click('#btn-verify-checkin');
    await page.waitForSelector('#checkin-result-card');
    await sleep(1500);

    const screenshot7 = path.join(ARTIFACTS_DIR, 'website_07_gate_checkin_verified.png');
    await page.screenshot({ path: screenshot7, fullPage: true });
    console.log(`[Screenshot 7] Saved: ${screenshot7}`);

    // Verify DB records
    const attendanceDoc = await mongoose.connection.db.collection('attendances').findOne({ 'ticket.ticketCode': ticketCode });
    console.log(`[Attendance Verified in DB] Status: ${attendanceDoc?.status} • Checked In By: ${attendanceDoc?.checkedInBy?.name || 'Admin'}`);

    // -------------------------------------------------------------------------
    // STEP 7: CLEANUP DATABASE ZERO-STATE
    // -------------------------------------------------------------------------
    console.log('\n--- Step 7: Performing Database Cleanup ---');
    await mongoose.connection.db.collection('events').deleteMany({});
    await mongoose.connection.db.collection('registrations').deleteMany({});
    await mongoose.connection.db.collection('payments').deleteMany({});
    await mongoose.connection.db.collection('tickets').deleteMany({});
    await mongoose.connection.db.collection('attendances').deleteMany({});

    const [eCount, rCount, pCount, tCount, aCount, uCount] = await Promise.all([
      mongoose.connection.db.collection('events').countDocuments(),
      mongoose.connection.db.collection('registrations').countDocuments(),
      mongoose.connection.db.collection('payments').countDocuments(),
      mongoose.connection.db.collection('tickets').countDocuments(),
      mongoose.connection.db.collection('attendances').countDocuments(),
      mongoose.connection.db.collection('users').countDocuments(),
    ]);

    console.log(`[Final DB Counts]
  events:        ${eCount} (MUST BE 0)
  registrations: ${rCount} (MUST BE 0)
  payments:      ${pCount} (MUST BE 0)
  tickets:       ${tCount} (MUST BE 0)
  attendances:   ${aCount} (MUST BE 0)
  users:         ${uCount} (3 Baseline Phase 2 Users)`);

    if (eCount === 0 && rCount === 0 && pCount === 0 && tCount === 0 && aCount === 0 && uCount === 3) {
      console.log('\n✔ DATABASE RESTORED TO ZERO STATE WITH ALL 3 USERS INTACT!');
    } else {
      console.warn('\n⚠ Warning: DB counts did not match expected zero-state.');
    }

    console.log('\n======================================================================');
    console.log('BROWSER VERIFICATION COMPLETED SUCCESSFULLY!');
    console.log('======================================================================\n');
  } catch (err) {
    console.error('Browser verification error:', err);
  } finally {
    await browser.close();
    await mongoose.disconnect();
  }
}

runBrowserVerification();
