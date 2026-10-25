# ContentFlow — Content Production Planner

**ContentFlow** is a project scheduling and management web application built for **content
production teams**. It turns a content pipeline — *Idea → Brief → Script → Production → Editing →
Review → Revision → Approval → Scheduling → Published* — into a real, scheduled project plan with
tasks, subtasks, dependencies, working-day calendars, resources, milestones, a Gantt chart, a
content calendar and critical-path analysis.

The demo data ships with a flagship project, **Campus Cybersecurity Awareness Campaign 2026**,
producing carousels, reels, YouTube explainers and articles across Instagram, TikTok, YouTube and
LinkedIn.

---

## Purpose

Content teams do not manage "events" — they manage a **production schedule**: several pieces of
content, each moving through the same review-and-publish pipeline, sharing a small team, with
publication dates that cannot slip. ContentFlow makes that schedule explicit and computable:

- What is being produced (content items), and what work each item requires (production tasks)
- When each task can start given its predecessors, lag and the team's **working days**
- Which tasks are on the **critical path** (zero float) and therefore must not slip
- What publishes on which day (**Content Calendar**)
- Who is loaded with work (**Resources / workload**)

---

## Technology stack

| Layer     | Choice                                             |
| --------- | -------------------------------------------------- |
| UI        | React 18 + TypeScript                              |
| Build     | Vite 5                                             |
| Routing   | Small custom hash router (no external dependency)  |
| State     | React Context + hooks, persisted to `localStorage` |
| Styling   | Hand-written CSS (single stylesheet, design tokens)|
| Scheduling| Custom working-day/CPM engine in `src/utils`       |
| Tests     | Vitest unit tests for the scheduling domain        |

No database, no backend, no authentication, no third-party APIs — the app runs entirely in the
browser.

---

## Installation

```bash
npm install
```

Requires Node.js 18+.

## Running

```bash
npm run dev        # start dev server (http://localhost:5173)
npm run build      # production build into dist/
npm run preview    # serve the production build locally
npm run typecheck  # TypeScript type checking (tsc --noEmit)
npm test           # run the unit test suite once
npm run test:watch # run tests in watch mode
```

---

## Main features

### A. Project management
Create, edit, view and delete projects (name, description, start/end, status, working days,
holidays, colour). Seeded with three realistic content projects; the flagship is the Campus
Cybersecurity Awareness Campaign 2026.

### B. Content items
Each project holds content items (title, brief, content type, platform, status, priority,
progress, dates, owner, production tasks). Content types cover social posts, carousels, reels,
TikToks, YouTube videos, blog articles and infographics; platforms cover Instagram, TikTok,
YouTube, Website and LinkedIn. Item dates and progress are **derived from their production
tasks** so the calendar and the plan can never disagree.

### C. Production tasks and subtasks
Tasks support parent/subtask hierarchy, CRUD, start date, duration in **working days**, derived
end date, status (Not Started, In Progress, In Review, Revision, Approved, Scheduled, Published,
Delayed), priority (Low → Critical), progress, assignee and dependencies. Editing a task shifts
its subtasks with it and re-spans every ancestor bar.

### D. Dependencies
All four link types — **Finish→Start, Start→Start, Finish→Finish, Start→Finish** — plus **lag in
working days**. Invalid structures are rejected with an explanatory message:

- self-dependency
- circular dependency (the cycle path is shown, e.g. `A -> B -> A`)
- impossible ancestor/descendant dependency (a parent/subtask link, or any link involving a
  summary task whose span is derived from its subtasks)

When a predecessor moves, dependents are recalculated forward (never pulled backward), and the UI
reports the impact as a toast: *"Scheduling impact: 3 tasks rescheduled to respect dependencies…"*.

