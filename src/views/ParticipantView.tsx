import { useEffect, useRef, useState } from 'react';
import type { Breakpoint, Mode, Session, StudyEvent, TaskFeedback } from '../lib/model';
import { baseId } from '../lib/model';
import { getDb, nextParticipant, saveSession } from '../lib/store';
import { decodeStudy, download, resultsFile, type SharedStudy } from '../lib/share';
import { saveAudio } from '../lib/blobs';
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
  return <Flow study={study} local={local} />;
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

function Flow({ study, local }: { study: SharedStudy; local: boolean }) {
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

  const task = study.tasks[taskIndex];

  useEffect(
    () => () => {
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

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
      next.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
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
    if (audioWanted && study.askAudio) await startRecording();
    beginTask(0);
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
    if (rec && local && chunks.current.length) {
      try {
        await saveAudio(session.current!.id, new Blob(chunks.current, { type: rec.mimeType }));
        session.current = { ...session.current!, hasAudio: true };
      } catch {
        /* sin espacio para audio */
      }
    }
    persist('completed');
    setStep('done');
  };

  const shareResults = async () => {
    if (!session.current) return;
    const content = resultsFile(study.id, [session.current], events.current);
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
          <p>Tus respuestas quedaron guardadas. Ya puedes cerrar esta pestaña.</p>
        ) : (
          <>
            <p>Envía tus resultados a quien te invitó. El archivo solo contiene lo que hiciste dentro del prototipo.</p>
            <Button tone="primary" onClick={shareResults}>
              Enviar resultados
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
