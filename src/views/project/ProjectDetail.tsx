import { useEffect } from 'react';
import { useStore } from '../../store/store';
import { Button, EmptyState, ProgressBar } from '../../components/ui';
import { navigate, type ProjectTab } from '../../router';
import { formatDate } from '../../utils/dates';
import { PROJECT_STATUS_COLORS } from '../../constants';
import { OverviewTab } from './OverviewTab';
import { ContentTab } from './ContentTab';
import { CalendarTab } from './CalendarTab';
import { ProjectResourcesTab } from './ProjectResourcesTab';
import { CriticalPathTab } from './CriticalPathTab';
import { GanttTab } from './GanttTab';
import { projectProgress, projectTasks } from '../../utils/selectors';

const TABS: { id: ProjectTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'content', label: 'Content / Tasks' },
  { id: 'gantt', label: 'Gantt' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'resources', label: 'Resources' },
  { id: 'critical', label: 'Critical Path' },
];

export function ProjectDetail({ projectId, tab }: { projectId: string; tab: ProjectTab }) {
  const { state, setSelectedProjectId } = useStore();
  const project = state.projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (project) setSelectedProjectId(project.id);
  }, [project, setSelectedProjectId]);

  if (!project) {
    return (
      <div className="page">
        <EmptyState
          title="Project not found"
          description="It may have been deleted. Pick another project to continue."
          action={
            <Button variant="primary" onClick={() => navigate({ name: 'projects' })}>
              Back to projects
            </Button>
          }
        />
      </div>
    );
  }

  const tasks = projectTasks(state, project.id);
  const progress = projectProgress(state, project.id);

  const go = (next: ProjectTab) => navigate({ name: 'project', id: project.id, tab: next });

  return (
    <div className="page project-page">
      <header className="project-header">
        <div className="project-header-top">
          <button type="button" className="back-link" onClick={() => navigate({ name: 'projects' })}>
            &#8592; All projects
          </button>
          <div className="project-title-row">
            <span className="project-dot large" style={{ background: project.color }} />
            <h1>{project.name}</h1>
            <span
              className="badge"
              style={{
                color: PROJECT_STATUS_COLORS[project.status],
                background: `${PROJECT_STATUS_COLORS[project.status]}1a`,
                borderColor: `${PROJECT_STATUS_COLORS[project.status]}44`,
              }}
            >
              {project.status}
            </span>
          </div>
          <p className="page-subtitle">
            {formatDate(project.startDate)} &rarr; {formatDate(project.endDate)} &middot;{' '}
            {tasks.length} tasks &middot; working days:{' '}
            {project.workingDays
              .slice()
              .sort((a, b) => a - b)
              .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
              .join(', ')}
            {project.holidays.length > 0 && ` · ${project.holidays.length} holiday(s)`}
          </p>
        </div>
        <div className="project-header-progress">
          <span className="muted small">Project progress</span>
          <ProgressBar value={progress} label />
        </div>
      </header>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => go(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {tab === 'overview' && <OverviewTab project={project} onOpenTab={go} />}
        {tab === 'content' && <ContentTab project={project} />}
        {tab === 'gantt' && <GanttTab project={project} />}
        {tab === 'calendar' && <CalendarTab project={project} />}
        {tab === 'resources' && <ProjectResourcesTab project={project} />}
        {tab === 'critical' && <CriticalPathTab project={project} />}
      </div>
    </div>
  );
}
