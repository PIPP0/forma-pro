import type { Block, BlockType, Component, Project, Screen, Session, Study, StudyEvent, TaskFeedback, Tokens } from './model';
import { builtInStyle } from './tokens';
import { mulberry32, uid } from './ids';
import { clone } from './ops';

export function baseTokens(): Tokens {
  return {
    fontFamily: "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif",
    colors: [
      { name: 'background', light: '#F4F6F9', dark: '#0E1318', description: 'Fondo de pantalla' },
      { name: 'surface', light: '#FFFFFF', dark: '#182028', description: 'Tarjetas y campos' },
      { name: 'subtle', light: '#E9EEF5', dark: '#222B35', description: 'Fondos secundarios' },
      { name: 'onSurface', light: '#16202B', dark: '#E6EBF0', description: 'Texto principal' },
      { name: 'muted', light: '#566170', dark: '#9BA7B4', description: 'Texto secundario' },
      { name: 'border', light: '#D3DAE3', dark: '#2F3A46', description: 'Bordes' },
      { name: 'primary', light: '#1646C8', dark: '#7D9CFF', description: 'Acción principal' },
      { name: 'primaryHover', light: '#1B52E0', dark: '#93AEFF' },
      { name: 'primaryPressed', light: '#0F349A', dark: '#AFC2FF' },
      { name: 'onPrimary', light: '#FFFFFF', dark: '#0A1433', description: 'Texto sobre acción principal' },
      { name: 'focus', light: '#E2A200', dark: '#FFC940', description: 'Anillo de foco' },
      { name: 'danger', light: '#B3261E', dark: '#FF8A80' },
      { name: 'dangerSubtle', light: '#FCE8E6', dark: '#3A1F1E' },
      { name: 'success', light: '#1E7B4A', dark: '#6FD69C' },
      { name: 'successSubtle', light: '#E3F4EA', dark: '#173327' },
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
      { name: 'sm', value: 6 },
      { name: 'md', value: 10 },
      { name: 'lg', value: 16 },
      { name: 'pill', value: 999 },
    ],
    type: [
      { role: 'display', size: 32, lineHeight: 38, weight: 700 },
      { role: 'title', size: 22, lineHeight: 28, weight: 650 },
      { role: 'body', size: 16, lineHeight: 24, weight: 400 },
      { role: 'label', size: 15, lineHeight: 20, weight: 600 },
      { role: 'caption', size: 13, lineHeight: 18, weight: 500 },
    ],
  };
}

const comp = (id: string, name: string, type: BlockType, variant?: string): Component => ({
  id,
  name,
  type,
  variant,
  states: builtInStyle(type, variant),
});

