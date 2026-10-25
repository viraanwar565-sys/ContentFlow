import type {
  ContentType,
  DependencyType,
  Platform,
  Priority,
  ProjectStatus,
  ResourceRole,
  WorkflowStatus,
} from './types';

export const WORKFLOW_STATUSES: WorkflowStatus[] = [
  'Not Started',
  'In Progress',
  'In Review',
  'Revision',
  'Approved',
  'Scheduled',
  'Published',
  'Delayed',
];

export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

export const PROJECT_STATUSES: ProjectStatus[] = [
  'Planning',
  'In Production',
  'On Hold',
  'Completed',
];

export const CONTENT_TYPES: ContentType[] = [
  'Social Media Post',
  'Carousel',
  'Reel',
  'TikTok',
  'YouTube Video',
  'Blog Article',
  'Infographic',
];

export const PLATFORMS: Platform[] = ['Instagram', 'TikTok', 'YouTube', 'Website', 'LinkedIn'];

export const RESOURCE_ROLES: ResourceRole[] = [
  'Content Strategist',
  'Copywriter',
  'Graphic Designer',
  'Videographer',
  'Video Editor',
  'Reviewer',
  'Social Media Admin',
];

export const DEPENDENCY_TYPES: DependencyType[] = ['FS', 'SS', 'FF', 'SF'];

export const DEPENDENCY_LABELS: Record<DependencyType, string> = {
  FS: 'Finish -> Start',
  SS: 'Start -> Start',
  FF: 'Finish -> Finish',
  SF: 'Start -> Finish',
};

export const STATUS_COLORS: Record<WorkflowStatus, string> = {
  'Not Started': '#8a94a6',
  'In Progress': '#3b82f6',
  'In Review': '#a855f7',
  Revision: '#f59e0b',
  Approved: '#10b981',
  Scheduled: '#0ea5e9',
  Published: '#16a34a',
  Delayed: '#ef4444',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  Low: '#8a94a6',
  Medium: '#3b82f6',
  High: '#f59e0b',
  Critical: '#ef4444',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  Planning: '#8a94a6',
  'In Production': '#3b82f6',
  'On Hold': '#f59e0b',
  Completed: '#16a34a',
};

export const RESOURCE_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#ef4444',
  '#84cc16',
  '#f97316',
];

export const PLATFORM_COLORS: Record<Platform, string> = {
  Instagram: '#e1306c',
  TikTok: '#111827',
  YouTube: '#ef4444',
  Website: '#0ea5e9',
  LinkedIn: '#0a66c2',
};
