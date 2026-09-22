import type Anthropic from '@anthropic-ai/sdk';
import type { Block, BlockType, Component, Issue, Project, Screen, StateName, StyleProps, Tokens } from './aiTypes';
import { BLOCK_TYPES, STATES, TYPE_ROLES } from './model';
import { builtInStyle } from './tokens';
import { uid } from './ids';

// La IA propone, la persona decide: nada de lo que devuelve este módulo se aplica solo.

const KEY = 'formapro.ai.key';

/**
 * Un modelo por tipo de tarea, no el más caro para todo.
 * Sintetizar sesiones o revisar una pantalla es trabajo acotado y estructurado: lo resuelve Haiku.
 * Proponer pantallas o leer un sistema de diseño ajeno tiene criterio de por medio: ahí va Sonnet.
 */
export const AI_MODELS = {
  analisis: 'claude-haiku-4-5',
  diseno: 'claude-sonnet-5',
} as const;
export const AI_MODEL = AI_MODELS.diseno;

/** Funciones del proyecto en la nube: la clave del equipo vive allá, no en este navegador. */
const PROXY = 'https://southamerica-west1-forma-pro-cl26.cloudfunctions.net';

/**
 * De dónde sale la IA para quien está usando la app:
 * «propia» si guardó su clave en este navegador, «equipo» si basta con su sesión, «no» si aún no hay ninguna.
 */
export const iaDisponible = (email?: string | null): 'propia' | 'equipo' | 'no' => (getAiKey() ? 'propia' : email ? 'equipo' : 'no');

/** Último consumo informado por el proxy, para mostrarlo sin pedirlo de nuevo. */
export interface IaConsumo {
  usd: number;
  llamadas: number;
  topeUsuario: number;
  mes: string;
  autorizado: boolean;
}

