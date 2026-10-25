/**
 * Scheduling engine.
 *
 * Responsibilities:
 *  - derive end dates from start + duration (working days)
 *  - shift a task together with its subtasks
 *  - keep summary (parent) bars spanning their subtasks
 *  - enforce dependency constraints after a change and report the tasks that
 *    had to move ("scheduling impact")
 *
 * All date math happens on working-day ordinals (see workingDays.ts).
 */

import type { ID, Task, WorkingCalendar, Dependency } from '../types';
import {
  dateFromWorkOrdinal,
  normalizeWorkingDay,
  spanEndDate,
  workOrdinal,
  workingDaysInclusive,
} from './workingDays';
import {
  buildChildMap,
  collectAffected,
  descendantsOf,
  hasChildren,
  topologicalOrder,
} from './dependencies';
import { maxOf, minOf } from './dates';

export interface MovedTask {
  id: ID;
  name: string;
  from: string;
  to: string;
}

export interface ScheduleResult {
  tasks: Task[];
  moved: MovedTask[];
}

export function spanOf(duration: number): number {
  return Math.max(0, duration - 1);
}

/** End date of a task derived from its start date and duration. */
export function taskEndISO(task: Task, cal: WorkingCalendar): string {
  if (task.isMilestone || task.duration <= 0) return normalizeWorkingDay(task.startDate, cal);
  return spanEndDate(task.startDate, task.duration, cal);
}

/**
 * Value of the lower bound a predecessor places on a successor's start ordinal.
 * `succSpan` = max(duration - 1, 0) of the successor.
 */
export function forwardConstraint(
  predStartOrd: number,
  predEndOrd: number,
  dep: Dependency,
  succSpan: number,
): number {
  switch (dep.type) {
    case 'FS':
      return predEndOrd + 1 + dep.lag;
    case 'SS':
      return predStartOrd + dep.lag;
    case 'FF':
      return predEndOrd + dep.lag - succSpan;
    case 'SF':
      return predStartOrd + dep.lag - succSpan;
  }
}

/**
 * Upper bound a successor places on a predecessor's end ordinal (LF).
 * `predSpan` = max(duration - 1, 0) of the predecessor.
 */
export function backwardConstraint(
  succStartOrd: number,
  succEndOrd: number,
  dep: Dependency,
  predSpan: number,
): number {
  switch (dep.type) {
    case 'FS':
      return succStartOrd - 1 - dep.lag;
    case 'SS':
      return succStartOrd - dep.lag + predSpan;
    case 'FF':
      return succEndOrd - dep.lag;
    case 'SF':
      return succEndOrd - dep.lag + predSpan;
  }
}

/** Earliest start ordinal a task may take given its predecessors (or null without any). */
export function requiredStartOrdinal(
  task: Task,
  byId: Map<ID, Task>,
  cal: WorkingCalendar,
): number | null {
  let required: number | null = null;
  const succSpan = spanOf(task.duration);
  for (const dep of task.dependencies) {
    const pred = byId.get(dep.predecessorId);
    if (!pred) continue;
    const ps = workOrdinal(normalizeWorkingDay(pred.startDate, cal), cal);
    const pe = ps + spanOf(pred.duration);
    const value = forwardConstraint(ps, pe, dep, succSpan);
    if (required === null || value > required) required = value;
  }
  return required;
}

function diffMoved(before: Map<ID, string>, tasks: Task[]): MovedTask[] {
  const moved: MovedTask[] = [];
  for (const t of tasks) {
    const prev = before.get(t.id);
    if (prev !== undefined && prev !== t.startDate) {
      moved.push({ id: t.id, name: t.name, from: prev, to: t.startDate });
    }
  }
  return moved;
}

function snapshot(tasks: Task[]): Map<ID, string> {
  return new Map(tasks.map((t) => [t.id, t.startDate] as const));
}

/** Shifts the task and every subtask by `delta` working-day ordinals. */
export function shiftSubtree(
  tasks: Task[],
  id: ID,
  delta: number,
  cal: WorkingCalendar,
): Task[] {
  if (delta === 0) return tasks;
  const ids = new Set<ID>([id, ...descendantsOf(tasks, id)]);
  return tasks.map((t) => {
    if (!ids.has(t.id)) return t;
    const ord = workOrdinal(normalizeWorkingDay(t.startDate, cal), cal);
    return { ...t, startDate: dateFromWorkOrdinal(ord + delta, cal) };
  });
}

