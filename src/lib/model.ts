// Modelo central de Forma Pro. Un solo modelo para diseñar, probar y medir.

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';
export type Mode = 'light' | 'dark';
export type Role = 'owner' | 'editor' | 'viewer';

export const BREAKPOINTS: { id: Breakpoint; label: string; width: number; height: number }[] = [
  { id: 'mobile', label: 'Móvil', width: 375, height: 760 },
  { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
  { id: 'desktop', label: 'Escritorio', width: 1280, height: 800 },
];

export const breakpointOf = (id: Breakpoint) => BREAKPOINTS.find((b) => b.id === id)!;

export type BlockType =
  | 'navbar'
  | 'heading'
  | 'text'
  | 'balance'
  | 'help'
  | 'card'
  | 'input'
  | 'textarea'
  | 'amount'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'tabs'
  | 'button'
  | 'link'
  | 'listItem'
  | 'tag'
  | 'avatar'
  | 'progress'
  | 'statusIcon'
  | 'alert'
  | 'image'
  | 'divider'
  | 'tabBar'
  | 'menuList'
  | 'accountCard'
  | 'creditCard'
  | 'carousel'
  | 'financeCard'
  | 'rating'
  | 'iconGrid';

export const BLOCK_TYPES: { type: BlockType; label: string; interactive: boolean; field: boolean }[] = [
  { type: 'navbar', label: 'Barra superior', interactive: true, field: false },
  { type: 'heading', label: 'Título', interactive: false, field: false },
  { type: 'text', label: 'Texto', interactive: false, field: false },
  { type: 'balance', label: 'Saldo', interactive: false, field: false },
  { type: 'help', label: 'Mensaje de ayuda', interactive: false, field: false },
  { type: 'card', label: 'Tarjeta', interactive: true, field: false },
  { type: 'input', label: 'Campo de texto', interactive: true, field: true },
  { type: 'textarea', label: 'Área de texto', interactive: true, field: true },
  { type: 'amount', label: 'Campo de monto', interactive: true, field: true },
  { type: 'select', label: 'Selector', interactive: true, field: true },
  { type: 'radio', label: 'Opciones', interactive: true, field: true },
  { type: 'checkbox', label: 'Casilla', interactive: true, field: true },
  { type: 'switch', label: 'Interruptor', interactive: true, field: true },
  { type: 'tabs', label: 'Pestañas', interactive: true, field: true },
  { type: 'button', label: 'Botón', interactive: true, field: false },
  { type: 'link', label: 'Enlace', interactive: true, field: false },
  { type: 'listItem', label: 'Lista', interactive: true, field: false },
  { type: 'tag', label: 'Etiqueta', interactive: false, field: false },
  { type: 'avatar', label: 'Avatar', interactive: false, field: false },
  { type: 'progress', label: 'Progreso', interactive: false, field: false },
  { type: 'statusIcon', label: 'Ícono de estado', interactive: false, field: false },
  { type: 'accountCard', label: 'Tarjeta de cuenta', interactive: true, field: false },
  { type: 'creditCard', label: 'Tarjeta de crédito', interactive: true, field: false },
  { type: 'financeCard', label: 'Resumen financiero', interactive: true, field: false },
  { type: 'menuList', label: 'Lista de opciones', interactive: true, field: false },
  { type: 'carousel', label: 'Carrusel', interactive: true, field: false },
  { type: 'iconGrid', label: 'Accesos rápidos', interactive: true, field: false },
  { type: 'rating', label: 'Calificación', interactive: true, field: true },
  { type: 'tabBar', label: 'Barra inferior', interactive: true, field: false },
  { type: 'alert', label: 'Aviso', interactive: false, field: false },
  { type: 'image', label: 'Imagen', interactive: false, field: false },
  { type: 'divider', label: 'Separador', interactive: false, field: false },
];

/** Tipos cuyo valor es una elección entre opciones. */
export const CHOICE_TYPES: BlockType[] = ['select', 'radio', 'tabs', 'rating'];
/** Tipos que se encienden o apagan. */
export const TOGGLE_TYPES: BlockType[] = ['checkbox', 'switch'];

export const blockMeta = (t: BlockType) => BLOCK_TYPES.find((b) => b.type === t)!;

export type StateName = 'default' | 'hover' | 'pressed' | 'disabled' | 'focus';
export const STATES: StateName[] = ['default', 'hover', 'pressed', 'disabled', 'focus'];
export const STATE_LABEL: Record<StateName, string> = {
  default: 'Reposo',
  hover: 'Hover',
  pressed: 'Presionado',
  disabled: 'Deshabilitado',
  focus: 'Foco',
};

export type TypeRole = 'display' | 'title' | 'body' | 'label' | 'caption';
export const TYPE_ROLES: TypeRole[] = ['display', 'title', 'body', 'label', 'caption'];
export const TYPE_ROLE_LABEL: Record<TypeRole, string> = {
  display: 'Display',
  title: 'Título',
  body: 'Cuerpo',
  label: 'Etiqueta',
  caption: 'Nota',
};

export type StyleKey = 'bg' | 'fg' | 'border' | 'outline' | 'radius' | 'padY' | 'padX' | 'type';
export type StyleProps = Partial<Record<StyleKey, string>>;
export type TokenGroup = 'color' | 'space' | 'radius' | 'type';

export const STYLE_KEYS: { key: StyleKey; label: string; group: TokenGroup }[] = [
  { key: 'bg', label: 'Fondo', group: 'color' },
  { key: 'fg', label: 'Texto', group: 'color' },
  { key: 'border', label: 'Borde', group: 'color' },
  { key: 'outline', label: 'Anillo de foco', group: 'color' },
  { key: 'radius', label: 'Radio', group: 'radius' },
  { key: 'padY', label: 'Relleno vertical', group: 'space' },
  { key: 'padX', label: 'Relleno horizontal', group: 'space' },
  { key: 'type', label: 'Rol tipográfico', group: 'type' },
];

export interface ColorToken {
  name: string;
  light: string;
  dark: string;
  description?: string;
}
export interface SizeToken {
  name: string;
  value: number;
}
export interface TypeToken {
  role: TypeRole;
  size: number;
  lineHeight: number;
  weight: number;
}
export interface Tokens {
  fontFamily: string;
  colors: ColorToken[];
  space: SizeToken[];
  radius: SizeToken[];
  type: TypeToken[];
}

export type Action = 'none' | 'navigate' | 'back';

export interface Block {
  id: string;
  type: BlockType;
  label: string;
  detail?: string;
  target?: string;
  variant?: string;
  action?: Action;
  required?: boolean;
  disabled?: boolean;
  options?: string[];
  value?: string;
  componentId?: string;
  overrides?: StyleProps;
  align?: 'start' | 'center';
  /** Destino por opción: pestañas, barra inferior, filas de lista, carruseles y accesos. */
  optionTargets?: Record<string, string>;
  /** Texto del enlace al pie de una tarjeta, ej: «Ver detalle». */
  linkLabel?: string;
  /** El botón se ve deshabilitado hasta completar los campos obligatorios. */
  disableUntilValid?: boolean;
}

export interface Component {
  id: string;
  name: string;
  type: BlockType;
  variant?: string;
  states: Record<StateName, StyleProps>;
  /** Versión de los estados base con que se creó o actualizó el componente. */
  rev?: number;
  /** Categoría del catálogo o creada en el proyecto. Si falta, la del patrón. */
  category?: string;
  /** Descripción propia; si falta, la del patrón. */
  description?: string;
  /** Contenido de ejemplo propio: se usa en vistas previas y al insertarlo en una pantalla. */
  sample?: Partial<Pick<Block, 'label' | 'detail' | 'value' | 'options' | 'linkLabel'>>;
}

export interface ComponentCategory {
  id: string;
  label: string;
}

/** Zona tocable sobre una pantalla que es una imagen. Medidas en fracción del ancho y del alto (0 a 1). */
export interface Hotspot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pantalla a la que lleva. Sin destino, solo registra el toque. */
  target?: string;
  /** Vuelve a la pantalla anterior (o cierra la hoja). */
  back?: boolean;
  /** La pantalla de destino se abre encima de la actual (superposición de Figma). */
  overlay?: boolean;
  label?: string;
}

