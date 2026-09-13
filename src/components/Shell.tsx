import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Project, Role } from '../lib/model';
import { canRedo, canUndo, currentUser, redo, signOut, switchUser, undo, undoLabel, useDb } from '../lib/store';
import { ROLE_LABEL, can } from '../lib/permissions';
import { href } from '../lib/router';
import { Badge } from './ui';

const SECTIONS: { id: string; label: string; hint: string }[] = [
  { id: 'system', label: 'Sistema', hint: 'Tokens y componentes con estados' },
  { id: 'screens', label: 'Pantallas', hint: 'Prototipo y guardarraíl de flujo' },
  { id: 'studies', label: 'Pruebas', hint: 'Estudios con personas reales' },
  { id: 'handoff', label: 'Entrega', hint: 'Inspección y exportación' },
  { id: 'library', label: 'Biblioteca', hint: 'Versiones publicadas y adopción' },
  { id: 'history', label: 'Historial', hint: 'Versiones con nombre y actividad' },
  { id: 'team', label: 'Equipo', hint: 'Personas y roles' },
];

export function Shell({ project, role, section, children }: { project?: Project; role?: Role; section?: string; children: ReactNode }) {
  const db = useDb();
  const user = currentUser(db);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!project || !can(role, 'edit')) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(project.id);
        else undo(project.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [project, role]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: globalThis.MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const editable = project && can(role, 'edit');

  return (
    <div className={`app ${project ? 'with-rail' : ''}`}>
      <header className="topbar">
        <a className="wordmark" href={href('/')} aria-label="Forma Pro, ir a proyectos">
          Forma
        </a>
        {project && (
          <nav className="crumb" aria-label="Ubicación">
            <a href={href('/')}>Proyectos</a>
            <span aria-hidden="true">/</span>
            <span className="crumb-current">{project.name}</span>
            {role && <Badge tone={role === 'viewer' ? 'warn' : 'neutral'}>{ROLE_LABEL[role]}</Badge>}
          </nav>
        )}
        <div className="topbar-actions">
          {editable && (
            <div className="undo-group">
              <button
                type="button"
                className="icon-btn"
                disabled={!canUndo(project.id)}
                title={canUndo(project.id) ? `Deshacer: ${undoLabel(project.id)}` : 'Nada que deshacer'}
                aria-label="Deshacer"
                onClick={() => undo(project.id)}
              >
                ↶
              </button>
              <button type="button" className="icon-btn" disabled={!canRedo(project.id)} aria-label="Rehacer" title="Rehacer" onClick={() => redo(project.id)}>
                ↷
              </button>
            </div>
          )}
          {user && (
            <div className="user-menu" ref={menuRef}>
              <button type="button" className="avatar-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                <span className="avatar" aria-hidden="true">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="avatar-name">{user.name}</span>
              </button>
              {menu && (
                <div className="menu" role="menu">
                  <div className="menu-head">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  {db.users.filter((u) => u.id !== user.id).length > 0 && (
                    <div className="menu-group">
                      <span className="menu-label">Cambiar de perfil</span>
                      {db.users
                        .filter((u) => u.id !== user.id)
                        .map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              switchUser(u.id);
                              setMenu(false);
                            }}
                          >
                            {u.name} <span className="muted">{u.email}</span>
                          </button>
                        ))}
                    </div>
                  )}
                  <a role="menuitem" href={href('/settings')} onClick={() => setMenu(false)}>
                    Ajustes y respaldo
                  </a>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      signOut();
                    }}
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      {project && (
        <nav className="rail" aria-label="Secciones del proyecto">
          {SECTIONS.map((s) => (
            <a key={s.id} href={href(`/p/${project.id}/${s.id}`)} className={section === s.id ? 'active' : ''} aria-current={section === s.id ? 'page' : undefined} title={s.hint}>
              {s.label}
            </a>
          ))}
        </nav>
      )}
      <main className="main">{children}</main>
    </div>
  );
}
