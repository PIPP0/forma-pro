// Del dato al criterio: convierte los eventos de un estudio en hallazgos priorizados,
// métricas comparables y un resumen con el que se puede decidir.
import type { Session, Study, StudyEvent } from './model';
import type { Analysis, Citation, Quote, ThemeKind } from './analysis';
import { analyzeStudy, blockLabel, consentedSessions, fmt1, fmtDuration, screenName, taskFunnel } from './analysis';

export type Severidad = 'critica' | 'alta' | 'media' | 'baja';
export type Confianza = 'alta' | 'media' | 'exploratoria';

export const SEVERIDAD_LABEL: Record<Severidad, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

export interface Hallazgo {
  id: string;
  kind: ThemeKind;
  titulo: string;
  severidad: Severidad;
  /** 0 a 100: frecuencia por impacto. Ordena la lista. */
  puntaje: number;
  afectados: number;
  total: number;
  /** Frases con números, cada una verificable en los datos. */
  evidencia: string[];
  /** Qué hacer con esto, en una frase. */
  recomendacion: string;
  /** Segmentos donde el problema se concentra por sobre el promedio. */
  segmentos: string[];
  screenId?: string;
  blockId?: string;
  taskId?: string;
  citations: Citation[];
  confianza: Confianza;
}

export interface MetricaTarea {
  taskId: string;
  prompt: string;
  personas: number;
  exito: number;
  exitoPct: number;
  ic: [number, number];
  medianaMs: number | null;
  p75Ms: number | null;
  dificultad: number | null;
  erroresPorPersona: number;
  pasosOptimos: number | null;
  pasosMediana: number | null;
  eficiencia: number | null;
  /** Pantalla donde más gente se quedó. */
  fuga?: { screenId: string; nombre: string; n: number };
  /** Escalón del camino más corto donde se pierde más gente. */
  corte?: { desde: string; hacia: string; perdidos: number; llegan: number; de: number };
}

export interface Segmento {
  nombre: string;
  n: number;
  exitoPct: number;
  dificultad: number | null;
  medianaMs: number | null;
  erroresPorPersona: number;
}

export interface Metricas {
  sesiones: number;
  reales: number;
  sinteticas: number;
  tareasIntentadas: number;
  exitoPct: number;
  ic: [number, number];
  medianaMs: number | null;
  p75Ms: number | null;
  dificultad: number | null;
  eficiencia: number | null;
  erroresPorSesion: number;
  dudasPorSesion: number;
  /** Índice propio de Forma, 0 a 100: éxito, eficiencia y esfuerzo percibido. */
  indice: number | null;
  lectura: string;
  confianza: Confianza;
}

export interface Informe {
  study: Study;
  generado: number;
  analysis: Analysis;
  metricas: Metricas;
  tareas: MetricaTarea[];
  segmentos: Segmento[];
  hallazgos: Hallazgo[];
  resumen: string[];
  quotes: Quote[];
  /** Lo que este estudio no puede responder, dicho antes de que alguien lo pregunte. */
  limitaciones: string[];
}

/** Intervalo de Wilson al 95%: con pocas sesiones, el porcentaje solo no dice nada. */
export function wilson(exitos: number, n: number): [number, number] {
  if (!n) return [0, 0];
  const z = 1.96;
  const p = exitos / n;
  const d = 1 + (z * z) / n;
  const centro = (p + (z * z) / (2 * n)) / d;
  const margen = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centro - margen), Math.min(1, centro + margen)];
}

