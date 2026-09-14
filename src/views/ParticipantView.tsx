import { useEffect, useRef, useState } from 'react';
import type { Breakpoint, Mode, Session, StudyEvent, TaskFeedback } from '../lib/model';
import { baseId } from '../lib/model';
import { getDb, nextParticipant, saveSession } from '../lib/store';
import { blobToAudio, decodeStudy, download, megabytes, resultsFile, type AudioMap, type SharedStudy } from '../lib/share';
import { clearDraft, loadDraft, saveAudio, saveDraft, saveDraftChunk, type SessionDraft } from '../lib/blobs';
import { uid } from '../lib/ids';
import { notify } from '../lib/toast';
import { isIOS, isStandalone, promptInstall, rememberStudyLink, useInstallable } from '../lib/pwa';
import { Runner, type RunnerEvent } from '../components/Runner';
import { Button } from '../components/ui';
import { BrandLockup } from '../components/Shell';

type Step = 'intro' | 'consent' | 'task' | 'rate' | 'done';

const viewportBreakpoint = (): Breakpoint => (window.innerWidth < 640 ? 'mobile' : window.innerWidth < 1100 ? 'tablet' : 'desktop');

export function ParticipantView({ studyId, data }: { studyId: string; data: string | null }) {
  const [study, setStudy] = useState<SharedStudy | null>(null);
  const [local, setLocal] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [run, setRun] = useState(0);

  useEffect(() => {
    rememberStudyLink();
    const inDb = getDb().studies.find((s) => s.id === studyId);
    if (inDb) {
      setStudy(inDb);
      setLocal(true);
      return;
    }
    if (!data) {
      setLoadError('Este enlace está incompleto. Pide a quien te invitó que te lo vuelva a enviar.');
      return;
    }
    decodeStudy(data)
      .then((s) => (s.id === studyId ? setStudy(s) : setLoadError('Este enlace no corresponde a un estudio válido.')))
      .catch(() => setLoadError('No pudimos abrir este estudio. Es posible que el enlace se haya cortado al copiarlo.'));
  }, [studyId, data]);

  if (loadError)
    return (
      <div className="participant">
        <div className="participant-card stack">
          <h1>No pudimos abrir la prueba</h1>
          <p>{loadError}</p>
        </div>
      </div>
    );
  if (!study)
    return (
      <div className="participant">
        <div className="participant-card">
          <p>Cargando la prueba…</p>
        </div>
      </div>
    );
  return <Flow key={run} study={study} local={local} onRestart={() => setRun((r) => r + 1)} />;
}

function InstallCard() {
  const installable = useInstallable();
  if (isStandalone()) return null;
  if (installable)
    return (
      <div className="install-card">
        <div>
          <strong>Instálalo en tu celular</strong>
          <p className="muted small">Se abre como una app, a pantalla completa y sin la barra del navegador.</p>
        </div>
        <Button size="sm" onClick={() => promptInstall()}>
          Instalar
        </Button>
      </div>
    );
  if (isIOS())
    return (
      <div className="install-card">
        <div>
          <strong>Instálalo en tu iPhone</strong>
          <p className="muted small">Toca Compartir y luego «Agregar a pantalla de inicio». Se abrirá como una app.</p>
        </div>
      </div>
    );
  return null;
}

function SwitchRow({ checked, onChange, label, detail }: { checked: boolean; onChange: (v: boolean) => void; label: string; detail?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch-row" onClick={() => onChange(!checked)}>
      <span>
        <strong>{label}</strong>
        {detail && <span className="muted small">{detail}</span>}
      </span>
      <span className={`switch ${checked ? 'on' : ''}`} aria-hidden="true">
        <i />
      </span>
    </button>
  );
}

