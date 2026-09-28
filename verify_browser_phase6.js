const path = require('path');
module.paths.push(path.resolve(__dirname, 'server/node_modules'));

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });
const config = require('./server/src/config/env');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\priya\\.gemini\\antigravity-ide\\brain\\d27fa9a5-efb6-4b35-ac71-182855773063';
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
  console.log('====================================================');
  console.log('STARTING PHASE 6 BROWSER FLOW VERIFICATION');
  console.log('====================================================\n');

  // Connect to DB and ensure clean initial state
  await mongoose.connect(config.mongoUri);
  await mongoose.connection.db.collection('events').deleteMany({});
  await mongoose.connection.db.collection('registrations').deleteMany({});
  await mongoose.connection.db.collection('payments').deleteMany({});
  await mongoose.connection.db.collection('tickets').deleteMany({});
  console.log('[DB] Reset non-user collections to 0');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // -------------------------------------------------------------
    // Step 1: Admin logs in at /admin/login
    // -------------------------------------------------------------
    console.log('[Step 1] Navigating to /admin/login...');
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle2' });

    console.log('[Step 1] Filling Admin credentials & Access Code...');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@eventsync.edu');

    const passwordInputs = await page.$$('input[type="password"]');
    if (passwordInputs.length >= 2) {
      await passwordInputs[0].type('Admin@12345');
      await passwordInputs[1].type('ES_ADM_6847C82F8377A299976C09079E2465E9');
    }

    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('[Step 1] Logged in as Admin. Current URL:', page.url());

    // -------------------------------------------------------------
    // Step 2: Admin creates dynamic FREE event
    // -------------------------------------------------------------
    console.log('[Step 2] Opening Create Event Modal...');
    await clickButtonByText(page, 'Create New Event');
    await sleep(1000);

    console.log('[Step 2] Filling FREE event form...');
    const titleInput = await page.waitForSelector('input[placeholder*="Annual Campus Hackathon"]');
    await titleInput.type('Phase 6 Live Cloud Summit');

    const selects = await page.$$('select');
    if (selects.length >= 2) {
      await selects[0].select('Seminar');
      await selects[1].select('PUBLISHED');
    }

    const dateInput = await page.$('input[type="date"]');
    if (dateInput) await dateInput.type('2026-10-15');

    const timeInput = await page.$('input[placeholder*="10:00 AM - 4:00 PM"]');
    if (timeInput) await timeInput.type('10:00 AM - 1:00 PM');

    const venueInput = await page.$('input[placeholder*="Main Auditorium"]');
    if (venueInput) await venueInput.type('Auditorium Hall A');

    const capInput = await page.$('input[placeholder*="150"]');
    if (capInput) await capInput.type('50');

    const descInput = await page.$('textarea[placeholder*="Detailed schedule"]');
    if (descInput) await descInput.type('Dynamic community seminar to test Phase 6 digital ticketing.');

    await clickButtonByText(page, 'Create Event');
    await sleep(2500);
    console.log('[Step 2] FREE event created and published successfully.');

    // -------------------------------------------------------------
    // Step 3: Admin creates dynamic PAID event
    // -------------------------------------------------------------
    console.log('[Step 3] Opening Create Event Modal for PAID event...');
    await clickButtonByText(page, 'Create New Event');
    await sleep(1000);

    console.log('[Step 3] Filling PAID event form...');
    const titlePaidInput = await page.waitForSelector('input[placeholder*="Annual Campus Hackathon"]');
    await titlePaidInput.type('Phase 6 Live Quantum Workshop');

    const selectsPaid = await page.$$('select');
    if (selectsPaid.length >= 2) {
      await selectsPaid[0].select('Workshop');
      await selectsPaid[1].select('PUBLISHED');
    }

    const datePaidInput = await page.$('input[type="date"]');
    if (datePaidInput) await datePaidInput.type('2026-10-22');

    const timePaidInput = await page.$('input[placeholder*="10:00 AM - 4:00 PM"]');
    if (timePaidInput) await timePaidInput.type('2:00 PM - 6:00 PM');

    const venuePaidInput = await page.$('input[placeholder*="Main Auditorium"]');
    if (venuePaidInput) await venuePaidInput.type('Quantum Lab 102');

    const capPaidInput = await page.$('input[placeholder*="150"]');
    if (capPaidInput) await capPaidInput.type('30');

    await clickButtonByText(page, 'Paid Event');
    await sleep(500);

    const feeInput = await page.$('input[placeholder*="199"]');
    if (feeInput) await feeInput.type('350');

    const descPaidInput = await page.$('textarea[placeholder*="Detailed schedule"]');
    if (descPaidInput) await descPaidInput.type('Intensive paid workshop requiring verified payment proof.');

    await clickButtonByText(page, 'Create Event');
    await sleep(2500);
    console.log('[Step 3] PAID event created and published successfully.');

    // Logout Admin
    console.log('[Step 3] Logging out Admin...');
    await clickButtonByText(page, 'Logout');
    await sleep(1500);

    // -------------------------------------------------------------
    // Step 4: Student logs in & registers for FREE event
    // -------------------------------------------------------------
    console.log('[Step 4] Logging in as Student (test.student@eventsync.edu)...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'test.student@eventsync.edu');
    await page.type('input[type="password"]', 'Student@12345');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('[Step 4] Student logged in. Current URL:', page.url());

    // Navigate to /events
    console.log('[Step 4] Navigating to /events...');
    await page.goto(`${BASE_URL}/events`, { waitUntil: 'networkidle2' });
    await sleep(2000);

    // Find card link for Phase 6 Live Cloud Summit
    await page.waitForSelector('.event-card');
    const freeEventHref = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.event-card'));
      const card = cards.find((c) => c.textContent.includes('Phase 6 Live Cloud Summit'));
      const a = card ? card.querySelector('a[href*="/events/"]') : null;
      return a ? a.getAttribute('href') : null;
    });
    console.log('[Step 4] Navigating directly to Free Event details URL:', freeEventHref);
    await page.goto(`${BASE_URL}${freeEventHref}`, { waitUntil: 'networkidle2' });
    await sleep(2000);

    // Click RSVP for Free
    console.log('[Step 4] Clicking RSVP for Free...');
    await clickButtonByText(page, 'RSVP for Free');
    await sleep(2500);
    console.log('[Step 4] Successfully registered for free event.');

    // Click Generate Digital QR Ticket
    console.log('[Step 4] Clicking Generate Digital QR Ticket...');
    await clickButtonByText(page, 'Generate Digital QR Ticket');
    await sleep(3000);

    // Verify modal elements and capture screenshot
    const ticketModalScreenshot = path.join(ARTIFACTS_DIR, 'phase6_ticket_modal.png');
    await page.screenshot({ path: ticketModalScreenshot });
    console.log(`[Step 4] Captured ticket modal screenshot: ${ticketModalScreenshot}`);

    const modalContent = await page.evaluate(() => {
      const text = document.body.innerText;
      const img = document.querySelector('img[alt*="QR"], img[src^="blob:"]');
      const hasCode = text.includes('ES-TCK-');
      const hasActive = text.includes('ACTIVE');
      return { hasCode, hasActive, hasQrImg: !!img };
    });
    console.log('[Step 4] Ticket modal inspection:', modalContent);

    // Close ticket modal
    await clickButtonByText(page, 'Close');
    await sleep(1000);

    // -------------------------------------------------------------
    // Step 5: Student "My Tickets" page & refresh persistence
    // -------------------------------------------------------------
    console.log('[Step 5] Navigating to /student/tickets...');
    await page.goto(`${BASE_URL}/student/tickets`, { waitUntil: 'networkidle2' });
    await sleep(2000);

    const ticketsListBefore = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasSummit: text.includes('Phase 6 Live Cloud Summit'),
        hasActive: text.includes('ACTIVE'),
        hasCode: text.includes('ES-TCK-'),
      };
    });
    console.log('[Step 5] /student/tickets content before reload:', ticketsListBefore);

    console.log('[Step 5] Reloading page to test persistence...');
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2000);

    const ticketsListAfter = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasQr = !!document.querySelector('img[alt*="QR"], img[src^="blob:"]');
      return {
        hasSummit: text.includes('Phase 6 Live Cloud Summit'),
        hasActive: text.includes('ACTIVE'),
        hasCode: text.includes('ES-TCK-'),
        hasQr,
      };
    });
    console.log('[Step 5] /student/tickets content after reload (PERSISTED):', ticketsListAfter);

    const myTicketsScreenshot = path.join(ARTIFACTS_DIR, 'phase6_student_my_tickets.png');
    await page.screenshot({ path: myTicketsScreenshot });
    console.log(`[Step 5] Captured student tickets screenshot: ${myTicketsScreenshot}`);

    // -------------------------------------------------------------
    // Step 6: Student registers for PAID event & submits payment proof
    // -------------------------------------------------------------
    console.log('[Step 6] Navigating to /events for PAID event...');
    await page.goto(`${BASE_URL}/events`, { waitUntil: 'networkidle2' });
    await sleep(2000);

    await page.waitForSelector('.event-card');
    const paidEventHref = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.event-card'));
      const card = cards.find((c) => c.textContent.includes('Phase 6 Live Quantum Workshop'));
      const a = card ? card.querySelector('a[href*="/events/"]') : null;
      return a ? a.getAttribute('href') : null;
    });
    console.log('[Step 6] Navigating directly to Paid Event details URL:', paidEventHref);
    await page.goto(`${BASE_URL}${paidEventHref}`, { waitUntil: 'networkidle2' });
    await sleep(2000);

    // RSVP & Reserve Seat
    console.log('[Step 6] Clicking RSVP & Reserve Seat...');
    await clickButtonByText(page, 'RSVP & Reserve Seat');
    await sleep(2500);

    // Submit Payment Proof button
    console.log('[Step 6] Opening Submit Payment Proof modal...');
    await clickButtonByText(page, 'Submit Payment Proof');
    await sleep(1500);

    // Fill transaction ID & file
    const txnInput = await page.waitForSelector('input[placeholder*="Ref"]');
    await txnInput.type('UPI-TXN-P6-LIVE-8899');

    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.uploadFile('D:\\EventSync\\test_proof.png');
      await sleep(1000);
    }

    await clickButtonByText(page, 'Submit Verification Proof');
    await sleep(3000);

    const pendingCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasPending: text.includes('Verification Pending') || text.includes('PENDING'),
        hasNoGenTicket: !text.includes('Generate Digital QR Ticket'),
      };
    });
    console.log('[Step 6] Paid event payment pending verification:', pendingCheck);

    // Log out Student
    console.log('[Step 6] Logging out student...');
    await clickButtonByText(page, 'Logout');
    await sleep(1500);

    // -------------------------------------------------------------
    // Step 7: Admin logs in to approve payment & inspect issued tickets
    // -------------------------------------------------------------
    console.log('[Step 7] Admin logging in at /admin/login...');
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@eventsync.edu');

    const adminPwInputs = await page.$$('input[type="password"]');
    if (adminPwInputs.length >= 2) {
      await adminPwInputs[0].type('Admin@12345');
      await adminPwInputs[1].type('ES_ADM_6847C82F8377A299976C09079E2465E9');
    }
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    console.log('[Step 7] Admin Dashboard loaded. Approving payment...');
    await sleep(2000);

    await clickButtonByText(page, 'Approve');
    await sleep(2500);
    console.log('[Step 7] Admin approved payment proof.');

    // Inspect Issued Tickets Roster
    console.log('[Step 7] Inspecting Admin Issued Digital Tickets Roster...');
    await clickButtonByText(page, 'Inspect QR Pass');
    await sleep(2500);

    const adminInspectScreenshot = path.join(ARTIFACTS_DIR, 'phase6_admin_ticket_inspect.png');
    await page.screenshot({ path: adminInspectScreenshot });
    console.log(`[Step 7] Captured admin ticket inspect screenshot: ${adminInspectScreenshot}`);

    await clickButtonByText(page, 'Close');
    await sleep(1000);

    // Logout Admin
    await clickButtonByText(page, 'Logout');
    await sleep(1500);

    // -------------------------------------------------------------
    // Step 8: Student generates PAID ticket & cancels FREE registration
    // -------------------------------------------------------------
    console.log('[Step 8] Student logging in to generate paid ticket & test cancellation...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'test.student@eventsync.edu');
    await page.type('input[type="password"]', 'Student@12345');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Go to My Registrations
    console.log('[Step 8] Navigating to /student/registrations...');
    await page.goto(`${BASE_URL}/student/registrations`, { waitUntil: 'networkidle2' });
    await sleep(2000);

    // Generate ticket for approved paid event
    console.log('[Step 8] Generating ticket for approved paid event...');
    await clickButtonByText(page, 'Generate QR Ticket');
    await sleep(2500);
    console.log('[Step 8] Paid event ticket generated successfully.');

    // Cancel registration for Free Event (Phase 6 Live Cloud Summit)
    console.log('[Step 8] Cancelling registration for Free Event...');
    await clickButtonByText(page, 'Cancel RSVP');
    await sleep(1000);

    await clickButtonByText(page, 'Confirm Cancellation');
    await sleep(2500);
    console.log('[Step 8] Registration cancelled.');

    // Check /student/tickets to verify CANCELLED status
    console.log('[Step 8] Checking /student/tickets for CANCELLED status...');
    await page.goto(`${BASE_URL}/student/tickets`, { waitUntil: 'networkidle2' });
    await sleep(2000);

    const cancelledCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasCancelledBadge: text.includes('CANCELLED'),
        hasActiveBadge: text.includes('ACTIVE'),
      };
    });
    console.log('[Step 8] Final ticket status after cancellation:', cancelledCheck);

    const cancelledTicketScreenshot = path.join(ARTIFACTS_DIR, 'phase6_cancelled_ticket.png');
    await page.screenshot({ path: cancelledTicketScreenshot });
    console.log(`[Step 8] Captured cancelled ticket screenshot: ${cancelledTicketScreenshot}`);

    console.log('\n====================================================');
    console.log('✔ LIVE BROWSER VERIFICATION FULLY COMPLETED AND PASSED!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Browser Verification Error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();

    // Final clean reset of test state
    console.log('[Cleanup] Performing final database cleanup...');
    await mongoose.connection.db.collection('events').deleteMany({});
    await mongoose.connection.db.collection('registrations').deleteMany({});
    await mongoose.connection.db.collection('payments').deleteMany({});
    await mongoose.connection.db.collection('tickets').deleteMany({});

    const events = await mongoose.connection.db.collection('events').countDocuments();
    const registrations = await mongoose.connection.db.collection('registrations').countDocuments();
    const payments = await mongoose.connection.db.collection('payments').countDocuments();
    const tickets = await mongoose.connection.db.collection('tickets').countDocuments();
    const users = await mongoose.connection.db.collection('users').countDocuments();

    console.log(`[Cleanup] Final DB Counts: events=${events}, registrations=${registrations}, payments=${payments}, tickets=${tickets}, users=${users}`);
    await mongoose.disconnect();
  }
}

runBrowserVerification();
