'use strict';

const { BLOOD_GROUPS, ALL_LICENCE_TYPES, PAYMENT_METHODS } = require('../db/reference');

const PHONE_RE = /^\+?\d[\d\s\-]{6,14}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

const MIN_AGE = 14;
const MAX_AGE = 100;

function text(value) {
  return value == null ? '' : String(value).trim();
}

function digitsOnly(value) {
  return text(value).replace(/\D/g, '');
}

/** Age in whole years from a yyyy-mm-dd string, or null when unparseable. */
function ageFromDob(ymd) {
  if (!YMD_RE.test(text(ymd))) return null;
  const [y, m, d] = text(ymd).split('-').map(Number);
  const dob = new Date(y, m - 1, d);
  if (dob.getFullYear() !== y || dob.getMonth() !== m - 1 || dob.getDate() !== d) return null;

  const today = new Date();
  let age = today.getFullYear() - y;
  const monthDiff = today.getMonth() - (m - 1);
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age -= 1;
  return age;
}

/**
 * Validates a client payload against the same rules the UI enforces, so the API
 * stays trustworthy even if a request bypasses the browser.
 *
 * @returns {{ok: boolean, fields: Record<string,string>, value?: object}}
 */
function validateClient(input) {
  const fields = {};
  const body = input && typeof input === 'object' ? input : {};

  const id = text(body.id);
  if (id && !ID_RE.test(id)) fields.id = 'Invalid client id.';

  const name = text(body.name);
  if (!name) fields.name = 'Full name is required.';
  else if (name.length > 120) fields.name = 'Full name is too long.';

  const phone = text(body.phone);
  if (!phone) fields.phone = 'Phone number is required.';
  else if (!PHONE_RE.test(phone)) fields.phone = 'Enter a valid phone number.';

  const alternatePhone = text(body.alternatePhone);
  if (alternatePhone) {
    if (!PHONE_RE.test(alternatePhone)) {
      fields.alternatePhone = 'Enter a valid alternate number.';
    } else if (digitsOnly(alternatePhone) && digitsOnly(alternatePhone) === digitsOnly(phone)) {
      fields.alternatePhone = 'Alternate number must differ from primary phone.';
    }
  }

  const dob = text(body.dob);
  if (!dob) {
    fields.dob = 'Date of birth is required.';
  } else {
    const age = ageFromDob(dob);
    if (age == null) fields.dob = 'Enter a valid date of birth.';
    else if (age < MIN_AGE || age > MAX_AGE) fields.dob = `Age must be between ${MIN_AGE} and ${MAX_AGE}.`;
  }

  const bloodGroup = text(body.bloodGroup);
  if (!bloodGroup) fields.bloodGroup = 'Please select a blood group.';
  else if (!BLOOD_GROUPS.includes(bloodGroup)) fields.bloodGroup = 'Unknown blood group.';

  const licenceType = text(body.licenceType);
  if (!licenceType) fields.licenceType = 'Please select a licence type.';
  else if (!ALL_LICENCE_TYPES.includes(licenceType)) fields.licenceType = 'Unknown licence type.';

  const address = text(body.address);
  if (!address) fields.address = 'Address is required.';
  else if (address.length > 500) fields.address = 'Address is too long.';

  const guardianName = text(body.guardianName);
  if (guardianName.length > 120) fields.guardianName = 'Guardian name is too long.';

  const applicationNumber = text(body.applicationNumber);
  if (applicationNumber.length > 64) fields.applicationNumber = 'Application number is too long.';

  if (Object.keys(fields).length) return { ok: false, fields };

  return {
    ok: true,
    fields,
    value: {
      id: id || newId('c'),
      createdAt: isoOrNow(body.createdAt),
      name,
      phone,
      alternatePhone: alternatePhone || null,
      applicationNumber: applicationNumber || null,
      guardianName: guardianName || null,
      dob,
      bloodGroup,
      licenceType,
      address,
    },
  };
}

/**
 * Validates a payment payload. Accepts either `paidAt` (ISO) or `date` (yyyy-mm-dd),
 * matching what the form sends.
 */
function validatePayment(input) {
  const fields = {};
  const body = input && typeof input === 'object' ? input : {};

  const id = text(body.id);
  if (id && !ID_RE.test(id)) fields.id = 'Invalid payment id.';

  const clientId = text(body.clientId);
  if (!clientId) fields.clientId = 'Client is required.';
  else if (!ID_RE.test(clientId)) fields.clientId = 'Invalid client id.';

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) fields.amount = 'Enter a valid amount.';
  else if (amount > 10_000_000) fields.amount = 'Amount is too large.';

  let paidAt = null;
  if (body.paidAt) {
    const parsed = new Date(body.paidAt);
    if (Number.isNaN(parsed.getTime())) fields.paidAt = 'Select a date.';
    else paidAt = parsed.toISOString();
  } else if (body.date) {
    if (!YMD_RE.test(text(body.date))) fields.paidAt = 'Select a date.';
    else {
      const parsed = new Date(`${text(body.date)}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) fields.paidAt = 'Select a date.';
      else paidAt = parsed.toISOString();
    }
  } else {
    fields.paidAt = 'Select a date.';
  }

  const method = text(body.method);
  if (method && !PAYMENT_METHODS.includes(method)) fields.method = 'Unknown payment method.';

  const note = text(body.note);
  if (note.length > 500) fields.note = 'Note is too long.';

  if (Object.keys(fields).length) return { ok: false, fields };

  return {
    ok: true,
    fields,
    value: {
      id: id || newId('p'),
      clientId,
      amount,
      paidAt,
      method: method || null,
      note: note || null,
    },
  };
}

function isoOrNow(value) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

/** Same id shape the original app used: `c_<epoch>_<random>`. */
function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

module.exports = { validateClient, validatePayment, ageFromDob, newId, PHONE_RE };
