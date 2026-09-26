import type { ReactNode } from 'react';
import { useRoute } from './lib/router';
import { currentUser, useDb } from './lib/store';
import { useCloudAccount } from './components/useCloudAccount';
import { prefiereLocal, quedarseLocal } from './lib/session';
import { roleFor } from './lib/permissions';
import { Shell } from './components/Shell';
import { Empty, Toasts } from './components/ui';
import { Welcome } from './views/Welcome';
import { ProjectsView } from './views/ProjectsView';
import { SystemView } from './views/SystemView';
import { ScreensView } from './views/ScreensView';
import { ResultsView, StudiesView } from './views/StudiesView';
import { ParticipantView } from './views/ParticipantView';
import { SyntheticView } from './views/SyntheticView';
import { HandoffView } from './views/HandoffView';
import { LibraryView } from './views/LibraryView';
import { HistoryView } from './views/HistoryView';
import { MembersView } from './views/MembersView';
import { SettingsView } from './views/SettingsView';

export default function App() {
  const route = useRoute();
  const db = useDb();
  const user = currentUser(db);
  const { account: cuenta, loading: cuentaCargando } = useCloudAccount();
  const [a, b, c, d] = route.parts;

  if (a === 't' && b) {
    return (
      <>
        <ParticipantView studyId={b} data={route.query.get('d')} ensayo={route.query.get('ensayo') === '1'} />
        <Toasts />
      </>
    );
  }

  // Entrar es entrar con tu correo: es lo que hace que tus proyectos estén en cualquier equipo.
  // Quien prefiera trabajar solo en este navegador lo dice una vez y no se le vuelve a preguntar.
  // Si ya hay un perfil local (alguien que volvió), se espera a saber si la nube confirma su
  // correo antes de decidir si corresponde pedirle iniciar sesión: sin esto, cada recarga pasaba
  // un instante por la pantalla de inicio mientras la cuenta terminaba de confirmarse, aunque la
  // persona ya estuviera conectada.
  if (!user || (!cuentaCargando && !cuenta?.email && !prefiereLocal())) {
    return (
      <>
        <Welcome seguirComo={user && !cuentaCargando ? user.name : undefined} onSeguirLocal={quedarseLocal} />
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
      const views: Record<string, ReactNode> = {
        system: <SystemView project={project} role={role} />,
        screens: (
          <ScreensView
            project={project}
            role={role}
            initialScreen={route.query.get('s') ?? undefined}
            openAi={route.query.get('ai') === '1'}
            openPlay={route.query.get('play') === '1'}
          />
        ),
        studies: d ? <ResultsView project={project} role={role} studyId={d} /> : <StudiesView project={project} role={role} openNew={route.query.get('new') === '1'} />,
        results: <ResultsView project={project} role={role} studyId={d} />,
        users: <SyntheticView project={project} role={role} openRun={route.query.get('run') === '1'} />,
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
