/**
 * Plain calendar-date helpers. All dates are ISO strings (YYYY-MM-DD),
 * parsed as local midnight so no timezone shift can occur.
 */

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const MONTH_FULL_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MS_PER_DAY = 86_400_000;

export function isValidISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = parseISODate(iso);
  return !Number.isNaN(d.getTime()) && toISODate(d) === iso;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function dayOfWeek(iso: string): number {
  return parseISODate(iso).getDay();
}

/** Signed difference in calendar days: diffDays(a, b) = b - a. */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / MS_PER_DAY);
}

export function compareISO(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isSameDay(a: string, b: string): boolean {
  return a === b;
}

export function todayISO(): string {
  const n = new Date();
  return toISODate(n);
}

export function formatDate(iso: string): string {
  if (!isValidISO(iso)) return iso;
  const d = parseISODate(iso);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatShortDate(iso: string): string {
  if (!isValidISO(iso)) return iso;
  const d = parseISODate(iso);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function formatDayDate(iso: string): string {
  if (!isValidISO(iso)) return iso;
  const d = parseISODate(iso);
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function formatMonthYear(iso: string): string {
  const d = parseISODate(iso);
  return `${MONTH_FULL_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Monday-based start of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const d = parseISODate(iso);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toISODate(d);
}

/** Sunday-based start of the week containing `iso` (used by month grids). */
export function startOfWeekSunday(iso: string): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() - d.getDay());
  return toISODate(d);
}

export function startOfMonth(iso: string): string {
  const d = parseISODate(iso);
  d.setDate(1);
  return toISODate(d);
}

export function endOfMonth(iso: string): string {
  const d = parseISODate(iso);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toISODate(d);
}

export function addMonths(iso: string, months: number): string {
  const d = parseISODate(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = endOfMonth(toISODate(d));
  const lastDay = parseISODate(last).getDate();
  d.setDate(Math.min(day, lastDay));
  return toISODate(d);
}

export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  if (start > end) return out;
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** 42 day cells (6 weeks, Sunday first) covering the month of `viewIso`. */
export function monthGrid(viewIso: string): string[] {
  const first = startOfWeekSunday(startOfMonth(viewIso));
  const out: string[] = [];
  for (let i = 0; i < 42; i++) out.push(addDays(first, i));
  return out;
}

export function minISO(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxISO(a: string, b: string): string {
  return a >= b ? a : b;
}

export function minOf(list: string[]): string {
  return list.reduce((acc, v) => (acc === '' || v < acc ? v : acc), '');
}

export function maxOf(list: string[]): string {
  return list.reduce((acc, v) => (acc === '' || v > acc ? v : acc), '');
}

/** Human friendly day-count label, e.g. "12 working days". */
export function formatWorkingDays(days: number): string {
  if (days === 1) return '1 working day';
  return `${days} working days`;
}
