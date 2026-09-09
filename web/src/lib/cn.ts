type ClassValue = string | number | false | null | undefined;

/** Tiny class name joiner — enough for this app, no dependency needed. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
