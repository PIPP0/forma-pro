import { useState } from 'react';
import type { Project, Role } from '../lib/model';
import { adoptRelease, currentUser, projectsFor, publishRelease, releasesFor, useDb, userName } from '../lib/store';
import { can } from '../lib/permissions';
import { adoption } from '../lib/metrics';
import { href } from '../lib/router';
import { Badge, Button, Empty, Field, timeAgo } from '../components/ui';

export function LibraryView({ project, role }: { project: Project; role: Role }) {
  const db = useDb();
  const user = currentUser(db);
  const own = releasesFor(db, project.id);
  const latest = own[0];
  const [kind, setKind] = useState<'patch' | 'minor' | 'major'>('minor');
  const [notes, setNotes] = useState('');
  const visible = projectsFor(db, user);
  const others = visible.filter((p) => p.id !== project.id && releasesFor(db, p.id).length);
  const consumers = visible.filter((p) => p.library?.sourceProjectId === project.id);
  const ad = adoption(project);

  const next = (() => {
    if (!latest) return '1.0.0';
    const [a, b, c] = latest.version.split('.').map(Number);
    return kind === 'major' ? `${a + 1}.0.0` : kind === 'minor' ? `${a}.${b + 1}.0` : `${a}.${b}.${c + 1}`;
  })();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Biblioteca</h1>
          <p className="page-sub">Publica el sistema de este proyecto como una versión fija que otros proyectos adoptan, y mira quién sigue en una versión vieja.</p>
        </div>
      </div>

      <section className="section">
        <h2 className="section-title">Adopción en este proyecto</h2>
        <p>
          {Math.round(ad.pct * 100)}% de los bloques instancian un componente ({ad.instanced} de {ad.eligible}).{' '}
          {project.library ? (
            <>
              Usa la biblioteca v{project.library.version} de «{db.projects.find((p) => p.id === project.library!.sourceProjectId)?.name ?? 'un proyecto sin acceso'}».
            </>
          ) : (
            'No usa una biblioteca publicada de otro proyecto.'
          )}
        </p>
      </section>

      {can(role, 'publish') && (
        <section className="section">
          <h2 className="section-title">Publicar el sistema de este proyecto</h2>
          <div className="grid-2">
            <Field label="Tipo de cambio" hint="Mayor: rompe instancias existentes. Menor: agrega componentes o tokens. Parche: corrige valores.">
              <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="patch">Parche</option>
                <option value="minor">Menor</option>
                <option value="major">Mayor</option>
              </select>
            </Field>
            <Field label="Notas de la versión">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: nuevo estado de foco en campos" />
            </Field>
          </div>
          <div className="row">
            <Button
              tone="primary"
              onClick={() => {
                if (publishRelease(project.id, kind, notes)) setNotes('');
              }}
            >
              Publicar v{next}
            </Button>
            <span className="muted small">
              Incluye {project.tokens.colors.length} colores y {project.components.length} componentes.
            </span>
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="section-title">Versiones publicadas</h2>
        {own.length === 0 ? (
          <p className="muted">Este proyecto aún no publica su sistema.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Versión</th>
                  <th>Notas</th>
                  <th>Componentes</th>
                  <th>Publicó</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {own.map((r, i) => (
                  <tr key={r.id}>
                    <td>
                      <strong>v{r.version}</strong> {i === 0 && <Badge tone="ok">Última</Badge>}
                    </td>
                    <td>{r.notes || <span className="muted">Sin notas</span>}</td>
                    <td>{r.snapshot.components.length}</td>
                    <td>{userName(db, r.publishedBy)}</td>
                    <td className="muted">{timeAgo(r.publishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Quién usa esta biblioteca</h2>
        {consumers.length === 0 ? (
          <p className="muted">Ningún proyecto al que tienes acceso usa esta biblioteca todavía.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th>Versión en uso</th>
                  <th>Adopción de componentes</th>
                </tr>
              </thead>
              <tbody>
                {consumers.map((c) => {
                  const a = adoption(c);
                  const outdated = latest && c.library!.version !== latest.version;
                  return (
                    <tr key={c.id}>
                      <td>
                        <a href={href(`/p/${c.id}/library`)}>{c.name}</a>
                      </td>
                      <td>
                        v{c.library!.version} {outdated ? <Badge tone="warn">Desactualizado, última v{latest!.version}</Badge> : <Badge tone="ok">Al día</Badge>}
                      </td>
                      <td>
                        {Math.round(a.pct * 100)}% {a.pct < 0.8 && <Badge tone="warn">Bajo el 80%</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Adoptar una biblioteca de otro proyecto</h2>
        {others.length === 0 ? (
          <Empty title="No hay otras bibliotecas publicadas">Cuando otro proyecto al que tienes acceso publique su sistema, podrás adoptarlo aquí.</Empty>
        ) : (
          <ul className="plain-list">
            {others.map((o) => {
              const rel = releasesFor(db, o.id);
              return (
                <li key={o.id} className="library-row">
                  <div>
                    <strong>{o.name}</strong>
                    <div className="muted small">
                      Última v{rel[0].version}, {timeAgo(rel[0].publishedAt)}
                    </div>
                  </div>
                  <div className="row">
                    {rel.slice(0, 3).map((r) => {
                      const current = project.library?.releaseId === r.id;
                      return (
                        <Button key={r.id} size="sm" tone={current ? 'primary' : 'default'} disabled={current || !can(role, 'edit')} onClick={() => adoptRelease(project.id, r.id)}>
                          {current ? `En uso v${r.version}` : `Usar v${r.version}`}
                        </Button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="muted small">Adoptar reemplaza tokens y componentes con los de la versión elegida. Las instancias conservan su vínculo y puedes deshacer el cambio.</p>
      </section>
    </div>
  );
}
