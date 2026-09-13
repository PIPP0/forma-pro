import { useMemo, useState } from 'react';
import type { Op, Project, ProjectVersion, Role } from '../lib/model';
import { restoreVersion, saveVersion, useDb, userName } from '../lib/store';
import { can } from '../lib/permissions';
import { diffSummary } from '../lib/metrics';
import { Button, Empty, Modal, timeAgo } from '../components/ui';

export function HistoryView({ project, role }: { project: Project; role: Role }) {
  const db = useDb();
  const versions = db.versions.filter((v) => v.projectId === project.id).sort((a, b) => b.createdAt - a.createdAt);
  const [label, setLabel] = useState('');
  const [compare, setCompare] = useState<ProjectVersion>();
  const [restore, setRestore] = useState<ProjectVersion>();

  const activity = useMemo(() => {
    const ops = db.ops.filter((o) => o.projectId === project.id);
    const groups: { key: string; label: string; by: string; at: number; count: number }[] = [];
    for (const o of ops as Op[]) {
      const last = groups[groups.length - 1];
      if (last && last.label === o.label && last.by === o.by && Math.abs(last.at - o.at) < 1000) last.count++;
      else groups.push({ key: o.id, label: o.label, by: o.by, at: o.at, count: 1 });
    }
    return groups.reverse().slice(0, 60);
  }, [db.ops, project.id]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Historial</h1>
          <p className="page-sub">Cada versión con nombre es una copia completa y restaurable. Restaurar nunca borra: primero guarda el estado actual.</p>
        </div>
      </div>

      {can(role, 'publish') && (
        <form
          className="row add-row section"
          onSubmit={(e) => {
            e.preventDefault();
            if (saveVersion(project.id, label)) setLabel('');
          }}
        >
          <input className="input grow" aria-label="Nombre de la versión" placeholder="Nombre de la versión, ej: Antes del test con clientes" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button tone="primary" type="submit">
            Guardar versión
          </Button>
        </form>
      )}

      <section className="section">
        <h2 className="section-title">Versiones con nombre</h2>
        {versions.length === 0 ? (
          <Empty title="Sin versiones guardadas">Guarda una antes de cambios grandes para volver sin depender de tu memoria.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Versión</th>
                  <th>Guardó</th>
                  <th>Cuándo</th>
                  <th>Pantallas</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong>{v.label}</strong>
                      <div className="muted small">Edición v{v.snapshot.version}</div>
                    </td>
                    <td>{userName(db, v.createdBy)}</td>
                    <td className="muted">{timeAgo(v.createdAt)}</td>
                    <td>{v.snapshot.screens.filter((s) => !s.variantOf).length}</td>
                    <td className="t-right nowrap">
                      <Button size="sm" tone="ghost" onClick={() => setCompare(v)}>
                        Comparar
                      </Button>
                      {can(role, 'edit') && (
                        <Button size="sm" onClick={() => setRestore(v)}>
                          Restaurar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Actividad reciente</h2>
        {activity.length === 0 ? (
          <p className="muted">Todavía no hay cambios registrados.</p>
        ) : (
          <ol className="activity">
            {activity.map((a) => (
              <li key={a.key}>
                <span>
                  <strong>{userName(db, a.by)}</strong> {a.label}
                  {a.count > 1 && <span className="muted"> ({a.count} operaciones)</span>}
                </span>
                <time className="muted small">{timeAgo(a.at)}</time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Modal open={!!compare} title={`Comparar «${compare?.label ?? ''}» con el estado actual`} onClose={() => setCompare(undefined)} footer={<Button onClick={() => setCompare(undefined)}>Cerrar</Button>}>
        {compare && (
          <ul className="plain-list">
            {diffSummary(compare.snapshot, project).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={!!restore}
        title="Restaurar versión"
        onClose={() => setRestore(undefined)}
        footer={
          <>
            <Button onClick={() => setRestore(undefined)}>Cancelar</Button>
            <Button
              tone="primary"
              onClick={() => {
                if (restore && restoreVersion(restore.id)) setRestore(undefined);
              }}
            >
              Restaurar «{restore?.label}»
            </Button>
          </>
        }
      >
        <p>El proyecto volverá a como estaba en «{restore?.label}». Antes guardaremos el estado actual como una versión nueva, así que no se pierde nada.</p>
        {restore && (
          <ul className="plain-list small">
            {diffSummary(restore.snapshot, project).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
