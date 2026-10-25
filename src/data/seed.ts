/**
 * Demo seed data.
 *
 * Tasks are declared as specs (hierarchy + dependencies + durations) and are
 * scheduled by the same scheduling rules the app uses at runtime, so every
 * seed date is guaranteed to satisfy its dependency constraints. Statuses and
 * progress are derived from the computed dates relative to "today", with
 * explicit overrides where a specific demo state is wanted.
 */

import type {
  AppState,
  ContentItem,
  ContentType,
  DependencyType,
  Priority,
  Project,
  Resource,
  ResourceRole,
  Task,
  WorkflowStatus,
  Platform,
} from '../types';
import { addDays, maxOf, minOf, startOfWeek, todayISO } from '../utils/dates';
import {
  addWorkingDays,
  calendarOf,
  dateFromWorkOrdinal,
  normalizeWorkingDay,
  spanEndDate,
  workOrdinal,
} from '../utils/workingDays';
import {
  forwardConstraint,
  recomputeSummarySpans,
  spanOf,
  taskEndISO,
} from '../utils/scheduling';
import { topologicalOrder, validateDependency } from '../utils/dependencies';
import { weightedProgress } from '../utils/selectors';
import { RESOURCE_COLORS } from '../constants';

interface DepSpec {
  pred: string;
  type?: DependencyType;
  lag?: number;
}

interface TaskSpec {
  key: string;
  name: string;
  /** Key of the parent (summary) task. */
  parent?: string;
  /** Id of the content item this task belongs to. */
  item?: string;
  duration: number;
  milestone?: boolean;
  assignee?: string;
  priority?: Priority;
  /** Explicit demo status (otherwise derived from dates). */
  status?: WorkflowStatus;
  /** Explicit demo progress (otherwise derived from dates). */
  progress?: number;
  /** Working days after the project start for root tasks without dependencies. */
  offset?: number;
  deps?: DepSpec[];
}

interface ItemSpec {
  id: string;
  title: string;
  brief: string;
  contentType: ContentType;
  platform: Platform;
  status: WorkflowStatus;
  priority: Priority;
  assignee?: string;
}

interface ProjectSpec {
  id: string;
  name: string;
  description: string;
  status: Project['status'];
  color: string;
  startDate: string;
  workingDays: number[];
  holidays: { date: string; name: string }[];
  endPadding: number;
  items: ItemSpec[];
  tasks: TaskSpec[];
}

function dep(pred: string, type: DependencyType = 'FS', lag = 0): DepSpec {
  return { pred, type, lag };
}

const RESOURCE_DEFS: { id: string; name: string; role: ResourceRole }[] = [
  { id: 'res-1', name: 'Maya Chen', role: 'Content Strategist' },
  { id: 'res-2', name: 'Jordan Lee', role: 'Copywriter' },
  { id: 'res-3', name: 'Priya Nair', role: 'Graphic Designer' },
  { id: 'res-4', name: 'Diego Alvarez', role: 'Videographer' },
  { id: 'res-5', name: 'Sam Okafor', role: 'Video Editor' },
  { id: 'res-6', name: 'Nina Patel', role: 'Reviewer' },
  { id: 'res-7', name: 'Alex Kim', role: 'Social Media Admin' },
];

// ---------------------------------------------------------------------------
// Project specs
// ---------------------------------------------------------------------------

