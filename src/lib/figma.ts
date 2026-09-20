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
}

/** Acepta enlaces de archivo, diseño y prototipo: figma.com/design|file|proto/CLAVE/... */
export function parseFigmaUrl(url: string): FigmaLink | null {
  const clean = url.trim();
  const m = /figma\.com\/(?:file|design|proto|board)\/([A-Za-z0-9]{10,})/.exec(clean);
  if (!m) return null;
  const q = clean.includes('?') ? clean.slice(clean.indexOf('?') + 1) : '';
  const node = new URLSearchParams(q).get('node-id') ?? undefined;
  // En la URL los ids van con guion («1-23»); la API los usa con dos puntos («1:23»).
  return { fileKey: m[1], nodeId: node ? node.replace(/-/g, ':') : undefined };
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
  interactions?: { trigger?: { type?: string }; actions?: { type?: string; destinationId?: string | null; navigation?: string }[] }[];
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
  destination?: string;
  back?: boolean;
}

export interface FigmaFrame {
  id: string;
  name: string;
  width: number;
  height: number;
  hotspots: FigmaHotspot[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Math.round(n * 1000) / 1000));

/** Destino de un nodo: id de otro frame, «volver», o nada. */
export function destinationOf(node: FigmaNode): { destination?: string; back?: boolean } | undefined {
  for (const i of node.interactions ?? []) {
    for (const a of i.actions ?? []) {
      if (a.navigation === 'BACK' || a.type === 'BACK') return { back: true };
      if (a.destinationId) return { destination: a.destinationId };
    }
  }
  if (node.transitionNodeID) return { destination: node.transitionNodeID };
  return undefined;
}

/** Zonas tocables de un frame, en fracciones de su tamaño. */
export function hotspotsIn(frame: FigmaNode): FigmaHotspot[] {
  const box = frame.absoluteBoundingBox;
  if (!box?.width || !box.height) return [];
  const out: FigmaHotspot[] = [];
  const walk = (node: FigmaNode) => {
    if (node.visible === false) return;
    if (node !== frame) {
      const dest = destinationOf(node);
      const b = node.absoluteBoundingBox;
      if (dest && b?.width && b.height) {
        out.push({
          id: node.id,
          name: node.name,
          x: clamp01((b.x - box.x) / box.width),
          y: clamp01((b.y - box.y) / box.height),
          w: clamp01(b.width / box.width),
          h: clamp01(b.height / box.height),
          ...dest,
        });
      }
    }
    for (const c of node.children ?? []) walk(c);
  };
  walk(frame);
  // Las zonas chicas quedan arriba para que no las tape una grande que las contiene.
  return out.sort((a, b) => a.w * a.h - b.w * b.h);
}

const FRAME_TYPES = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION'];

/** Frames de una página, con sus zonas tocables. */
export function framesFromPage(page: FigmaNode): FigmaFrame[] {
  const frames: FigmaFrame[] = [];
  for (const node of page.children ?? []) {
    if (!FRAME_TYPES.includes(node.type) || node.visible === false) continue;
    const box = node.absoluteBoundingBox;
    if (!box?.width || !box.height) continue;
    frames.push({ id: node.id, name: node.name, width: Math.round(box.width), height: Math.round(box.height), hotspots: hotspotsIn(node) });
  }
  return frames;
}

/** Pantalla de inicio del prototipo, si la página la define. */
export function startFrameOf(page: FigmaNode, frames: FigmaFrame[]): string | undefined {
  const flow = page.flowStartingPoints?.[0]?.nodeId ?? page.prototypeStartNodeID ?? undefined;
  return flow && frames.some((f) => f.id === flow) ? flow : frames[0]?.id;
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