### E. Gantt chart
Tree of tasks/subtasks with bars, progress fill, dependency arrows (arrowheads; dashed for
non-FS links), milestone diamonds, today line, weekend/holiday shading, critical-task highlighting,
Day/Week/Month zoom, Today button, horizontal scrolling, expand/collapse, tooltips, legend and
click-to-edit on any bar.

### F. Content calendar
A dedicated month view of **planned content by publication date** with status/platform chips and a
publication agenda table (Date · Content · Type · Platform · Status · Project).

### G. Resources
Seven content-production roles (Content Strategist, Copywriter, Graphic Designer, Videographer,
Video Editor, Reviewer, Social Media Admin) with add/remove, assignment to tasks, and workload:
assigned tasks, open tasks, workload days, completion %, per-project breakdowns and a workload
comparison chart.

### H. Milestones
Zero-duration milestones (Campaign Brief Approved, First Content Ready, Campaign Launch,
Mid-Campaign Review, Campaign Completed…) rendered as diamonds on the Gantt and listed on the
overview.

### I. Dashboard
Total/active projects, content items, in-production/in-review/scheduled/published/delayed counts,
overall progress, upcoming deadlines (with overdue flagging), a selected-project overview
(progress, status tally, milestones, team) and project cards.

### J. Working calendar
Default Mon–Fri working days, per-project overrides (the demo launch project also works
Saturdays), plus explicit named holidays. Durations, dependency lag, scheduling and the critical
path all run on **working-day ordinals**, so weekends and holidays are never counted.

### K. Critical path
A practical CPM implementation: forward pass (earliest start/finish from dependency constraints),
backward pass (latest start/finish), total float in working days, critical-task identification,
the ordered critical chain, project duration (working + calendar days) and a full
forward/backward-pass table — all shown in a dedicated **Critical Path** tab and summarized on
the project overview and Gantt.

---

## Project structure

```
src/
├── main.tsx                 # React entry point
├── App.tsx                  # Shell: sidebar + hash-route-driven views
├── router.ts                # Tiny hash router (#/projects/:id/:tab)
├── styles.css               # All styling (design tokens → views → responsive)
├── types.ts                 # Domain model (Project, ContentItem, Task, …)
├── constants.ts             # Option lists, status/priority/platform colours
├── data/
│   ├── seed.ts              # Demo data builder (specs -> scheduled tasks) + validateState()
│   └── seed.test.ts
├── store/
│   └── store.tsx            # Context store: actions, localStorage persistence, toasts
├── utils/                   # Scheduling domain, UI-free and fully unit tested
│   ├── dates.ts             # ISO date helpers
│   ├── workingDays.ts       # Working-day calendar + ordinals
│   ├── dependencies.ts      # Validation (self/cycle/ancestor) + topological order
│   ├── scheduling.ts        # Durations, subtree shifts, constraint propagation
│   ├── criticalPath.ts      # CPM forward/backward pass, floats, critical chain
│   ├── selectors.ts         # Read-model helpers
│   ├── stats.ts             # Dashboard / calendar / workload statistics
│   ├── id.ts
│   └── *.test.ts            # Vitest suites
├── components/
│   ├── Sidebar.tsx          # Navigation + reset demo data
│   ├── Modal.tsx            # Dialog shell
│   ├── Toasts.tsx           # Scheduling-impact / notification toasts
│   ├── ui.tsx               # Badges, progress, avatars, stat cards, buttons…
│   └── forms.tsx            # Project / content / task (+dependencies) / resource forms
└── views/
    ├── DashboardView.tsx
    ├── ProjectsView.tsx
    ├── ContentCalendarView.tsx
    ├── ResourcesView.tsx
    └── project/
        ├── ProjectDetail.tsx   # Tab shell (Overview/Content/Gantt/Calendar/Resources/Critical)
        ├── OverviewTab.tsx
        ├── ContentTab.tsx      # Content items + task tree CRUD
        ├── GanttTab.tsx        # Gantt chart
        ├── CalendarTab.tsx     # Working days, holidays, month grid
        ├── ProjectResourcesTab.tsx
        └── CriticalPathTab.tsx
```