function flagshipSpec(): ProjectSpec {
  const monday = startOfWeek(todayISO());
  const startDate = addDays(monday, -21);
  const base = calendarOf([1, 2, 3, 4, 5], []);
  const holidays = [
    { date: addWorkingDays(startDate, 21, base), name: 'Campus Wellness Day' },
    { date: addWorkingDays(startDate, 27, base), name: 'Faculty Development Day' },
  ];

  return {
    id: 'p-cyber',
    name: 'Campus Cybersecurity Awareness Campaign 2026',
    description:
      'A semester-long multi-channel campaign that takes campus cybersecurity content from idea to published posts: briefs, scripts, design, recording, editing, review, approval, scheduling and publishing across Instagram, TikTok, YouTube and LinkedIn.',
    status: 'In Production',
    color: '#6366f1',
    startDate,
    workingDays: [1, 2, 3, 4, 5],
    holidays,
    endPadding: 3,
    items: [
      {
        id: 'ci-carousel',
        title: 'Phishing Awareness Carousel',
        brief:
          'A 5-slide carousel breaking down the anatomy of a phishing email, ending with a clear call to report suspicious messages to the campus IT desk.',
        contentType: 'Carousel',
        platform: 'Instagram',
        status: 'Published',
        priority: 'High',
        assignee: 'res-3',
      },
      {
        id: 'ci-reel',
        title: '3 Signs of Phishing - TikTok Reel',
        brief:
          '60-second vertical reel covering three red flags of phishing messages, quick-cut style with burned-in captions.',
        contentType: 'Reel',
        platform: 'TikTok',
        status: 'Scheduled',
        priority: 'Critical',
        assignee: 'res-4',
      },
      {
        id: 'ci-password',
        title: 'Password Security Tips',
        brief:
          'Single-image post with three password hygiene tips: passphrases, a password manager, and enabling multi-factor authentication.',
        contentType: 'Social Media Post',
        platform: 'Instagram',
        status: 'Delayed',
        priority: 'High',
        assignee: 'res-2',
      },
      {
        id: 'ci-soc',
        title: 'Introduction to SOC',
        brief:
          '3-minute explainer introducing the campus Security Operations Center: what it monitors, how alerts are triaged, and how students report incidents.',
        contentType: 'YouTube Video',
        platform: 'YouTube',
        status: 'Not Started',
        priority: 'High',
        assignee: 'res-5',
      },
      {
        id: 'ci-myth',
        title: 'Cybersecurity Myth vs Fact',
        brief:
          'Myth-vs-fact carousel debunking four cybersecurity misconceptions that keep circulating among student groups.',
        contentType: 'Carousel',
        platform: 'Instagram',
        status: 'In Review',
        priority: 'Medium',
        assignee: 'res-3',
      },
      {
        id: 'ci-checklist',
        title: 'Cybersecurity Checklist for Student Orgs',
        brief:
          'Long-form LinkedIn article with a 10-point security checklist for student organization leaders who manage shared accounts and mailing lists.',
        contentType: 'Blog Article',
        platform: 'LinkedIn',
        status: 'In Progress',
        priority: 'Medium',
        assignee: 'res-1',
      },
    ],
    tasks: [
      // --- Campaign planning phase ---------------------------------------
      { key: 'plan-brief', name: 'Campaign Brief', duration: 2, offset: 0, assignee: 'res-1', priority: 'High' },
      { key: 'plan-strategy', name: 'Content Strategy', duration: 3, assignee: 'res-1', priority: 'High', deps: [dep('plan-brief')] },
      { key: 'plan-calendar', name: 'Channel & Posting Calendar', duration: 2, assignee: 'res-7', deps: [dep('plan-strategy')] },
      {
        key: 'ms-brief',
        name: 'Campaign Brief Approved',
        duration: 0,
        milestone: true,
        priority: 'Critical',
        deps: [dep('plan-brief', 'FF'), dep('plan-strategy', 'FF')],
      },

      // --- Content item 1: Phishing Awareness Carousel --------------------
      { key: 'i1', name: 'Phishing Awareness Carousel', item: 'ci-carousel', duration: 0 },
      { key: 'i1-brief', name: 'Content Brief', parent: 'i1', item: 'ci-carousel', duration: 2, assignee: 'res-1', deps: [dep('plan-brief')] },
      { key: 'i1-copy', name: 'Copywriting', parent: 'i1', item: 'ci-carousel', duration: 3, assignee: 'res-2', deps: [dep('i1-brief')] },
      { key: 'i1-design', name: 'Design', parent: 'i1', item: 'ci-carousel', duration: 3, assignee: 'res-3', deps: [dep('i1-copy', 'SS'), dep('i1-copy', 'FF')] },
      { key: 'i1-review', name: 'Internal Review', parent: 'i1', item: 'ci-carousel', duration: 2, assignee: 'res-6', priority: 'High', deps: [dep('i1-copy'), dep('i1-design')] },
      { key: 'i1-revision', name: 'Revision', parent: 'i1', item: 'ci-carousel', duration: 1, assignee: 'res-2', deps: [dep('i1-review')] },
      { key: 'i1-approval', name: 'Final Approval', parent: 'i1', item: 'ci-carousel', duration: 1, assignee: 'res-1', priority: 'High', deps: [dep('i1-revision')] },
      { key: 'i1-schedule', name: 'Scheduling', parent: 'i1', item: 'ci-carousel', duration: 1, assignee: 'res-7', deps: [dep('i1-approval')] },
      { key: 'i1-publish', name: 'Publishing', parent: 'i1', item: 'ci-carousel', duration: 2, assignee: 'res-7', priority: 'High', deps: [dep('i1-schedule')] },

      // --- Content item 2: TikTok Reel ------------------------------------
      { key: 'i2', name: '3 Signs of Phishing - TikTok Reel', item: 'ci-reel', duration: 0 },
      { key: 'i2-brief', name: 'Content Brief', parent: 'i2', item: 'ci-reel', duration: 2, assignee: 'res-1', deps: [dep('plan-brief', 'FS', 2)] },
      { key: 'i2-script', name: 'Scriptwriting', parent: 'i2', item: 'ci-reel', duration: 2, assignee: 'res-2', deps: [dep('i2-brief')] },
      { key: 'i2-record', name: 'Recording', parent: 'i2', item: 'ci-reel', duration: 1, assignee: 'res-4', deps: [dep('i2-script', 'SS', 1)] },
      { key: 'i2-edit', name: 'Video Editing', parent: 'i2', item: 'ci-reel', duration: 3, assignee: 'res-5', deps: [dep('i2-record')] },
      { key: 'i2-review', name: 'Internal Review', parent: 'i2', item: 'ci-reel', duration: 2, assignee: 'res-6', priority: 'High', deps: [dep('i2-edit')] },
      { key: 'i2-revision', name: 'Revision', parent: 'i2', item: 'ci-reel', duration: 1, assignee: 'res-5', deps: [dep('i2-review')] },
      { key: 'i2-approval', name: 'Final Approval', parent: 'i2', item: 'ci-reel', duration: 1, assignee: 'res-1', priority: 'High', deps: [dep('i2-revision')] },
      { key: 'i2-schedule', name: 'Scheduling', parent: 'i2', item: 'ci-reel', duration: 1, assignee: 'res-7', deps: [dep('i2-approval')] },
      { key: 'i2-publish', name: 'Publishing', parent: 'i2', item: 'ci-reel', duration: 1, assignee: 'res-7', priority: 'Critical', status: 'Scheduled', progress: 0, deps: [dep('i2-schedule')] },

      // --- Content item 3: Password Security Tips (delayed) ---------------
      { key: 'i3', name: 'Password Security Tips', item: 'ci-password', duration: 0 },
      { key: 'i3-brief', name: 'Content Brief', parent: 'i3', item: 'ci-password', duration: 1, assignee: 'res-1', deps: [dep('plan-brief', 'FS', 4)] },
      { key: 'i3-copy', name: 'Copywriting', parent: 'i3', item: 'ci-password', duration: 2, assignee: 'res-2', deps: [dep('i3-brief')] },
      { key: 'i3-design', name: 'Design', parent: 'i3', item: 'ci-password', duration: 1, assignee: 'res-3', deps: [dep('i3-copy', 'FF')] },
      { key: 'i3-review', name: 'Internal Review', parent: 'i3', item: 'ci-password', duration: 2, assignee: 'res-6', status: 'Revision', progress: 75, priority: 'High', deps: [dep('i3-copy'), dep('i3-design')] },
      { key: 'i3-approval', name: 'Final Approval', parent: 'i3', item: 'ci-password', duration: 1, assignee: 'res-1', status: 'Not Started', progress: 0, deps: [dep('i3-review')] },
      { key: 'i3-schedule', name: 'Scheduling', parent: 'i3', item: 'ci-password', duration: 1, assignee: 'res-7', status: 'Not Started', progress: 0, deps: [dep('i3-approval')] },
      { key: 'i3-publish', name: 'Publishing', parent: 'i3', item: 'ci-password', duration: 1, assignee: 'res-7', priority: 'Critical', status: 'Not Started', progress: 0, deps: [dep('i3-schedule')] },

      // --- Content item 4: Introduction to SOC (YouTube) ------------------
      { key: 'i4', name: 'Introduction to SOC', item: 'ci-soc', duration: 0 },
      { key: 'i4-brief', name: 'Content Brief', parent: 'i4', item: 'ci-soc', duration: 2, assignee: 'res-1', deps: [dep('i2-publish')] },
      { key: 'i4-script', name: 'Scriptwriting', parent: 'i4', item: 'ci-soc', duration: 2, assignee: 'res-2', deps: [dep('i4-brief')] },
      { key: 'i4-record', name: 'Recording', parent: 'i4', item: 'ci-soc', duration: 2, assignee: 'res-4', deps: [dep('i4-script', 'SS', 1)] },
      { key: 'i4-edit', name: 'Video Editing', parent: 'i4', item: 'ci-soc', duration: 3, assignee: 'res-5', deps: [dep('i4-record')] },
      { key: 'i4-review', name: 'Internal Review', parent: 'i4', item: 'ci-soc', duration: 2, assignee: 'res-6', priority: 'High', deps: [dep('i4-edit')] },
      { key: 'i4-revision', name: 'Revision', parent: 'i4', item: 'ci-soc', duration: 1, assignee: 'res-5', deps: [dep('i4-review')] },
      { key: 'i4-approval', name: 'Final Approval', parent: 'i4', item: 'ci-soc', duration: 1, assignee: 'res-1', priority: 'High', deps: [dep('i4-revision')] },
      { key: 'i4-schedule', name: 'Scheduling', parent: 'i4', item: 'ci-soc', duration: 1, assignee: 'res-7', deps: [dep('i4-approval')] },
      { key: 'i4-publish', name: 'Publishing', parent: 'i4', item: 'ci-soc', duration: 2, assignee: 'res-7', priority: 'High', deps: [dep('i4-schedule')] },

      // --- Content item 5: Myth vs Fact -----------------------------------
      { key: 'i5', name: 'Cybersecurity Myth vs Fact', item: 'ci-myth', duration: 0 },
      { key: 'i5-brief', name: 'Content Brief', parent: 'i5', item: 'ci-myth', duration: 1, assignee: 'res-1', deps: [dep('plan-brief', 'FS', 8)] },
      { key: 'i5-copy', name: 'Copywriting', parent: 'i5', item: 'ci-myth', duration: 2, assignee: 'res-2', deps: [dep('i5-brief')] },
      { key: 'i5-design', name: 'Design', parent: 'i5', item: 'ci-myth', duration: 2, assignee: 'res-3', deps: [dep('i5-copy', 'SS'), dep('i5-copy', 'FF')] },
      { key: 'i5-review', name: 'Internal Review', parent: 'i5', item: 'ci-myth', duration: 2, assignee: 'res-6', status: 'In Review', progress: 55, priority: 'High', deps: [dep('i5-copy'), dep('i5-design')] },
      { key: 'i5-revision', name: 'Revision', parent: 'i5', item: 'ci-myth', duration: 1, assignee: 'res-2', deps: [dep('i5-review')] },
      { key: 'i5-approval', name: 'Final Approval', parent: 'i5', item: 'ci-myth', duration: 1, assignee: 'res-1', deps: [dep('i5-revision')] },
      { key: 'i5-schedule', name: 'Scheduling', parent: 'i5', item: 'ci-myth', duration: 1, assignee: 'res-7', deps: [dep('i5-approval')] },
      { key: 'i5-publish', name: 'Publishing', parent: 'i5', item: 'ci-myth', duration: 1, assignee: 'res-7', priority: 'High', deps: [dep('i5-schedule')] },

      // --- Content item 6: LinkedIn checklist (in production) -------------
      { key: 'i6', name: 'Cybersecurity Checklist for Student Orgs', item: 'ci-checklist', duration: 0 },
      { key: 'i6-brief', name: 'Content Brief', parent: 'i6', item: 'ci-checklist', duration: 1, assignee: 'res-1', deps: [dep('plan-brief', 'FS', 8)] },
      { key: 'i6-copy', name: 'Copywriting', parent: 'i6', item: 'ci-checklist', duration: 5, assignee: 'res-2', deps: [dep('i6-brief')] },
      { key: 'i6-design', name: 'Design', parent: 'i6', item: 'ci-checklist', duration: 2, assignee: 'res-3', deps: [dep('i6-copy')] },
      { key: 'i6-review', name: 'Internal Review', parent: 'i6', item: 'ci-checklist', duration: 1, assignee: 'res-6', deps: [dep('i6-design')] },
      { key: 'i6-approval', name: 'Final Approval', parent: 'i6', item: 'ci-checklist', duration: 1, assignee: 'res-1', deps: [dep('i6-review')] },
      { key: 'i6-schedule', name: 'Scheduling', parent: 'i6', item: 'ci-checklist', duration: 1, assignee: 'res-7', deps: [dep('i6-approval')] },
      { key: 'i6-publish', name: 'Publishing', parent: 'i6', item: 'ci-checklist', duration: 1, assignee: 'res-7', deps: [dep('i6-schedule')] },

      // --- Milestones ------------------------------------------------------
      { key: 'ms-ready', name: 'First Content Ready', duration: 0, milestone: true, priority: 'High', deps: [dep('i1-approval', 'FF')] },
      { key: 'ms-launch', name: 'Campaign Launch', duration: 0, milestone: true, priority: 'Critical', deps: [dep('i1-publish', 'FF')] },
      { key: 'ms-mid', name: 'Mid-Campaign Review', duration: 0, milestone: true, priority: 'High', deps: [dep('i3-publish', 'SF', 5)] },
      { key: 'ms-completed', name: 'Campaign Completed', duration: 0, milestone: true, priority: 'Critical', deps: [dep('wrap-lessons', 'FF')] },

      // --- Wrap-up phase ----------------------------------------------------
      { key: 'wrap', name: 'Wrap-Up & Reporting', duration: 0 },
      { key: 'wrap-report', name: 'Performance Report', parent: 'wrap', duration: 3, assignee: 'res-1', deps: [dep('i5-publish', 'FS', 5)] },
      { key: 'wrap-lessons', name: 'Lessons Learned', parent: 'wrap', duration: 2, assignee: 'res-1', deps: [dep('wrap-report')] },
    ],
  };
}

