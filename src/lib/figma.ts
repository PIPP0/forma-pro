// Importar un flujo de Figma: cada frame llega como imagen y sus interacciones como zonas tocables.
// El token es personal y se guarda solo en este navegador (Ajustes → Figma).

const TOKEN_KEY = 'formapro.figma.token';

export const getFigmaToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
};

export const setFigmaToken = (t: string) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sin almacenamiento */
  }
};

export interface FigmaLink {
  fileKey: string;
  /** Página o frame que venía en el enlace (node-id). */
  nodeId?: string;
  /** Página del enlace (page-id), si venía. */
  pageId?: string;
  /** Punto de inicio del prototipo (starting-point-node-id), si venía. */
  startId?: string;
}

/** Acepta enlaces de archivo, diseño y prototipo: figma.com/design|file|proto/CLAVE/... */
export function parseFigmaUrl(url: string): FigmaLink | null {
  const clean = url.trim();
  const m = /figma\.com\/(?:file|design|proto|board)\/([A-Za-z0-9]{10,})/.exec(clean);
  if (!m) return null;
  const q = clean.includes('?') ? clean.slice(clean.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  // En la URL los ids van con guion («1-23»); la API los usa con dos puntos («1:23»).
  const id = (k: string) => {
    const v = params.get(k);
    return v ? v.replace(/-/g, ':') : undefined;
  };
  return { fileKey: m[1], nodeId: id('node-id'), pageId: id('page-id'), startId: id('starting-point-node-id') };
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  children?: FigmaNode[];
  visible?: boolean;
  /** Prototipado clásico. */
  transitionNodeID?: string | null;
  /** Prototipado actual. */
  interactions?: { trigger?: { type?: string; timeout?: number }; actions?: { type?: string; destinationId?: string | null; navigation?: string; url?: string }[] }[];
  prototypeStartNodeID?: string | null;
  flowStartingPoints?: { nodeId: string; name?: string }[];
}

export interface FigmaHotspot {
  id: string;
  name: string;
  /** Fracción del ancho y del alto del frame (0 a 1). */
  x: number;
  y: number;
  w: number;
  h: number;
  destino?: string;
  volver?: boolean;
  overlay?: boolean;
}

export interface FigmaFrame {
  id: string;
  name: string;
  /** Posición en el lienzo de Figma: ordena las pantallas sueltas. */
  x: number;
  y: number;
  width: number;
  height: number;
  hotspots: FigmaHotspot[];
  /** Transición automática del frame: «después de N segundos». */
  auto?: { segundos: number; destino?: string; volver?: boolean };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Math.round(n * 1000) / 1000));

/**
 * Lo que hace una interacción de Figma. Solo cuentan las que cambian de pantalla:
 * desplazar, cambiar de variante o abrir una URL no son navegación dentro del prototipo.
 */
export interface FigmaAccion {
  destino?: string;
  /** «Volver» o «cerrar superposición». */
  volver?: boolean;
  /** La pantalla se abre encima de la actual. */
  overlay?: boolean;
}

/** Disparadores que una persona activa tocando. Los de hover son temporales en Figma: se omiten. */
const TOQUE = new Set(['ON_CLICK', 'ON_PRESS', 'ON_DRAG', 'MOUSE_DOWN', 'MOUSE_UP']);
const NAVEGA = new Set(['NAVIGATE', 'SWAP', 'OVERLAY']);

function accionDe(acciones: NonNullable<NonNullable<FigmaNode['interactions']>[number]['actions']>): FigmaAccion | undefined {
  for (const a of acciones) {
    if (a.type === 'BACK' || a.type === 'CLOSE') return { volver: true };
    if (a.type === 'NODE' || a.destinationId) {
      const nav = a.navigation ?? 'NAVIGATE';
      if (!NAVEGA.has(nav) || !a.destinationId) continue;
      return { destino: a.destinationId, ...(nav === 'OVERLAY' ? { overlay: true } : {}) };
    }
  }
  return undefined;
}

/** Interacciones de un nodo: la de toque y la automática por tiempo. */
export function interaccionesDe(node: FigmaNode): { toque?: FigmaAccion; tiempo?: { segundos: number; accion: FigmaAccion } } {
  const out: { toque?: FigmaAccion; tiempo?: { segundos: number; accion: FigmaAccion } } = {};
  for (const i of node.interactions ?? []) {
    const tipo = i.trigger?.type ?? 'ON_CLICK';
    const accion = accionDe(i.actions ?? []);
    if (!accion) continue;
    if (tipo === 'AFTER_TIMEOUT') {
      if (!out.tiempo) out.tiempo = { segundos: Math.max(0, Number(i.trigger?.timeout ?? 0)), accion };
    } else if (TOQUE.has(tipo) && !out.toque) {
      out.toque = accion;
    }
  }
  // Archivos antiguos: el destino venía en transitionNodeID, siempre al tocar.
  if (!out.toque && node.transitionNodeID) out.toque = { destino: node.transitionNodeID };
  return out;
}

