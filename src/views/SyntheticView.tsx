// Usuarios sintéticos: seis perfiles de banca que recorren un estudio y dejan resultados etiquetados como tales.
import { useMemo, useState, type CSSProperties } from 'react';
import type { Breakpoint, Project, Role, Study, SyntheticUser } from '../lib/model';
import { addSyntheticSessions, deleteSynthetic, saveSynthetic, useDb } from '../lib/store';
import { can } from '../lib/permissions';
import { simularTanda } from '../lib/synthetic';
import { uid } from '../lib/ids';
import { go, href } from '../lib/router';
import { notify } from '../lib/toast';
import { Badge, Button, EmptyCard, Field, Modal, PageHead, Tabs } from '../components/ui';
import { IconChart, IconMinus, IconPlay, IconPlus, IconSparkle, IconTarget, IconTrash } from '../components/icons';

const TRAZOS: { id: keyof SyntheticUser['traits']; label: string; bajo: string; alto: string }[] = [
  { id: 'digital', label: 'Soltura digital', bajo: 'Necesita ayuda', alto: 'Se mueve solo' },
  { id: 'paciencia', label: 'Paciencia', bajo: 'Abandona pronto', alto: 'Insiste' },
  { id: 'lectura', label: 'Lectura', bajo: 'Salta el texto', alto: 'Lee todo' },
  { id: 'cautela', label: 'Cautela', bajo: 'Prueba y ve', alto: 'Confirma dos veces' },
  { id: 'prisa', label: 'Prisa', bajo: 'Con calma', alto: 'Entre dos cosas' },
];

const DISPOSITIVOS: { id: Breakpoint; label: string }[] = [
  { id: 'mobile', label: 'Móvil' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'desktop', label: 'Escritorio' },
];

const TINTES = ['#5b4de0', '#0f7b8a', '#b4553a', '#7b3fa0', '#2f6d3f', '#a84d6e'];

const iniciales = (n: string) =>
  n
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

const tinte = (i: number) => TINTES[i % TINTES.length];

const nuevaPersona = (): SyntheticUser => ({
  id: uid('sy_'),
  name: '',
  age: 30,
  segment: '',
  role: '',
  city: '',
  bio: '',
  quote: '',
  goals: [],
  frustrations: [],
  device: 'mobile',
  traits: { digital: 3, paciencia: 3, lectura: 3, cautela: 3, prisa: 3 },
  createdAt: Date.now(),
});

export function SyntheticView({ project, role, openRun }: { project: Project; role: Role; openRun?: boolean }) {
  const db = useDb();
  const manage = can(role, 'runStudy');
  const [tab, setTab] = useState<'perfiles' | 'probar'>(openRun ? 'probar' : 'perfiles');
  const [editando, setEditando] = useState<SyntheticUser>();
  const [aEliminar, setAEliminar] = useState<SyntheticUser>();
  const personas = db.synthetics;

  return (
    <div className="page page-wide">
      <PageHead
        eyebrow="USUARIOS SINTÉTICOS"
        title="Seis personas que prueban antes que nadie."
        sub="Perfiles de banca con hábitos, prisas y manías distintas. Recorren tu prototipo y te muestran dónde se traba antes de convocar gente real."
        actions={
          manage && (
            <Button tone="primary" onClick={() => setEditando(nuevaPersona())}>
              <IconPlus size={16} /> Crear persona
            </Button>
          )
        }
      />

      <Tabs
        label="Secciones de usuarios sintéticos"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'perfiles', label: `Perfiles · ${personas.length}` },
          { id: 'probar', label: 'Probar con usuarios sintéticos' },
        ]}
      />

      {tab === 'perfiles' ? (
        <>
          <div className="persona-grid">
            {personas.map((u, i) => (
              <PersonaCard
                key={u.id}
                u={u}
                color={tinte(i)}
                manage={manage}
                onEdit={() => setEditando(u)}
                onCopy={() => saveSynthetic({ ...u, id: uid('sy_'), name: `${u.name} (copia)`, builtIn: undefined, createdAt: Date.now() })}
                onDelete={() => setAEliminar(u)}
              />
            ))}
          </div>
          <p className="muted small nota-sintetica">
            Una persona sintética es un modelo de comportamiento, no un usuario real. Sirve para encontrar tropiezos evidentes y preparar mejor una prueba con gente; sus resultados quedan siempre marcados como sintéticos.
          </p>
        </>
      ) : (
        <RunPanel project={project} manage={manage} personas={personas} />
      )}

      {editando && <PersonaModal inicial={editando} onClose={() => setEditando(undefined)} />}

      <Modal
        open={!!aEliminar}
        title="Eliminar esta persona"
        onClose={() => setAEliminar(undefined)}
        footer={
          <>
            <Button onClick={() => setAEliminar(undefined)}>Cancelar</Button>
            <Button
              tone="danger"
              onClick={() => {
                if (aEliminar) deleteSynthetic(aEliminar.id);
                setAEliminar(undefined);
              }}
            >
              Eliminar persona
            </Button>
          </>
        }
      >
        <p>
          {aEliminar?.name} dejará de estar disponible para nuevas tandas. Las sesiones que ya generó se mantienen en los resultados.
        </p>
      </Modal>
    </div>
  );
}

