#!/usr/bin/env node
/**
 * Excel Driving School — database performance benchmark.
 *
 * Uses the same clientStore the API uses. Writes a temporary SQLite file under the
 * system temp directory and deletes it when done.
 *
 * Usage:
 *   npm run perf
 *   node scripts/perf-benchmark.js --clients=10000
 *   PERF_CLIENTS=5000 node scripts/perf-benchmark.js --json
 *
 * Environment:
 *   PERF_CLIENTS  default 5000 (if --clients not set)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createClientStore } = require('../db/clientStore');

function parseArgs(argv) {
  let clients = Number(process.env.PERF_CLIENTS) || 5000;
  let json = false;
  for (const a of argv.slice(2)) {
    if (a === '--json') json = true;
    else if (a.startsWith('--clients=')) clients = parseInt(a.slice('--clients='.length), 10);
  }
  if (!Number.isFinite(clients) || clients < 1) clients = 5000;
  return { clients, json };
}

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function bench(name, fn) {
  const t0 = nowMs();
  const result = fn();
  const ms = nowMs() - t0;
  return { name, ms, result };
}

function makeClient(i) {
  const id = `perf_c_${i}`;
  return {
    id,
    createdAt: new Date(2024, 0, 1 + (i % 365)).toISOString(),
    name: `Client ${i}`,
    phone: `9${String(100000000 + (i % 899999999)).slice(0, 10)}`,
    dob: '1998-06-15',
    bloodGroup: ['A+', 'B+', 'O+', 'AB+'][i % 4],
    licenceType: ['LMV', 'MCWG', 'LMV + MCWG'][i % 3],
    address: `${i} Sample Street, City, State 560001`,
    guardianName: i % 5 === 0 ? null : `Guardian ${i}`,
    applicationNumber: i % 7 === 0 ? null : `APP-${100000 + i}`,
    alternatePhone: i % 11 === 0 ? null : `8${String(100000000 + (i % 899999999)).slice(0, 9)}`,
  };
}

function main() {
  const { clients: n, json } = parseArgs(process.argv);
  const tmp = path.join(
    require('os').tmpdir(),
    `excel-ds-perf-${process.pid}-${Date.now()}.sqlite`
  );

  let store;
  try {
    store = createClientStore(tmp);
  } catch (e) {
    console.error('Failed to open SQLite (requires Node with node:sqlite):', e.message || e);
    process.exit(1);
  }

  const rows = [];
  for (let i = 0; i < n; i++) rows.push(makeClient(i));

  const bulk = bench('bulk upsertClients (1 transaction)', () => {
    store.upsertClients(rows);
  });

  const readAll = bench('getAllClients (full table)', () => store.getAllClients());

  const sampleId = rows[Math.floor(n / 2)].id;
  const singleUpserts = bench(`single upsertClient × 200 (same id)`, () => {
    for (let k = 0; k < 200; k++) {
      store.upsertClient({
        ...rows[Math.floor(n / 2)],
        name: `Client half ${k}`,
      });
    }
  });

  const firstFew = rows.slice(0, 500);
  const payBench = bench('addPayment × 500 + getPayments × 100', () => {
    for (let i = 0; i < 500; i++) {
      store.addPayment({
        id: `perf_p_${i}`,
        clientId: firstFew[i % firstFew.length].id,
        amount: 500 + (i % 2000),
        paidAt: new Date().toISOString(),
        method: 'Cash',
        note: i % 10 === 0 ? 'Bench' : null,
      });
    }
    for (let i = 0; i < 100; i++) {
      store.getPaymentsByClient(firstFew[i].id);
      store.getPaymentTotal(firstFew[i].id);
    }
  });

  store.close();
  try {
    fs.unlinkSync(tmp);
    const wal = tmp + '-wal';
    const shm = tmp + '-shm';
    if (fs.existsSync(wal)) fs.unlinkSync(wal);
    if (fs.existsSync(shm)) fs.unlinkSync(shm);
  } catch {
    /* ignore */
  }

  const list = readAll.result;
  const out = {
    clients: n,
    rowsRead: Array.isArray(list) ? list.length : 0,
    bulkUpsertMs: Math.round(bulk.ms * 100) / 100,
    getAllMs: Math.round(readAll.ms * 100) / 100,
    singleUpsert200Ms: Math.round(singleUpserts.ms * 100) / 100,
    paymentsMs: Math.round(payBench.ms * 100) / 100,
  };

  if (json) {
    console.log(JSON.stringify(out, null, 0));
    return;
  }

  console.log('\n Excel Driving School — DB performance benchmark\n');
  console.log(`  Clients inserted:     ${n}`);
  console.log(`  Rows returned:        ${out.rowsRead}`);
  console.log('—'.repeat(52));
  console.log(`  bulk upsertClients     ${out.bulkUpsertMs.toFixed(2)} ms`);
  console.log(`  getAllClients          ${out.getAllMs.toFixed(2)} ms`);
  console.log(`  200× upsertClient       ${out.singleUpsert200Ms.toFixed(2)} ms`);
  console.log(`  payments batch         ${out.paymentsMs.toFixed(2)} ms`);
  console.log('—'.repeat(52));
  console.log(
    `  Throughput (insert):  ${((n / bulk.ms) * 1000).toFixed(0)} clients/s (bulk)\n`
  );
}

main();