export async function consumoDeIa(): Promise<IaConsumo | null> {
  const { idTokenConCorreo } = await import('./cloud');
  const token = await idTokenConCorreo().catch(() => null);
  if (!token) return null;
  const r = await fetch(`${PROXY}/iaUso`, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return (await r.json()) as IaConsumo;
}

export const getAiKey = () => {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};
export const setAiKey = (k: string) => {
  try {
    if (k) localStorage.setItem(KEY, k);
    else localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento */
  }
};

export class AiError extends Error {}

export type TurnContent = string | Anthropic.Beta.BetaContentBlockParam[];

export interface Turn {
  role: 'user' | 'assistant';
  content: TurnContent;
}

export interface ImageInput {
  data: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  name: string;
}

export const imageBlock = (img: ImageInput): Anthropic.Beta.BetaContentBlockParam => ({
  type: 'image',
  source: { type: 'base64', media_type: img.mediaType, data: img.data },
});

export interface PdfInput {
  data: string;
  name: string;
}

export const pdfBlock = (pdf: PdfInput): Anthropic.Beta.BetaContentBlockParam => ({
  type: 'document',
  source: { type: 'base64', media_type: 'application/pdf', data: pdf.data },
  title: pdf.name,
});

/** Lee un PDF para la IA: la API acepta documentos de hasta 32 MB y 100 páginas. */
export async function fileToPdf(file: File): Promise<PdfInput> {
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) throw new AiError(`«${file.name}» no es un PDF.`);
  if (file.size > 20 * 1024 * 1024) throw new AiError(`«${file.name}» pesa más de 20 MB. Exporta solo las páginas del sistema de diseño.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { data: btoa(bin), name: file.name };
}

/** Lee una imagen, la reduce a un máximo de 1568 px por lado y la deja lista para la API. */
export async function fileToImage(file: File): Promise<ImageInput> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new AiError(`«${file.name}» no es una imagen PNG, JPG, WebP o GIF.`);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new AiError(`No pudimos leer «${file.name}».`));
      el.src = url;
    });
    const scale = Math.min(1, 1568 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    return { data: dataUrl.split(',')[1], mediaType: 'image/jpeg', name: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Llama con la clave de este navegador: quien trae la suya paga lo suyo. */
async function conClavePropia(apiKey: string, model: string, system: string, turns: Turn[], schema: Record<string, unknown>): Promise<string> {
  // El SDK se carga solo cuando alguien usa la IA, para no pesar en la carga inicial.
  const { default: Sdk } = await import('@anthropic-ai/sdk');
  try {
    // El razonamiento adaptativo existe desde la generación 4.6; Haiku 4.5 no lo acepta.
    const razona = model.startsWith('claude-haiku-4-5') ? {} : { thinking: { type: 'adaptive' as const } };
    const stream = new Sdk({ apiKey, dangerouslyAllowBrowser: true }).beta.messages.stream({
      model,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      ...razona,
      output_config: { format: { type: 'json_schema', schema } },
      system,
      messages: turns.map((t) => ({ role: t.role, content: t.content })),
    });
    const res = await stream.finalMessage();
    if (res.stop_reason === 'refusal') throw new AiError('El modelo no pudo responder esta solicitud. Reformúlala e intenta de nuevo.');
    if (res.stop_reason === 'max_tokens') throw new AiError('La respuesta quedó incompleta. Intenta con una solicitud más acotada.');
    return res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Sdk.AuthenticationError) throw new AiError('La clave de API no es válida. Revísala en Ajustes.');
    if (e instanceof Sdk.RateLimitError) throw new AiError('Se alcanzó el límite de uso de la API. Espera un momento e intenta de nuevo.');
    if (e instanceof Sdk.APIConnectionError) throw new AiError('No hay conexión con la API de Anthropic. Revisa tu red.');
    throw new AiError('La IA no pudo responder. Intenta de nuevo en un momento.');
  }
}

/** Llama a través del proyecto en la nube: la clave del equipo nunca baja al navegador. */
async function conClaveDelEquipo(model: string, system: string, turns: Turn[], schema: Record<string, unknown>): Promise<string> {
  const { idTokenConCorreo } = await import('./cloud');
  const token = await idTokenConCorreo().catch(() => null);
  if (!token) throw new AiError('Guarda tu acceso con correo en Ajustes para usar la IA del equipo, o agrega tu propia clave de API.');
  let r: Response;
  try {
    r = await fetch(`${PROXY}/ia`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ model, system, schema, messages: turns.map((t) => ({ role: t.role, content: t.content })) }),
    });
  } catch {
    throw new AiError('No hay conexión con la IA del equipo. Revisa tu red e intenta de nuevo.');
  }
  const data = (await r.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!r.ok) throw new AiError(data.error ?? 'La IA del equipo no pudo responder. Intenta de nuevo.');
  if (!data.text) throw new AiError('La IA del equipo devolvió una respuesta vacía. Intenta de nuevo.');
  return data.text;
}

async function askJson<T>(system: string, turns: Turn[], schema: Record<string, unknown>, model: string = AI_MODELS.diseno): Promise<T> {
  const apiKey = getAiKey();
  const text = apiKey ? await conClavePropia(apiKey, model, system, turns, schema) : await conClaveDelEquipo(model, system, turns, schema);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiError('La respuesta de la IA no tenía el formato esperado. Intenta de nuevo.');
  }
}

// ---------- Resumen de investigación con citas verificadas ----------

export interface AiTheme {
  title: string;
  detail: string;
  session_ids: string[];
}

export interface VerifiedTheme extends AiTheme {
  participants: string[];
  discardedCitations: number;
}

export async function summarizeResearch(
  dataset: unknown,
  participants: Map<string, string>,
): Promise<{ themes: VerifiedTheme[]; discardedThemes: number }> {
  const schema = {
    type: 'object',
    properties: {
      themes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            detail: { type: 'string' },
            session_ids: { type: 'array', items: { type: 'string' } },
          },
          required: ['title', 'detail', 'session_ids'],
          additionalProperties: false,
        },
      },
    },
    required: ['themes'],
    additionalProperties: false,
  };
  const system = [
    'Eres una investigadora UX senior que sintetiza pruebas de usabilidad para un equipo de producto.',
    'Recibes sesiones estructuradas de un estudio. Agrupa lo observado en temas recurrentes, ordenados por cuántas personas afecta.',
    'Reglas de evidencia: cada tema debe citar en session_ids solo los identificadores de sesión que lo respaldan directamente según los datos. Si no hay evidencia en los datos, no incluyas el tema.',
    'El título debe incluir el conteo exacto de personas respaldado por esas citas, con la forma «X de N personas…», donde N es el total de sesiones.',
    'El detalle explica qué pasó y por qué importa para el diseño, sin inventar causas que los datos no muestran. Escribe en español neutro, frases breves.',
  ].join('\n');
  const out = await askJson<{ themes: AiTheme[] }>(system, [{ role: 'user', content: JSON.stringify(dataset) }], schema, AI_MODELS.analisis);
  let discardedThemes = 0;
  const themes: VerifiedTheme[] = [];
  for (const t of out.themes ?? []) {
    const unique = [...new Set(t.session_ids ?? [])];
    const valid = unique.filter((id) => participants.has(id));
    if (!valid.length) {
      discardedThemes++;
      continue;
    }
    themes.push({ ...t, session_ids: valid, participants: valid.map((id) => participants.get(id)!), discardedCitations: unique.length - valid.length });
  }
  return { themes, discardedThemes };
}

// ---------- Sistema de diseño desde imágenes o código ----------

const COLOR_ROLES = ['background', 'surface', 'subtle', 'onSurface', 'muted', 'border', 'primary', 'primaryHover', 'primaryPressed', 'primarySubtle', 'onPrimary', 'focus', 'danger', 'dangerSubtle', 'success', 'successSubtle'];
const SPACE_NAMES = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const;
const RADIUS_NAMES = ['sm', 'md', 'lg'] as const;
const STYLE_FIELDS = ['bg', 'fg', 'border', 'outline', 'radius', 'padY', 'padX', 'type'] as const;

export interface ExtractedSystem {
  tokens: Tokens;
  components: Component[];
  notes: string;
  dropped: number;
}

type RawStyle = Record<(typeof STYLE_FIELDS)[number], string>;
interface RawSystem {
  fontFamily: string;
  colors: { name: string; light: string; dark: string; description: string }[];
  space: Record<(typeof SPACE_NAMES)[number], number>;
  radius: Record<(typeof RADIUS_NAMES)[number], number>;
  components: ({ name: string; type: BlockType; variant: string } & Record<StateName, RawStyle>)[];
  notes: string;
}

const normHex = (v: string) => {
  const h = v.trim().replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(h)) return '#' + h.split('').map((c) => c + c).join('').toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(h)) return '#' + h.toUpperCase();
  return null;
};

export async function extractSystem(input: { images: ImageInput[]; code: string; pdfs?: PdfInput[] }, current: Tokens): Promise<ExtractedSystem> {
  if (!input.images.length && !input.code.trim() && !input.pdfs?.length) throw new AiError('Sube al menos un PDF, una imagen o pega código o estilos.');
  const style = {
    type: 'object',
    properties: Object.fromEntries(STYLE_FIELDS.map((f) => [f, { type: 'string' }])),
    required: [...STYLE_FIELDS],
    additionalProperties: false,
  };
  const schema = {
    type: 'object',
    properties: {
      fontFamily: { type: 'string' },
      colors: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, light: { type: 'string' }, dark: { type: 'string' }, description: { type: 'string' } },
          required: ['name', 'light', 'dark', 'description'],
          additionalProperties: false,
        },
      },
      space: { type: 'object', properties: Object.fromEntries(SPACE_NAMES.map((n) => [n, { type: 'number' }])), required: [...SPACE_NAMES], additionalProperties: false },
      radius: { type: 'object', properties: Object.fromEntries(RADIUS_NAMES.map((n) => [n, { type: 'number' }])), required: [...RADIUS_NAMES], additionalProperties: false },
      components: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string', enum: BLOCK_TYPES.map((b) => b.type) },
            variant: { type: 'string' },
            ...Object.fromEntries(STATES.map((s) => [s, style])),
          },
          required: ['name', 'type', 'variant', ...STATES],
          additionalProperties: false,
        },
      },
      notes: { type: 'string' },
    },
    required: ['fontFamily', 'colors', 'space', 'radius', 'components', 'notes'],
    additionalProperties: false,
  };
  const system = [
    'Eres lead de sistemas de diseño. Extraes un sistema de diseño completo y reutilizable a partir de guías de marca en PDF, capturas de interfaz, código o estilos.',
    `Colores: usa nombres semánticos en camelCase. Incluye siempre estos roles: ${COLOR_ROLES.join(', ')}; puedes sumar colores de marca extra. Valores en hexadecimal #RRGGBB. Si solo ves modo claro, deriva un modo oscuro coherente.`,
    'Asegura contraste WCAG AA: texto normal 4,5:1 y títulos grandes 3:1, en ambos modos, entre fg y bg de cada estado.',
    'Espaciado y radios en píxeles. fontFamily como pila CSS con respaldo del sistema.',
    `Componentes: uno por cada patrón que realmente aparezca en la fuente, mapeado al tipo más cercano de la lista. Para cada estado (${STATES.join(', ')}) define propiedades: bg, fg, border y outline usan el NOMBRE de un color de tu lista (sin #); radius usa sm, md, lg o pill; padY y padX usan ${SPACE_NAMES.join(', ')}; type usa ${TYPE_ROLES.join(', ')}. Deja "" cuando el estado hereda del reposo o la propiedad no aplica. El estado focus debe tener un anillo visible (outline con el color focus).`,
    'variant: "primary" o "secondary" para botones, "title" o "display" para títulos, o "". Nombres de componentes en español y en singular.',
    'En notes explica en dos o tres frases qué detectaste y qué supusiste.',
  ].join('\n');

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...(input.pdfs ?? []).map(pdfBlock),
    ...input.images.map(imageBlock),
    {
      type: 'text',
      text: input.code.trim() ? `Código o estilos de referencia:\n\n${input.code.trim()}` : 'Extrae el sistema de diseño de los documentos y capturas adjuntos.',
    },
  ];
  const raw = await askJson<RawSystem>(system, [{ role: 'user', content }], schema);
  return convertSystem(raw, current);
}

