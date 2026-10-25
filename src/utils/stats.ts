/** Aggregated statistics for the dashboard, calendar and resource views. */

import type { AppState, ContentItem, ID, Project, Resource, Task, WorkflowStatus } from '../types';
import {
  calendarFor,
  contentItemProgress,
  findProject,
  findResource,
  itemTasks,
  projectProgress,
  projectTasks,
} from './selectors';
import { taskEndISO } from './scheduling';
import { diffDays, addDays } from './dates';

export const IN_PRODUCTION_STATUSES: WorkflowStatus[] = ['In Progress', 'Revision'];

export interface UpcomingDeadline {
  item: ContentItem;
  project?: Project;
  dueDate: string;
  daysLeft: number;
  overdue: boolean;
}

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalContentItems: number;
  inProduction: number;
  inReview: number;
  scheduled: number;
  published: number;
  delayed: number;
  overallProgress: number;
  upcoming: UpcomingDeadline[];
}

export function isOverdue(item: ContentItem, today: string): boolean {
  return item.endDate < today && item.status !== 'Published';
}

export function isDelayed(item: ContentItem, today: string): boolean {
  return item.status === 'Delayed' || isOverdue(item, today);
}

export function computeDashboardStats(state: AppState, today: string): DashboardStats {
  const items = state.contentItems;
  const activeProjects = state.projects.filter(
    (p) => p.status !== 'Completed' && p.status !== 'On Hold',
  ).length;

  let inProduction = 0;
  let inReview = 0;
  let scheduled = 0;
  let published = 0;
  let delayed = 0;

  for (const item of items) {
    if (IN_PRODUCTION_STATUSES.includes(item.status)) inProduction++;
    if (item.status === 'In Review') inReview++;
    if (item.status === 'Scheduled') scheduled++;
    if (item.status === 'Published') published++;
    if (isDelayed(item, today)) delayed++;
  }

  const upcoming = items
    .filter((item) => item.status !== 'Published' && item.endDate <= addDays(today, 14))
    .map<UpcomingDeadline>((item) => ({
      item,
      project: findProject(state, item.projectId),
      dueDate: item.endDate,
      daysLeft: diffDays(today, item.endDate),
      overdue: item.endDate < today,
    }))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))
    .slice(0, 10);

  let overallProgress = 0;
  if (items.length > 0) {
    const values = items.map((item) => contentItemProgress(itemTasks(state, item.id)));
    overallProgress = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  } else if (state.projects.length > 0) {
    const values = state.projects.map((p) => projectProgress(state, p.id));
    overallProgress = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  return {
    totalProjects: state.projects.length,
    activeProjects,
    totalContentItems: items.length,
    inProduction,
    inReview,
    scheduled,
    published,
    delayed,
    overallProgress,
    upcoming,
  };
}

export interface ResourceWorkload {
  resource: Resource;
  assignedTasks: Task[];
  openTasks: Task[];
  workloadDays: number;
  completionPct: number;
  projectNames: string[];
}

export function computeResourceWorkloads(state: AppState): ResourceWorkload[] {
  return state.resources
    .map((resource) => {
      const assigned = state.tasks.filter((t) => t.assigneeId === resource.id);
      const open = assigned.filter((t) => t.status !== 'Published' && t.progress < 100);
      const workloadDays = open.reduce(
        (sum, t) => sum + (t.isMilestone ? 0 : Math.max(1, t.duration)),
        0,
      );
      let completionPct = 0;
      if (assigned.length > 0) {
        const total = assigned.reduce((sum, t) => sum + Math.max(1, t.duration), 0);
        const done = assigned.reduce(
          (sum, t) => sum + Math.max(1, t.duration) * Math.max(0, Math.min(100, t.progress)),
          0,
        );
        completionPct = total === 0 ? 0 : Math.round(done / total);
      }
      const projectNames = Array.from(new Set(assigned.map((t) => t.projectId)))
        .map((id) => findProject(state, id)?.name)
        .filter((n): n is string => Boolean(n));
      return { resource, assignedTasks: assigned, openTasks: open, workloadDays, completionPct, projectNames };
    })
    .sort((a, b) => b.workloadDays - a.workloadDays);
}

export interface ContentCalendarEntry {
  date: string;
  item: ContentItem;
  project?: Project;
}

/** Content items grouped by their planned publication date. */
export function publicationEntries(state: AppState): Map<string, ContentCalendarEntry[]> {
  const map = new Map<string, ContentCalendarEntry[]>();
  for (const item of state.contentItems) {
    const list = map.get(item.endDate);
    const entry: ContentCalendarEntry = {
      date: item.endDate,
      item,
      project: findProject(state, item.projectId),
    };
    if (list) list.push(entry);
    else map.set(item.endDate, [entry]);
  }
  return map;
}

/** Tasks (with dates) that are due on a given day, for the project calendar. */
export function tasksEndingOn(tasks: Task[], date: string, project: Project): Task[] {
  const cal = calendarFor(project);
  return tasks.filter((t) => taskEndISO(t, cal) === date);
}

export interface ProjectSummary {
  project: Project;
  progress: number;
  taskCount: number;
  itemCount: number;
  doneTasks: number;
}

export function projectSummaries(state: AppState): ProjectSummary[] {
  return state.projects.map((project) => {
    const tasks = projectTasks(state, project.id);
    const done = tasks.filter((t) => t.progress >= 100).length;
    return {
      project,
      progress: projectProgress(state, project.id),
      taskCount: tasks.length,
      itemCount: projectContentItemCount(state, project.id),
      doneTasks: done,
    };
  });
}

function projectContentItemCount(state: AppState, projectId: ID): number {
  return state.contentItems.filter((i) => i.projectId === projectId).length;
}

/** Resource workload for a single project. */
export function projectResourceWorkloads(state: AppState, projectId: ID): ResourceWorkload[] {
  const projectIds = new Set(state.tasks.filter((t) => t.projectId === projectId).map((t) => t.assigneeId));
  return computeResourceWorkloads(state)
    .filter((w) => projectIds.has(w.resource.id))
    .map((w) => {
      const assigned = w.assignedTasks.filter((t) => t.projectId === projectId);
      const open = w.openTasks.filter((t) => t.projectId === projectId);
      const workloadDays = open.reduce(
        (sum, t) => sum + (t.isMilestone ? 0 : Math.max(1, t.duration)),
        0,
      );
      return { ...w, assignedTasks: assigned, openTasks: open, workloadDays };
    });
}
