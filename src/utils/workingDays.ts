/**
 * Working-day calendar math.
 *
 * All scheduling (durations, dependency lag, critical path) is performed on
 * "working-day ordinals": the Nth working day counted from EPOCH. Consecutive
 * working days therefore have consecutive ordinals, which makes dependency and
 * CPM arithmetic plain integer math.
 */

import { addDays, dayOfWeek, isValidISO, todayISO } from './dates';
import type { WorkingCalendar } from '../types';

export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri
export const EPOCH = '2020-01-01';

export function calendarOf(
  workingDays: number[] | undefined,
  holidays: { date: string }[] | string[] | undefined,
): WorkingCalendar {
  const wd = workingDays && workingDays.length > 0 ? workingDays : DEFAULT_WORKING_DAYS;
  const hol: string[] = [];
  if (holidays) {
    for (const h of holidays) {
      if (typeof h === 'string') hol.push(h);
      else if (h && typeof h.date === 'string') hol.push(h.date);
    }
  }
  return { workingDays: wd, holidays: hol };
}

export function isWorkingDay(iso: string, cal: WorkingCalendar): boolean {
  if (!isValidISO(iso)) return false;
  if (cal.holidays.includes(iso)) return false;
  return cal.workingDays.includes(dayOfWeek(iso));
}

/** Strictly the next working day after `iso`. */
export function nextWorkingDay(iso: string, cal: WorkingCalendar): string {
  let cur = iso;
  for (let i = 0; i < 400; i++) {
    cur = addDays(cur, 1);
    if (isWorkingDay(cur, cal)) return cur;
  }
  return iso;
}

/** Strictly the previous working day before `iso`. */
export function prevWorkingDay(iso: string, cal: WorkingCalendar): string {
  let cur = iso;
  for (let i = 0; i < 400; i++) {
    cur = addDays(cur, -1);
    if (isWorkingDay(cur, cal)) return cur;
  }
  return iso;
}

/** If `iso` is not a working day, moves it forward to the next one. */
export function normalizeWorkingDay(iso: string, cal: WorkingCalendar): string {
  if (!isValidISO(iso)) return todayISO();
  if (isWorkingDay(iso, cal)) return iso;
  return nextWorkingDay(iso, cal);
}

/**
 * Adds `n` working days (may be negative, zero returns the normalized start).
 * The starting date is first normalized onto a working day.
 */
export function addWorkingDays(iso: string, n: number, cal: WorkingCalendar): string {
  let cur = normalizeWorkingDay(iso, cal);
  const step = n >= 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(n); i++) {
    cur = step > 0 ? nextWorkingDay(cur, cal) : prevWorkingDay(cur, cal);
  }
  return cur;
}

/** Signed count of working days in the inclusive range [a, b]. */
export function workingDaysInclusive(a: string, b: string, cal: WorkingCalendar): number {
  if (a === b) return isWorkingDay(a, cal) ? 1 : 0;
  if (a > b) return -workingDaysInclusive(b, a, cal);
  let count = 0;
  let cur = a;
  while (cur <= b) {
    if (isWorkingDay(cur, cal)) count++;
    cur = addDays(cur, 1);
  }
  return count;
}

/** End date of a task that starts on `startIso` and lasts `duration` working days. */
export function spanEndDate(startIso: string, duration: number, cal: WorkingCalendar): string {
  const start = normalizeWorkingDay(startIso, cal);
  if (duration <= 1) return start;
  return addWorkingDays(start, duration - 1, cal);
}

/** Number of calendar days a task occupies (for bar sizing): always >= 1. */
export function taskSpanDays(startIso: string, endIso: string): number {
  const [a, b] = startIso <= endIso ? [startIso, endIso] : [endIso, startIso];
  const d0 = parseDayNumber(a);
  const d1 = parseDayNumber(b);
  return Math.max(1, d1 - d0 + 1);
}

function parseDayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Days between two ISO dates on the calendar-day axis (b - a, inclusive span = +1). */
export function dayIndex(iso: string, originIso: string): number {
  return parseDayNumber(iso) - parseDayNumber(originIso);
}

export function dayNumber(iso: string): number {
  return parseDayNumber(iso);
}

function dayNum(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Working days in the half-open range [from, to), holidays excluded. */
export function countWorkingDays(from: string, to: string, cal: WorkingCalendar): number {
  const days = dayNum(to) - dayNum(from);
  if (days <= 0) return 0;
  const set = new Set(cal.workingDays);
  const weeks = Math.floor(days / 7);
  let count = weeks * set.size;
  const rem = days - weeks * 7;
  let dow = dayOfWeek(from);
  for (let i = 0; i < rem; i++) {
    if (set.has(dow)) count++;
    dow = (dow + 1) % 7;
  }
  for (const h of cal.holidays) {
    if (h >= from && h < to && set.has(dayOfWeek(h))) count--;
  }
  return count;
}

/**
 * Ordinal of `iso`: number of working days strictly before it, counted from EPOCH.
 * For a working day `d` this equals its 0-based position among working days, so
 * dateFromWorkOrdinal(workOrdinal(d)) === d.
 */
export function workOrdinal(iso: string, cal: WorkingCalendar): number {
  if (!isValidISO(iso) || iso <= EPOCH) return 0;
  return countWorkingDays(EPOCH, iso, cal);
}

/** Inverse of {@link workOrdinal}: the Nth working day (0-based) from EPOCH. */
export function dateFromWorkOrdinal(n: number, cal: WorkingCalendar): string {
  const target = Math.max(0, n) + 1; // cumulative count we are looking for
  let lo = dayNum(EPOCH);
  let hi = lo + 365 * 30;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const midIso = isoFromDayNum(mid);
    const cumulative = countWorkingDays(EPOCH, midIso, cal) + (isWorkingDay(midIso, cal) ? 1 : 0);
    if (cumulative >= target) hi = mid;
    else lo = mid + 1;
  }
  return isoFromDayNum(lo);
}

function isoFromDayNum(day: number): string {
  const d = new Date(day * 86_400_000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
