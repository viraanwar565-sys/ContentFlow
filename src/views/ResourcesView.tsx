import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { computeResourceWorkloads } from '../utils/stats';
import { formatDate } from '../utils/dates';
import { Avatar, Button, EmptyState, ProgressBar, Section, StatusBadge } from '../components/ui';
import { ResourceFormModal } from '../components/forms';

export function ResourcesView() {
  const { state, removeResource, notify } = useStore();
  const workloads = useMemo(() => computeResourceWorkloads(state), [state]);
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const maxDays = Math.max(1, ...workloads.map((w) => w.workloadDays));

  const handleRemove = (id: string, name: string) => {
    const ok = window.confirm(
      `Remove ${name} from the team? Their tasks will become unassigned.`,
    );
    if (!ok) return;
    removeResource(id);
    notify(`${name} removed.`, 'info');
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Resources</h1>
          <p className="page-subtitle">
            Content production roles, assignments and workload across all projects.
          </p>
        </div>
        <div className="page-header-actions">
          <Button variant="primary" onClick={() => setShowForm(true)}>
            + Add resource
          </Button>
        </div>
      </header>

      {workloads.length === 0 ? (
        <EmptyState
          title="No resources yet"
          description="Add the people (or roles) who brief, write, design, film, edit, review and publish content."
          action={
            <Button variant="primary" onClick={() => setShowForm(true)}>
              Add a resource
            </Button>
          }
        />
      ) : (
        <>
          <div className="resource-grid">
            {workloads.map((w) => {
              const open = openId === w.resource.id;
              return (
                <div key={w.resource.id} className={`resource-card${open ? ' open' : ''}`}>
                  <button
                    type="button"
                    className="resource-card-head"
                    onClick={() => setOpenId(open ? null : w.resource.id)}
                  >
                    <Avatar resource={w.resource} size={40} />
                    <div className="resource-ident">
                      <strong>{w.resource.name}</strong>
                      <span className="muted">{w.resource.role}</span>
                    </div>
                    <span className="resource-chevron">{open ? '⌃' : '⌄'}</span>
                  </button>

                  <div className="resource-stats">
                    <div className="resource-stat">
                      <span className="resource-stat-value">{w.assignedTasks.length}</span>
                      <span className="resource-stat-label">assigned</span>
                    </div>
                    <div className="resource-stat">
                      <span className="resource-stat-value">{w.openTasks.length}</span>
                      <span className="resource-stat-label">open</span>
                    </div>
                    <div className="resource-stat">
                      <span className="resource-stat-value">{w.workloadDays}</span>
                      <span className="resource-stat-label">workload days</span>
                    </div>
                    <div className="resource-stat">
                      <span className="resource-stat-value">{w.completionPct}%</span>
                      <span className="resource-stat-label">complete</span>
                    </div>
                  </div>

                  <div className="resource-workload-bar" title={`${w.workloadDays} open working days`}>
                    <div
                      className="resource-workload-fill"
                      style={{
                        width: `${Math.round((w.workloadDays / maxDays) * 100)}%`,
                        background: w.resource.color,
                      }}
                    />
                  </div>

                  <div className="resource-card-actions">
                    <Button size="sm" onClick={() => setOpenId(open ? null : w.resource.id)}>
                      {open ? 'Hide tasks' : 'Show tasks'}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleRemove(w.resource.id, w.resource.name)}>
                      Remove
                    </Button>
                  </div>

                  {open && (
                    <div className="resource-tasks">
                      {w.assignedTasks.length === 0 ? (
                        <p className="muted">No tasks assigned yet.</p>
                      ) : (
                        <ul>
                          {w.assignedTasks.map((t) => {
                            const project = state.projects.find((p) => p.id === t.projectId);
                            const item = state.contentItems.find((i) => i.id === t.contentItemId);
                            return (
                              <li key={t.id}>
                                <span className="resource-task-name">
                                  {t.name}
                                  {item && <span className="muted small"> &middot; {item.title}</span>}
                                </span>
                                <span className="resource-task-meta">
                                  <span className="muted small">{project?.name}</span>
                                  <StatusBadge status={t.status} />
                                  <span className="muted small nowrap">{formatDate(t.startDate)}</span>
                                </span>
                                <ProgressBar value={t.progress} />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Section title="Workload comparison" subtitle="Open working days per resource">
            <ul className="workload-bars">
              {workloads.map((w) => (
                <li key={w.resource.id}>
                  <span className="workload-name">{w.resource.name}</span>
                  <div className="workload-track">
                    <div
                      className="workload-fill"
                      style={{
                        width: `${Math.round((w.workloadDays / maxDays) * 100)}%`,
                        background: w.resource.color,
                      }}
                    />
                  </div>
                  <span className="workload-value">{w.workloadDays}d</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Assignments by project" subtitle="Where the team is spending time">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Resource</th>
                    <th>Projects</th>
                    <th>Assigned</th>
                    <th>Open</th>
                    <th>Workload days</th>
                    <th>Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {workloads.map((w) => (
                    <tr key={w.resource.id}>
                      <td>
                        <span className="resource-inline">
                          <Avatar resource={w.resource} size={22} />
                          {w.resource.name}
                        </span>
                      </td>
                      <td className="muted">{w.projectNames.join(', ') || '-'}</td>
                      <td>{w.assignedTasks.length}</td>
                      <td>{w.openTasks.length}</td>
                      <td>{w.workloadDays}d</td>
                      <td style={{ minWidth: 140 }}>
                        <ProgressBar value={w.completionPct} label />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">
              Workload days count the remaining working days of open assigned tasks. Open a
              resource card above to see every task.
            </p>
          </Section>
        </>
      )}

      {showForm && <ResourceFormModal onClose={() => setShowForm(false)} />}
    </div>
  );
}
