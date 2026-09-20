import type { Project, Session, Study, StudyEvent } from './model';
import { baseId, plainText } from './model';
import { bfs, navGraph } from './flowCheck';

export interface Citation {
  sessionId: string;
  participant: string;
  taskId: string;
  screen: string;
  elapsed: number;
}

export type ThemeKind = 'hesitation' | 'blocked' | 'misclick' | 'giveup' | 'detour' | 'difficulty';

export interface Theme {
  id: string;
  kind: ThemeKind;
  title: string;
  detail: string;
  count: number;
  total: number;
  citations: Citation[];
  screenId?: string;
  blockId?: string;
}

export interface TaskMetrics {
  taskId: string;
  prompt: string;
  started: number;
  success: number;
  giveup: number;
  successRate: number;
  medianMs: number | null;
  avgMisclicks: number;
  avgDifficulty: number | null;
}

export interface Quote {
  sessionId: string;
  participant: string;
  taskId: string;
  comment: string;
  difficulty?: number;
}

export interface Analysis {
  total: number;
  tasks: TaskMetrics[];
  themes: Theme[];
  quotes: Quote[];
}

export const fmt1 = (n: number) => n.toFixed(1).replace('.', ',');
export const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
};

// «1 de 15 personas dudó», «6 de 15 personas dudaron»
const people = (n: number, total: number, singular: string, plural: string) =>
  `${n} de ${total} ${total === 1 ? 'persona' : 'personas'} ${n === 1 ? singular : plural}`;

export function screenName(p: Project, id: string) {
  return p.screens.find((s) => s.id === id)?.name ?? 'pantalla eliminada';
}

export function blockLabel(p: Project, blockId?: string) {
  if (!blockId) return '';
  for (const s of p.screens) {
    const b = s.blocks.find((x) => x.id === blockId);
    if (b) return plainText(b.label);
    // Pantallas importadas como imagen: lo tocado es una zona, no un bloque.
    const h = s.hotspots?.find((x) => x.id === blockId);
    if (h) return plainText(h.label || 'zona tocable');
  }
  return 'bloque eliminado';
}

export const consentedSessions = (study: Study, sessions: Session[]) =>
  sessions.filter((s) => s.studyId === study.id && s.consent.participate);

