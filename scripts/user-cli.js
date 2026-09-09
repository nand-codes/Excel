#!/usr/bin/env node
/**
 * Account management for the Excel Driving School web app.
 * There is no self-signup; accounts exist only because they were created here.
 *
 * Usage:
 *   npm run user:add    -- --username admin --role admin --name "Front desk"
 *   npm run user:list
 *   npm run user:passwd -- --username admin
 *   npm run user:remove -- --username olduser
 *
 * The password is prompted for (hidden) unless --password is supplied.
 */

'use strict';

const crypto = require('node:crypto');

const { getStore, closeStore } = require('../server/store');
const { hashPassword } = require('../server/auth');

const MIN_PASSWORD_LENGTH = 10;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const [flag, inlineValue] = token.slice(2).split('=');
      if (inlineValue !== undefined) {
        args[flag] = inlineValue;
      } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        args[flag] = argv[i + 1];
        i += 1;
      } else {
        args[flag] = true;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

/** Reads a password without echoing it back to the terminal. */
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;

    if (!stdin.isTTY) {
      reject(new Error('No interactive terminal available — pass --password instead.'));
      return;
    }

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';

    const finish = (result, error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stdout.write('\n');
      if (error) reject(error);
      else resolve(result);
    };

    function onData(chunk) {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          finish(value);
          return;
        }
        if (char === '\u0003') {
          finish(null, new Error('Cancelled.'));
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        // Ignore other control characters (arrow keys arrive as escape sequences).
        if (char >= ' ') value += char;
      }
    }

    stdin.on('data', onData);
  });
}

async function readPassword(args, { confirm }) {
  if (typeof args.password === 'string' && args.password) return args.password;
  if (process.env.EXCEL_USER_PASSWORD) return process.env.EXCEL_USER_PASSWORD;

  const password = await promptHidden('Password: ');
  if (confirm) {
    const again = await promptHidden('Confirm password: ');
    if (password !== again) throw new Error('Passwords did not match.');
  }
  return password;
}

function assertStrongEnough(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

function normalizeUsername(value) {
  const username = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error('Username must be 3-32 characters: letters, digits, dot, underscore or hyphen.');
  }
  return username;
}

async function addUser(args) {
  const store = getStore();
  const username = normalizeUsername(args.username);

  if (store.getUserByUsername(username)) {
    throw new Error(`User "${username}" already exists. Use user:passwd to change the password.`);
  }

  const role = args.role === 'admin' ? 'admin' : 'staff';
  const password = await readPassword(args, { confirm: true });
  assertStrongEnough(password);

  store.createUser({
    id: `u_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    username,
    displayName: typeof args.name === 'string' ? args.name : username,
    passwordHash: await hashPassword(password),
    role,
  });

  console.log(`Created ${role} account "${username}".`);
}

function listUsers() {
  const users = getStore().listUsers();
  if (!users.length) {
    console.log('No accounts yet. Create one with: npm run user:add -- --username admin --role admin');
    return;
  }
  console.log('');
  for (const user of users) {
    const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'never';
    console.log(`  ${user.username.padEnd(20)} ${user.role.padEnd(6)} last login: ${lastLogin}`);
  }
  console.log(`\n  ${users.length} account(s)\n`);
}

async function changePassword(args) {
  const store = getStore();
  const username = normalizeUsername(args.username);
  const user = store.getUserByUsername(username);
  if (!user) throw new Error(`No such user: ${username}`);

  const password = await readPassword(args, { confirm: true });
  assertStrongEnough(password);

  store.updateUserPassword(user.id, await hashPassword(password));
  // Force a fresh sign-in everywhere; an old cookie must not survive a password change.
  store.deleteSessionsForUser(user.id);

  console.log(`Password updated for "${username}". Existing sessions were signed out.`);
}

function removeUser(args) {
  const store = getStore();
  const username = normalizeUsername(args.username);
  const user = store.getUserByUsername(username);
  if (!user) throw new Error(`No such user: ${username}`);

  store.deleteUser(user.id);
  console.log(`Removed "${username}".`);
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const command = args._[0] || 'help';

  switch (command) {
    case 'add':
      await addUser(args);
      break;
    case 'list':
      listUsers();
      break;
    case 'passwd':
      await changePassword(args);
      break;
    case 'remove':
      removeUser(args);
      break;
    default:
      console.log(
        [
          '',
          'Account management',
          '',
          '  npm run user:add    -- --username admin --role admin --name "Front desk"',
          '  npm run user:list',
          '  npm run user:passwd -- --username admin',
          '  npm run user:remove -- --username olduser',
          '',
          'Roles: admin (can clear all data), staff (everything else).',
          '',
        ].join('\n')
      );
  }
}

main()
  .then(() => closeStore())
  .catch((err) => {
    closeStore();
    console.error(`\nError: ${err.message}\n`);
    process.exit(1);
  });
