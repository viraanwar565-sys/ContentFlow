/** Read-model selectors shared by views and stats. */

import type {
  AppState,
  ContentItem,
  ID,
  Project,
  Resource,
  Task,
  WorkingCalendar,
} from '../types';
import { calendarOf, spanEndDate, normalizeWorkingDay } from './workingDays';
import { childrenOf, hasChildren } from './dependencies';
import { taskEndISO } from './scheduling';

export function calendarFor(project: Project | undefined): WorkingCalendar {
  if (!project) return calendarOf(undefined, undefined);
  return calendarOf(project.workingDays, project.holidays);
}

export function findProject(state: AppState, id: ID | null | undefined): Project | undefined {
  if (!id) return undefined;
  return state.projects.find((p) => p.id === id);
}

export function projectTasks(state: AppState, projectId: ID): Task[] {
  return state.tasks.filter((t) => t.projectId === projectId);
}

export function projectContentItems(state: AppState, projectId: ID): ContentItem[] {
  return state.contentItems.filter((i) => i.projectId === projectId);
}

export function itemTasks(state: AppState, itemId: ID): Task[] {
  return state.tasks.filter((t) => t.contentItemId === itemId);
}

export function findResource(state: AppState, id: ID | null | undefined): Resource | undefined {
  if (!id) return undefined;
  return state.resources.find((r) => r.id === id);
}

export function findTask(state: AppState, id: ID): Task | undefined {
  return state.tasks.find((t) => t.id === id);
}

export function taskEnd(task: Task, cal: WorkingCalendar): string {
  return taskEndISO(task, cal);
}

export function taskRange(task: Task, cal: WorkingCalendar): { start: string; end: string } {
  const start = normalizeWorkingDay(task.startDate, cal);
  return { start, end: taskEndISO(task, cal) };
}

/** Duration-weighted progress of a set of tasks (leaf tasks only). */
export function weightedProgress(tasks: Task[]): number {
  const pool = tasks;
  if (pool.length === 0) return 0;
  let totalWeight = 0;
  let sum = 0;
  for (const t of pool) {
    const weight = t.isMilestone ? 1 : Math.max(1, t.duration);
    totalWeight += weight;
    sum += weight * clampProgress(t.progress);
  }
  return totalWeight === 0 ? 0 : Math.round(sum / totalWeight);
}

function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/** Progress of a content item derived from its production tasks. */
export function contentItemProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  return weightedProgress(tasks);
}

/** Progress of a project: weighted across its leaf tasks (no double counting of summaries). */
export function projectProgress(state: AppState, projectId: ID): number {
  const tasks = projectTasks(state, projectId);
  const leaves = tasks.filter((t) => !hasChildren(tasks, t.id));
  if (leaves.length === 0) return 0;
  return weightedProgress(leaves);
}

export function summaryTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.parentId === null);
}

export function taskTree(tasks: Task[]): Task[] {
  return childrenOf(tasks, null);
}

export function contentItemEnd(state: AppState, item: ContentItem, cal: WorkingCalendar): string {
  const tasks = itemTasks(state, item.id);
  if (tasks.length === 0) return item.endDate;
  const ends = tasks.map((t) => taskEndISO(t, cal)).filter(Boolean);
  if (ends.length === 0) return item.endDate;
  return ends.reduce((a, b) => (a > b ? a : b));
}

export function taskDurationLabel(task: Task): string {
  if (task.isMilestone || task.duration === 0) return 'Milestone';
  return task.duration === 1 ? '1 day' : `${task.duration} days`;
}

/** End date for a duration-less helper used when seeding/creating items. */
export function deriveEnd(start: string, duration: number, cal: WorkingCalendar): string {
  return spanEndDate(start, duration, cal);
}