export function analyzeStudy(study: Study, allSessions: Session[], allEvents: StudyEvent[]): Analysis {
  const p = study.snapshot;
  const sessions = consentedSessions(study, allSessions);
  const total = sessions.length;
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const events = allEvents.filter((e) => sessionById.has(e.sessionId)).sort((a, b) => a.elapsed - b.elapsed);

  const cite = (e: StudyEvent): Citation => ({
    sessionId: e.sessionId,
    participant: sessionById.get(e.sessionId)!.participant,
    taskId: e.taskId,
    screen: e.screen,
    elapsed: e.elapsed,
  });

  // Agrupa eventos por clave, una cita por sesión.
  const group = (filter: (e: StudyEvent) => boolean, key: (e: StudyEvent) => string) => {
    const m = new Map<string, Map<string, StudyEvent>>();
    for (const e of events) {
      if (!filter(e)) continue;
      const k = key(e);
      if (!m.has(k)) m.set(k, new Map());
      if (!m.get(k)!.has(e.sessionId)) m.get(k)!.set(e.sessionId, e);
    }
    return m;
  };

  const themes: Theme[] = [];

  for (const [k, bySession] of group((e) => e.kind === 'hesitation' && !!e.block, (e) => `${e.screen}|${e.block}|${e.option ?? ''}`)) {
    const [screen, block, option] = k.split('|');
    const list = [...bySession.values()];
    const dwells = [...events.filter((e) => e.kind === 'hesitation' && e.block === block && e.screen === screen && (e.option ?? '') === option)].map((e) => e.dwell ?? 0);
    const avg = dwells.reduce((a, b) => a + b, 0) / Math.max(1, dwells.length);
    themes.push({
      id: `hes-${k}`,
      kind: 'hesitation',
      title: `${people(list.length, total, 'dudó', 'dudaron')} en «${option ? plainText(option) : blockLabel(p, block)}»`,
      detail: `En «${screenName(p, screen)}» pasaron en promedio ${fmt1(avg / 1000)} s sin actuar antes de interactuar con ese elemento.`,
      count: list.length,
      total,
      citations: list.map(cite),
      screenId: screen,
      blockId: block,
    });
  }

  for (const [screen, bySession] of group((e) => e.kind === 'blocked', (e) => e.screen)) {
    const list = [...bySession.values()];
    themes.push({
      id: `blk-${screen}`,
      kind: 'blocked',
      title: `${people(list.length, total, 'intentó', 'intentaron')} continuar sin completar un campo obligatorio en «${screenName(p, screen)}»`,
      detail: 'El botón no avanzó porque faltaba información. Revisa si el campo obligatorio se entiende antes de tocar el botón.',
      count: list.length,
      total,
      citations: list.map(cite),
      screenId: screen,
    });
  }

  for (const [screen, bySession] of group((e) => e.kind === 'misclick', (e) => e.screen)) {
    const list = [...bySession.values()];
    themes.push({
      id: `mis-${screen}`,
      kind: 'misclick',
      title: `${people(list.length, total, 'tocó', 'tocaron')} zonas sin acción en «${screenName(p, screen)}»`,
      detail: 'Esperaban que algo reaccionara donde no hay interacción. Mira el mapa de calor de esa pantalla.',
      count: list.length,
      total,
      citations: list.map(cite),
      screenId: screen,
    });
  }

  const g = navGraph(p);
  const reverse = new Map<string, Set<string>>();
  for (const [from, tos] of g) for (const to of tos) {
    if (!reverse.has(to)) reverse.set(to, new Set());
    reverse.get(to)!.add(from);
  }
  const baseOf = (id: string) => {
    const s = p.screens.find((x) => x.id === id);
    return s ? baseId(s) : id;
  };

  const tasks: TaskMetrics[] = study.tasks.map((task) => {
    const taskEvents = events.filter((e) => e.taskId === task.id);
    const started = new Set(taskEvents.filter((e) => e.kind === 'task_start').map((e) => e.sessionId));
    const feedback = sessions.flatMap((s) => s.feedback.filter((f) => f.taskId === task.id).map((f) => ({ s, f })));
    const success = feedback.filter((x) => x.f.outcome === 'success');
    const giveup = feedback.filter((x) => x.f.outcome === 'giveup');
    const durations = success.map((x) => x.f.durationMs).sort((a, b) => a - b);
    const medianMs = durations.length ? durations[Math.floor((durations.length - 1) / 2)] : null;
    const misclicks = taskEvents.filter((e) => e.kind === 'misclick').length;
    const ratings = feedback.map((x) => x.f.difficulty).filter((d): d is number => typeof d === 'number');
    const avgDifficulty = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

    if (giveup.length) {
      themes.push({
        id: `giv-${task.id}`,
        kind: 'giveup',
        title: `${people(giveup.length, total, 'no logró', 'no lograron')} «${task.prompt.replace(/\.$/, '')}»`,
        detail: `Abandonaron la tarea. La última pantalla que vieron fue ${[
          ...new Set(taskEvents.filter((e) => e.kind === 'task_giveup').map((e) => `«${screenName(p, e.screen)}»`)),
        ].join(', ')}.`,
        count: giveup.length,
        total,
        citations: taskEvents.filter((e) => e.kind === 'task_giveup').map(cite),
      });
    }

    // Desvíos: pantallas desde las que no se avanza hacia el objetivo. Un camino alternativo que
    // igual acerca a la meta (por ejemplo, elegir el contacto desde la lista) no es un desvío.
    const start = baseOf(task.startScreenId);
    const to = bfs(reverse, baseOf(task.successScreenId));
    const best = to.get(start);
    if (best != null) {
      const progresses = (id: string) => {
        const b = baseOf(id);
        return b === start || (to.get(b) ?? Infinity) < best;
      };
      for (const [screen, bySession] of group(
        (e) => e.taskId === task.id && e.kind === 'navigate' && !progresses(e.screen),
        (e) => baseOf(e.screen),
      )) {
        const list = [...bySession.values()];
        themes.push({
          id: `det-${task.id}-${screen}`,
          kind: 'detour',
          title: `${people(list.length, total, 'se desvió', 'se desviaron')} a «${screenName(p, screen)}» mientras ${list.length === 1 ? 'intentaba' : 'intentaban'} «${task.prompt.replace(/\.$/, '')}»`,
          detail: 'Desde esa pantalla no se avanza hacia el objetivo de la tarea: hay que volver o buscar por otro lado.',
          count: list.length,
          total,
          citations: list.map(cite),
          screenId: screen,
        });
      }
    }

    if (avgDifficulty != null && avgDifficulty >= 3.5) {
      const hard = feedback.filter((x) => (x.f.difficulty ?? 0) >= 4);
      themes.push({
        id: `dif-${task.id}`,
        kind: 'difficulty',
        title: `«${task.prompt.replace(/\.$/, '')}» se percibió difícil: ${fmt1(avgDifficulty)} de 5 en promedio`,
        detail: `${hard.length} ${hard.length === 1 ? 'persona la calificó' : 'personas la calificaron'} con 4 o 5.`,
        count: hard.length,
        total,
        citations: hard.map((x) => ({ sessionId: x.s.id, participant: x.s.participant, taskId: task.id, screen: task.startScreenId, elapsed: 0 })),
      });
    }

    return {
      taskId: task.id,
      prompt: task.prompt,
      started: started.size,
      success: success.length,
      giveup: giveup.length,
      successRate: started.size ? success.length / started.size : 0,
      medianMs,
      avgMisclicks: started.size ? misclicks / started.size : 0,
      avgDifficulty,
    };
  });

  const quotes: Quote[] = sessions.flatMap((s) =>
    s.feedback.filter((f) => f.comment?.trim()).map((f) => ({ sessionId: s.id, participant: s.participant, taskId: f.taskId, comment: f.comment!.trim(), difficulty: f.difficulty })),
  );

  // Un mismo elemento puede aparecer en varias pantallas (por ejemplo, la barra inferior): se nombra la pantalla.
  const repeated = new Map<string, number>();
  for (const t of themes) repeated.set(t.title, (repeated.get(t.title) ?? 0) + 1);
  for (const t of themes) {
    const screen = t.screenId ?? (t.kind === 'hesitation' ? t.id.slice(4).split('|')[0] : undefined);
    if ((repeated.get(t.title) ?? 0) > 1 && screen) t.title = `${t.title} de «${screenName(p, screen)}»`;
  }

  themes.sort((a, b) => b.count - a.count);
  return { total, tasks, themes, quotes };
}

