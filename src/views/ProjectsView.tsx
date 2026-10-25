import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { projectSummaries } from '../utils/stats';
import { formatDate, formatDayDate } from '../utils/dates';
import { Button, EmptyState, ProgressBar, Section } from '../components/ui';
import { ProjectFormModal } from '../components/forms';
import { navigate } from '../router';
import { PROJECT_STATUS_COLORS } from '../constants';
import type { Project } from '../types';

export function ProjectsView() {
  const { state, deleteProject, setSelectedProjectId, notify, today } = useStore();
  const summaries = useMemo(() => projectSummaries(state), [state]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Project | undefined>(undefined);

  const openCreate = () => {
    setEditing(undefined);
    setShowForm(true);
  };

  const openEdit = (project: Project) => {
    setEditing(project);
    setShowForm(true);
  };

  const confirmDelete = (project: Project) => {
    const items = state.contentItems.filter((i) => i.projectId === project.id).length;
    const ok = window.confirm(
      `Delete "${project.name}"? This removes its ${items} content item(s) and all production tasks. This cannot be undone.`,
    );
    if (!ok) return;
    deleteProject(project.id);
    notify(`Project "${project.name}" deleted.`, 'info');
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="page-subtitle">
            Content production projects, their windows and their progress.
          </p>
        </div>
        <div className="page-header-actions">
          <Button variant="primary" onClick={openCreate}>
            + New project
          </Button>
        </div>
      </header>

      {summaries.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project to start planning content production - briefs, scripts, design, reviews and publishing dates."
          action={
            <Button variant="primary" onClick={openCreate}>
              Create the first project
            </Button>
          }
        />
      ) : (
        <Section title="All projects" subtitle={`${summaries.length} project(s)`}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Window</th>
                  <th>Content</th>
                  <th>Tasks</th>
                  <th style={{ width: 180 }}>Progress</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.project.id}>
                    <td>
                      <button
                        type="button"
                        className="link-cell"
                        onClick={() => {
                          setSelectedProjectId(s.project.id);
                          navigate({ name: 'project', id: s.project.id, tab: 'overview' });
                        }}
                      >
                        <span className="project-dot" style={{ background: s.project.color }} />
                        <span className="link-cell-text">
                          <strong>{s.project.name}</strong>
                          <span className="muted small">{s.project.description.slice(0, 90)}...</span>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          color: PROJECT_STATUS_COLORS[s.project.status],
                          background: `${PROJECT_STATUS_COLORS[s.project.status]}1a`,
                        }}
                      >
                        {s.project.status}
                      </span>
                    </td>
                    <td className="nowrap">
                      {formatDate(s.project.startDate)}
                      <br />
                      <span className="muted small">to {formatDate(s.project.endDate)}</span>
                    </td>
                    <td>{s.itemCount}</td>
                    <td className="nowrap">
                      {s.doneTasks}/{s.taskCount}
                    </td>
                    <td>
                      <ProgressBar value={s.progress} label />
                    </td>
                    <td className="actions-col">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          setSelectedProjectId(s.project.id);
                          navigate({ name: 'project', id: s.project.id, tab: 'gantt' });
                        }}
                      >
                        Gantt
                      </Button>
                      <Button size="sm" onClick={() => openEdit(s.project)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => confirmDelete(s.project)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="Today" subtitle="Context for scheduling decisions">
        <p className="muted">
          Today is {formatDayDate(today)}. Scheduling, durations and the critical path all
          respect each project&apos;s working days and holidays.
        </p>
      </Section>

      {showForm && (
        <ProjectFormModal project={editing} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}
