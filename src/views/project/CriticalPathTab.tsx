import { useMemo } from 'react';
import type { Project } from '../../types';
import { useStore } from '../../store/store';
import { Button, EmptyState, Section, StatCard } from '../../components/ui';
import { calendarFor, projectTasks } from '../../utils/selectors';
import { computeCriticalPath } from '../../utils/criticalPath';
import { dateFromWorkOrdinal } from '../../utils/workingDays';
import { diffDays, formatDate } from '../../utils/dates';
import { navigate } from '../../router';

export function CriticalPathTab({ project }: { project: Project }) {
  const { state } = useStore();
  const cal = calendarFor(project);
  const tasks = useMemo(() => projectTasks(state, project.id), [state, project.id]);
  const cpm = useMemo(() => computeCriticalPath(tasks, cal), [tasks, cal]);

  if (tasks.length === 0) {
    return (
      <div className="page">
        <EmptyState
          title="No tasks to analyze"
          description="Add production tasks and dependencies to compute a critical path."
          action={
            <Button variant="primary" onClick={() => navigate({ name: 'project', id: project.id, tab: 'content' })}>
              Add tasks
            </Button>
          }
        />
      </div>
    );
  }

  const leafTasks = tasks.filter(
    (t) => !tasks.some((child) => child.parentId === t.id),
  );
  const rows = leafTasks
    .map((t) => ({
      task: t,
      es: cpm.earliestStart[t.id],
      ef: cpm.earliestEnd[t.id],
      ls: cpm.latestStart[t.id],
      lf: cpm.latestEnd[t.id],
      float: cpm.floats[t.id],
      critical: (cpm.floats[t.id] ?? 0) <= 0,
    }))
    .filter((r) => r.es !== undefined)
    .sort((a, b) => a.es - b.es);

  const calendarDays =
    cpm.projectStart && cpm.projectEnd ? diffDays(cpm.projectStart, cpm.projectEnd) + 1 : 0;

  const pathNames = cpm.orderedPath
    .map((id) => tasks.find((t) => t.id === id)?.name)
    .filter(Boolean) as string[];

  return (
    <div className="critical-tab">
      <div className="stat-grid">
        <StatCard
          label="Project duration"
          value={`${cpm.durationWorkingDays} working days`}
          hint={`~${calendarDays} calendar days`}
          accent="#ef4444"
        />
        <StatCard
          label="Earliest start"
          value={cpm.projectStart ? formatDate(cpm.projectStart) : '-'}
          hint="First working day of the plan"
          accent="#6366f1"
        />
        <StatCard
          label="Earliest finish"
          value={cpm.projectEnd ? formatDate(cpm.projectEnd) : '-'}
          hint="Last task on the longest chain"
          accent="#0ea5e9"
        />
        <StatCard
          label="Critical tasks"
          value={cpm.criticalIds.length}
          hint="Zero total float"
          accent="#f59e0b"
        />
      </div>

      <Section
        title="Critical path"
        subtitle="The longest chain of dependent work - any delay here delays the whole project"
        actions={
          <Button size="sm" variant="primary" onClick={() => navigate({ name: 'project', id: project.id, tab: 'gantt' })}>
            Show on Gantt
          </Button>
        }
      >
        {pathNames.length === 0 ? (
          <p className="muted">No critical chain could be determined.</p>
        ) : (
          <ol className="critical-path-chain">
            {pathNames.map((name, index) => (
              <li key={`${name}-${index}`}>
                <span className="chain-chip">{name}</span>
                {index < pathNames.length - 1 && <span className="chain-arrow">&rarr;</span>}
              </li>
            ))}
          </ol>
        )}
        <p className="muted small">
          Critical tasks have zero float: they cannot slip by a single working day without moving
          the finish date. Float is measured in working days and respects this project&apos;s
          working days and holidays.
        </p>
      </Section>

      <Section
        title="Forward / backward pass"
        subtitle="Earliest and latest dates plus total float for every task"
      >
        <div className="table-wrap">
          <table className="table table-compact">
            <thead>
              <tr>
                <th>Task</th>
                <th>Type</th>
                <th>Early start</th>
                <th>Early finish</th>
                <th>Late start</th>
                <th>Late finish</th>
                <th>Float (wd)</th>
                <th>Critical</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.task.id} className={r.critical ? 'row-critical' : ''}>
                  <td>
                    <strong>{r.task.name}</strong>
                    {r.task.contentItemId && (
                      <span className="muted small">
                        {' '}
                        &middot;{' '}
                        {state.contentItems.find((i) => i.id === r.task.contentItemId)?.title}
                      </span>
                    )}
                  </td>
                  <td className="muted">
                    {r.task.isMilestone ? 'Milestone' : `${r.task.duration}d`}
                  </td>
                  <td className="nowrap">{dateFromWorkOrdinal(r.es, cal)}</td>
                  <td className="nowrap">{dateFromWorkOrdinal(r.ef, cal)}</td>
                  <td className="nowrap">{dateFromWorkOrdinal(r.ls, cal)}</td>
                  <td className="nowrap">{dateFromWorkOrdinal(r.lf, cal)}</td>
                  <td>
                    <span className={`float-pill${r.critical ? ' zero' : ''}`}>
                      {r.float ?? '-'}
                    </span>
                  </td>
                  <td>{r.critical ? <span className="critical-flag">CRITICAL</span> : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Summary (parent) rows are omitted: they span their subtasks and inherit the minimum
          float of their children.
        </p>
      </Section>

      <Section title="Method" subtitle="How ContentFlow computes the critical path">
        <ol className="method-list">
          <li>
            <strong>Forward pass:</strong> earliest start = the latest constraint imposed by all
            predecessors (Finish&rarr;Start, Start&rarr;Start, Finish&rarr;Finish,
            Start&rarr;Finish, plus lag in working days).
          </li>
          <li>
            <strong>Backward pass:</strong> latest finish is pulled back from the project end
            through every successor constraint.
          </li>
          <li>
            <strong>Float:</strong> late start &minus; early start, in working days. Tasks with
            zero float are critical.
          </li>
          <li>
            <strong>Working days:</strong> all arithmetic runs on working-day ordinals, so
            weekends and holidays are never counted.
          </li>
        </ol>
      </Section>
    </div>
  );
}