export function convertSystem(raw: RawSystem, current: Tokens): ExtractedSystem {
  let dropped = 0;
  const colors = [...current.colors.map((c) => ({ ...c }))];
  for (const c of raw.colors ?? []) {
    const light = normHex(c.light);
    const dark = normHex(c.dark) ?? light;
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(c.name) || !light || !dark) {
      dropped++;
      continue;
    }
    const existing = colors.find((x) => x.name === c.name);
    if (existing) Object.assign(existing, { light, dark, description: c.description || existing.description });
    else colors.push({ name: c.name, light, dark, description: c.description || undefined });
  }
  const colorNames = new Set(colors.map((c) => c.name));
  const space = current.space.map((s) => ({ ...s, value: raw.space?.[s.name as (typeof SPACE_NAMES)[number]] > 0 ? Math.round(raw.space[s.name as (typeof SPACE_NAMES)[number]]) : s.value }));
  const radius = current.radius.map((r) => ({ ...r, value: raw.radius?.[r.name as (typeof RADIUS_NAMES)[number]] > 0 ? Math.round(raw.radius[r.name as (typeof RADIUS_NAMES)[number]]) : r.value }));
  const tokens: Tokens = { ...current, fontFamily: raw.fontFamily?.trim() || current.fontFamily, colors, space, radius };

  const toProps = (s: RawStyle | undefined): StyleProps => {
    const out: StyleProps = {};
    for (const f of STYLE_FIELDS) {
      const v = (s?.[f] ?? '').trim();
      if (!v) continue;
      if (f === 'bg' || f === 'fg' || f === 'border' || f === 'outline') {
        if (colorNames.has(v)) out[f] = `{color.${v}}`;
        else dropped++;
      } else if (f === 'radius') {
        if (['sm', 'md', 'lg', 'pill'].includes(v)) out.radius = `{radius.${v}}`;
        else dropped++;
      } else if (f === 'padY' || f === 'padX') {
        if ((SPACE_NAMES as readonly string[]).includes(v)) out[f] = `{space.${v}}`;
        else dropped++;
      } else if ((TYPE_ROLES as string[]).includes(v)) out.type = v;
      else dropped++;
    }
    return out;
  };

  const validTypes = new Set(BLOCK_TYPES.map((b) => b.type));
  const components: Component[] = (raw.components ?? [])
    .filter((c) => c.name?.trim() && validTypes.has(c.type))
    .map((c) => {
      const base = builtInStyle(c.type, c.variant || undefined);
      const states = Object.fromEntries(
        STATES.map((st) => {
          const props = toProps(c[st]);
          return [st, st === 'default' ? { ...base.default, ...props } : Object.keys(props).length ? props : base[st]];
        }),
      ) as Record<StateName, StyleProps>;
      return { id: uid('cmp_'), name: c.name.trim(), type: c.type, variant: c.variant || undefined, states };
    });

  return { tokens, components, notes: raw.notes ?? '', dropped };
}

