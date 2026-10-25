/**
 * Critical Path Method (CPM) over working-day ordinals.
 *
 * - Forward pass  -> earliest start (ES) / earliest finish (EF)
 * - Backward pass -> latest start (LS) / latest finish (LF)
 * - Total float   -> LS - ES (in working days); tasks with float <= 0 are critical
 *
 * Summary (parent) tasks are containers: their ES/EF derive from their subtasks
 * and their float is the minimum float of their subtasks. Dependencies are only
 * allowed between leaf tasks (enforced by validateDependency).
 */

import type { ID, Task, WorkingCalendar } from '../types';
import { dateFromWorkOrdinal, normalizeWorkingDay, workOrdinal } from './workingDays';
import { backwardConstraint, forwardConstraint, spanOf } from './scheduling';
import { buildChildMap, topologicalOrder } from './dependencies';
import { diffDays } from './dates';

export interface CriticalPathResult {
  /** Total float in working days per task. */
  floats: Record<ID, number>;
  earliestStart: Record<ID, number>;
  earliestEnd: Record<ID, number>;
  latestStart: Record<ID, number>;
  latestEnd: Record<ID, number>;
  criticalIds: ID[];
  /** Critical tasks ordered from first to last (when a chain exists). */
  orderedPath: ID[];
  projectStartOrd: number;
  projectEndOrd: number;
  projectStart: string;
  projectEnd: string;
  durationWorkingDays: number;
}

function emptyResult(): CriticalPathResult {
  return {
    floats: {},
    earliestStart: {},
    earliestEnd: {},
    latestStart: {},
    latestEnd: {},
    criticalIds: [],
    orderedPath: [],
    projectStartOrd: 0,
    projectEndOrd: 0,
    projectStart: '',
    projectEnd: '',
    durationWorkingDays: 0,
  };
}