function launchSpec(): ProjectSpec {
  const monday = startOfWeek(todayISO());
  const startDate = addDays(monday, -14);
  const base = calendarOf([1, 2, 3, 4, 5, 6], []);
  const holidays = [{ date: addWorkingDays(startDate, 14, base), name: 'Launch Offsite' }];

  return {
    id: 'p-launch',
    name: 'Q4 Product Launch Blog Series',
    description:
      'Editorial series announcing the new collaboration features: research, outlines, drafts, review and publishing across the website and LinkedIn.',
    status: 'In Production',
    color: '#0ea5e9',
    startDate,
    // This team also works Saturdays.
    workingDays: [1, 2, 3, 4, 5, 6],
    holidays,
    endPadding: 3,
    items: [
      {
        id: 'ci-lp1',
        title: 'Launch Teaser Blog Post',
        brief:
          'Teaser post announcing the new collaboration features, focused on the problem it solves for student teams.',
        contentType: 'Blog Article',
        platform: 'Website',
        status: 'In Progress',
        priority: 'High',
        assignee: 'res-2',
      },
      {
        id: 'ci-lp2',
        title: 'Feature Deep-Dive: Real-Time Editing',
        brief:
          'Deep-dive article showing how real-time editing works, with screenshots and a short workflow walkthrough.',
        contentType: 'Blog Article',
        platform: 'LinkedIn',
        status: 'Not Started',
        priority: 'Medium',
        assignee: 'res-2',
      },
    ],
    tasks: [
      { key: 'lp-research', name: 'Topic Research', duration: 2, offset: 0, assignee: 'res-1' },
      { key: 'lp-calendar', name: 'Editorial Calendar', duration: 2, assignee: 'res-1', deps: [dep('lp-research')] },
      { key: 'lp-lock', name: 'Editorial Calendar Locked', duration: 0, milestone: true, priority: 'High', deps: [dep('lp-calendar', 'FF')] },

      { key: 'lp1', name: 'Launch Teaser Blog Post', item: 'ci-lp1', duration: 0 },
      { key: 'lp1-brief', name: 'Content Brief', parent: 'lp1', item: 'ci-lp1', duration: 1, assignee: 'res-1', deps: [dep('lp-research')] },
      { key: 'lp1-outline', name: 'Outline', parent: 'lp1', item: 'ci-lp1', duration: 1, assignee: 'res-2', deps: [dep('lp1-brief')] },
      { key: 'lp1-draft', name: 'Drafting', parent: 'lp1', item: 'ci-lp1', duration: 3, assignee: 'res-2', deps: [dep('lp1-outline')] },
      { key: 'lp1-review', name: 'Internal Review', parent: 'lp1', item: 'ci-lp1', duration: 2, assignee: 'res-6', deps: [dep('lp1-draft')] },
      { key: 'lp1-edit', name: 'Editing', parent: 'lp1', item: 'ci-lp1', duration: 1, assignee: 'res-2', deps: [dep('lp1-review')] },
      { key: 'lp1-publish', name: 'Publishing', parent: 'lp1', item: 'ci-lp1', duration: 1, assignee: 'res-7', priority: 'High', deps: [dep('lp1-edit')] },

      { key: 'lp2', name: 'Feature Deep-Dive: Real-Time Editing', item: 'ci-lp2', duration: 0 },
      { key: 'lp2-brief', name: 'Content Brief', parent: 'lp2', item: 'ci-lp2', duration: 1, assignee: 'res-1', deps: [dep('lp1-publish', 'FS', 3)] },
      { key: 'lp2-draft', name: 'Drafting', parent: 'lp2', item: 'ci-lp2', duration: 3, assignee: 'res-2', deps: [dep('lp2-brief')] },
      { key: 'lp2-review', name: 'Internal Review', parent: 'lp2', item: 'ci-lp2', duration: 2, assignee: 'res-6', deps: [dep('lp2-draft')] },
      { key: 'lp2-design', name: 'Illustrations', parent: 'lp2', item: 'ci-lp2', duration: 2, assignee: 'res-3', deps: [dep('lp2-draft', 'SS', 1)] },
      { key: 'lp2-publish', name: 'Publishing', parent: 'lp2', item: 'ci-lp2', duration: 1, assignee: 'res-7', deps: [dep('lp2-review'), dep('lp2-design')] },
    ],
  };
}

