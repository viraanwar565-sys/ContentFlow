/** Modal forms: project, content item, task (with dependencies), resource. */

import { useMemo, useState, type ReactNode } from 'react';
import type {
  ContentItem,
  ContentType,
  Dependency,
  DependencyType,
  Holiday,
  Platform,
  Priority,
  Project,
  ProjectStatus,
  ResourceRole,
  Task,
  WorkflowStatus,
} from '../types';
import {
  CONTENT_TYPES,
  DEPENDENCY_LABELS,
  DEPENDENCY_TYPES,
  PLATFORMS,
  PRIORITIES,
  PROJECT_STATUSES,
  RESOURCE_ROLES,
  WORKFLOW_STATUSES,
} from '../constants';
import { Modal } from './Modal';
import { Button } from './ui';
import { useStore } from '../store/store';
import { calendarOf, normalizeWorkingDay, spanEndDate } from '../utils/workingDays';
import { descendantsOf, validateDependency } from '../utils/dependencies';
import { formatDate, isValidISO } from '../utils/dates';
import { taskEndISO } from '../utils/scheduling';

function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Project form
// ---------------------------------------------------------------------------

export function ProjectFormModal({
  project,
  onClose,
}: {
  project?: Project;
  onClose: () => void;
}) {
  const { createProject, updateProject, today } = useStore();
  const editing = Boolean(project);
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [startDate, setStartDate] = useState(project?.startDate ?? today);
  const [endDate, setEndDate] = useState(project?.endDate ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'Planning');
  const [workingDays, setWorkingDays] = useState<number[]>(
    project?.workingDays ?? [1, 2, 3, 4, 5],
  );
  const [error, setError] = useState<string | null>(null);

  const cal = useMemo(() => calendarOf(workingDays, []), [workingDays]);
  const effectiveEnd =
    endDate || (isValidISO(startDate) ? spanEndDate(startDate, 30, cal) : '');

  const toggleDay = (day: number) => {
    setWorkingDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort();
      return next.length === 0 ? prev : next;
    });
  };

  const submit = () => {
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    if (workingDays.length === 0) {
      setError('Select at least one working day.');
      return;
    }
    if (effectiveEnd && effectiveEnd < startDate) {
      setError('End date must be on or after the start date.');
      return;
    }
    const payload = {
      name: name.trim(),
      description,
      startDate,
      endDate: effectiveEnd,
      status,
      workingDays,
      holidays: project?.holidays ?? [],
    };
    if (project) updateProject(project.id, payload);
    else createProject(payload);
    onClose();
  };

  return (
    <Modal
      title={editing ? 'Edit project' : 'New project'}
      subtitle={
        editing
          ? 'Update the project window, status and working days.'
          : 'Plan a new content production project.'
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {editing ? 'Save changes' : 'Create project'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Project name" error={error ?? undefined}>
          <input
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="e.g. Spring Recruitment Campaign"
            autoFocus
          />
        </Field>
        <Field label="Status">
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Start date">
          <input
            className="input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field
          label="End date"
          hint={effectiveEnd ? `Calculated window ends ${formatDate(effectiveEnd)}` : undefined}
        >
          <input
            className="input"
            type="date"
            value={effectiveEnd}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
        <Field
          label="Description"
          hint="What does this project produce, and for whom?"
          className="field-span-2"
        >
          <textarea
            className="input textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the campaign, its channels and its goal."
          />
        </Field>
        <Field
          label="Working days"
          hint="Durations, dependencies and the critical path respect these days."
          className="field-span-2"
        >
          <div className="weekday-picker">
            {[
              { d: 1, label: 'Mon' },
              { d: 2, label: 'Tue' },
              { d: 3, label: 'Wed' },
              { d: 4, label: 'Thu' },
              { d: 5, label: 'Fri' },
              { d: 6, label: 'Sat' },
              { d: 0, label: 'Sun' },
            ].map(({ d, label }) => (
              <button
                key={d}
                type="button"
                className={`weekday-chip${workingDays.includes(d) ? ' active' : ''}`}
                onClick={() => toggleDay(d)}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Content item form
// ---------------------------------------------------------------------------

export function ContentItemFormModal({
  projectId,
  item,
  onClose,
}: {
  projectId: string;
  item?: ContentItem;
  onClose: () => void;
}) {
  const { createContentItem, updateContentItem, state, today } = useStore();
  const editing = Boolean(item);
  const existingTaskCount = item
    ? state.tasks.filter((t) => t.contentItemId === item.id).length
    : 0;
  const datesFromTasks = existingTaskCount > 0;

  const [title, setTitle] = useState(item?.title ?? '');
  const [brief, setBrief] = useState(item?.brief ?? '');
  const [contentType, setContentType] = useState<ContentType>(item?.contentType ?? 'Social Media Post');
  const [platform, setPlatform] = useState<Platform>(item?.platform ?? 'Instagram');
  const [status, setStatus] = useState<WorkflowStatus>(item?.status ?? 'Not Started');
  const [priority, setPriority] = useState<Priority>(item?.priority ?? 'Medium');
  const [assigneeId, setAssigneeId] = useState<string>(item?.assigneeId ?? '');
  const [startDate, setStartDate] = useState(item?.startDate ?? today);
  const [endDate, setEndDate] = useState(item?.endDate ?? today);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!title.trim()) {
      setError('A title is required.');
      return;
    }
    if (!datesFromTasks && endDate < startDate) {
      setError('The publish date must be on or after the start date.');
      return;
    }
    const payload = {
      title: title.trim(),
      brief,
      contentType,
      platform,
      status,
      priority,
      assigneeId: assigneeId || null,
      startDate,
      endDate,
    };
    if (item) updateContentItem(item.id, payload);
    else createContentItem({ ...payload, projectId });
    onClose();
  };

  return (
    <Modal
      title={editing ? 'Edit content item' : 'New content item'}
      subtitle={
        datesFromTasks
          ? 'Dates are derived from this item\u2019s production tasks.'
          : 'Add a piece of content to the production pipeline.'
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {editing ? 'Save changes' : 'Add content item'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Title" error={error ?? undefined} className="field-span-2">
          <input
            className="input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            placeholder="e.g. Finals Week Safety Tips"
            autoFocus
          />
        </Field>
        <Field label="Brief / description" className="field-span-2">
          <textarea
            className="input textarea"
            rows={3}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="What is this content about and what should it achieve?"
          />
        </Field>
        <Field label="Content type">
          <select
            className="input"
            value={contentType}
            onChange={(e) => setContentType(e.target.value as ContentType)}
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Platform">
          <select
            className="input"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
          >
            {PLATFORMS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as WorkflowStatus)}
          >
            {WORKFLOW_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select
            className="input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Owner">
          <select
            className="input"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {state.resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} - {r.role}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Publish date" hint={datesFromTasks ? 'Follows the production tasks.' : undefined}>
          <input
            className="input"
            type="date"
            value={endDate}
            disabled={datesFromTasks}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
        {!datesFromTasks && (
          <Field label="Start date">
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Task form (including subtasks, milestones and dependencies)
// ---------------------------------------------------------------------------

interface TaskFormValues {
  name: string;
  startDate: string;
  duration: number;
  isMilestone: boolean;
  status: WorkflowStatus;
  priority: Priority;
  progress: number;
  assigneeId: string;
  parentId: string;
  dependencies: Dependency[];
}

export function TaskFormModal({
  projectId,
  task,
  defaultParentId,
  defaultContentItemId,
  defaultStartDate,
  defaultIsMilestone,
  onClose,
}: {
  projectId: string;
  task?: Task;
  defaultParentId?: string | null;
  defaultContentItemId?: string | null;
  defaultStartDate?: string;
  defaultIsMilestone?: boolean;
  onClose: () => void;
}) {
  const { state, today, saveTask, notify } = useStore();
  const editing = Boolean(task);
  const project = state.projects.find((p) => p.id === projectId);
  const cal = calendarOf(project?.workingDays, project?.holidays);
  const projectTasks = useMemo(
    () => state.tasks.filter((t) => t.projectId === projectId),
    [state.tasks, projectId],
  );
  const hasChildren = task ? projectTasks.some((t) => t.parentId === task.id) : false;

  const [name, setName] = useState(task?.name ?? '');
  const [startDate, setStartDate] = useState(
    task?.startDate ?? defaultStartDate ?? normalizeWorkingDay(today, cal),
  );
  const [duration, setDuration] = useState(task?.duration ?? 1);
  const [isMilestone, setIsMilestone] = useState(
    task?.isMilestone ?? defaultIsMilestone ?? false,
  );
  const [status, setStatus] = useState<WorkflowStatus>(task?.status ?? 'Not Started');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'Medium');
  const [progress, setProgress] = useState(task?.progress ?? 0);
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? '');
  const [parentId, setParentId] = useState(task?.parentId ?? defaultParentId ?? '');
  const [dependencies, setDependencies] = useState<Dependency[]>(task?.dependencies ?? []);
  const [error, setError] = useState<string | null>(null);
  const [depError, setDepError] = useState<string | null>(null);

  const [newPred, setNewPred] = useState('');
  const [newType, setNewType] = useState<DependencyType>('FS');
  const [newLag, setNewLag] = useState(0);

  const excluded = new Set<string>(task ? [task.id, ...descendantsOf(projectTasks, task.id)] : []);
  const candidateParents = projectTasks.filter(
    (t) => !excluded.has(t.id) && !t.isMilestone,
  );
  const predecessorCandidates = projectTasks.filter(
    (t) => !excluded.has(t.id) && !hasChildrenOf(projectTasks, t.id),
  );

  const effectiveDuration = isMilestone ? 0 : Math.max(0, duration);
  const endDate = spanEndDate(startDate, effectiveDuration, cal);

  const addDep = () => {
    if (!newPred) return;
    const candidate: Dependency = { predecessorId: newPred, type: newType, lag: Math.max(0, newLag) };
    if (dependencies.some((d) => d.predecessorId === candidate.predecessorId && d.type === candidate.type)) {
      setDepError('That dependency already exists.');
      return;
    }
    // Validate against a hypothetical task list (covers create mode too).
    const hypothetical: Task[] = task
      ? projectTasks
      : [
          ...projectTasks,
          {
            id: '__new_task__',
            projectId,
            contentItemId: defaultContentItemId ?? null,
            parentId: parentId || null,
            name: name || 'New task',
            startDate,
            duration: effectiveDuration,
            status,
            priority,
            progress,
            assigneeId: assigneeId || null,
            isMilestone,
            dependencies,
          },
        ];
    const targetId = task ? task.id : '__new_task__';
    const error = validateDependency(hypothetical, candidate.predecessorId, targetId);
    if (error) {
      setDepError(error);
      return;
    }
    setDependencies((prev) => [...prev, candidate]);
    setDepError(null);
    setNewPred('');
    setNewLag(0);
  };

  const submit = () => {
    if (!name.trim()) {
      setError('Task name is required.');
      return;
    }
    if (!isMilestone && effectiveDuration < 1 && !hasChildren) {
      setError('Duration must be at least 1 working day.');
      return;
    }
    if (parentId && parentId === task?.id) {
      setError('A task cannot be its own parent.');
      return;
    }

    const result = saveTask(task?.id ?? null, {
      projectId,
      name: name.trim(),
      parentId: parentId || null,
      contentItemId: task ? task.contentItemId : (defaultContentItemId ?? null),
      startDate,
      duration: effectiveDuration,
      isMilestone,
      status,
      priority,
      progress,
      assigneeId: assigneeId || null,
      dependencies,
    });

    if (result.error) {
      setDepError(result.error);
      setError(null);
      return; // keep the modal open so the dependency link can be corrected
    }

    notify(`Task "${name.trim()}" ${task ? 'updated' : 'created'}.`, 'success');
    onClose();
  };

  return (
    <Modal
      title={editing ? 'Edit task' : isMilestone ? 'New milestone' : 'New task'}
      subtitle={
        task
          ? 'Change dates, assignment, progress or dependencies.'
          : 'Add work to the production schedule. Dates respect working days.'
      }
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {editing ? 'Save changes' : 'Create task'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Task name" error={error ?? undefined} className="field-span-2">
          <input
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="e.g. Scriptwriting"
            autoFocus
          />
        </Field>
        <Field label="Start date" hint={`Ends ${formatDate(endDate)} (${effectiveDuration === 0 ? 'milestone' : `${effectiveDuration} working day${effectiveDuration === 1 ? '' : 's'}`})`}>
          <input
            className="input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(normalizeWorkingDay(e.target.value, cal))}
          />
        </Field>
        <Field
          label="Duration (working days)"
          hint={hasChildren ? 'Spanned by its subtasks.' : 'End date is derived from start + duration.'}
        >
          <input
            className="input"
            type="number"
            min={0}
            max={365}
            value={effectiveDuration}
            disabled={isMilestone || hasChildren}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </Field>
        <Field label="Status">
          <select
            className="input"
            value={status}
            onChange={(e) => {
              const next = e.target.value as WorkflowStatus;
              setStatus(next);
              if (next === 'Published') setProgress(100);
            }}
          >
            {WORKFLOW_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select
            className="input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label={`Progress: ${progress}%`} className="field-span-2">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="range"
          />
        </Field>
        <Field label="Assignee">
          <select
            className="input"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {state.resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} - {r.role}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Parent task (subtask of)">
          <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Top level</option>
            {candidateParents.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {projectTasks.some((c) => c.parentId === t.id) ? ' (summary)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Milestone">
          <div className="checkbox-row">
            <input
              id="milestone"
              type="checkbox"
              checked={isMilestone}
              onChange={(e) => {
                setIsMilestone(e.target.checked);
                if (e.target.checked) setDuration(0);
              }}
            />
            <label htmlFor="milestone">Zero-duration milestone (diamond marker on the Gantt)</label>
          </div>
        </Field>

        <div className="field field-span-2 dependency-editor">
          <span className="field-label">Dependencies</span>
          {dependencies.length === 0 && (
            <p className="field-hint">No predecessors yet. This task is scheduled from its start date.</p>
          )}
          <ul className="dep-list">
            {dependencies.map((d, index) => {
              const pred = projectTasks.find((t) => t.id === d.predecessorId);
              return (
                <li key={`${d.predecessorId}-${d.type}-${index}`} className="dep-item">
                  <span className="dep-name">{pred?.name ?? 'Unknown task'}</span>
                  <select
                    className="input input-sm"
                    value={d.type}
                    onChange={(e) => {
                      const type = e.target.value as DependencyType;
                      setDependencies((prev) =>
                        prev.map((x, i) => (i === index ? { ...x, type } : x)),
                      );
                    }}
                  >
                    {DEPENDENCY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t} - {DEPENDENCY_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <label className="dep-lag">
                    lag
                    <input
                      className="input input-sm"
                      type="number"
                      min={0}
                      max={120}
                      value={d.lag}
                      onChange={(e) => {
                        const lag = Math.max(0, Number(e.target.value));
                        setDependencies((prev) =>
                          prev.map((x, i) => (i === index ? { ...x, lag } : x)),
                        );
                      }}
                    />
                    d
                  </label>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Remove dependency"
                    onClick={() => setDependencies((prev) => prev.filter((_, i) => i !== index))}
                  >
                    &#10005;
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="dep-add">
            <select
              className="input"
              value={newPred}
              onChange={(e) => {
                setNewPred(e.target.value);
                setDepError(null);
              }}
            >
              <option value="">Select predecessor...</option>
              {predecessorCandidates
                .filter((t) => !dependencies.some((d) => d.predecessorId === t.id))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            <select
              className="input"
              value={newType}
              onChange={(e) => setNewType(e.target.value as DependencyType)}
            >
              {DEPENDENCY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DEPENDENCY_LABELS[t]}
                </option>
              ))}
            </select>
            <label className="dep-lag">
              lag
              <input
                className="input input-sm"
                type="number"
                min={0}
                max={120}
                value={newLag}
                onChange={(e) => setNewLag(Math.max(0, Number(e.target.value)))}
              />
              d
            </label>
            <Button size="sm" onClick={addDep} disabled={!newPred}>
              Add link
            </Button>
          </div>
          {depError && <span className="field-error">{depError}</span>}
        </div>
      </div>
    </Modal>
  );
}

function hasChildrenOf(tasks: Task[], id: string): boolean {
  return tasks.some((t) => t.parentId === id);
}

// ---------------------------------------------------------------------------
// Resource form
// ---------------------------------------------------------------------------

export function ResourceFormModal({
  resource,
  onClose,
}: {
  resource?: { id: string; name: string; role: ResourceRole };
  onClose: () => void;
}) {
  const { addResource, updateResource } = useStore();
  const [name, setName] = useState(resource?.name ?? '');
  const [role, setRole] = useState<ResourceRole>(resource?.role ?? 'Content Strategist');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) {
      setError('A name is required.');
      return;
    }
    if (resource) updateResource(resource.id, { name: name.trim(), role });
    else addResource(name.trim(), role);
    onClose();
  };

  return (
    <Modal
      title={resource ? 'Edit resource' : 'Add resource'}
      subtitle="Content production roles and who fills them."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {resource ? 'Save changes' : 'Add resource'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Name" error={error ?? undefined}>
          <input
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="e.g. Taylor Brooks"
            autoFocus
          />
        </Field>
        <Field label="Role">
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as ResourceRole)}
          >
            {RESOURCE_ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Working calendar / holidays editor
// ---------------------------------------------------------------------------

export function HolidayEditor({ project }: { project: Project }) {
  const { updateProject, notify } = useStore();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');

  const addHoliday = () => {
    if (!isValidISO(date)) {
      notify('Pick a valid date for the holiday.', 'warning');
      return;
    }
    if (project.holidays.some((h) => h.date === date)) {
      notify('That date is already a holiday.', 'warning');
      return;
    }
    const holiday: Holiday = { date, name: name.trim() || 'Holiday' };
    const holidays = [...project.holidays, holiday].sort((a, b) => (a.date < b.date ? -1 : 1));
    updateProject(project.id, { holidays });
    setDate('');
    setName('');
    notify(`${holiday.name} added to the working calendar.`, 'success');
  };

  const removeHoliday = (dateToRemove: string) => {
    updateProject(project.id, {
      holidays: project.holidays.filter((h) => h.date !== dateToRemove),
    });
  };

  return (
    <div className="holiday-editor">
      <div className="holiday-add">
        <input
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          className="input"
          placeholder="Holiday name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addHoliday();
          }}
        />
        <Button size="sm" variant="primary" onClick={addHoliday}>
          Add holiday
        </Button>
      </div>
      {project.holidays.length === 0 ? (
        <p className="field-hint">No holidays yet - every working day is available for scheduling.</p>
      ) : (
        <ul className="holiday-list">
          {project.holidays.map((h) => (
            <li key={h.date}>
              <span className="holiday-date">{formatDate(h.date)}</span>
              <span className="holiday-name">{h.name}</span>
              <button
                type="button"
                className="icon-btn"
                title="Remove holiday"
                onClick={() => removeHoliday(h.date)}
              >
                &#10005;
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Re-export helper used by task rows for consistent end-date rendering. */
export function formTaskEnd(task: Task, workingDays: number[], holidays: { date: string }[]): string {
  return taskEndISO(task, calendarOf(workingDays, holidays));
}
