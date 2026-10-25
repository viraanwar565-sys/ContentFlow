import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Project, Task } from '../../types';
import { useStore } from '../../store/store';
import { calendarFor, projectTasks } from '../../utils/selectors';
import { taskEndISO } from '../../utils/scheduling';
import { computeCriticalPath } from '../../utils/criticalPath';
import { STATUS_COLORS } from '../../constants';
import { Button } from '../../components/ui';
import { TaskFormModal } from '../../components/forms';
import {
  addDays,
  addMonths,
  diffDays,
  endOfMonth,
  formatDate,
  formatMonthYear,
  formatShortDate,
  startOfMonth,
} from '../../utils/dates';
import { dayIndex, isWorkingDay } from '../../utils/workingDays';

type Zoom = 'day' | 'week' | 'month';

const PX_PER_DAY: Record<Zoom, number> = { day: 44, week: 15, month: 5 };
const ROW_H = 32;
const HEADER_H = 54;
const LEFT_WIDTH = 340;

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Row {
  task: Task;
  depth: number;
  hasChildren: boolean;
}

function flatten(tasks: Task[], collapsed: Set<string>): Row[] {
  const byParent = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const list = byParent.get(t.parentId);
    if (list) list.push(t);
    else byParent.set(t.parentId, [t]);
  }
  const out: Row[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const t of byParent.get(parentId) ?? []) {
      const kids = byParent.get(t.id) ?? [];
      out.push({ task: t, depth, hasChildren: kids.length > 0 });
      if (kids.length > 0 && !collapsed.has(t.id)) walk(t.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function GanttTab({ project }: { project: Project }) {
  const { state, today } = useStore();
  const [zoom, setZoom] = useState<Zoom>('week');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const leftRowsRef = useRef<HTMLDivElement>(null);

  const cal = useMemo(() => calendarFor(project), [project]);
  const tasks = useMemo(() => projectTasks(state, project.id), [state, project.id]);
  const cpm = useMemo(() => computeCriticalPath(tasks, cal), [tasks, cal]);
  const criticalSet = useMemo(() => new Set(cpm.criticalIds), [cpm]);
  const rows = useMemo(() => flatten(tasks, collapsed), [tasks, collapsed]);

  const range = useMemo(() => {
    let min = project.startDate;
    let max = project.endDate;
    for (const t of tasks) {
      const end = taskEndISO(t, cal);
      if (t.startDate < min) min = t.startDate;
      if (end > max) max = end;
    }
    if (today < min) min = today;
    if (today > max) max = today;
    const start = addDays(min, -7);
    const end = addDays(max, 14);
    return { start, end, totalDays: diffDays(start, end) + 1 };
  }, [tasks, project.startDate, project.endDate, today, cal]);

  const px = PX_PER_DAY[zoom];
  const totalWidth = range.totalDays * px;
  const rowsHeight = Math.max(rows.length * ROW_H, 120);
  const gridStep = (zoom === 'day' ? 1 : 7) * px;

  const xOf = (iso: string) => dayIndex(iso, range.start) * px;

  // Day cells (header + non-working shading).
  const dayCells = useMemo(() => {
    const cells: { date: string; index: number; working: boolean; weekend: boolean }[] = [];
    for (let i = 0; i < range.totalDays; i++) {
      const date = addDays(range.start, i);
      const dow = new Date(`${date}T00:00:00`).getDay();
      cells.push({ date, index: i, working: isWorkingDay(date, cal), weekend: dow === 0 || dow === 6 });
    }
    return cells;
  }, [range, cal]);

  const months = useMemo(() => {
    const list: { label: string; x: number; width: number }[] = [];
    let cur = startOfMonth(range.start);
    const last = range.end;
    let guard = 0;
    while (cur <= last && guard++ < 240) {
      const from = dayIndex(cur, range.start);
      const to = dayIndex(endOfMonth(cur), range.start);
      const x = from * px;
      const width = (to - from + 1) * px;
      if (x + width > 0 && x < totalWidth) {
        list.push({ label: formatMonthYear(cur), x, width });
      }
      cur = addMonths(cur, 1);
    }
    return list;
  }, [range, px, totalWidth]);

  // Week cells for the week/month zoom header.
  const weekCells = useMemo(() => {
    const list: { date: string; x: number; width: number }[] = [];
    let cur = range.start;
    let guard = 0;
    while (cur <= range.end && guard++ < 400) {
      list.push({ date: cur, x: dayIndex(cur, range.start) * px, width: 7 * px });
      cur = addDays(cur, 7);
    }
    return list;
  }, [range, px]);

  const rowsByIndex = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r, i) => map.set(r.task.id, i));
    return map;
  }, [rows]);

  const todayX = xOf(today);

  const syncScroll = () => {
    if (leftRowsRef.current && rightRef.current) {
      leftRowsRef.current.scrollTop = rightRef.current.scrollTop;
    }
  };

  const scrollToToday = () => {
    const el = rightRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, xOf(today) - el.clientWidth / 2);
  };

  useEffect(() => {
    scrollToToday();
    // Re-center when the zoom level changes.
  }, [zoom]);

  useEffect(() => {
    scrollToToday();
  }, []);

  const toggleRow = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => {
    const parents = new Set(tasks.filter((t) => tasks.some((c) => c.parentId === t.id)).map((t) => t.id));
    setCollapsed(parents);
  };

  const editTask = editTaskId ? tasks.find((t) => t.id === editTaskId) : undefined;

  // -------------------------------------------------------------- dependency edges
  interface Edge {
    d: string;
    label: string;
    critical: boolean;
    type: string;
  }

  const edges: Edge[] = [];
  for (const row of rows) {
    const succIndex = rowsByIndex.get(row.task.id);
    if (succIndex === undefined) continue;
    const succEnd = taskEndISO(row.task, cal);
    const sTop = succIndex * ROW_H + ROW_H / 2;
    const sLeft = xOf(row.task.startDate);
    const sRight = xOf(succEnd) + px;
    for (const dep of row.task.dependencies) {
      const predIndex = rowsByIndex.get(dep.predecessorId);
      if (predIndex === undefined) continue;
      const predRow = rows[predIndex];
      const predEnd = taskEndISO(predRow.task, cal);
      const pTop = predIndex * ROW_H + ROW_H / 2;
      const pLeft = xOf(predRow.task.startDate);
      const pRight = xOf(predEnd) + px;
      let d = '';
      if (dep.type === 'FS') {
        const gap = sLeft - pRight;
        const midX = gap > 8 ? pRight + gap / 2 : pRight + 4;
        d = `M ${pRight} ${pTop} L ${midX} ${pTop} L ${midX} ${sTop} L ${sLeft} ${sTop}`;
      } else if (dep.type === 'SS') {
        const sx = Math.max(2, pLeft - 10);
        d = `M ${pLeft} ${pTop} L ${sx} ${pTop} L ${sx} ${sTop} L ${sLeft} ${sTop}`;
      } else if (dep.type === 'FF') {
        const ex = Math.max(pRight + 10, sRight + 10);
        d = `M ${pRight} ${pTop} L ${ex} ${pTop} L ${ex} ${sTop} L ${sRight} ${sTop}`;
      } else {
        const sx = Math.max(2, pLeft - 10);
        const ex = sRight + 10;
        d = `M ${pLeft} ${pTop} L ${sx} ${pTop} L ${sx} ${sTop} L ${ex} ${sTop} L ${sRight} ${sTop}`;
      }
      edges.push({
        d,
        label: `${dep.type}${dep.lag ? ` +${dep.lag}d` : ''}: ${predRow.task.name} -> ${row.task.name}`,
        critical: criticalSet.has(predRow.task.id) && criticalSet.has(row.task.id),
        type: dep.type,
      });
    }
  }

  const edgeDash: Record<string, string> = { FS: '', SS: '5 3', FF: '2 3', SF: '8 3 2 3' };

  return (
    <div className="gantt">
      <div className="gantt-toolbar">
        <div className="segmented">
          {(['day', 'week', 'month'] as Zoom[]).map((z) => (
            <button
              key={z}
              type="button"
              className={`segment${zoom === z ? ' active' : ''}`}
              onClick={() => setZoom(z)}
            >
              {z[0].toUpperCase() + z.slice(1)}
            </button>
          ))}
        </div>
        <Button size="sm" variant="primary" onClick={scrollToToday}>
          Today
        </Button>
        <Button size="sm" onClick={expandAll}>
          Expand all
        </Button>
        <Button size="sm" onClick={collapseAll}>
          Collapse all
        </Button>
        <span className="gantt-range muted small">
          {formatDate(range.start)} &rarr; {formatDate(range.end)} &middot;{' '}
          {cpm.durationWorkingDays} working days on the critical path
        </span>
      </div>

      <div className="gantt-body">
        <div className="gantt-left" style={{ width: LEFT_WIDTH }}>
          <div className="gantt-left-header" style={{ height: HEADER_H }}>
            <span>Task</span>
            <span className="muted">Dur</span>
          </div>
          <div className="gantt-left-scroll" ref={leftRowsRef}>
            <div style={{ height: rowsHeight, position: 'relative' }}>
              {rows.map((row, i) => {
                const hasKids = row.hasChildren;
                const isCollapsed = collapsed.has(row.task.id);
                return (
                  <div
                    key={row.task.id}
                    className={`gantt-left-row${criticalSet.has(row.task.id) ? ' critical' : ''}`}
                    style={{ height: ROW_H, top: i * ROW_H, paddingLeft: 10 + row.depth * 16 }}
                  >
                    <button
                      type="button"
                      className={`expander${hasKids ? '' : ' empty'}`}
                      onClick={() => hasKids && toggleRow(row.task.id)}
                    >
                      {hasKids ? (isCollapsed ? '▸' : '▾') : '·'}
                    </button>
                    <span
                      className="gantt-left-name"
                      title={`${row.task.name} - ${row.task.status}`}
                      onClick={() => setEditTaskId(row.task.id)}
                    >
                      {row.task.isMilestone && <span className="milestone-diamond tiny" />}
                      {row.task.name}
                    </span>
                    <span className="gantt-left-dur">
                      {row.task.isMilestone ? 'MS' : `${row.task.duration}d`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="gantt-right" ref={rightRef} onScroll={syncScroll}>
          <div className="gantt-canvas" style={{ width: totalWidth }}>
            <div className="gantt-header" style={{ height: HEADER_H }}>
              <div className="gantt-month-row">
                {months.map((m) => (
                  <div
                    key={`${m.label}-${m.x}`}
                    className="gantt-month"
                    style={{ left: m.x, width: m.width }}
                  >
                    {m.width > 60 ? m.label : ''}
                  </div>
                ))}
              </div>
              <div className="gantt-unit-row">
                {zoom === 'day' &&
                  dayCells.map((cell) => (
                    <div
                      key={cell.date}
                      className={`gantt-day${cell.working ? '' : ' non-working'}${cell.date === today ? ' today' : ''}`}
                      style={{ left: cell.index * px, width: px }}
                    >
                      <span className="gantt-day-letter">{WEEKDAY_LETTERS[new Date(`${cell.date}T00:00:00`).getDay()]}</span>
                      <span className="gantt-day-number">{Number(cell.date.slice(8, 10))}</span>
                    </div>
                  ))}
                {zoom !== 'day' &&
                  weekCells.map((w) => (
                    <div
                      key={w.date}
                      className={`gantt-week${zoom === 'month' ? ' tick' : ''}`}
                      style={{ left: w.x, width: w.width }}
                    >
                      {zoom === 'week' && <span>{formatShortDate(w.date)}</span>}
                    </div>
                  ))}
              </div>
              <div className="gantt-today-flag" style={{ left: todayX }}>
                Today
              </div>
            </div>

            <div
              className="gantt-rows"
              style={{
                height: rowsHeight,
                backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent ${gridStep - 1}px, #eef2f7 ${gridStep - 1}px, #eef2f7 ${gridStep}px)`,
              }}
            >
              {/* Non-working day shading */}
              {dayCells
                .filter((c) => !c.working)
                .map((c) => (
                  <div
                    key={`shade-${c.date}`}
                    className={`gantt-shade${c.weekend ? '' : ' holiday'}`}
                    style={{ left: c.index * px, width: px }}
                  />
                ))}

              {/* Row backgrounds */}
              {rows.map((row, i) => (
                <div
                  key={`bg-${row.task.id}`}
                  className="gantt-row-bg"
                  style={{ top: i * ROW_H, height: ROW_H }}
                />
              ))}

              {/* Today line */}
              <div className="gantt-today-line" style={{ left: todayX }} />

              {/* Bars */}
              {rows.map((row, i) => {
                const t = row.task;
                const end = taskEndISO(t, cal);
                const critical = criticalSet.has(t.id);
                const color = STATUS_COLORS[t.status];
                const top = i * ROW_H + 5;
                if (t.isMilestone) {
                  const cx = xOf(t.startDate) + px / 2;
                  return (
                    <div key={t.id} className="gantt-milestone-wrap" style={{ top: i * ROW_H }}>
                      <button
                        type="button"
                        className={`gantt-milestone${critical ? ' critical' : ''}`}
                        style={{ left: cx - 7 }}
                        title={`${t.name} (milestone) - ${formatDate(t.startDate)} - ${t.status}`}
                        onClick={() => setEditTaskId(t.id)}
                      />
                      <span
                        className="gantt-milestone-label"
                        style={{ left: cx + 12 }}
                        onClick={() => setEditTaskId(t.id)}
                      >
                        {t.name}
                      </span>
                    </div>
                  );
                }
                const x = xOf(t.startDate);
                const width = Math.max(px, xOf(end) + px - x);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`gantt-bar${critical ? ' critical' : ''}`}
                    style={{ left: x, width, top, height: ROW_H - 10, '--bar-color': color } as CSSProperties}
                    title={`${t.name}\n${formatDate(t.startDate)} - ${formatDate(end)}\n${t.duration} working days - ${t.progress}% - ${t.status}`}
                    onClick={() => setEditTaskId(t.id)}
                  >
                    <span
                      className="gantt-bar-progress"
                      style={{ width: `${Math.max(0, Math.min(100, t.progress))}%`, background: color }}
                    />
                    {width > 70 && <span className="gantt-bar-label">{t.name}</span>}
                  </button>
                );
              })}

              {/* Dependency arrows */}
              <svg className="gantt-edges" width={totalWidth} height={rowsHeight}>
                <defs>
                  <marker id="gantt-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M 0 0 L 8 4 L 0 8 z" fill="#64748b" />
                  </marker>
                  <marker id="gantt-arrow-critical" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M 0 0 L 8 4 L 0 8 z" fill="#ef4444" />
                  </marker>
                </defs>
                {edges.map((e, i) => (
                  <path
                    key={`${e.label}-${i}`}
                    d={e.d}
                    fill="none"
                    stroke={e.critical ? '#ef4444' : '#64748b'}
                    strokeWidth={1.4}
                    strokeDasharray={edgeDash[e.type]}
                    markerEnd={e.critical ? 'url(#gantt-arrow-critical)' : 'url(#gantt-arrow)'}
                  >
                    <title>{e.label}</title>
                  </path>
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="gantt-legend">
        <span className="legend-item">
          <span className="legend-swatch non-working" /> non-working day
        </span>
        <span className="legend-item">
          <span className="legend-swatch holiday" /> holiday
        </span>
        <span className="legend-item">
          <span className="legend-line today" /> today
        </span>
        <span className="legend-item">
          <span className="legend-diamond" /> milestone
        </span>
        <span className="legend-item">
          <span className="legend-critical-box" /> critical task (zero float)
        </span>
        <span className="legend-item">
          <svg width="34" height="10">
            <path d="M 1 5 L 30 5" stroke="#64748b" strokeWidth="1.4" markerEnd="url(#gantt-arrow)" />
          </svg>
          FS dependency
        </span>
        <span className="legend-item">
          <svg width="34" height="10">
            <path d="M 1 5 L 30 5" stroke="#64748b" strokeWidth="1.4" strokeDasharray="5 3" />
          </svg>
          SS dependency
        </span>
        <span className="legend-item muted">Click a bar to edit it</span>
        <span className="legend-statuses">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <span key={status} className="legend-item">
              <span className="legend-dot" style={{ background: color }} />
              {status}
            </span>
          ))}
        </span>
      </div>

      {editTask && (
        <TaskFormModal
          projectId={project.id}
          task={editTask}
          onClose={() => setEditTaskId(null)}
        />
      )}
    </div>
  );
}