function Flow({ study, local, onRestart }: { study: SharedStudy; local: boolean; onRestart: () => void }) {
  const p = study.snapshot;
  const [step, setStep] = useState<Step>('intro');
  const [participate, setParticipate] = useState(false);
  const [audioWanted, setAudioWanted] = useState(false);
  const [taskIndex, setTaskIndex] = useState(0);
  const [outcome, setOutcome] = useState<'success' | 'giveup'>('success');
  const [difficulty, setDifficulty] = useState<number>();
  const [comment, setComment] = useState('');
  const [recording, setRecording] = useState(false);
  const [askRecord, setAskRecord] = useState(false);
  const [mode] = useState<Mode>(() => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [bp] = useState<Breakpoint>(viewportBreakpoint);

  const session = useRef<Session | null>(null);
  const events = useRef<StudyEvent[]>([]);
  const t0 = useRef(0);
  const taskStart = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioBlob = useRef<Blob | null>(null);
  const [audioSize, setAudioSize] = useState(0);
  const chunkIndex = useRef(0);
  const [recovered, setRecovered] = useState<{ draft: SessionDraft; audio?: Blob }>();

  const task = study.tasks[taskIndex];

  useEffect(
    () => () => {
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  // Una prueba que quedó a medias en este navegador (pestaña cerrada, celular sin batería…).
  useEffect(() => {
    let alive = true;
    loadDraft(study.id).then((r) => alive && r && r.draft.session.studyId === study.id && setRecovered(r));
    return () => {
      alive = false;
    };
  }, [study.id]);

  /** Guarda el avance (sesión y eventos). El audio ya se guarda trozo a trozo al grabar. */
  const saveDraftNow = () => {
    if (!session.current) return;
    void saveDraft(study.id, { session: session.current, events: [...events.current], mimeType: recorder.current?.mimeType, chunks: chunkIndex.current, savedAt: Date.now() }).catch(() => undefined);
  };

  useEffect(() => {
    if (step !== 'task' && step !== 'rate') return;
    const timer = window.setInterval(saveDraftNow, 3000);
    const onHide = () => document.visibilityState === 'hidden' && saveDraftNow();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', saveDraftNow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', saveDraftNow);
    };
    // saveDraftNow solo lee referencias; basta con reiniciar el temporizador al cambiar de paso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const persist = (status: Session['status']) => {
    if (!session.current) return;
    session.current = { ...session.current, status, endedAt: status === 'in_progress' ? undefined : Date.now() };
    if (local) saveSession(session.current, events.current);
  };

  const log = (e: RunnerEvent | Pick<StudyEvent, 'kind' | 'screen'>) => {
    if (!session.current) return;
    events.current.push({ x: 0, y: 0, ...e, id: uid('ev_'), sessionId: session.current.id, taskId: task.id, elapsed: Date.now() - t0.current });
  };

  /** Enciende la grabación. Pide el micrófono solo la primera vez. */
  const startRecording = async (): Promise<boolean> => {
    const rec = recorder.current;
    if (rec && rec.state === 'paused') {
      rec.resume();
      setRecording(true);
      return true;
    }
    if (rec && rec.state === 'recording') return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const next = new MediaRecorder(stream);
      next.ondataavailable = (e) => {
        if (!e.data.size) return;
        chunks.current.push(e.data);
        if (session.current) void saveDraftChunk(session.current.id, chunkIndex.current++, e.data).catch(() => undefined);
      };
      next.start(1000);
      recorder.current = next;
      setRecording(true);
      if (session.current) session.current = { ...session.current, consent: { ...session.current.consent, audio: true } };
      return true;
    } catch {
      notify('No pudimos acceder al micrófono. Revisa los permisos del navegador; puedes seguir la prueba sin grabar.', 'error');
      setRecording(false);
      return false;
    }
  };

  const pauseRecording = () => {
    if (recorder.current?.state === 'recording') recorder.current.pause();
    setRecording(false);
  };

  const start = async () => {
    t0.current = Date.now();
    session.current = {
      id: uid('se_'),
      studyId: study.id,
      participant: local ? nextParticipant(study.id) : 'P',
      device: { breakpoint: bp, width: window.innerWidth, height: window.innerHeight },
      consent: { participate: true, audio: false, at: Date.now() },
      feedback: [],
      status: 'in_progress',
      source: 'local',
      startedAt: Date.now(),
    };
    chunkIndex.current = 0;
    if (audioWanted && study.askAudio) await startRecording();
    beginTask(0);
    saveDraftNow();
  };

  const beginTask = (i: number) => {
    setTaskIndex(i);
    taskStart.current = Date.now();
    events.current.push({ id: uid('ev_'), sessionId: session.current!.id, taskId: study.tasks[i].id, screen: study.tasks[i].startScreenId, kind: 'task_start', x: 0, y: 0, elapsed: Date.now() - t0.current });
    setDifficulty(undefined);
    setComment('');
    setStep('task');
  };

  const finishTask = (result: 'success' | 'giveup', screen: string) => {
    log({ kind: result === 'success' ? 'task_success' : 'task_giveup', screen });
    setOutcome(result);
    setStep('rate');
  };

  const submitRating = async () => {
    const fb: TaskFeedback = { taskId: task.id, outcome, difficulty, comment: comment.trim() || undefined, durationMs: Date.now() - taskStart.current };
    session.current = { ...session.current!, feedback: [...session.current!.feedback, fb] };
    if (taskIndex + 1 < study.tasks.length) {
      persist('in_progress');
      beginTask(taskIndex + 1);
      saveDraftNow();
      return;
    }
    const rec = recorder.current;
    if (rec && rec.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        rec.stop();
      });
    }
    rec?.stream.getTracks().forEach((t) => t.stop());
    setRecording(false);
    if (rec && chunks.current.length) {
      const blob = new Blob(chunks.current, { type: rec.mimeType });
      if (local) {
        try {
          await saveAudio(session.current!.id, blob);
          session.current = { ...session.current!, hasAudio: true };
        } catch {
          notify('No hubo espacio en este navegador para guardar el audio. Tus respuestas sí quedaron guardadas.', 'error');
        }
      } else {
        // Desde el enlace, la grabación viaja dentro del archivo de resultados.
        audioBlob.current = blob;
        setAudioSize(blob.size);
        session.current = { ...session.current!, hasAudio: true };
      }
    }
    persist('completed');
    // En este navegador ya quedó guardada; desde el enlace se conserva hasta que envíe los resultados.
    if (local) await clearDraft(study.id, session.current!.id);
    else saveDraftNow();
    setStep('done');
  };

  /** Recupera una prueba a medias: guarda (aquí) o prepara el envío (enlace) de lo que alcanzó a hacer. */
  const recoverResults = async () => {
    if (!recovered) return;
    const { draft, audio } = recovered;
    const id = draft.session.id;
    session.current = { ...draft.session, status: draft.session.status === 'completed' ? 'completed' : 'abandoned', endedAt: draft.session.endedAt ?? draft.savedAt, hasAudio: false };
    events.current = draft.events;
    if (local) {
      if (audio) {
        try {
          await saveAudio(id, audio);
          session.current = { ...session.current, hasAudio: true };
        } catch {
          notify('No hubo espacio en este navegador para guardar el audio. Tus respuestas sí quedaron guardadas.', 'error');
        }
      }
      saveSession(session.current, events.current);
      await clearDraft(study.id, id);
    } else {
      audioBlob.current = audio ?? null;
      setAudioSize(audio?.size ?? 0);
      session.current = { ...session.current, hasAudio: !!audio };
    }
    setRecovered(undefined);
    setStep('done');
  };

  const discardRecovered = async () => {
    if (!recovered) return;
    const { draft } = recovered;
    // Aquí la sesión ya estaba en los resultados: queda como abandonada, sin audio.
    if (local && getDb().sessions.some((s) => s.id === draft.session.id)) saveSession({ ...draft.session, status: 'abandoned', hasAudio: false, endedAt: draft.savedAt }, draft.events);
    await clearDraft(study.id, draft.session.id);
    setRecovered(undefined);
  };

  const shareResults = async () => {
    if (!session.current) return;
    let audio: AudioMap | undefined;
    if (audioBlob.current) {
      try {
        audio = { [session.current.id]: await blobToAudio(audioBlob.current) };
      } catch {
        notify('No pudimos adjuntar el audio. Tus respuestas se enviarán sin la grabación.', 'error');
      }
    }
    const sent = audio ? session.current : { ...session.current, hasAudio: false };
    const content = resultsFile(study.id, [sent], events.current, audio);
    void clearDraft(study.id, sent.id);
    const name = `resultados-${study.id}.json`;
    const file = new File([content], name, { type: 'application/json' });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Resultados de ${study.name}` });
        return;
      } catch {
        /* cancelado: se ofrece la descarga */
      }
    }
    download(name, content);
  };

  const successBase = task ? baseId(p.screens.find((s) => s.id === task.successScreenId) ?? { id: task.successScreenId, name: '', breakpoint: 'mobile', blocks: [] }) : '';

  if (recovered && step === 'intro') {
    const finished = recovered.draft.session.status === 'completed';
    const done = recovered.draft.session.feedback.length;
    return (
      <div className="participant">
        <div className="participant-card stack">
          <BrandLockup />
          <h1>{finished ? 'Te falta enviar tus resultados' : 'Tienes una prueba sin terminar'}</h1>
          <p>
            {finished ? `Terminaste ${study.tasks.length === 1 ? 'la tarea' : `las ${study.tasks.length} tareas`}` : `Completaste ${done} de ${study.tasks.length} ${study.tasks.length === 1 ? 'tarea' : 'tareas'}`}
            {recovered.audio ? ' y quedó guardada la grabación de audio hasta ese momento' : ''}.{' '}
            {local ? 'Puedes guardar lo que alcanzaste a hacer o empezar de nuevo.' : 'Puedes enviar lo que alcanzaste a hacer a quien te invitó o empezar de nuevo.'}
          </p>
          <Button tone="primary" onClick={recoverResults}>
            {local ? 'Guardar lo que alcancé' : 'Preparar el envío'}
          </Button>
          <Button onClick={discardRecovered}>Empezar de nuevo</Button>
        </div>
      </div>
    );
  }

  if (study.status === 'closed')
    return (
      <div className="participant">
        <div className="participant-card stack">
          <h1>Esta prueba ya terminó</h1>
          <p>Gracias por tu interés. El estudio ya no recibe nuevas sesiones.</p>
        </div>
      </div>
    );

  if (step === 'intro')
    return (
      <div className="participant">
        <div className="participant-card stack">
          <BrandLockup />
          <span className="muted">{p.brand}</span>
          <h1>Ayúdanos a mejorar un diseño</h1>
          <p>
            Vas a usar un prototipo y completar {study.tasks.length === 1 ? 'una tarea breve' : `${study.tasks.length} tareas breves`}. No evaluamos a ti: evaluamos el diseño. Si algo no se entiende, es justo lo que queremos saber.
          </p>
          <p className="muted">Toma unos 5 minutos. No necesitas crear una cuenta.</p>
          <InstallCard />
          <Button tone="primary" onClick={() => setStep('consent')}>
            Continuar
          </Button>
        </div>
      </div>
    );

  if (step === 'consent')
    return (
      <div className="participant">
        <div className="participant-card stack">
          <h1>Antes de empezar</h1>
          <label className="check">
            <input type="checkbox" checked={participate} onChange={(e) => setParticipate(e.target.checked)} />
            <span>
              <strong>Acepto participar.</strong> Se registrarán mis toques, el tiempo que tomo y mis respuestas dentro de este prototipo. No se registra nada fuera de él.
            </span>
          </label>
          {study.askAudio && (
            <SwitchRow
              checked={audioWanted}
              onChange={setAudioWanted}
              label="¿Quieres grabar el audio mientras pruebas?"
              detail="Es opcional y aparte de tu participación. Puedes encenderlo o apagarlo en cualquier momento durante la prueba."
            />
          )}
          <Button tone="primary" disabled={!participate} onClick={start}>
            Empezar la prueba
          </Button>
        </div>
      </div>
    );

  if (step === 'task')
    return (
      <div className="participant participant-run">
        <div className="task-bar">
          <div>
            <span className="muted small">
              Tarea {taskIndex + 1} de {study.tasks.length}
            </span>
            <p className="task-prompt">{task.prompt}</p>
          </div>
          <div className="task-actions">
            {study.askAudio && (
              <button
                type="button"
                role="switch"
                aria-checked={recording}
                className={`rec-toggle ${recording ? 'on' : ''}`}
                onClick={() => {
                  if (recording) pauseRecording();
                  else if (session.current?.consent.audio) startRecording();
                  else setAskRecord(true);
                }}
              >
                <span className={`switch ${recording ? 'on' : ''}`} aria-hidden="true">
                  <i />
                </span>
                {recording ? 'Grabando audio' : 'Grabar audio'}
              </button>
            )}
            <Button size="sm" onClick={() => finishTask('giveup', events.current.filter((e) => e.kind === 'navigate').at(-1)?.screen ?? task.startScreenId)}>
              No pude completarla
            </Button>
          </div>
        </div>
        {askRecord && (
          <div className="rec-ask" role="alertdialog" aria-label="¿Grabar el audio?">
            <strong>¿Quieres grabar el audio de esta sesión?</strong>
            <p className="small">Grabaremos tu voz mientras usas el prototipo para entender qué piensas. Solo se usa para mejorar el diseño y puedes apagarlo cuando quieras.</p>
            <div className="row">
              <Button
                tone="primary"
                size="sm"
                onClick={async () => {
                  setAskRecord(false);
                  await startRecording();
                }}
              >
                Sí, grabar audio
              </Button>
              <Button size="sm" onClick={() => setAskRecord(false)}>
                Ahora no
              </Button>
            </div>
          </div>
        )}
        <div className={bp === 'mobile' ? 'participant-fill' : 'participant-stage'}>
          <Runner
            key={task.id}
            project={p}
            startScreenId={task.startScreenId}
            breakpoint={bp}
            mode={mode}
            fill={bp === 'mobile'}
            maxScale={1}
            onEvent={log}
            onScreen={(screenId) => {
              const s = p.screens.find((x) => x.id === screenId);
              if (s && baseId(s) === successBase) setTimeout(() => finishTask('success', screenId), 700);
            }}
          />
        </div>
      </div>
    );

  if (step === 'rate')
    return (
      <div className="participant">
        <div className="participant-card stack">
          <h1>{outcome === 'success' ? '¡Lo lograste!' : 'Gracias por intentarlo'}</h1>
          <fieldset className="choice">
            <legend>¿Qué tan difícil fue esta tarea?</legend>
            <div className="rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n}>
                  <input type="radio" name="difficulty" checked={difficulty === n} onChange={() => setDifficulty(n)} />
                  <strong>{n}</strong>
                  <span>{n === 1 ? 'Muy fácil' : n === 5 ? 'Muy difícil' : ''}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span className="field-label">¿Algo te confundió? (opcional)</span>
            <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <Button tone="primary" onClick={submitRating}>
            {taskIndex + 1 < study.tasks.length ? 'Siguiente tarea' : 'Terminar'}
          </Button>
        </div>
      </div>
    );

  return (
    <div className="participant">
      <div className="participant-card stack">
        <h1>¡Gracias por participar!</h1>
        {local ? (
          <>
            <p>Tus respuestas quedaron guardadas. Si otra persona va a usar este mismo dispositivo, empieza una sesión nueva.</p>
            <Button tone="primary" onClick={onRestart}>
              Iniciar otra sesión
            </Button>
          </>
        ) : (
          <>
            <p>
              Envía tus resultados a quien te invitó. El archivo solo contiene lo que hiciste dentro del prototipo
              {audioSize ? ` y la grabación de audio (${megabytes(audioSize * 1.37)})` : ''}.
            </p>
            {audioSize > 20 * 1048576 && <p className="muted small">Es un archivo grande. Si tu correo no permite adjuntarlo, compártelo con un servicio de archivos como Drive.</p>}
            <Button tone="primary" onClick={shareResults}>
              Enviar resultados
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
