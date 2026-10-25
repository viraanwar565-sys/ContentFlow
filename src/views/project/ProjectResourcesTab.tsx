import { useMemo } from 'react';
import type { Project } from '../../types';
import { useStore } from '../../store/store';
import { Avatar, EmptyState, ProgressBar, Section } from '../../components/ui';
import { calendarFor, projectTasks } from '../../utils/selectors';
import { projectResourceWorkloads } from '../../utils/stats';
import { formatDate, formatShortDate } from '../../utils/dates';
import { taskEndISO } from '../../utils/scheduling';

export function ProjectResourcesTab({ project }: { project: Project }) {
  const { state } = useStore();
  const rows = useMemo(
    () => projectResourceWorkloads(state, project.id),
    [state, project.id],
  );
  const cal = calendarFor(project);
  const tasks = useMemo(() => projectTasks(state, project.id), [state, project.id]);
  const unassigned = tasks.filter((t) => !t.assigneeId && !t.isMilestone);

  return (
    <div className="project-resources-tab">
      <Section
        title="Resource workload"
        subtitle="Open tasks and remaining working days per person in this project"
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No assignments yet"
            description="Assign resources to tasks from the Content / Tasks tab or the task editor."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>Role</th>
                  <th>Assigned</th>
                  <th>Open</th>
                  <th>Workload days</th>
                  <th style={{ width: 180 }}>Completion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.resource.id}>
                    <td>
                      <span className="resource-inline">
                        <Avatar resource={r.resource} size={24} />
                        <strong>{r.resource.name}</strong>
                      </span>
                    </td>
                    <td className="muted">{r.resource.role}</td>
                    <td>{r.assignedTasks.length}</td>
                    <td>{r.openTasks.length}</td>
                    <td>{r.workloadDays}d</td>
                    <td>
                      <ProgressBar value={r.completionPct} label />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Assignments" subtitle="Every assigned task with dates and progress">
        {rows.length === 0 ? (
          <p className="muted">Nothing assigned yet.</p>
        ) : (
          rows.map((r) => (
            <div key={r.resource.id} className="assignment-group">
              <h4 className="assignment-head">
                <Avatar resource={r.resource} size={24} />
                {r.resource.name}
                <span className="muted small">{r.resource.role}</span>
              </h4>
              <ul className="assignment-list">
                {r.assignedTasks.map((t) => {
                  const item = state.contentItems.find((i) => i.id === t.contentItemId);
                  return (
                    <li key={t.id}>
                      <span className="assignment-name">
                        {t.name}
                        {item && <span className="muted small"> &middot; {item.title}</span>}
                      </span>
                      <span className="muted small nowrap">
                        {formatShortDate(t.startDate)}
                        {' - '}
                        {formatShortDate(taskEndISO(t, cal))}
                      </span>
                      <span className="muted small">
                        {t.isMilestone ? 'milestone' : `${t.duration}d`}
                      </span>
                      <ProgressBar value={t.progress} />
                    </li>
                  );
                })}
                {r.assignedTasks.length === 0 && (
                  <li className="muted small">No tasks in this project.</li>
                )}
              </ul>
            </div>
          ))
        )}
      </Section>

      {unassigned.length > 0 && (
        <Section title="Unassigned tasks" subtitle="Work without an owner">
          <ul className="assignment-list">
            {unassigned.map((t) => (
              <li key={t.id}>
                <span className="assignment-name">{t.name}</span>
                <span className="muted small nowrap">{formatDate(t.startDate)}</span>
                <ProgressBar value={t.progress} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