function spotlightSpec(): ProjectSpec {
  const monday = startOfWeek(todayISO());
  const startDate = addDays(monday, -63);
  return {
    id: 'p-spotlight',
    name: 'Student Organization Spotlight - Fall Series',
    description:
      'A completed series profiling student organizations: research, story angles, copywriting, design, review and publishing on Instagram and LinkedIn.',
    status: 'Completed',
    color: '#10b981',
    startDate,
    workingDays: [1, 2, 3, 4, 5],
    holidays: [],
    endPadding: 3,
    items: [
      {
        id: 'ci-sp1',
        title: 'Org Spotlight: Robotics Club',
        brief:
          'Profile post on the robotics club: recent competition results, member stories and how to join.',
        contentType: 'Social Media Post',
        platform: 'Instagram',
        status: 'Published',
        priority: 'Medium',
        assignee: 'res-7',
      },
      {
        id: 'ci-sp2',
        title: 'Org Spotlight: Debate Society',
        brief:
          'Carousel profiling the debate society with quotes, meeting times and photos from the last tournament.',
        contentType: 'Carousel',
        platform: 'LinkedIn',
        status: 'Published',
        priority: 'Medium',
        assignee: 'res-3',
      },
    ],
    tasks: [
      { key: 'sp-research', name: 'Org Research', duration: 2, offset: 0, assignee: 'res-1' },
      { key: 'sp-angles', name: 'Story Angles', duration: 2, assignee: 'res-1', deps: [dep('sp-research')] },

      { key: 'sp1', name: 'Org Spotlight: Robotics Club', item: 'ci-sp1', duration: 0 },
      { key: 'sp1-brief', name: 'Content Brief', parent: 'sp1', item: 'ci-sp1', duration: 1, assignee: 'res-1', deps: [dep('sp-angles')] },
      { key: 'sp1-write', name: 'Copywriting', parent: 'sp1', item: 'ci-sp1', duration: 2, assignee: 'res-2', deps: [dep('sp1-brief')] },
      { key: 'sp1-design', name: 'Design', parent: 'sp1', item: 'ci-sp1', duration: 2, assignee: 'res-3', deps: [dep('sp1-write')] },
      { key: 'sp1-review', name: 'Internal Review', parent: 'sp1', item: 'ci-sp1', duration: 1, assignee: 'res-6', deps: [dep('sp1-design')] },
      { key: 'sp1-publish', name: 'Publishing', parent: 'sp1', item: 'ci-sp1', duration: 1, assignee: 'res-7', priority: 'High', deps: [dep('sp1-review')] },

      { key: 'sp2', name: 'Org Spotlight: Debate Society', item: 'ci-sp2', duration: 0 },
      { key: 'sp2-brief', name: 'Content Brief', parent: 'sp2', item: 'ci-sp2', duration: 1, assignee: 'res-1', deps: [dep('sp1-publish', 'FS', 2)] },
      { key: 'sp2-write', name: 'Copywriting', parent: 'sp2', item: 'ci-sp2', duration: 2, assignee: 'res-2', deps: [dep('sp2-brief')] },
      { key: 'sp2-design', name: 'Design', parent: 'sp2', item: 'ci-sp2', duration: 3, assignee: 'res-3', deps: [dep('sp2-write')] },
      { key: 'sp2-review', name: 'Internal Review', parent: 'sp2', item: 'ci-sp2', duration: 1, assignee: 'res-6', deps: [dep('sp2-design')] },
      { key: 'sp2-publish', name: 'Publishing', parent: 'sp2', item: 'ci-sp2', duration: 1, assignee: 'res-7', deps: [dep('sp2-review')] },
    ],
  };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

function deriveStatus(
  task: Task,
  start: string,
  end: string,
  today: string,
  todayOrdinal: number,
  startOrdinal: number,
): { status: WorkflowStatus; progress: number } {
  if (end < today) {
    const status: WorkflowStatus =
      task.isMilestone || task.name !== 'Publishing' ? 'Approved' : 'Published';
    return { status, progress: 100 };
  }
  if (start > today) {
    return { status: 'Not Started', progress: 0 };
  }
  const span = Math.max(1, task.duration);
  const raw = Math.round(((todayOrdinal - startOrdinal) / span) * 100);
  const progress = Math.max(15, Math.min(90, raw));
  if (task.name === 'Internal Review') return { status: 'In Review', progress };
  if (task.name === 'Revision') return { status: 'Revision', progress };
  return { status: 'In Progress', progress };
}

function buildProject(spec: ProjectSpec): {
  project: Project;
  tasks: Task[];
  items: ContentItem[];
} {
  const cal = calendarOf(spec.workingDays, spec.holidays);
  const start = normalizeWorkingDay(spec.startDate, cal);
  const projectStartOrd = workOrdinal(start, cal);

  const byKey = new Map<string, TaskSpec>();
  for (const s of spec.tasks) {
    if (byKey.has(s.key)) throw new Error(`Duplicate seed task key: ${s.key}`);
    byKey.set(s.key, s);
  }

  const offsetById = new Map<string, number>();
  const tasks: Task[] = spec.tasks.map((s) => {
    const id = `${spec.id}--${s.key}`;
    if (s.offset !== undefined) offsetById.set(id, s.offset);
    const parentTask = s.parent ? byKey.get(s.parent) : undefined;
    if (s.parent && !parentTask) throw new Error(`Unknown parent key ${s.parent} for ${s.key}`);
    return {
      id,
      projectId: spec.id,
      contentItemId: s.item ?? null,
      parentId: s.parent ? `${spec.id}--${s.parent}` : null,
      name: s.name,
      startDate: start,
      duration: s.milestone ? 0 : Math.max(0, s.duration),
      status: 'Not Started' as WorkflowStatus,
      priority: s.priority ?? ('Medium' as Priority),
      progress: 0,
      assigneeId: s.assignee ?? null,
      isMilestone: Boolean(s.milestone),
      dependencies: (s.deps ?? []).map((d) => ({
        predecessorId: `${spec.id}--${d.pred}`,
        type: d.type ?? ('FS' as DependencyType),
        lag: d.lag ?? 0,
      })),
    };
  });

  const byId = new Map(tasks.map((t) => [t.id, t]));
  // Summary (parent) tasks are not scheduled directly: their spans are derived
  // from their subtasks by recomputeSummarySpans() below. Everything else (the
  // leaf tasks that hold the actual work) is forward-scheduled here.
  const summaryIds = new Set(
    tasks.filter((t) => tasks.some((child) => child.parentId === t.id)).map((t) => t.id),
  );

  // Forward scheduling of leaf tasks in topological order.
  const ES = new Map<string, number>();
  for (const id of topologicalOrder(tasks)) {
    if (summaryIds.has(id)) continue; // summaries are derived from their subtasks
    const task = byId.get(id);
    if (!task) continue;
    let startOrd: number | null = null;
    for (const depSpec of task.dependencies) {
      const predOrd = ES.get(depSpec.predecessorId);
      const pred = byId.get(depSpec.predecessorId);
      if (predOrd === undefined || !pred) continue;
      const value = forwardConstraint(predOrd, predOrd + spanOf(pred.duration), depSpec, spanOf(task.duration));
      startOrd = startOrd === null ? value : Math.max(startOrd, value);
    }
    if (startOrd === null) startOrd = projectStartOrd + (offsetById.get(id) ?? 0);
    ES.set(id, startOrd);
  }

  let list = tasks.map((t) => {
    const ord = ES.get(t.id);
    return ord === undefined ? t : { ...t, startDate: dateFromWorkOrdinal(ord, cal) };
  });
  list = recomputeSummarySpans(list, cal);

  // Derive demo statuses/progress from the computed dates.
  const today = todayISO();
  const todayOrdinal = workOrdinal(today, cal);
  list = list.map((t) => {
    const startOrd = workOrdinal(normalizeWorkingDay(t.startDate, cal), cal);
    const end = taskEndISO(t, cal);
    const derived = deriveStatus(t, t.startDate, end, today, todayOrdinal, startOrd);
    const s = byKey.get(keyOf(spec.id, t.id));
    return {
      ...t,
      status: s?.status ?? derived.status,
      progress: s?.progress ?? derived.progress,
    };
  });
  list = recomputeSummarySpans(list, cal);

  // Summary tasks report the weighted progress of their subtasks.
  list = list.map((t) => {
    const kids = list.filter((k) => k.parentId === t.id);
    if (kids.length === 0) return t;
    return { ...t, progress: weightedProgress(kids) };
  });

  // Content item dates derived from their production tasks.
  const items: ContentItem[] = spec.items.map((it) => {
    const own = list.filter((t) => t.contentItemId === it.id);
    const starts = own.map((t) => t.startDate).filter(Boolean);
    const ends = own.map((t) => taskEndISO(t, cal)).filter(Boolean);
    return {
      id: it.id,
      projectId: spec.id,
      title: it.title,
      brief: it.brief,
      contentType: it.contentType,
      platform: it.platform,
      status: it.status,
      priority: it.priority,
      startDate: starts.length ? minOf(starts) : start,
      endDate: ends.length ? maxOf(ends) : start,
      assigneeId: it.assignee ?? null,
    };
  });

  // Project end: after the last task/item plus a small buffer.
  const allEnds = [...list.map((t) => taskEndISO(t, cal)), ...items.map((i) => i.endDate)];
  const lastEnd = allEnds.length ? maxOf(allEnds) : start;
  const endDate = addWorkingDays(lastEnd, spec.endPadding, cal);

  const project: Project = {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    status: spec.status,
    color: spec.color,
    startDate: start,
    endDate,
    workingDays: spec.workingDays,
    holidays: spec.holidays,
  };

  return { project, tasks: list, items };
}

function keyOf(projectId: string, taskId: string): string {
  const prefix = `${projectId}--`;
  return taskId.startsWith(prefix) ? taskId.slice(prefix.length) : taskId;
}

export function buildSeedState(): AppState {
  const resources: Resource[] = RESOURCE_DEFS.map((r, i) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    color: RESOURCE_COLORS[i % RESOURCE_COLORS.length],
  }));

  const specs = [flagshipSpec(), launchSpec(), spotlightSpec()];
  const projects: Project[] = [];
  const tasks: Task[] = [];
  const contentItems: ContentItem[] = [];

  for (const spec of specs) {
    const built = buildProject(spec);
    projects.push(built.project);
    tasks.push(...built.tasks);
    contentItems.push(...built.items);
  }

  return {
    version: 1,
    projects,
    contentItems,
    tasks,
    resources,
  };
}

