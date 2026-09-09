import { getAge } from './format';
import type { FieldErrors } from './api';

const PHONE_RE = /^\+?\d[\d\s-]{6,14}$/;

export const MIN_AGE = 14;
export const MAX_AGE = 100;

export interface ClientFormValues {
  name: string;
  guardianName: string;
  applicationNumber: string;
  phone: string;
  alternatePhone: string;
  dob: string;
  bloodGroup: string;
  licenceType: string;
  address: string;
}

export const emptyClientForm: ClientFormValues = {
  name: '',
  guardianName: '',
  applicationNumber: '',
  phone: '',
  alternatePhone: '',
  dob: '',
  bloodGroup: '',
  licenceType: '',
  address: '',
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Mirrors the server rules in server/validation.js and docs/APP_SPEC.md. */
export function validateClientForm(values: ClientFormValues): FieldErrors {
  const errors: FieldErrors = {};

  const name = values.name.trim();
  const phone = values.phone.trim();
  const alternatePhone = values.alternatePhone.trim();
  const address = values.address.trim();

  if (!name) errors.name = 'Full name is required.';

  if (!phone) {
    errors.phone = 'Phone number is required.';
  } else if (!PHONE_RE.test(phone)) {
    errors.phone = 'Enter a valid phone number.';
  }

  if (alternatePhone) {
    if (!PHONE_RE.test(alternatePhone)) {
      errors.alternatePhone = 'Enter a valid alternate number.';
    } else if (digitsOnly(alternatePhone) && digitsOnly(alternatePhone) === digitsOnly(phone)) {
      errors.alternatePhone = 'Alternate number must differ from primary phone.';
    }
  }

  if (!values.dob) {
    errors.dob = 'Date of birth is required.';
  } else {
    const age = getAge(values.dob);
    if (age == null) errors.dob = 'Enter a valid date of birth.';
    else if (age < MIN_AGE || age > MAX_AGE) errors.dob = `Age must be between ${MIN_AGE} and ${MAX_AGE}.`;
  }

  if (!values.bloodGroup) errors.bloodGroup = 'Please select a blood group.';
  if (!values.licenceType) errors.licenceType = 'Please select a licence type.';
  if (!address) errors.address = 'Address is required.';

  return errors;
}

export interface PaymentFormValues {
  amount: string;
  date: string;
  method: string;
  note: string;
}

export function validatePaymentForm(values: PaymentFormValues): FieldErrors {
  const errors: FieldErrors = {};
  const amount = Number(values.amount);

  if (!values.amount || Number.isNaN(amount) || amount <= 0) errors.amount = 'Enter a valid amount.';
  if (!values.date) errors.date = 'Select a date.';

  return errors;
}
