import { StoreProvider } from './store/store';
import { useRoute } from './router';
import { Sidebar } from './components/Sidebar';
import { Toasts } from './components/Toasts';
import { DashboardView } from './views/DashboardView';
import { ProjectsView } from './views/ProjectsView';
import { ContentCalendarView } from './views/ContentCalendarView';
import { ResourcesView } from './views/ResourcesView';
import { ProjectDetail } from './views/project/ProjectDetail';

function Shell() {
  const route = useRoute();
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        {route.name === 'dashboard' && <DashboardView />}
        {route.name === 'projects' && <ProjectsView />}
        {route.name === 'project' && (
          <ProjectDetail projectId={route.id} tab={route.tab} />
        )}
        {route.name === 'calendar' && <ContentCalendarView />}
        {route.name === 'resources' && <ResourcesView />}
      </main>
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
