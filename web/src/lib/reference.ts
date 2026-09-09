/**
 * Reference lists for the form controls. The accepted values are also enforced
 * server-side in db/reference.js; docs/APP_SPEC.md is the source of truth.
 */

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export interface LicenceOption {
  value: string;
  label: string;
}

export const LICENCE_OPTIONS: LicenceOption[] = [
  { value: 'MCWOG', label: 'MCWOG – Motorcycle Without Gear' },
  { value: 'MCWG', label: 'MCWG – Motorcycle With Gear' },
  { value: 'LMV', label: 'LMV – Light Motor Vehicle' },
  { value: 'LMV + MCWG', label: 'LMV + MCWG – Car + Motorcycle with Gear' },
  { value: 'LMV + MCWOG', label: 'LMV + MCWOG – Car + Motorcycle without Gear' },
  { value: 'LMV-NT', label: 'LMV-NT – Light Motor Vehicle (Non-Transport)' },
  { value: 'LMV-TR', label: 'LMV-TR – Light Motor Vehicle (Transport/Commercial)' },
  { value: 'LMV-TR + MCWG', label: 'LMV-TR + MCWG' },
  { value: 'HMV', label: 'HMV – Heavy Motor Vehicle' },
  { value: 'HGMV', label: 'HGMV – Heavy Goods Motor Vehicle' },
  { value: 'HPMV', label: 'HPMV – Heavy Passenger Motor Vehicle' },
  { value: 'MGV', label: 'MGV – Medium Goods Vehicle' },
  { value: 'MPV', label: 'MPV – Medium Passenger Vehicle' },
  { value: 'TRAILER', label: 'TRAILER – Trailer Vehicle' },
  { value: 'TRANS', label: 'TRANS – Transport Vehicle' },
];

/** Still stored and filterable, but no longer offered on the form. */
export const LEGACY_LICENCE_OPTIONS: LicenceOption[] = [{ value: 'Transport', label: 'Transport (legacy)' }];

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank transfer', 'Cheque'] as const;

const CHART_LABELS: Record<string, string> = {
  'LMV + MCWG': 'LMV+MCWG',
  'LMV + MCWOG': 'LMV+MCWOG',
  'LMV-TR + MCWG': 'LMV-TR+MCWG',
};

/** Compact label for chart axes; unknown and legacy values pass through. */
export function licenceChartLabel(value: string): string {
  return CHART_LABELS[value] ?? value;
}