// ---------- Copiloto de pantallas ----------

export interface ProposalBlock {
  type: BlockType;
  label: string;
  detail: string;
  variant: string;
  required: boolean;
  options: string[];
  component_id: string;
  navigate_to: string;
}

export interface ScreenProposal {
  name: string;
  rationale: string;
  blocks: ProposalBlock[];
}

function projectContext(p: Project) {
  return JSON.stringify({
    marca: p.brand,
    negocio: p.business,
    tokens_color: p.tokens.colors.map((c) => c.name),
    componentes: p.components.map((c) => ({ id: c.id, nombre: c.name, tipo: c.type, variante: c.variant ?? '' })),
    pantallas: p.screens.filter((s) => !s.variantOf).map((s) => ({ id: s.id, nombre: s.name, bloques: s.blocks.map((b) => `${b.type}: ${b.label}`) })),
  });
}

export async function generateScreen(project: Project, history: Turn[], prompt: string, image?: ImageInput): Promise<ScreenProposal> {
  const types = BLOCK_TYPES.map((b) => b.type);
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      rationale: { type: 'string' },
      blocks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: types },
            label: { type: 'string' },
            detail: { type: 'string' },
            variant: { type: 'string', enum: ['', 'primary', 'secondary', 'display', 'title', 'muted', 'caption', 'danger'] },
            required: { type: 'boolean' },
            options: { type: 'array', items: { type: 'string' } },
            component_id: { type: 'string' },
            navigate_to: { type: 'string' },
          },
          required: ['type', 'label', 'detail', 'variant', 'required', 'options', 'component_id', 'navigate_to'],
          additionalProperties: false,
        },
      },
    },
    required: ['name', 'rationale', 'blocks'],
    additionalProperties: false,
  };
  const system = [
    'Eres copiloto de diseño de producto dentro de Forma Studio. Propones pantallas móviles como una lista vertical de bloques.',
    'Regla principal: respeta el sistema de diseño. Usa SIEMPRE un componente existente (component_id) cuando haya uno del mismo tipo; deja component_id vacío solo si el sistema no tiene ese tipo.',
    'Si la persona adjunta una captura o un boceto, reprodúcelo con los componentes del sistema, no con estilos nuevos.',
    'La primera pieza suele ser la barra superior (navbar) con la marca. navigate_to debe ser el id de una pantalla existente o vacío. Escribe textos reales y específicos del negocio, en español neutro y en tono conversacional.',
    'Mantén el historial de la conversación: si la persona pide un ajuste, modifica tu propuesta anterior en vez de empezar de cero.',
    `Contexto del proyecto: ${projectContext(project)}`,
  ].join('\n');
  const content: TurnContent = image ? [imageBlock(image), { type: 'text', text: prompt }] : prompt;
  return askJson<ScreenProposal>(system, [...history, { role: 'user', content }], schema);
}

