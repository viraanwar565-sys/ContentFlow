/** Small presentational primitives shared across views. */

import type { ReactNode } from 'react';
import type { Priority, Resource, WorkflowStatus } from '../types';
import { PRIORITY_COLORS, PLATFORM_COLORS, STATUS_COLORS } from '../constants';
import type { Platform } from '../types';

export function StatusBadge({ status }: { status: WorkflowStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <span className="badge" style={{ color, background: `${color}1a`, borderColor: `${color}44` }}>
      <span className="badge-dot" style={{ background: color }} />
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const color = PRIORITY_COLORS[priority];
  return (
    <span
      className="badge badge-priority"
      style={{ color, background: `${color}1a`, borderColor: `${color}44` }}
    >
      {priority}
    </span>
  );
}

export function PlatformTag({ platform }: { platform: Platform }) {
  const color = PLATFORM_COLORS[platform];
  return (
    <span className="platform-tag" style={{ color, borderColor: `${color}55` }}>
      {platform}
    </span>
  );
}

export function ProgressBar({
  value,
  label,
  color,
}: {
  value: number;
  /** When defined (boolean shorthand or custom text), the percent is shown. */
  label?: boolean | string;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const fill = color ?? (clamped >= 100 ? '#16a34a' : clamped > 0 ? '#3b82f6' : '#cbd5e1');
  return (
    <div className={`progress${label !== undefined ? ' with-label' : ''}`} title={`${clamped}%`}>
      <div className="progress-fill" style={{ width: `${clamped}%`, background: fill }} />
      {label !== undefined && <span className="progress-label">{clamped}%</span>}
    </div>
  );
}

export function Avatar({ resource, size = 26 }: { resource?: Resource; size?: number }) {
  if (!resource) {
    return (
      <span className="avatar avatar-unassigned" style={{ width: size, height: size }} title="Unassigned">
        ?
      </span>
    );
  }
  const initials = resource.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: resource.color }}
      title={`${resource.name} - ${resource.role}`}
    >
      {initials}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">&#9634;</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = '#3b82f6',
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: string;
  onClick?: () => void;
}) {
  const className = `stat-card${onClick ? ' clickable' : ''}`;
  return (
    <div className={className} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="stat-accent" style={{ background: accent }} />
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {hint && <span className="stat-hint">{hint}</span>}
      </div>
    </div>
  );
}

export function Section({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel-header">
          <div>
            {title && <h2 className="panel-title">{title}</h2>}
            {subtitle && <p className="panel-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  type = 'button',
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  type?: 'button' | 'submit';
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}
