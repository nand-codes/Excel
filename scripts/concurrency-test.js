#!/usr/bin/env node
/**
 * The three-user test from Phase 5, run automatically against a throwaway database.
 *
 * This is the scenario that actually worries me about putting the app on a server: three
 * people editing at once. Every case below fires genuinely in parallel (Promise.all, one
 * session each) rather than one after another, because sequential requests would pass even
 * with no concurrency control at all.
 *
 * Covered: simultaneous edits of one client, an edit racing a delete, simultaneous
 * payments on one client, parallel creates, and a backup taken while writes are in flight.
 *
 * Usage: npm run test:concurrency
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eds-concurrency-'));
const tmpDb = path.join(workDir, 'clients.sqlite');

process.env.EXCEL_DB_PATH = tmpDb;
process.env.NODE_ENV = 'test';
process.env.EXCEL_SECURE_COOKIES = '0';

const { createApp } = require('../server/app');
const { getStore, closeStore } = require('../server/store');
const { hashPassword } = require('../server/auth');

const STAFF = [
  { username: 'race_asha', displayName: 'Asha', password: 'Race-Test-Asha-1' },
  { username: 'race_binu', displayName: 'Binu', password: 'Race-Test-Binu-1' },
  { username: 'race_chitra', displayName: 'Chitra', password: 'Race-Test-Chitra-1' },
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

function createSession(baseUrl) {
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

    for (const entry of res.headers.getSetCookie?.() || []) {
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
    name: 'Race Client',
    phone: '9800000001',
    applicationNumber: 'APP-RACE-1',
    guardianName: 'Guardian Race',
    dob: '1996-03-11',
    bloodGroup: 'O+',
    licenceType: 'LMV',
    address: '9 Race Road, Kochi, Kerala 682002',
    ...overrides,
  };
}

async function main() {
  const store = getStore();
  for (const [index, person] of STAFF.entries()) {
    store.createUser({
      id: `u_race_${index}`,
      username: person.username,
      displayName: person.displayName,
      passwordHash: await hashPassword(person.password),
      role: index === 0 ? 'admin' : 'staff',
    });
  }

  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const sessions = STAFF.map(() => createSession(baseUrl));
  const [asha, binu, chitra] = sessions;

  console.log('\nThree sessions signed in at once');
  const logins = await Promise.all(
    sessions.map((session, index) =>
      session('POST', '/api/auth/login', {
        username: STAFF[index].username,
        password: STAFF[index].password,
      })
    )
  );
  check(
    'all three sign in concurrently',
    logins.every((result) => result.status === 200),
    logins.map((r) => r.status).join(',')
  );
  const identities = await Promise.all(sessions.map((session) => session('GET', '/api/auth/me')));
  check(
    'each cookie maps to its own user',
    new Set(identities.map((result) => result.body.user?.username)).size === 3
  );

  console.log('\nOne creates, the others see it');
  const created = await asha('POST', '/api/clients', { client: sampleClient() });
  check('create succeeds', created.status === 201, JSON.stringify(created.body));
  const clientId = created.body.client.id;
  const baseVersion = created.body.client.updatedAt;

  const reads = await Promise.all([
    binu('GET', '/api/clients'),
    chitra('GET', '/api/clients'),
  ]);
  check(
    'the other two see the new client on their next fetch',
    reads.every((result) => result.body.clients?.some((entry) => entry.id === clientId))
  );

  console.log('\nThree simultaneous edits of the same client');
  const edits = await Promise.all(
    sessions.map((session, index) =>
      session('POST', '/api/clients', {
        client: { ...sampleClient({ name: `Edited by ${STAFF[index].displayName}` }), id: clientId },
        expectedUpdatedAt: baseVersion,
      })
    )
  );
  const winners = edits.filter((result) => result.status === 200);
  const losers = edits.filter((result) => result.status === 409);
  check(
    'exactly one write wins',
    winners.length === 1,
    `statuses ${edits.map((r) => r.status).join(',')}`
  );
  check('the other two are told to retry, not silently dropped', losers.length === 2);
  check(
    'each rejection carries the winning version so the UI can show it',
    losers.every((result) => result.body.client?.id === clientId && !!result.body.client.updatedAt)
  );
  check(
    'the rejections name the reason',
    losers.every((result) => result.body.reason === 'stale')
  );

  const afterRace = await asha('GET', '/api/clients');
  const winnerName = winners[0].body.client.name;
  check(
    'the stored record is the winner, not a mix of the three',
    afterRace.body.clients.find((entry) => entry.id === clientId)?.name === winnerName,
    winnerName
  );

  console.log('\nA loser retries against the fresh version');
  const fresh = losers[0].body.client.updatedAt;
  const retry = await binu('POST', '/api/clients', {
    client: { ...sampleClient({ name: 'Retried successfully' }), id: clientId },
    expectedUpdatedAt: fresh,
  });
  check('the retry is accepted', retry.status === 200, JSON.stringify(retry.body));
  check('the retry advances the version', retry.body.client.updatedAt !== fresh);

  console.log('\nAn edit racing a delete');
  const openVersion = retry.body.client.updatedAt;
  const deleted = await chitra('DELETE', `/api/clients/${clientId}`);
  check('the delete succeeds', deleted.status === 200);

  const editAfterDelete = await binu('POST', '/api/clients', {
    client: { ...sampleClient({ name: 'Edit of a deleted record' }), id: clientId },
    expectedUpdatedAt: openVersion,
  });
  check(
    'editing a deleted client is refused rather than resurrecting it',
    editAfterDelete.status === 409,
    `got ${editAfterDelete.status}`
  );
  check('the refusal says it was deleted', editAfterDelete.body.reason === 'deleted');

  const stillGone = await binu('GET', '/api/clients');
  check(
    'the record stays deleted',
    !stillGone.body.clients.some((entry) => entry.id === clientId)
  );

  const restored = await binu('POST', '/api/clients', {
    client: { ...sampleClient({ name: 'Deliberately restored' }), id: clientId },
  });
  check('the user can deliberately put it back', restored.status === 201);

  const paymentAfterDelete = await chitra('DELETE', `/api/clients/${clientId}`);
  check('cleanup delete succeeds', paymentAfterDelete.status === 200);

  console.log('\nA payment added to a client someone else just deleted');
  const victim = await asha('POST', '/api/clients', {
    client: sampleClient({ name: 'Payment Race', phone: '9800000002' }),
  });
  const victimId = victim.body.client.id;
  await binu('DELETE', `/api/clients/${victimId}`);
  const orphan = await chitra('POST', '/api/payments', {
    clientId: victimId,
    amount: 500,
    date: new Date().toISOString().slice(0, 10),
    method: 'Cash',
  });
  check('the payment is refused with 404', orphan.status === 404, `got ${orphan.status}`);

  console.log('\nThree simultaneous payments on one client');
  const payer = await asha('POST', '/api/clients', {
    client: sampleClient({ name: 'Payments Client', phone: '9800000003' }),
  });
  const payerId = payer.body.client.id;
  const today = new Date().toISOString().slice(0, 10);

  const payments = await Promise.all(
    sessions.map((session, index) =>
      session('POST', '/api/payments', {
        clientId: payerId,
        amount: 100 * (index + 1),
        date: today,
        method: 'UPI',
        note: `From ${STAFF[index].displayName}`,
      })
    )
  );
  check(
    'all three payments are accepted',
    payments.every((result) => result.status === 201),
    payments.map((r) => r.status).join(',')
  );
  const total = await asha('GET', `/api/clients/${payerId}/payments/total`);
  check('the total is 600, so no write was lost to the lock', total.body.total === 600, JSON.stringify(total.body));

  const history = await binu('GET', `/api/clients/${payerId}/payments`);
  check('all three rows are in the history', history.body.payments.length === 3);

  console.log('\nParallel creates from all three');
  const bulkCreates = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      sessions[i % 3]('POST', '/api/clients', {
        client: sampleClient({
          name: `Parallel ${i}`,
          phone: `98111111${String(i).padStart(2, '0')}`,
          applicationNumber: `APP-P-${i}`,
        }),
      })
    )
  );
  check(
    'twelve concurrent creates all succeed',
    bulkCreates.every((result) => result.status === 201),
    bulkCreates
      .filter((r) => r.status !== 201)
      .map((r) => JSON.stringify(r.body))
      .join(' ')
  );
  const allClients = await asha('GET', '/api/clients');
  check(
    'every one of them is readable afterwards',
    bulkCreates.every((result) =>
      allClients.body.clients.some((entry) => entry.id === result.body.client.id)
    )
  );
  check(
    'ids are unique, so nothing overwrote anything',
    new Set(bulkCreates.map((r) => r.body.client.id)).size === 12
  );

  console.log('\nA backup taken while writes are in flight');
  let writing = true;
  const writeStorm = (async () => {
    let n = 0;
    while (writing) {
      await chitra('POST', '/api/clients', {
        client: sampleClient({
          name: `Storm ${n}`,
          phone: `9822222${String(n).padStart(3, '0')}`,
          applicationNumber: `APP-S-${n}`,
        }),
      });
      n += 1;
    }
    return n;
  })();

  const snapshotPath = execFileSync(
    process.execPath,
    [path.join(__dirname, 'backup-snapshot.js'), `--out-dir=${path.join(workDir, 'backups')}`],
    { env: { ...process.env, EXCEL_DB_PATH: tmpDb }, encoding: 'utf8' }
  ).trim();

  writing = false;
  const stormCount = await writeStorm;

  check('the backup script produced a file', fs.existsSync(snapshotPath), snapshotPath);

  const restoredPath = path.join(workDir, 'restored.sqlite');
  fs.writeFileSync(restoredPath, zlib.gunzipSync(fs.readFileSync(snapshotPath)));

  const snapshotDb = new DatabaseSync(restoredPath, { readOnly: true });
  const integrity = Object.values(snapshotDb.prepare('PRAGMA integrity_check').get())[0];
  const snapshotClients = snapshotDb.prepare('SELECT COUNT(*) AS n FROM clients').get().n;
  const snapshotUsers = snapshotDb.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const snapshotPayments = snapshotDb.prepare('SELECT COUNT(*) AS n FROM payments').get().n;
  snapshotDb.close();

  check('the snapshot passes integrity_check despite the concurrent writes', integrity === 'ok', String(integrity));
  check('it contains the clients', snapshotClients >= 13, `${snapshotClients} rows`);
  check('it contains the accounts', snapshotUsers === 3);
  check('it contains the payments', snapshotPayments === 3);
  console.log(`  note  ${stormCount} clients were written during the snapshot`);

  const liveCount = (await asha('GET', '/api/clients')).body.clients.length;
  check('the live database is still readable after the backup', liveCount >= snapshotClients);

  console.log('\nSession isolation');
  await chitra('POST', '/api/auth/logout');
  const [afterLogout, stillIn] = await Promise.all([
    chitra('GET', '/api/clients'),
    binu('GET', '/api/clients'),
  ]);
  check('the signed-out session is rejected', afterLogout.status === 401, `got ${afterLogout.status}`);
  check('the other sessions keep working', stillIn.status === 200);

  await new Promise((resolve) => server.close(resolve));

  console.log(`\n${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

function cleanup() {
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* the OS will clear the temp directory eventually */
  }
}

main()
  .then((ok) => {
    closeStore();
    cleanup();
    process.exit(ok ? 0 : 1);
  })
  .catch((error) => {
    console.error('\nConcurrency test crashed:', error);
    closeStore();
    cleanup();
    process.exit(1);
  });