export function proposalToScreen(project: Project, proposal: ScreenProposal): Screen {
  const compIds = new Set(project.components.map((c) => c.id));
  const screenIds = new Set(project.screens.map((s) => s.id));
  const blocks: Block[] = proposal.blocks.map((pb) => {
    const b: Block = { id: uid('b_'), type: pb.type, label: pb.label };
    if (pb.detail) b.detail = pb.detail;
    if (pb.variant) b.variant = pb.variant;
    if (pb.required) b.required = true;
    if (pb.options?.length) b.options = pb.options;
    if (pb.component_id && compIds.has(pb.component_id)) b.componentId = pb.component_id;
    else {
      // Si la IA no eligió componente, se vincula al primero del sistema con ese tipo.
      const match = project.components.find((c) => c.type === pb.type && (!pb.variant || !c.variant || c.variant === pb.variant));
      if (match) b.componentId = match.id;
    }
    if (pb.navigate_to && screenIds.has(pb.navigate_to)) {
      b.action = 'navigate';
      b.target = pb.navigate_to;
    }
    return b;
  });
  return { id: uid('s_'), name: proposal.name || 'Pantalla propuesta', breakpoint: 'mobile', blocks };
}

export interface Critique {
  summary: string;
  observations: { block_id: string; severity: 'alta' | 'media' | 'baja'; note: string }[];
}

export async function critiqueScreen(project: Project, screen: Screen, issues: Issue[]): Promise<Critique> {
  const schema = {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      observations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            block_id: { type: 'string' },
            severity: { type: 'string', enum: ['alta', 'media', 'baja'] },
            note: { type: 'string' },
          },
          required: ['block_id', 'severity', 'note'],
          additionalProperties: false,
        },
      },
    },
    required: ['summary', 'observations'],
    additionalProperties: false,
  };
  const system = [
    'Eres una product designer senior haciendo una crítica de diseño. Señalas problemas; no reescribes la pantalla.',
    'Evalúa claridad del contenido, jerarquía, carga cognitiva, prevención de errores, accesibilidad y consistencia con el sistema de diseño.',
    'Cada observación debe referirse a un block_id existente (o vacío si es de la pantalla completa) y explicar el problema y su consecuencia para la persona usuaria. Español neutro, frases breves.',
    `Contexto del proyecto: ${projectContext(project)}`,
  ].join('\n');
  return askJson<Critique>(
    system,
    [{ role: 'user', content: JSON.stringify({ pantalla: screen, hallazgos_automaticos: issues.map((i) => i.message) }) }],
    schema,
    AI_MODELS.analisis,
  );
}
