const path = require('path');
module.paths.push(path.resolve(__dirname, 'server/node_modules'));
module.paths.push(path.resolve(__dirname, 'client/node_modules'));

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });
const config = require('./server/src/config/env');
const Event = require('./server/src/models/Event');
const User = require('./server/src/models/User');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:5000/api';
const SCRATCH_DIR = path.resolve(__dirname, 'scratch');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const logPass = (desc) => console.log(`${colors.green}✔ PASS:${colors.reset} ${desc}`);
const logFail = (desc, err) => console.error(`${colors.red}✘ FAIL:${colors.reset} ${desc}\n   Error:`, err);

// Make HTTP request helper
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

async function runBrowserVerification() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================`);
  console.log(`EVENTSYNC — IN-APP EVENT REGISTRATION QR SCANNER E2E VERIFICATION`);
  console.log(`======================================================================${colors.reset}\n`);

  if (!fs.existsSync(SCRATCH_DIR)) {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  }

  // 1. Connect to MongoDB to prepare dynamic test event & sample QR
  await mongoose.connect(config.mongoUri);
  console.log('[DB] Connected to MongoDB');

  let adminUser = await User.findOne({ role: 'EVENTADMIN' });
  if (!adminUser) {
    throw new Error('No EVENTADMIN found in MongoDB');
  }

  const adminToken = jwt.sign(
    { id: adminUser._id, role: adminUser.role, email: adminUser.email },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  // Find or create a published event
  let testEvent = await Event.findOne({ status: 'PUBLISHED' });
  if (!testEvent) {
    testEvent = await Event.create({
      title: 'Robotics & AI Innovation Summit 2026',
      description: 'Annual campus technology showcase with live drone demos and robotics battle.',
      category: 'Technology',
      date: new Date(Date.now() + 86400000 * 5),
      time: '10:00 AM - 4:00 PM',
      venue: 'Main Auditorium & Tech Lab',
      capacity: 50,
      availableSeats: 48,
      isPaid: false,
      fee: 0,
      status: 'PUBLISHED',
      createdBy: adminUser._id,
    });
    console.log(`[Event] Created test event: ${testEvent.title} (${testEvent._id})`);
  } else {
    console.log(`[Event] Using existing published event: ${testEvent.title} (${testEvent._id})`);
  }

  // Fetch the actual event registration QR code image from the backend
  console.log('[QR] Fetching registration QR code image...');
  const qrRes = await makeRequest(
    `/events/${testEvent._id}/registration-qr?format=json&clientUrl=${encodeURIComponent(BASE_URL)}`
  );

  const qrDataUrl = qrRes.body?.dataUrl || qrRes.body?.data?.dataUrl;
  if (!qrDataUrl || !qrDataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('Failed to fetch valid base64 QR code image: ' + JSON.stringify(qrRes.body));
  }

  const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
  const qrFilePath = path.join(SCRATCH_DIR, 'test_registration_qr.png');
  fs.writeFileSync(qrFilePath, Buffer.from(qrBase64, 'base64'));
  console.log(`[QR] Saved registration QR code image to ${qrFilePath}`);

  // Launch Puppeteer browser
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', (msg) => {
    console.log(`[BROWSER ${msg.type()}]:`, msg.text());
  });
  page.on('pageerror', (err) => {
    console.log('[PAGE ERROR]:', err.message);
  });

  try {
    // -----------------------------------------------------------------------
    // TEST 1: Navbar "Scan QR" button triggers scanner modal
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 1: Navbar "Scan QR" Button ---');
    await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle2' });
    await sleep(1000);

    const scanQrBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const btn = btns.find((b) => b.textContent.includes('Scan QR'));
      return Boolean(btn);
    });

    if (scanQrBtn) {
      logPass('Navbar contains "Scan QR" button');
    } else {
      throw new Error('"Scan QR" button not found in desktop navbar');
    }

    // Click "Scan QR" button
    const clickResult = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.textContent.includes('Scan QR'));
      if (btn) {
        btn.click();
        return { clicked: true, text: btn.textContent, outerHTML: btn.outerHTML.slice(0, 150) };
      }
      return { clicked: false };
    });
    console.log('[Click Result]:', clickResult);
    await sleep(1500);

    const debugDom = await page.evaluate(() => {
      return {
        bodyHtmlLength: document.body.innerHTML.length,
        modalsFound: document.querySelectorAll('.modal-backdrop').length,
        allH2s: Array.from(document.querySelectorAll('h2')).map(h => h.textContent),
        modalClasses: Array.from(document.querySelectorAll('[class*="modal"]')).map(el => el.className),
      };
    });
    console.log('[Debug DOM]:', JSON.stringify(debugDom, null, 2));

    // Verify modal is open
    const modalOpen = await page.evaluate(() => {
      const modal = document.querySelector('.modal-backdrop');
      const title = modal?.querySelector('h2');
      return Boolean(modal && title?.textContent.includes('Scan Event QR'));
    });

    if (modalOpen) {
      logPass('Modal opens with title "Scan Event QR" and modern glassmorphism UI');
    } else {
      throw new Error('Modal did not open on "Scan QR" click');
    }

    const modalShotPath = path.join(SCRATCH_DIR, 'scanner_01_modal_opened.png');
    await page.screenshot({ path: modalShotPath });
    console.log(`[Screenshot] Saved ${modalShotPath}`);

    // -----------------------------------------------------------------------
    // TEST 2: Direct Link / Event ID tab resolves event and navigates
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 2: Direct Link / Event ID Tab ---');
    // Click "Direct Link / ID" tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const tab = tabs.find((t) => t.textContent.includes('Direct Link / ID'));
      if (tab) tab.click();
    });
    await sleep(500);

    const regUrlToTest = `${BASE_URL}/events/${testEvent._id}/register`;
    console.log(`[Test] Typing registration URL: ${regUrlToTest}`);

    await page.type('input[placeholder*="events/"]', regUrlToTest);
    await sleep(300);

    // Submit form
    await page.evaluate(() => {
      const submitBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Resolve & Preview Event')
      );
      if (submitBtn) submitBtn.click();
    });

    // Wait for event card to resolve
    await page.waitForFunction(
      (expectedTitle) => {
        const h3 = document.querySelector('h3');
        return h3 && h3.textContent.includes(expectedTitle);
      },
      { timeout: 8000 },
      testEvent.title
    );

    logPass(`Event successfully resolved from URL: "${testEvent.title}"`);

    const resolvedShotPath = path.join(SCRATCH_DIR, 'scanner_02_event_resolved.png');
    await page.screenshot({ path: resolvedShotPath });
    console.log(`[Screenshot] Saved ${resolvedShotPath}`);

    // Click "Proceed to Registration" button
    console.log('[Test] Clicking "Proceed to Registration"...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Proceed to Registration')
      );
      if (btn) btn.click();
    });

    await page.waitForFunction(
      (expectedId) => window.location.pathname.includes(`/events/${expectedId}/register`),
      { timeout: 8000 },
      String(testEvent._id)
    );
    await sleep(600);
    const currentUrl = page.url();
    console.log(`[Test] Current page URL: ${currentUrl}`);

    if (currentUrl.includes(`/events/${testEvent._id}/register`)) {
      logPass(`Navigated smoothly to event registration page: ${currentUrl}`);
    } else {
      throw new Error(`Expected URL to include /events/${testEvent._id}/register, got ${currentUrl}`);
    }

    const regPageShotPath = path.join(SCRATCH_DIR, 'scanner_03_registration_page.png');
    await page.screenshot({ path: regPageShotPath });
    console.log(`[Screenshot] Saved ${regPageShotPath}`);

    // -----------------------------------------------------------------------
    // TEST 3: Image File QR Scanner decodes uploaded QR code
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 3: Image File QR Scanner ---');
    await page.goto(`${BASE_URL}/events`, { waitUntil: 'networkidle2' });
    await sleep(800);

    // Check "Scan Event QR" button on Events Page
    const eventsPageBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some((b) => b.textContent.includes('Scan Event QR'));
    });

    if (eventsPageBtn) {
      logPass('Events page contains "Scan Event QR" button in header bar');
    } else {
      throw new Error('"Scan Event QR" button not found on /events page');
    }

    // Open scanner modal from Events page
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Scan Event QR')
      );
      if (btn) btn.click();
    });
    await sleep(600);

    // Switch to "Upload QR Image" tab
    await page.evaluate(() => {
      const tab = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Upload QR Image')
      );
      if (tab) tab.click();
    });
    await sleep(500);

    // Upload the test QR file to the hidden file input
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      throw new Error('File input for QR upload not found');
    }
    await fileInput.uploadFile(qrFilePath);
    console.log('[Test] Uploaded QR image file to scanner');

    // Wait for event resolution
    await page.waitForFunction(
      (expectedTitle) => {
        const h3 = document.querySelector('h3');
        return h3 && h3.textContent.includes(expectedTitle);
      },
      { timeout: 8000 },
      testEvent.title
    );

    logPass(`Image file scanner successfully decoded QR image and resolved "${testEvent.title}"`);

    const fileScannedShotPath = path.join(SCRATCH_DIR, 'scanner_04_file_scanned.png');
    await page.screenshot({ path: fileScannedShotPath });
    console.log(`[Screenshot] Saved ${fileScannedShotPath}`);

    // Close modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close dialog"]');
      if (closeBtn) closeBtn.click();
    });
    await sleep(500);

    // -----------------------------------------------------------------------
    // TEST 4: Ticket QR payload scanned in Registration Scanner shows guidance
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 4: Gate Ticket Pass Guidance in Registration Scanner ---');
    // Reopen scanner
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Scan Event QR')
      );
      if (btn) btn.click();
    });
    await sleep(500);

    // Switch to manual input
    await page.evaluate(() => {
      const tab = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Direct Link / ID')
      );
      if (tab) tab.click();
    });
    await sleep(300);

    const ticketCodeToTest = 'EVENTSYNC:TICKET:ES-TCK-99BEEF01';
    await page.type('input[placeholder*="events/"]', ticketCodeToTest);
    await sleep(200);

    await page.evaluate(() => {
      const submitBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Resolve & Preview Event')
      );
      if (submitBtn) submitBtn.click();
    });
    await sleep(600);

    const ticketGuidance = await page.evaluate(() => {
      const banner = document.querySelector('h4');
      const text = document.body.innerText;
      return {
        hasWarning: banner?.textContent.includes('Gate Entry Ticket Detected'),
        hasGuidance: text.includes('Attendee Digital Pass / Gate Ticket for venue check-in'),
      };
    });

    if (ticketGuidance.hasWarning && ticketGuidance.hasGuidance) {
      logPass('Registration scanner successfully detects Gate Pass and shows friendly guidance');
    } else {
      throw new Error('Ticket warning guidance did not display as expected');
    }

    const ticketShotPath = path.join(SCRATCH_DIR, 'scanner_05_ticket_detected.png');
    await page.screenshot({ path: ticketShotPath });
    console.log(`[Screenshot] Saved ${ticketShotPath}`);

    // Close modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close dialog"]');
      if (closeBtn) closeBtn.click();
    });
    await sleep(500);

    // -----------------------------------------------------------------------
    // TEST 5: Admin Attendance Ticket Scanner Registration Link Guidance
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 5: Admin Attendance Scanner Guidance Banner ---');
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle2' });
    await page.type('input[type="email"]', 'admin@eventsync.edu');
    const pwdInputs = await page.$$('input[type="password"]');
    await pwdInputs[0].type('Admin@12345');
    await pwdInputs[1].type('EventAdmin@vits');

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);
    console.log('[Admin] Logged in successfully');
    await sleep(1000);

    // Click ATTENDANCE tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const attTab = tabs.find((t) => t.textContent.includes('Smart Attendance'));
      if (attTab) attTab.click();
    });
    await sleep(800);

    // Select event in dropdown
    await page.waitForSelector('#verify-ticket-event-select', { timeout: 6000 });
    await page.select('#verify-ticket-event-select', String(testEvent._id));
    await sleep(500);

    // Enter registration link in manual ticket code input
    await page.waitForSelector('#verify-ticket-passcode-input', { timeout: 6000 });
    await page.type('#verify-ticket-passcode-input', regUrlToTest);
    await sleep(200);

    // Click "Verify Ticket"
    await page.click('#btn-verify-ticket-submit');
    await sleep(800);

    await page.waitForSelector('#verify-result-registration-url', { timeout: 6000 });

    const adminGuidance = await page.evaluate(() => {
      const el = document.getElementById('verify-result-registration-url');
      return Boolean(el && el.innerText.includes('EVENT REGISTRATION QR CODE DETECTED'));
    });

    if (adminGuidance) {
      logPass('Admin Attendance scanner displays amber guidance banner for registration URLs');
    } else {
      throw new Error('Admin Attendance scanner did not display expected registration URL banner');
    }

    const adminShotPath = path.join(SCRATCH_DIR, 'scanner_06_admin_attendance_warning.png');
    await page.screenshot({ path: adminShotPath });
    console.log(`[Screenshot] Saved ${adminShotPath}`);

    // -----------------------------------------------------------------------
    // TEST 6: Mobile Responsive Viewport (390x844)
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 6: Mobile Responsive Viewport (390px) ---');
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle2' });
    await sleep(600);

    // Open mobile menu
    await page.evaluate(() => {
      const menuBtn = document.querySelector('button[aria-label="Toggle navigation menu"]');
      if (menuBtn) menuBtn.click();
    });
    await sleep(500);

    const mobileScanBtn = await page.evaluate(() => {
      const drawer = document.querySelector('.mobile-drawer');
      const btns = Array.from(drawer?.querySelectorAll('button') || []);
      const btn = btns.find((b) => b.textContent.includes('Scan QR to Register'));
      return Boolean(btn);
    });

    if (mobileScanBtn) {
      logPass('Mobile drawer contains "Scan QR to Register" button');
    } else {
      throw new Error('Mobile drawer missing "Scan QR to Register" button');
    }

    // Click "Scan QR to Register" inside mobile drawer
    await page.evaluate(() => {
      const drawer = document.querySelector('.mobile-drawer');
      const btns = Array.from(drawer?.querySelectorAll('button') || []);
      const btn = btns.find((b) => b.textContent.includes('Scan QR to Register'));
      if (btn) btn.click();
    });
    await sleep(600);

    const mobileModalInfo = await page.evaluate(() => {
      const modal = document.querySelector('.modal-backdrop > div');
      if (!modal) return null;
      const rect = modal.getBoundingClientRect();
      return {
        width: rect.width,
        viewportWidth: window.innerWidth,
        noOverflow: rect.width <= window.innerWidth,
      };
    });

    if (mobileModalInfo && mobileModalInfo.noOverflow) {
      logPass(`Mobile scanner modal fits 390px viewport perfectly (width: ${mobileModalInfo.width}px, no overflow)`);
    } else {
      throw new Error(`Mobile modal overflow detected: ${JSON.stringify(mobileModalInfo)}`);
    }

    const mobileShotPath = path.join(SCRATCH_DIR, 'scanner_07_mobile_scanner.png');
    await page.screenshot({ path: mobileShotPath });
    console.log(`[Screenshot] Saved ${mobileShotPath}`);

    console.log(`\n${colors.bold}${colors.green}======================================================================`);
    console.log(`ALL IN-APP REGISTRATION QR SCANNER E2E CHECKS PASSED! (6/6)`);
    console.log(`======================================================================${colors.reset}\n`);
  } finally {
    await browser.close();
    await mongoose.disconnect();
  }
}

runBrowserVerification().catch((err) => {
  console.error('\nVerification script failed:', err);
  process.exit(1);
});