/** Zonas tocables de un frame, en fracciones de su tamaño. */
export function hotspotsIn(frame: FigmaNode): FigmaHotspot[] {
  const box = frame.absoluteBoundingBox;
  if (!box?.width || !box.height) return [];
  const out: FigmaHotspot[] = [];
  // El frame completo puede llevar la interacción: se toca en cualquier parte.
  const propia = interaccionesDe(frame).toque;
  if (propia) out.push({ id: frame.id, name: frame.name, x: 0, y: 0, w: 1, h: 1, ...propia });
  const walk = (node: FigmaNode) => {
    if (node.visible === false) return;
    if (node !== frame) {
      const { toque } = interaccionesDe(node);
      const b = node.absoluteBoundingBox;
      if (toque && b?.width && b.height) {
        out.push({
          id: node.id,
          name: node.name,
          x: clamp01((b.x - box.x) / box.width),
          y: clamp01((b.y - box.y) / box.height),
          w: clamp01(b.width / box.width),
          h: clamp01(b.height / box.height),
          ...toque,
        });
      }
    }
    for (const c of node.children ?? []) walk(c);
  };
  walk(frame);
  // Las grandes se dibujan primero: así una zona chica queda encima y recibe el toque.
  return out.sort((a, b) => b.w * b.h - a.w * a.h);
}

const FRAME_TYPES = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION'];

/** Frames de una página, con sus zonas tocables. */
export function framesFromPage(page: FigmaNode): FigmaFrame[] {
  const frames: FigmaFrame[] = [];
  for (const node of page.children ?? []) {
    if (!FRAME_TYPES.includes(node.type) || node.visible === false) continue;
    const box = node.absoluteBoundingBox;
    if (!box?.width || !box.height) continue;
    const { tiempo } = interaccionesDe(node);
    frames.push({
      id: node.id,
      name: node.name,
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
      hotspots: hotspotsIn(node),
      ...(tiempo ? { auto: { segundos: tiempo.segundos, destino: tiempo.accion.destino, volver: tiempo.accion.volver } } : {}),
    });
  }
  return frames;
}

/** Pantalla de inicio del prototipo, si la página la define. */
export function startFrameOf(page: FigmaNode, frames: FigmaFrame[]): string | undefined {
  const flow = page.flowStartingPoints?.[0]?.nodeId ?? page.prototypeStartNodeID ?? undefined;
  return flow && frames.some((f) => f.id === flow) ? flow : frames[0]?.id;
}

/**
 * Pantallas a las que se llega desde el inicio siguiendo las flechas del prototipo.
 * En un archivo grande evita traer frames sueltos que no son parte del flujo.
 */
export function alcanzablesDesde(frames: FigmaFrame[], startId: string | undefined): string[] {
  const inicio = startId && frames.some((f) => f.id === startId) ? startId : frames[0]?.id;
  if (!inicio) return [];
  const porId = new Map(frames.map((f) => [f.id, f]));
  const vistos = new Set([inicio]);
  const cola = [inicio];
  while (cola.length) {
    const f = porId.get(cola.shift()!);
    if (!f) continue;
    // Se sigue el orden en que se ven las zonas en la pantalla: de arriba abajo.
    const porPosicion = [...f.hotspots].sort((a, b) => a.y - b.y || a.x - b.x);
    const destinos = [...porPosicion.map((h) => h.destino), f.auto?.destino];
    for (const d of destinos) {
      if (!d || vistos.has(d) || !porId.has(d)) continue;
      vistos.add(d);
      cola.push(d);
    }
  }
  // Se devuelven en el orden en que se llega a ellas, que es el del recorrido.
  return [...vistos];
}

/**
 * Ordena las pantallas como se recorren: primero el flujo desde el inicio,
 * después las sueltas según su lugar en el lienzo (de arriba abajo, de izquierda a derecha).
 */
