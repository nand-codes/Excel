'use strict';

/**
 * Reference lists shared by the API and the CLI.
 * Source of truth for the values themselves is docs/APP_SPEC.md; the web app keeps
 * its own copy with display labels in web/src/lib/reference.ts.
 */

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const LICENCE_TYPES = [
  'MCWOG',
  'MCWG',
  'LMV',
  'LMV + MCWG',
  'LMV + MCWOG',
  'LMV-NT',
  'LMV-TR',
  'LMV-TR + MCWG',
  'HMV',
  'HGMV',
  'HPMV',
  'MGV',
  'MPV',
  'TRAILER',
  'TRANS',
];

/** Accepted on read/write but no longer offered in the form. */
const LEGACY_LICENCE_TYPES = ['Transport'];

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank transfer', 'Cheque'];

module.exports = {
  BLOOD_GROUPS,
  LICENCE_TYPES,
  LEGACY_LICENCE_TYPES,
  PAYMENT_METHODS,
  ALL_LICENCE_TYPES: [...LICENCE_TYPES, ...LEGACY_LICENCE_TYPES],
};
