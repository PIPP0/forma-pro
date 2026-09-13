import { useState } from 'react';
import type { Project, Role } from '../lib/model';
import { invite, removeMember, setMemberRole, useDb } from '../lib/store';
import { PERMISSION_LABEL, ROLE_LABEL, can, type Permission } from '../lib/permissions';
import { Badge, Button } from '../components/ui';

const PERMS: Permission[] = ['view', 'comment', 'edit', 'runStudy', 'publish', 'manageMembers', 'delete'];
const ROLES: Role[] = ['owner', 'editor', 'viewer'];

export function MembersView({ project, role }: { project: Project; role: Role }) {
  const db = useDb();
  const owner = db.users.find((u) => u.id === project.owner);
  const members = db.memberships.filter((m) => m.subjectId === project.id && m.role !== 'owner');
  const manage = can(role, 'manageMembers');
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('editor');

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Equipo</h1>
          <p className="page-sub">Cada proyecto tiene un dueño claro y acceso explícito por correo. Nadie ve un proyecto al que no fue invitado.</p>
        </div>
      </div>

      <section className="section">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rol</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>{owner?.name ?? 'Dueño'}</strong>
                  <div className="muted small">{owner?.email}</div>
                </td>
                <td>
                  <Badge tone="accent">{ROLE_LABEL.owner}</Badge>
                </td>
                <td />
              </tr>
              {members.map((m) => {
                const u = db.users.find((x) => x.email === m.email);
                return (
                  <tr key={m.id}>
                    <td>
                      <strong>{u?.name ?? m.email}</strong>
                      <div className="muted small">{u ? m.email : 'Aún no entra a Forma'}</div>
                    </td>
                    <td>
                      {manage ? (
                        <select className="input" aria-label={`Rol de ${m.email}`} value={m.role} onChange={(e) => setMemberRole(m.id, e.target.value as Role)}>
                          <option value="editor">{ROLE_LABEL.editor}</option>
                          <option value="viewer">{ROLE_LABEL.viewer}</option>
                        </select>
                      ) : (
                        <Badge>{ROLE_LABEL[m.role]}</Badge>
                      )}
                    </td>
                    <td className="t-right">
                      {manage && (
                        <Button size="sm" tone="ghost" onClick={() => removeMember(m.id)}>
                          Quitar acceso
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {manage && (
        <section className="section">
          <h2 className="section-title">Invitar</h2>
          <form
            className="row add-row"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (invite(project.id, email, newRole)) setEmail('');
            }}
          >
            <input className="input grow" type="email" aria-label="Correo de la persona" placeholder="correo@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select className="input" aria-label="Rol" value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
              <option value="editor">{ROLE_LABEL.editor}</option>
              <option value="viewer">{ROLE_LABEL.viewer}</option>
            </select>
            <Button tone="primary" type="submit">
              Invitar
            </Button>
          </form>
          <p className="muted small">
            En esta versión sin servidor, la invitación da acceso cuando esa persona entra con ese correo en este mismo navegador (útil para revisar con alguien a tu lado o probar roles con «Cambiar de perfil»). El acceso entre dispositivos requiere el backend descrito en el README.
          </p>
        </section>
      )}

      <section className="section">
        <h2 className="section-title">Qué puede hacer cada rol</h2>
        <div className="table-wrap">
          <table className="table matrix">
            <thead>
              <tr>
                <th>Permiso</th>
                {ROLES.map((r) => (
                  <th key={r}>{ROLE_LABEL[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMS.map((perm) => (
                <tr key={perm}>
                  <td>{PERMISSION_LABEL[perm]}</td>
                  {ROLES.map((r) => (
                    <td key={r} aria-label={can(r, perm) ? 'Sí' : 'No'}>
                      {can(r, perm) ? '✓' : <span className="muted">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
