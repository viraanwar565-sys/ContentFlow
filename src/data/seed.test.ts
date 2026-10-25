import { describe, expect, it } from 'vitest';
import { buildSeedState, validateState } from './seed';
import { calendarOf, isWorkingDay } from '../utils/workingDays';
import { computeCriticalPath } from '../utils/criticalPath';
import { computeDashboardStats, computeResourceWorkloads } from '../utils/stats';
import { taskEndISO } from '../utils/scheduling';
import { validateDependency } from '../utils/dependencies';

const state = buildSeedState();
const flagship = state.projects.find((p) => p.name === 'Campus Cybersecurity Awareness Campaign 2026')!;

describe('seed data integrity', () => {
  it('produces a valid state with no dependency violations', () => {
    expect(validateState(state)).toEqual([]);
  });

  it('contains three realistic projects including the flagship campaign', () => {
    expect(state.projects.length).toBeGreaterThanOrEqual(3);
    expect(flagship).toBeTruthy();
    expect(flagship.status).toBe('In Production');
    expect(flagship.endDate > flagship.startDate).toBe(true);
  });

  it('seeds the flagship with content items, tasks and milestones', () => {
    const items = state.contentItems.filter((i) => i.projectId === flagship.id);
    const tasks = state.tasks.filter((t) => t.projectId === flagship.id);
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(tasks.length).toBeGreaterThanOrEqual(40);

    const titles = items.map((i) => i.title);
    expect(titles).toContain('Phishing Awareness Carousel');
    expect(titles).toContain('3 Signs of Phishing - TikTok Reel');
    expect(titles).toContain('Password Security Tips');
    expect(titles).toContain('Introduction to SOC');
    expect(titles).toContain('Cybersecurity Myth vs Fact');

    const milestoneNames = tasks.filter((t) => t.isMilestone).map((t) => t.name);
    for (const name of [
      'Campaign Brief Approved',
      'First Content Ready',
      'Campaign Launch',
      'Mid-Campaign Review',
      'Campaign Completed',
    ]) {
      expect(milestoneNames).toContain(name);
    }
  });

  it('covers platforms, statuses and dependency types', () => {
    const items = state.contentItems;
    const platforms = new Set(items.map((i) => i.platform));
    expect(platforms.has('Instagram')).toBe(true);
    expect(platforms.has('TikTok')).toBe(true);
    expect(platforms.has('YouTube')).toBe(true);

    const statuses = new Set(items.map((i) => i.status));
    expect(statuses.has('Published')).toBe(true);
    expect(statuses.has('Scheduled')).toBe(true);
    expect(statuses.has('Delayed')).toBe(true);
    expect(statuses.has('In Review')).toBe(true);
    expect(statuses.has('In Progress')).toBe(true);

    const depTypes = new Set(
      state.tasks.flatMap((t) => t.dependencies.map((d) => d.type)),
    );
    expect(depTypes.has('FS')).toBe(true);
    expect(depTypes.has('SS')).toBe(true);
    expect(depTypes.has('FF')).toBe(true);
    expect(depTypes.has('SF')).toBe(true);
  });

  it('schedules every task on a working day of its project', () => {
    for (const project of state.projects) {
      const cal = calendarOf(project.workingDays, project.holidays);
      const tasks = state.tasks.filter((t) => t.projectId === project.id);
      for (const t of tasks) {
        expect(isWorkingDay(t.startDate, cal), `${project.name}/${t.name} start`).toBe(true);
        expect(isWorkingDay(taskEndISO(t, cal), cal), `${project.name}/${t.name} end`).toBe(true);
      }
    }
  });

  it('gives milestones zero duration and leaf-only dependencies', () => {
    for (const t of state.tasks) {
      if (t.isMilestone) expect(t.duration).toBe(0);
      for (const d of t.dependencies) {
        const projectTasks = state.tasks.filter((x) => x.projectId === t.projectId);
        expect(validateDependency(projectTasks, d.predecessorId, t.id, { existing: true })).toBeNull();
      }
    }
  });

  it('uses at least 4 production roles and assigns them', () => {
    expect(state.resources.length).toBeGreaterThanOrEqual(7);
    const assigned = new Set(
      state.tasks.map((t) => t.assigneeId).filter((id): id is string => Boolean(id)),
    );
    expect(assigned.size).toBeGreaterThanOrEqual(5);
  });

  it('keeps content-item dates aligned with their production tasks', () => {
    for (const item of state.contentItems) {
      const tasks = state.tasks.filter((t) => t.contentItemId === item.id);
      if (tasks.length === 0) continue;
      const starts = tasks.map((t) => t.startDate).sort();
      expect(item.startDate).toBe(starts[0]);
      expect(item.endDate >= item.startDate).toBe(true);
    }
  });
});

describe('seed statistics', () => {
  const today = new Date().toISOString().slice(0, 10);
  const stats = computeDashboardStats(state, today);

  it('computes dashboard counters', () => {
    expect(stats.totalProjects).toBeGreaterThanOrEqual(3);
    expect(stats.activeProjects).toBeGreaterThanOrEqual(1);
    expect(stats.totalContentItems).toBe(state.contentItems.length);
    expect(stats.inProduction).toBeGreaterThanOrEqual(1);
    expect(stats.inReview).toBeGreaterThanOrEqual(1);
    expect(stats.scheduled).toBeGreaterThanOrEqual(1);
    expect(stats.published).toBeGreaterThanOrEqual(1);
    expect(stats.delayed).toBeGreaterThanOrEqual(1);
    expect(stats.overallProgress).toBeGreaterThanOrEqual(0);
    expect(stats.overallProgress).toBeLessThanOrEqual(100);
  });

  it('lists upcoming deadlines sorted by date', () => {
    const dates = stats.upcoming.map((u) => u.dueDate);
    expect(dates).toEqual([...dates].sort());
  });

  it('computes resource workload for every resource', () => {
    const workloads = computeResourceWorkloads(state);
    expect(workloads.length).toBe(state.resources.length);
    for (const w of workloads) {
      expect(w.workloadDays).toBeGreaterThanOrEqual(0);
      expect(w.completionPct).toBeGreaterThanOrEqual(0);
      expect(w.completionPct).toBeLessThanOrEqual(100);
    }
    expect(workloads.some((w) => w.assignedTasks.length > 0)).toBe(true);
  });
});

describe('critical path over seed data', () => {
  it('finds a critical chain in the flagship project', () => {
    const cal = calendarOf(flagship.workingDays, flagship.holidays);
    const tasks = state.tasks.filter((t) => t.projectId === flagship.id);
    const cpm = computeCriticalPath(tasks, cal);

    expect(cpm.durationWorkingDays).toBeGreaterThan(0);
    expect(cpm.criticalIds.length).toBeGreaterThan(0);
    expect(cpm.orderedPath.length).toBeGreaterThan(1);
    expect(cpm.projectEnd >= cpm.projectStart).toBe(true);

    // Critical tasks must have zero (or negative) float.
    for (const id of cpm.criticalIds) {
      expect(cpm.floats[id]).toBeLessThanOrEqual(0);
    }
    // Every non-critical task has positive float.
    for (const [id, float] of Object.entries(cpm.floats)) {
      if (!cpm.criticalIds.includes(id)) expect(float).toBeGreaterThan(0);
    }
  });
});
