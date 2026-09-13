import { useEffect, useMemo, useState } from 'react';
import type { Project, Role, Session, Study, StudyEvent, StudyTask } from '../lib/model';
import { baseId } from '../lib/model';
import { createStudy, deleteStudy, importResults, refreshFromStorage, setStudyStatus, useDb, userName } from '../lib/store';
import { can } from '../lib/permissions';
import { checkProject, hasBlockingErrors } from '../lib/flowCheck';
import { analyzeStudy, blockLabel, buildAiDataset, consentedSessions, fmt1, fmtDuration, overview, screenName, taskFunnel, type Overview } from '../lib/analysis';
import { summarizeResearch, getAiKey, type VerifiedTheme } from '../lib/ai';
import { download, resultsFile, studyLink, toCsv } from '../lib/share';
import { getAudio } from '../lib/blobs';
import { go, href } from '../lib/router';
import { Heatmap } from '../components/Heatmap';
import { Badge, Button, EmptyCard, Field, Modal, PageHead, Tabs, copyText, pickFile, timeAgo } from '../components/ui';
import { IconChart, IconCheck, IconChevronRight, IconPlay, IconPlus, IconRefresh, IconTarget } from '../components/icons';

const KIND_LABEL: Record<StudyEvent['kind'], string> = {
  task_start: 'Empezó la tarea',
  tap: 'Tocó',
  misclick: 'Tocó una zona sin acción',
  blocked: 'Intentó continuar sin completar un campo obligatorio',
  navigate: 'Llegó a',
  hesitation: 'Dudó antes de tocar',
  input: 'Escribió en',
  task_success: 'Completó la tarea',
  task_giveup: 'Abandonó la tarea',
};

const STEPS = [
  { title: 'Define la tarea', text: 'Indica qué debe intentar completar la persona.' },
  { title: 'Comparte la experiencia', text: 'Abre el enlace en un celular o en el navegador.' },
  { title: 'Escucha y observa', text: 'Registra interacciones y, con permiso, audio.' },
];

export const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// ---------- Pruebas ----------

