import Anthropic from '@anthropic-ai/sdk';
import type { Block, BlockType, Issue, Project, Screen } from './aiTypes';
import { BLOCK_TYPES } from './model';
import { uid } from './ids';

// La IA propone, la persona decide: nada de lo que devuelve este módulo se aplica solo.

const KEY = 'formapro.ai.key';
export const AI_MODEL = 'claude-opus-5';

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

function client() {
  const apiKey = getAiKey();
  if (!apiKey) throw new AiError('Agrega tu clave de API de Anthropic en Ajustes para usar la IA.');
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

async function askJson<T>(system: string, turns: Turn[], schema: Record<string, unknown>): Promise<T> {
  try {
    const res = await client().beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema } },
      system,
      messages: turns.map((t) => ({ role: t.role, content: t.content })),
    });
    if (res.stop_reason === 'refusal') throw new AiError('El modelo no pudo responder esta solicitud. Reformúlala e intenta de nuevo.');
    if (res.stop_reason === 'max_tokens') throw new AiError('La respuesta quedó incompleta. Intenta con una solicitud más acotada.');
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return JSON.parse(text) as T;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('La clave de API no es válida. Revísala en Ajustes.');
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Se alcanzó el límite de uso de la API. Espera un momento e intenta de nuevo.');
    if (e instanceof Anthropic.APIConnectionError) throw new AiError('No hay conexión con la API de Anthropic. Revisa tu red.');
    if (e instanceof Anthropic.APIError) throw new AiError(`La API respondió con un error (${e.status ?? 'sin código'}): ${e.message}`);
    if (e instanceof SyntaxError) throw new AiError('La respuesta de la IA no tenía el formato esperado.');
    throw new AiError((e as Error).message);
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
  const out = await askJson<{ themes: AiTheme[] }>(system, [{ role: 'user', content: JSON.stringify(dataset) }], schema);
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

export async function generateScreen(project: Project, history: Turn[], prompt: string): Promise<ScreenProposal> {
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
    'Eres copiloto de diseño de producto dentro de Forma Pro. Propones pantallas móviles como una lista vertical de bloques.',
    'Usa los componentes existentes del sistema (component_id) siempre que el tipo coincida; deja component_id vacío solo si no hay uno adecuado.',
    'navigate_to debe ser el id de una pantalla existente o vacío. Escribe textos reales y específicos del negocio, en español neutro y en tono conversacional.',
    'Mantén el historial de la conversación: si la persona pide un ajuste, modifica tu propuesta anterior en vez de empezar de cero.',
    `Contexto del proyecto: ${projectContext(project)}`,
  ].join('\n');
  return askJson<ScreenProposal>(system, [...history, { role: 'user', content: prompt }], schema);
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
    'Evalúa claridad del contenido, jerarquía, carga cognitiva, prevención de errores y accesibilidad para una app bancaria.',
    'Cada observación debe referirse a un block_id existente (o vacío si es de la pantalla completa) y explicar el problema y su consecuencia para la persona usuaria. Español neutro, frases breves.',
    `Contexto del proyecto: ${projectContext(project)}`,
  ].join('\n');
  return askJson<Critique>(
    system,
    [{ role: 'user', content: JSON.stringify({ pantalla: screen, hallazgos_automaticos: issues.map((i) => i.message) }) }],
    schema,
  );
}
