import type { ReactNode } from 'react';
import { useRoute } from './lib/router';
import { currentUser, useDb } from './lib/store';
import { roleFor } from './lib/permissions';
import { Shell } from './components/Shell';
import { Empty, Toasts } from './components/ui';
import { Welcome } from './views/Welcome';
import { ProjectsView } from './views/ProjectsView';
import { SystemView } from './views/SystemView';
import { ScreensView } from './views/ScreensView';
import { StudiesView } from './views/StudiesView';
import { ParticipantView } from './views/ParticipantView';
import { HandoffView } from './views/HandoffView';
import { LibraryView } from './views/LibraryView';
import { HistoryView } from './views/HistoryView';
import { MembersView } from './views/MembersView';
import { SettingsView } from './views/SettingsView';

export default function App() {
  const route = useRoute();
  const db = useDb();
  const user = currentUser(db);
  const [a, b, c, d] = route.parts;

  if (a === 't' && b) {
    return (
      <>
        <ParticipantView studyId={b} data={route.query.get('d')} />
        <Toasts />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Welcome />
        <Toasts />
      </>
    );
  }

  let content: ReactNode;
  if (a === 'p' && b) {
    const project = db.projects.find((p) => p.id === b);
    const role = project ? roleFor(db, project, user) : undefined;
    if (!project || !role) {
      content = (
        <Shell>
          <div className="page">
            <Empty title="No tienes acceso a este proyecto">
              Puede que lo hayan eliminado o que tu correo ({user.email}) no tenga una invitación. Pide acceso a la persona dueña del proyecto.
            </Empty>
          </div>
        </Shell>
      );
    } else {
      const section = c ?? 'screens';
      const latestStudy = db.studies.filter((s) => s.projectId === project.id).sort((x, y) => y.created - x.created)[0];
      const views: Record<string, ReactNode> = {
        system: <SystemView project={project} role={role} />,
        screens: <ScreensView project={project} role={role} initialScreen={route.query.get('s') ?? undefined} openAi={route.query.get('ai') === '1'} />,
        studies: <StudiesView project={project} role={role} studyId={d} openNew={route.query.get('new') === '1'} />,
        results: <StudiesView project={project} role={role} studyId={latestStudy?.id} />,
        handoff: <HandoffView project={project} role={role} />,
        library: <LibraryView project={project} role={role} />,
        history: <HistoryView project={project} role={role} />,
        team: <MembersView project={project} role={role} />,
      };
      const active = section === 'studies' && d ? 'results' : section in views ? section : 'screens';
      content = (
        <Shell project={project} role={role} active={active}>
          {views[section] ?? views.screens}
        </Shell>
      );
    }
  } else if (a === 'settings') {
    content = (
      <Shell>
        <SettingsView />
      </Shell>
    );
  } else {
    content = (
      <Shell>
        <ProjectsView />
      </Shell>
    );
  }

  return (
    <>
      {content}
      <Toasts />
    </>
  );
}
