#!/usr/bin/env node
/**
 * Drives the built web app in a real browser against a throwaway database:
 * signs in, adds a client, checks the dashboard, list, detail sheet and reports,
 * and saves screenshots to docs/screenshots.
 *
 * Requires a production build (npm run web:build) and a local Chrome or Edge.
 * Usage: npm run test:ui
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

const puppeteer = require('puppeteer-core');

/** Chosen at run time so a stray dev server can never be mistaken for ours. */
let PORT = 0;
let BASE_URL = '';
const USER = { username: 'ui_smoke', password: 'UiSmoke-Test-1' };
const SHOT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
const TMP_DB = path.join(os.tmpdir(), `eds-ui-${Date.now()}.sqlite`);

const BROWSER_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function findBrowser() {
  const found = BROWSER_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('No Chrome or Edge installation found for the UI test.');
  return found;
}

async function seedUser() {
  process.env.EXCEL_DB_PATH = TMP_DB;
  const { getStore, closeStore } = require('../server/store');
  const { hashPassword } = require('../server/auth');

  getStore().createUser({
    id: 'u_ui_smoke',
    username: USER.username,
    displayName: 'UI Smoke',
    passwordHash: await hashPassword(USER.password),
    role: 'admin',
  });
  closeStore();
}

function startServer() {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: {
      ...process.env,
      EXCEL_DB_PATH: TMP_DB,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));
  child.on('exit', (code) => {
    child.exitedWith = code;
  });
  return child;
}

/** Node's cold start can take several seconds on Windows, hence the generous window. */
async function waitForServer(child, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (child.exitedWith != null) {
      throw new Error(`The API exited with code ${child.exitedWith} before it was ready.`);
    }
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`The API did not answer /api/health within ${timeoutMs / 1000}s.`);
}

/** Radix selects are buttons plus a portalled listbox, so pick by option text. */
async function chooseOption(page, triggerSelector, optionText) {
  await page.click(triggerSelector);
  await page.waitForSelector('[role="option"]', { visible: true });

  const options = await page.$$('[role="option"]');
  for (const option of options) {
    const text = (await option.evaluate((element) => element.textContent)) || '';
    if (text.trim() === optionText || text.trim().startsWith(optionText)) {
      await option.click();
      await page.waitForSelector('[role="option"]', { hidden: true });
      return;
    }
  }
  throw new Error(`Option "${optionText}" not found for ${triggerSelector}`);
}

async function textOf(page, selector) {
  return page.$eval(selector, (element) => element.textContent?.trim() ?? '');
}

/**
 * Date inputs expect a localised format when typed, so set the value directly.
 * React listens to the native setter, hence the descriptor dance.
 */
async function setValue(page, selector, value) {
  await page.$eval(
    selector,
    (element, nextValue) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(element, nextValue);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    },
    value
  );
}

