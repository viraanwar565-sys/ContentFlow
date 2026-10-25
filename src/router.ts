/** Tiny hash-based router (no external dependency). */

import { useEffect, useState } from 'react';

export type ProjectTab =
  | 'overview'
  | 'content'
  | 'gantt'
  | 'calendar'
  | 'resources'
  | 'critical';

export type Route =
  | { name: 'dashboard' }
  | { name: 'projects' }
  | { name: 'project'; id: string; tab: ProjectTab }
  | { name: 'calendar' }
  | { name: 'resources' };

const PROJECT_TABS: ProjectTab[] = [
  'overview',
  'content',
  'gantt',
  'calendar',
  'resources',
  'critical',
];

export function parseRoute(hash: string): Route {
  const clean = hash.replace(/^#/, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'dashboard' };
  if (parts[0] === 'projects') {
    if (parts.length === 1) return { name: 'projects' };
    const tab = (parts[2] ?? 'overview') as ProjectTab;
    return {
      name: 'project',
      id: decodeURIComponent(parts[1]),
      tab: PROJECT_TABS.includes(tab) ? tab : 'overview',
    };
  }
  if (parts[0] === 'calendar') return { name: 'calendar' };
  if (parts[0] === 'resources') return { name: 'resources' };
  return { name: 'dashboard' };
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'dashboard':
      return '#/';
    case 'projects':
      return '#/projects';
    case 'project':
      return `#/projects/${encodeURIComponent(route.id)}/${route.tab}`;
    case 'calendar':
      return '#/calendar';
    case 'resources':
      return '#/resources';
  }
}

export function navigate(route: Route): void {
  const target = routeToHash(route);
  if (window.location.hash === target) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    if (!window.location.hash) window.location.hash = '#/';
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