export function StudiesView({ project, role, openNew }: { project: Project; role: Role; openNew?: boolean }) {
  const db = useDb();
  const studies = db.studies.filter((s) => s.projectId === project.id).sort((a, b) => b.created - a.created);
  const manage = can(role, 'runStudy');
  const [open, setOpen] = useState(!!openNew && manage);
  useEffect(() => {
    if (openNew && manage) setOpen(true);
  }, [openNew, manage]);
  const flow = (project.flowName || 'flujo').toLowerCase();

  return (
    <div className="page page-wide">
      <PageHead
        eyebrow="INVESTIGACIÓN CON USUARIOS"
        title="De la intención a la interacción."
        sub="Prueba una versión de tu experiencia y observa qué sucede."
        actions={
          manage && (
            <Button tone="primary" onClick={() => setOpen(true)}>
              <IconPlus size={16} /> Crear estudio
            </Button>
          )
        }
      />

      <section className="card hero-card">
        <div className="hero-left">
          <span className="icon-tile">
            <IconTarget size={26} />
          </span>
          <h2 className="hero-title">
            Una tarea clara.
            <br />
            Aprendizajes que importan.
          </h2>
          <p className="muted">Cada estudio conserva sus pantallas, estilos e interacciones. Puedes seguir diseñando sin alterar una prueba en curso.</p>
          <a className="btn btn-outline" href={href(`/p/${project.id}/screens?play=1`)}>
            <IconPlay size={15} /> Explorar el demo
          </a>
        </div>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="step-text">
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </span>
              <IconCheck size={18} className="step-check" />
            </li>
          ))}
        </ol>
      </section>

      <div className="list-head">
        <h2>
          Tus estudios <span className="count-pill">{studies.length}</span>
        </h2>
        <Button onClick={refreshFromStorage}>
          <IconRefresh size={16} /> Actualizar
        </Button>
      </div>

      {studies.length === 0 ? (
        <EmptyCard
          icon={<IconTarget size={30} />}
          title="Tu primer estudio empieza aquí"
          text={`Crea una prueba del ${flow} y comienza a recoger evidencia.`}
          action={
            manage && (
              <Button tone="primary" onClick={() => setOpen(true)}>
                Crear primer estudio
              </Button>
            )
          }
        />
      ) : (
        <div className="study-list">
          {studies.map((s) => {
            const sessions = consentedSessions(s, db.sessions).length;
            return (
              <a key={s.id} className="card study-row" href={href(`/p/${project.id}/results/${s.id}`)}>
                <span className="icon-tile sm">
                  <IconTarget size={18} />
                </span>
                <span className="study-row-main">
                  <strong>{s.name}</strong>
                  <span className="muted small">
                    {s.tasks.length} {s.tasks.length === 1 ? 'tarea' : 'tareas'} · {sessions} {sessions === 1 ? 'sesión' : 'sesiones'} · versión v{s.snapshot.version} · {timeAgo(s.created)}
                  </span>
                </span>
                <span className="row">
                  {s.example && <Badge tone="warn">Datos de ejemplo</Badge>}
                  {s.askAudio && <Badge>Audio</Badge>}
                  {s.status === 'open' ? <Badge tone="ok">Abierto</Badge> : <Badge>Cerrado</Badge>}
                </span>
                <span className="study-row-go">
                  Ver resultados <IconChevronRight size={15} />
                </span>
              </a>
            );
          })}
        </div>
      )}

      <NewStudyModal project={project} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewStudyModal({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const bases = project.screens.filter((s) => !s.variantOf);
  const firstFinal = bases.find((s) => s.terminal)?.id ?? '';
  const [name, setName] = useState('');
  const [askAudio, setAskAudio] = useState(false);
  const [tasks, setTasks] = useState<Omit<StudyTask, 'id'>[]>([{ prompt: '', startScreenId: project.startScreenId, successScreenId: firstFinal }]);
  const issues = useMemo(() => checkProject(project), [project]);
  const blocked = hasBlockingErrors(issues);

  const update = (i: number, patch: Partial<Omit<StudyTask, 'id'>>) => setTasks((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const publish = () => {
    const id = createStudy(project.id, { name, tasks, askAudio });
    if (id) {
      onClose();
      go(`/p/${project.id}/results/${id}`);
    }
  };

  return (
    <Modal
      open={open}
      wide
      title="Crear estudio"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button tone="primary" disabled={blocked} onClick={publish}>
            Publicar estudio
          </Button>
        </>
      }
    >
      <p className="muted modal-lede">Define qué debe intentar la persona. El estudio usa una copia congelada de la versión v{project.version}, así puedes seguir diseñando sin alterar la prueba.</p>
      {blocked && (
        <div className="notice notice-err">
          El guardarraíl encontró errores críticos. No se puede publicar un estudio con errores de flujo o accesibilidad.{' '}
          <a href={href(`/p/${project.id}/screens`)} onClick={onClose}>
            Revisar en Diseñar
          </a>
          <ul className="plain-list small">
            {issues
              .filter((i) => i.severity === 'error')
              .slice(0, 5)
              .map((i) => (
                <li key={i.id}>{i.message}</li>
              ))}
          </ul>
        </div>
      )}
      <Field label="Nombre del estudio">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Primera meta de ahorro" autoFocus />
      </Field>
      <fieldset className="choice">
        <legend className="field-label">Tareas, en orden</legend>
        <ol className="task-editor">
          {tasks.map((t, i) => (
            <li key={i}>
              <Field label={`Instrucción de la tarea ${i + 1}`}>
                <textarea rows={2} value={t.prompt} onChange={(e) => update(i, { prompt: e.target.value })} placeholder="Escríbela como se la dirías a la persona. Ej: Crea una meta de ahorro de $500.000." />
              </Field>
              <div className="grid-2">
                <Field label="Empieza en">
                  <select value={t.startScreenId} onChange={(e) => update(i, { startScreenId: e.target.value })}>
                    {bases.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Se completa al llegar a">
                  <select value={t.successScreenId} onChange={(e) => update(i, { successScreenId: e.target.value })}>
                    <option value="">Elige una pantalla</option>
                    {bases.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {tasks.length > 1 && (
                <Button size="sm" tone="ghost" onClick={() => setTasks((ts) => ts.filter((_, j) => j !== i))}>
                  Quitar tarea
                </Button>
              )}
            </li>
          ))}
        </ol>
        <Button size="sm" onClick={() => setTasks((ts) => [...ts, { prompt: '', startScreenId: project.startScreenId, successScreenId: '' }])}>
          <IconPlus size={14} /> Agregar tarea
        </Button>
      </fieldset>
      <button type="button" role="switch" aria-checked={askAudio} className="switch-row" onClick={() => setAskAudio((v) => !v)}>
        <span>
          <strong>Grabar audio en el prototipo</strong>
          <span className="muted small">Quien participa verá un interruptor que le pregunta si quiere grabar. Puede hacer la prueba sin grabar y apagarlo en cualquier momento.</span>
        </span>
        <span className={`switch ${askAudio ? 'on' : ''}`} aria-hidden="true">
          <i />
        </span>
      </button>
    </Modal>
  );
}

// ---------- Resultados ----------

export function ResultsView({ project, role, studyId }: { project: Project; role: Role; studyId?: string }) {
  const db = useDb();
  const studies = db.studies.filter((s) => s.projectId === project.id).sort((a, b) => b.created - a.created);
  const study = studies.find((s) => s.id === studyId) ?? studies[0];
  return (
    <div className="page page-wide">
      <PageHead
        eyebrow="EVIDENCIA, NO SUPOSICIONES"
        title="Cada interacción cuenta."
        sub="Resultados reales de tus pruebas. Sin sesiones ni métricas inventadas."
        actions={
          <Button onClick={refreshFromStorage}>
            <IconRefresh size={16} /> Actualizar
          </Button>
        }
      />
      {!study ? (
        <EmptyCard
          icon={<IconChart size={32} />}
          title="Todavía no hay estudios"
          text="Crea una prueba para empezar a registrar sesiones."
          action={
            can(role, 'runStudy') && (
              <a className="btn btn-primary" href={href(`/p/${project.id}/studies?new=1`)}>
                Crear estudio
              </a>
            )
          }
        />
      ) : (
        <StudyDetail key={study.id} project={project} role={role} study={study} studies={studies} />
      )}
    </div>
  );
}

function StudyDetail({ project, role, study, studies }: { project: Project; role: Role; study: Study; studies: Study[] }) {
  const db = useDb();
  const sessions = db.sessions.filter((s) => s.studyId === study.id);
  const events = db.events.filter((e) => sessions.some((s) => s.id === e.sessionId));
  const analysis = analyzeStudy(study, sessions, events);
  const snap = study.snapshot;
  const manage = can(role, 'runStudy');
  const [openSession, setOpenSession] = useState<{ id: string; at?: number }>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [link, setLink] = useState('');

  useEffect(() => {
    let alive = true;
    studyLink(study).then((l) => alive && setLink(l));
    return () => {
      alive = false;
    };
  }, [study]);

  const exportJson = () => download(`${slug(study.name)}-resultados.json`, resultsFile(study.id, sessions, events));
  const exportCsv = () => {
    const rows = [['sesion', 'participante', 'tarea', 'evento', 'pantalla', 'bloque', 'x', 'y', 'ms_desde_inicio', 'duda_ms']];
    for (const e of events) {
      const s = sessions.find((x) => x.id === e.sessionId)!;
      rows.push([s.id, s.participant, study.tasks.find((t) => t.id === e.taskId)?.prompt ?? e.taskId, e.kind, screenName(snap, e.screen), blockLabel(snap, e.block), String(e.x), String(e.y), String(e.elapsed), e.dwell != null ? String(e.dwell) : '']);
    }
    download(`${slug(study.name)}-eventos.csv`, toCsv(rows), 'text/csv');
  };

  return (
    <>
      <section className="card study-head">
        <div className="study-head-main">
          {studies.length > 1 ? (
            <select className="input study-select" aria-label="Estudio" value={study.id} onChange={(e) => go(`/p/${project.id}/results/${e.target.value}`)}>
              {studies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <h2 className="card-title">{study.name}</h2>
          )}
          <p className="muted small">
            {analysis.total} {analysis.total === 1 ? 'sesión con consentimiento' : 'sesiones con consentimiento'}, sobre la versión v{snap.version}. Publicado por {userName(db, study.owner)} {timeAgo(study.created)}.
          </p>
          <div className="row">
            {study.status === 'open' ? <Badge tone="ok">Abierto</Badge> : <Badge>Cerrado</Badge>}
            {study.example && <Badge tone="warn">Datos de ejemplo simulados</Badge>}
            {study.askAudio && <Badge>Pide audio</Badge>}
          </div>
        </div>
        <div className="row">
          <Button disabled={!link || study.status !== 'open'} onClick={() => window.open(link, '_blank', 'noopener')}>
            <IconPlay size={14} /> Abrir como participante
          </Button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button
              disabled={!link || study.status !== 'open'}
              onClick={() => navigator.share({ title: study.name, text: 'Te invito a probar un prototipo. Toma unos 5 minutos y no necesitas cuenta.', url: link }).catch(() => undefined)}
            >
              Compartir
            </Button>
          )}
          <Button tone="primary" disabled={!link || study.status !== 'open'} onClick={() => copyText(link, 'Copiaste el enlace público del estudio.')}>
            Copiar enlace
          </Button>
        </div>
      </section>

      <div className="study-tools">
        <p className="muted small">
          El enlace lleva la copia congelada del prototipo y se instala como app en el celular. Si alguien participa desde otro dispositivo, te envía un archivo de resultados que importas aquí.
        </p>
        <div className="row">
          <Button size="sm" onClick={exportJson}>
            Exportar JSON
          </Button>
          <Button size="sm" onClick={exportCsv}>
            Exportar CSV
          </Button>
          {manage && (
            <>
              <Button
                size="sm"
                onClick={async () => {
                  const t = await pickFile('.json');
                  if (t) importResults(t);
                }}
              >
                Importar resultados
              </Button>
              <Button size="sm" onClick={() => setStudyStatus(study.id, study.status === 'open' ? 'closed' : 'open')}>
                {study.status === 'open' ? 'Cerrar estudio' : 'Reabrir estudio'}
              </Button>
              <Button size="sm" tone="danger" onClick={() => setConfirmDelete(true)}>
                Eliminar
              </Button>
            </>
          )}
        </div>
      </div>

      {analysis.total === 0 ? (
        <EmptyCard icon={<IconChart size={32} />} title="Todavía no hay sesiones" text="Comparte el enlace. Los resultados aparecen cuando termina la primera sesión." />
      ) : (
        <>
          <Kpis o={overview(study, sessions, events, analysis)} />
          <div className="study-grid">
            <div className="card study-body">
              <section className="card-section">
                <h2 className="section-title">Tareas</h2>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tarea</th>
                        <th>Completada</th>
                        <th>Mediana de tiempo</th>
                        <th>Toques sin acción</th>
                        <th>Dificultad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.tasks.map((t) => (
                        <tr key={t.taskId}>
                          <td>{t.prompt}</td>
                          <td className="nowrap">
                            <div className="bar" role="img" aria-label={`${Math.round(t.successRate * 100)}% completada`}>
                              <span style={{ width: `${t.successRate * 100}%` }} />
                            </div>
                            {t.success} de {t.started}
                          </td>
                          <td>{t.medianMs != null ? fmtDuration(t.medianMs) : 'n/a'}</td>
                          <td>{fmt1(t.avgMisclicks)} por sesión</td>
                          <td>{t.avgDifficulty != null ? `${fmt1(t.avgDifficulty)} de 5` : 'n/a'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <Funnel study={study} sessions={sessions} events={events} />

              <section className="card-section">
                <h2 className="section-title">Hallazgos</h2>
                <p className="muted">Calculados a partir de los eventos de cada sesión. Cada cita abre el momento exacto.</p>
                {analysis.themes.length === 0 && <p className="muted">No se detectaron dudas, bloqueos ni abandonos.</p>}
                {analysis.themes.map((t) => (
                  <article key={t.id} className="theme">
                    <h3>{t.title}</h3>
                    <p>{t.detail}</p>
                    <div className="cites">
                      {t.citations.map((c) => (
                        <button key={`${c.sessionId}-${c.elapsed}`} type="button" className="cite" onClick={() => setOpenSession({ id: c.sessionId, at: c.elapsed })}>
                          {c.participant} en {clock(c.elapsed)}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </section>

              <AiSummary study={study} sessions={sessions} events={events} onOpen={(id) => setOpenSession({ id })} />

              {analysis.quotes.length > 0 && (
                <section className="card-section">
                  <h2 className="section-title">Lo que dijeron</h2>
                  <ul className="quotes">
                    {analysis.quotes.map((q) => (
                      <li key={`${q.sessionId}-${q.taskId}`}>
                        <blockquote>{q.comment}</blockquote>
                        <button type="button" className="cite" onClick={() => setOpenSession({ id: q.sessionId })}>
                          {q.participant}, {study.tasks.find((t) => t.id === q.taskId)?.prompt.replace(/\.$/, '')}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="card-section">
                <h2 className="section-title">Sesiones</h2>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Participante</th>
                        <th>Dispositivo</th>
                        <th>Resultado</th>
                        <th>Audio</th>
                        <th>Origen</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consentedSessions(study, sessions).map((s) => (
                        <tr key={s.id}>
                          <td>
                            <button type="button" className="link-btn strong" onClick={() => setOpenSession({ id: s.id })}>
                              {s.participant}
                            </button>
                          </td>
                          <td>{s.device.breakpoint === 'mobile' ? 'Móvil' : s.device.breakpoint === 'tablet' ? 'Tablet' : 'Escritorio'}</td>
                          <td>
                            <span className="row">
                              {study.tasks.map((t) => {
                                const f = s.feedback.find((x) => x.taskId === t.id);
                                return (
                                  <Badge key={t.id} tone={f?.outcome === 'success' ? 'ok' : f?.outcome === 'giveup' ? 'err' : 'neutral'}>
                                    {f?.outcome === 'success' ? 'Logró' : f?.outcome === 'giveup' ? 'Abandonó' : 'Sin terminar'}
                                  </Badge>
                                );
                              })}
                            </span>
                          </td>
                          <td>{s.hasAudio ? 'Sí' : s.consent.audio ? 'Aceptó, sin archivo' : 'No'}</td>
                          <td>{s.source === 'example' ? 'Ejemplo' : s.source === 'import' ? 'Importada' : 'Este navegador'}</td>
                          <td className="muted">{timeAgo(s.startedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <aside className="study-side">
              <div className="card">
                <HeatmapPanel study={study} events={events} />
              </div>
            </aside>
          </div>
        </>
      )}

      {openSession && (
        <SessionDrawer study={study} session={sessions.find((s) => s.id === openSession.id)} events={events.filter((e) => e.sessionId === openSession.id)} at={openSession.at} onClose={() => setOpenSession(undefined)} />
      )}

      <Modal
        open={confirmDelete}
        title="Eliminar estudio"
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button
              tone="danger"
              onClick={() => {
                deleteStudy(study.id);
                go(`/p/${project.id}/results`);
              }}
            >
              Eliminar estudio y resultados
            </Button>
          </>
        }
      >
        <p>Se eliminarán «{study.name}», sus {sessions.length} sesiones y sus grabaciones. Exporta los resultados antes si quieres conservarlos.</p>
      </Modal>
    </>
  );
}

function Kpis({ o }: { o: Overview }) {
  const items = [
    { label: 'Sesiones', value: String(o.sessions), note: o.withAudio ? `${o.withAudio} con audio` : undefined },
    { label: 'Tareas completadas', value: `${Math.round(o.completion * 100)}%` },
    { label: 'Mediana por tarea', value: o.medianTaskMs != null ? fmtDuration(o.medianTaskMs) : 'n/a' },
    { label: 'Dudas detectadas', value: String(o.hesitations) },
    { label: 'Toques sin acción', value: fmt1(o.misclicksPerSession), note: 'por sesión' },
    { label: 'Dificultad percibida', value: o.avgDifficulty != null ? fmt1(o.avgDifficulty) : 'n/a', note: 'de 5' },
  ];
  return (
    <dl className="kpis card">
      {items.map((i) => (
        <div key={i.label}>
          <dt>{i.label}</dt>
          <dd>
            {i.value}
            {i.note && <span> {i.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Funnel({ study, sessions, events }: { study: Study; sessions: Session[]; events: StudyEvent[] }) {
  const funnels = study.tasks.map((t) => ({ task: t, steps: taskFunnel(study, sessions, events, t.id) })).filter((f) => f.steps.length > 1);
  if (!funnels.length) return null;
  return (
    <section className="card-section">
      <h2 className="section-title">Recorrido por tarea</h2>
      <p className="muted">Cuántas personas llegaron a cada pantalla del camino más corto hacia el objetivo, y dónde se quedaron.</p>
      {funnels.map(({ task, steps }) => (
        <div key={task.id} className="funnel">
          <h3 className="sub-title">{task.prompt}</h3>
          <ol>
            {steps.map((s, i) => {
              const pct = s.started ? s.reached / s.started : 0;
              const drop = i > 0 ? steps[i - 1].reached - s.reached : 0;
              return (
                <li key={s.screenId}>
                  <span className="funnel-name">
                    {String(i + 1).padStart(2, '0')} {s.name}
                  </span>
                  <span className="funnel-bar" role="img" aria-label={`${Math.round(pct * 100)}% llegó a ${s.name}`}>
                    <i style={{ width: `${pct * 100}%` }} />
                  </span>
                  <span className="funnel-num">
                    {s.reached} de {s.started}
                    {drop > 0 && (
                      <em>
                        , {drop} {drop === 1 ? 'se quedó' : 'se quedaron'} antes
                      </em>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </section>
  );
}

function HeatmapPanel({ study, events }: { study: Study; events: StudyEvent[] }) {
  const snap = study.snapshot;
  const touched = snap.screens.filter((s) => events.some((e) => e.screen === s.id && ['tap', 'misclick', 'blocked'].includes(e.kind)));
  const [screenId, setScreenId] = useState(touched[0]?.id);
  const [task, setTask] = useState<string>('all');
  const screen = snap.screens.find((s) => s.id === screenId) ?? touched[0];
  if (!screen) return <p className="muted">Todavía no hay toques registrados.</p>;
  const pts = events.filter((e) => e.screen === screen.id && ['tap', 'misclick', 'blocked'].includes(e.kind) && (task === 'all' || e.taskId === task));
  return (
    <section className="heat-panel">
      <h2 className="section-title">Mapa de calor</h2>
      <div className="stack">
        <Field label="Pantalla">
          <select value={screen.id} onChange={(e) => setScreenId(e.target.value)}>
            {touched.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.variantOf ? ` (${s.breakpoint})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tarea">
          <select value={task} onChange={(e) => setTask(e.target.value)}>
            <option value="all">Todas</option>
            {study.tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.prompt}
              </option>
            ))}
          </select>
        </Field>
        <div className="heat-legend">
          <span>
            <i className="lg lg-tap" /> Toque
          </span>
          <span>
            <i className="lg lg-misclick" /> Sin acción
          </span>
          <span>
            <i className="lg lg-blocked" /> Bloqueado
          </span>
        </div>
        <Heatmap project={snap} screen={screen} events={pts} mode="light" />
        <p className="muted small">
          {pts.length} {pts.length === 1 ? 'toque' : 'toques'} en «{snap.screens.find((s) => s.id === baseId(screen))?.name}».
        </p>
      </div>
    </section>
  );
}

function AiSummary({ study, sessions, events, onOpen }: { study: Study; sessions: Session[]; events: StudyEvent[]; onOpen: (sessionId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ themes: VerifiedTheme[]; discardedThemes: number } | null>(null);
  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const ok = consentedSessions(study, sessions);
      setResult(await summarizeResearch(buildAiDataset(study, sessions, events), new Map(ok.map((s) => [s.id, s.participant]))));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card-section">
      <div className="section-head">
        <h2 className="section-title">Resumen por IA</h2>
        {getAiKey() ? (
          <Button size="sm" disabled={busy} onClick={run}>
            {busy ? 'Agrupando sesiones…' : result ? 'Volver a generar' : 'Generar resumen'}
          </Button>
        ) : (
          <a className="btn btn-default btn-sm" href={href('/settings')}>
            Conectar IA en Ajustes
          </a>
        )}
      </div>
      <p className="muted">Agrupa las sesiones por tema. Solo se muestran afirmaciones con citas a sesiones que existen en este estudio; el resto se descarta.</p>
      {error && <p className="error-text">{error}</p>}
      {result && (
        <>
          {result.themes.map((t, i) => (
            <article key={i} className="theme">
              <h3>{t.title}</h3>
              <p>{t.detail}</p>
              <div className="cites">
                <span className="muted small">
                  Respaldado por {t.session_ids.length} {t.session_ids.length === 1 ? 'sesión' : 'sesiones'}:
                </span>
                {t.session_ids.map((id, j) => (
                  <button key={id} type="button" className="cite" onClick={() => onOpen(id)}>
                    {t.participants[j]}
                  </button>
                ))}
              </div>
            </article>
          ))}
          {result.discardedThemes > 0 && (
            <p className="muted small">
              Se descartaron {result.discardedThemes} {result.discardedThemes === 1 ? 'tema' : 'temas'} porque no citaban sesiones verificables.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function SessionDrawer({ study, session, events, at, onClose }: { study: Study; session?: Session; events: StudyEvent[]; at?: number; onClose: () => void }) {
  const snap = study.snapshot;
  const [audio, setAudio] = useState<string>();
  useEffect(() => {
    if (!session?.hasAudio) return;
    let url: string | undefined;
    getAudio(session.id)
      .then((b) => {
        if (b) {
          url = URL.createObjectURL(b);
          setAudio(url);
        }
      })
      .catch(() => undefined);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [session]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (at == null) return;
    document.getElementById(`ev-at-${at}`)?.scrollIntoView({ block: 'center' });
  }, [at]);

  if (!session) return null;
  const sorted = [...events].sort((a, b) => a.elapsed - b.elapsed);
  return (
    <div className="drawer" role="dialog" aria-label={`Sesión de ${session.participant}`}>
      <div className="drawer-head">
        <div>
          <strong>Sesión de {session.participant}</strong>
          <div className="muted small">
            {new Date(session.startedAt).toLocaleString('es-CL')}, {session.device.width}×{session.device.height}
          </div>
        </div>
        <button type="button" className="icon-btn" aria-label="Cerrar sesión" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="drawer-body stack">
        <div className="stack-xs small">
          <span>Consentimiento para participar: {session.consent.participate ? 'sí' : 'no'}</span>
          <span>Consentimiento para grabar audio: {session.consent.audio ? 'sí' : 'no'}</span>
        </div>
        {session.hasAudio && (audio ? <audio controls src={audio} /> : <p className="muted small">La grabación está en el navegador donde se hizo la sesión.</p>)}
        {session.feedback.map((f) => (
          <div key={f.taskId} className="feedback">
            <strong>{study.tasks.find((t) => t.id === f.taskId)?.prompt}</strong>
            <span className="small">
              {f.outcome === 'success' ? 'La completó' : 'La abandonó'} en {fmtDuration(f.durationMs)}
              {f.difficulty ? `, dificultad ${f.difficulty} de 5` : ''}
            </span>
            {f.comment && <blockquote>{f.comment}</blockquote>}
          </div>
        ))}
        <Tabs small label="Vista" value="timeline" onChange={() => undefined} items={[{ id: 'timeline', label: 'Línea de tiempo' }]} />
        <ol className="timeline">
          {sorted.map((e) => (
            <li key={e.id} id={`ev-at-${e.elapsed}`} className={at === e.elapsed ? 'hl' : ''}>
              <time>{clock(e.elapsed)}</time>
              <span>
                {KIND_LABEL[e.kind]} {e.kind === 'navigate' ? `«${screenName(snap, e.screen)}»` : e.option ? `«${e.option.replace(/\*\*/g, '')}»` : e.block ? `«${blockLabel(snap, e.block)}»` : ''}
                {e.kind !== 'navigate' && <span className="muted"> en {screenName(snap, e.screen)}</span>}
                {e.dwell ? <span className="muted"> ({fmt1(e.dwell / 1000)} s)</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
