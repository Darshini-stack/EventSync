const path = require('path');
module.paths.push(path.resolve('server/node_modules'));
module.paths.push(path.resolve('client/node_modules'));
const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
async function testAll() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const adminPage = await browser.newPage();
    await adminPage.setViewport({ width: 1280, height: 800 });
    console.log('[Admin] Navigating to admin login...');
    await adminPage.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle2' });
    await adminPage.type('input[type="email"]', 'admin@eventsync.edu');
    const pwdInputs = await adminPage.$$('input[type="password"]');
    await pwdInputs[0].type('Admin@12345');
    await pwdInputs[1].type('EventAdmin@vits');
    await Promise.all([
      adminPage.click('button[type="submit"]'),
      adminPage.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);
    console.log('[Admin] Logged in, current URL:', adminPage.url());
    await new Promise(r => setTimeout(r, 1000));
    const trigger = await adminPage.$('.chat-floating-trigger');
    console.log('[Admin] Floating button found on desktop:', Boolean(trigger));

    const tooltip = await adminPage.evaluate(() => {
      const btn = document.querySelector('.chat-floating-trigger');
      return {
        title: btn?.getAttribute('title'),
        ariaLabel: btn?.getAttribute('aria-label'),
      };
    });
    console.log('[Admin] Tooltip attributes:', tooltip);
    console.log('[Admin] Clicking floating AI button...');
    await adminPage.click('.chat-floating-trigger');
    await new Promise(r => setTimeout(r, 1000));
    const windowOpen = await adminPage.evaluate(() => {
      const win = document.querySelector('.chat-floating-window');
      return Boolean(win && win.offsetHeight > 0);
    });
    console.log('[Admin] Chat window opened:', windowOpen);

    await adminPage.screenshot({ path: path.resolve('scratch/admin_chat_opened.png') });
    console.log('[Admin] Saved scratch/admin_chat_opened.png');
    console.log('[Admin] Sending live question: "Total event registrations"...');
    await adminPage.type('.chat-floating-window input', 'Total event registrations');
    await adminPage.click('.chat-floating-window button[title="Send Message"]');
    await new Promise(r => setTimeout(r, 4000));
    const messages = await adminPage.evaluate(() => {
      return Array.from(document.querySelectorAll('.chat-floating-window .chat-markdown-content')).map(el => el.innerText);
    });
    console.log('[Admin] Chatbot responses received:', messages);
    await adminPage.evaluate(() => {
      const closeBtn = document.querySelector('.chat-floating-window button[title="Close chat"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));
    for (const width of [375, 414]) {
      console.log(`[Admin Mobile] Testing ${width}px...`);
      await adminPage.setViewport({ width, height: 812 });
      await new Promise(r => setTimeout(r, 500));

      const mobileTrigger = await adminPage.evaluate(() => {
        const btn = document.querySelector('.chat-floating-trigger');
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        const style = window.getComputedStyle(btn);
        return {
          visible: style.display !== 'none' && style.visibility !== 'hidden',
          bottom: style.bottom,
          right: style.right,
          width: rect.width,
          height: rect.height,
        };
      });
      console.log(`[Admin Mobile ${width}px] Trigger info:`, mobileTrigger);
      await adminPage.screenshot({ path: path.resolve(`scratch/admin_mobile_${width}.png`) });

      // Open chat on mobile
      await adminPage.click('.chat-floating-trigger');
      await new Promise(r => setTimeout(r, 500));
      const mobileChatWindow = await adminPage.evaluate(() => {
        const win = document.querySelector('.chat-floating-window');
        if (!win) return null;
        const rect = win.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          windowInnerWidth: window.innerWidth,
          fitsViewport: rect.width <= window.innerWidth && rect.right <= window.innerWidth,
        };
      });
      console.log(`[Admin Mobile ${width}px] Window info:`, mobileChatWindow);
      await adminPage.screenshot({ path: path.resolve(`scratch/admin_mobile_${width}_chat_open.png`) });

      // Close chat
      await adminPage.evaluate(() => {
        const closeBtn = document.querySelector('.chat-floating-window button[title="Close chat"]');
        if (closeBtn) closeBtn.click();
      });
    }

    await adminPage.close();

    const studentPage = await browser.newPage();
    await studentPage.setViewport({ width: 1280, height: 800 });
    console.log('[Student] Navigating to student login...');
    await studentPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await studentPage.type('input[type="email"]', 'test.student@eventsync.edu');
    await studentPage.type('input[type="password"]', 'Student@12345');
    await Promise.all([
      studentPage.click('button[type="submit"]'),
      studentPage.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);
    console.log('[Student] Logged in, current URL:', studentPage.url());
    await new Promise(r => setTimeout(r, 1000));
    const studentTrigger = await studentPage.$('.chat-floating-trigger');
    console.log('[Student] Floating button found on desktop:', Boolean(studentTrigger));
    await studentPage.click('.chat-floating-trigger');
    await new Promise(r => setTimeout(r, 1000));
    const studentWindowOpen = await studentPage.evaluate(() => {
      const win = document.querySelector('.chat-floating-window');
      return Boolean(win && win.offsetHeight > 0);
    });
    console.log('[Student] Chat window opened:', studentWindowOpen);
    await studentPage.screenshot({ path: path.resolve('scratch/student_chat_opened.png') });
    console.log('[Student] Saved scratch/student_chat_opened.png');

    await studentPage.close();

  } finally {
    await browser.close();
  }
}

testAll().catch(console.error);
