import { useState } from 'react';
import { useRoute, navigate, type Route } from '../router';
import { useStore } from '../store/store';

interface NavItem {
  label: string;
  icon: string;
  isActive: (route: Route) => boolean;
  go: () => void;
}

export function Sidebar() {
  const route = useRoute();
  const { resetDemoData } = useStore();
  const [open, setOpen] = useState(false);

  const items: NavItem[] = [
    {
      label: 'Dashboard',
      icon: '▦',
      isActive: (r) => r.name === 'dashboard',
      go: () => navigate({ name: 'dashboard' }),
    },
    {
      label: 'Projects',
      icon: '▣',
      isActive: (r) => r.name === 'projects' || r.name === 'project',
      go: () => navigate({ name: 'projects' }),
    },
    {
      label: 'Content Calendar',
      icon: '▤',
      isActive: (r) => r.name === 'calendar',
      go: () => navigate({ name: 'calendar' }),
    },
    {
      label: 'Resources',
      icon: '◈',
      isActive: (r) => r.name === 'resources',
      go: () => navigate({ name: 'resources' }),
    },
  ];

  const handleReset = () => {
    const ok = window.confirm(
      'Reset to demo data? All of your current projects, content and tasks stored in this browser will be replaced by the original demo data.',
    );
    if (ok) {
      resetDemoData();
      navigate({ name: 'dashboard' });
    }
  };

  return (
    <>
      <button
        type="button"
        className="sidebar-burger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle navigation"
      >
        ☰
      </button>
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">CF</span>
          <span className="brand-text">
            <strong>ContentFlow</strong>
            <small>Content Production Planner</small>
          </span>
        </div>

        <nav className="sidebar-nav">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`nav-item${item.isActive(route) ? ' active' : ''}`}
              onClick={() => {
                item.go();
                setOpen(false);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="reset-btn" onClick={handleReset}>
            Reset demo data
          </button>
          <p className="sidebar-note">
            Projects, content and tasks are saved in this browser&apos;s localStorage and survive
            reloads.
          </p>
        </div>
      </aside>
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}
    </>
  );
}
