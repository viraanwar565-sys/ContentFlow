import { useMemo, useState } from 'react';
import type { Project } from '../../types';
import { useStore } from '../../store/store';
import { Button, Section } from '../../components/ui';
import { HolidayEditor } from '../../components/forms';
import { calendarFor } from '../../utils/selectors';
import { isWorkingDay } from '../../utils/workingDays';
import {
  addMonths,
  formatDate,
  formatMonthYear,
  isSameDay,
  monthGrid,
  startOfMonth,
  todayISO,
} from '../../utils/dates';
import { taskEndISO } from '../../utils/scheduling';
import { PLATFORM_COLORS } from '../../constants';

export function CalendarTab({ project }: { project: Project }) {
  const { state, updateProject, today } = useStore();
  const [viewDate, setViewDate] = useState(() => startOfMonth(project.startDate));
  const cal = useMemo(() => calendarFor(project), [project]);
  const storeTasks = useMemo(
    () => state.tasks.filter((t) => t.projectId === project.id),
    [state.tasks, project.id],
  );
  const storeItems = useMemo(
    () => state.contentItems.filter((i) => i.projectId === project.id),
    [state.contentItems, project.id],
  );
  const cells = monthGrid(viewDate);

  const toggleDay = (day: number) => {
    const has = project.workingDays.includes(day);
    const next = has
      ? project.workingDays.filter((d) => d !== day)
      : [...project.workingDays, day].sort((a, b) => a - b);
    if (next.length === 0) {
      window.alert('A project needs at least one working day.');
      return;
    }
    updateProject(project.id, { workingDays: next });
  };

  const holidayFor = (date: string) => project.holidays.find((h) => h.date === date);

  return (
    <div className="calendar-tab">
      <div className="grid-2">
        <Section
          title="Working days"
          subtitle="Durations, dependency lag and the critical path only count these days"
        >
          <div className="weekday-picker">
            {[
              { d: 1, label: 'Monday' },
              { d: 2, label: 'Tuesday' },
              { d: 3, label: 'Wednesday' },
              { d: 4, label: 'Thursday' },
              { d: 5, label: 'Friday' },
              { d: 6, label: 'Saturday' },
              { d: 0, label: 'Sunday' },
            ].map(({ d, label }) => (
              <button
                key={d}
                type="button"
                className={`weekday-chip${project.workingDays.includes(d) ? ' active' : ''}`}
                onClick={() => toggleDay(d)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="field-hint">
            Changing working days re-normalizes every date in this project and re-checks all
            dependencies.
          </p>
        </Section>

        <Section
          title="Holidays"
          subtitle="Non-working dates that push the schedule forward"
        >
          <HolidayEditor project={project} />
        </Section>
      </div>

      <Section
        title="Production calendar"
        subtitle={`${formatMonthYear(viewDate)} - tasks finishing and content publishing`}
        actions={
          <div className="calendar-nav">
            <Button size="sm" onClick={() => setViewDate((d) => addMonths(d, -1))}>
              &#8249;
            </Button>
            <span className="calendar-month-label">{formatMonthYear(viewDate)}</span>
            <Button size="sm" onClick={() => setViewDate((d) => addMonths(d, 1))}>
              &#8250;
            </Button>
            <Button size="sm" variant="primary" onClick={() => setViewDate(startOfMonth(today))}>
              Today
            </Button>
          </div>
        }
      >
        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="calendar-weekday">
              {d}
            </div>
          ))}
          {cells.map((date) => {
            const working = isWorkingDay(date, cal);
            const holiday = holidayFor(date);
            const dayTasks = storeTasks.filter(
              (t) => !t.isMilestone && taskEndISO(t, cal) === date,
            );
            const dayMilestones = storeTasks.filter((t) => t.isMilestone && t.startDate === date);
            const dayItems = storeItems.filter((i) => i.endDate === date);
            const classes = [
              'calendar-cell',
              date.startsWith(viewDate.slice(0, 7)) ? '' : 'outside',
              working ? '' : 'non-working',
              isSameDay(date, today) ? 'today' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div key={date} className={classes} title={holiday ? holiday.name : undefined}>
                <div className="calendar-day-number">
                  {Number(date.slice(8, 10))}
                  {isSameDay(date, today) && <span className="today-pill">Today</span>}
                  {holiday && <span className="holiday-pill">{holiday.name}</span>}
                </div>
                {dayItems.map((item) => (
                  <span
                    key={item.id}
                    className="calendar-chip static"
                    style={{
                      borderLeftColor: PLATFORM_COLORS[item.platform],
                      background: 'rgba(59,130,246,0.12)',
                      color: '#1d4ed8',
                    }}
                  >
                    <span className="chip-title">{item.title}</span>
                    <span className="chip-meta">publishes &middot; {item.platform}</span>
                  </span>
                ))}
                {dayMilestones.map((m) => (
                  <span key={m.id} className="calendar-milestone" title={m.name}>
                    ◆ {m.name}
                  </span>
                ))}
                {dayTasks.slice(0, 3).map((t) => (
                  <span key={t.id} className="calendar-task" title={t.name}>
                    {t.name}
                  </span>
                ))}
                {dayTasks.length > 3 && (
                  <span className="muted small">+{dayTasks.length - 3} more</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="calendar-legend">
          <span className="legend-item">
            <span className="legend-swatch working" /> working day
          </span>
          <span className="legend-item">
            <span className="legend-swatch non-working" /> non-working day
          </span>
          <span className="legend-item">
            <span className="legend-swatch holiday" /> holiday
          </span>
          <span className="legend-item">
            <span className="legend-diamond" /> milestone
          </span>
        </div>
        <p className="muted small">
          Task end dates shown here respect working days: a 2-day task started Friday ends Monday
          when the weekend is non-working. {formatDate(project.startDate)} was the project start.
        </p>
      </Section>
    </div>
  );
}