export function baseComponents(): Component[] {
  return [
    comp('cmp-btn-primary', 'Botón principal', 'button', 'primary'),
    comp('cmp-btn-secondary', 'Botón secundario', 'button', 'secondary'),
    comp('cmp-input', 'Campo de texto', 'input'),
    comp('cmp-amount', 'Campo de monto', 'amount'),
    comp('cmp-list', 'Fila de lista', 'listItem'),
    comp('cmp-alert', 'Aviso de éxito', 'alert'),
  ];
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
        blocks: [b(uid('b_'), 'heading', 'Primera pantalla', { variant: 'title' }), b(uid('b_'), 'text', 'Agrega bloques desde el panel derecho.')],
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export function transferProject(ownerId: string, name = 'Transferencias'): Project {
  const now = Date.now();
  const inicioBlocks = (sfx: string): Block[] => [
    b('b-in-nav' + sfx, 'navbar', 'Banco Austral'),
    b('b-in-hola' + sfx, 'heading', 'Hola, Camila', { variant: 'title' }),
    b('b-in-saldo-l' + sfx, 'text', 'Saldo disponible', { variant: 'muted' }),
    b('b-in-saldo' + sfx, 'heading', '$1.284.300', { variant: 'display' }),
    b('b-in-transferir' + sfx, 'button', 'Transferir', { componentId: 'cmp-btn-primary', action: 'navigate', target: 's-destinatario' }),
    b('b-in-mov' + sfx, 'listItem', 'Último movimiento', { detail: 'Supermercado, −$32.990', componentId: 'cmp-list', action: 'none' }),
    b('b-in-ayuda' + sfx, 'link', '¿Necesitas ayuda?', { action: 'navigate', target: 's-ayuda' }),
  ];
  const screens: Screen[] = [
    { id: 's-inicio', name: 'Inicio', breakpoint: 'mobile', blocks: inicioBlocks('') },
    { id: 's-inicio-tablet', name: 'Inicio', breakpoint: 'tablet', variantOf: 's-inicio', blocks: inicioBlocks('-t') },
    {
      id: 's-destinatario',
      name: 'Elegir destinatario',
      breakpoint: 'mobile',
      blocks: [
        b('b-de-nav', 'navbar', 'Transferir', { action: 'back' }),
        b('b-de-titulo', 'heading', '¿A quién le transfieres?', { variant: 'title' }),
        b('b-de-buscar', 'input', 'Buscar contacto', { detail: 'Nombre, RUT o alias', componentId: 'cmp-input' }),
        b('b-de-martina', 'listItem', 'Martina Rojas', { detail: 'BancoEstado, cuenta vista', componentId: 'cmp-list', action: 'navigate', target: 's-monto' }),
        b('b-de-diego', 'listItem', 'Diego Fuentes', { detail: 'Banco Austral, cuenta corriente', componentId: 'cmp-list', action: 'navigate', target: 's-monto' }),
        b('b-de-nuevo', 'button', 'Nuevo destinatario', { componentId: 'cmp-btn-secondary', action: 'none' }),
      ],
    },
    {
      id: 's-monto',
      name: 'Monto',
      breakpoint: 'mobile',
      blocks: [
        b('b-mo-nav', 'navbar', 'Monto', { action: 'back' }),
        b('b-mo-titulo', 'heading', '¿Cuánto quieres transferir?', { variant: 'title' }),
        b('b-mo-monto', 'amount', 'Monto', { detail: '$0', required: true, componentId: 'cmp-amount' }),
        b('b-mo-disp', 'text', 'Disponible: $1.284.300', { variant: 'caption' }),
        b('b-mo-mensaje', 'input', 'Mensaje (opcional)', { detail: 'Ej: cumpleaños', componentId: 'cmp-input' }),
        b('b-mo-continuar', 'button', 'Continuar', {
          componentId: 'cmp-btn-primary',
          action: 'navigate',
          target: 's-confirmar',
          overrides: { radius: '14' },
        }),
      ],
    },
    {
      id: 's-confirmar',
      name: 'Confirmar',
      breakpoint: 'mobile',
      blocks: [
        b('b-co-nav', 'navbar', 'Confirmar', { action: 'back' }),
        b('b-co-titulo', 'heading', 'Revisa antes de confirmar', { variant: 'title' }),
        b('b-co-dest', 'listItem', 'Destinatario', { detail: 'Martina Rojas, BancoEstado', componentId: 'cmp-list', action: 'none' }),
        b('b-co-monto', 'listItem', 'Monto', { detail: 'El monto que ingresaste', componentId: 'cmp-list', action: 'none' }),
        b('b-co-fav', 'checkbox', 'Guardar como favorito'),
        b('b-co-confirmar', 'button', 'Confirmar transferencia', { componentId: 'cmp-btn-primary', action: 'navigate', target: 's-exito' }),
        b('b-co-cancelar', 'button', 'Cancelar', { componentId: 'cmp-btn-secondary', action: 'navigate', target: 's-inicio' }),
      ],
    },
    {
      id: 's-exito',
      name: 'Transferencia enviada',
      breakpoint: 'mobile',
      terminal: true,
      blocks: [
        b('b-ex-alerta', 'alert', 'Transferencia enviada', { detail: 'Martina recibirá el dinero en minutos.', componentId: 'cmp-alert' }),
        b('b-ex-titulo', 'heading', 'Listo', { variant: 'display' }),
        b('b-ex-texto', 'text', 'Te enviamos el comprobante a tu correo.'),
        b('b-ex-volver', 'button', 'Volver al inicio', { componentId: 'cmp-btn-primary', action: 'navigate', target: 's-inicio' }),
      ],
    },
    {
      id: 's-ayuda',
      name: 'Ayuda',
      breakpoint: 'mobile',
      blocks: [
        b('b-ay-nav', 'navbar', 'Ayuda', { action: 'back' }),
        b('b-ay-titulo', 'heading', '¿En qué te ayudamos?', { variant: 'title' }),
        b('b-ay-limite', 'listItem', 'Límites de transferencia', { detail: 'Hasta $5.000.000 diarios', componentId: 'cmp-list', action: 'none' }),
        b('b-ay-ejecutiva', 'listItem', 'Hablar con una ejecutiva', { detail: 'Lunes a viernes, de 9 a 18 h', componentId: 'cmp-list', action: 'none' }),
        b('b-ay-volver', 'button', 'Volver', { componentId: 'cmp-btn-secondary', action: 'back' }),
      ],
    },
  ];
  return {
    id: uid('p_'),
    name,
    brand: 'Banco Austral',
    business: 'Banca personal',
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
    name: 'Transferir a un contacto (ejemplo)',
    tasks: [
      { id: 't1', prompt: 'Transfiere $25.000 a Martina Rojas.', startScreenId: 's-inicio', successScreenId: 's-exito' },
      { id: 't2', prompt: 'Encuentra cuál es el límite diario de transferencias.', startScreenId: 's-inicio', successScreenId: 's-ayuda' },
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
    5: 'No me quedó claro si el monto incluía comisión.',
    11: 'Esperaba montos sugeridos, no sabía qué formato usar.',
    2: 'Rápido, pero dudé con el formato del monto.',
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
      ev('t1', 's-inicio', 'tap', 'b-in-ayuda');
      ev('t1', 's-ayuda', 'navigate');
      ev('t1', 's-ayuda', 'tap', 'b-ay-nav');
      ev('t1', 's-inicio', 'navigate');
    }
    ev('t1', 's-inicio', 'tap', 'b-in-transferir');
    ev('t1', 's-destinatario', 'navigate');
    ev('t1', 's-destinatario', 'tap', 'b-de-martina');
    ev('t1', 's-monto', 'navigate');
    if (HES.includes(i)) ev('t1', 's-monto', 'hesitation', 'b-mo-monto', 4000 + rnd() * 5000);
    if (BLOCKED.includes(i)) ev('t1', 's-monto', 'blocked', 'b-mo-continuar');
    if (GIVEUP.includes(i)) {
      ev('t1', 's-monto', 'task_giveup');
      feedback.push({ taskId: 't1', outcome: 'giveup', difficulty: 4 + Math.round(rnd()), comment: COMMENTS[i], durationMs: t - start });
    } else {
      ev('t1', 's-monto', 'input', 'b-mo-monto');
      ev('t1', 's-monto', 'tap', 'b-mo-continuar');
      ev('t1', 's-confirmar', 'navigate');
      ev('t1', 's-confirmar', 'tap', 'b-co-confirmar');
      ev('t1', 's-exito', 'navigate');
      ev('t1', 's-exito', 'task_success');
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
      ev('t2', 's-inicio', 'misclick', 'b-in-mov');
      ev('t2', 's-inicio', 'task_giveup');
      feedback.push({ taskId: 't2', outcome: 'giveup', difficulty: 4, durationMs: t - start });
    } else {
      if (i === 4 || i === 10) ev('t2', 's-inicio', 'hesitation', 'b-in-ayuda', 5200);
      ev('t2', 's-inicio', 'tap', 'b-in-ayuda');
      ev('t2', 's-ayuda', 'navigate');
      ev('t2', 's-ayuda', 'task_success');
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
