const path = require('path');
module.paths.push(path.resolve('server/node_modules'));
module.paths.push(path.resolve('client/node_modules'));

const puppeteer = require('puppeteer-core');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message));

  console.log('Navigating to login...');
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle2' });

  console.log('Logging in...');
  await page.type('input[type="email"]', 'admin@eventsync.edu');
  const pwdInputs = await page.$$('input[type="password"]');
  await pwdInputs[0].type('Admin@12345');
  await pwdInputs[1].type('EventAdmin@vits');

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
  ]);

  console.log('Current URL:', page.url());

  // Wait a bit for rendering
  await new Promise(r => setTimeout(r, 1500));

  // Check for floating trigger button
  const triggerInfo = await page.evaluate(() => {
    const trigger = document.querySelector('.chat-floating-trigger');
    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
      ariaLabel: b.getAttribute('aria-label'),
      title: b.getAttribute('title'),
      className: b.className,
      innerText: b.innerText,
      outerHTML: b.outerHTML.slice(0, 100),
    }));

    if (!trigger) {
      return { found: false, allButtons: buttons };
    }

    const rect = trigger.getBoundingClientRect();
    const style = window.getComputedStyle(trigger);

    return {
      found: true,
      rect: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height },
      style: {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        position: style.position,
        zIndex: style.zIndex,
        bottom: style.bottom,
        right: style.right,
      },
      allButtons: buttons,
    };
  });

  console.log('Trigger info:', JSON.stringify(triggerInfo, null, 2));

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.resolve('scratch/admin_scrolled_bottom.png') });
  console.log('Scrolled screenshot saved to scratch/admin_scrolled_bottom.png');

  await browser.close();
}

main().catch(console.error);