const mediana = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)] : null);
const percentil = (xs: number[], q: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Segmento de una sesión: el perfil sintético si lo hay, si no el dispositivo. */
export function segmentoDe(s: Session): string {
  if (s.source === 'synthetic') {
    const parte = s.participant.split('·')[1]?.trim();
    if (parte) return parte;
  }
  return s.device.breakpoint === 'mobile' ? 'Móvil' : s.device.breakpoint === 'tablet' ? 'Tablet' : 'Escritorio';
}

const confianzaDe = (n: number): Confianza => (n >= 12 ? 'alta' : n >= 5 ? 'media' : 'exploratoria');

/** Impacto de cada tipo de problema sobre la decisión de construir o no. */
const IMPACTO: Record<ThemeKind, number> = {
  giveup: 1,
  blocked: 0.8,
  detour: 0.62,
  difficulty: 0.6,
  misclick: 0.45,
  hesitation: 0.38,
};

/** Recomendación escrita sobre los nombres reales del prototipo: se puede llevar a la mesa de diseño. */
function recomendacionDe(
  kind: ThemeKind,
  ctx: {
    pantalla?: string;
    elemento?: string;
    objetivo?: string;
    tarea?: string;
    fuga?: string;
    dwellS?: number;
    dificultad?: number | null;
    pasosOptimos?: number | null;
    corte?: MetricaTarea['corte'];
  },
): string {
  const pantalla = ctx.pantalla ? `«${ctx.pantalla}»` : 'esa pantalla';
  const elemento = ctx.elemento ? `«${ctx.elemento}»` : 'ese elemento';
  const objetivo = ctx.objetivo ? `«${ctx.objetivo}»` : 'el objetivo';
  switch (kind) {
    case 'giveup':
      return ctx.corte
        ? `El corte está entre «${ctx.corte.desde}» y «${ctx.corte.hacia}»: ahí se ${ctx.corte.perdidos === 1 ? 'pierde 1 persona' : `pierden ${ctx.corte.perdidos} de ${ctx.corte.de}`}. Haz evidente el acceso a «${ctx.corte.hacia}» desde «${ctx.corte.desde}» —un punto de entrada con nombre claro, o un paso menos— y vuelve a medir esta tarea. Es el hallazgo que cuesta conversión.`
        : `Desde ${ctx.fuga ? `«${ctx.fuga}»` : pantalla} no hay un camino evidente hacia ${objetivo}: quien llega ahí se queda sin siguiente paso. Agrega una salida visible —un acceso directo o un paso menos— y vuelve a medir esa tarea.`;
    case 'blocked':
      return `En ${pantalla} el botón se ve disponible aunque falte completar un campo obligatorio. Valida en el propio campo, explica el requisito junto a él y no dejes que el botón prometa una acción que no va a ocurrir.`;
    case 'detour':
      return `${pantalla} atrae como si fuera el camino hacia ${objetivo}, y desde ahí no se avanza. Baja su peso visual o corrige la etiqueta que lleva hasta ahí; si el desvío es razonable, conéctala de vuelta al flujo para que no sea un callejón.`;
    case 'difficulty':
      return `${ctx.tarea ? `«${ctx.tarea}»` : 'La tarea'} se siente pesada${ctx.dificultad != null ? ` (${fmt1(ctx.dificultad)} de 5)` : ''}. Recorta pasos${ctx.pasosOptimos ? `: hoy el camino más corto ya son ${ctx.pasosOptimos}` : ''}, muestra el avance y confirma cada acción para bajar la sensación de esfuerzo.`;
    case 'misclick':
      return `En ${pantalla} hay elementos que parecen accionables y no lo son. Hazlos tocables si la gente los busca ahí, o quítales la apariencia de botón para que dejen de prometer algo.`;
    default:
      return `${elemento} no anticipa lo que va a pasar al tocarlo${ctx.dwellS ? ` (${fmt1(ctx.dwellS)} s de pausa en promedio)` : ''}. Nómbralo por el resultado, no por la función, y acompáñalo con una pista de lo que viene después.`;
  }
}

function severidadDe(puntaje: number): Severidad {
  if (puntaje >= 62) return 'critica';
  if (puntaje >= 40) return 'alta';
  if (puntaje >= 22) return 'media';
  return 'baja';
}

/** Métricas por tarea, con eficiencia contra el camino más corto y punto de fuga. */
export function metricasPorTarea(study: Study, sessions: Session[], events: StudyEvent[], analysis: Analysis): MetricaTarea[] {
  const p = study.snapshot;
  const ok = consentedSessions(study, sessions);
  const ids = new Set(ok.map((s) => s.id));
  const evs = events.filter((e) => ids.has(e.sessionId));

  return study.tasks.map((task) => {
    const t = analysis.tasks.find((x) => x.taskId === task.id)!;
    const taskEvents = evs.filter((e) => e.taskId === task.id);
    const feedback = ok.flatMap((s) => s.feedback.filter((f) => f.taskId === task.id));
    const exitosos = feedback.filter((f) => f.outcome === 'success');
    const duraciones = exitosos.map((f) => f.durationMs);

    const camino = taskFunnel(study, sessions, events, task.id);
    const pasosOptimos = camino.length ? camino.length - 1 : null;
    const idsExito = new Set(ok.filter((s) => s.feedback.some((f) => f.taskId === task.id && f.outcome === 'success')).map((s) => s.id));
    const pasosPorSesion = [...idsExito].map((id) => taskEvents.filter((e) => e.kind === 'navigate' && e.sessionId === id).length).filter((n) => n > 0);
    const pasosMediana = mediana(pasosPorSesion);
    const eficiencia = pasosOptimos && pasosMediana ? Math.min(1, pasosOptimos / pasosMediana) : null;

    // El corte: el paso del camino más corto donde se cae más gente. Es el dato que dice dónde intervenir.
    let corte: MetricaTarea['corte'];
    for (let i = 1; i < camino.length; i++) {
      const perdidos = camino[i - 1].reached - camino[i].reached;
      if (perdidos > 0 && (!corte || perdidos > corte.perdidos))
        corte = { desde: camino[i - 1].name, hacia: camino[i].name, perdidos, llegan: camino[i].reached, de: camino[i].started };
    }

    const fugas = new Map<string, number>();
    for (const e of taskEvents.filter((x) => x.kind === 'task_giveup')) fugas.set(e.screen, (fugas.get(e.screen) ?? 0) + 1);
    const peor = [...fugas.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      taskId: task.id,
      prompt: task.prompt,
      personas: t.started,
      exito: t.success,
      exitoPct: t.successRate,
      ic: wilson(t.success, t.started),
      medianaMs: mediana(duraciones),
      p75Ms: percentil(duraciones, 0.75),
      dificultad: t.avgDifficulty,
      erroresPorPersona: t.avgMisclicks,
      pasosOptimos,
      pasosMediana,
      eficiencia,
      corte,
      fuga: peor ? { screenId: peor[0], nombre: screenName(p, peor[0]), n: peor[1] } : undefined,
    };
  });
}

/** Comparativa por segmento: quién lo pasa peor con el mismo prototipo. */
export function metricasPorSegmento(study: Study, sessions: Session[], events: StudyEvent[]): Segmento[] {
  const ok = consentedSessions(study, sessions);
  const ids = new Set(ok.map((s) => s.id));
  const evs = events.filter((e) => ids.has(e.sessionId));
  const grupos = new Map<string, Session[]>();
  for (const s of ok) {
    const k = segmentoDe(s);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(s);
  }
  return [...grupos.entries()]
    .map(([nombre, ss]) => {
      const feedback = ss.flatMap((s) => s.feedback);
      const intentos = feedback.length;
      const exitos = feedback.filter((f) => f.outcome === 'success').length;
      const errores = evs.filter((e) => e.kind === 'misclick' && ss.some((s) => s.id === e.sessionId)).length;
      return {
        nombre,
        n: ss.length,
        exitoPct: intentos ? exitos / intentos : 0,
        dificultad: promedio(feedback.map((f) => f.difficulty).filter((d): d is number => typeof d === 'number')),
        medianaMs: mediana(feedback.filter((f) => f.outcome === 'success').map((f) => f.durationMs)),
        erroresPorPersona: ss.length ? errores / ss.length : 0,
      };
    })
    .sort((a, b) => a.exitoPct - b.exitoPct);
}

export function metricasGenerales(study: Study, sessions: Session[], events: StudyEvent[], tareas: MetricaTarea[]): Metricas {
  const ok = consentedSessions(study, sessions);
  const ids = new Set(ok.map((s) => s.id));
  const evs = events.filter((e) => ids.has(e.sessionId));
  const feedback = ok.flatMap((s) => s.feedback);
  const intentos = feedback.length;
  const exitos = feedback.filter((f) => f.outcome === 'success').length;
  const duraciones = feedback.filter((f) => f.outcome === 'success').map((f) => f.durationMs);
  const dificultades = feedback.map((f) => f.difficulty).filter((d): d is number => typeof d === 'number');
  const eficiencias = tareas.map((t) => t.eficiencia).filter((e): e is number => e != null);

  const exitoPct = intentos ? exitos / intentos : 0;
  const dificultad = promedio(dificultades);
  const eficiencia = eficiencias.length ? eficiencias.reduce((a, b) => a + b, 0) / eficiencias.length : null;

  // Índice Forma: éxito (lo que importa), eficiencia (cuánto cuesta) y esfuerzo percibido (cómo se siente).
  const partes: [number, number][] = [[exitoPct, 0.45]];
  if (eficiencia != null) partes.push([eficiencia, 0.25]);
  if (dificultad != null) partes.push([1 - (dificultad - 1) / 4, 0.3]);
  const pesos = partes.reduce((a, [, w]) => a + w, 0);
  const indice = intentos ? Math.round((partes.reduce((a, [v, w]) => a + v * w, 0) / pesos) * 100) : null;

  const lectura =
    indice == null
      ? 'Sin datos suficientes para puntuar el flujo.'
      : indice >= 85
        ? 'El flujo está listo para construirse: corrige los detalles menores y avanza.'
        : indice >= 70
          ? 'El flujo funciona, pero hay fricción concreta que conviene resolver antes de construir.'
          : indice >= 55
            ? 'Hay problemas de fondo: corrige los hallazgos críticos y vuelve a probar antes de comprometer desarrollo.'
            : 'El flujo no sostiene la tarea: rediseña el camino principal antes de seguir.';

  return {
    sesiones: ok.length,
    reales: ok.filter((s) => s.source !== 'synthetic').length,
    sinteticas: ok.filter((s) => s.source === 'synthetic').length,
    tareasIntentadas: intentos,
    exitoPct,
    ic: wilson(exitos, intentos),
    medianaMs: mediana(duraciones),
    p75Ms: percentil(duraciones, 0.75),
    dificultad,
    eficiencia,
    erroresPorSesion: ok.length ? evs.filter((e) => e.kind === 'misclick').length / ok.length : 0,
    dudasPorSesion: ok.length ? evs.filter((e) => e.kind === 'hesitation').length / ok.length : 0,
    indice,
    lectura,
    confianza: confianzaDe(ok.length),
  };
}

/** Hallazgos priorizados: qué duele, cuánto, a quién y qué hacer. */
export function hallazgos(study: Study, sessions: Session[], events: StudyEvent[], analysis: Analysis, tareas: MetricaTarea[]): Hallazgo[] {
  const p = study.snapshot;
  const ok = consentedSessions(study, sessions);
  const porId = new Map(ok.map((s) => [s.id, s]));
  const total = analysis.total;
  const evs = events.filter((e) => porId.has(e.sessionId));
  const segmentos = new Map<string, number>();
  for (const s of ok) segmentos.set(segmentoDe(s), (segmentos.get(segmentoDe(s)) ?? 0) + 1);

  const out = analysis.themes.map((th): Hallazgo => {
    const proporcion = total ? th.count / total : 0;
    const puntaje = Math.round(Math.min(100, IMPACTO[th.kind] * 100 * (0.35 + 0.65 * proporcion)));
    const tarea = th.citations[0] ? study.tasks.find((t) => t.id === th.citations[0].taskId) : undefined;

    // ¿Se concentra en alguien? Se comparan proporciones dentro de cada segmento.
    const afectadosPorSeg = new Map<string, Set<string>>();
    for (const c of th.citations) {
      const s = porId.get(c.sessionId);
      if (!s) continue;
      const k = segmentoDe(s);
      if (!afectadosPorSeg.has(k)) afectadosPorSeg.set(k, new Set());
      afectadosPorSeg.get(k)!.add(c.sessionId);
    }
    const focos = [...afectadosPorSeg.entries()]
      .filter(([k, set]) => (segmentos.get(k) ?? 0) >= 2 && set.size / (segmentos.get(k) ?? 1) > Math.max(0.5, proporcion + 0.2))
      .sort((a, b) => b[1].size - a[1].size)
      .map(([k, set]) => `${k} (${set.size} de ${segmentos.get(k)})`);

    const mt = tarea ? tareas.find((t) => t.taskId === tarea.id) : undefined;
    const pantalla = th.screenId ? screenName(p, th.screenId) : undefined;
    const elemento = th.blockId ? blockLabel(p, th.blockId) : undefined;

    const evidencia: string[] = [th.detail];
    const ubicacion = [pantalla && `pantalla «${pantalla}»`, elemento && `elemento «${elemento}»`].filter(Boolean).join(' · ');
    if (ubicacion) evidencia.push(`Dónde ocurre: ${ubicacion}.`);
    if (tarea && mt)
      evidencia.push(
        `Tarea «${tarea.prompt.replace(/\.$/, '')}»: ${pct(mt.exitoPct)} de éxito (${mt.exito} de ${mt.personas})${mt.medianaMs != null ? `, mediana ${fmtDuration(mt.medianaMs)}` : ''}.`,
      );
    if (th.kind === 'giveup' && mt?.corte)
      evidencia.push(`El embudo se corta entre «${mt.corte.desde}» y «${mt.corte.hacia}»: llegan ${mt.corte.llegan} de ${mt.corte.de}.`);
    if (mt && mt.eficiencia != null && mt.eficiencia < 0.75 && mt.pasosOptimos != null && mt.pasosMediana != null)
      evidencia.push(`El camino más corto son ${mt.pasosOptimos} pasos y la mediana real fue ${mt.pasosMediana}.`);
    if (focos.length) evidencia.push(`Se concentra en ${focos.join(' y ')}.`);

    // Pausa promedio sobre ese elemento: cuánto se demoró la gente en decidir.
    const dwellS =
      th.kind === 'hesitation' && th.blockId
        ? promedio(evs.filter((e) => e.kind === 'hesitation' && e.block === th.blockId && (!th.screenId || e.screen === th.screenId)).map((e) => (e.dwell ?? 0) / 1000))
        : null;

    return {
      id: th.id,
      kind: th.kind,
      titulo: th.title,
      severidad: severidadDe(puntaje),
      puntaje,
      afectados: th.count,
      total,
      evidencia,
      recomendacion: recomendacionDe(th.kind, {
        pantalla,
        elemento,
        objetivo: tarea ? screenName(p, tarea.successScreenId) : undefined,
        tarea: tarea?.prompt.replace(/\.$/, ''),
        fuga: mt?.fuga?.nombre,
        corte: mt?.corte,
        dwellS: dwellS ?? undefined,
        dificultad: mt?.dificultad,
        pasosOptimos: mt?.pasosOptimos,
      }),
      segmentos: focos,
      screenId: th.screenId,
      blockId: th.blockId,
      taskId: tarea?.id,
      citations: th.citations,
      confianza: confianzaDe(total),
    };
  });

  return out.sort((a, b) => b.puntaje - a.puntaje || b.afectados - a.afectados);
}

/** Resumen ejecutivo: lo que hay que saber si solo se leen cinco líneas. */
function resumenEjecutivo(study: Study, m: Metricas, tareas: MetricaTarea[], hs: Hallazgo[], segmentos: Segmento[]): string[] {
  const out: string[] = [];
  const criticos = hs.filter((h) => h.severidad === 'critica');
  const altos = hs.filter((h) => h.severidad === 'alta');

  out.push(
    `${m.sesiones} ${m.sesiones === 1 ? 'persona recorrió' : 'personas recorrieron'} ${study.tasks.length} ${study.tasks.length === 1 ? 'tarea' : 'tareas'} sobre la versión v${study.snapshot.version}. La tasa de éxito es ${pct(m.exitoPct)} (intervalo de confianza ${pct(m.ic[0])}–${pct(m.ic[1])}).`,
  );
  if (m.indice != null) out.push(`Índice Forma: ${m.indice} de 100. ${m.lectura}`);

  const peor = [...tareas].filter((t) => t.personas > 0).sort((a, b) => a.exitoPct - b.exitoPct)[0];
  if (peor && peor.exitoPct < 1)
    out.push(
      `La tarea más costosa es «${peor.prompt.replace(/\.$/, '')}»: ${pct(peor.exitoPct)} de éxito. ${
        peor.corte
          ? `El corte está entre «${peor.corte.desde}» y «${peor.corte.hacia}», donde se ${peor.corte.perdidos === 1 ? 'pierde 1 persona' : `pierden ${peor.corte.perdidos} de ${peor.corte.de}`}.`
          : peor.fuga
            ? `Quienes no la lograron se quedaron en «${peor.fuga.nombre}».`
            : ''
      }`.trim(),
    );

  if (criticos.length) out.push(`Hay ${criticos.length} ${criticos.length === 1 ? 'hallazgo crítico' : 'hallazgos críticos'} que bloquean la tarea: ${criticos.slice(0, 2).map((h) => h.titulo).join('; ')}.`);
  else if (altos.length) out.push(`Sin bloqueos críticos. El mayor costo está en ${altos.length === 1 ? 'un hallazgo de severidad alta' : `${altos.length} hallazgos de severidad alta`}: ${altos.slice(0, 2).map((h) => h.titulo).join('; ')}.`);
  else if (hs.length) out.push('No aparecieron bloqueos: los hallazgos son de fricción menor y se pueden resolver en el mismo diseño.');

  const rezagado = segmentos.filter((s) => s.n >= 2)[0];
  const lider = [...segmentos].filter((s) => s.n >= 2).pop();
  if (rezagado && lider && rezagado.nombre !== lider.nombre && lider.exitoPct - rezagado.exitoPct >= 0.2)
    out.push(`El flujo no trata igual a todos: ${rezagado.nombre} logra ${pct(rezagado.exitoPct)} frente a ${pct(lider.exitoPct)} de ${lider.nombre}.`);

  if (m.eficiencia != null && m.eficiencia < 0.7) out.push(`El recorrido real es más largo que el previsto: la eficiencia frente al camino más corto es ${pct(m.eficiencia)}.`);

  return out;
}

function limitacionesDe(m: Metricas, study: Study): string[] {
  const out: string[] = [];
  if (m.confianza !== 'alta')
    out.push(
      `Con ${m.sesiones} ${m.sesiones === 1 ? 'sesión' : 'sesiones'} los porcentajes son orientativos: sirven para priorizar problemas, no para afirmar magnitudes. El intervalo de confianza acompaña cada cifra.`,
    );
  if (m.sinteticas > 0)
    out.push(
      `${m.sinteticas} de ${m.sesiones} ${m.sinteticas === 1 ? 'sesión proviene' : 'sesiones provienen'} de usuarios sintéticos: son modelos de comportamiento, útiles para detectar tropiezos evidentes antes de convocar gente, no evidencia de conducta real.`,
    );
  if (m.reales === 0 && m.sinteticas > 0) out.push('Este informe no incluye personas reales. Confírmalo con usuarios antes de tomar decisiones irreversibles.');
  out.push(`Se probó un prototipo (versión v${study.snapshot.version}), no el producto en uso: no mide desempeño técnico, latencia real ni el contexto completo de la tarea.`);
  return out;
}

/** Arma el informe completo de un estudio. */
export function construirInforme(study: Study, sessions: Session[], events: StudyEvent[]): Informe {
  const analysis = analyzeStudy(study, sessions, events);
  const tareas = metricasPorTarea(study, sessions, events, analysis);
  const segmentos = metricasPorSegmento(study, sessions, events);
  const metricas = metricasGenerales(study, sessions, events, tareas);
  const hs = hallazgos(study, sessions, events, analysis, tareas);
  return {
    study,
    generado: Date.now(),
    analysis,
    metricas,
    tareas,
    segmentos,
    hallazgos: hs,
    resumen: resumenEjecutivo(study, metricas, tareas, hs, segmentos),
    quotes: analysis.quotes,
    limitaciones: limitacionesDe(metricas, study),
  };
}

export { fmt1, fmtDuration };