**Separation of concerns:** everything in `src/utils/` is pure scheduling/statistics logic with no
React imports; UI components only render and dispatch store actions.

---

## How the scheduling / Gantt functionality works

1. **Working-day ordinals.** Every date maps to an integer ordinal = the number of working days
   since `2020-01-01`, using the project's working days and holidays
   (`workingDays.ts`). All arithmetic (durations, lag, CPM) is integer math over these ordinals;
   converting back to a date automatically skips weekends and holidays.

2. **Durations.** `end = start + (duration − 1)` working days; milestones have duration 0.
   Summary (parent) bars are always re-derived to span their subtasks.

3. **Dependencies.** Each link imposes a lower bound on the successor's start:
   `FS: succ ≥ predEnd + 1 + lag`, `SS: succ ≥ predStart + lag`,
   `FF: succ ≥ predEnd + lag − span(succ)`, `SF: succ ≥ predStart + lag − span(succ)`.
   Successors take the maximum over all predecessors.

4. **Propagation.** When a task's date or duration changes, the app (a) shifts its subtasks by the
   same working-day delta, (b) re-spans ancestors, and (c) walks the affected dependents in
   topological order pushing any violation forward — reporting every moved task.

5. **Critical path.** Forward pass from the roots gives ES/EF; backward pass from the project end
   gives LS/LF; `float = LS − ES`. Tasks with `float ≤ 0` are critical, the critical chain is
   recovered by walking binding predecessors backwards, and the Gantt highlights those bars and
   links in red.

6. **Gantt rendering.** The timeline is a pixel axis over *calendar* days (Day 44px, Week 15px,
   Month 5px per day). Bars are positioned from each task's ISO dates, dependency arrows are
   routed per link type over an SVG layer, non-working days are shaded from the project calendar,
   and the today line/flag is fixed to the current date.

---

## Testing

```bash
npm run typecheck   # TypeScript
npm test            # Vitest suites
npm run build       # production build
```

Unit tests cover:

- `workingDays.test.ts` — weekends/holidays skipping, ordinal round-trips, inclusive counts
- `dependencies.test.ts` — self/circular/ancestor/summary/duplicate rejection, topological order
- `scheduling.test.ts` — derived end dates, FS/SS/FF/SF + lag bounds, forward propagation,
  no pull-back, violation push-back, subtree shifts, summary spans, insert/remove
- `criticalPath.test.ts` — linear chain, float on parallel work, milestones, lag, summary float,
  empty input, ordinal consistency
- `seed.test.ts` — seed integrity (`validateState()` = no dependency violations, every date is a
  working day), required projects/items/milestones, platform/status/dependency coverage,
  dashboard counters, resource workloads, critical chain over the flagship project

---

## Known limitations

- **Single user, single browser.** Data lives in `localStorage`; there is no sync, sharing,
  conflict resolution or backend. Resetting demo data overwrites local changes.
- **No drag-and-drop on the Gantt.** Dates are changed through the task editor (click a bar);
  the schedule then recalculates. This keeps scheduling logic in one tested place.
- **Dependencies are set on leaf tasks.** Summary bars span their subtasks, so a parent cannot
  take part in a dependency (attempting one is rejected as an invalid ancestor/descendant link).
- **Forward scheduling only.** Moving a predecessor earlier does not pull successors backward
  (only constraint violations push work later); resource levelling and calendars-within-calendars
  (per-user vacations) are out of scope.
- **Critical path is computed from the dependency graph** (earliest dates). Manually delaying a
  task does not change its float until its date/links are updated.
- No publishing/analytics integrations, chat, payments or authentication — intentionally out of
  scope for a planning tool.

---

## Resetting the demo data

Sidebar → **Reset demo data** replaces the current browser state with the original seeded
projects (confirmation required).