export function computeCriticalPath(tasks: Task[], cal: WorkingCalendar): CriticalPathResult {
  if (tasks.length === 0) return emptyResult();

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const childMap = buildChildMap(tasks);
  const order = topologicalOrder(tasks);

  const ES: Record<ID, number> = {};
  const EF: Record<ID, number> = {};

  // ---- Forward pass -------------------------------------------------------
  for (const id of order) {
    const task = byId.get(id);
    if (!task) continue;
    const kids = childMap.get(id);
    if (kids && kids.length > 0) {
      let minStart = Number.POSITIVE_INFINITY;
      let maxEnd = Number.NEGATIVE_INFINITY;
      for (const kid of kids) {
        if (ES[kid.id] === undefined || EF[kid.id] === undefined) continue;
        minStart = Math.min(minStart, ES[kid.id]);
        maxEnd = Math.max(maxEnd, EF[kid.id]);
      }
      if (minStart === Number.POSITIVE_INFINITY) {
        const s = workOrdinal(normalizeWorkingDay(task.startDate, cal), cal);
        ES[id] = s;
        EF[id] = s + spanOf(task.duration);
      } else {
        ES[id] = minStart;
        EF[id] = maxEnd;
      }
      continue;
    }

    let start: number;
    if (task.dependencies.length === 0) {
      start = workOrdinal(normalizeWorkingDay(task.startDate, cal), cal);
    } else {
      let required = Number.NEGATIVE_INFINITY;
      for (const dep of task.dependencies) {
        const pred = byId.get(dep.predecessorId);
        if (!pred || ES[dep.predecessorId] === undefined) continue;
        const value = forwardConstraint(
          ES[dep.predecessorId],
          EF[dep.predecessorId],
          dep,
          spanOf(task.duration),
        );
        required = Math.max(required, value);
      }
      start =
        required === Number.NEGATIVE_INFINITY
          ? workOrdinal(normalizeWorkingDay(task.startDate, cal), cal)
          : required;
    }
    ES[id] = start;
    EF[id] = start + spanOf(task.duration);
  }

  // ---- Project extent -----------------------------------------------------
  let projectStartOrd = Number.POSITIVE_INFINITY;
  let projectEndOrd = Number.NEGATIVE_INFINITY;
  for (const id of Object.keys(ES)) {
    projectStartOrd = Math.min(projectStartOrd, ES[id]);
    projectEndOrd = Math.max(projectEndOrd, EF[id]);
  }
  if (projectStartOrd === Number.POSITIVE_INFINITY) return emptyResult();

  // ---- Backward pass (leaf tasks) ----------------------------------------
  const successors = new Map<ID, { task: Task; dep: Task['dependencies'][number] }[]>();
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      const list = successors.get(dep.predecessorId);
      const entry = { task: t, dep };
      if (list) list.push(entry);
      else successors.set(dep.predecessorId, [entry]);
    }
  }

  const LS: Record<ID, number> = {};
  const LF: Record<ID, number> = {};
  const floats: Record<ID, number> = {};

  for (const id of [...order].reverse()) {
    const task = byId.get(id);
    if (!task) continue;
    const kids = childMap.get(id);
    if (kids && kids.length > 0) continue; // summaries handled below

    const succs = successors.get(id);
    if (!succs || succs.length === 0) {
      LF[id] = projectEndOrd;
    } else {
      let bound = Number.POSITIVE_INFINITY;
      for (const { task: succ, dep } of succs) {
        if (LS[succ.id] === undefined || LF[succ.id] === undefined) continue;
        bound = Math.min(bound, backwardConstraint(LS[succ.id], LF[succ.id], dep, spanOf(task.duration)));
      }
      LF[id] = bound === Number.POSITIVE_INFINITY ? projectEndOrd : bound;
    }
    LS[id] = LF[id] - spanOf(task.duration);
    floats[id] = LS[id] - ES[id];
  }

  // ---- Summary floats (minimum of subtasks) -------------------------------
  for (const id of order) {
    const kids = childMap.get(id);
    if (!kids || kids.length === 0) continue;
    const values = kids.map((k) => floats[k.id]).filter((v) => typeof v === 'number');
    if (values.length === 0) {
      floats[id] = 0;
    } else {
      floats[id] = Math.min(...values);
    }
    LS[id] = ES[id] + floats[id];
    LF[id] = EF[id] + floats[id];
  }

  for (const id of Object.keys(ES)) {
    if (floats[id] === undefined) floats[id] = 0;
  }

  const criticalIds = Object.keys(floats).filter((id) => floats[id] <= 0);

  // ---- Walk the critical chain (backwards from the critical end) ---------
  const criticalSet = new Set(criticalIds);
  const orderedPath: ID[] = [];
  let cursor: ID | null = null;
  let bestEnd = Number.NEGATIVE_INFINITY;
  for (const id of criticalIds) {
    const task = byId.get(id);
    if (!task) continue;
    if (EF[id] > bestEnd) {
      bestEnd = EF[id];
      cursor = id;
    }
  }
  while (cursor) {
    orderedPath.push(cursor);
    const task = byId.get(cursor);
    if (!task) break;
    let next: ID | null = null;
    let bestValue = Number.NEGATIVE_INFINITY;
    for (const dep of task.dependencies) {
      if (!criticalSet.has(dep.predecessorId)) continue;
      const pred = byId.get(dep.predecessorId);
      if (!pred || ES[dep.predecessorId] === undefined) continue;
      const value = forwardConstraint(
        ES[dep.predecessorId],
        EF[dep.predecessorId],
        dep,
        spanOf(task.duration),
      );
      if (value > bestValue) {
        bestValue = value;
        next = dep.predecessorId;
      }
    }
    if (!next || orderedPath.includes(next)) break;
    cursor = next;
  }
  orderedPath.reverse();

  return {
    floats,
    earliestStart: ES,
    earliestEnd: EF,
    latestStart: LS,
    latestEnd: LF,
    criticalIds,
    orderedPath,
    projectStartOrd,
    projectEndOrd,
    projectStart: dateFromWorkOrdinal(projectStartOrd, cal),
    projectEnd: dateFromWorkOrdinal(projectEndOrd, cal),
    durationWorkingDays: projectEndOrd - projectStartOrd + 1,
  };
}

/** Convenience: calendar-day span of the computed project window. */
export function projectCalendarDays(start: string, end: string): number {
  if (!start || !end) return 0;
  return Math.max(1, diffDays(start, end) + 1);
}
