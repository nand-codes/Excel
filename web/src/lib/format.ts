const LOCALE = 'en-IN';

/** `dd Mon yyyy`, or an em dash when the date is missing. */
export function formatDob(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const date = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Full weekday and month, used in WhatsApp reminders. Parsed at noon to dodge timezone drift. */
export function formatLongDate(ymd: string | null | undefined): string {
  if (!ymd) return '';
  const date = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatIsoDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' })}, ${date.toLocaleTimeString(
    LOCALE,
    { hour: 'numeric', minute: '2-digit' }
  )}`;
}

export function formatTopbarDate(now = new Date()): string {
  return now.toLocaleDateString(LOCALE, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatMoney(amount: number | string | null | undefined): string {
  const value = Number(amount) || 0;
  return `₹${value.toLocaleString(LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Whole years, decremented when this year's birthday has not happened yet. */
export function getAge(ymd: string | null | undefined): number | null {
  if (!ymd) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const today = new Date();

  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() - (month - 1);
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) age -= 1;
  return age;
}

export function getInitial(name: string | null | undefined): string {
  return (name || '?').charAt(0).toUpperCase();
}

export function truncate(value: string | null | undefined, max: number): string {
  if (!value) return '—';
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function todayYmd(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** e.g. `9:05 AM` from the three practice-time controls. */
export function formatTime12(hour: string, minute: string, meridiem: string): string {
  return `${hour}:${minute} ${meridiem}`;
}

/** Local Date for a chosen practice date plus 12-hour time, or null when unparseable. */
export function practiceDateTime(
  ymd: string,
  hour12: string,
  minute: string,
  meridiem: string
): Date | null {
  let hour = Number.parseInt(hour12, 10);
  const minutes = Number.parseInt(minute, 10);
  if (Number.isNaN(hour) || Number.isNaN(minutes)) return null;

  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  const parts = String(ymd || '')
    .split('-')
    .map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;

  return new Date(parts[0], parts[1] - 1, parts[2], hour, minutes, 0, 0);
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
