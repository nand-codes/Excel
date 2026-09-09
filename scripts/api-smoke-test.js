#!/usr/bin/env node
/**
 * End-to-end API check against a throwaway database.
 *
 * Creates a temporary SQLite file, seeds two accounts, starts the real Express app
 * on an ephemeral port, and exercises auth, clients, payments and the multi-user
 * conflict path. The temporary database is deleted afterwards; your real data is
 * never touched.
 *
 * Usage: npm run test:api
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDb = path.join(os.tmpdir(), `eds-smoke-${process.pid}-${Date.now()}.sqlite`);
process.env.EXCEL_DB_PATH = tmpDb;
process.env.NODE_ENV = 'test';
process.env.EXCEL_SECURE_COOKIES = '0';

const { createApp } = require('../server/app');
const { getStore, closeStore } = require('../server/store');
const { hashPassword } = require('../server/auth');

const ADMIN = { username: 'smoke_admin', password: 'SmokeTest-Admin-1' };
const STAFF = { username: 'smoke_staff', password: 'SmokeTest-Staff-1' };

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

/** Minimal cookie-aware client so we can act as several signed-in users at once. */
function createClient(baseUrl) {
  let cookie = '';
  return async function request(method, url, body) {
    const res = await fetch(`${baseUrl}${url}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const setCookie = res.headers.getSetCookie?.() || [];
    for (const entry of setCookie) {
      const [pair] = entry.split(';');
      if (pair.startsWith('eds_session=')) cookie = pair;
    }

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, body: json };
  };
}

function sampleClient(overrides = {}) {
  return {
    name: 'Smoke Test Client',
    phone: '9876543210',
    alternatePhone: '9876500000',
    applicationNumber: 'APP-SMOKE-1',
    guardianName: 'Guardian Smoke',
    dob: '1998-06-15',
    bloodGroup: 'B+',
    licenceType: 'LMV',
    address: '1 Test Street, Kochi, Kerala 682001',
    ...overrides,
  };
}

async function main() {
  const store = getStore();
  store.createUser({
    id: 'u_smoke_admin',
    username: ADMIN.username,
    displayName: 'Smoke Admin',
    passwordHash: await hashPassword(ADMIN.password),
    role: 'admin',
  });
  store.createUser({
    id: 'u_smoke_staff',
    username: STAFF.username,
    displayName: 'Smoke Staff',
    passwordHash: await hashPassword(STAFF.password),
    role: 'staff',
  });

  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const alice = createClient(baseUrl);
  const bob = createClient(baseUrl);
  const stranger = createClient(baseUrl);

  console.log('\nAuthentication');
  const health = await stranger('GET', '/api/health');
  check('health endpoint is public', health.status === 200 && health.body.ok === true);

  const unauth = await stranger('GET', '/api/clients');
  check('client list rejects anonymous callers', unauth.status === 401, `got ${unauth.status}`);

  const badLogin = await stranger('POST', '/api/auth/login', {
    username: ADMIN.username,
    password: 'wrong-password',
  });
  check('wrong password is rejected', badLogin.status === 401, `got ${badLogin.status}`);

  const unknownUser = await stranger('POST', '/api/auth/login', {
    username: 'nobody-here',
    password: 'whatever-123',
  });
  check('unknown username is rejected', unknownUser.status === 401, `got ${unknownUser.status}`);

  const aliceLogin = await alice('POST', '/api/auth/login', ADMIN);
  check('admin can sign in', aliceLogin.status === 200 && aliceLogin.body.user.role === 'admin');

  const bobLogin = await bob('POST', '/api/auth/login', STAFF);
  check('staff can sign in', bobLogin.status === 200 && bobLogin.body.user.role === 'staff');

  const me = await alice('GET', '/api/auth/me');
  check('session is recognised', me.status === 200 && me.body.user.username === ADMIN.username);

  console.log('\nValidation');
  const noName = await alice('POST', '/api/clients', { client: sampleClient({ name: '' }) });
  check('name is required', noName.status === 400 && !!noName.body.fields.name);

  const badPhone = await alice('POST', '/api/clients', { client: sampleClient({ phone: 'abc' }) });
  check('phone format is enforced', badPhone.status === 400 && !!badPhone.body.fields.phone);

  const sameAlt = await alice('POST', '/api/clients', {
    client: sampleClient({ phone: '9876543210', alternatePhone: '98765 43210' }),
  });
  check(
    'alternate number must differ from primary',
    sameAlt.status === 400 && !!sameAlt.body.fields.alternatePhone,
    JSON.stringify(sameAlt.body.fields)
  );

  const tooYoung = await alice('POST', '/api/clients', {
    client: sampleClient({ dob: new Date().toISOString().slice(0, 10) }),
  });
  check('age below 14 is rejected', tooYoung.status === 400 && !!tooYoung.body.fields.dob);

  const badLicence = await alice('POST', '/api/clients', {
    client: sampleClient({ licenceType: 'SPACESHIP' }),
  });
  check('unknown licence type is rejected', badLicence.status === 400 && !!badLicence.body.fields.licenceType);

  console.log('\nClients');
  const created = await alice('POST', '/api/clients', { client: sampleClient() });
  check('client is created', created.status === 201 && !!created.body.client.id, JSON.stringify(created.body));

  const clientId = created.body.client?.id;
  const firstUpdatedAt = created.body.client?.updatedAt;
  check('createdAt and updatedAt are set', !!created.body.client?.createdAt && !!firstUpdatedAt);
  check('application number round-trips', created.body.client?.applicationNumber === 'APP-SMOKE-1');
  check('alternate phone round-trips', created.body.client?.alternatePhone === '9876500000');

  const listed = await bob('GET', '/api/clients');
  check('a second user sees the new client', listed.status === 200 && listed.body.clients.length === 1);

  const legacy = await alice('POST', '/api/clients', {
    client: sampleClient({ name: 'Legacy Licence', phone: '9000000001', alternatePhone: null, licenceType: 'Transport' }),
  });
  check('legacy licence value is still accepted', legacy.status === 201, JSON.stringify(legacy.body));

  console.log('\nConcurrent editing');
  const aliceEdit = await alice('POST', '/api/clients', {
    client: { ...sampleClient({ name: 'Edited By Alice' }), id: clientId },
    expectedUpdatedAt: firstUpdatedAt,
  });
  check('first edit succeeds', aliceEdit.status === 200 && aliceEdit.body.client.name === 'Edited By Alice');
  check('updatedAt advances after an edit', aliceEdit.body.client.updatedAt !== firstUpdatedAt);

  const bobStaleEdit = await bob('POST', '/api/clients', {
    client: { ...sampleClient({ name: 'Edited By Bob' }), id: clientId },
    expectedUpdatedAt: firstUpdatedAt,
  });
  check('stale edit is rejected with 409', bobStaleEdit.status === 409, `got ${bobStaleEdit.status}`);
  check('conflict response returns the current record', bobStaleEdit.body.client?.name === 'Edited By Alice');

  const bobRetry = await bob('POST', '/api/clients', {
    client: { ...sampleClient({ name: 'Edited By Bob' }), id: clientId },
    expectedUpdatedAt: bobStaleEdit.body.client?.updatedAt,
  });
  check('retry with the fresh version succeeds', bobRetry.status === 200 && bobRetry.body.client.name === 'Edited By Bob');

  console.log('\nPayments');
  const payment = await bob('POST', '/api/payments', {
    clientId,
    amount: 1500,
    date: new Date().toISOString().slice(0, 10),
    method: 'UPI',
    note: 'First instalment',
  });
  check('payment is recorded', payment.status === 201 && payment.body.total === 1500, JSON.stringify(payment.body));

  const secondPayment = await bob('POST', '/api/payments', { clientId, amount: 500.5, date: '2026-01-15', method: 'Cash' });
  check('running total accumulates', secondPayment.status === 201 && secondPayment.body.total === 2000.5);

  const badAmount = await bob('POST', '/api/payments', { clientId, amount: 0, date: '2026-01-15' });
  check('zero amount is rejected', badAmount.status === 400 && !!badAmount.body.fields.amount);

  const orphanPayment = await bob('POST', '/api/payments', { clientId: 'c_does_not_exist', amount: 100, date: '2026-01-15' });
  check('payment for a missing client is rejected', orphanPayment.status === 404);

  const history = await alice('GET', `/api/clients/${clientId}/payments`);
  check('history lists both payments', history.status === 200 && history.body.payments.length === 2);
  check('history is newest first', new Date(history.body.payments[0].paidAt) >= new Date(history.body.payments[1].paidAt));

  const total = await alice('GET', `/api/clients/${clientId}/payments/total`);
  check('total endpoint agrees', total.status === 200 && total.body.total === 2000.5);

  const removedPayment = await alice('DELETE', `/api/payments/${payment.body.payment.id}`);
  check('payment can be deleted', removedPayment.status === 200 && removedPayment.body.total === 500.5);

  console.log('\nBulk import');
  const bulk = await alice('POST', '/api/clients/bulk', {
    clients: [
      { ...sampleClient({ name: 'Import One', phone: '9111111111', alternatePhone: null }), id: 'c_import_1' },
      { ...sampleClient({ name: 'Import Two', phone: '9222222222', alternatePhone: null }), id: 'c_import_2' },
      { ...sampleClient({ name: 'Already Here' }), id: clientId },
      { ...sampleClient({ name: '', phone: '9333333333' }), id: 'c_import_bad' },
    ],
  });
  check('valid rows are imported', bulk.status === 200 && bulk.body.added === 2, JSON.stringify(bulk.body));
  check('existing ids are skipped', bulk.body.skipped === 1);
  check('invalid rows are reported', bulk.body.rejected === 1);

  console.log('\nPermissions');
  const staffClear = await bob('DELETE', '/api/clients');
  check('staff cannot clear all data', staffClear.status === 403, `got ${staffClear.status}`);

  const cascadeTarget = await alice('GET', `/api/clients/${clientId}/payments`);
  check('client still has a payment before deletion', cascadeTarget.body.payments.length === 1);

  const deleted = await alice('DELETE', `/api/clients/${clientId}`);
  check('client can be deleted', deleted.status === 200);
  check('payments cascade away with the client', getStore().getPaymentsByClient(clientId).length === 0);

  const adminClear = await alice('DELETE', '/api/clients');
  check('admin can clear all data', adminClear.status === 200);

  const afterClear = await alice('GET', '/api/clients');
  check('database is empty after clear', afterClear.body.clients.length === 0);

  console.log('\nSession lifecycle');
  await alice('POST', '/api/auth/logout');
  const afterLogout = await alice('GET', '/api/clients');
  check('logout invalidates the session', afterLogout.status === 401, `got ${afterLogout.status}`);

  const unknownRoute = await bob('GET', '/api/nope');
  check('unknown API route returns 404 JSON', unknownRoute.status === 404 && unknownRoute.body.error === 'not_found');

  await new Promise((resolve) => server.close(resolve));

  console.log(`\n${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

main()
  .then((ok) => {
    closeStore();
    cleanup();
    process.exit(ok ? 0 : 1);
  })
  .catch((err) => {
    console.error('\nSmoke test crashed:', err);
    closeStore();
    cleanup();
    process.exit(1);
  });

function cleanup() {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      if (fs.existsSync(tmpDb + suffix)) fs.unlinkSync(tmpDb + suffix);
    } catch {
      /* ignore */
    }
  }
}
