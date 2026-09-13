import { useEffect, useMemo, useState } from 'react';
import type { Project, Role, Session, Study, StudyEvent, StudyTask } from '../lib/model';
import { baseId } from '../lib/model';
import { createStudy, deleteStudy, importResults, setStudyStatus, useDb, userName } from '../lib/store';
import { can } from '../lib/permissions';
import { checkProject, hasBlockingErrors } from '../lib/flowCheck';
import { analyzeStudy, blockLabel, buildAiDataset, consentedSessions, fmt1, fmtDuration, overview, screenName, taskFunnel, type Overview } from '../lib/analysis';
import { summarizeResearch, getAiKey, type VerifiedTheme } from '../lib/ai';
import { download, resultsFile, studyLink, toCsv } from '../lib/share';
import { getAudio } from '../lib/blobs';
import { go, href } from '../lib/router';
import { Heatmap } from '../components/Heatmap';
import { Badge, Button, Empty, Field, Modal, Tabs, copyText, pickFile, timeAgo } from '../components/ui';

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

export const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function StudiesView({ project, role, studyId, openNew }: { project: Project; role: Role; studyId?: string; openNew?: boolean }) {
  const db = useDb();
  const studies = db.studies.filter((s) => s.projectId === project.id).sort((a, b) => b.created - a.created);
  const study = studyId ? studies.find((s) => s.id === studyId) : undefined;
  if (studyId && study) return <StudyDetail project={project} role={role} study={study} />;
  return <StudyList project={project} role={role} studies={studies} missing={!!studyId} openNew={openNew} />;
}