export interface Overview {
  sessions: number;
  completion: number;
  medianTaskMs: number | null;
  hesitations: number;
  misclicksPerSession: number;
  avgDifficulty: number | null;
  withAudio: number;
}

/** Indicadores generales del estudio para el panel de resultados. */
export function overview(study: Study, allSessions: Session[], allEvents: StudyEvent[], analysis: Analysis): Overview {
  const sessions = consentedSessions(study, allSessions);
  const ids = new Set(sessions.map((s) => s.id));
  const events = allEvents.filter((e) => ids.has(e.sessionId));
  const started = analysis.tasks.reduce((n, t) => n + t.started, 0);
  const success = analysis.tasks.reduce((n, t) => n + t.success, 0);
  const durations = sessions
    .flatMap((s) => s.feedback.filter((f) => f.outcome === 'success').map((f) => f.durationMs))
    .sort((a, b) => a - b);
  const ratings = sessions.flatMap((s) => s.feedback.map((f) => f.difficulty)).filter((d): d is number => typeof d === 'number');
  return {
    sessions: sessions.length,
    completion: started ? success / started : 0,
    medianTaskMs: durations.length ? durations[Math.floor((durations.length - 1) / 2)] : null,
    hesitations: events.filter((e) => e.kind === 'hesitation').length,
    misclicksPerSession: sessions.length ? events.filter((e) => e.kind === 'misclick').length / sessions.length : 0,
    avgDifficulty: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    withAudio: sessions.filter((s) => s.hasAudio).length,
  };
}

