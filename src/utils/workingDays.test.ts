import { describe, expect, it } from 'vitest';
import {
  addWorkingDays,
  calendarOf,
  countWorkingDays,
  dateFromWorkOrdinal,
  isWorkingDay,
  normalizeWorkingDay,
  spanEndDate,
  workingDaysInclusive,
  workOrdinal,
} from './workingDays';
import type { WorkingCalendar } from '../types';

// 2026-01-01 is a Thursday, so 2026-01-05 is a Monday and 2026-01-09 a Friday.
const CAL: WorkingCalendar = calendarOf([1, 2, 3, 4, 5], []);
const CAL_WITH_HOLIDAY: WorkingCalendar = calendarOf([1, 2, 3, 4, 5], ['2026-01-07']);
const CAL_SATURDAY: WorkingCalendar = calendarOf([1, 2, 3, 4, 5, 6], []);

describe('working-day calendar', () => {
  it('classifies weekdays, weekends and holidays', () => {
    expect(isWorkingDay('2026-01-05', CAL)).toBe(true);
    expect(isWorkingDay('2026-01-10', CAL)).toBe(false); // Saturday
    expect(isWorkingDay('2026-01-11', CAL)).toBe(false); // Sunday
    expect(isWorkingDay('2026-01-07', CAL)).toBe(true);
    expect(isWorkingDay('2026-01-07', CAL_WITH_HOLIDAY)).toBe(false);
  });

  it('normalizes non-working days forward', () => {
    expect(normalizeWorkingDay('2026-01-10', CAL)).toBe('2026-01-12');
    expect(normalizeWorkingDay('2026-01-05', CAL)).toBe('2026-01-05');
    expect(normalizeWorkingDay('2026-01-07', CAL_WITH_HOLIDAY)).toBe('2026-01-08');
  });

  it('adds working days across weekends', () => {
    expect(addWorkingDays('2026-01-05', 0, CAL)).toBe('2026-01-05');
    expect(addWorkingDays('2026-01-09', 1, CAL)).toBe('2026-01-12'); // Fri + 1 = Mon
    expect(addWorkingDays('2026-01-05', 4, CAL)).toBe('2026-01-09');
    expect(addWorkingDays('2026-01-12', -1, CAL)).toBe('2026-01-09'); // Mon - 1 = Fri
    expect(addWorkingDays('2026-01-10', 1, CAL)).toBe('2026-01-13'); // normalized Sat -> Mon, +1 = Tue
  });

  it('skips holidays when adding working days', () => {
    expect(addWorkingDays('2026-01-06', 1, CAL_WITH_HOLIDAY)).toBe('2026-01-08');
    expect(addWorkingDays('2026-01-05', 4, CAL_WITH_HOLIDAY)).toBe('2026-01-12');
  });

  it('counts working days inclusively (signed)', () => {
    expect(workingDaysInclusive('2026-01-05', '2026-01-09', CAL)).toBe(5);
    expect(workingDaysInclusive('2026-01-09', '2026-01-12', CAL)).toBe(2); // Fri, Mon
    expect(workingDaysInclusive('2026-01-05', '2026-01-05', CAL)).toBe(1);
    expect(workingDaysInclusive('2026-01-12', '2026-01-05', CAL)).toBe(-5);
    expect(workingDaysInclusive('2026-01-05', '2026-01-09', CAL_WITH_HOLIDAY)).toBe(4);
  });

  it('derives end dates from duration', () => {
    expect(spanEndDate('2026-01-05', 1, CAL)).toBe('2026-01-05');
    expect(spanEndDate('2026-01-05', 5, CAL)).toBe('2026-01-09');
    expect(spanEndDate('2026-01-09', 2, CAL)).toBe('2026-01-12'); // spans the weekend
    expect(spanEndDate('2026-01-10', 1, CAL)).toBe('2026-01-12'); // weekend start normalized
    expect(spanEndDate('2026-01-05', 3, CAL_SATURDAY)).toBe('2026-01-07');
  });

  it('maps working days to consecutive ordinals and back', () => {
    const days = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-12'];
    const ordinals = days.map((d) => workOrdinal(d, CAL));
    for (let i = 1; i < ordinals.length; i++) {
      expect(ordinals[i]).toBe(ordinals[i - 1] + 1);
    }
    for (const d of days) {
      expect(dateFromWorkOrdinal(workOrdinal(d, CAL), CAL)).toBe(d);
    }
  });

  it('snapshots non-working dates to the previous working day ordinal', () => {
    expect(dateFromWorkOrdinal(workOrdinal('2026-01-10', CAL), CAL)).toBe('2026-01-09');
    expect(
      dateFromWorkOrdinal(workOrdinal('2026-01-07', CAL_WITH_HOLIDAY), CAL_WITH_HOLIDAY),
    ).toBe('2026-01-06');
  });

  it('counts working days in a half-open range excluding holidays', () => {
    expect(countWorkingDays('2026-01-05', '2026-01-10', CAL)).toBe(5);
    expect(countWorkingDays('2026-01-05', '2026-01-10', CAL_WITH_HOLIDAY)).toBe(4);
    expect(countWorkingDays('2026-01-09', '2026-01-10', CAL)).toBe(1);
  });
});
