import { describe, expect, it } from 'vitest';
import type { Dependency, Task } from '../types';
import { calendarOf } from './workingDays';
import {
  applyTaskUpdate,
  forwardConstraint,
  backwardConstraint,
  insertTask,
  recomputeSummarySpans,
  removeTask,
  spanOf,
  taskEndISO,
} from './scheduling';

// Calendar: Mon-Fri, with a holiday on Wednesday 2026-01-07.
const CAL = calendarOf([1, 2, 3, 4, 5], ['2026-01-07']);

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

function fs(predecessorId: string, lag = 0): Dependency {
  return { predecessorId, type: 'FS', lag };
}

describe('duration and end dates', () => {
  it('derives the end date from start + duration (working days only)', () => {
    // Mon Jan 5, Tue Jan 6, (Wed Jan 7 holiday), Thu Jan 8
    expect(taskEndISO(makeTask('a', { startDate: '2026-01-05', duration: 3 }), CAL)).toBe(
      '2026-01-08',
    );
    // 5 working days from Jan 5: 5, 6, 8, 9, 12 (holiday consumed)
    expect(taskEndISO(makeTask('a', { startDate: '2026-01-05', duration: 5 }), CAL)).toBe(
      '2026-01-12',
    );
    expect(
      taskEndISO(makeTask('m', { startDate: '2026-01-09', duration: 0, isMilestone: true }), CAL),
    ).toBe('2026-01-09');
    expect(taskEndISO(makeTask('w', { startDate: '2026-01-10', duration: 1 }), CAL)).toBe(
      '2026-01-12',
    );
  });
});

describe('constraint formulas (FS / SS / FF / SF + lag)', () => {
  const dep = (type: Dependency['type'], lag: number): Dependency => ({
    predecessorId: 'p',
    type,
    lag,
  });

  it('computes forward (successor start) bounds', () => {
    // predecessor: start 10, end 14
    expect(forwardConstraint(10, 14, dep('FS', 0), 0)).toBe(15);
    expect(forwardConstraint(10, 14, dep('FS', 3), 2)).toBe(18);
    expect(forwardConstraint(10, 14, dep('SS', 2), 5)).toBe(12);
    expect(forwardConstraint(10, 14, dep('FF', 1), 4)).toBe(11); // 14 + 1 - 4
    expect(forwardConstraint(10, 14, dep('SF', 0), 6)).toBe(4); // 10 + 0 - 6
  });

  it('computes backward (predecessor finish) bounds', () => {
    // successor: start 20, end 24; predecessor span 3
    expect(backwardConstraint(20, 24, dep('FS', 1), 3)).toBe(18); // 20 - 1 - 1
    expect(backwardConstraint(20, 24, dep('SS', 2), 3)).toBe(21); // 20 - 2 + 3
    expect(backwardConstraint(20, 24, dep('FF', 1), 3)).toBe(23); // 24 - 1
    expect(backwardConstraint(20, 24, dep('SF', 0), 3)).toBe(27); // 24 + 3
  });

  it('spanOf handles milestones and durations', () => {
    expect(spanOf(1)).toBe(0);
    expect(spanOf(5)).toBe(4);
    expect(spanOf(0)).toBe(0);
  });
});

