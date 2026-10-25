/**
 * Application store: a React context holding the whole AppState, persistence
 * to localStorage, and all mutation actions. Scheduling side effects
 * (constraint propagation, moved-task reporting, derived item dates) are
 * applied here so views stay declarative.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppState,
  ContentItem,
  ContentType,
  Dependency,
  DependencyType,
  Holiday,
  ID,
  Platform,
  Priority,
  Project,
  ProjectStatus,
  Resource,
  ResourceRole,
  Task,
  WorkflowStatus,
} from '../types';
import { buildSeedState } from '../data/seed';
import { addDays, minOf, maxOf, todayISO } from '../utils/dates';
import {
  addWorkingDays,
  calendarOf,
  normalizeWorkingDay,
} from '../utils/workingDays';
import {
  applyTaskUpdate,
  enforceConstraints,
  insertTask,
  recomputeSummarySpans,
  removeTask,
  taskEndISO,
  type MovedTask,
} from '../utils/scheduling';
import { descendantsOf, validateDependency } from '../utils/dependencies';
import { uid } from '../utils/id';
import { findProject } from '../utils/selectors';
import { RESOURCE_COLORS } from '../constants';

const STORAGE_KEY = 'contentflow.state.v1';

export interface Notification {
  id: string;
  message: string;
  kind: 'info' | 'success' | 'warning';
}

export interface ProjectInput {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: ProjectStatus;
  workingDays?: number[];
  holidays?: Holiday[];
  color?: string;
}

export interface ContentItemInput {
  projectId: ID;
  title: string;
  brief?: string;
  contentType?: ContentType;
  platform?: Platform;
  status?: WorkflowStatus;
  priority?: Priority;
  startDate?: string;
  endDate?: string;
  assigneeId?: ID | null;
}

export interface TaskInput {
  projectId: ID;
  name: string;
  parentId?: ID | null;
  contentItemId?: ID | null;
  startDate?: string;
  duration?: number;
  status?: WorkflowStatus;
  priority?: Priority;
  progress?: number;
  assigneeId?: ID | null;
  isMilestone?: boolean;
}

export interface SaveTaskInput extends TaskInput {
  /** Final desired dependency set for the task (validated as a whole). */
  dependencies?: Dependency[];
}

export interface SaveTaskResult {
  id: ID;
  error: string | null;
}

export interface StoreValue {
  state: AppState;
  today: string;
  notifications: Notification[];
  notify: (message: string, kind?: Notification['kind']) => void;
  dismissNotification: (id: string) => void;
  resetDemoData: () => void;
  selectedProjectId: ID | null;
  setSelectedProjectId: (id: ID | null) => void;

  createProject: (input: ProjectInput) => ID;
  updateProject: (id: ID, patch: Partial<Project>) => void;
  deleteProject: (id: ID) => void;

  createContentItem: (input: ContentItemInput) => ID;
  updateContentItem: (id: ID, patch: Partial<ContentItem>) => void;
  deleteContentItem: (id: ID) => void;

  createTask: (input: TaskInput) => ID;
  /** Atomic create-or-update: fields + dependencies applied and validated in one pass. */
  saveTask: (taskId: ID | null, input: SaveTaskInput) => SaveTaskResult;
  updateTask: (id: ID, patch: Partial<Task>) => void;
  deleteTask: (id: ID) => void;
  addDependency: (
    taskId: ID,
    predecessorId: ID,
    type: DependencyType,
    lag: number,
  ) => string | null;
  removeDependency: (taskId: ID, predecessorId: ID, type: DependencyType) => void;