export function ordenarPorFlujo(frames: FigmaFrame[], startId: string | undefined): FigmaFrame[] {
  const porId = new Map(frames.map((f) => [f.id, f]));
  const flujo = alcanzablesDesde(frames, startId)
    .map((id) => porId.get(id)!)
    .filter(Boolean);
  const enFlujo = new Set(flujo.map((f) => f.id));
  const sueltas = frames.filter((f) => !enFlujo.has(f.id)).sort((a, b) => a.y - b.y || a.x - b.x);
  return [...flujo, ...sueltas];
}

/**
 * Qué frames son pantallas nuevas y cuáles ya existen en el proyecto.
 * Reusar el id de la pantalla mantiene vivos los destinos que ya apuntaban a ella.
 */
export interface PlanDeImportacion {
  idPorFrame: Record<string, string>;
  nuevos: string[];
  actualizados: string[];
}

export function planImportacion(frameIds: string[], screens: { id: string; figmaId?: string }[], nuevoId: () => string): PlanDeImportacion {
  const porFigma = new Map(screens.filter((s) => s.figmaId).map((s) => [s.figmaId!, s.id]));
  const plan: PlanDeImportacion = { idPorFrame: {}, nuevos: [], actualizados: [] };
  for (const f of frameIds) {
    const existente = porFigma.get(f);
    plan.idPorFrame[f] = existente ?? nuevoId();
    (existente ? plan.actualizados : plan.nuevos).push(f);
  }
  return plan;
}

// ---------- API de Figma ----------

export class FigmaError extends Error {}

async function api<T>(token: string, path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`https://api.figma.com/v1${path}`, { headers: { 'X-Figma-Token': token } });
  } catch {
    throw new FigmaError('No pudimos conectar con Figma. Revisa tu conexión.');
  }
  if (res.status === 401 || res.status === 403) throw new FigmaError('Tu token de Figma no tiene acceso a este archivo. Revísalo en Ajustes.');
  if (res.status === 404) throw new FigmaError('No encontramos ese archivo en Figma. Revisa el enlace y que la cuenta del token pueda verlo.');
  if (res.status === 429) throw new FigmaError('Figma está limitando las consultas. Espera un minuto e inténtalo de nuevo.');
  if (!res.ok) throw new FigmaError('Figma no respondió bien. Inténtalo de nuevo en un momento.');
  return (await res.json()) as T;
}

export interface FigmaPage {
  id: string;
  name: string;
  /** Ids de sus frames: sirven para saber qué página trae el enlace. */
  frameIds: string[];
}

/** Páginas del archivo y los ids de sus frames (consulta liviana: no baja el contenido). */
export async function listPages(token: string, fileKey: string): Promise<{ name: string; pages: FigmaPage[] }> {
  const d = await api<{ name: string; document: FigmaNode }>(token, `/files/${fileKey}?depth=2`);
  const pages = (d.document.children ?? [])
    .filter((c) => c.type === 'CANVAS')
    .map((c) => ({ id: c.id, name: c.name, frameIds: (c.children ?? []).map((f) => f.id) }));
  return { name: d.name, pages };
}

/** Frames de una página con sus interacciones. */
export async function loadPage(token: string, fileKey: string, pageId: string): Promise<{ frames: FigmaFrame[]; startId?: string }> {
  const d = await api<{ nodes: Record<string, { document: FigmaNode } | null> }>(token, `/files/${fileKey}/nodes?ids=${encodeURIComponent(pageId)}`);
  const page = d.nodes[pageId]?.document ?? Object.values(d.nodes).find(Boolean)?.document;
  if (!page) throw new FigmaError('Esa página de Figma no tiene contenido que podamos importar.');
  const frames = framesFromPage(page);
  if (!frames.length) throw new FigmaError('No encontramos frames en esa página de Figma.');
  return { frames, startId: startFrameOf(page, frames) };
}

/** URLs de imagen (PNG) de los frames. Vencen a los 30 días: se copian a la nube de Forma. */
export async function frameImages(token: string, fileKey: string, ids: string[], scale = 2): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  // Figma limita el largo de la consulta: se piden por tandas.
  for (let i = 0; i < ids.length; i += 20) {
    const part = ids.slice(i, i + 20);
    const d = await api<{ images: Record<string, string | null>; err?: string }>(token, `/images/${fileKey}?ids=${part.map(encodeURIComponent).join(',')}&format=png&scale=${scale}`);
    if (d.err) throw new FigmaError('Figma no pudo generar las imágenes de estas pantallas.');
    for (const [id, url] of Object.entries(d.images)) if (url) out[id] = url;
  }
  return out;
}