export interface FunnelStep {
  screenId: string;
  name: string;
  reached: number;
  started: number;
}

/** Embudo del camino más corto de una tarea: cuántas personas llegaron a cada pantalla. */
export function taskFunnel(study: Study, allSessions: Session[], allEvents: StudyEvent[], taskId: string): FunnelStep[] {
  const task = study.tasks.find((t) => t.id === taskId);
  if (!task) return [];
  const p = study.snapshot;
  const baseOf = (id: string) => {
    const s = p.screens.find((x) => x.id === id);
    return s ? baseId(s) : id;
  };
  const g = navGraph(p);
  const start = baseOf(task.startScreenId);
  const goal = baseOf(task.successScreenId);
  const parent = new Map<string, string | null>([[start, null]]);
  const queue = [start];
  while (queue.length && !parent.has(goal)) {
    const cur = queue.shift()!;
    for (const n of g.get(cur) ?? []) {
      if (!parent.has(n)) {
        parent.set(n, cur);
        queue.push(n);
      }
    }
  }
  if (!parent.has(goal)) return [];
  const path: string[] = [];
  for (let cur: string | null | undefined = goal; cur; cur = parent.get(cur)) path.unshift(cur);

  const ids = new Set(consentedSessions(study, allSessions).map((s) => s.id));
  const events = allEvents.filter((e) => ids.has(e.sessionId) && e.taskId === taskId);
  const startedSet = new Set(events.filter((e) => e.kind === 'task_start').map((e) => e.sessionId));
  return path.map((screenId, i) => {
    const reached =
      i === 0 ? startedSet.size : new Set(events.filter((e) => e.kind === 'navigate' && baseOf(e.screen) === screenId && startedSet.has(e.sessionId)).map((e) => e.sessionId)).size;
    return { screenId, name: screenName(p, screenId), reached, started: startedSet.size };
  });
}

/** Datos compactos y trazables para el resumen por IA. */
export function buildAiDataset(study: Study, sessions: Session[], events: StudyEvent[]) {
  const p = study.snapshot;
  const ok = consentedSessions(study, sessions);
  return {
    study: study.name,
    tasks: study.tasks.map((t) => ({ id: t.id, prompt: t.prompt })),
    sessions: ok.map((s) => {
      const ev = events.filter((e) => e.sessionId === s.id).sort((a, b) => a.elapsed - b.elapsed);
      return {
        session_id: s.id,
        participant: s.participant,
        device: s.device.breakpoint,
        tasks: study.tasks.map((t) => {
          const te = ev.filter((e) => e.taskId === t.id);
          const f = s.feedback.find((x) => x.taskId === t.id);
          return {
            task_id: t.id,
            outcome: f?.outcome ?? 'sin terminar',
            difficulty_1_to_5: f?.difficulty ?? null,
            comment: f?.comment ?? null,
            duration_s: f ? Math.round(f.durationMs / 1000) : null,
            path: te.filter((e) => e.kind === 'navigate').map((e) => screenName(p, e.screen)),
            hesitations: te.filter((e) => e.kind === 'hesitation').map((e) => ({ element: e.option ? plainText(e.option) : blockLabel(p, e.block), screen: screenName(p, e.screen), seconds: Math.round((e.dwell ?? 0) / 1000) })),
            taps_without_action: te.filter((e) => e.kind === 'misclick').map((e) => screenName(p, e.screen)),
            blocked_by_required_field: te.filter((e) => e.kind === 'blocked').map((e) => screenName(p, e.screen)),
          };
        }),
      };
    }),
  };
}
