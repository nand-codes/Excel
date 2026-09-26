import { formatLongDate, formatMoney } from './format';
import type { Client } from './types';

const WA_PENDING_PATH = '/wa-pending.html';
const WA_MESSAGE_TYPE = 'excel-wa-deliver';
const WA_CHANNEL_NAME = 'excel-wa-deliver';
const WA_DELIVER_MS = 500;
const WA_DELIVER_ATTEMPTS = 40;

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
 * Reserved synchronously inside the click handler before any network work. A same-origin
 * pending page receives the final wa.me link through postMessage once the save finishes —
 * navigating an about:blank tab from the opener after an await is blocked in Chrome.
 */
export function reserveWhatsAppTab(): Window | null {
  return window.open(WA_PENDING_PATH, '_blank');
}

export interface WhatsAppResult {
  ok: boolean;
  error?: string;
  url?: string;
}

function broadcastDeliver(url: string) {
  if (typeof BroadcastChannel === 'undefined') return null;

  const channel = new BroadcastChannel(WA_CHANNEL_NAME);
  let attempts = 0;

  const send = () => {
    channel.postMessage({ url });
    attempts += 1;
    if (attempts >= WA_DELIVER_ATTEMPTS) {
      window.clearInterval(timer);
      channel.close();
    }
  };

  send();
  const timer = window.setInterval(send, WA_DELIVER_MS);
  return timer;
}

function postDeliverMessage(tab: Window, url: string) {
  const payload = { type: WA_MESSAGE_TYPE, url };
  tab.postMessage(payload, window.location.origin);
}

/**
 * Open WhatsApp immediately — use when the URL is known inside the same click handler
 * (practice reminders). Popup blockers allow this because it is still user-initiated.
 */
export function openWhatsAppDirect(phone: string, message: string): WhatsAppResult {
  const url = buildWhatsAppUrl(phone, message);
  if (!url) return { ok: false, error: 'Client phone number looks invalid.' };

  const tab = window.open(url, '_blank');
  if (tab) {
    tab.opener = null;
    return { ok: true, url };
  }

  return {
    ok: false,
    error: 'Your browser blocked the WhatsApp tab. Allow pop-ups for this site.',
    url,
  };
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

  if (tab && !tab.closed) {
    broadcastDeliver(url);
    postDeliverMessage(tab, url);
    tab.focus();
    return { ok: true, url };
  }

  return openWhatsAppDirect(phone, message);
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
