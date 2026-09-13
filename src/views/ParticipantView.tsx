import { useEffect, useRef, useState } from 'react';
import type { Breakpoint, Mode, Session, StudyEvent, TaskFeedback } from '../lib/model';
import { baseId } from '../lib/model';
import { getDb, nextParticipant, saveSession } from '../lib/store';
import { decodeStudy, download, resultsFile, type SharedStudy } from '../lib/share';
import { saveAudio } from '../lib/blobs';
import { uid } from '../lib/ids';
import { Runner, type RunnerEvent } from '../components/Runner';
import { Button } from '../components/ui';

type Step = 'intro' | 'consent' | 'task' | 'rate' | 'done';

const viewportBreakpoint = (): Breakpoint => (window.innerWidth < 640 ? 'mobile' : window.innerWidth < 1100 ? 'tablet' : 'desktop');

export function ParticipantView({ studyId, data }: { studyId: string; data: string | null }) {
  const [study, setStudy] = useState<SharedStudy | null>(null);
  const [local, setLocal] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
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
        <div className="participant-card">
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

function Flow({ study, local }: { study: SharedStudy; local: boolean }) {
  const p = study.snapshot;
  const [step, setStep] = useState<Step>('intro');
  const [participate, setParticipate] = useState(false);
  const [audio, setAudio] = useState(false);
  const [taskIndex, setTaskIndex] = useState(0);
  const [outcome, setOutcome] = useState<'success' | 'giveup'>('success');
  const [difficulty, setDifficulty] = useState<number>();
  const [comment, setComment] = useState('');
  const [recording, setRecording] = useState(false);
  const [mode] = useState<Mode>(() => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [bp] = useState<Breakpoint>(viewportBreakpoint);

  const session = useRef<Session | null>(null);
  const events = useRef<StudyEvent[]>([]);
  const t0 = useRef(0);
  const taskStart = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const task = study.tasks[taskIndex];

  const persist = (status: Session['status']) => {
    if (!session.current) return;
    session.current = { ...session.current, status, endedAt: status === 'in_progress' ? undefined : Date.now() };
    if (local) saveSession(session.current, events.current);
  };

  const log = (e: RunnerEvent | Pick<StudyEvent, 'kind' | 'screen'>) => {
    if (!session.current) return;
    events.current.push({ x: 0, y: 0, ...e, id: uid('ev_'), sessionId: session.current.id, taskId: task.id, elapsed: Date.now() - t0.current });
  };

  const start = async () => {
    let audioOk = false;
    if (audio && study.askAudio) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream);
        rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        rec.start(1000);
        recorder.current = rec;
        audioOk = true;
        setRecording(true);
      } catch {
        audioOk = false;
      }
    }
    t0.current = Date.now();
    session.current = {
      id: uid('se_'),
      studyId: study.id,
      participant: local ? nextParticipant(study.id) : 'P',
      device: { breakpoint: bp, width: window.innerWidth, height: window.innerHeight },
      consent: { participate: true, audio: audioOk, at: Date.now() },
      feedback: [],
      status: 'in_progress',
      source: 'local',
      startedAt: Date.now(),
    };
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
    if (recorder.current) {
      const rec = recorder.current;
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        rec.stop();
      });
      rec.stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      if (local && chunks.current.length) {
        try {
          await saveAudio(session.current!.id, new Blob(chunks.current, { type: rec.mimeType }));
          session.current = { ...session.current!, hasAudio: true };
        } catch {
          /* sin espacio para audio */
        }
      }
    }
    persist('completed');
    setStep('done');
  };

  const successBase = task ? baseId(p.screens.find((s) => s.id === task.successScreenId) ?? { id: task.successScreenId, name: '', breakpoint: 'mobile', blocks: [] }) : '';

  if (study.status === 'closed')
    return (
      <div className="participant">
        <div className="participant-card">
          <h1>Esta prueba ya terminó</h1>
          <p>Gracias por tu interés. El estudio ya no recibe nuevas sesiones.</p>
        </div>
      </div>
    );

  if (step === 'intro')
    return (
      <div className="participant">
        <div className="participant-card stack">
          <span className="muted">{p.brand}</span>
          <h1>Ayúdanos a mejorar un diseño</h1>
          <p>Vas a usar un prototipo y completar {study.tasks.length === 1 ? 'una tarea breve' : `${study.tasks.length} tareas breves`}. No evaluamos a ti: evaluamos el diseño. Si algo no se entiende, es justo lo que queremos saber.</p>
          <p className="muted">Toma unos 5 minutos. No necesitas crear una cuenta.</p>
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
            <label className="check">
              <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} />
              <span>
                <strong>Acepto que se grabe el audio de mi micrófono</strong> mientras pienso en voz alta. Es opcional: puedes participar sin grabación.
              </span>
            </label>
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
              {recording ? ', grabando audio' : ''}
            </span>
            <p className="task-prompt">{task.prompt}</p>
          </div>
          <Button size="sm" onClick={() => finishTask('giveup', events.current.filter((e) => e.kind === 'navigate').at(-1)?.screen ?? task.startScreenId)}>
            No pude completarla
          </Button>
        </div>
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
            <p>Descarga tus resultados y envíaselos a quien te invitó. El archivo solo contiene lo que hiciste dentro del prototipo.</p>
            <Button tone="primary" onClick={() => session.current && download(`resultados-${study.id}.json`, resultsFile(study.id, [session.current], events.current))}>
              Descargar resultados
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