function Trazos({ t }: { t: SyntheticUser['traits'] }) {
  return (
    <dl className="persona-traits">
      {TRAZOS.map((r) => (
        <div key={r.id}>
          <dt>{r.label}</dt>
          <dd>
            <span className="trait-bar" role="img" aria-label={`${r.label}: ${t[r.id]} de 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <i key={n} className={n <= t[r.id] ? 'on' : ''} />
              ))}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PersonaCard({
  u,
  color,
  manage,
  onEdit,
  onCopy,
  onDelete,
}: {
  u: SyntheticUser;
  color: string;
  manage: boolean;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="card persona" style={{ '--tinte': color } as CSSProperties}>
      <header className="persona-top">
        <span className="persona-av" aria-hidden="true">
          {iniciales(u.name) || '·'}
        </span>
        <span className="persona-id">
          <strong>{u.name || 'Sin nombre'}</strong>
          <span className="muted small">
            {u.age} años · {u.city}
          </span>
        </span>
        <Badge tone="accent">{u.segment}</Badge>
      </header>
      <p className="persona-role">{u.role}</p>
      {u.quote && <blockquote className="persona-quote">{u.quote}</blockquote>}
      {u.bio && <p className="persona-bio">{u.bio}</p>}
      <div className="persona-cols">
        <div>
          <h4>Quiere</h4>
          <ul className="plain-list small">
            {u.goals.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Le frena</h4>
          <ul className="plain-list small">
            {u.frustrations.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      </div>
      <Trazos t={u.traits} />
      <footer className="persona-acts">
        <span className="muted small">{DISPOSITIVOS.find((d) => d.id === u.device)?.label ?? 'Móvil'}</span>
        {manage && (
          <span className="row">
            <Button size="sm" onClick={onEdit}>
              Editar
            </Button>
            <Button size="sm" onClick={onCopy}>
              Duplicar
            </Button>
            {!u.builtIn && (
              <button type="button" className="icon-btn" title={`Eliminar a ${u.name}`} aria-label={`Eliminar a ${u.name}`} onClick={onDelete}>
                <IconTrash size={15} />
              </button>
            )}
          </span>
        )}
      </footer>
    </article>
  );
}

const lineas = (v: string) =>
  v
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

function PersonaModal({ inicial, onClose }: { inicial: SyntheticUser; onClose: () => void }) {
  const [u, setU] = useState(inicial);
  const [goals, setGoals] = useState(inicial.goals.join('\n'));
  const [frus, setFrus] = useState(inicial.frustrations.join('\n'));
  const set = (patch: Partial<SyntheticUser>) => setU((x) => ({ ...x, ...patch }));
  const listo = u.name.trim().length > 1 && u.segment.trim().length > 1;

  return (
    <Modal
      open
      wide
      title={inicial.name ? `Editar a ${inicial.name}` : 'Crear persona sintética'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            tone="primary"
            disabled={!listo}
            onClick={() => {
              saveSynthetic({ ...u, name: u.name.trim(), segment: u.segment.trim(), goals: lineas(goals), frustrations: lineas(frus) });
              onClose();
            }}
          >
            Guardar persona
          </Button>
        </>
      }
    >
      <p className="muted modal-lede">Los rasgos definen cómo recorre el prototipo: cuánto lee, cuánto aguanta y qué tan rápido toca.</p>
      <div className="grid-2">
        <Field label="Nombre y apellido">
          <input value={u.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej: Camila Torres" autoFocus />
        </Field>
        <Field label="Segmento">
          <input value={u.segment} onChange={(e) => set({ segment: e.target.value })} placeholder="Ej: Emprendedor" />
        </Field>
        <Field label="Edad">
          <input type="number" min={16} max={95} value={u.age} onChange={(e) => set({ age: Number(e.target.value) || 30 })} />
        </Field>
        <Field label="Ciudad o comuna">
          <input value={u.city} onChange={(e) => set({ city: e.target.value })} placeholder="Ej: Concepción" />
        </Field>
        <Field label="Ocupación" className="span-2">
          <input value={u.role} onChange={(e) => set({ role: e.target.value })} placeholder="Ej: Dueña de un taller de costura" />
        </Field>
      </div>
      <Field label="Contexto" hint="Cómo y cuándo usa la app.">
        <textarea rows={3} value={u.bio} onChange={(e) => set({ bio: e.target.value })} />
      </Field>
      <Field label="Frase propia" hint="Algo que diría en una entrevista.">
        <textarea rows={2} value={u.quote} onChange={(e) => set({ quote: e.target.value })} />
      </Field>
      <div className="grid-2">
        <Field label="Qué quiere lograr" hint="Uno por línea.">
          <textarea rows={4} value={goals} onChange={(e) => setGoals(e.target.value)} />
        </Field>
        <Field label="Qué la frena" hint="Uno por línea.">
          <textarea rows={4} value={frus} onChange={(e) => setFrus(e.target.value)} />
        </Field>
      </div>
      <Field label="Dispositivo habitual">
        <select className="input" value={u.device} onChange={(e) => set({ device: e.target.value as Breakpoint })}>
          {DISPOSITIVOS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="choice">
        <legend className="field-label">Rasgos de comportamiento</legend>
        <div className="trait-edit">
          {TRAZOS.map((r) => (
            <label key={r.id} className="slider">
              <span className="trait-edit-head">
                <span>{r.label}</span>
                <span className="muted small">{u.traits[r.id] <= 2 ? r.bajo : u.traits[r.id] >= 4 ? r.alto : 'Intermedio'}</span>
              </span>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={u.traits[r.id]}
                style={{ '--pct': `${((u.traits[r.id] - 1) / 4) * 100}%` } as CSSProperties}
                onChange={(e) => set({ traits: { ...u.traits, [r.id]: Number(e.target.value) } })}
              />
            </label>
          ))}
        </div>
      </fieldset>
    </Modal>
  );
}

const TOPE = 10;

function RunPanel({ project, manage, personas }: { project: Project; manage: boolean; personas: SyntheticUser[] }) {
  const db = useDb();
  const studies = useMemo(() => db.studies.filter((s) => s.projectId === project.id).sort((a, b) => b.created - a.created), [db.studies, project.id]);
  const [studyId, setStudyId] = useState(studies[0]?.id ?? '');
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [corriendo, setCorriendo] = useState(false);
  const study: Study | undefined = studies.find((s) => s.id === studyId) ?? studies[0];
  const total = Object.values(cantidades).reduce((a, b) => a + b, 0);
  const elegidas = personas.filter((p) => (cantidades[p.id] ?? 0) > 0);

  const ajustar = (id: string, delta: number) =>
    setCantidades((c) => {
      const actual = c[id] ?? 0;
      const suma = Object.values(c).reduce((a, b) => a + b, 0);
      const siguiente = Math.max(0, Math.min(actual + delta, actual + (TOPE - suma)));
      return { ...c, [id]: siguiente };
    });

  const correr = () => {
    if (!study || !total) return;
    setCorriendo(true);
    // La simulación es instantánea; la pausa deja ver que algo pasó antes de saltar a resultados.
    window.setTimeout(() => {
      const salidas = simularTanda(
        study,
        elegidas.map((p) => ({ persona: p, cantidad: cantidades[p.id] ?? 0 })),
      );
      const n = addSyntheticSessions(study.id, salidas);
      setCorriendo(false);
      if (!n) return;
      setCantidades({});
      notify(`Listo: ${n} ${n === 1 ? 'sesión sintética' : 'sesiones sintéticas'} en «${study.name}».`, 'success');
      go(`/p/${project.id}/results/${study.id}`);
    }, 450);
  };

  if (!studies.length)
    return (
      <EmptyCard
        icon={<IconTarget size={30} />}
        title="Primero necesitas un estudio"
        text="Las personas sintéticas recorren las tareas de un estudio. Crea uno y vuelve aquí."
        action={
          <a className="btn btn-primary" href={href(`/p/${project.id}/studies?new=1`)}>
            Crear estudio
          </a>
        }
      />
    );

  return (
    <div className="run-grid">
      <div className="card run-pick">
        <section className="card-section">
          <h2 className="section-title">Sobre qué estudio</h2>
          <Field label="Estudio" hint={study ? `${study.tasks.length} ${study.tasks.length === 1 ? 'tarea' : 'tareas'} · versión v${study.snapshot.version}` : undefined}>
            <select className="input" value={study?.id ?? ''} onChange={(e) => setStudyId(e.target.value)}>
              {studies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </section>
        <section className="card-section">
          <div className="list-head compact">
            <h2 className="section-title">A quién quieres invitar</h2>
            <span className={`count-pill ${total === TOPE ? 'full' : ''}`}>{total} de {TOPE}</span>
          </div>
          <ul className="pick-list">
            {personas.map((u, i) => {
              const n = cantidades[u.id] ?? 0;
              return (
                <li key={u.id} className={n ? 'elegida' : ''}>
                  <span className="persona-av sm" style={{ '--tinte': tinte(i) } as CSSProperties} aria-hidden="true">
                    {iniciales(u.name) || '·'}
                  </span>
                  <span className="pick-main">
                    <strong>{u.name}</strong>
                    <span className="muted small">
                      {u.segment} · {u.age} años
                    </span>
                  </span>
                  <span className="stepper">
                    <button type="button" className="icon-btn" disabled={n === 0} aria-label={`Quitar una sesión de ${u.name}`} onClick={() => ajustar(u.id, -1)}>
                      <IconMinus size={14} />
                    </button>
                    <span className="stepper-n" aria-live="polite">
                      {n}
                    </span>
                    <button type="button" className="icon-btn" disabled={total >= TOPE} aria-label={`Agregar una sesión de ${u.name}`} onClick={() => ajustar(u.id, 1)}>
                      <IconPlus size={14} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <aside className="card run-side">
        <h2 className="section-title">La tanda</h2>
        {total === 0 ? (
          <p className="muted small">Elige entre 1 y {TOPE} sesiones. Puedes repetir un mismo perfil: dos personas iguales no se comportan igual.</p>
        ) : (
          <ul className="run-resumen">
            {elegidas.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <span className="muted">×{cantidades[p.id]}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">
          Cada sesión recorre {study?.tasks.length ?? 0} {study?.tasks.length === 1 ? 'tarea' : 'tareas'} y deja sus toques, dudas y comentarios. Quedan marcadas como sintéticas y puedes ocultarlas en Resultados.
        </p>
        <Button tone="primary" disabled={!manage || !total || corriendo} onClick={correr}>
          {corriendo ? (
            <>
              <IconSparkle size={16} /> Recorriendo el prototipo…
            </>
          ) : (
            <>
              <IconPlay size={15} /> Probar con {total || 'los'} {total === 1 ? 'usuario' : 'usuarios'}
            </>
          )}
        </Button>
        {!!total && (
          <Button size="sm" onClick={() => setCantidades({})}>
            Limpiar selección
          </Button>
        )}
        {study && (
          <a className="run-link" href={href(`/p/${project.id}/results/${study.id}`)}>
            <IconChart size={14} /> Ver resultados de este estudio
          </a>
        )}
      </aside>
    </div>
  );
}