  addResource: (name: string, role: ResourceRole) => ID;
  updateResource: (id: ID, patch: Partial<Resource>) => void;
  removeResource: (id: ID) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function isValidState(value: unknown): value is AppState {
  const s = value as AppState | null;
  return Boolean(
    s &&
      s.version === 1 &&
      Array.isArray(s.projects) &&
      Array.isArray(s.tasks) &&
      Array.isArray(s.contentItems) &&
      Array.isArray(s.resources),
  );
}

/** Keeps stored content-item dates aligned with their production tasks. */
function syncContentItemDates(
  items: ContentItem[],
  tasks: Task[],
  projects: Project[],
): ContentItem[] {
  return items.map((item) => {
    const own = tasks.filter((t) => t.contentItemId === item.id);
    if (own.length === 0) return item;
    const project = projects.find((p) => p.id === item.projectId);
    const cal = calendarOf(project?.workingDays, project?.holidays);
    const start = minOf(own.map((t) => t.startDate));
    const end = maxOf(own.map((t) => taskEndISO(t, cal)));
    if (!start || !end || (item.startDate === start && item.endDate === end)) return item;
    return { ...item, startDate: start, endDate: end };
  });
}

function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidState(parsed)) {
        return {
          ...parsed,
          contentItems: syncContentItemDates(parsed.contentItems, parsed.tasks, parsed.projects),
        };
      }
    }
  } catch {
    // Fall through to demo data.
  }
  return buildSeedState();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<ID | null>(
    () => state.projects[0]?.id ?? null,
  );
  const today = todayISO();

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage may be unavailable (private mode); the app keeps working in memory.
    }
  }, [state]);

  const notify = useCallback((message: string, kind: Notification['kind'] = 'info') => {
    const id = uid('note');
    setNotifications((prev) => [...prev.slice(-3), { id, message, kind }]);
    window.setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 7000);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const reportMoved = useCallback(
    (moved: MovedTask[], prefix = 'Scheduling impact') => {
      if (moved.length === 0) return;
      const names = moved.slice(0, 3).map((m) => m.name);
      const more = moved.length > 3 ? ` and ${moved.length - 3} more` : '';
      notify(
        `${prefix}: ${moved.length} task${moved.length === 1 ? '' : 's'} rescheduled to respect dependencies (${names.join(', ')}${more}).`,
        'warning',
      );
    },
    [notify],
  );

  const calendarForId = useCallback(
    (projectId: ID) => {
      const project = findProject(state, projectId);
      return calendarOf(project?.workingDays, project?.holidays);
    },
    [state],
  );

  const commitTasks = useCallback(
    (tasks: Task[], moved: MovedTask[], prefix?: string) => {
      setState((prev) => ({
        ...prev,
        tasks,
        contentItems: syncContentItemDates(prev.contentItems, tasks, prev.projects),
      }));
      reportMoved(moved, prefix);
    },
    [reportMoved],
  );

  // ---------------------------------------------------------------- projects

  const createProject = useCallback(
    (input: ProjectInput): ID => {
      const cal = calendarOf(undefined, undefined);
      const start = normalizeWorkingDay(input.startDate ?? today, cal);
      const end = input.endDate ?? addWorkingDays(start, 30, cal);
      const id = uid('proj');
      const color =
        input.color ??
        RESOURCE_COLORS[state.projects.length % RESOURCE_COLORS.length];
      const project: Project = {
        id,
        name: input.name.trim() || 'Untitled project',
        description: input.description ?? '',
        status: input.status ?? 'Planning',
        color,
        startDate: start,
        endDate: end,
        workingDays: input.workingDays ?? [1, 2, 3, 4, 5],
        holidays: input.holidays ?? [],
      };
      setState((prev) => ({ ...prev, projects: [...prev.projects, project] }));
      setSelectedProjectId(id);
      notify(`Project "${project.name}" created.`, 'success');
      return id;
    },
    [notify, state.projects.length, today],
  );

  const updateProject = useCallback(
    (id: ID, patch: Partial<Project>) => {
      setState((prev) => {
        const projects = prev.projects.map((p) => (p.id === id ? { ...p, ...patch, id } : p));
        // A calendar change re-normalizes every date in the project.
        if (patch.workingDays || patch.holidays) {
          const project = projects.find((p) => p.id === id);
          if (project) {
            const cal = calendarOf(project.workingDays, project.holidays);
            let tasks = prev.tasks.map((t) =>
              t.projectId === id
                ? {
                    ...t,
                    startDate: normalizeWorkingDay(t.startDate, cal),
                    duration: t.isMilestone ? 0 : Math.max(1, t.duration),
                  }
                : t,
            );
            tasks = recomputeSummarySpans(tasks, cal);
            const seeds = tasks.filter((t) => t.projectId === id).map((t) => t.id);
            tasks = enforceConstraints(tasks, cal, seeds);
            tasks = recomputeSummarySpans(tasks, cal);
            const items = syncContentItemDates(prev.contentItems, tasks, projects);
            return { ...prev, projects, tasks, contentItems: items };
          }
        }
        return { ...prev, projects };
      });
      if (patch.workingDays || patch.holidays) {
        notify('Working calendar updated - dates were recomputed.', 'info');
      }
    },
    [notify],
  );

  const deleteProject = useCallback(
    (id: ID) => {
      setState((prev) => {
        const doomed = new Set(prev.tasks.filter((t) => t.projectId === id).map((t) => t.id));
        return {
          ...prev,
          projects: prev.projects.filter((p) => p.id !== id),
          contentItems: prev.contentItems.filter((i) => i.projectId !== id),
          tasks: prev.tasks.filter((t) => t.projectId !== id),
        };
      });
      setSelectedProjectId((cur) => (cur === id ? null : cur));
    },
    [],
  );

  // ----------------------------------------------------------- content items

  const createContentItem = useCallback(
    (input: ContentItemInput): ID => {
      const id = uid('item');
      const item: ContentItem = {
        id,
        projectId: input.projectId,
        title: input.title.trim() || 'Untitled content',
        brief: input.brief ?? '',
        contentType: input.contentType ?? 'Social Media Post',
        platform: input.platform ?? 'Instagram',
        status: input.status ?? 'Not Started',
        priority: input.priority ?? 'Medium',
        startDate: input.startDate ?? today,
        endDate: input.endDate ?? addDays(today, 7),
        assigneeId: input.assigneeId ?? null,
      };
      setState((prev) => ({ ...prev, contentItems: [...prev.contentItems, item] }));
      notify(`Content item "${item.title}" added.`, 'success');
      return id;
    },
    [notify, today],
  );

  const updateContentItem = useCallback(
    (id: ID, patch: Partial<ContentItem>) => {
      setState((prev) => ({
        ...prev,
        contentItems: prev.contentItems.map((i) =>
          i.id === id ? { ...i, ...patch, id, projectId: i.projectId } : i,
        ),
      }));
    },
    [],
  );

  const deleteContentItem = useCallback(
    (id: ID) => {
      setState((prev) => {
        const doomed = new Set(
          prev.tasks.filter((t) => t.contentItemId === id).map((t) => t.id),
        );
        return {
          ...prev,
          contentItems: prev.contentItems.filter((i) => i.id !== id),
          tasks: prev.tasks
            .filter((t) => !doomed.has(t.id))
            .map((t) =>
              t.dependencies.some((d) => doomed.has(d.predecessorId))
                ? {
                    ...t,
                    dependencies: t.dependencies.filter((d) => !doomed.has(d.predecessorId)),
                  }
                : t,
            ),
        };
      });
      notify('Content item and its production tasks deleted.', 'info');
    },
    [notify],
  );

  // ------------------------------------------------------------------- tasks

  const createTask = useCallback(
    (input: TaskInput): ID => {
      const cal = calendarForId(input.projectId);
      const isMilestone = Boolean(input.isMilestone);
      const task: Task = {
        id: uid('task'),
        projectId: input.projectId,
        contentItemId: input.contentItemId ?? null,
        parentId: input.parentId ?? null,
        name: input.name.trim() || 'Untitled task',
        startDate: normalizeWorkingDay(input.startDate ?? today, cal),
        duration: isMilestone ? 0 : Math.max(1, Math.round(input.duration ?? 1)),
        status: input.status ?? 'Not Started',
        priority: input.priority ?? 'Medium',
        progress: input.progress ?? 0,
        assigneeId: input.assigneeId ?? null,
        isMilestone,
        dependencies: [],
      };
      const { tasks, moved } = insertTask(state.tasks, cal, task);
      commitTasks(tasks, moved);
      return task.id;
    },
    [calendarForId, commitTasks, state.tasks, today],
  );

  /**
   * Atomic task save (create or edit): fields, hierarchy and the full desired
   * dependency set are validated and applied in one pass so no intermediate
   * state can be lost, and any resulting reschedule is reported.
   */
  const saveTask = useCallback(
    (taskId: ID | null, input: SaveTaskInput): SaveTaskResult => {
      const editing = taskId ? state.tasks.find((t) => t.id === taskId) : undefined;
      if (taskId && !editing) return { id: taskId, error: 'Task not found.' };

      const projectId = editing?.projectId ?? input.projectId;
      const project = findProject(state, projectId);
      const cal = calendarOf(project?.workingDays, project?.holidays);
      const isMilestone = input.isMilestone ?? editing?.isMilestone ?? false;

      const patch: Partial<Task> = {
        name: (input.name ?? editing?.name ?? '').trim() || 'Untitled task',
        startDate: input.startDate ?? editing?.startDate ?? today,
        duration: isMilestone
          ? 0
          : Math.max(1, Math.round(input.duration ?? editing?.duration ?? 1)),
        isMilestone,
        status: input.status ?? editing?.status ?? 'Not Started',
        priority: input.priority ?? editing?.priority ?? 'Medium',
        progress: input.progress ?? editing?.progress ?? 0,
        assigneeId: input.assigneeId ?? null,
        parentId: input.parentId ?? null,
        contentItemId: input.contentItemId ?? editing?.contentItemId ?? null,
      };
      if (patch.status === 'Published' && input.progress === undefined) patch.progress = 100;
      patch.startDate = normalizeWorkingDay(patch.startDate ?? today, cal);

      if (patch.parentId && taskId) {
        const forbidden = new Set([taskId, ...descendantsOf(state.tasks, taskId)]);
        if (forbidden.has(patch.parentId)) {
          notify('A task cannot be moved inside its own subtasks.', 'warning');
          patch.parentId = editing?.parentId ?? null;
        }
      }

      // Apply fields first (no commit yet) so validation sees the final shape.
      let list: Task[];
      let targetId: ID;
      if (taskId) {
        const res = applyTaskUpdate(state.tasks, cal, taskId, patch);
        list = res.tasks;
        targetId = taskId;
      } else {
        targetId = uid('task');
        const fresh: Task = {
          id: targetId,
          projectId,
          contentItemId: patch.contentItemId ?? null,
          parentId: patch.parentId ?? null,
          name: patch.name ?? 'Untitled task',
          startDate: patch.startDate ?? today,
          duration: patch.duration ?? 1,
          status: patch.status ?? 'Not Started',
          priority: patch.priority ?? 'Medium',
          progress: patch.progress ?? 0,
          assigneeId: patch.assigneeId ?? null,
          isMilestone,
          dependencies: [],
        };
        const res = insertTask(state.tasks, cal, fresh);
        list = res.tasks;
      }

      // Validate the whole desired dependency set (self / cycle / ancestor / summary).
      const desired: Dependency[] = (input.dependencies ?? []).map((d) => ({
        predecessorId: d.predecessorId,
        type: d.type,
        lag: Math.max(0, Math.round(d.lag || 0)),
      }));
      const original = editing?.dependencies ?? [];
      const errors: string[] = [];
      for (const dep of desired) {
        const unchanged = original.some(
          (o) => o.predecessorId === dep.predecessorId && o.type === dep.type && o.lag === dep.lag,
        );
        if (unchanged) continue;
        // Probe with this edge excluded so the duplicate check and cycle check
        // see every other desired edge but not this one.
        const probe = list.map((t) =>
          t.id === targetId
            ? {
                ...t,
                dependencies: desired.filter(
                  (d) => !(d.predecessorId === dep.predecessorId && d.type === dep.type),
                ),
              }
            : t,
        );
        const err = validateDependency(probe, dep.predecessorId, targetId);
        if (err && !errors.includes(err)) errors.push(err);
      }
      if (errors.length > 0) {
        notify(errors[0], 'warning');
        return { id: targetId, error: errors[0] };
      }

      // Apply dependencies, enforce constraints, re-span summaries - one commit.
      const snapshot = new Map(list.map((t) => [t.id, t.startDate] as const));
      list = list.map((t) => (t.id === targetId ? { ...t, dependencies: desired } : t));
      list = enforceConstraints(list, cal, [targetId, ...descendantsOf(list, targetId)]);
      list = recomputeSummarySpans(list, cal);

      const moved: MovedTask[] = [];
      for (const t of list) {
        const prev = snapshot.get(t.id);
        if (prev !== undefined && prev !== t.startDate) {
          moved.push({ id: t.id, name: t.name, from: prev, to: t.startDate });
        }
      }
      commitTasks(list, moved);
      return { id: targetId, error: null };
    },
    [commitTasks, notify, state, today],
  );

  const updateTask = useCallback(
    (id: ID, patch: Partial<Task>) => {
      const task = state.tasks.find((t) => t.id === id);
      if (!task) return;
      const project = findProject(state, task.projectId);
      const cal = calendarOf(project?.workingDays, project?.holidays);

      const effective: Partial<Task> = { ...patch };
      delete effective.id;
      delete effective.projectId;
      if (effective.isMilestone === true) {
        effective.duration = 0;
      }
      if (effective.duration !== undefined && !effective.isMilestone) {
        effective.duration = Math.max(0, Math.round(effective.duration));
      }
      if (effective.status === 'Published' && patch.progress === undefined) {
        effective.progress = 100;
      }
      if (effective.parentId) {
        const forbidden = new Set([id, ...descendantsOf(state.tasks, id)]);
        if (forbidden.has(effective.parentId)) {
          notify('A task cannot be moved inside its own subtasks.', 'warning');
          delete effective.parentId;
        }
      }
      if (effective.startDate) {
        effective.startDate = normalizeWorkingDay(effective.startDate, cal);
      }

      const { tasks, moved } = applyTaskUpdate(state.tasks, cal, id, effective);
      commitTasks(tasks, moved);
    },
    [commitTasks, notify, state],
  );

  const deleteTask = useCallback(
    (id: ID) => {
      const project = findProject(state, state.tasks.find((t) => t.id === id)?.projectId ?? '');
      const cal = calendarOf(project?.workingDays, project?.holidays);
      const tasks = removeTask(state.tasks, id);
      commitTasks(recomputeSummarySpans(tasks, cal), []);
      notify('Task deleted.', 'info');
    },
    [commitTasks, notify, state],
  );

  const addDependency = useCallback(
    (taskId: ID, predecessorId: ID, type: DependencyType, lag: number): string | null => {
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return 'Unknown task.';
      const error = validateDependency(state.tasks, predecessorId, taskId);
      if (error) {
        notify(error, 'warning');
        return error;
      }
      const project = findProject(state, task.projectId);
      const cal = calendarOf(project?.workingDays, project?.holidays);
      const dependency: Dependency = {
        predecessorId,
        type,
        lag: Math.max(0, Math.round(lag || 0)),
      };
      let tasks = state.tasks.map((t) =>
        t.id === taskId ? { ...t, dependencies: [...t.dependencies, dependency] } : t,
      );
      tasks = enforceConstraints(tasks, cal, [taskId]);
      tasks = recomputeSummarySpans(tasks, cal);
      commitTasks(tasks, [], 'Dependency added');
      return null;
    },
    [commitTasks, notify, state],
  );

  const removeDependency = useCallback(
    (taskId: ID, predecessorId: ID, type: DependencyType) => {
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                dependencies: t.dependencies.filter(
                  (d) => !(d.predecessorId === predecessorId && d.type === type),
                ),
              }
            : t,
        ),
      }));
    },
    [],
  );

  // --------------------------------------------------------------- resources

  const addResource = useCallback(
    (name: string, role: ResourceRole): ID => {
      const id = uid('res');
      const resource: Resource = {
        id,
        name: name.trim() || 'New resource',
        role,
        color: RESOURCE_COLORS[0],
      };
      setState((prev) => {
        const taken = new Set(prev.resources.map((r) => r.color));
        const color = RESOURCE_COLORS.find((c) => !taken.has(c)) ?? RESOURCE_COLORS[0];
        return {
          ...prev,
          resources: [...prev.resources, { ...resource, color }],
        };
      });
      notify(`${resource.name} added to the team.`, 'success');
      return id;
    },
    [notify],
  );

  const updateResource = useCallback((id: ID, patch: Partial<Resource>) => {
    setState((prev) => ({
      ...prev,
      resources: prev.resources.map((r) => (r.id === id ? { ...r, ...patch, id } : r)),
    }));
  }, []);

  const removeResource = useCallback(
    (id: ID) => {
      setState((prev) => ({
        ...prev,
        resources: prev.resources.filter((r) => r.id !== id),
        tasks: prev.tasks.map((t) => (t.assigneeId === id ? { ...t, assigneeId: null } : t)),
        contentItems: prev.contentItems.map((i) =>
          i.assigneeId === id ? { ...i, assigneeId: null } : i,
        ),
      }));
      notify('Resource removed; their tasks are now unassigned.', 'info');
    },
    [notify],
  );

  const resetDemoData = useCallback(() => {
    const fresh = buildSeedState();
    setState(fresh);
    setSelectedProjectId(fresh.projects[0]?.id ?? null);
    notify('Demo data restored.', 'success');
  }, [notify]);

  const value: StoreValue = {
    state,
    today,
    notifications,
    notify,
    dismissNotification,
    selectedProjectId,
    setSelectedProjectId,
    createProject,
    updateProject,
    deleteProject,
    createContentItem,
    updateContentItem,
    deleteContentItem,
    createTask,
    saveTask,
    updateTask,
    deleteTask,
    addDependency,
    removeDependency,
    addResource,
    updateResource,
    removeResource,
    resetDemoData,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
