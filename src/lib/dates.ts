import { formatInTimeZone } from 'date-fns-tz';
import { formatDistanceToNowStrict, isToday, isTomorrow } from 'date-fns';

export const DEFAULT_TZ = 'Africa/Accra';
let currentTz = DEFAULT_TZ;

export function setUserTimezone(tz?: string | null) {
  try {
    if (tz) {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      currentTz = tz;
      return;
    }
  } catch {
    /* invalid tz, keep default */
  }
  currentTz = DEFAULT_TZ;
}
export const userTz = () => currentTz;

type D = string | number | Date | null | undefined;
const toDate = (d: D) => (d == null ? null : d instanceof Date ? d : new Date(d));

export function fmtDate(d: D, pattern = 'd MMM yyyy') {
  const x = toDate(d);
  return x ? formatInTimeZone(x, currentTz, pattern) : '—';
}
export function fmtDateTime(d: D) {
  return fmtDate(d, "EEE d MMM yyyy, HH:mm");
}
export function fmtTime(d: D) {
  return fmtDate(d, 'HH:mm');
}
export function fromNow(d: D) {
  const x = toDate(d);
  return x ? formatDistanceToNowStrict(x, { addSuffix: true }) : '—';
}
export function dayLabel(d: D) {
  const x = toDate(d);
  if (!x) return '—';
  if (isToday(x)) return 'Today';
  if (isTomorrow(x)) return 'Tomorrow';
  return fmtDate(x, 'EEE d MMM');
}
export function tzAbbrev() {
  return currentTz === 'Africa/Accra' ? 'GMT' : currentTz;
}
/** Convert a value from <input type="datetime-local"> (user tz assumed browser-local) to ISO. */
export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
export function isoToLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
