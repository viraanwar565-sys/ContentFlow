import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { publicationEntries, type ContentCalendarEntry } from '../utils/stats';
import {
  addMonths,
  formatDate,
  formatMonthYear,
  isSameDay,
  monthGrid,
  startOfMonth,
} from '../utils/dates';
import { Button, Section } from '../components/ui';
import { navigate } from '../router';
import { PLATFORM_COLORS, STATUS_COLORS } from '../constants';

export function ContentCalendarView() {
  const { state, today } = useStore();
  const [viewDate, setViewDate] = useState(() => startOfMonth(today));
  const entries = useMemo(() => publicationEntries(state), [state]);

  const cells = useMemo(() => monthGrid(viewDate), [viewDate]);
  const monthStart = startOfMonth(viewDate);
  const monthEnd = `${viewDate.slice(0, 7)}-31`;

  const monthEntries: ContentCalendarEntry[] = useMemo(() => {
    const list: ContentCalendarEntry[] = [];
    state.contentItems
      .filter((i) => i.endDate >= monthStart && i.endDate <= `${viewDate.slice(0, 7)}-31`)
      .forEach((item) => {
        list.push({
          date: item.endDate,
          item,
          project: state.projects.find((p) => p.id === item.projectId),
        });
      });
    return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [state, monthStart, viewDate, monthEnd]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Content Calendar</h1>
          <p className="page-subtitle">
            Planned content by publication date across every project and platform.
          </p>
        </div>
        <div className="page-header-actions calendar-nav">
          <Button size="sm" onClick={() => setViewDate((d) => addMonths(d, -1))}>
            &#8249; Prev
          </Button>
          <span className="calendar-month-label">{formatMonthYear(viewDate)}</span>
          <Button size="sm" onClick={() => setViewDate((d) => addMonths(d, 1))}>
            Next &#8250;
          </Button>
          <Button size="sm" variant="primary" onClick={() => setViewDate(startOfMonth(today))}>
            Today
          </Button>
        </div>
      </header>

      <div className="calendar-legend">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span key={status} className="legend-item">
            <span className="legend-dot" style={{ background: color }} />
            {status}
          </span>
        ))}
      </div>

      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="calendar-weekday">
            {d}
          </div>
        ))}
        {cells.map((date) => {
          const dayEntries = entries.get(date) ?? [];
          const inMonth = date.startsWith(viewDate.slice(0, 7));
          const weekend = [0, 6].includes(new Date(`${date}T00:00:00`).getDay());
          const classes = [
            'calendar-cell',
            inMonth ? '' : 'outside',
            isSameDay(date, today) ? 'today' : '',
            weekend ? 'weekend' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={date} className={classes}>
              <div className="calendar-day-number">
                {Number(date.slice(8, 10))}
                {isSameDay(date, today) && <span className="today-pill">Today</span>}
              </div>
              {dayEntries.map(({ item }) => (
                <button
                  key={item.id}
                  type="button"
                  className="calendar-chip"
                  style={{
                    borderLeftColor: PLATFORM_COLORS[item.platform],
                    background: `${STATUS_COLORS[item.status]}1f`,
                    color: STATUS_COLORS[item.status],
                  }}
                  title={`${item.title} - ${item.platform} - ${item.status}`}
                  onClick={() => navigate({ name: 'project', id: item.projectId, tab: 'content' })}
                >
                  <span className="chip-title">{item.title}</span>
                  <span className="chip-meta">
                    {item.platform} &middot; {item.status}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <Section
        title="Publication agenda"
        subtitle={`Every content item scheduled in ${formatMonthYear(viewDate)}, by date`}
      >
        {monthEntries.length === 0 ? (
          <p className="muted">Nothing is scheduled to publish this month.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Content</th>
                  <th>Type</th>
                  <th>Platform</th>
                  <th>Status</th>
                  <th>Project</th>
                </tr>
              </thead>
              <tbody>
                {monthEntries.map(({ item, date, project }) => (
                  <tr key={item.id}>
                    <td className="nowrap">
                      <strong>{formatDate(date)}</strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="link-cell"
                        onClick={() =>
                          navigate({ name: 'project', id: item.projectId, tab: 'content' })
                        }
                      >
                        <span className="link-cell-text">
                          <strong>{item.title}</strong>
                          <span className="muted small">{item.brief.slice(0, 80)}</span>
                        </span>
                      </button>
                    </td>
                    <td>{item.contentType}</td>
                    <td>
                      <span className="platform-tag" style={{ color: PLATFORM_COLORS[item.platform] }}>
                        {item.platform}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ color: STATUS_COLORS[item.status], background: `${STATUS_COLORS[item.status]}1a` }}>
                        <span className="badge-dot" style={{ background: STATUS_COLORS[item.status] }} />
                        {item.status}
                      </span>
                    </td>
                    <td className="muted">{project?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
