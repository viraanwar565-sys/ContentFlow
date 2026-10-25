import { useMemo, useState } from 'react';
import type { Project } from '../../types';
import { useStore } from '../../store/store';
import { Button, ProgressBar, Section, StatusBadge, Avatar } from '../../components/ui';
import { ContentItemFormModal, TaskFormModal } from '../../components/forms';
import {
  calendarFor,
  projectContentItems,
  projectTasks,
  contentItemProgress,
  itemTasks,
} from '../../utils/selectors';
import { computeCriticalPath } from '../../utils/criticalPath';
import { computeDashboardStats } from '../../utils/stats';
import { formatDate } from '../../utils/dates';
import { PLATFORM_COLORS } from '../../constants';
import type { ProjectTab } from '../../router';

export function OverviewTab({
  project,
  onOpenTab,
}: {
  project: Project;
  onOpenTab: (tab: ProjectTab) => void;
}) {
  const { state, today } = useStore();
  const [showItemForm, setShowItemForm] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);

  const tasks = useMemo(() => projectTasks(state, project.id), [state, project.id]);
  const items = useMemo(() => projectContentItems(state, project.id), [state, project.id]);
  const cal = useMemo(() => calendarFor(project), [project]);
  const cpm = useMemo(() => computeCriticalPath(tasks, cal), [tasks, cal]);
  const stats = useMemo(() => computeDashboardStats(state, today), [state, today]);

  const milestones = tasks.filter((t) => t.isMilestone);
  const doneTasks = tasks.filter((t) => t.progress >= 100).length;
  const members = state.resources.filter((r) =>
    tasks.some((t) => t.assigneeId === r.id),
  );

  return (
    <div className="overview-tab">
      <div className="grid-2">
        <Section title="About this project">
          <p className="prose">{project.description}</p>
          <dl className="kv-grid">
            <div>
              <dt>Start</dt>
              <dd>{formatDate(project.startDate)}</dd>
            </div>
            <div>
              <dt>End</dt>
              <dd>{formatDate(project.endDate)}</dd>
            </div>
            <div>
              <dt>Content items</dt>
              <dd>{items.length}</dd>
            </div>
            <div>
              <dt>Tasks</dt>
              <dd>
                {doneTasks}/{tasks.length} done
              </dd>
            </div>
            <div>
              <dt>Milestones</dt>
              <dd>{milestones.length}</dd>
            </div>
            <div>
              <dt>Critical tasks</dt>
              <dd>{cpm.criticalIds.length}</dd>
            </div>
          </dl>
          <div className="overview-actions">
            <Button variant="primary" size="sm" onClick={() => setShowItemForm(true)}>
              + Content item
            </Button>
            <Button size="sm" onClick={() => setShowMilestoneForm(true)}>
              + Milestone
            </Button>
            <Button size="sm" onClick={() => onOpenTab('gantt')}>
              Open Gantt
            </Button>
          </div>
        </Section>

        <Section
          title="Critical path snapshot"
          subtitle="Computed from dependencies and working days"
          actions={
            <Button size="sm" onClick={() => onOpenTab('critical')}>
              Details
            </Button>
          }
        >
          <dl className="kv-grid">
            <div>
              <dt>Project duration</dt>
              <dd>
                {cpm.durationWorkingDays} working day{cpm.durationWorkingDays === 1 ? '' : 's'}
              </dd>
            </div>
            <div>
              <dt>Earliest finish</dt>
              <dd>{cpm.projectEnd ? formatDate(cpm.projectEnd) : '-'}</dd>
            </div>
            <div>
              <dt>Critical tasks</dt>
              <dd>{cpm.criticalIds.length}</dd>
            </div>
            <div>
              <dt>Zero-float tasks</dt>
              <dd>{Object.values(cpm.floats).filter((f) => f <= 0).length}</dd>
            </div>
          </dl>
          <div className="critical-strip">
            {cpm.orderedPath.slice(0, 8).map((id) => {
              const t = tasks.find((x) => x.id === id);
              return t ? (
                <span key={id} className="critical-chip" title={t.name}>
                  {t.name}
                </span>
              ) : null;
            })}
            {cpm.orderedPath.length === 0 && (
              <span className="muted">No critical chain detected.</span>
            )}
          </div>
        </Section>
      </div>

      <Section
        title="Content items"
        subtitle="Everything this project is producing"
        actions={
          <Button size="sm" onClick={() => onOpenTab('content')}>
            Manage content
          </Button>
        }
      >
        {items.length === 0 ? (
          <p className="muted">No content items yet. Add one to start a production pipeline.</p>
        ) : (
          <div className="item-strip">
            {items.map((item) => {
              const itemTaskList = itemTasks(state, item.id);
              const progress = contentItemProgress(itemTaskList);
              return (
                <div key={item.id} className="item-card">
                  <div className="item-card-head">
                    <span className="platform-tag" style={{ color: PLATFORM_COLORS[item.platform] }}>
                      {item.platform}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                  <h4>{item.title}</h4>
                  <p className="muted small">{item.contentType}</p>
                  <ProgressBar value={progress} />
                  <div className="item-card-foot">
                    <span className="muted small">
                      Publishes {formatDate(item.endDate)}
                    </span>
                    <span className="muted small">{itemTaskList.length} tasks</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <div className="grid-2">
        <Section title="Milestones" subtitle="Zero-duration checkpoints">
          {milestones.length === 0 ? (
            <p className="muted">No milestones yet.</p>
          ) : (
            <ul className="milestone-list">
              {milestones.map((m) => (
                <li key={m.id} className={m.progress >= 100 ? 'done' : ''}>
                  <span className="milestone-diamond" />
                  <span className="milestone-name">{m.name}</span>
                  <span className="milestone-date">{formatDate(m.startDate)}</span>
                  <StatusBadge status={m.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Team" subtitle={`People assigned to tasks in this project`}>
          <div className="team-list">
            {members.map((r) => {
              const assigned = tasks.filter((t) => t.assigneeId === r.id);
              const open = assigned.filter((t) => t.progress < 100).length;
              return (
                <div key={r.id} className="team-row">
                  <Avatar resource={r} size={30} />
                  <div className="team-ident">
                    <strong>{r.name}</strong>
                    <span className="muted small">{r.role}</span>
                  </div>
                  <span className="team-count">
                    {assigned.length} tasks &middot; {open} open
                  </span>
                </div>
              );
            })}
            {members.length === 0 && <p className="muted">No assignments yet.</p>}
          </div>
          <p className="muted small">
            Dashboard totals across all projects: {stats.published} published, {stats.delayed}{' '}
            delayed, {stats.overallProgress}% overall progress.
          </p>
        </Section>
      </div>

      {showItemForm && (
        <ContentItemFormModal projectId={project.id} onClose={() => setShowItemForm(false)} />
      )}
      {showMilestoneForm && (
        <TaskFormModal
          projectId={project.id}
          defaultStartDate={today}
          defaultIsMilestone
          onClose={() => setShowMilestoneForm(false)}
        />
      )}
    </div>
  );
}
