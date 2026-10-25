import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { calendarOf, dateFromWorkOrdinal, workOrdinal } from './workingDays';
import { computeCriticalPath } from './criticalPath';

const CAL = calendarOf([1, 2, 3, 4, 5], ['2026-01-07']); // holiday Wednesday

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    projectId: 'p1',
    contentItemId: null,
    parentId: null,
    name: `Task ${id}`,
    startDate: '2026-01-05',
    duration: 2,
    status: 'Not Started',
    priority: 'Medium',
    progress: 0,
    assigneeId: null,
    isMilestone: false,
    dependencies: [],
    ...overrides,
  };
}

function fs(predecessorId: string, lag = 0) {
  return { predecessorId, type: 'FS' as const, lag };
}

describe('critical path method', () => {
  it('marks a linear chain as critical and sums working-day duration', () => {
    const a = makeTask('a', { startDate: '2026-01-05', duration: 2 });
    const b = makeTask('b', { startDate: '2026-01-07', duration: 2, dependencies: [fs('a')] });
    const c = makeTask('c', { startDate: '2026-01-09', duration: 2, dependencies: [fs('b')] });

    const result = computeCriticalPath([a, b, c], CAL);

    expect(result.criticalIds.sort()).toEqual(['a', 'b', 'c']);
    expect(result.floats['a']).toBe(0);
    expect(result.floats['b']).toBe(0);
    expect(result.floats['c']).toBe(0);
    // start Jan 5 (ord n) .. end of c: Jan 5,6,8,9,12,13 -> 6 working days
    expect(result.durationWorkingDays).toBe(6);
    expect(result.projectStart).toBe('2026-01-05');
    expect(result.projectEnd).toBe('2026-01-13');
    expect(result.orderedPath).toEqual(['a', 'b', 'c']);
  });

  it('gives float to parallel work that is not on the critical path', () => {
    const critical = makeTask('crit', { startDate: '2026-01-05', duration: 5 }); // ends Jan 12
    const slack = makeTask('slack', { startDate: '2026-01-05', duration: 1 });

    const result = computeCriticalPath([critical, slack], CAL);

    expect(result.criticalIds).toContain('crit');
    expect(result.criticalIds).not.toContain('slack');
    expect(result.floats['slack']).toBeGreaterThan(0);
    // slack can be delayed by 4 working days without moving the project end
    expect(result.floats['slack']).toBe(4);
    expect(result.durationWorkingDays).toBe(5);
    expect(result.projectEnd).toBe('2026-01-12');
  });

  it('respects working days when converting ordinals to dates', () => {
    const a = makeTask('a', { startDate: '2026-01-09', duration: 3 }); // Fri + 3 wd
    const result = computeCriticalPath([a], CAL);
    expect(result.projectStart).toBe('2026-01-09');
    // Fri 9, Mon 12, Tue 13 -> holiday on Jan 7 is irrelevant but weekend is skipped
    expect(result.projectEnd).toBe('2026-01-13');
    expect(result.durationWorkingDays).toBe(3);
  });

  it('handles milestones with zero duration', () => {
    const a = makeTask('a', { startDate: '2026-01-05', duration: 2 });
    const m = makeTask('m', {
      startDate: '2026-01-07',
      duration: 0,
      isMilestone: true,
      dependencies: [fs('a')],
    });
    const result = computeCriticalPath([a, m], CAL);
    expect(result.earliestStart['m']).toBe(result.earliestEnd['m']);
    expect(result.orderedPath).toEqual(['a', 'm']);
    expect(result.projectEnd).toBe('2026-01-08'); // day after a finishes (Jan 6)
  });

  it('propagates lag into float calculations', () => {
    const a = makeTask('a', { startDate: '2026-01-05', duration: 2 }); // ends Jan 6
    const b = makeTask('b', {
      startDate: '2026-01-12',
      duration: 1,
      dependencies: [fs('a', 3)],
    });
    const result = computeCriticalPath([a, b], CAL);
    // b earliest start = Jan 6 + 1 + 3 wd = Jan 13 (holiday skipped)
    expect(dateFromWorkOrdinal(result.earliestStart['b'], CAL)).toBe('2026-01-13');
    // scheduled start Jan 12 sits earlier than earliest -> graph still forces Jan 13
    expect(result.floats['b']).toBe(0);
    expect(result.criticalIds.sort()).toEqual(['a', 'b']);
  });

  it('treats summary tasks as containers inheriting the worst child float', () => {
    const parent = makeTask('parent', { startDate: '2026-01-05', duration: 5 });
    const child = makeTask('child', {
      startDate: '2026-01-05',
      duration: 5,
      parentId: 'parent',
    });
    const later = makeTask('later', { startDate: '2026-01-05', duration: 5 });

    const result = computeCriticalPath([parent, child, later], CAL);
    // parent is a summary: its early window equals the child's window
    expect(result.earliestStart['parent']).toBe(result.earliestStart['child']);
    expect(result.floats['parent']).toBe(result.floats['child']);
    expect(result.durationWorkingDays).toBe(5);
  });

  it('returns an empty result for an empty task list', () => {
    const result = computeCriticalPath([], CAL);
    expect(result.criticalIds).toEqual([]);
    expect(result.durationWorkingDays).toBe(0);
  });

  it('keeps ordinals consistent with the calendar', () => {
    const a = makeTask('a', { startDate: '2026-01-05', duration: 2 });
    const result = computeCriticalPath([a], CAL);
    expect(workOrdinal(result.projectStart, CAL)).toBe(result.projectStartOrd);
    expect(dateFromWorkOrdinal(result.projectEndOrd, CAL)).toBe(result.projectEnd);
  });
});
