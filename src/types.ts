/**
 * ContentFlow domain types.
 *
 * Dates are always ISO strings (YYYY-MM-DD) in local time.
 * Durations are expressed in working days (0 for milestones).
 */

export type ID = string;

export type WorkflowStatus =
  | 'Not Started'
  | 'In Progress'
  | 'In Review'
  | 'Revision'
  | 'Approved'
  | 'Scheduled'
  | 'Published'
  | 'Delayed';

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export type ProjectStatus = 'Planning' | 'In Production' | 'On Hold' | 'Completed';

export type ContentType =
  | 'Social Media Post'
  | 'Carousel'
  | 'Reel'
  | 'TikTok'
  | 'YouTube Video'
  | 'Blog Article'
  | 'Infographic';

export type Platform = 'Instagram' | 'TikTok' | 'YouTube' | 'Website' | 'LinkedIn';

export type ResourceRole =
  | 'Content Strategist'
  | 'Copywriter'
  | 'Graphic Designer'
  | 'Videographer'
  | 'Video Editor'
  | 'Reviewer'
  | 'Social Media Admin';

/** Dependency link types: Finish-to-Start, Start-to-Start, Finish-to-Finish, Start-to-Finish. */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface Dependency {
  /** Id of the predecessor task. */
  predecessorId: ID;
  type: DependencyType;
  /** Lag expressed in working days (>= 0). */
  lag: number;
}

export interface Holiday {
  date: string;
  name: string;
}

export interface Project {
  id: ID;
  name: string;
  description: string;
  /** Working days of the week (0 = Sunday ... 6 = Saturday). */
  workingDays: number[];
  holidays: Holiday[];
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  color: string;
}

export interface ContentItem {
  id: ID;
  projectId: ID;
  title: string;
  brief: string;
  contentType: ContentType;
  platform: Platform;
  status: WorkflowStatus;
  priority: Priority;
  /** Planned start of the production pipeline for this item. */
  startDate: string;
  /** Planned publication date (used by the Content Calendar). */
  endDate: string;
  /** Preferred owner of the item (informational; tasks carry their own assignments). */
  assigneeId: ID | null;
}

export interface Task {
  id: ID;
  projectId: ID;
  /** Null for project-level (campaign) tasks and milestones. */
  contentItemId: ID | null;
  /** Null for top-level tasks. */
  parentId: ID | null;
  name: string;
  startDate: string;
  /** Duration in working days. 0 for milestones. */
  duration: number;
  status: WorkflowStatus;
  priority: Priority;
  /** 0 - 100. For summary tasks (with subtasks) progress is derived from children. */
  progress: number;
  assigneeId: ID | null;
  isMilestone: boolean;
  dependencies: Dependency[];
}

export interface Resource {
  id: ID;
  name: string;
  role: ResourceRole;
  color: string;
}

export interface AppState {
  version: number;
  projects: Project[];
  contentItems: ContentItem[];
  tasks: Task[];
  resources: Resource[];
}

/** Working calendar used by the scheduling math (plain data, no project object). */
export interface WorkingCalendar {
  workingDays: number[];
  holidays: string[];
}