describe('constraint propagation', () => {
  it('moves a dependent task when its predecessor moves later', () => {
    const pred = makeTask('pred', { startDate: '2026-01-05', duration: 2 }); // ends Jan 6
    const succ = makeTask('succ', {
      startDate: '2026-01-07',
      duration: 1,
      dependencies: [fs('pred')],
    });

    const { tasks, moved } = applyTaskUpdate([pred, succ], CAL, 'pred', { startDate: '2026-01-12' });

    const newPred = tasks.find((t) => t.id === 'pred')!;
    const newSucc = tasks.find((t) => t.id === 'succ')!;
    expect(newPred.startDate).toBe('2026-01-12');
    expect(taskEndISO(newPred, CAL)).toBe('2026-01-13'); // Mon 12 + 1 wd = Tue 13
    expect(newSucc.startDate).toBe('2026-01-14'); // next working day after pred finishes
    expect(moved.map((m) => m.id).sort()).toEqual(['pred', 'succ']);
  });

  it('does not pull dependents earlier when a predecessor moves earlier', () => {
    const pred = makeTask('pred', { startDate: '2026-01-12', duration: 2 });
    const succ = makeTask('succ', {
      startDate: '2026-01-14',
      duration: 1,
      dependencies: [fs('pred')],
    });

    const { tasks } = applyTaskUpdate([pred, succ], CAL, 'pred', { startDate: '2026-01-05' });
    expect(tasks.find((t) => t.id === 'pred')!.startDate).toBe('2026-01-05');
    expect(tasks.find((t) => t.id === 'succ')!.startDate).toBe('2026-01-14');
  });

  it('pushes a manual start that violates its predecessor back to feasibility', () => {
    const pred = makeTask('pred', { startDate: '2026-01-05', duration: 5 }); // ends Jan 12
    const succ = makeTask('succ', {
      startDate: '2026-01-12',
      duration: 1,
      dependencies: [fs('pred')],
    });

    const { tasks } = applyTaskUpdate([pred, succ], CAL, 'succ', { startDate: '2026-01-05' });
    expect(tasks.find((t) => t.id === 'succ')!.startDate).toBe('2026-01-13');
  });

  it('respects dependency lag in working days', () => {
    const pred = makeTask('pred', { startDate: '2026-01-05', duration: 2 }); // ends Jan 6
    const succ = makeTask('succ', {
      startDate: '2026-01-05',
      duration: 1,
      dependencies: [fs('pred', 3)],
    });
    const { tasks } = applyTaskUpdate([pred, succ], CAL, 'succ', { startDate: '2026-01-05' });
    // required = end (Jan 6) + 1 + 3 working days = Jan 13 (holiday skipped by working-day math)
    expect(tasks.find((t) => t.id === 'succ')!.startDate).toBe('2026-01-13');
  });

  it('shifts subtasks together with their parent', () => {
    const parent = makeTask('parent', { startDate: '2026-01-05', duration: 5 });
    const child1 = makeTask('child1', {
      startDate: '2026-01-05',
      duration: 2,
      parentId: 'parent',
    });
    const child2 = makeTask('child2', {
      startDate: '2026-01-06',
      duration: 1,
      parentId: 'parent',
    });

    const { tasks } = applyTaskUpdate([parent, child1, child2], CAL, 'parent', {
      startDate: '2026-01-12',
    });
    const byId = new Map(tasks.map((t) => [t.id, t]));
    // Mon Jan 5 -> Mon Jan 12 is a +4 working-day delta (Wed Jan 7 is a holiday).
    expect(byId.get('child1')!.startDate).toBe('2026-01-12');
    expect(byId.get('child2')!.startDate).toBe('2026-01-13');
    // Summary span stays derived from the children.
    const summary = byId.get('parent')!;
    expect(summary.startDate).toBe('2026-01-12');
    expect(taskEndISO(summary, CAL)).toBe('2026-01-13');
  });

  it('propagates through a multi-level chain', () => {
    const a = makeTask('a', { startDate: '2026-01-05', duration: 2 });
    const b = makeTask('b', { startDate: '2026-01-07', duration: 2, dependencies: [fs('a')] });
    const c = makeTask('c', { startDate: '2026-01-09', duration: 2, dependencies: [fs('b')] });

    const { tasks } = applyTaskUpdate([a, b, c], CAL, 'a', { startDate: '2026-01-12' });
    const byId = new Map(tasks.map((t) => [t.id, t]));
    expect(byId.get('a')!.startDate).toBe('2026-01-12'); // ends Jan 13
    expect(byId.get('b')!.startDate).toBe('2026-01-14'); // ends Jan 15
    expect(byId.get('c')!.startDate).toBe('2026-01-16');
  });

  it('enforces start-to-start constraints', () => {
    const pred = makeTask('pred', { startDate: '2026-01-12', duration: 3 });
    const succ = makeTask('succ', {
      startDate: '2026-01-05',
      duration: 1,
      dependencies: [{ predecessorId: 'pred', type: 'SS', lag: 2 }],
    });
    const { tasks } = applyTaskUpdate([pred, succ], CAL, 'succ', { startDate: '2026-01-05' });
    // succ must start at least 2 working days after pred starts: Jan 12 + 2 = Jan 14
    expect(tasks.find((t) => t.id === 'succ')!.startDate).toBe('2026-01-14');
  });
});

describe('summary spans', () => {
  it('covers the earliest child start through the latest child end', () => {
    const parent = makeTask('parent', { startDate: '2026-01-05', duration: 1 });
    const c1 = makeTask('c1', { startDate: '2026-01-05', duration: 2, parentId: 'parent' });
    const c2 = makeTask('c2', { startDate: '2026-01-08', duration: 3, parentId: 'parent' });

    const result = recomputeSummarySpans([parent, c1, c2], CAL);
    const summary = result.find((t) => t.id === 'parent')!;
    expect(summary.startDate).toBe('2026-01-05');
    // c2: Thu Jan 8 + 3 wd -> Fri 9, Mon 12
    expect(taskEndISO(summary, CAL)).toBe('2026-01-12');
  });
});

describe('task insertion and removal', () => {
  it('inserts a task and enforces its constraints', () => {
    const pred = makeTask('pred', { startDate: '2026-01-05', duration: 3 }); // ends Jan 8
    const fresh = makeTask('fresh', {
      startDate: '2026-01-05',
      duration: 1,
      dependencies: [fs('pred')],
    });
    const { tasks, moved } = insertTask([pred], CAL, fresh);
    expect(tasks).toHaveLength(2);
    expect(tasks.find((t) => t.id === 'fresh')!.startDate).toBe('2026-01-09');
    expect(moved.map((m) => m.id)).toEqual(['fresh']);
  });

  it('removes a task with its subtasks and drops dangling links', () => {
    const parent = makeTask('parent');
    const child = makeTask('child', { parentId: 'parent' });
    const other = makeTask('other', { dependencies: [fs('child')] });

    const next = removeTask([parent, child, other], 'parent');
    expect(next.map((t) => t.id)).toEqual(['other']);
    expect(next[0].dependencies).toHaveLength(0);
  });
});