/**
 * Consistency checks over a state (used by unit tests): dependency validity,
 * working-day dates and hierarchy integrity.
 */
export function validateState(state: AppState): string[] {
  const issues: string[] = [];
  for (const project of state.projects) {
    const cal = calendarOf(project.workingDays, project.holidays);
    const projectTasks = state.tasks.filter((t) => t.projectId === project.id);
    for (const t of projectTasks) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t.startDate)) {
        issues.push(`${project.name}/${t.name}: malformed start date ${t.startDate}`);
      }
      if (t.parentId && !projectTasks.some((p) => p.id === t.parentId)) {
        issues.push(`${project.name}/${t.name}: missing parent`);
      }
      if (t.contentItemId && !state.contentItems.some((i) => i.id === t.contentItemId)) {
        issues.push(`${project.name}/${t.name}: missing content item`);
      }
      if (t.assigneeId && !state.resources.some((r) => r.id === t.assigneeId)) {
        issues.push(`${project.name}/${t.name}: unknown assignee`);
      }
      if (t.duration < 0) issues.push(`${project.name}/${t.name}: negative duration`);
      if (t.isMilestone && t.duration !== 0) {
        issues.push(`${project.name}/${t.name}: milestone must have zero duration`);
      }
      for (const d of t.dependencies) {
        const error = validateDependency(projectTasks, d.predecessorId, t.id, { existing: true });
        if (error) issues.push(`${project.name}/${t.name}: ${error}`);
      }
    }
    // Dependency scheduling feasibility: successors must not start before predecessors allow.
    for (const t of projectTasks) {
      for (const d of t.dependencies) {
        const pred = projectTasks.find((p) => p.id === d.predecessorId);
        if (!pred) {
          issues.push(`${project.name}/${t.name}: dangling dependency`);
          continue;
        }
        const predStart = workOrdinal(normalizeWorkingDay(pred.startDate, cal), cal);
        const predEnd = predStart + spanOf(pred.duration);
        const succStart = workOrdinal(normalizeWorkingDay(t.startDate, cal), cal);
        const required = forwardConstraint(predStart, predEnd, d, spanOf(t.duration));
        if (succStart < required) {
          issues.push(
            `${project.name}/${t.name}: starts on ordinal ${succStart} before required ${required} (${d.type} on ${pred.name})`,
          );
        }
      }
    }
  }
  return issues;
}

/** Ensures a task's derived end helper is exercised by the seed (sanity export). */
export function seedTaskEnd(task: Task, workingDays: number[], holidays: { date: string }[]): string {
  return spanEndDate(task.startDate, task.duration, calendarOf(workingDays, holidays));
}
