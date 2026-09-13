import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Project, Role } from '../lib/model';
import { currentUser, projectsFor, redo, saveVersion, signOut, switchUser, undo, useDb } from '../lib/store';
import { ROLE_LABEL, can } from '../lib/permissions';
import { href } from '../lib/router';
import { Button, Modal } from './ui';
import { IconChart, IconCheckCircle, IconChevronDown, IconChevronRight, IconDiamond, IconPlay, IconSave, IconSend, IconShield, IconSparkle, IconUpload } from './icons';

const TABS = [
  { id: 'screens', label: 'Diseñar', Icon: IconSend },
  { id: 'system', label: 'Sistema de diseño', Icon: IconDiamond },
  { id: 'studies', label: 'Pruebas', Icon: IconPlay },
  { id: 'results', label: 'Resultados', Icon: IconChart },
];

const MORE = [
  { id: 'handoff', label: 'Entrega' },
  { id: 'library', label: 'Biblioteca' },
  { id: 'history', label: 'Historial' },
  { id: 'team', label: 'Equipo' },
];

export function BrandLockup() {
  return (
    <a className="brand" href={href('/')} aria-label="Forma Studio, ir al workspace">
      <span className="brand-mark" aria-hidden="true">
        f
      </span>
      <span className="brand-name">forma</span>
      <span className="brand-sub">STUDIO</span>
    </a>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export function Shell({ project, role, active, children }: { project?: Project; role?: Role; active?: string; children: ReactNode }) {
  const db = useDb();
  const user = currentUser(db);
  const [menu, setMenu] = useState<'user' | 'project' | null>(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionName, setVersionName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const projRef = useRef<HTMLDivElement>(null);

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
      if (!menuRef.current?.contains(e.target as Node) && !projRef.current?.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const isDemo = project && db.studies.some((s) => s.projectId === project.id && s.example);
  const projects = projectsFor(db, user);

  return (
    <div className={`app ${project ? 'has-project' : ''}`}>
      <header className="topbar">
        <BrandLockup />
        <span className="topbar-sep" aria-hidden="true" />
        <nav className="crumb" aria-label="Ubicación">
          <a href={href('/')}>Workspace</a>
          {project && (
            <>
              <IconChevronRight size={14} className="crumb-sep" />
              <span className="crumb-current">
                {project.brand && project.brand !== project.name ? `${project.brand} · ${project.name}` : project.name}
              </span>
              {isDemo && <span className="pill">Demo</span>}
              {role === 'viewer' && <span className="pill">Solo lectura</span>}
            </>
          )}
        </nav>
        <div className="topbar-actions">
          {project && (
            <span className="save-state">
              <IconCheckCircle size={15} /> Guardado en este navegador
            </span>
          )}
          {project && can(role, 'publish') && (
            <button type="button" className="icon-btn" title="Guardar versión con nombre" aria-label="Guardar versión con nombre" onClick={() => setVersionOpen(true)}>
              <IconSave size={18} />
            </button>
          )}
          {user && (
            <div className="user-menu" ref={menuRef}>
              <button type="button" className="avatar-btn" aria-haspopup="menu" aria-expanded={menu === 'user'} aria-label={`Cuenta de ${user.name}`} onClick={() => setMenu((m) => (m === 'user' ? null : 'user'))}>
                <span className="avatar">{initials(user.name)}</span>
              </button>
              {menu === 'user' && (
                <div className="menu" role="menu">
                  <div className="menu-head">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                    {role && <span>Rol en este proyecto: {ROLE_LABEL[role]}</span>}
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
                              setMenu(null);
                            }}
                          >
                            {u.name} <span className="muted">{u.email}</span>
                          </button>
                        ))}
                    </div>
                  )}
                  <a role="menuitem" href={href('/settings')} onClick={() => setMenu(null)}>
                    Ajustes y respaldo
                  </a>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(null);
                      signOut();
                    }}
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          )}
          {project && can(role, 'runStudy') && (
            <a className="btn btn-dark" href={href(`/p/${project.id}/studies?new=1`)}>
              <IconUpload size={16} /> Crear prueba
            </a>
          )}
        </div>
      </header>

      {project && (
        <div className="subnav">
          <div className="project-switch" ref={projRef}>
            <button type="button" className="project-switch-btn" aria-haspopup="menu" aria-expanded={menu === 'project'} onClick={() => setMenu((m) => (m === 'project' ? null : 'project'))}>
              <span className="stripes" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {project.business || 'Proyecto'}
              <IconChevronDown size={14} />
            </button>
            {menu === 'project' && (
              <div className="menu menu-left" role="menu">
                <span className="menu-label">Proyectos</span>
                {projects.map((p) => (
                  <a key={p.id} role="menuitem" href={href(`/p/${p.id}/screens`)} onClick={() => setMenu(null)} aria-current={p.id === project.id}>
                    {p.name} <span className="muted">{p.business}</span>
                  </a>
                ))}
                <a role="menuitem" href={href('/')} onClick={() => setMenu(null)}>
                  Ver todos los proyectos
                </a>
              </div>
            )}
          </div>
          <nav className="subtabs" aria-label="Secciones del proyecto">
            {TABS.map(({ id, label, Icon }) => (
              <a key={id} href={href(`/p/${project.id}/${id}`)} className={active === id ? 'active' : ''} aria-current={active === id ? 'page' : undefined}>
                <Icon size={16} /> {label}
              </a>
            ))}
            <span className="subtabs-sep" aria-hidden="true" />
            {MORE.map(({ id, label }) => (
              <a key={id} href={href(`/p/${project.id}/${id}`)} className={`minor ${active === id ? 'active' : ''}`} aria-current={active === id ? 'page' : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <a className="btn-ai" href={href(`/p/${project.id}/screens?ai=1`)}>
            <IconSparkle size={16} /> Asistente IA
          </a>
        </div>
      )}

      <main className="main">{children}</main>

      <footer className="app-foot">
        <span>
          <i className="foot-dot" aria-hidden="true" /> Forma Studio <span className="foot-sep">/</span> {project ? project.name : 'Workspace'}
        </span>
        <span>
          <IconShield size={13} /> {project?.footnote ? 'Demo con datos ficticios' : 'Datos guardados en este navegador'} <span className="foot-ver">v0.2</span>
        </span>
      </footer>

      {project && (
        <Modal
          open={versionOpen}
          title="Guardar versión con nombre"
          onClose={() => setVersionOpen(false)}
          footer={
            <>
              <Button onClick={() => setVersionOpen(false)}>Cancelar</Button>
              <Button
                tone="primary"
                onClick={() => {
                  if (saveVersion(project.id, versionName)) {
                    setVersionName('');
                    setVersionOpen(false);
                  }
                }}
              >
                Guardar versión
              </Button>
            </>
          }
        >
          <p className="muted">Los cambios se guardan solos. Una versión con nombre es una copia completa a la que puedes volver desde Historial.</p>
          <label className="field">
            <span className="field-label">Nombre de la versión</span>
            <input autoFocus value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder="Ej: Antes del test con clientes" />
          </label>
        </Modal>
      )}
    </div>
  );
}