export interface Screen {
  id: string;
  name: string;
  breakpoint: Breakpoint;
  variantOf?: string;
  terminal?: boolean;
  /** «sheet»: se abre como hoja inferior (modal) sobre la pantalla desde donde se llamó. */
  presentation?: 'sheet';
  /** Pantalla que se ve de fondo en el lienzo cuando es hoja inferior. */
  sheetOver?: string;
  /** Pantalla importada como imagen (por ejemplo, desde Figma): se ve tal cual y se toca en sus zonas. */
  image?: { url: string; width: number; height: number };
  hotspots?: Hotspot[];
  /** Nodo de Figma del que viene, para volver a importarla. */
  figmaId?: string;
  /** Archivo de Figma del que vino, para saber cuándo se cambió de prototipo. */
  figmaFile?: string;
  /** Capas de la pantalla en Figma: permiten marcar una zona sobre un elemento concreto. */
  figmaParts?: { id: string; name: string; x: number; y: number; w: number; h: number; k?: 'i' | 'f' | 't' | 'v' }[];
  /** Transición automática: pasa sola a otra pantalla tras unos milisegundos. */
  autoNext?: { ms: number; target?: string; back?: boolean };
  blocks: Block[];
}

export interface Project {
  id: string;
  name: string;
  brand: string;
  business: string;
  /** Titular del flujo en el lienzo, ej: «Pequeños pasos, grandes metas.» */
  tagline?: string;
  /** Descripción corta bajo el titular. */
  summary?: string;
  /** Nombre del flujo en la miga de pan del lienzo. */
  flowName?: string;
  /** Nota al pie de cada pantalla móvil, ej: «Entorno de prueba · sin operaciones reales». */
  footnote?: string;
  /** Barra de estado del teléfono: lisa o con onda de color de marca. */
  statusBar?: 'wave' | 'plain';
  /** Fondo de pantalla sólido o degradado desde la superficie. */
  backgroundStyle?: 'gradient' | 'solid';
  owner: string;
  version: number;
  startScreenId: string;
  tokens: Tokens;
  screens: Screen[];
  components: Component[];
  /** Categorías de componentes creadas por el equipo, además de las del catálogo. */
  categories?: ComponentCategory[];
  library?: { releaseId: string; version: string; sourceProjectId: string };
  /** Proyecto sin sistema de diseño: no se le agrega la biblioteca del catálogo. */
  noSystem?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type Path = (string | number)[];

export type OpInput =
  | { kind: 'set'; path: Path; value: unknown }
  | { kind: 'insert'; path: Path; index: number; value: unknown }
  | { kind: 'remove'; path: Path; index: number }
  | { kind: 'move'; path: Path; from: number; to: number };

export type Op = OpInput & {
  id: string;
  projectId: string;
  by: string;
  at: number;
  label: string;
  prev?: unknown;
};

export interface User {
  id: string;
  name: string;
  email: string;
  /** Proyectos de ejemplo que ya se agregaron a esta persona (no reaparecen si los elimina). */
  samples?: string[];
}

export interface Membership {
  id: string;
  subjectType: 'project';
  subjectId: string;
  email: string;
  role: Role;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  label: string;
  snapshot: Project;
  createdBy: string;
  createdAt: number;
}

export interface LibraryRelease {
  id: string;
  libraryId: string; // proyecto fuente de la biblioteca
  version: string;
  notes: string;
  snapshot: { tokens: Tokens; components: Component[] };
  publishedBy: string;
  publishedAt: number;
}

export interface StudyTask {
  id: string;
  prompt: string;
  startScreenId: string;
  successScreenId: string;
}

export interface Study {
  id: string;
  projectId: string;
  name: string;
  tasks: StudyTask[];
  snapshot: Project;
  askAudio: boolean;
  owner: string;
  status: 'open' | 'closed';
  /** Las sesiones de participantes remotos llegan solas a la nube de Forma. */
  cloud?: boolean;
  /** La copia congelada está publicada en la nube: el enlace es corto (#/t/<id>). */
  shortLink?: boolean;
  example?: boolean;
  created: number;
}

export interface TaskFeedback {
  taskId: string;
  outcome: 'success' | 'giveup';
  difficulty?: number; // 1 muy fácil … 5 muy difícil
  comment?: string;
  durationMs: number;
}

export interface Session {
  id: string;
  studyId: string;
  participant: string;
  device: { breakpoint: Breakpoint; width: number; height: number };
  consent: { participate: boolean; audio: boolean; at: number };
  hasAudio?: boolean;
  feedback: TaskFeedback[];
  status: 'in_progress' | 'completed' | 'abandoned';
  source: 'local' | 'import' | 'example' | 'cloud';
  /** Última actualización recibida desde la nube (solo sesiones que llegaron solas). */
  cloudUpdatedAt?: number;
  startedAt: number;
  endedAt?: number;
}

export type EventKind =
  | 'task_start'
  | 'tap'
  | 'misclick'
  | 'blocked'
  | 'navigate'
  | 'hesitation'
  | 'input'
  | 'task_success'
  | 'task_giveup';

export interface StudyEvent {
  id: string;
  sessionId: string;
  taskId: string;
  screen: string;
  block?: string;
  /** Opción tocada dentro del bloque, ej: «Créditos» en la barra inferior. */
  option?: string;
  kind: EventKind;
  x: number; // 0..1 relativo a la pantalla
  y: number;
  bx?: number; // 0..1 relativo al bloque
  by?: number;
  dwell?: number;
  elapsed: number;
}

export interface Comment {
  id: string;
  projectId: string;
  screenId: string;
  blockId?: string;
  author: string;
  text: string;
  mentions: string[];
  at: number;
  resolved: boolean;
}

export interface DB {
  schema: 1;
  users: User[];
  currentUserId?: string;
  projects: Project[];
  ops: Op[];
  versions: ProjectVersion[];
  memberships: Membership[];
  releases: LibraryRelease[];
  studies: Study[];
  sessions: Session[];
  events: StudyEvent[];
  comments: Comment[];
}

export const emptyDb = (): DB => ({
  schema: 1,
  users: [],
  projects: [],
  ops: [],
  versions: [],
  memberships: [],
  releases: [],
  studies: [],
  sessions: [],
  events: [],
  comments: [],
});

/** Pantalla base (la que agrupa variantes) */
export const baseId = (s: Screen) => s.variantOf ?? s.id;

/** Claves de las opciones navegables de un bloque (lo que se usa en optionTargets). */
export function optionKeys(type: BlockType, variant: string | undefined, options: string[] = []): string[] {
  if (type === 'navbar') return variant === 'app' ? ['menu', 'qr', 'bell'] : variant === 'title' ? ['right'] : [];
  if (!['tabBar', 'menuList', 'carousel', 'iconGrid', 'tabs'].includes(type)) return [];
  return options.map((o) => {
    const parts = o.split('|').map((x) => x.trim());
    return type === 'carousel' ? (parts[1] ?? parts[0]) : parts[0];
  });
}

/** Quita el marcado de negrita (**texto**) para mostrar etiquetas en texto plano. */
/** Reemplaza {{idDelBloque|ejemplo}} por lo que la persona escribió en ese bloque, o por el ejemplo. */
export const fillValues = (s: string, values?: Record<string, string>) =>
  s.replace(/\{\{([\w-]+)(?:\|([^}]*))?\}\}/g, (_m, id: string, example?: string) => values?.[id]?.trim() || example || '');

/** El bloque con los datos que la persona ya ingresó en pantallas anteriores. */
export function withValues(b: Block, values?: Record<string, string>): Block {
  const has = (s?: string) => !!s && s.includes('{{');
  if (!has(b.label) && !has(b.detail) && !b.options?.some(has)) return b;
  return { ...b, label: fillValues(b.label, values), detail: b.detail && fillValues(b.detail, values), options: b.options?.map((o) => fillValues(o, values)) };
}

export const plainText = (s: string) => fillValues(s).replace(/\*\*/g, '');

/** Resuelve la variante de una pantalla para un breakpoint, o la base si no existe. */
export function screenFor(p: Project, id: string, bp: Breakpoint): Screen | undefined {
  const base = p.screens.find((s) => s.id === id);
  const root = base?.variantOf ?? id;
  return (
    p.screens.find((s) => baseId(s) === root && s.breakpoint === bp) ??
    p.screens.find((s) => s.id === root) ??
    base
  );
}
