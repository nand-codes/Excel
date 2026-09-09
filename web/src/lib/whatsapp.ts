import { formatLongDate, formatMoney } from './format';
import type { Client } from './types';

/**
 * WhatsApp needs an international number. Indian numbers are stored locally, so a
 * bare 10-digit number gets the country code and a leading trunk `0` is dropped.
 */
export function normalizePhoneForWhatsApp(raw: string | null | undefined): string | null {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 11 ? digits : null;
}

export function buildWhatsAppUrl(phone: string, message: string): string | null {
  const digits = normalizePhoneForWhatsApp(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Must be called synchronously inside the click handler. Opening the tab after an
 * `await` is what popup blockers kill, so the tab is reserved first and pointed at
 * WhatsApp once the save completes.
 */
export function reserveWhatsAppTab(): Window | null {
  return window.open('', '_blank', 'noopener');
}

export interface WhatsAppResult {
  ok: boolean;
  error?: string;
  url?: string;
}

export function deliverWhatsApp(
  tab: Window | null,
  phone: string,
  message: string
): WhatsAppResult {
  const url = buildWhatsAppUrl(phone, message);

  if (!url) {
    tab?.close();
    return { ok: false, error: 'Client phone number looks invalid.' };
  }

  if (!tab || tab.closed) {
    return {
      ok: false,
      error: 'Your browser blocked the WhatsApp tab. Allow pop-ups for this site.',
      url,
    };
  }

  tab.location.href = url;
  return { ok: true, url };
}

export function registrationMessage(client: Pick<Client, 'name'>): string {
  return (
    `Dear ${client.name}, congratulations! You have been successfully registered with ` +
    'Excel Driving School. We look forward to helping you with your training. — Excel Driving School'
  );
}

export function paymentMessage(client: Pick<Client, 'name'>, amount: number, total: number): string {
  return (
    `Dear ${client.name}, payment of ${formatMoney(amount)} received. ` +
    `Total paid so far: ${formatMoney(total)}. - Excel Driving School`
  );
}

export function practiceMessage(
  client: Pick<Client, 'name'>,
  dateYmd: string,
  time12: string
): string {
  return (
    `Dear ${client.name}, please be available at Excel Driving School on ${formatLongDate(dateYmd)} ` +
    `at ${time12} for driving practice. Thank you. — Excel Driving School`
  );
}
