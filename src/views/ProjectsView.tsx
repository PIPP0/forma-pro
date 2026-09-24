import { useState } from 'react';
import type { Project } from '../lib/model';
import { createProject, currentUser, deleteProject, projectsFor, useDb } from '../lib/store';
import { ROLE_LABEL, can, roleFor } from '../lib/permissions';
import { go, href } from '../lib/router';
import { CATALOG } from '../lib/catalog';
import { Badge, Button, Empty, Field, Modal, timeAgo } from '../components/ui';
import { useCloudAccount } from '../components/useCloudAccount';
import { sincronizarAhora, useEstadoSync } from '../components/useSync';

export function ProjectsView() {
  const db = useDb();
  const user = currentUser(db)!;
  const projects = projectsFor(db, user).sort((a, b) => b.updatedAt - a.updatedAt);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [template, setTemplate] = useState<'blank' | 'transfer' | 'bancoNew'>('blank');
  const [withSystem, setWithSystem] = useState(false);
  const [toDelete, setToDelete] = useState<Project>();

  const create = () => {
    const id = createProject({ name, business, template, withSystem });
    if (id) {
      setOpen(false);
      setName('');
      setBusiness('');
      go(`/p/${id}/screens`);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Proyectos</h1>
          <p className="page-sub">Cada proyecto guarda su sistema, sus pantallas, sus estudios y su historial en un mismo modelo.</p>
        </div>
        <Button tone="primary" onClick={() => setOpen(true)}>
          Nuevo proyecto
        </Button>
      </div>

      <DondeViven />

      {projects.length === 0 ? (
        <Empty
          title="Aún no tienes proyectos"
          action={
            <Button tone="primary" onClick={() => setOpen(true)}>
              Crear proyecto
            </Button>
          }
        >
          Empieza en blanco o parte del flujo de ahorro de ejemplo.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Negocio</th>
                <th>Tu rol</th>
                <th>Pantallas</th>
                <th>Estudios</th>
                <th>Actualizado</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const role = roleFor(db, p, user)!;
                return (
                  <tr key={p.id}>
                    <td>
                      <a className="strong-link" href={href(`/p/${p.id}/screens`)}>
                        {p.name}
                      </a>
                    </td>
                    <td>{p.business || <span className="muted">Sin definir</span>}</td>
                    <td>
                      <Badge>{ROLE_LABEL[role]}</Badge>
                    </td>
                    <td>{p.screens.filter((s) => !s.variantOf).length}</td>
                    <td>{db.studies.filter((s) => s.projectId === p.id).length}</td>
                    <td className="muted">{timeAgo(p.updatedAt)}</td>
                    <td className="t-right">
                      {can(role, 'delete') && (
                        <Button size="sm" tone="ghost" onClick={() => setToDelete(p)}>
                          Eliminar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        title="Nuevo proyecto"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button tone="primary" onClick={create}>
              Crear proyecto
            </Button>
          </>
        }
      >
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Onboarding de cuenta digital" autoFocus />
        </Field>
        <Field label="Negocio" hint="Ayuda al copiloto a proponer contenido específico.">
          <input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Ej: Banca personal" />
        </Field>
        <fieldset className="choice">
          <legend className="field-label">Punto de partida</legend>
          <label className="check">
            <input type="radio" name="tpl" checked={template === 'blank'} onChange={() => setTemplate('blank')} />
            <span>
              <strong>En blanco</strong>
              <span className="muted"> Una pantalla vacía, sin sistema de diseño. Es el punto de partida para importar desde Figma.</span>
            </span>
          </label>
          <label className="check">
            <input type="radio" name="tpl" checked={template === 'transfer'} onChange={() => setTemplate('transfer')} />
            <span>
              <strong>Flujo de ahorro</strong>
              <span className="muted"> Cinco pantallas conectadas y la biblioteca completa de {CATALOG.length} componentes.</span>
            </span>
          </label>
          <label className="check">
            <input type="radio" name="tpl" checked={template === 'bancoNew'} onChange={() => setTemplate('bancoNew')} />
            <span>
              <strong>Banco New · app móvil</strong>
              <span className="muted"> 19 pantallas de banca (cuentas, tarjetas, transferencias, créditos, inversiones y encuesta) y la biblioteca completa.</span>
            </span>
          </label>
        </fieldset>
        {template === 'blank' && (
          <label className="check">
            <input type="checkbox" checked={withSystem} onChange={(e) => setWithSystem(e.target.checked)} />
            <span>
              Incluir el sistema de diseño
              <span className="muted"> Biblioteca de {CATALOG.length} componentes para armar pantallas dentro de Forma. Puedes agregarla después desde Sistema.</span>
            </span>
          </label>
        )}
      </Modal>

      <Modal
        open={!!toDelete}
        title="Eliminar proyecto"
        onClose={() => setToDelete(undefined)}
        footer={
          <>
            <Button onClick={() => setToDelete(undefined)}>Cancelar</Button>
            <Button
              tone="danger"
              onClick={() => {
                if (toDelete && deleteProject(toDelete.id)) setToDelete(undefined);
              }}
            >
              Eliminar proyecto
            </Button>
          </>
        }
      >
        <p>
          Se eliminarán «{toDelete?.name}», sus versiones, estudios, sesiones y comentarios. Esta acción no se puede deshacer. Si quieres conservar una copia, exporta un respaldo desde Ajustes antes.
        </p>
      </Modal>
    </div>
  );
}

/** Aquí es donde alguien descubre que le faltan proyectos: conviene decirle dónde están. */
function DondeViven() {
  const { account, loading } = useCloudAccount();
  const sync = useEstadoSync();
  if (loading) return null;

  if (!account?.email)
    return (
      <div className="notice donde-viven">
        <span>
          Estos proyectos viven solo en este navegador. <strong>Guarda tu acceso con tu correo</strong> y los verás en cualquier computador, con sus pantallas y sus resultados.
        </span>
        <a className="btn btn-default btn-sm" href={href('/settings')}>
          Guardar mi acceso
        </a>
      </div>
    );

  if (sync.error)
    return (
      <div className="notice notice-warn donde-viven">
        <span>
          No pudimos sincronizar con tu cuenta, así que puede que falten proyectos de otros equipos. {sync.error}
        </span>
        <Button size="sm" disabled={sync.sincronizando} onClick={() => void sincronizarAhora(true)}>
          Reintentar
        </Button>
      </div>
    );

  if (sync.sincronizando && !sync.ultima)
    return (
      <div className="notice donde-viven">
        <span>Trayendo tus proyectos desde tu cuenta…</span>
      </div>
    );

  return null;
}
