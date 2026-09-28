const path = require('path');
module.paths.push(path.resolve(__dirname, '../server/node_modules'));
module.paths.push(path.resolve(__dirname, '../client/node_modules'));

const puppeteer = require('puppeteer-core');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
const config = require('../server/src/config/env');
const User = require('../server/src/models/User');
const Event = require('../server/src/models/Event');
const Registration = require('../server/src/models/Registration');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('=== BROWSER UI VERIFICATION FOR EVENT REGISTRATION & QR CODE ===');
  await mongoose.connect(config.mongoUri);

  // 1. Create a published test event in MongoDB
  const futureDate = new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0];
  const adminUser = await User.findOne({ email: 'admin@eventsync.edu' });
  const testEvent = await Event.create({
    title: 'University Hackfest & Tech Summit 2026',
    description: 'Premier campus-wide innovation challenge and coding symposium.',
    category: 'Hackathon',
    date: new Date(futureDate),
    time: '10:00 AM - 06:00 PM',
    venue: 'Campus Innovation Center, Room 402',
    capacity: 60,
    availableSeats: 60,
    status: 'PUBLISHED',
    isPaid: false,
    fee: 0,
    mode: 'Offline',
    maxTeamSize: 4,
    createdBy: adminUser._id,
  });

  console.log(`[Event Created in DB] ID: ${testEvent._id}, Title: ${testEvent.title}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('PAGE ERROR LOG:', msg.text());
  });

  try {
    // -------------------------------------------------------------
    // STEP 1: Verify Event Details Page shows Registration QR & Link
    // -------------------------------------------------------------
    console.log(`\nNavigating to Event Details: ${BASE_URL}/events/${testEvent._id}`);
    await page.goto(`${BASE_URL}/events/${testEvent._id}`, { waitUntil: 'networkidle2' });
    await sleep(1000);

    const eventTitle = await page.$eval('h1', (el) => el.innerText);
    console.log(`[Event Details] Found Title: "${eventTitle}"`);

    // Verify registration link is present and does not have localhost when public URL is configured
    const regLink = await page.$eval('code', (el) => el.innerText);
    console.log(`[Event Details] Registration Link displayed: "${regLink}"`);
    if (!regLink.includes(`/events/${testEvent._id}/register`)) {
      throw new Error(`Registration link did not include /events/${testEvent._id}/register: ${regLink}`);
    }

    // -------------------------------------------------------------
    // STEP 2: Navigate to Event Registration Page directly
    // Expected: Registration Form loaded, NO EVENTADMIN ACCESS DENIED
    // -------------------------------------------------------------
    const regPageUrl = `${BASE_URL}/events/${testEvent._id}/register`;
    console.log(`\nNavigating to Registration Page: ${regPageUrl}`);
    await page.goto(regPageUrl, { waitUntil: 'networkidle2' });
    await sleep(1500);

    // Check page text for any "Requires one of the following roles" or "Access denied"
    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.includes('Requires one of the following roles: [EVENTADMIN]')) {
      throw new Error('Registration page displayed EVENTADMIN access denied!');
    }
    if (pageText.includes('Access denied')) {
      throw new Error(`Registration page displayed Access denied: ${pageText.slice(0, 200)}`);
    }

    // Check that form elements are rendered
    const formHeading = await page.$eval('h1', (el) => el.innerText);
    console.log(`[Registration Page] Loaded successfully! Title: "${formHeading}"`);

    const hasNameInput = await page.$('input[placeholder*="full name"]');
    const hasRollInput = await page.$('input[placeholder*="2473A"]');
    const hasSubmitBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some((b) => b.innerText.includes('Submit Registration'));
    });

    console.log(`[Registration Form] Name Input: ${!!hasNameInput}, Roll Input: ${!!hasRollInput}, Submit Button: ${hasSubmitBtn}`);

    if (!hasNameInput || !hasRollInput || !hasSubmitBtn) {
      throw new Error('Registration form inputs or submit button missing from page!');
    }

    // -------------------------------------------------------------
    // STEP 3: Student Logs In and Submits Registration via Browser UI
    // -------------------------------------------------------------
    console.log('\nLogging in as student in browser...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await sleep(800);

    await page.type('input[type="email"]', 'test.student@eventsync.edu');
    await page.type('input[type="password"]', 'Student@12345');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);

    console.log(`[Student Logged In] Current URL: ${page.url()}`);

    // Return to registration page
    await page.goto(regPageUrl, { waitUntil: 'networkidle2' });
    await sleep(1000);

    // Fill registration form
    console.log('[Registration] Filling student registration form...');
    // Name and roll may be pre-filled; ensure required fields
    await page.evaluate(() => {
      const nameInp = document.querySelector('input[placeholder*="full name"]');
      if (nameInp && !nameInp.value) nameInp.value = 'Rohan Verma';
      nameInp.dispatchEvent(new Event('input', { bubbles: true }));

      const rollInp = document.querySelector('input[placeholder*="2473A"]');
      if (rollInp && !rollInp.value) rollInp.value = '2473A05099';
      rollInp.dispatchEvent(new Event('input', { bubbles: true }));

      const yearSelect = document.querySelector('select:has(option[value="2nd Year"])');
      if (yearSelect) {
        yearSelect.value = '2nd Year';
        yearSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const deptSelect = document.querySelector('select:has(option[value="CSE"])');
      if (deptSelect) {
        deptSelect.value = 'CSE';
        deptSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await sleep(500);

    // Click submit
    console.log('[Registration] Clicking Submit Registration button...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submit = btns.find((b) => b.innerText.includes('Submit Registration'));
      if (submit) submit.click();
    });

    await sleep(2500);

    // Verify confirmation
    const successText = await page.evaluate(() => document.body.innerText);
    const hasSuccess = successText.includes('Registration Successful') || successText.includes('Digital Event Pass') || successText.includes('Already Registered');
    console.log(`[Registration UI] Success State detected: ${hasSuccess}`);

    if (!hasSuccess) {
      throw new Error(`Registration submission failed to display success state: ${successText.slice(0, 300)}`);
    }

    console.log('\n✔ All browser UI interactions verified successfully!');
  } finally {
    // Cleanup test event
    await Event.findByIdAndDelete(testEvent._id);
    await Registration.deleteMany({ event: testEvent._id });
    await browser.close();
    await mongoose.disconnect();
  }
}

main().then(() => {
  console.log('Browser test script completed successfully.');
  process.exit(0);
}).catch((err) => {
  console.error('Browser test script failed:', err);
  process.exit(1);
});
