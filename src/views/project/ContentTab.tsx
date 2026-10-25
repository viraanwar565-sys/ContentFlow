import { useMemo, useState, type ReactNode } from 'react';
import type { Project, Task, WorkflowStatus } from '../../types';
import { useStore } from '../../store/store';
import { Avatar, Button, EmptyState, ProgressBar, Section, PriorityBadge } from '../../components/ui';
import { ContentItemFormModal, TaskFormModal } from '../../components/forms';
import {
  calendarFor,
  projectContentItems,
  projectTasks,
  contentItemProgress,
  weightedProgress,
} from '../../utils/selectors';
import { taskEndISO } from '../../utils/scheduling';
import { formatDate, formatShortDate } from '../../utils/dates';
import { PLATFORM_COLORS, STATUS_COLORS, WORKFLOW_STATUSES } from '../../constants';

export function ContentTab({ project }: { project: Project }) {
  const { state, deleteTask, deleteContentItem, updateContentItem, updateTask } = useStore();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [itemForm, setItemForm] = useState<{ create: boolean; itemId?: string } | null>(null);
  const [taskForm, setTaskForm] = useState<{
    taskId?: string;
    parentId?: string | null;
    contentItemId?: string | null;
    startDate?: string;
    milestone?: boolean;
  } | null>(null);
  const [query, setQuery] = useState('');

  const cal = useMemo(() => calendarFor(project), [project]);
  const tasks = useMemo(() => projectTasks(state, project.id), [state, project.id]);
  const items = useMemo(
    () => projectContentItems(state, project.id),
    [state, project.id],
  );
  const byParent = useMemo(() => {
    const map = new Map<string | null, Task[]>();
    for (const t of tasks) {
      const list = map.get(t.parentId);
      if (list) list.push(t);
      else map.set(t.parentId, [t]);
    }
    return map;
  }, [tasks]);

  const q = query.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);
  const visibleItems = items.filter((i) => !q || matches(i.title) || i.brief.toLowerCase().includes(q));
  const campaignRoots = (byParent.get(null) ?? []).filter(
    (t) => t.contentItemId === null && matches(t.name),
  );

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeTask = (task: Task) => {
    const kids = tasks.filter((t) => t.parentId === task.id).length;
    const ok = window.confirm(
      kids > 0
        ? `Delete "${task.name}" and its ${kids} subtask(s)?`
        : `Delete "${task.name}"?`,
    );
    if (ok) deleteTask(task.id);
  };

  const removeItem = (itemId: string, title: string) => {
    const count = tasks.filter((t) => t.contentItemId === itemId).length;
    const ok = window.confirm(
      `Delete "${title}" and its ${count} production task(s)? This cannot be undone.`,
    );
    if (ok) deleteContentItem(itemId);
  };

  const renderTaskRow = (task: Task, depth: number): ReactNode => {
    const children = (byParent.get(task.id) ?? []).filter((t) => matches(t.name));
    const allChildren = byParent.get(task.id) ?? [];
    const isCollapsed = collapsed.has(task.id);
    const end = taskEndISO(task, cal);
    const progress = allChildren.length > 0 ? weightedProgress(allChildren) : task.progress;
    const assignee = state.resources.find((r) => r.id === task.assigneeId);
    const depSummary = task.dependencies.length
      ? task.dependencies
          .map((d) => {
            const pred = tasks.find((t) => t.id === d.predecessorId);
            return `${pred?.name ?? '?'} [${d.type}${d.lag ? ` +${d.lag}d` : ''}]`;
          })
          .join(', ')
      : 'No dependencies';

    return (
      <div key={task.id} className="task-tree-block">
        <div
          className={`task-row${task.isMilestone ? ' milestone-row' : ''}`}
          style={{ paddingLeft: 8 + depth * 22 }}
        >
          <span className="task-row-main">
            <button
              type="button"
              className={`expander${allChildren.length === 0 ? ' empty' : ''}`}
              onClick={() => allChildren.length > 0 && toggle(task.id)}
              title={allChildren.length > 0 ? 'Toggle subtasks' : undefined}
            >
              {allChildren.length > 0 ? (isCollapsed ? '▸' : '▾') : '·'}
            </button>
            {task.isMilestone && <span className="milestone-diamond small" />}
            <span className="task-name" title={task.name}>
              {task.name}
            </span>
            {task.dependencies.length > 0 && (
              <span className="dep-chip" title={depSummary}>
                {task.dependencies.length} dep{task.dependencies.length === 1 ? '' : 's'}
              </span>
            )}
            {allChildren.length > 0 && (
              <span className="muted small">summary</span>
            )}
          </span>

          <span className="task-row-dates nowrap" title={`Ends ${formatDate(end)}`}>
            {formatShortDate(task.startDate)} &rarr; {formatShortDate(end)}
            <span className="muted small">
              {' '}
              {task.isMilestone ? 'MS' : `${task.duration}d`}
            </span>
          </span>

          <span className="task-row-status">
            <select
              className="input input-sm"
              value={task.status}
              onChange={(e) => updateTask(task.id, { status: e.target.value as WorkflowStatus })}
              style={{ color: STATUS_COLORS[task.status] }}
            >
              {WORKFLOW_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </span>

          <span className="task-row-progress">
            <ProgressBar value={progress} />
          </span>

          <span className="task-row-assignee">
            <Avatar resource={assignee} size={24} />
          </span>

          <span className="task-row-priority">
            <PriorityBadge priority={task.priority} />
          </span>

          <span className="task-row-actions">
            {!task.isMilestone && allChildren.length === 0 && (
              <button
                type="button"
                className="icon-btn"
                title="Add subtask"
                onClick={() =>
                  setTaskForm({ parentId: task.id, contentItemId: task.contentItemId })
                }
              >
                +
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              title="Edit task"
              onClick={() => setTaskForm({ taskId: task.id })}
            >
              ✎
            </button>
            <button
              type="button"
              className="icon-btn danger"
              title="Delete task"
              onClick={() => removeTask(task)}
            >
              ✕
            </button>
          </span>
        </div>

        {!isCollapsed && children.map((child) => renderTaskRow(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="content-tab">
      <div className="toolbar">
        <input
          className="input search"
          placeholder="Filter content or tasks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="toolbar-actions">
          <Button size="sm" onClick={() => setTaskForm({ contentItemId: null, parentId: null })}>
            + Campaign task
          </Button>
          <Button size="sm" onClick={() => setTaskForm({ contentItemId: null, parentId: null, milestone: true })}>
            + Milestone
          </Button>
          <Button size="sm" variant="primary" onClick={() => setItemForm({ create: true })}>
            + Content item
          </Button>
        </div>
      </div>

      {visibleItems.length === 0 && campaignRoots.length === 0 ? (
        <EmptyState
          title={q ? 'Nothing matches your filter' : 'No content items yet'}
          description={
            q
              ? 'Try a different search term.'
              : 'Add a content item (post, reel, video, article) and its production pipeline will appear here.'
          }
          action={
            q ? undefined : (
              <Button variant="primary" onClick={() => setItemForm({ create: true })}>
                Add content item
              </Button>
            )
          }
        />
      ) : (
        <>
          <Section
            title="Content items"
            subtitle="Each item carries its production pipeline: brief -> creation -> review -> approval -> scheduling -> publishing"
          >
            {visibleItems.length === 0 && <p className="muted">No content items match.</p>}
            {visibleItems.map((item) => {
              const itemTaskList = tasks.filter((t) => t.contentItemId === item.id);
              const roots = (byParent.get(null) ?? []).filter(
                (t) => t.contentItemId === item.id,
              );
              const progress = contentItemProgress(itemTaskList);
              const itemCollapsed = collapsed.has(`item-${item.id}`);
              return (
                <div key={item.id} className="item-block">
                  <div className="item-block-head">
                    <button
                      type="button"
                      className="expander"
                      onClick={() => toggle(`item-${item.id}`)}
                    >
                      {itemCollapsed ? '▸' : '▾'}
                    </button>
                    <span
                      className="platform-tag"
                      style={{ color: PLATFORM_COLORS[item.platform] }}
                    >
                      {item.platform}
                    </span>
                    <div className="item-block-title">
                      <strong>{item.title}</strong>
                      <span className="muted small">
                        {item.contentType} &middot; publishes {formatDate(item.endDate)} &middot;{' '}
                        {itemTaskList.length} tasks
                      </span>
                    </div>
                    <div className="item-block-progress">
                      <ProgressBar value={progress} />
                    </div>
                    <select
                      className="input input-sm"
                      value={item.status}
                      style={{ color: STATUS_COLORS[item.status] }}
                      onChange={(e) =>
                        updateContentItem(item.id, {
                          status: e.target.value as WorkflowStatus,
                        })
                      }
                    >
                      {WORKFLOW_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <span className="item-block-actions">
                      <Button
                        size="sm"
                        onClick={() =>
                          setTaskForm({
                            contentItemId: item.id,
                            parentId: roots[0]?.id ?? null,
                          })
                        }
                      >
                        + Task
                      </Button>
                      <Button size="sm" onClick={() => setItemForm({ create: false, itemId: item.id })}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => removeItem(item.id, item.title)}
                      >
                        Delete
                      </Button>
                    </span>
                  </div>
                  {!itemCollapsed && (
                    <div className="item-block-body">
                      {item.brief && <p className="item-brief">{item.brief}</p>}
                      {roots.length === 0 ? (
                        <p className="muted small">
                          No production tasks yet - add the first one.
                        </p>
                      ) : (
                        roots.map((t) => renderTaskRow(t, 0))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Section>

          <Section
            title="Campaign tasks & milestones"
            subtitle="Project-level work outside a single content item"
          >
            {campaignRoots.length === 0 ? (
              <p className="muted">No campaign-level tasks.</p>
            ) : (
              campaignRoots.map((t) => renderTaskRow(t, 0))
            )}
          </Section>
        </>
      )}

      {itemForm && (
        <ContentItemFormModal
          projectId={project.id}
          item={itemForm.create ? undefined : items.find((i) => i.id === itemForm.itemId)}
          onClose={() => setItemForm(null)}
        />
      )}
      {taskForm && (
        <TaskFormModal
          projectId={project.id}
          task={taskForm.taskId ? tasks.find((t) => t.id === taskForm.taskId) : undefined}
          defaultParentId={taskForm.parentId ?? null}
          defaultContentItemId={taskForm.contentItemId ?? null}
          defaultStartDate={taskForm.startDate}
          defaultIsMilestone={taskForm.milestone}
          onClose={() => setTaskForm(null)}
        />
      )}
    </div>
  );
}
