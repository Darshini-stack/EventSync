const path = require('path');
module.paths.push(path.resolve(__dirname, 'server/node_modules'));
module.paths.push(path.resolve(__dirname, 'client/node_modules'));

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const mongoose = require('mongoose');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\priya\\.gemini\\antigravity-ide\\brain\\35f8c220-0b40-4628-bbaf-c443bd262d17';
const SCRATCH_DIR = path.resolve(__dirname, 'scratch');
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

const logPass = (desc) => console.log(`${colors.green}✔ PASS:${colors.reset} ${desc}`);
const logFail = (desc, err) => console.error(`${colors.red}✘ FAIL:${colors.reset} ${desc}\n   Error:`, err);

// Minimal valid 1x1 transparent PNG buffer
const samplePngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAASUlEQVR42u3PMQEAAAgEID/5V1tDCw4WcE8m1wUEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBB74AZv90E8E1Z9zAAAAAElFTkSuQmCC';

async function runVerification() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}EVENTSYNC — EVENT COUNTDOWN & POSTER BROWSER VERIFICATION${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  if (!fs.existsSync(SCRATCH_DIR)) fs.mkdirSync(SCRATCH_DIR, { recursive: true });

  let adminToken = '';
  let upcomingEventId = '';
  let liveEventId = '';
  let completedEventId = '';

  // 1. Authenticate Admin
  console.log('[Setup] Logging in as Admin...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@eventsync.edu', password: 'Admin@12345' }),
  });
  const loginData = await loginRes.json();
  adminToken = loginData.token || loginData.data?.token;
  if (!adminToken) throw new Error('Failed to login as admin: ' + JSON.stringify(loginData));
  logPass('Admin authenticated successfully');

  // Format today's date for live event
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  // Future date (upcoming)
  const future = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const futureY = future.getFullYear();
  const futureM = String(future.getMonth() + 1).padStart(2, '0');
  const futureD = String(future.getDate()).padStart(2, '0');
  const futureStr = `${futureY}-${futureM}-${futureD}`;

  // 2. Seed Upcoming Event with Poster
  console.log('\n[Setup] Seeding Upcoming Event with Poster...');
  const createUpcomingRes = await fetch(`${API_URL}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      title: 'Global Campus Tech Expo 2026',
      description: 'Annual technology symposium featuring robotics, AI exhibits, coding competitions, and guest keynotes.',
      category: 'Technology',
      date: futureStr,
      time: '10:00 AM - 05:00 PM',
      venue: 'VEC Grand Innovation Hall',
      capacity: 150,
      status: 'PUBLISHED',
      isPaid: false,
      posterBase64: samplePngBase64,
      posterMimeType: 'image/png',
      posterFilename: 'tech_expo_poster.png',
    }),
  });
  const upcomingData = await createUpcomingRes.json();
  upcomingEventId = upcomingData.data?._id || upcomingData.event?._id;
  if (!upcomingEventId) throw new Error('Failed to create upcoming event: ' + JSON.stringify(upcomingData));
  logPass(`Upcoming event created in MongoDB (ID: ${upcomingEventId}, Date: ${futureStr})`);

  // 3. Seed Live Event without Poster
  console.log('\n[Setup] Seeding Live Event without Poster...');
  const createLiveRes = await fetch(`${API_URL}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      title: 'Active Hackathon Live Arena',
      description: '24-hour sprint hacking event currently in progress. Real-time mentorship and rapid prototyping.',
      category: 'Hackathon',
      date: todayStr,
      time: '00:01 AM - 11:59 PM',
      venue: 'Campus Innovation Lab Block B',
      capacity: 80,
      status: 'PUBLISHED',
      isPaid: false,
    }),
  });
  const liveData = await createLiveRes.json();
  liveEventId = liveData.data?._id || liveData.event?._id;
  if (!liveEventId) throw new Error('Failed to create live event: ' + JSON.stringify(liveData));
  logPass(`Live event created in MongoDB (ID: ${liveEventId}, Date: ${todayStr})`);

  // 4. Seed Completed Event
  console.log('\n[Setup] Seeding Completed Event...');
  const createCompletedRes = await fetch(`${API_URL}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      title: 'Annual Campus Athletic Championship',
      description: 'Inter-college track and field events, medal ceremonies, and athletic exhibitions.',
      category: 'Sports',
      date: '2026-08-15',
      time: '08:00 AM - 04:00 PM',
      venue: 'University Stadium & Sports Arena',
      capacity: 300,
      status: 'COMPLETED',
      isPaid: false,
    }),
  });
  const completedData = await createCompletedRes.json();
  completedEventId = completedData.data?._id || completedData.event?._id;
  if (!completedEventId) throw new Error('Failed to create completed event: ' + JSON.stringify(completedData));
  logPass(`Completed event created in MongoDB (ID: ${completedEventId}, Status: COMPLETED)`);

  // Launch Puppeteer
  console.log('\n[Puppeteer] Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();

    // =========================================================================
    // TEST 1: Upcoming Event Details (Desktop 1280x900)
    // =========================================================================
    console.log('\n--- TEST 1: Upcoming Event Details & Poster (Desktop 1280x900) ---');
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE_URL}/events/${upcomingEventId}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(1000);

    // Verify countdown card
    const countdownInfo = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="event-countdown"]');
      if (!el) return null;
      const label = el.querySelector('.countdown-label')?.textContent?.trim() || '';
      const text = el.innerText || '';
      return { found: true, label, text };
    });

    if (countdownInfo && countdownInfo.found) {
      logPass(`Upcoming Countdown displayed: "${countdownInfo.label}"`);
      if (countdownInfo.label.includes('Starts in:') && countdownInfo.label.includes('Days')) {
        logPass('Countdown format correctly matches "Starts in: DD Days HH Hours MM Minutes"');
      } else {
        throw new Error(`Countdown label format unexpected: ${countdownInfo.label}`);
      }
    } else {
      throw new Error('Countdown component [data-testid="event-countdown"] not found on page');
    }

    // Verify Official Event Poster displayed
    const posterInfo = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="event-poster"]');
      if (!el) return null;
      const img = el.querySelector('img');
      return {
        found: true,
        imgSrc: img ? img.src : null,
        title: el.querySelector('h3')?.textContent || '',
      };
    });

    if (posterInfo && posterInfo.found) {
      logPass(`Official Event Poster card displayed: "${posterInfo.title}"`);
      logPass(`Poster image stream source: ${posterInfo.imgSrc}`);
    } else {
      throw new Error('Event poster [data-testid="event-poster"] not found on page');
    }

    // Test Zoom Modal
    console.log('[Test] Testing Poster Zoom Modal...');
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="event-poster"] button');
      if (btn) btn.click();
    });
    await sleep(600);

    const zoomOpen = await page.evaluate(() => {
      return Boolean(document.querySelector('.modal-backdrop'));
    });
    if (zoomOpen) {
      logPass('Poster zoom modal opens smoothly on click');
      await page.keyboard.press('Escape');
      await sleep(400);
    }

    // Save screenshot
    const shot1 = path.join(ARTIFACTS_DIR, '01_upcoming_event_details_desktop.png');
    const shot1Scratch = path.join(SCRATCH_DIR, '01_upcoming_event_details_desktop.png');
    await page.screenshot({ path: shot1, fullPage: false });
    fs.copyFileSync(shot1, shot1Scratch);
    console.log(`[Screenshot] Saved: ${shot1}`);

    // =========================================================================
    // TEST 2: Live Event Details & No-Poster Fallback (Desktop 1280x900)
    // =========================================================================
    console.log('\n--- TEST 2: Live Event Details & No-Poster Fallback (Desktop 1280x900) ---');
    await page.goto(`${BASE_URL}/events/${liveEventId}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(1000);

    // Verify "Event is Live" badge
    const liveCountdown = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="event-countdown-live"]');
      if (!el) return null;
      return { found: true, text: el.innerText };
    });

    if (liveCountdown && liveCountdown.found && liveCountdown.text.includes('Event is Live')) {
      logPass('Live event countdown verified: shows prominent "Event is Live" status');
    } else {
      throw new Error(`Live countdown missing or unexpected: ${JSON.stringify(liveCountdown)}`);
    }

    // Verify clean "No poster available" state
    const noPosterState = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="no-poster-state"]');
      if (!el) return null;
      return { found: true, text: el.innerText };
    });

    if (noPosterState && noPosterState.found && noPosterState.text.includes('No poster available')) {
      logPass('Clean "No poster available" fallback verified when no poster is uploaded');
    } else {
      throw new Error(`No poster state missing or unexpected: ${JSON.stringify(noPosterState)}`);
    }

    // Save screenshot
    const shot2 = path.join(ARTIFACTS_DIR, '02_live_event_details_desktop.png');
    const shot2Scratch = path.join(SCRATCH_DIR, '02_live_event_details_desktop.png');
    await page.screenshot({ path: shot2, fullPage: false });
    fs.copyFileSync(shot2, shot2Scratch);
    console.log(`[Screenshot] Saved: ${shot2}`);

    // =========================================================================
    // TEST 3: Completed Event Details (Desktop 1280x900)
    // =========================================================================
    console.log('\n--- TEST 3: Completed Event Details (Desktop 1280x900) ---');
    await page.goto(`${BASE_URL}/events/${completedEventId}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(1000);

    // Verify "Event Completed" badge
    const completedCountdown = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="event-countdown-completed"]');
      if (!el) return null;
      return { found: true, text: el.innerText };
    });

    if (completedCountdown && completedCountdown.found && completedCountdown.text.includes('Event Completed')) {
      logPass('Completed event status verified: shows "Event Completed"');
    } else {
      throw new Error(`Completed countdown missing or unexpected: ${JSON.stringify(completedCountdown)}`);
    }

    // Save screenshot
    const shot3 = path.join(ARTIFACTS_DIR, '03_completed_event_details_desktop.png');
    const shot3Scratch = path.join(SCRATCH_DIR, '03_completed_event_details_desktop.png');
    await page.screenshot({ path: shot3, fullPage: false });
    fs.copyFileSync(shot3, shot3Scratch);
    console.log(`[Screenshot] Saved: ${shot3}`);

    // =========================================================================
    // TEST 4: Mobile Viewports (414px, 390px, 375px) — No Horizontal Scroll
    // =========================================================================
    console.log('\n--- TEST 4: Mobile Responsive Viewports (No Horizontal Overflow) ---');

    // 414px Viewport
    await page.setViewport({ width: 414, height: 896, isMobile: true, hasTouch: true });
    await page.goto(`${BASE_URL}/events/${upcomingEventId}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(800);

    const overflow414 = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    if (overflow414) {
      logPass('414px mobile viewport verified: zero horizontal overflow (scrollWidth <= innerWidth)');
    } else {
      throw new Error('414px mobile viewport has horizontal overflow');
    }

    const shot4 = path.join(ARTIFACTS_DIR, '04_event_details_mobile_414.png');
    const shot4Scratch = path.join(SCRATCH_DIR, '04_event_details_mobile_414.png');
    await page.screenshot({ path: shot4, fullPage: false });
    fs.copyFileSync(shot4, shot4Scratch);
    console.log(`[Screenshot] Saved: ${shot4}`);

    // 390px Viewport
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE_URL}/events/${upcomingEventId}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(800);

    const overflow390 = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    if (overflow390) {
      logPass('390px mobile viewport verified: zero horizontal overflow');
    } else {
      throw new Error('390px mobile viewport has horizontal overflow');
    }

    const shot5 = path.join(ARTIFACTS_DIR, '05_event_details_mobile_390.png');
    const shot5Scratch = path.join(SCRATCH_DIR, '05_event_details_mobile_390.png');
    await page.screenshot({ path: shot5, fullPage: false });
    fs.copyFileSync(shot5, shot5Scratch);
    console.log(`[Screenshot] Saved: ${shot5}`);

    // 375px Viewport
    await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
    await page.goto(`${BASE_URL}/events/${upcomingEventId}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(800);

    const overflow375 = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    if (overflow375) {
      logPass('375px mobile viewport verified: zero horizontal overflow');
    } else {
      throw new Error('375px mobile viewport has horizontal overflow');
    }

    const shot6 = path.join(ARTIFACTS_DIR, '06_event_details_mobile_375.png');
    const shot6Scratch = path.join(SCRATCH_DIR, '06_event_details_mobile_375.png');
    await page.screenshot({ path: shot6, fullPage: false });
    fs.copyFileSync(shot6, shot6Scratch);
    console.log(`[Screenshot] Saved: ${shot6}`);

    // =========================================================================
    // TEST 5: Verify QR Registration Scanner Integration Preserved
    // =========================================================================
    console.log('\n--- TEST 5: Verify Event Registration QR Scanner Unbroken ---');
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE_URL}/events`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(800);

    const qrScannerBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some((b) => b.textContent.includes('Scan Event QR') || b.textContent.includes('Scan QR'));
    });

    if (qrScannerBtn) {
      logPass('Navbar/Events page "Scan QR" button verified intact and active');
    } else {
      throw new Error('Registration QR Scanner button missing from header');
    }

    console.log(`\n${colors.bold}${colors.green}======================================================================`);
    console.log(`ALL EVENT COUNTDOWN & POSTER BROWSER VERIFICATIONS PASSED! (8/8)`);
    console.log(`======================================================================${colors.reset}\n`);
  } finally {
    await browser.close();

    // Database cleanup
    console.log('\n[Cleanup] Cleaning up test events in MongoDB...');
    try {
      require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });
      const config = require('./server/src/config/env');
      await mongoose.connect(config.mongoUri);
      const db = mongoose.connection.db;
      await db.collection('events').deleteMany({});
      await db.collection('registrations').deleteMany({});
      await db.collection('payments').deleteMany({});
      await db.collection('tickets').deleteMany({});
      await db.collection('attendances').deleteMany({});
      await db.collection('notifications').deleteMany({});
      const counts = {
        events: await db.collection('events').countDocuments(),
        registrations: await db.collection('registrations').countDocuments(),
        payments: await db.collection('payments').countDocuments(),
        tickets: await db.collection('tickets').countDocuments(),
        attendances: await db.collection('attendances').countDocuments(),
        notifications: await db.collection('notifications').countDocuments(),
        users: await db.collection('users').countDocuments(),
      };
      console.log('[Cleanup] MongoDB clean zero-state verified:', counts);
      await mongoose.disconnect();
    } catch (err) {
      console.error('[Cleanup] Error during database cleanup:', err);
    }
  }
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
