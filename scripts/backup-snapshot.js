#!/usr/bin/env node
'use strict';

/**
 * Writes a compressed, consistent snapshot of the SQLite database and prunes old ones.
 *
 * Uses VACUUM INTO, so it is safe to run while staff are using the app — no downtime and
 * no risk of copying a half-written WAL. The path of the finished file is the only thing
 * printed to stdout, so shell callers can pipe it straight into an upload.
 *
 *   node scripts/backup-snapshot.js [--out-dir=DIR] [--keep=N]
 *
 * Environment: EXCEL_DB_PATH (which database), EXCEL_BACKUP_DIR (default output directory).
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { pipeline } = require('node:stream/promises');

const config = require('../server/config');
const { createClientStore } = require('../db/clientStore');

const PREFIX = 'clients-';
const SUFFIX = '.sqlite.gz';

function parseArgs(argv) {
  const args = { outDir: process.env.EXCEL_BACKUP_DIR || '', keep: 14 };
  for (const raw of argv) {
    const [key, value = ''] = raw.replace(/^--/, '').split('=');
    if (key === 'out-dir') args.outDir = value;
    else if (key === 'keep') args.keep = Number.parseInt(value, 10);
    else if (key === 'help') args.help = true;
    else {
      console.error(`Unknown option: ${raw}`);
      process.exit(2);
    }
  }
  if (!Number.isFinite(args.keep) || args.keep < 1) args.keep = 14;
  if (!args.outDir) args.outDir = path.join(path.dirname(config.dbPath), 'backups');
  return args;
}

/** 2026-09-09T18-20-05Z — sorts chronologically as plain text. */
function stamp() {
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z').replace(/[:]/g, '-');
}

async function gzipTo(source, target) {
  await pipeline(
    fs.createReadStream(source),
    zlib.createGzip({ level: 9 }),
    fs.createWriteStream(target)
  );
}

function prune(outDir, keep) {
  const files = fs
    .readdirSync(outDir)
    .filter((name) => name.startsWith(PREFIX) && name.endsWith(SUFFIX))
    .sort();

  const stale = files.slice(0, Math.max(0, files.length - keep));
  for (const name of stale) {
    fs.unlinkSync(path.join(outDir, name));
    console.error(`pruned ${name}`);
  }
  return stale.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.error('Usage: node scripts/backup-snapshot.js [--out-dir=DIR] [--keep=N]');
    return;
  }

  if (!fs.existsSync(config.dbPath)) {
    console.error(`No database at ${config.dbPath} — nothing to back up.`);
    process.exit(1);
  }

  fs.mkdirSync(args.outDir, { recursive: true });

  const at = stamp();
  const raw = path.join(args.outDir, `.${PREFIX}${at}.tmp`);
  const final = path.join(args.outDir, `${PREFIX}${at}${SUFFIX}`);

  const started = Date.now();
  const store = createClientStore(config.dbPath);
  try {
    store.vacuumInto(raw);
  } finally {
    store.close();
  }

  try {
    await gzipTo(raw, final);
  } finally {
    fs.rmSync(raw, { force: true });
  }

  const size = fs.statSync(final).size;
  prune(args.outDir, args.keep);

  console.error(
    `snapshot ${path.basename(final)} — ${(size / 1024).toFixed(1)} KB in ${Date.now() - started} ms`
  );
  console.log(final);
}

main().catch((error) => {
  console.error(`Backup failed: ${error.message}`);
  process.exit(1);
});
