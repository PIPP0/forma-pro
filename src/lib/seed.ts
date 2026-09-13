import type { Block, BlockType, Component, Project, Screen, Session, Study, StudyEvent, TaskFeedback, Tokens } from './model';
import { completeSystem, ensureColors } from './catalog';
import { mulberry32, uid } from './ids';
import { clone } from './ops';

export const FONT_INTER = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

export function baseTokens(): Tokens {
  return ensureColors({
    fontFamily: FONT_INTER,
    colors: [
      { name: 'background', light: '#FFFFFF', dark: '#0E1318', description: 'Fondo de pantalla' },
      { name: 'surface', light: '#FFFFFF', dark: '#182028', description: 'Tarjetas y campos' },
      { name: 'subtle', light: '#F3F5F8', dark: '#1F2731', description: 'Fondos secundarios' },
      { name: 'onSurface', light: '#1B1F24', dark: '#E8ECF0', description: 'Texto principal' },
      { name: 'muted', light: '#5F6773', dark: '#9BA7B4', description: 'Texto secundario' },
      { name: 'border', light: '#E3E7EC', dark: '#2F3A46', description: 'Bordes' },
      { name: 'primary', light: '#0074C8', dark: '#5AB0F0', description: 'Acción principal' },
      { name: 'primaryHover', light: '#0068B4', dark: '#78BFF3' },
      { name: 'primaryPressed', light: '#005A9C', dark: '#9ACFF6' },
      { name: 'primarySubtle', light: '#EAF3FB', dark: '#10283B', description: 'Fondo suave de marca' },
      { name: 'onPrimary', light: '#FFFFFF', dark: '#03203A', description: 'Texto sobre acción principal' },
      { name: 'focus', light: '#E0A100', dark: '#FFC940', description: 'Anillo de foco' },
      { name: 'danger', light: '#C62828', dark: '#FF8A80' },
      { name: 'dangerSubtle', light: '#FDECEC', dark: '#3A1F1E' },
      { name: 'success', light: '#1B7F50', dark: '#6FD69C' },
      { name: 'successSubtle', light: '#E6F6EE', dark: '#173327' },
    ],
    space: [
      { name: 'xs', value: 4 },
      { name: 'sm', value: 8 },
      { name: 'md', value: 12 },
      { name: 'lg', value: 16 },
      { name: 'xl', value: 24 },
      { name: 'xxl', value: 32 },
    ],
    radius: [
      { name: 'sm', value: 8 },
      { name: 'md', value: 12 },
      { name: 'lg', value: 16 },
      { name: 'pill', value: 999 },
    ],
    type: [
      { role: 'display', size: 30, lineHeight: 36, weight: 700 },
      { role: 'title', size: 22, lineHeight: 28, weight: 700 },
      { role: 'body', size: 15, lineHeight: 22, weight: 400 },
      { role: 'label', size: 14, lineHeight: 20, weight: 600 },
      { role: 'caption', size: 12, lineHeight: 16, weight: 500 },
    ],
  });
}

/** La biblioteca completa del catálogo, con los identificadores de siempre para los componentes base. */
export function baseComponents(): Component[] {
  return completeSystem({ tokens: baseTokens(), components: [] as Component[] } as Project).components;
}

const b = (id: string, type: BlockType, label: string, extra: Partial<Block> = {}): Block => ({ id, type, label, ...extra });