/** Keeps summary bars covering their subtasks (start = earliest child, span = through latest child end). */
export function recomputeSummarySpans(tasks: Task[], cal: WorkingCalendar): Task[] {
  const childMap = buildChildMap(tasks);
  if (childMap.size === 0) return tasks;
  return tasks.map((t) => {
    const kids = childMap.get(t.id);
    if (!kids || kids.length === 0) return t;
    const start = normalizeWorkingDay(minOf(kids.map((k) => k.startDate)), cal);
    const end = maxOf(kids.map((k) => taskEndISO(k, cal)));
    const duration = Math.max(1, workingDaysInclusive(start, end, cal));
    if (t.startDate === start && t.duration === duration) return t;
    return { ...t, startDate: start, duration };
  });
}

/**
 * Pushes every task in the affected set that violates a dependency constraint
 * to the earliest feasible date (moving its subtasks along with it).
 * Tasks are processed in topological order so predecessors are settled first.
 */
export function enforceConstraints(
  tasks: Task[],
  cal: WorkingCalendar,
  seedIds: ID[],
): Task[] {
  if (seedIds.length === 0) return tasks;
  const affected = collectAffected(tasks, seedIds);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const order = topologicalOrder(tasks).filter((id) => affected.has(id));
  let list = tasks;
  for (const id of order) {
    const task = byId.get(id);
    if (!task) continue;
    // Summary dates are derived from subtasks; subtasks themselves are checked below.
    if (hasChildren(list, id)) continue;
    const working = new Map(list.map((t) => [t.id, t] as const));
    const current = working.get(id);
    if (!current) continue;
    const required = requiredStartOrdinal(current, working, cal);
    if (required === null) continue;
    const currentOrd = workOrdinal(normalizeWorkingDay(current.startDate, cal), cal);
    if (currentOrd < required) {
      list = shiftSubtree(list, id, required - currentOrd, cal);
    }
  }
  return list;
}

/**
 * Applies a patch to a task, then repairs the schedule:
 *  1. a start-date change shifts the subtask subtree by the same delta
 *  2. summary bars are re-spanned
 *  3. dependency constraints are re-enforced for the task and its dependents
 *
 * Returns the new task list plus every task whose date actually moved.
 */
export function applyTaskUpdate(
  tasks: Task[],
  cal: WorkingCalendar,
  taskId: ID,
  patch: Partial<Task>,
): ScheduleResult {
  const original = tasks.find((t) => t.id === taskId);
  if (!original) return { tasks, moved: [] };
  const before = snapshot(tasks);

  let list = tasks;
  const rest: Partial<Task> = { ...patch };
  delete rest.id;
  delete rest.projectId;
  delete rest.startDate;

  let startChanged = false;
  if (patch.startDate !== undefined) {
    const target = normalizeWorkingDay(patch.startDate, cal);
    const from = normalizeWorkingDay(original.startDate, cal);
    if (target !== from) {
      const delta = workOrdinal(target, cal) - workOrdinal(from, cal);
      list = shiftSubtree(tasks, taskId, delta, cal);
      startChanged = true;
    }
  }
  if (Object.keys(rest).length > 0) {
    list = list.map((t) => (t.id === taskId ? { ...t, ...rest, id: t.id } : t));
  }
  if (startChanged && patch.startDate !== undefined) {
    const target = normalizeWorkingDay(patch.startDate, cal);
    list = list.map((t) => (t.id === taskId ? { ...t, startDate: target } : t));
  }

  list = recomputeSummarySpans(list, cal);
  const seeds: ID[] = [taskId, ...descendantsOf(list, taskId)];
  list = enforceConstraints(list, cal, seeds);
  list = recomputeSummarySpans(list, cal);
  return { tasks: list, moved: diffMoved(before, list) };
}

/** Creates a task and enforces constraints for it (returns the full list). */
export function insertTask(
  tasks: Task[],
  cal: WorkingCalendar,
  task: Task,
): ScheduleResult {
  const before = snapshot(tasks);
  let list = [...tasks, task];
  list = recomputeSummarySpans(list, cal);
  list = enforceConstraints(list, cal, [task.id]);
  list = recomputeSummarySpans(list, cal);
  return { tasks: list, moved: diffMoved(before, list) };
}

/** Removes a task and its subtasks, dropping dangling dependency links. */
export function removeTask(tasks: Task[], taskId: ID): Task[] {
  const doomed = new Set<ID>([taskId, ...descendantsOf(tasks, taskId)]);
  return tasks
    .filter((t) => !doomed.has(t.id))
    .map((t) =>
      t.dependencies.some((d) => doomed.has(d.predecessorId))
        ? { ...t, dependencies: t.dependencies.filter((d) => !doomed.has(d.predecessorId)) }
        : t,
    );
}
