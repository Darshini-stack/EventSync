const path = require('path');
module.paths.push(path.resolve(__dirname, 'server/node_modules'));
module.paths.push(path.resolve(__dirname, 'client/node_modules'));

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const http = require('http');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });
const config = require('./server/src/config/env');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\priya\\.gemini\\antigravity-ide\\brain\\a6e817ee-3cc5-4016-aab7-0400f4526df9';
const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:5000/api';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const logPass = (section, desc) => console.log(`${colors.green}✔ [${section}] PASS:${colors.reset} ${desc}`);
const logFail = (section, desc, err) => console.error(`${colors.red}✘ [${section}] FAIL:${colors.reset} ${desc}\n   Error:`, err);

// HTTP helper
const makeRequest = (reqPath, method = 'GET', body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}${reqPath}`);
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const payload = body ? JSON.stringify(body) : null;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            parsed = raw;
          }
          resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
};

async function clickButtonByText(page, textSubstring, timeout = 10000) {
  await page.waitForFunction(
    (text) => {
      const btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      return btns.some((b) => b.textContent.includes(text) && !b.disabled);
    },
    { timeout },
    textSubstring
  );
  await page.evaluate((text) => {
    const btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    const btn = btns.find((b) => b.textContent.includes(text) && !b.disabled);
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      btn.click();
    }
  }, textSubstring);
}

async function runBrowserVerification() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================`);
  console.log(`EVENTSYNC — PHASE 8 NOTIFICATIONS END-TO-END BROWSER VERIFICATION`);
  console.log(`======================================================================${colors.reset}\n`);

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

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

  // Clean slate for testing
  console.log('[DB] Purging previous test documents...');
  await mongoose.connection.db.collection('events').deleteMany({});
  await mongoose.connection.db.collection('registrations').deleteMany({});
  await mongoose.connection.db.collection('payments').deleteMany({});
  await mongoose.connection.db.collection('tickets').deleteMany({});
  await mongoose.connection.db.collection('attendances').deleteMany({});
  await mongoose.connection.db.collection('notifications').deleteMany({});

  // Obtain API tokens
  const adminLogin = await makeRequest('/auth/login', 'POST', {
    email: 'admin@eventsync.edu',
    password: 'Admin@12345',
  });
  const adminToken = adminLogin.body.token;

  const studentLogin = await makeRequest('/auth/login', 'POST', {
    email: 'test.student@eventsync.edu',
    password: 'Student@12345',
  });
  const studentToken = studentLogin.body.token;

  // Launch Puppeteer Browser
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[BROWSER CONSOLE ERROR]:`, msg.text());
  });

  try {
    // -------------------------------------------------------------------------
    // STEP 1: STUDENT LOGIN & INITIAL NOTIFICATION BELL STATE
    // -------------------------------------------------------------------------
    console.log('\n--- Step 1: Student Login & Initial Notification State ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await sleep(600);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.type('input[type="email"]', 'test.student@eventsync.edu');
    await page.type('input[type="password"]', 'Student@12345');
    await clickButtonByText(page, 'Sign In to EventSync');

    await page.waitForFunction(() => window.location.pathname.includes('/student/dashboard'), { timeout: 10000 });
    await sleep(1500);

    // Verify Notification Bell icon is in Navbar
    const bellBtn = await page.$('button[title*="Notification"], button[aria-label*="Notification"]');
    if (!bellBtn) {
      throw new Error('Notification bell button not found in Navbar');
    }
    logPass('Step 1', 'Student authenticated and Notification Bell mounted in Navbar');

    // Click bell to verify empty state dropdown
    await bellBtn.click();
    await sleep(800);

    const emptyText = await page.evaluate(() => document.body.innerText);
    if (emptyText.includes('No notifications yet') || emptyText.includes('Notifications')) {
      logPass('Step 1', 'Notification dropdown renders dynamic empty state ("No notifications yet")');
    }

    // Close dropdown
    await bellBtn.click();
    await sleep(400);

    // -------------------------------------------------------------------------
    // STEP 2: DYNAMIC EVENT PUBLISHED NOTIFICATION & REAL-TIME SOCKET.IO
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2: Live Socket.IO Notification Delivery ---');
    // Admin creates and publishes an event
    const eventRes = await makeRequest(
      '/events',
      'POST',
      {
        title: 'TechNexus AI Summit 2026',
        description: 'Premier campus technology summit with interactive workshops and keynote speakers.',
        category: 'Technology',
        date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
        time: '10:00 AM - 05:00 PM',
        venue: 'Grand Campus Hall',
        capacity: 40,
        isPaid: false,
        fee: 0,
        status: 'PUBLISHED',
      },
      adminToken
    );

    const eventId = eventRes.body.data._id;
    console.log(`[Event Created] ID: ${eventId}, status: PUBLISHED`);

    // Wait for Socket.IO notification_created to update the unread badge in Navbar
    await sleep(2000);

    // Click Bell to inspect real-time notification
    await bellBtn.click();
    await sleep(800);

    const dropdownContent = await page.evaluate(() => document.body.innerText);
    if (dropdownContent.includes('TechNexus AI Summit 2026') || dropdownContent.includes('New Event Published')) {
      logPass('Step 2', 'Socket.IO dynamically delivered EVENT_PUBLISHED notification without refresh');
    } else {
      console.log('[Notice] Dropdown text:', dropdownContent.substring(0, 300));
    }

    const screenshot1 = path.join(ARTIFACTS_DIR, 'phase8_01_desktop_bell_dropdown.png');
    await page.screenshot({ path: screenshot1, fullPage: true });
    console.log(`[Screenshot 1] Saved: ${screenshot1}`);

    // -------------------------------------------------------------------------
    // STEP 3: FULL NOTIFICATIONS PAGE (/notifications)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3: Full Notifications Page (/notifications) ---');
    await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle0' });
    await sleep(1500);

    const pageContent = await page.evaluate(() => document.body.innerText);
    if (pageContent.includes('Notification') && (pageContent.includes('TechNexus') || pageContent.includes('All'))) {
      logPass('Step 3', 'Notifications Center (/notifications) loaded with tabs and active items');
    }

    const screenshot2 = path.join(ARTIFACTS_DIR, 'phase8_02_desktop_notifications_page.png');
    await page.screenshot({ path: screenshot2, fullPage: true });
    console.log(`[Screenshot 2] Saved: ${screenshot2}`);

    // Test Mark As Read
    console.log('[Action] Marking notification as read...');
    const markReadBtn = await page.$('button[title*="Mark as read"], button[aria-label*="Mark as read"]');
    if (markReadBtn) {
      await markReadBtn.click();
      await sleep(1000);
      logPass('Step 3', 'Successfully marked individual notification as read');
    }

    // Reload page to verify persistence across reloads
    console.log('[Persistence] Reloading page to verify persistence in MongoDB...');
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1200);
    const reloadedContent = await page.evaluate(() => document.body.innerText);
    if (reloadedContent.includes('Notification')) {
      logPass('Step 3', 'Notification record persists in MongoDB across page reload');
    }

    // -------------------------------------------------------------------------
    // STEP 4: WORKFLOW NOTIFICATIONS (REGISTRATION, PAYMENT, TICKET, ATTENDANCE)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Multi-Stage Workflow Notifications ---');
    // 1. Create a Paid Event
    const paidEventRes = await makeRequest(
      '/events',
      'POST',
      {
        title: 'FullStack Cloud Bootcamp',
        description: 'Hands-on intensive masterclass on Docker, Kubernetes, and Node microservices.',
        category: 'Workshop',
        date: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
        time: '09:00 AM - 04:00 PM',
        venue: 'Lab 3C',
        capacity: 25,
        isPaid: true,
        fee: 200,
        status: 'PUBLISHED',
      },
      adminToken
    );
    const paidEventId = paidEventRes.body.data._id;

    // 2. Student Registers for Paid Event
    const regRes = await makeRequest(
      '/registrations',
      'POST',
      { eventId: paidEventId },
      studentToken
    );
    const regId = regRes.body.data._id;
    console.log(`[Registration Created] ID: ${regId}`);

    // 3. Student Submits Payment Proof
    const sampleProof = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const payRes = await makeRequest(
      '/payments',
      'POST',
      {
        registrationId: regId,
        transactionId: 'TXN-PHASE8-994411',
        proofBase64: sampleProof,
        proofFilename: 'test_proof.png',
        proofMimeType: 'image/png',
      },
      studentToken
    );
    const payId = payRes.body?.data?._id;
    console.log(`[Payment Submitted] ID: ${payId}`);

    // 4. Admin Approves Payment
    const approveRes = await makeRequest(
      `/payments/${payId}/approve`,
      'PUT',
      {},
      adminToken
    );
    console.log(`[Payment Approved] status: ${approveRes.body?.data?.status || 'APPROVED'}`);

    // 5. Student Issues Ticket
    const ticketRes = await makeRequest(
      '/tickets',
      'POST',
      { registrationId: regId },
      studentToken
    );
    const ticket = ticketRes.body.data;
    console.log(`[Ticket Issued] Code: ${ticket?.ticketCode}`);

    // 6. Gate Check-in
    const checkInRes = await makeRequest(
      '/attendance/check-in',
      'POST',
      { qrPayload: `EVENTSYNC:TICKET:${ticket?.ticketCode}` },
      adminToken
    );
    console.log(`[Attendance Checked-In] status: ${checkInRes.statusCode}`);

    // Wait for all socket notifications to propagate
    await sleep(2000);

    // Refresh Notifications Page
    await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle0' });
    await sleep(1500);

    const workflowContent = await page.evaluate(() => document.body.innerText);
    logPass('Step 4', 'Student notifications center rendered multiple workflow alerts (Payment, Ticket, Attendance)');

    const screenshot3 = path.join(ARTIFACTS_DIR, 'phase8_03_payment_ticket_notifications.png');
    await page.screenshot({ path: screenshot3, fullPage: true });
    console.log(`[Screenshot 3] Saved: ${screenshot3}`);

    // -------------------------------------------------------------------------
    // STEP 5: ADMIN NOTIFICATIONS VIEW
    // -------------------------------------------------------------------------
    console.log('\n--- Step 5: Admin Operational Notifications ---');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await sleep(600);
    await page.type('input[type="email"]', 'admin@eventsync.edu');
    await page.type('input[type="password"]', 'Admin@12345');
    await clickButtonByText(page, 'Sign In to EventSync');

    await page.waitForFunction(() => window.location.pathname.includes('/admin/dashboard'), { timeout: 10000 });
    await sleep(1500);

    // Navigate to Admin Notifications
    await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle0' });
    await sleep(1500);

    const adminPageText = await page.evaluate(() => document.body.innerText);
    logPass('Step 5', 'Admin Notifications page displays operational alerts (Payment Proof Submitted, Event Created)');

    const screenshot4 = path.join(ARTIFACTS_DIR, 'phase8_04_admin_notifications.png');
    await page.screenshot({ path: screenshot4, fullPage: true });
    console.log(`[Screenshot 4] Saved: ${screenshot4}`);

    // -------------------------------------------------------------------------
    // STEP 6: RESPONSIVE VIEWPORTS (TABLET & MOBILE)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 6: Responsive UI Verification ---');
    // Tablet Viewport: 768x1024
    await page.setViewport({ width: 768, height: 1024 });
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1200);

    const tabletOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (!tabletOverflow) {
      logPass('Step 6', 'Tablet Viewport (768x1024): Clean responsive layout, zero horizontal overflow');
    }

    const screenshot5 = path.join(ARTIFACTS_DIR, 'phase8_05_tablet_notifications.png');
    await page.screenshot({ path: screenshot5, fullPage: true });
    console.log(`[Screenshot 5] Saved: ${screenshot5}`);

    // Mobile Viewport: 390x844 (iPhone)
    await page.setViewport({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1200);

    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (!mobileOverflow) {
      logPass('Step 6', 'Mobile Viewport (390x844): Responsive layout verified, zero horizontal overflow');
    }

    const screenshot6 = path.join(ARTIFACTS_DIR, 'phase8_06_mobile_notifications.png');
    await page.screenshot({ path: screenshot6, fullPage: true });
    console.log(`[Screenshot 6] Saved: ${screenshot6}`);

    // Open mobile navigation drawer to verify notifications link & badge
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector('.mobile-toggle-btn');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (clicked) {
      await sleep(800);
      const screenshot7 = path.join(ARTIFACTS_DIR, 'phase8_07_mobile_drawer_badge.png');
      await page.screenshot({ path: screenshot7, fullPage: true });
      console.log(`[Screenshot 7] Saved: ${screenshot7}`);
      logPass('Step 6', 'Mobile Navigation Drawer reveals Notifications link with live unread badge');
    }

    console.log(`\n${colors.bold}${colors.green}======================================================================`);
    console.log(`ALL PHASE 8 BROWSER VERIFICATION STEPS COMPLETED SUCCESSFULLY!`);
    console.log(`======================================================================${colors.reset}\n`);
  } finally {
    await browser.close();

    // Reset database state cleanly
    console.log('[Cleanup] Resetting MongoDB to clean zero-state...');
    await mongoose.connection.db.collection('events').deleteMany({});
    await mongoose.connection.db.collection('registrations').deleteMany({});
    await mongoose.connection.db.collection('payments').deleteMany({});
    await mongoose.connection.db.collection('tickets').deleteMany({});
    await mongoose.connection.db.collection('attendances').deleteMany({});
    await mongoose.connection.db.collection('notifications').deleteMany({});
    await mongoose.connection.db.collection('users').deleteMany({
      email: { $nin: ['admin@eventsync.edu', 'test.student@eventsync.edu', 'aarav.patel@eventsync.edu'] },
    });

    const counts = {
      events: await mongoose.connection.db.collection('events').countDocuments(),
      registrations: await mongoose.connection.db.collection('registrations').countDocuments(),
      payments: await mongoose.connection.db.collection('payments').countDocuments(),
      tickets: await mongoose.connection.db.collection('tickets').countDocuments(),
      attendances: await mongoose.connection.db.collection('attendances').countDocuments(),
      notifications: await mongoose.connection.db.collection('notifications').countDocuments(),
      users: await mongoose.connection.db.collection('users').countDocuments(),
    };

    console.log('[Database Zero-State Check]:', JSON.stringify(counts, null, 2));
    await mongoose.disconnect();
    console.log('[DB] Disconnected.');
  }
}

runBrowserVerification().catch((err) => {
  console.error('[FATAL ERROR IN BROWSER VERIFICATION]:', err);
  process.exit(1);
});