function StudyList({ project, role, studies, missing, openNew }: { project: Project; role: Role; studies: Study[]; missing: boolean; openNew?: boolean }) {
  const db = useDb();
  const [open, setOpen] = useState(!!openNew && can(role, 'runStudy'));
  useEffect(() => {
    if (openNew && can(role, 'runStudy')) setOpen(true);
  }, [openNew, role]);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Pruebas con usuarios</h1>
          <p className="page-sub">Cada estudio encadena tareas sobre una copia congelada del proyecto. Quien participa no necesita cuenta.</p>
        </div>
        {can(role, 'runStudy') && (
          <Button tone="primary" onClick={() => setOpen(true)}>
            Nuevo estudio
          </Button>
        )}
      </div>
      {missing && <p className="notice">Ese estudio ya no existe.</p>}
      {studies.length === 0 ? (
        <Empty
          title="Aún no hay estudios"
          action={
            can(role, 'runStudy') && (
              <Button tone="primary" onClick={() => setOpen(true)}>
                Crear el primer estudio
              </Button>
            )
          }
        >
          Define tareas como «Transfiere $25.000 a Martina» y comparte el enlace con cinco personas.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Estudio</th>
                <th>Tareas</th>
                <th>Sesiones</th>
                <th>Estado</th>
                <th>Versión probada</th>
                <th>Creado</th>
              </tr>
            </thead>
            <tbody>
              {studies.map((s) => (
                <tr key={s.id}>
                  <td>
                    <a className="strong-link" href={href(`/p/${project.id}/studies/${s.id}`)}>
                      {s.name}
                    </a>{' '}
                    {s.example && <Badge tone="warn">Datos de ejemplo</Badge>}
                  </td>
                  <td>{s.tasks.length}</td>
                  <td>{consentedSessions(s, db.sessions).length}</td>
                  <td>{s.status === 'open' ? <Badge tone="ok">Abierto</Badge> : <Badge>Cerrado</Badge>}</td>
                  <td className="muted">v{s.snapshot.version}</td>
                  <td className="muted">{timeAgo(s.created)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
      go(`/p/${project.id}/studies/${id}`);
    }
  };

  return (
    <Modal
      open={open}
      wide
      title="Nuevo estudio"
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
      {blocked && (
        <div className="notice notice-err">
          El guardarraíl encontró errores críticos. No se puede publicar un estudio con errores de flujo o accesibilidad.{' '}
          <a href={href(`/p/${project.id}/screens`)} onClick={onClose}>
            Revisar en Pantallas
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
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Primera transferencia" autoFocus />
      </Field>
      <fieldset className="choice">
        <legend className="field-label">Tareas, en orden</legend>
        <ol className="task-editor">
          {tasks.map((t, i) => (
            <li key={i}>
              <Field label={`Instrucción de la tarea ${i + 1}`}>
                <textarea rows={2} value={t.prompt} onChange={(e) => update(i, { prompt: e.target.value })} placeholder="Escríbela como se la dirías a la persona. Ej: Transfiere $25.000 a Martina Rojas." />
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
          Agregar tarea
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
      <p className="muted small">El estudio usa una copia congelada de la versión v{project.version}. Los cambios posteriores al diseño no alteran lo que se prueba.</p>
    </Modal>
  );
}

function StudyDetail({ project, role, study }: { project: Project; role: Role; study: Study }) {
  const db = useDb();
  const sessions = db.sessions.filter((s) => s.studyId === study.id);
  const events = db.events.filter((e) => sessions.some((s) => s.id === e.sessionId));
  const analysis = useMemo(() => analyzeStudy(study, sessions, events), [study, sessions, events]);
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
    <div className="page page-wide">
      <a className="back-link" href={href(`/p/${project.id}/studies`)}>
        Todos los estudios
      </a>
      <div className="page-head">
        <div>
          <h1 className="page-title">{study.name}</h1>
          <p className="page-sub">
            {analysis.total} {analysis.total === 1 ? 'sesión con consentimiento' : 'sesiones con consentimiento'}, sobre la versión v{snap.version}. Publicado por {userName(db, study.owner)} {timeAgo(study.created)}.
          </p>
          <div className="row">
            {study.status === 'open' ? <Badge tone="ok">Abierto</Badge> : <Badge>Cerrado</Badge>}
            {study.example && <Badge tone="warn">Datos de ejemplo simulados</Badge>}
            {study.askAudio && <Badge>Pide audio</Badge>}
          </div>
        </div>
        <div className="row">
          <Button tone="primary" disabled={!link || study.status !== 'open'} onClick={() => copyText(link, 'Copiaste el enlace público del estudio.')}>
            Copiar enlace
          </Button>
          <Button disabled={!link || study.status !== 'open'} onClick={() => window.open(link, '_blank', 'noopener')}>
            Abrir como participante
          </Button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button
              disabled={!link || study.status !== 'open'}
              onClick={() => navigator.share({ title: study.name, text: 'Te invito a probar un prototipo. Toma unos 5 minutos y no necesitas cuenta.', url: link }).catch(() => undefined)}
            >
              Compartir
            </Button>
          )}
        </div>
      </div>

      <p className="notice">
        El enlace lleva dentro la copia congelada del prototipo y se puede instalar como app en el celular. En este navegador, las sesiones aparecen aquí al terminar. Si alguien participa desde otro dispositivo, al final te envía un archivo de resultados que importas con «Importar resultados».
      </p>

      <div className="row toolbar-row">
        <Button size="sm" onClick={exportJson}>
          Exportar resultados (JSON)
        </Button>
        <Button size="sm" onClick={exportCsv}>
          Exportar eventos (CSV)
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

      {analysis.total === 0 ? (
        <Empty title="Todavía no hay sesiones">Comparte el enlace. Los hallazgos aparecen cuando termina la primera sesión.</Empty>
      ) : (
        <>
        <Kpis o={overview(study, sessions, events, analysis)} />
        <div className="study-grid">
          <div>
            <section className="section">
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

            <section className="section">
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
              <section className="section">
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

            <section className="section">
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
                          {study.tasks.map((t) => {
                            const f = s.feedback.find((x) => x.taskId === t.id);
                            return (
                              <Badge key={t.id} tone={f?.outcome === 'success' ? 'ok' : f?.outcome === 'giveup' ? 'err' : 'neutral'}>
                                {f?.outcome === 'success' ? 'Logró' : f?.outcome === 'giveup' ? 'Abandonó' : 'Sin terminar'}
                              </Badge>
                            );
                          })}
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
            <HeatmapPanel study={study} events={events} />
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
                go(`/p/${project.id}/studies`);
              }}
            >
              Eliminar estudio y resultados
            </Button>
          </>
        }
      >
        <p>Se eliminarán «{study.name}», sus {sessions.length} sesiones y sus grabaciones. Exporta los resultados antes si quieres conservarlos.</p>
      </Modal>
    </div>
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
    <dl className="kpis">
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
    <section className="section">
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
                    {drop > 0 && <em>{drop} se quedaron antes</em>}
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

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function HeatmapPanel({ study, events }: { study: Study; events: StudyEvent[] }) {
  const snap = study.snapshot;
  const touched = snap.screens.filter((s) => events.some((e) => e.screen === s.id && ['tap', 'misclick', 'blocked'].includes(e.kind)));
  const [screenId, setScreenId] = useState(touched[0]?.id);
  const [task, setTask] = useState<string>('all');
  const screen = snap.screens.find((s) => s.id === screenId) ?? touched[0];
  if (!screen) return null;
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
    <section className="section">
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
                {KIND_LABEL[e.kind]} {e.kind === 'navigate' ? `«${screenName(snap, e.screen)}»` : e.block ? `«${blockLabel(snap, e.block)}»` : ''}
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