export function blankProject(ownerId: string, name: string, business: string): Project {
  const now = Date.now();
  const start = uid('s_');
  return {
    id: uid('p_'),
    name,
    brand: name,
    business,
    tagline: name,
    flowName: 'Flujo principal',
    owner: ownerId,
    version: 1,
    startScreenId: start,
    tokens: baseTokens(),
    components: baseComponents(),
    screens: [
      {
        id: start,
        name: 'Inicio',
        breakpoint: 'mobile',
        terminal: true,
        blocks: [
          b(uid('b_'), 'heading', 'Primera pantalla', { componentId: 'cmp-heading', variant: 'title', detail: 'Agrega componentes desde el explorador.' }),
        ],
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

/** Proyecto de ejemplo: flujo de ahorro «Ahorro con propósito». */
export function transferProject(ownerId: string, name = 'Ahorro con propósito'): Project {
  const now = Date.now();
  const nav = (id: string, back = false): Block => b(id, 'navbar', 'austral', { detail: 'DEMO', ...(back ? { action: 'back' as const } : {}) });
  const inicioBlocks = (sfx: string): Block[] => [
    nav('b-in-nav' + sfx),
    b('b-in-hola' + sfx, 'heading', 'Hola, Francisca', { componentId: 'cmp-heading', variant: 'title', detail: 'Qué bueno verte de nuevo' }),
    b('b-in-saldo' + sfx, 'balance', 'Saldo disponible', { componentId: 'cmp-balance', value: '$ 1.850.000', detail: 'Cuenta corriente', options: ['•• 2840'] }),
    b('b-in-ayuda' + sfx, 'help', 'Tu próximo paso empieza hoy', { componentId: 'cmp-help', detail: 'Dale un espacio a eso que quieres lograr.' }),
    b('b-in-alcancia' + sfx, 'card', 'Alcancía', { componentId: 'cmp-card', detail: 'Organiza tu ahorro y acércate a tus metas.', action: 'navigate', target: 's-nueva' }),
    b('b-in-crear' + sfx, 'button', 'Crear una meta', { componentId: 'cmp-btn-primary', action: 'navigate', target: 's-nueva' }),
    b('b-in-metas' + sfx, 'link', 'Ver mis metas', { action: 'navigate', target: 's-metas' }),
  ];
  const screens: Screen[] = [
    { id: 's-inicio', name: 'Inicio', breakpoint: 'mobile', blocks: inicioBlocks('') },
    { id: 's-inicio-tablet', name: 'Inicio', breakpoint: 'tablet', variantOf: 's-inicio', blocks: inicioBlocks('-t') },
    {
      id: 's-nueva',
      name: 'Nueva meta',
      breakpoint: 'mobile',
      blocks: [
        nav('b-nm-nav', true),
        b('b-nm-titulo', 'heading', 'Tus planes merecen una meta', { componentId: 'cmp-heading', variant: 'title', detail: 'Ponle nombre a eso que quieres lograr.' }),
        b('b-nm-nombre', 'input', 'Nombre de tu meta', { componentId: 'cmp-input', detail: 'Mi próximo viaje', required: true }),
        b('b-nm-monto', 'amount', '¿Cuánto quieres ahorrar?', { componentId: 'cmp-amount', detail: '$ 500.000', required: true }),
        b('b-nm-ritmo', 'help', 'A tu ritmo', { componentId: 'cmp-help', detail: 'Puedes modificar tu meta cuando quieras.' }),
        b('b-nm-continuar', 'button', 'Continuar', { componentId: 'cmp-btn-primary', action: 'navigate', target: 's-confirmacion', overrides: { radius: '14' } }),
      ],
    },
    {
      id: 's-confirmacion',
      name: 'Confirmación',
      breakpoint: 'mobile',
      blocks: [
        nav('b-co-nav', true),
        b('b-co-titulo', 'heading', 'Un pequeño paso. Un gran comienzo.', { componentId: 'cmp-heading', variant: 'title', detail: 'Revisa tu nueva meta antes de continuar.' }),
        b('b-co-meta', 'card', 'Tu nueva meta', { componentId: 'cmp-card', detail: 'Ahorro flexible · sin aportes automáticos', action: 'none' }),
        b('b-co-control', 'help', 'Tú tienes el control', { componentId: 'cmp-help', detail: 'Este demo no mueve dinero ni contrata productos.' }),
        b('b-co-crear', 'button', 'Crear mi alcancía', { componentId: 'cmp-btn-primary', action: 'navigate', target: 's-creada' }),
        b('b-co-editar', 'button', 'Volver a editar', { componentId: 'cmp-btn-secondary', action: 'back' }),
      ],
    },
    {
      id: 's-creada',
      name: 'Meta creada',
      breakpoint: 'mobile',
      terminal: true,
      blocks: [
        nav('b-cr-nav', true),
        b('b-cr-icono', 'statusIcon', 'Meta creada'),
        b('b-cr-titulo', 'heading', '¡Tu meta ya tiene un lugar!', { componentId: 'cmp-heading', variant: 'title', align: 'center' }),
        b('b-cr-texto', 'text', 'Cada paso cuenta. Empieza cuando tú quieras.', { variant: 'muted', align: 'center' }),
        b('b-cr-aventura', 'card', 'Mi próxima aventura', { componentId: 'cmp-card', detail: 'Tu alcancía está lista para recibir tu primer ahorro.', action: 'navigate', target: 's-metas' }),
        b('b-cr-progreso', 'progress', 'Progreso inicial', { componentId: 'cmp-progress', detail: '0% de $500.000', value: '0' }),
        b('b-cr-volver', 'button', 'Volver al inicio', { componentId: 'cmp-btn-primary', action: 'navigate', target: 's-inicio' }),
      ],
    },
    {
      id: 's-metas',
      name: 'Mis metas',
      breakpoint: 'mobile',
      blocks: [
        nav('b-me-nav', true),
        b('b-me-titulo', 'heading', 'Tus metas', { componentId: 'cmp-heading', variant: 'title', detail: 'Empieza con una y suma las que quieras.' }),
        b('b-me-tabs', 'tabs', 'Estado de las metas', { componentId: 'cmp-tabs', options: ['Activas', 'Completadas'], value: 'Activas' }),
        b('b-me-aventura', 'listItem', 'Mi próxima aventura', { componentId: 'cmp-list', detail: '$0 de $500.000', action: 'none' }),
        b('b-me-nueva', 'tag', 'Nueva', { componentId: 'cmp-tag' }),
        b('b-me-recordatorio', 'switch', 'Recordarme ahorrar cada mes', { componentId: 'cmp-switch' }),
        b('b-me-volver', 'button', 'Volver al inicio', { componentId: 'cmp-btn-secondary', action: 'navigate', target: 's-inicio' }),
      ],
    },
  ];
  return {
    id: uid('p_'),
    name,
    brand: 'Austral',
    business: 'Proyecto bancario',
    tagline: 'Pequeños pasos, grandes metas.',
    summary: 'Alcancía · Creación de una meta de ahorro',
    flowName: 'Flujo de ahorro',
    footnote: 'Entorno de prueba · sin operaciones reales',
    owner: ownerId,
    version: 1,
    startScreenId: 's-inicio',
    tokens: baseTokens(),
    components: baseComponents(),
    screens,
    createdAt: now,
    updatedAt: now,
  };
}

/** Estudio de ejemplo con 15 sesiones simuladas, marcado como ejemplo en toda la interfaz. */
export function exampleStudy(project: Project, ownerId: string): { study: Study; sessions: Session[]; events: StudyEvent[] } {
  const created = Date.now() - 2 * 86400000;
  const study: Study = {
    id: uid('st_'),
    projectId: project.id,
    name: 'Crear una meta de ahorro (ejemplo)',
    tasks: [
      { id: 't1', prompt: 'Crea una meta de ahorro de $500.000 para tu próximo viaje.', startScreenId: 's-inicio', successScreenId: 's-creada' },
      { id: 't2', prompt: 'Encuentra dónde ver tus metas de ahorro.', startScreenId: 's-inicio', successScreenId: 's-metas' },
    ],
    snapshot: clone(project),
    askAudio: false,
    owner: ownerId,
    status: 'open',
    example: true,
    created,
  };
  const rnd = mulberry32(7);
  const HES = [0, 2, 3, 5, 8, 11];
  const BLOCKED = [2, 5, 9];
  const GIVEUP = [5, 11, 13];
  const MISCLICK = [1, 4, 6, 9];
  const DETOUR = [3, 7];
  const COMMENTS: Record<number, string> = {
    5: 'No me quedó claro si el monto era mensual o total.',
    11: 'Esperaba montos sugeridos para no inventar la cifra.',
    2: 'Fácil, pero dudé con cuánto poner.',
    7: 'Todo claro.',
  };
  const sessions: Session[] = [];
  const events: StudyEvent[] = [];

  for (let i = 0; i < 15; i++) {
    const sessionId = uid('se_');
    let t = 0;
    const ev = (taskId: string, screen: string, kind: StudyEvent['kind'], block?: string, dwell?: number) => {
      t += Math.round(700 + rnd() * 2000 + (dwell ?? 0));
      const sc = project.screens.find((s) => s.id === screen)!;
      const idx = block ? sc.blocks.findIndex((x) => x.id === block) : -1;
      events.push({
        id: uid('ev_'),
        sessionId,
        taskId,
        screen,
        block,
        kind,
        x: 0.15 + rnd() * 0.7,
        y: idx >= 0 ? (idx + 0.5) / (sc.blocks.length + 2) : 0.2 + rnd() * 0.6,
        bx: block ? 0.15 + rnd() * 0.7 : undefined,
        by: block ? 0.2 + rnd() * 0.6 : undefined,
        dwell: dwell ? Math.round(dwell) : undefined,
        elapsed: t,
      });
    };
    const feedback: TaskFeedback[] = [];

    // Tarea 1
    let start = t;
    ev('t1', 's-inicio', 'task_start');
    if (MISCLICK.includes(i)) ev('t1', 's-inicio', 'misclick', 'b-in-saldo');
    if (DETOUR.includes(i)) {
      ev('t1', 's-inicio', 'tap', 'b-in-metas');
      ev('t1', 's-metas', 'navigate');
      ev('t1', 's-metas', 'tap', 'b-me-nav');
      ev('t1', 's-inicio', 'navigate');
    }
    ev('t1', 's-inicio', 'tap', 'b-in-crear');
    ev('t1', 's-nueva', 'navigate');
    ev('t1', 's-nueva', 'input', 'b-nm-nombre');
    if (HES.includes(i)) ev('t1', 's-nueva', 'hesitation', 'b-nm-monto', 4000 + rnd() * 5000);
    if (BLOCKED.includes(i)) ev('t1', 's-nueva', 'blocked', 'b-nm-continuar');
    if (GIVEUP.includes(i)) {
      ev('t1', 's-nueva', 'task_giveup');
      feedback.push({ taskId: 't1', outcome: 'giveup', difficulty: 4 + Math.round(rnd()), comment: COMMENTS[i], durationMs: t - start });
    } else {
      ev('t1', 's-nueva', 'input', 'b-nm-monto');
      ev('t1', 's-nueva', 'tap', 'b-nm-continuar');
      ev('t1', 's-confirmacion', 'navigate');
      ev('t1', 's-confirmacion', 'tap', 'b-co-crear');
      ev('t1', 's-creada', 'navigate');
      ev('t1', 's-creada', 'task_success');
      feedback.push({
        taskId: 't1',
        outcome: 'success',
        difficulty: HES.includes(i) ? 3 : 1 + Math.floor(rnd() * 2),
        comment: COMMENTS[i],
        durationMs: t - start,
      });
    }

    // Tarea 2
    start = t;
    ev('t2', 's-inicio', 'task_start');
    if (i === 13) {
      ev('t2', 's-inicio', 'misclick', 'b-in-ayuda');
      ev('t2', 's-inicio', 'task_giveup');
      feedback.push({ taskId: 't2', outcome: 'giveup', difficulty: 4, durationMs: t - start });
    } else {
      if (i === 4 || i === 10) ev('t2', 's-inicio', 'hesitation', 'b-in-metas', 5200);
      ev('t2', 's-inicio', 'tap', 'b-in-metas');
      ev('t2', 's-metas', 'navigate');
      ev('t2', 's-metas', 'task_success');
      feedback.push({ taskId: 't2', outcome: 'success', difficulty: 1 + Math.floor(rnd() * 2), durationMs: t - start });
    }

    const startedAt = created + i * 3600000;
    sessions.push({
      id: sessionId,
      studyId: study.id,
      participant: `P${i + 1}`,
      device: { breakpoint: 'mobile', width: 390, height: 844 },
      consent: { participate: true, audio: false, at: startedAt },
      feedback,
      status: 'completed',
      source: 'example',
      startedAt,
      endedAt: startedAt + t,
    });
  }
  return { study, sessions, events };
}
