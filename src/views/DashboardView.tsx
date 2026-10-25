import { useMemo } from 'react';
import { useStore } from '../store/store';
import { computeDashboardStats, projectSummaries } from '../utils/stats';
import { projectContentItems, projectTasks } from '../utils/selectors';
import { formatDate, formatDayDate } from '../utils/dates';
import {
  Avatar,
  Button,
  EmptyState,
  ProgressBar,
  Section,
  StatCard,
  StatusBadge,
} from '../components/ui';
import { navigate } from '../router';
import { PROJECT_STATUS_COLORS, STATUS_COLORS } from '../constants';

export function DashboardView() {
  const { state, today, selectedProjectId, setSelectedProjectId } = useStore();
  const stats = useMemo(() => computeDashboardStats(state, today), [state, today]);
  const summaries = useMemo(() => projectSummaries(state), [state]);

  const project =
    state.projects.find((p) => p.id === selectedProjectId) ?? state.projects[0];
  const setSelected = (id: string) => setSelectedProjectId(id);

  if (state.projects.length === 0) {
    return (
      <div className="page">
        <EmptyState
          title="No projects yet"
          description="Create your first content production project to start planning briefs, scripts, reviews and publishing dates."
          action={
            <Button variant="primary" onClick={() => navigate({ name: 'projects' })}>
              Go to projects
            </Button>
          }
        />
      </div>
    );
  }

  const projectTaskList = project ? projectTasks(state, project.id) : [];
  const projectItems = project ? projectContentItems(state, project.id) : [];
  const milestones = projectTaskList.filter((t) => t.isMilestone);
  const projectSummary = summaries.find((s) => s.project.id === project?.id);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">
            Content production across {state.projects.length} project
            {state.projects.length === 1 ? '' : 's'} &middot; {formatDayDate(today)}
          </p>
        </div>
        <div className="page-header-actions">
          <Button onClick={() => navigate({ name: 'calendar' })}>Content calendar</Button>
          <Button variant="primary" onClick={() => navigate({ name: 'projects' })}>
            Manage projects
          </Button>
        </div>
      </header>

      <div className="stat-grid">
        <StatCard label="Total projects" value={stats.totalProjects} accent="#6366f1" />
        <StatCard label="Active projects" value={stats.activeProjects} accent="#0ea5e9" />
        <StatCard label="Content items" value={stats.totalContentItems} accent="#8b5cf6" />
        <StatCard label="In production" value={stats.inProduction} accent="#3b82f6" />
        <StatCard label="In review" value={stats.inReview} accent="#a855f7" />
        <StatCard label="Scheduled" value={stats.scheduled} accent="#0ea5e9" />
        <StatCard label="Published" value={stats.published} accent="#16a34a" />
        <StatCard
          label="Delayed"
          value={stats.delayed}
          accent={stats.delayed > 0 ? '#ef4444' : '#cbd5e1'}
        />
      </div>

      <div className="grid-2">
        <Section title="Overall progress" subtitle="Average completion across all content items">
          <div className="overall-progress">
            <div className="ring">
              <span className="ring-value">{stats.overallProgress}%</span>
              <span className="ring-label">complete</span>
            </div>
            <div className="overall-breakdown">
              {summaries.map((s) => (
                <div key={s.project.id} className="breakdown-row">
                  <span className="breakdown-name">{s.project.name}</span>
                  <ProgressBar value={s.progress} />
                  <span className="breakdown-value">{s.progress}%</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section
          title="Upcoming deadlines"
          subtitle="Content due in the next two weeks"
          actions={
            <Button size="sm" onClick={() => navigate({ name: 'calendar' })}>
              Open calendar
            </Button>
          }
        >
          {stats.upcoming.length === 0 ? (
            <p className="muted">Nothing due in the next two weeks.</p>
          ) : (
            <ul className="deadline-list">
              {stats.upcoming.map((d) => (
                <li
                  key={d.item.id}
                  className={`deadline-item${d.overdue ? ' overdue' : ''}`}
                  onClick={() => setSelected(d.item.projectId)}
                >
                  <span
                    className="deadline-date"
                    style={{ color: d.overdue ? '#ef4444' : STATUS_COLORS[d.item.status] }}
                  >
                    {formatDate(d.dueDate).replace(/, \d{4}$/, '')}
                  </span>
                  <span className="deadline-body">
                    <span className="deadline-title">{d.item.title}</span>
                    <span className="deadline-meta">
                      {d.project?.name} &middot; {d.item.platform}
                    </span>
                  </span>
                  <span className={`deadline-left${d.overdue ? ' negative' : ''}`}>
                    {d.overdue
                      ? `${Math.abs(d.daysLeft)}d overdue`
                      : d.daysLeft === 0
                        ? 'due today'
                        : `${d.daysLeft}d left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section
        title="Selected project overview"
        subtitle="Switch between projects to inspect the plan"
        actions={
          <select
            className="input input-sm"
            value={project?.id ?? ''}
            onChange={(e) => setSelected(e.target.value)}
          >
            {state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        }
      >
        {project && (
          <div className="project-overview">
            <div className="overview-main">
              <div className="overview-title">
                <span className="project-dot" style={{ background: project.color }} />
                <h3>{project.name}</h3>
                <span
                  className="badge"
                  style={{
                    color: PROJECT_STATUS_COLORS[project.status],
                    background: `${PROJECT_STATUS_COLORS[project.status]}1a`,
                  }}
                >
                  {project.status}
                </span>
              </div>
              <p className="overview-description">{project.description}</p>
              <div className="overview-meta">
                <span>
                  <strong>Window:</strong> {formatDate(project.startDate)} -{' '}
                  {formatDate(project.endDate)}
                </span>
                <span>
                  <strong>Content:</strong> {projectSummary?.itemCount ?? 0}
                </span>
                <span>
                  <strong>Tasks:</strong> {projectSummary?.taskCount ?? 0} (
                  {projectSummary?.doneTasks ?? 0} done)
                </span>
              </div>
              <div className="overview-progress">
                <ProgressBar value={projectSummary?.progress ?? 0} label />
                <span className="muted">project progress</span>
              </div>
              <div className="overview-actions">
                <Button size="sm" onClick={() => navigate({ name: 'project', id: project.id, tab: 'overview' })}>
                  Open project
                </Button>
                <Button size="sm" variant="primary" onClick={() => navigate({ name: 'project', id: project.id, tab: 'gantt' })}>
                  View Gantt
                </Button>
              </div>
            </div>

            <div className="overview-side">
              <h4>Content by status</h4>
              <ul className="status-tally">
                {Array.from(new Set(projectItems.map((i) => i.status))).map((status) => (
                  <li key={status}>
                    <StatusBadge status={status} />
                    <span className="tally-count">
                      {projectItems.filter((i) => i.status === status).length}
                    </span>
                  </li>
                ))}
                {projectItems.length === 0 && <li className="muted">No content items yet.</li>}
              </ul>

              <h4>Milestones</h4>
              {milestones.length === 0 ? (
                <p className="muted">No milestones defined.</p>
              ) : (
                <ul className="milestone-list">
                  {milestones.map((m) => (
                    <li key={m.id} className={m.progress >= 100 ? 'done' : ''}>
                      <span className="milestone-diamond" />
                      <span className="milestone-name">{m.name}</span>
                      <span className="milestone-date">{formatDate(m.startDate)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <h4>Team</h4>
              <div className="avatar-row">
                {state.resources.map((r) => (
                  <Avatar key={r.id} resource={r} />
                ))}
              </div>
            </div>
          </div>
        )}
      </Section>

      <div className="project-card-grid">
        {summaries.map((s) => (
          <button
            key={s.project.id}
            type="button"
            className="project-card"
            onClick={() => {
              setSelected(s.project.id);
              navigate({ name: 'project', id: s.project.id, tab: 'overview' });
            }}
          >
            <div className="project-card-head">
              <span className="project-dot" style={{ background: s.project.color }} />
              <span
                className="badge"
                style={{
                  color: PROJECT_STATUS_COLORS[s.project.status],
                  background: `${PROJECT_STATUS_COLORS[s.project.status]}1a`,
                }}
              >
                {s.project.status}
              </span>
            </div>
            <h3>{s.project.name}</h3>
            <p className="project-card-dates">
              {formatDate(s.project.startDate)} - {formatDate(s.project.endDate)}
            </p>
            <ProgressBar value={s.progress} />
            <div className="project-card-stats">
              <span>{s.itemCount} content items</span>
              <span>
                {s.doneTasks}/{s.taskCount} tasks done
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
