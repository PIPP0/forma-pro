import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project, Role, Session, Study, StudyEvent, StudyTask } from '../lib/model';
import { baseId } from '../lib/model';
import { applyStudySnapshotOps, createStudy, deleteSession, deleteStudy, getDb, importResults, mergeCloudSessions, refreshFromStorage, saveStudySummary, setStudyCloud, setStudyStatus, useDb, userName } from '../lib/store';
import { conImagenExterna, incrustarImagenes } from '../lib/incrustar';
import { deleteCloudSession, deleteCloudStudy, downloadCloudAudio, fetchCloudSessions, publishStudyToCloud, setCloudStudyStatus, uploadFullAudio, uploadSession } from '../lib/cloud';
import { useCloudAccount } from '../components/useCloudAccount';
import { notify } from '../lib/toast';
import { can } from '../lib/permissions';
import { checkProject, hasBlockingErrors } from '../lib/flowCheck';
import { analyzeStudy, blockLabel, buildAiDataset, consentedSessions, fmt1, fmtDuration, overview, screenName, taskFunnel, type Overview } from '../lib/analysis';
import { construirInforme, pct, SEVERIDAD_LABEL, type Hallazgo, type Metricas } from '../lib/insights';
import { informeHtml, informeMarkdown } from '../lib/report';
import { descargarDeck, type TemaIa } from '../lib/deck';
import { consumoDeIa, getAiKey, iaDisponible, summarizeResearch, type IaConsumo, type VerifiedTheme } from '../lib/ai';
import { blobToAudio, download, megabytes, resultsFile, studyLink, toCsv, type AudioMap } from '../lib/share';
import { getAudio, saveAudio } from '../lib/blobs';
import { go, href } from '../lib/router';
import { Heatmap } from '../components/Heatmap';
import { Badge, Button, EmptyCard, Field, Modal, PageHead, Tabs, copyText, pickFile, timeAgo } from '../components/ui';
import { IconChart, IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconClose, IconDownload, IconPlay, IconPlus, IconRefresh, IconTarget } from '../components/icons';

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
  const { account } = useCloudAccount();

  const update = (i: number, patch: Partial<Omit<StudyTask, 'id'>>) => setTasks((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const publish = async () => {
    const id = createStudy(project.id, { name, tasks, askAudio });
    if (!id) return;
    // Con la nube conectada, el estudio nace listo para recibir sesiones remotas.
    const study = account ? getDb().studies.find((s) => s.id === id) : undefined;
    if (study) {
      try {
        await publishStudyToCloud(study);
        setStudyCloud(id, true);
      } catch {
        notify('El estudio quedó creado, pero no pudimos conectarlo a la nube. Inténtalo desde Resultados.', 'error');
      }
    }
    onClose();
    go(`/p/${project.id}/results/${id}`);
    // El siguiente paso siempre es compartir: el enlace queda copiado al publicar.
    const nuevo = getDb().studies.find((s) => s.id === id);
    if (nuevo) {
      const enlace = await studyLink(nuevo);
      await copyText(enlace, 'Estudio publicado y enlace copiado. Pégalo donde vayas a invitar a quien participa.');
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
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Ej: Primera prueba de ${project.name}`} autoFocus />
      </Field>
      <fieldset className="choice">
        <legend className="field-label">Tareas, en orden</legend>
        <ol className="task-editor">
          {tasks.map((t, i) => (
            <li key={i}>
              <Field label={`Instrucción de la tarea ${i + 1}`}>
                <textarea
                  rows={2}
                  value={t.prompt}
                  onChange={(e) => update(i, { prompt: e.target.value })}
                  placeholder={`Escríbela como se la dirías a la persona. Ej: Llega a «${project.screens.find((x) => !x.variantOf && x.id !== project.startScreenId)?.name ?? 'la pantalla final'}».`}
                />
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
  // La promesa se mantiene: nada se inventa a tus espaldas, y lo sintético viaja siempre etiquetado.
  const conSinteticas = db.sessions.some((s) => s.source === 'synthetic' && studies.some((x) => x.id === s.studyId));
  return (
    <div className="page page-wide">
      <PageHead
        eyebrow="EVIDENCIA, NO SUPOSICIONES"
        title="Cada interacción cuenta."
        sub={conSinteticas ? 'Lo que hicieron las personas en tus pruebas. Las sesiones sintéticas van marcadas y se pueden separar.' : 'Resultados reales de tus pruebas. Sin sesiones ni métricas inventadas.'}
        actions={
          <Button
            onClick={() => {
              refreshFromStorage();
              window.dispatchEvent(new Event('forma:sync-cloud'));
            }}
          >
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
  const todas = db.sessions.filter((s) => s.studyId === study.id);
  const sinteticas = todas.filter((s) => s.source === 'synthetic').length;
  const [filtro, setFiltro] = useState<'todas' | 'reales' | 'sinteticas'>('todas');
  // Las sesiones sintéticas conviven con las reales, pero siempre se pueden separar.
  const sessions = !sinteticas || filtro === 'todas' ? todas : todas.filter((s) => (s.source === 'synthetic') === (filtro === 'sinteticas'));
  const events = db.events.filter((e) => sessions.some((s) => s.id === e.sessionId));
  const analysis = analyzeStudy(study, sessions, events);
  // Todo el tablero se apoya en el mismo informe que se exporta: lo que se ve es lo que se manda.
  const informe = useMemo(() => construirInforme(study, sessions, events), [study, sessions, events]);
  const snap = study.snapshot;
  const manage = can(role, 'runStudy');
  const [openSession, setOpenSession] = useState<{ id: string; at?: number }>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [entregables, setEntregables] = useState(false);
  const [armandoPpt, setArmandoPpt] = useState(false);
  const [confirmSession, setConfirmSession] = useState<Session>();
  const [link, setLink] = useState('');
  const { account, loading: cloudLoading } = useCloudAccount();
  const [cloudFailed, setCloudFailed] = useState(false);
  const cloudLinked = !!study.cloud && !!account;
  // Mientras se publica la copia en la nube no se ofrece el enlace largo; sin conexión, sí.
  const waitingShortLink = !(study.cloud && study.shortLink) && !cloudFailed && (cloudLoading || !!account);

  /** Trae las sesiones que llegaron a la nube (nuevas o que avanzaron). */
  const syncCloud = async (quiet = false) => {
    if (!study.cloud || !account) return;
    try {
      const fresh = mergeCloudSessions(study.id, await fetchCloudSessions(study.id));
      if (fresh || !quiet) notify(fresh ? `Llegaron ${fresh} ${fresh === 1 ? 'sesión nueva' : 'sesiones nuevas'} desde la nube.` : 'Los resultados ya están al día.', 'success');
    } catch {
      if (!quiet) notify('No pudimos traer los resultados de la nube. Revisa tu conexión.', 'error');
    }
  };

  useEffect(() => {
    if (!cloudLinked) return;
    void syncCloud(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void syncCloud(true);
    }, 60000);
    // «Actualizar» de la cabecera también trae lo que llegó a la nube.
    const onSync = () => void syncCloud(true);
    window.addEventListener('forma:sync-cloud', onSync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('forma:sync-cloud', onSync);
    };
    // syncCloud lee el estudio y la cuenta actuales; basta con reiniciar al cambiar de estudio o conexión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudLinked, study.id]);

  // Cada estudio se publica solo en la nube: enlace corto y sesiones que llegan solas.
  useEffect(() => {
    if (!account || (study.cloud && study.shortLink)) return;
    let alive = true;
    publishStudyToCloud(study)
      .then(() => setStudyCloud(study.id, true))
      .catch(() => alive && setCloudFailed(true));
    return () => {
      alive = false;
    };
  }, [account, study]);

  useEffect(() => {
    if (waitingShortLink) {
      setLink('');
      return;
    }
    let alive = true;
    studyLink(study).then((l) => alive && setLink(l));
    return () => {
      alive = false;
    };
  }, [study, waitingShortLink]);

  // El resumen por IA solo viaja a la presentación si sigue correspondiendo a estas sesiones.
  const resumenVigente = study.summary && study.summary.huella === huellaDe(consentedSessions(study, sessions)) ? (study.summary.themes as TemaIa[]) : undefined;

  const crearPpt = async () => {
    setArmandoPpt(true);
    try {
      const laminas = await descargarDeck(study, sessions, events, `${slug(study.name)}-presentacion.pptx`, { autor: userName(db, study.owner), temasIa: resumenVigente });
      notify(`Listo: ${laminas} láminas. Se abre en PowerPoint, Keynote o Google Slides.`, 'success');
    } catch {
      notify('No pudimos armar la presentación. Intenta de nuevo.', 'error');
    } finally {
      setArmandoPpt(false);
    }
  };

  const [exporting, setExporting] = useState(false);
  const exportJson = async () => {
    setExporting(true);
    const audio: AudioMap = {};
    let missing = 0;
    try {
      for (const s of sessions.filter((x) => x.hasAudio)) {
        let blob = await getAudio(s.id).catch(() => undefined);
        // Grabaciones que todavía no se escuchan en este navegador: se bajan de la nube.
        if (!blob && s.source === 'cloud') {
          const remote = await downloadCloudAudio(study.id, s.id).catch(() => undefined);
          if (remote) {
            blob = remote.blob;
            if (remote.complete) void saveAudio(s.id, remote.blob).catch(() => undefined);
          }
        }
        if (blob) audio[s.id] = await blobToAudio(blob);
        else missing++;
      }
      download(`${slug(study.name)}-resultados.json`, resultsFile(study.id, sessions, events, audio));
      if (missing)
        notify(`Exportaste los resultados, pero ${missing === 1 ? 'una grabación no se pudo incluir' : `${missing} grabaciones no se pudieron incluir`}. Revisa tu conexión y vuelve a exportar.`, 'error');
    } finally {
      setExporting(false);
    }
  };
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
            {!!sinteticas && <Badge tone="accent">{sinteticas} {sinteticas === 1 ? 'sesión sintética' : 'sesiones sintéticas'}</Badge>}
            {study.askAudio && <Badge>Pide audio</Badge>}
          </div>
        </div>
        <div className="row">
          <Button
            disabled={!link || study.status !== 'open'}
            title="Se abre en una pestaña nueva y pregunta si esta sesión debe contar en los resultados"
            onClick={() => window.open(`${link}${link.includes('?') ? '&' : '?'}ensayo=1`, '_blank', 'noopener')}
          >
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
            {link || study.status !== 'open' ? 'Copiar enlace' : 'Preparando enlace…'}
          </Button>
        </div>
      </section>

      <div className="study-tools">
        {!!sinteticas && (
          <Tabs
            small
            label="Filtrar sesiones por origen"
            value={filtro}
            onChange={setFiltro}
            items={[
              { id: 'todas', label: `Todas · ${todas.length}` },
              { id: 'reales', label: `Personas reales · ${todas.length - sinteticas}` },
              { id: 'sinteticas', label: `Sintéticas · ${sinteticas}` },
            ]}
          />
        )}
        <div className="row">
          <Button size="sm" tone="primary" disabled={analysis.total === 0} title="Presentación, informe, resumen y datos de este estudio" onClick={() => setEntregables(true)}>
            <IconDownload size={15} /> Entregables
          </Button>
          {manage && (
            <a className="btn btn-default btn-sm" href={href(`/p/${project.id}/users?run=1`)}>
              Probar con usuarios sintéticos
            </a>
          )}
          {manage && (
            <>
              <Button
                size="sm"
                onClick={async () => {
                  const t = await pickFile('.json');
                  if (t) await importResults(t);
                }}
              >
                Importar resultados
              </Button>
              {!!resumenVigente?.length && (
                <Button size="sm" disabled={armandoPpt} title="Presentación de once láminas, con la síntesis por IA incluida" onClick={() => void crearPpt()}>
                  {armandoPpt ? 'Armando láminas…' : 'Crear PPT'}
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  const next: Study['status'] = study.status === 'open' ? 'closed' : 'open';
                  setStudyStatus(study.id, next);
                  if (study.cloud && account) setCloudStudyStatus(study.id, next).catch(() => notify('Cambiaste el estado aquí, pero no pudimos actualizarlo en la nube.', 'error'));
                }}
              >
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
        <EmptyCard
          icon={<IconChart size={32} />}
          title={filtro === 'reales' ? 'Todavía no hay sesiones de personas reales' : filtro === 'sinteticas' ? 'Todavía no hay sesiones sintéticas' : 'Todavía no hay sesiones'}
          text={filtro === 'reales' ? 'Comparte el enlace del estudio: lo que ves arriba viene de usuarios sintéticos.' : 'Comparte el enlace, o haz una primera pasada con usuarios sintéticos para detectar tropiezos evidentes.'}
          action={
            manage && (
              <a className="btn btn-outline" href={href(`/p/${project.id}/users?run=1`)}>
                Probar con usuarios sintéticos
              </a>
            )
          }
        />
      ) : (
        <>
          <Tablero m={informe.metricas} hallazgos={informe.hallazgos} o={overview(study, sessions, events, analysis)} />
          <div className="study-grid">
            <div className="card study-body">
              <section className="card-section">
                <div className="section-head">
                  <h2 className="section-title">Desempeño por tarea</h2>
                  <span className="muted small">Pasos compara el recorrido real con el camino más corto del prototipo.</span>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tarea</th>
                        <th>Lograda</th>
                        <th>Mediana</th>
                        <th>Pasos</th>
                        <th>Dificultad</th>
                        <th>Se pierde en</th>
                      </tr>
                    </thead>
                    <tbody>
                      {informe.tareas.map((t) => (
                        <tr key={t.taskId}>
                          <td>{t.prompt}</td>
                          <td className="nowrap">
                            <div className="bar" role="img" aria-label={`${pct(t.exitoPct)} lograda`}>
                              <span style={{ width: `${t.exitoPct * 100}%` }} />
                            </div>
                            {t.exito} de {t.personas}
                            <span className="sub">IC {pct(t.ic[0])}–{pct(t.ic[1])}</span>
                          </td>
                          <td className="nowrap">
                            {t.medianaMs != null ? fmtDuration(t.medianaMs) : 'n/a'}
                            {t.p75Ms != null && <span className="sub">75% bajo {fmtDuration(t.p75Ms)}</span>}
                          </td>
                          <td className="nowrap">
                            {t.pasosMediana ?? 'n/a'}
                            {t.pasosOptimos != null && <span className="sub">óptimo {t.pasosOptimos}</span>}
                          </td>
                          <td className="nowrap">
                            {t.dificultad != null ? `${fmt1(t.dificultad)} de 5` : 'n/a'}
                          </td>
                          <td>
                            {t.corte ? (
                              <>
                                {t.corte.desde} → {t.corte.hacia}
                                <span className="sub">
                                  −{t.corte.perdidos} {t.corte.perdidos === 1 ? 'persona' : 'personas'}
                                </span>
                              </>
                            ) : t.fuga ? (
                              <>
                                {t.fuga.nombre}
                                <span className="sub">{t.fuga.n} {t.fuga.n === 1 ? 'persona' : 'personas'}</span>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {informe.segmentos.length > 1 && (
                <section className="card-section">
                  <div className="section-head">
                    <h2 className="section-title">Comparativa por perfil</h2>
                    <span className="muted small">Arriba, a quien el flujo le exige más.</span>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Perfil o dispositivo</th>
                          <th>Sesiones</th>
                          <th>Tareas logradas</th>
                          <th>Mediana</th>
                          <th>Dificultad</th>
                          <th>Toques sin acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {informe.segmentos.map((g) => (
                          <tr key={g.nombre}>
                            <td>{g.nombre}</td>
                            <td>{g.n}</td>
                            <td className="nowrap">
                              <div className="bar" role="img" aria-label={`${pct(g.exitoPct)} logradas`}>
                                <span style={{ width: `${g.exitoPct * 100}%` }} />
                              </div>
                              {pct(g.exitoPct)}
                            </td>
                            <td>{g.medianaMs != null ? fmtDuration(g.medianaMs) : 'n/a'}</td>
                            <td>{g.dificultad != null ? `${fmt1(g.dificultad)} de 5` : 'n/a'}</td>
                            <td>{fmt1(g.erroresPorPersona)} por sesión</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <Funnel study={study} sessions={sessions} events={events} />

              <section className="card-section">
                <div className="section-head">
                  <h2 className="section-title">Hallazgos priorizados</h2>
                  <span className="muted small">Ordenados por impacto sobre la tarea.</span>
                </div>
                <p className="muted">El impacto combina qué tan grave es el problema con cuánta gente lo vivió. Cada cita abre el momento exacto de esa sesión.</p>
                {informe.hallazgos.length === 0 && <p className="muted">No se detectaron dudas, bloqueos ni abandonos.</p>}
                {informe.hallazgos.map((h, i) => (
                  <HallazgoCard key={h.id} h={h} orden={i + 1} onCita={(id, at) => setOpenSession({ id, at })} />
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
                        <th>
                          <span className="sr-only">Eliminar sesión</span>
                        </th>
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
                          <td>{s.source === 'synthetic' ? <Badge tone="accent">Sintética</Badge> : s.source === 'example' ? 'Ejemplo' : s.source === 'import' ? 'Importada' : s.source === 'cloud' ? 'Nube' : 'Este navegador'}</td>
                          <td className="muted">{timeAgo(s.startedAt)}</td>
                          <td className="t-right">
                            {manage && (
                              <button type="button" className="icon-btn" title={`Eliminar la sesión de ${s.participant}`} aria-label={`Eliminar la sesión de ${s.participant}`} onClick={() => setConfirmSession(s)}>
                                <IconClose size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <Grabaciones study={study} sessions={consentedSessions(study, sessions)} onAbrir={(id) => setOpenSession({ id })} />
            </div>

            <aside className="study-side">
              <div className="card">
                <HeatmapPanel study={study} events={events} editable={manage} />
              </div>
            </aside>
          </div>
        </>
      )}

      {openSession && (
        <SessionDrawer study={study} session={sessions.find((s) => s.id === openSession.id)} events={events.filter((e) => e.sessionId === openSession.id)} at={openSession.at} onClose={() => setOpenSession(undefined)} />
      )}

      <EntregablesModal
        open={entregables}
        onClose={() => setEntregables(false)}
        study={study}
        sessions={sessions}
        events={events}
        autor={userName(db, study.owner)}
        temasIa={resumenVigente}
        exportando={exporting}
        onJson={() => void exportJson()}
        onCsv={exportCsv}
      />

      <Modal
        open={!!confirmSession}
        title="Eliminar esta sesión"
        onClose={() => setConfirmSession(undefined)}
        footer={
          <>
            <Button onClick={() => setConfirmSession(undefined)}>Cancelar</Button>
            <Button
              tone="danger"
              onClick={async () => {
                const s = confirmSession;
                setConfirmSession(undefined);
                if (!s) return;
                // Si vino de la nube hay que borrarla allá también: si no, vuelve en la próxima sincronización.
                if (s.source === 'cloud' && account) {
                  try {
                    await deleteCloudSession(study.id, s.id);
                  } catch {
                    notify('No pudimos borrarla en la nube. Volverá a aparecer al sincronizar.', 'error');
                  }
                }
                deleteSession(s.id);
              }}
            >
              Eliminar sesión
            </Button>
          </>
        }
      >
        <p>
          Se eliminarán las respuestas, los toques y la grabación de <strong>{confirmSession?.participant}</strong>. Los resultados, el mapa de calor y los hallazgos se recalculan sin esa sesión.
        </p>
        <p className="muted small">No se puede deshacer. Si quieres conservarla, exporta el JSON del estudio antes.</p>
      </Modal>

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
                if (study.cloud && account) void deleteCloudStudy(study.id).catch(() => notify('Eliminaste el estudio aquí, pero no pudimos borrar sus datos de la nube. Inténtalo más tarde.', 'error'));
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

/** Todo lo que este estudio puede entregarle a otra persona, en un solo lugar. */
function EntregablesModal({
  open,
  onClose,
  study,
  sessions,
  events,
  autor,
  temasIa,
  exportando,
  onJson,
  onCsv,
}: {
  open: boolean;
  onClose: () => void;
  study: Study;
  sessions: Session[];
  events: StudyEvent[];
  autor: string;
  temasIa?: TemaIa[];
  exportando: boolean;
  onJson: () => void;
  onCsv: () => void;
}) {
  const [armando, setArmando] = useState(false);

  const deck = async () => {
    setArmando(true);
    try {
      const laminas = await descargarDeck(study, sessions, events, `${slug(study.name)}-presentacion.pptx`, { autor, temasIa });
      notify(`Listo: ${laminas} láminas. Se abre en PowerPoint, Keynote o Google Slides.`, 'success');
      onClose();
    } catch {
      notify('No pudimos armar la presentación. Intenta de nuevo.', 'error');
    } finally {
      setArmando(false);
    }
  };

  const items = [
    {
      id: 'deck',
      titulo: 'Presentación',
      formato: '.pptx',
      texto: `${temasIa?.length ? 'Doce' : 'Once'} láminas editables para defender la decisión frente a otras personas: el índice, los tres hallazgos más graves con su evidencia y su cita, el desempeño por tarea y los próximos pasos.${
        temasIa?.length ? ' Incluye la síntesis por IA que ya generaste.' : ''
      }`,
      accion: (
        <Button tone="primary" disabled={armando} onClick={() => void deck()}>
          {armando ? 'Armando láminas…' : 'Descargar presentación'}
        </Button>
      ),
    },
    {
      id: 'informe',
      titulo: 'Informe completo',
      formato: '.html',
      texto: 'Seis hojas para leer y archivar: resumen ejecutivo, hallazgos priorizados, desempeño por tarea con embudos, comparativa por perfil, método y anexo de sesiones. Se imprime a PDF desde el navegador.',
      accion: (
        <Button onClick={() => download(`${slug(study.name)}-informe.html`, informeHtml(study, sessions, events, autor), 'text/html')}>Descargar informe</Button>
      ),
    },
    {
      id: 'texto',
      titulo: 'Resumen en texto',
      formato: 'portapapeles',
      texto: 'El mismo contenido en texto plano, para pegarlo en un correo, un ticket o un mensaje.',
      accion: <Button onClick={() => void copyText(informeMarkdown(study, sessions, events), 'Copiaste el informe en texto. Pégalo donde lo necesites.')}>Copiar resumen</Button>,
    },
    {
      id: 'datos',
      titulo: 'Datos en bruto',
      formato: '.json · .csv',
      texto: 'Las sesiones completas con sus grabaciones (JSON) o todos los eventos uno por fila para analizar aparte (CSV).',
      accion: (
        <span className="row">
          <Button disabled={exportando} onClick={onJson}>
            {exportando ? 'Preparando…' : 'JSON'}
          </Button>
          <Button onClick={onCsv}>CSV</Button>
        </span>
      ),
    },
  ];

  return (
    <Modal open={open} wide title="Entregables" onClose={onClose}>
      <p className="muted modal-lede">Todo se arma en este navegador con los datos del estudio: nada se envía a ningún servicio ni tiene costo.</p>
      <ul className="entregables">
        {items.map((i) => (
          <li key={i.id}>
            <span className="entregable-main">
              <strong>
                {i.titulo} <span className="entregable-formato">{i.formato}</span>
              </strong>
              <span className="muted small">{i.texto}</span>
            </span>
            {i.accion}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function Tablero({ m, hallazgos, o }: { m: Metricas; hallazgos: Hallazgo[]; o: Overview }) {
  const prioritarios = hallazgos.filter((h) => h.severidad === 'critica' || h.severidad === 'alta').length;
  const items = [
    { label: 'Tareas logradas', value: pct(m.exitoPct), note: `IC 95%: ${pct(m.ic[0])}–${pct(m.ic[1])}` },
    { label: 'Mediana por tarea', value: m.medianaMs != null ? fmtDuration(m.medianaMs) : 'n/a', note: m.p75Ms != null ? `75% bajo ${fmtDuration(m.p75Ms)}` : undefined },
    { label: 'Eficiencia de recorrido', value: m.eficiencia != null ? pct(m.eficiencia) : 'n/a', note: 'camino más corto vs. real' },
    { label: 'Dificultad percibida', value: m.dificultad != null ? fmt1(m.dificultad) : 'n/a', note: 'de 5' },
    { label: 'Toques sin acción', value: fmt1(m.erroresPorSesion), note: 'por sesión' },
    { label: 'Dudas detectadas', value: String(o.hesitations), note: `${fmt1(m.dudasPorSesion)} por sesión` },
    { label: 'Hallazgos prioritarios', value: String(prioritarios), note: 'severidad crítica o alta' },
    { label: 'Sesiones', value: String(m.sesiones), note: m.sinteticas ? `${m.reales} reales · ${m.sinteticas} sintéticas` : o.withAudio ? `${o.withAudio} con audio` : undefined },
  ];
  return (
    <section className="card tablero">
      {m.indice != null && (
        <div className={`veredicto nivel-${m.nivel}`}>
          <div className="veredicto-dicho">
            <h2>
              <i aria-hidden="true" /> {m.titulo}
            </h2>
            <p>{m.consejo}</p>
            {m.confianza !== 'alta' && (
              <p className="veredicto-aviso">
                Con {m.sesiones} {m.sesiones === 1 ? 'sesión' : 'sesiones'} esto sirve para priorizar, no para afirmar magnitudes.
              </p>
            )}
          </div>
          <div className="veredicto-cifra">
            <strong>{m.indice}</strong>
            <span>de 100</span>
            <details className="indice-como">
              <summary>Cómo se calcula</summary>
              <p className="muted small">
                Índice Forma: tareas logradas (45%), eficiencia frente al camino más corto (25%) y esfuerzo percibido (30%). Sirve para comparar versiones de un mismo flujo; no es un estándar de la industria. Bajo 55
                conviene rehacer el camino, hasta 69 corregir, hasta 84 ajustar y desde 85 avanzar.
              </p>
            </details>
          </div>
        </div>
      )}
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
    </section>
  );
}

function HallazgoCard({ h, orden, onCita }: { h: Hallazgo; orden: number; onCita: (sessionId: string, at: number) => void }) {
  return (
    <article className={`hallazgo sev-${h.severidad}`}>
      <header>
        <span className="hallazgo-orden">{String(orden).padStart(2, '0')}</span>
        <div>
          <h3>{h.titulo}</h3>
          <p className="hallazgo-meta">
            <span className="sev-chip">{SEVERIDAD_LABEL[h.severidad]}</span>
            <span>afecta a {h.afectados} de {h.total}</span>
            <span>impacto {h.puntaje}/100</span>
            {h.segmentos.length > 0 && <span>se concentra en {h.segmentos.join(', ')}</span>}
          </p>
        </div>
      </header>
      <ul className="hallazgo-evidencia">
        {h.evidencia.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      <p className="hallazgo-accion">
        <span>Qué hacer</span>
        {h.recomendacion}
      </p>
      <div className="cites">
        {h.citations.map((c) => (
          <button key={`${c.sessionId}-${c.elapsed}`} type="button" className="cite" onClick={() => onCita(c.sessionId, c.elapsed)}>
            {c.participant} en {clock(c.elapsed)}
          </button>
        ))}
      </div>
    </article>
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

function HeatmapPanel({ study, events, editable }: { study: Study; events: StudyEvent[]; editable: boolean }) {
  const snap = study.snapshot;
  const touched = snap.screens.filter((s) => events.some((e) => e.screen === s.id && ['tap', 'misclick', 'blocked'].includes(e.kind)));
  const [screenId, setScreenId] = useState(touched[0]?.id);
  const [task, setTask] = useState<string>('all');
  const [tipo, setTipo] = useState<'todos' | 'tap' | 'misclick'>('todos');
  const [dir, setDir] = useState<'sig' | 'ant'>('sig');
  const [incrustando, setIncrustando] = useState<string | null>(null);
  // El estudio guarda su propio prototipo (para no cambiarle el piso a quien ya lo respondió).
  // Si se incrustaron las imágenes DESPUÉS de publicarlo, esta copia se quedó sin ellas.
  const porIncrustar = conImagenExterna(snap).length;
  const guardarImagenesDelEstudio = async () => {
    setIncrustando('Trayendo imágenes…');
    try {
      const r = await incrustarImagenes(snap, (hechas, total) => setIncrustando(`Incrustando ${hechas} de ${total}…`));
      if (r.ops.length) applyStudySnapshotOps(study.id, r.ops);
      const mb = (r.peso / 1024 / 1024).toFixed(1).replace('.', ',');
      if (r.fallidas) notify(`Quedaron ${r.fallidas} sin incrustar: este equipo tampoco pudo descargarlas. Hazlo desde el computador donde sí se ven.`, 'error');
      else notify(`Listo: las imágenes del estudio viajan dentro de él (${mb} MB). Se verán en cualquier equipo.`, 'success');
    } catch {
      notify('No pudimos incrustar las imágenes. Inténtalo de nuevo.', 'error');
    } finally {
      setIncrustando(null);
    }
  };
  // Automático: al abrir los resultados, si el estudio tiene imágenes sin incrustar se intenta
  // traerlas solo. Si este equipo también las tiene bloqueadas, no se avisa nada — se reintenta
  // solo la próxima vez que alguien lo abra desde un equipo donde sí carguen. Necesita el mismo
  // permiso que el botón manual, así que no corre para quien solo puede mirar el estudio.
  const intentoAutoRef = useRef(false);
  useEffect(() => {
    if (!editable || intentoAutoRef.current || incrustando || !porIncrustar) return;
    intentoAutoRef.current = true;
    void (async () => {
      setIncrustando('Trayendo imágenes…');
      try {
        const r = await incrustarImagenes(snap, (hechas, total) => setIncrustando(`Incrustando ${hechas} de ${total}…`));
        if (r.ops.length) {
          applyStudySnapshotOps(study.id, r.ops);
          const mb = (r.peso / 1024 / 1024).toFixed(1).replace('.', ',');
          notify(`Las imágenes de «${study.name}» ya viajan dentro del estudio (${mb} MB): se verán en cualquier equipo.`, 'success');
        }
      } catch {
        /* este equipo tampoco pudo: se reintenta solo la próxima vez */
      } finally {
        setIncrustando(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [study.id]);
  const screen = snap.screens.find((s) => s.id === screenId) ?? touched[0];
  if (!screen) return <p className="muted">Todavía no hay toques registrados.</p>;
  const cuenta = (k: string) => (tipo === 'todos' ? ['tap', 'misclick', 'blocked'].includes(k) : tipo === 'tap' ? k === 'tap' : k === 'misclick' || k === 'blocked');
  const pts = events.filter((e) => e.screen === screen.id && cuenta(e.kind) && (task === 'all' || e.taskId === task));
  const indice = touched.findIndex((s) => s.id === screen.id);
  const irA = (i: number) => {
    const destino = touched[i];
    if (!destino) return;
    setDir(i > indice ? 'sig' : 'ant');
    setScreenId(destino.id);
  };
  return (
    <section className="heat-panel">
      <div className="heat-panel-head">
        <h2 className="section-title">Mapa de calor</h2>
        {editable && porIncrustar > 0 && (
          <button
            type="button"
            className="sys-pill"
            title="Guarda las imágenes de este estudio dentro de él para que se vean también donde el navegador bloquea la nube"
            disabled={!!incrustando}
            onClick={() => void guardarImagenesDelEstudio()}
          >
            <IconDownload size={14} />
            {incrustando ?? `Incrustar imágenes · ${porIncrustar}`}
          </button>
        )}
      </div>
      <div className="stack">
        <Field label="Pantalla">
          <select value={screen.id} onChange={(e) => irA(touched.findIndex((s) => s.id === e.target.value))}>
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
        <Tabs
          small
          label="Qué se muestra"
          value={tipo}
          onChange={(v) => setTipo(v as 'todos' | 'tap' | 'misclick')}
          items={[
            { id: 'todos', label: 'Todo' },
            { id: 'tap', label: 'Toques' },
            { id: 'misclick', label: 'Sin acción' },
          ]}
        />
        {touched.length > 1 && (
          <div className="heat-pasos">
            <button type="button" className="icon-btn" disabled={indice <= 0} title="Pantalla anterior" aria-label="Ver la pantalla anterior" onClick={() => irA(indice - 1)}>
              <IconChevronLeft size={16} />
            </button>
            <span className="muted small">
              {indice + 1} de {touched.length}
            </span>
            <button type="button" className="icon-btn" disabled={indice >= touched.length - 1} title="Pantalla siguiente" aria-label="Ver la pantalla siguiente" onClick={() => irA(indice + 1)}>
              <IconChevronRight size={16} />
            </button>
          </div>
        )}
        <div className="heat-wrap">
          <div key={screen.id} className={`heat-slide ${dir}`}>
            <Heatmap project={snap} screen={screen} events={pts} mode="light" />
          </div>
        </div>
        <div className="heat-escala" aria-hidden="true">
          <span>Menos</span>
          <i />
          <span>Más</span>
        </div>
        <p className="muted small">
          {pts.length} {pts.length === 1 ? 'toque' : 'toques'} en «{snap.screens.find((s) => s.id === baseId(screen))?.name}».
        </p>
      </div>
    </section>
  );
}

/** Huella de las sesiones que alimentan el resumen: si cambia, el guardado quedó viejo. */
const huellaDe = (sessions: Session[]) =>
  sessions
    .map((s) => `${s.id}:${s.feedback.length}:${s.endedAt ?? 0}`)
    .sort()
    .join('|');

function AiSummary({ study, sessions, events, onOpen }: { study: Study; sessions: Session[]; events: StudyEvent[]; onOpen: (sessionId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { account: cuenta } = useCloudAccount();
  const ok = useMemo(() => consentedSessions(study, sessions), [study, sessions]);
  const huella = useMemo(() => huellaDe(ok), [ok]);
  const guardado = study.summary;
  // El resumen guardado se muestra tal cual; solo se vuelve a pagar si las sesiones cambiaron.
  const vigente = guardado?.huella === huella;
  const result = guardado ? { themes: guardado.themes as VerifiedTheme[], discardedThemes: guardado.discardedThemes } : null;
  const [gasto, setGasto] = useState<IaConsumo | null>(null);

  useEffect(() => {
    let vivo = true;
    if (cuenta?.email && !getAiKey()) consumoDeIa().then((c) => vivo && setGasto(c)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [cuenta?.email, busy]);

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const salida = await summarizeResearch(buildAiDataset(study, sessions, events), new Map(ok.map((s) => [s.id, s.participant])));
      saveStudySummary(study.id, { themes: salida.themes, discardedThemes: salida.discardedThemes, huella, at: Date.now() });
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
        {iaDisponible(cuenta?.email) !== 'no' ? (
          <Button size="sm" tone={vigente ? 'default' : 'primary'} disabled={busy || (vigente && !!result)} onClick={run}>
            {busy ? 'Agrupando sesiones…' : !result ? 'Generar resumen' : vigente ? 'Al día' : 'Actualizar resumen'}
          </Button>
        ) : (
          <a className="btn btn-default btn-sm" href={href('/settings')}>
            Conectar IA en Ajustes
          </a>
        )}
      </div>
      <p className="muted">
        Agrupa las sesiones por tema. Solo se muestran afirmaciones con citas a sesiones que existen en este estudio; el resto se descarta. Se guarda con el estudio: mientras las sesiones no cambien, no se vuelve a
        consultar.
      </p>
      {gasto && (
        <p className="muted small">
          Llevas ${Math.round(gasto.clp).toLocaleString('es-CL')} de ${gasto.topeUsuario.toLocaleString('es-CL')} este mes en consultas de IA.
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
      {guardado && !vigente && !busy && (
        <div className="notice notice-warn">
          Las sesiones cambiaron desde este resumen ({timeAgo(guardado.at)}). Actualízalo para incorporar lo nuevo.
        </div>
      )}
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
          {guardado && <p className="muted small">Generado {timeAgo(guardado.at)}.</p>}
        </>
      )}
    </section>
  );
}

const reloj = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

/** Reproductor propio: el nativo cambia de forma en cada navegador y no muestra bien el avance. */
function Reproductor({ src }: { src: string }) {
  const el = useRef<HTMLAudioElement>(null);
  const midiendo = useRef(false);
  const [sonando, setSonando] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [vel, setVel] = useState(1);

  /**
   * Las grabaciones de MediaRecorder (.webm) no traen la duración en la cabecera:
   * el navegador la calcula solo si se busca hasta el final.
   */
  const medirDuracion = (a: HTMLAudioElement) => {
    if (Number.isFinite(a.duration) && a.duration > 0) return setDur(a.duration);
    if (midiendo.current) return;
    midiendo.current = true;
    const listo = () => {
      if (!Number.isFinite(a.duration)) return;
      setDur(a.duration);
      a.removeEventListener('durationchange', listo);
      midiendo.current = false;
      a.currentTime = 0;
      setT(0);
    };
    a.addEventListener('durationchange', listo);
    a.currentTime = 1e101;
  };

  const alternar = () => {
    const a = el.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };

  const cambiarVelocidad = () => {
    const siguiente = vel === 1 ? 1.5 : vel === 1.5 ? 2 : 1;
    setVel(siguiente);
    if (el.current) el.current.playbackRate = siguiente;
  };

  const avance = dur ? Math.min(100, (t / dur) * 100) : 0;

  return (
    <div className="player">
      <button type="button" className="player-play" onClick={alternar} aria-label={sonando ? 'Pausar' : 'Reproducir'}>
        {sonando ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.2" />
            <rect x="14" y="5" width="4" height="14" rx="1.2" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        )}
      </button>
      <span className="player-time">
        {reloj(t)} <span className="muted">/ {reloj(dur)}</span>
      </span>
      <input
        className="player-range"
        type="range"
        min={0}
        max={dur || 0}
        step={0.05}
        value={t}
        aria-label="Avance de la grabación"
        style={{ backgroundSize: `${avance}% 100%` }}
        onChange={(e) => {
          const v = Number(e.target.value);
          setT(v);
          if (el.current) el.current.currentTime = v;
        }}
      />
      <button type="button" className="player-rate" onClick={cambiarVelocidad} title="Velocidad de reproducción">
        {vel === 1 ? '1×' : vel === 1.5 ? '1,5×' : '2×'}
      </button>
      <audio
        ref={el}
        src={src}
        preload="metadata"
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onEnded={() => setSonando(false)}
        onTimeUpdate={(e) => {
          if (!midiendo.current) setT(e.currentTarget.currentTime);
        }}
        onLoadedMetadata={(e) => medirDuracion(e.currentTarget)}
      />
    </div>
  );
}

/** Todas las grabaciones del estudio, para escucharlas o bajarlas sin abrir cada sesión. */
function Grabaciones({ study, sessions, onAbrir }: { study: Study; sessions: Session[]; onAbrir: (id: string) => void }) {
  const conAudio = sessions.filter((s) => s.hasAudio);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [blobs, setBlobs] = useState<Record<string, Blob>>({});
  const [cargando, setCargando] = useState<string>();
  const [abierto, setAbierto] = useState<Record<string, boolean>>({});
  const [fallo, setFallo] = useState<Record<string, string>>({});
  const creadas = useRef<string[]>([]);
  const { account } = useCloudAccount();

  useEffect(() => () => creadas.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Automático: las grabaciones hechas aquí mismo, antes de que esto subiera solo, se quedaron
  // atrapadas en este navegador. Si el estudio está conectado y hay cuenta con correo, se
  // intenta subir cada una que todavía solo esté local — una sola vez por visita, en silencio,
  // con un único aviso al final si algo llegó.
  const intentoAutoRef = useRef(false);
  useEffect(() => {
    if (intentoAutoRef.current || !study.cloud || !account?.email || !conAudio.length) return;
    intentoAutoRef.current = true;
    void (async () => {
      const eventos = getDb().events;
      let subidas = 0;
      for (const s of conAudio) {
        const blob = await getAudio(s.id).catch(() => undefined);
        if (!blob) continue; // no está aquí: ya viajó, o vive en otro navegador.
        try {
          await uploadSession(study.id, s, eventos.filter((e) => e.sessionId === s.id));
          await uploadFullAudio(study.id, s.id, blob, 0);
          subidas++;
        } catch {
          /* este intento no contó: se vuelve a probar la próxima vez */
        }
      }
      if (subidas) notify(`${subidas} ${subidas === 1 ? 'grabación que estaba atrapada aquí ya viaja' : 'grabaciones que estaban atrapadas aquí ya viajan'} a tu cuenta.`, 'success');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [study.id]);

  if (!conAudio.length) return null;

  /** Trae la grabación (del navegador o de la nube) y la deja lista para oír o descargar. */
  const traer = async (s: Session): Promise<Blob | undefined> => {
    if (blobs[s.id]) return blobs[s.id];
    setCargando(s.id);
    let blob = await getAudio(s.id).catch(() => undefined);
    // Antes solo se buscaba en la nube si la sesión venía marcada 'cloud'. Ahora una prueba hecha
    // aquí mismo también puede haber subido su audio (con cuenta de correo, en un estudio
    // publicado): sin eso, «Está en el navegador donde se hizo la sesión» seguía apareciendo aunque
    // el audio ya viajara. Intentar la nube siempre es gratis cuando no hay copia local.
    if (!blob && study.cloud) {
      const remoto = await downloadCloudAudio(study.id, s.id).catch(() => undefined);
      if (remoto) {
        blob = remoto.blob;
        if (remoto.complete) void saveAudio(s.id, remoto.blob).catch(() => undefined);
      }
    }
    setCargando(undefined);
    if (!blob) {
      setFallo((f) => ({ ...f, [s.id]: study.cloud ? 'No pudimos traerla de la nube.' : 'Está en el navegador donde se hizo la sesión.' }));
      return undefined;
    }
    const url = URL.createObjectURL(blob);
    creadas.current.push(url);
    setBlobs((b) => ({ ...b, [s.id]: blob! }));
    setUrls((u) => ({ ...u, [s.id]: url }));
    return blob;
  };

  const alternar = async (s: Session) => {
    if (urls[s.id]) return setAbierto((a) => ({ ...a, [s.id]: !a[s.id] }));
    if (cargando) return;
    if (await traer(s)) setAbierto((a) => ({ ...a, [s.id]: true }));
  };

  const bajar = async (s: Session) => {
    const blob = (await traer(s)) ?? blobs[s.id];
    if (!blob) return;
    // La URL puede haberse creado en este mismo tick: se arma una propia para el enlace.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${study.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-${s.participant}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  return (
    <section className="card-section">
      <h2 className="section-title">Grabaciones</h2>
      <p className="muted small">
        {conAudio.length} {conAudio.length === 1 ? 'sesión con audio' : 'sesiones con audio'}. Se cargan al reproducirlas; «Exportar JSON» se las lleva todas en un archivo.
      </p>
      <ul className="grabaciones">
        {conAudio.map((s) => (
          <li key={s.id}>
            <div className="grab-cab">
              <button type="button" className="link-btn strong" onClick={() => onAbrir(s.id)}>
                {s.participant}
              </button>
              <span className="muted small">
                {s.device.breakpoint === 'mobile' ? 'Móvil' : s.device.breakpoint === 'tablet' ? 'Tablet' : 'Escritorio'} · {timeAgo(s.startedAt)}
                {blobs[s.id] ? ` · ${megabytes(blobs[s.id].size)}` : ''}
              </span>
              <span className="row">
                <Button size="sm" disabled={cargando === s.id} onClick={() => void bajar(s)}>
                  {cargando === s.id ? 'Preparando…' : 'Descargar'}
                </Button>
                <button
                  type="button"
                  className="icon-btn grab-chev"
                  disabled={cargando === s.id}
                  aria-expanded={!!abierto[s.id]}
                  title={abierto[s.id] ? 'Ocultar la grabación' : 'Escuchar la grabación'}
                  aria-label={`${abierto[s.id] ? 'Ocultar' : 'Escuchar'} la grabación de ${s.participant}`}
                  onClick={() => void alternar(s)}
                >
                  <IconChevronDown size={16} className={abierto[s.id] ? 'abierto' : undefined} />
                </button>
              </span>
            </div>
            {urls[s.id] && abierto[s.id] && <Reproductor src={urls[s.id]} />}
            {fallo[s.id] && <p className="muted small">{fallo[s.id]}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SessionDrawer({ study, session, events, at, onClose }: { study: Study; session?: Session; events: StudyEvent[]; at?: number; onClose: () => void }) {
  const snap = study.snapshot;
  const [audio, setAudio] = useState<string>();
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'missing'>('idle');
  useEffect(() => {
    if (!session?.hasAudio) return;
    let url: string | undefined;
    let alive = true;
    (async () => {
      let blob = await getAudio(session.id).catch(() => undefined);
      if (!blob && session.source === 'cloud') {
        setAudioState('loading');
        const remote = await downloadCloudAudio(study.id, session.id).catch(() => undefined);
        if (remote) {
          blob = remote.blob;
          // Solo se guarda la grabación final; la de una sesión en curso puede seguir creciendo.
          if (remote.complete) void saveAudio(session.id, remote.blob).catch(() => undefined);
        }
      }
      if (!alive) return;
      if (blob) {
        url = URL.createObjectURL(blob);
        setAudio(url);
        setAudioState('idle');
      } else setAudioState('missing');
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [session, study.id]);

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
          {session.source === 'synthetic' && (
            <div className="drawer-sint">
              <Badge tone="accent">Sesión sintética</Badge>
              <span className="muted small">Recorrido simulado con una persona del catálogo, no una persona real.</span>
            </div>
          )}
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
        {session.hasAudio &&
          (audio ? (
            <Reproductor src={audio} />
          ) : (
            <p className="muted small">
              {audioState === 'loading'
                ? 'Cargando la grabación desde la nube…'
                : session.source === 'cloud'
                  ? audioState === 'missing'
                    ? 'No pudimos cargar la grabación. Revisa tu conexión y que la nube esté conectada en Ajustes.'
                    : 'Cargando la grabación…'
                  : 'La grabación está en el navegador donde se hizo la sesión.'}
            </p>
          ))}
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