async function shoot(page, name) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const file = path.join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function main() {
  PORT = await findFreePort();
  BASE_URL = `http://127.0.0.1:${PORT}`;

  await seedUser();
  const server = startServer();

  let browser;
  try {
    await waitForServer(server);

    browser = await puppeteer.launch({
      executablePath: findBrowser(),
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
      defaultViewport: { width: 1440, height: 900 },
    });

    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', (message) => {
      // The session probe answers 401 before sign-in and after sign-out by design.
      if (message.type() === 'error' && !message.text().includes('401')) {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => consoleErrors.push(String(error)));

    // Pin the designed dark appearance so the captures are predictable regardless of the host.
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('excelDS_theme', 'dark');
      } catch {
        /* ignore */
      }
    });

    console.log('\nSign in');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#username');
    check('login screen is shown to a signed-out visitor', true);
    await shoot(page, 'login');

    await page.type('#username', USER.username);
    await page.type('#password', 'wrong-password');
    await page.click('button[type="submit"]');
    await page.waitForSelector('[role="alert"]');
    check('a wrong password shows an error', (await textOf(page, '[role="alert"]')).length > 0);

    await page.click('#password', { clickCount: 3 });
    await page.type('#password', USER.password);
    await page.click('button[type="submit"]');
    await page.waitForSelector('nav a[href="/clients"]');
    check('correct credentials reach the dashboard', true);

    console.log('\nAdd a client');
    await page.click('nav a[href="/clients/new"]');
    await page.waitForSelector('#f-name');

    await page.type('#f-name', 'Aparna Krishnan');
    await page.type('#f-guardian', 'Krishnan Nair');
    await page.type('#f-application', 'KL/2026/004421');
    await page.type('#f-phone', '9847012345');
    await page.type('#f-alt-phone', '9847099887');
    await setValue(page, '#f-dob', '2001-04-18');
    await chooseOption(page, '#f-blood', 'B+');
    await chooseOption(page, '#f-licence', 'LMV + MCWG');
    await page.type('#f-address', 'Thattarambalam, Mavelikara, Alappuzha 690103');
    await shoot(page, 'add-client');

    // The welcome message would open a WhatsApp tab; not wanted in a test run.
    await page.click('#f-welcome');
    await page.click('button[type="submit"]');

    try {
      await page.waitForFunction(() => window.location.pathname === '/clients', { timeout: 8000 });
      check('saving navigates to the clients list', true);
    } catch {
      const alerts = await page.$$eval('[role="alert"]', (nodes) =>
        nodes.map((node) => node.textContent?.trim() ?? '')
      );
      await shoot(page, 'failure-add-client');
      check('saving navigates to the clients list', false, alerts.join(' | ') || 'no error shown');
      throw new Error('Client could not be saved; see docs/screenshots/failure-add-client.png');
    }

    await page.waitForSelector('table tbody tr');
    const firstRow = await textOf(page, 'table tbody tr');
    check('the new client appears in the table', firstRow.includes('Aparna Krishnan'), firstRow);
    check('the application number is listed', firstRow.includes('KL/2026/004421'));
    check('the alternate number is listed', firstRow.includes('9847099887'));
    await shoot(page, 'clients');

    console.log('\nValidation in the browser');
    await page.click('nav a[href="/clients/new"]');
    await page.waitForSelector('#f-name');
    await page.type('#f-phone', '123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('[role="alert"]');
    const alerts = await page.$$eval('[role="alert"]', (nodes) =>
      nodes.map((node) => node.textContent?.trim() ?? '')
    );
    check('required fields are flagged', alerts.some((text) => text.includes('Full name is required.')));
    check('the phone format is flagged', alerts.some((text) => text.includes('valid phone number')));

    console.log('\nDashboard');
    await page.click('nav a[href="/"]');
    await page.waitForSelector('table tbody tr');
    const dashboardText = await textOf(page, 'main');
    check('the dashboard counts the client', dashboardText.includes('Total clients'));
    check('recent clients lists the new record', dashboardText.includes('Aparna Krishnan'));
    await shoot(page, 'dashboard');

    console.log('\nClient detail');
    await page.click('table tbody tr button[aria-label^="View"]');
    await page.waitForSelector('[role="dialog"]');
    const dialogText = await textOf(page, '[role="dialog"]');
    check('the detail sheet opens', dialogText.includes('Aparna Krishnan'));
    check('payments start at zero', dialogText.includes('₹0'), dialogText.slice(0, 200));
    check('the guardian is shown', dialogText.includes('Krishnan Nair'));
    await shoot(page, 'client-detail');

    console.log('\nPayments');
    await page.click('[role="dialog"] button::-p-text(Add payment)');
    await page.waitForSelector('#pay-amount');
    await page.type('#pay-amount', '2500');
    await chooseOption(page, '#pay-method', 'UPI');
    await page.type('#pay-note', 'First instalment');
    // Unchecked so the test does not try to open a WhatsApp tab.
    await page.click('#pay-whatsapp');
    await shoot(page, 'add-payment');
    await page.click('button::-p-text(Save payment)');

    await page.waitForFunction(
      () => document.querySelector('[role="dialog"]')?.textContent?.includes('₹2,500') ?? false,
      { timeout: 8000 }
    );
    check('the payment total updates in the detail sheet', true);
    const afterPayment = await textOf(page, '[role="dialog"]');
    check('the payment history lists the entry', afterPayment.includes('First instalment'));
    check('the method is shown in the history', afterPayment.includes('UPI'));

    console.log('\nPractice reminder');
    await page.click('[role="dialog"] button::-p-text(Practice day)');
    await page.waitForSelector('#practice-date');
    const preview = await textOf(page, '#practice-form');
    check('the reminder preview mentions the client', preview.includes('Aparna Krishnan'));
    check('the preview shows a 12-hour time', /9:00 AM/.test(preview), preview.slice(0, 160));
    await page.click('#practice-whatsapp');
    await shoot(page, 'practice-reminder');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#practice-date', { hidden: true });

    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="dialog"]', { hidden: true });

    console.log('\nReports');
    await page.click('nav a[href="/reports"]');
    await page.waitForSelector('main table tbody tr');
    const reportsText = await textOf(page, 'main');
    check('licence chart renders', reportsText.includes('Clients by licence type'));
    check('blood group chart renders', reportsText.includes('Blood group distribution'));
    check('monthly chart renders', reportsText.includes('Monthly registrations'));
    check('the register table renders', reportsText.includes('Complete client register'));
    await shoot(page, 'reports');

    console.log('\nSettings and appearance');
    await page.click('nav a[href="/settings"]');
    await page.waitForFunction(
      () => document.querySelector('main')?.textContent?.includes('Data management') ?? false
    );
    check('settings page renders', true);

    const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));

    check('the app opens in the dark appearance', await isDark());
    await shoot(page, 'settings-dark');

    // Toggling proves the light appearance still holds up, and captures it.
    await page.click('button[aria-label^="Switch to"]');
    await new Promise((resolve) => setTimeout(resolve, 400));
    check('the appearance toggle switches themes', !(await isDark()));
    await shoot(page, 'settings-light');

    await page.click('button[aria-label^="Switch to"]');
    await new Promise((resolve) => setTimeout(resolve, 400));
    check('the dark appearance applies', await isDark());

    await page.click('nav a[href="/"]');
    await page.waitForSelector('table tbody tr');
    await shoot(page, 'dashboard-dark');

    console.log('\nSession');
    await page.click('button[aria-label="Sign out"]');
    await page.waitForSelector('#username');
    check('signing out returns to the login screen', true);

    check('no console errors were logged', consoleErrors.length === 0, consoleErrors.join(' | '));

    console.log(`\nScreenshots written to ${SHOT_DIR}`);
  } finally {
    if (browser) await browser.close();
    server.kill();
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        if (fs.existsSync(TMP_DB + suffix)) fs.unlinkSync(TMP_DB + suffix);
      } catch {
        /* ignore */
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

main()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((error) => {
    console.error('\nUI test crashed:', error);
    process.exit(1);
  });
