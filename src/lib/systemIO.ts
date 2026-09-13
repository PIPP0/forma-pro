import type { ColorToken, Component, Project, Tokens } from './model';
import { BLOCK_TYPES, STATES } from './model';
import { contrast, hexToRgb } from './tokens';
import { ensureColors } from './catalog';

// Entrada y salida del sistema de diseño: exporta a los formatos que usa un equipo
// y lee lo que traiga el equipo (JSON, CSS, SCSS, LESS, Tailwind, HTML, PDF o imágenes).

export const SYSTEM_FORMAT = 'forma.system/v1';

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const camel = (s: string) =>
  s
    .replace(/^[^A-Za-z0-9]+/, '')
    .replace(/[-_\s./]+([A-Za-z0-9])/g, (_, c: string) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase());

// ---------- Exportación ----------

export function exportSystemJson(p: Project): string {
  return JSON.stringify(
    { $schema: SYSTEM_FORMAT, name: `${p.brand} UI`, project: p.name, exportedAt: new Date().toISOString(), tokens: p.tokens, components: p.components },
    null,
    2,
  );
}

/** Tokens en formato W3C Design Tokens (DTCG), el que leen Figma, Tokens Studio y Style Dictionary 4. */
export function exportDtcg(t: Tokens): string {
  const color = (mode: 'light' | 'dark') =>
    Object.fromEntries(t.colors.map((c) => [c.name, { $type: 'color', $value: c[mode], ...(c.description ? { $description: c.description } : {}) }]));
  const out = {
    color: { light: color('light'), dark: color('dark') },
    spacing: Object.fromEntries(t.space.map((s) => [s.name, { $type: 'dimension', $value: `${s.value}px` }])),
    radius: Object.fromEntries(t.radius.map((s) => [s.name, { $type: 'dimension', $value: `${s.value}px` }])),
    font: { family: { $type: 'fontFamily', $value: t.fontFamily.split(',').map((f) => f.trim().replace(/^['"]|['"]$/g, '')) } },
    typography: Object.fromEntries(
      t.type.map((y) => [
        y.role,
        { $type: 'typography', $value: { fontFamily: '{font.family}', fontSize: `${y.size}px`, lineHeight: `${y.lineHeight}px`, fontWeight: y.weight } },
      ]),
    ),
  };
  return JSON.stringify(out, null, 2);
}

/** Configuración de Tailwind que apunta a las variables CSS, así el modo oscuro sigue funcionando. */
export function exportTailwind(t: Tokens): string {
  const colors = Object.fromEntries(t.colors.map((c) => [kebab(c.name), `var(--color-${kebab(c.name)})`]));
  const spacing = Object.fromEntries(t.space.map((s) => [s.name, `var(--space-${kebab(s.name)})`]));
  const borderRadius = Object.fromEntries(t.radius.map((s) => [s.name, `var(--radius-${kebab(s.name)})`]));
  const fontSize = Object.fromEntries(
    t.type.map((y) => [y.role, [`var(--type-${y.role}-size)`, { lineHeight: `var(--type-${y.role}-line-height)`, fontWeight: `var(--type-${y.role}-weight)` }]]),
  );
  const config = {
    darkMode: ['selector', '[data-theme="dark"]'],
    theme: { extend: { colors, spacing, borderRadius, fontSize, fontFamily: { sans: ['var(--font-family)'] } } },
  };
  return `/** Generado por Forma Studio. Usa junto a tokens.css. */\nmodule.exports = ${JSON.stringify(config, null, 2)};\n`;
}

// ---------- Candidatos detectados ----------

export interface ColorCandidate {
  hex: string;
  name?: string;
  dark?: string;
  count: number;
}

export interface Candidates {
  sources: string[];
  colors: ColorCandidate[];
  fonts: string[];
  space: number[];
  radius: number[];
  sizes: number[];
  /** Archivo exportado desde Forma: se aplica tal cual. */
  system?: { tokens: Tokens; components: Component[] };
  notes: string[];
}

export const emptyCandidates = (): Candidates => ({ sources: [], colors: [], fonts: [], space: [], radius: [], sizes: [], notes: [] });

export function normalizeColor(v: string): string | null {
  const s = v.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
    return `#${h.slice(0, 6).toUpperCase()}`;
  }
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(s);
  if (rgb) return rgbToHex([+rgb[1], +rgb[2], +rgb[3]]);
  return null;
}

export const rgbToHex = ([r, g, b]: [number, number, number]) =>
  `#${[r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

const pushColor = (c: Candidates, hex: string, name?: string, dark = false) => {
  const existing = c.colors.find((x) => (name ? x.name === name : x.hex === hex && !x.name));
  if (existing) {
    if (dark) existing.dark = hex;
    else {
      existing.count++;
      if (!existing.name && name) existing.name = name;
    }
    return;
  }
  if (dark) {
    const light = name ? c.colors.find((x) => x.name === name) : undefined;
    if (light) light.dark = hex;
    else c.colors.push({ hex, name, dark: hex, count: 1 });
    return;
  }
  c.colors.push({ hex, name, count: 1 });
};

const toPx = (value: string): number | null => {
  const m = /^(-?\d*\.?\d+)\s*(px|rem|em)?$/.exec(value.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === 'rem' || m[2] === 'em' ? Math.round(n * 16) : Math.round(n);
};

const cleanFont = (f: string) => f.trim().replace(/^['"]|['"]$/g, '').trim();
const GENERIC = /^(system-ui|-apple-system|blinkmacsystemfont|sans-serif|serif|monospace|ui-monospace|ui-sans-serif|inherit|initial|var\(.*\)|segoe ui|helvetica|arial)$/i;
const pushFont = (c: Candidates, stack: string) => {
  const first = stack.split(',').map(cleanFont).find((f) => f && !GENERIC.test(f));
  if (first && !c.fonts.includes(first)) c.fonts.push(first);
};

/** Une candidatos de varias fuentes sumando apariciones. */
export function mergeCandidates(a: Candidates, b: Candidates): Candidates {
  const out: Candidates = { ...a, sources: [...a.sources, ...b.sources], colors: a.colors.map((c) => ({ ...c })), fonts: [...a.fonts], space: [...a.space, ...b.space], radius: [...a.radius, ...b.radius], sizes: [...a.sizes, ...b.sizes], notes: [...a.notes, ...b.notes], system: a.system ?? b.system };
  for (const c of b.colors) {
    const same = out.colors.find((x) => (c.name && x.name === c.name) || (!c.name && !x.name && x.hex === c.hex));
    if (same) {
      same.count += c.count;
      same.dark ??= c.dark;
    } else out.colors.push({ ...c });
  }
  for (const f of b.fonts) if (!out.fonts.includes(f)) out.fonts.push(f);
  return out;
}

// ---------- JSON ----------

function walkJson(c: Candidates, node: unknown, path: string[]) {
  if (node == null) return;
  if (typeof node === 'string' || typeof node === 'number') return leaf(c, path, node);
  if (Array.isArray(node)) {
    if (/font|family/i.test(path.join('.')) && node.every((x) => typeof x === 'string')) pushFont(c, node.join(','));
    return;
  }
  if (typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  const value = o.$value ?? o.value;
  if (value !== undefined && (typeof value !== 'object' || value === null || Array.isArray(value))) {
    if (Array.isArray(value)) return walkJson(c, value, path);
    return leaf(c, path, value as string | number);
  }
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (typeof v.fontFamily === 'string') pushFont(c, v.fontFamily);
    const size = typeof v.fontSize === 'string' || typeof v.fontSize === 'number' ? toPx(String(v.fontSize)) : null;
    if (size) c.sizes.push(size);
    return;
  }
  if (typeof o.light === 'string' && typeof o.dark === 'string') {
    const name = nameFrom(path);
    const light = normalizeColor(o.light);
    const dark = normalizeColor(o.dark);
    if (light) pushColor(c, light, name);
    if (dark) pushColor(c, dark, name, true);
    return;
  }
  for (const [k, v] of Object.entries(o)) if (!k.startsWith('$')) walkJson(c, v, [...path, k]);
}

const MODE_WORDS = /^(light|dark|claro|oscuro|default|base|value|global|colors?|palette|tokens?|semantic|core|theme|extend)$/i;
const nameFrom = (path: string[]) => camel(path.filter((p) => !MODE_WORDS.test(p)).join('-')) || camel(path.join('-'));

function leaf(c: Candidates, path: string[], value: string | number) {
  const joined = path.join('.').toLowerCase();
  const isDark = path.some((p) => /^(dark|oscuro)$/i.test(p));
  if (typeof value === 'string') {
    const color = normalizeColor(value);
    if (color) return pushColor(c, color, nameFrom(path), isDark);
    if (/font-?family|fontfamil|typeface|fuente/.test(joined)) return pushFont(c, value);
  }
  const px = toPx(String(value));
  if (px == null) return;
  if (/radius|radii|corner|redonde/.test(joined)) c.radius.push(px);
  else if (/font-?size|fontsize|typography.*size/.test(joined)) c.sizes.push(px);
  else if (/space|spacing|gap|padding|margin|size\.|sizing|espaci/.test(joined)) c.space.push(px);
}

function isSystemFile(o: unknown): o is { tokens: Tokens; components: Component[] } {
  if (!o || typeof o !== 'object') return false;
  const x = o as Record<string, unknown>;
  const t = x.tokens as Tokens | undefined;
  return !!t && Array.isArray(t.colors) && Array.isArray(t.space) && Array.isArray(t.radius) && Array.isArray(x.components);
}

// ---------- Texto: CSS, SCSS, LESS, Tailwind, JS y HTML ----------

function scanCodeObject(c: Candidates, text: string) {
  // Recorre objetos tipo JS o JSON laxo con una pila de claves: primary: { DEFAULT: '#..', 600: '#..' }
  const stack: string[] = [];
  const re = /([A-Za-z_$][\w$-]*|'[^']*'|"[^"]*"|\d+)\s*:\s*(\{|\[|'[^']*'|"[^"]*"|`[^`]*`|-?\d*\.?\d+(?:px|rem|em)?)|(\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[3]) {
      stack.pop();
      continue;
    }
    const key = m[1].replace(/^['"]|['"]$/g, '');
    const raw = m[2];
    if (raw === '{') {
      stack.push(key);
      continue;
    }
    if (raw === '[') {
      const end = text.indexOf(']', re.lastIndex);
      if (end > 0 && /font|family|sans|serif|mono/i.test([...stack, key].join('.'))) {
        const items = [...text.slice(re.lastIndex, end).matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2]);
        if (items.length) pushFont(c, items.join(','));
      }
      continue;
    }
    const value = raw.replace(/^['"`]|['"`]$/g, '');
    const path = [...stack, key === 'DEFAULT' ? '' : key].filter(Boolean);
    leaf(c, path, value);
  }
}

function scanCss(c: Candidates, text: string) {
  const darkBodies: string[] = [];
  const withoutDark = text
    .replace(/(?:\[data-theme=["']?dark["']?\]|\.dark|html\.dark|:root\.dark|\.theme-dark)\s*\{([^}]*)\}/g, (_, body: string) => {
      darkBodies.push(body);
      return '';
    })
    .replace(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{([\s\S]*?\})\s*\}/g, (_, body: string) => {
      darkBodies.push(body);
      return '';
    });

  const decl = (body: string, dark: boolean) => {
    for (const m of body.matchAll(/(?:--|\$|@)([A-Za-z0-9_-]+)\s*:\s*([^;\n}]+)/g)) {
      const name = m[1];
      const value = m[2].trim().replace(/\s*!default\s*$/, '');
      const color = normalizeColor(value);
      const path = name.split(/[-_]/);
      if (color) pushColor(c, color, nameFrom(path.length > 1 && /^(color|colour|clr|c)$/i.test(path[0]) ? path.slice(1) : path), dark);
      else if (!dark) leaf(c, path, value);
    }
  };
  decl(withoutDark, false);
  darkBodies.forEach((b) => decl(b, true));

  // Colores dentro de reglas: el selector sirve de pista para el rol, ej: .btn-primary { background: #0074C8 }
  for (const rule of withoutDark.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rule[1].trim().split(/\s|,|:/)[0].replace(/^[.#]/, '');
    for (const d of rule[2].matchAll(/(background(?:-color)?|color|border(?:-color)?|fill|outline-color)\s*:\s*([^;]+)/gi)) {
      const color = normalizeColor(d[2].trim().split(/\s+/).find((x) => normalizeColor(x)) ?? d[2]);
      if (color) pushColor(c, color, /primary|secondary|success|danger|error|warning|brand|accent/i.test(selector) ? camel(selector) : undefined);
    }
    for (const d of rule[2].matchAll(/font-family\s*:\s*([^;]+)/gi)) pushFont(c, d[1]);
    for (const d of rule[2].matchAll(/border-radius\s*:\s*([\d.]+(?:px|rem))/gi)) {
      const px = toPx(d[1]);
      if (px != null && px < 64) c.radius.push(px);
    }
    for (const d of rule[2].matchAll(/font-size\s*:\s*([\d.]+(?:px|rem))/gi)) {
      const px = toPx(d[1]);
      if (px) c.sizes.push(px);
    }
    for (const d of rule[2].matchAll(/(?:padding|gap|margin)\s*:\s*([\d.]+(?:px|rem))/gi)) {
      const px = toPx(d[1]);
      if (px) c.space.push(px);
    }
  }
}

/** Colores con nombre escritos en texto libre, ej: «Azul principal #0074C8» o «Primario: #0074C8». */
export function scanNamedHex(c: Candidates, text: string) {
  for (const m of text.matchAll(/([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ]{1,28}?)\s*[:\-–·]?\s*(?:HEX\s*)?(#[0-9A-Fa-f]{6})\b/g)) {
    const color = normalizeColor(m[2]);
    if (color) pushColor(c, color, camel(m[1].trim()));
  }
  for (const m of text.matchAll(/(?<![A-Za-z0-9])(#[0-9A-Fa-f]{6})\b/g)) {
    const color = normalizeColor(m[1]);
    if (color && !c.colors.some((x) => x.hex === color)) pushColor(c, color);
  }
  for (const m of text.matchAll(/(?:tipograf[íi]a|fuente|typeface|font)\s*[:\-–]?\s*([A-Z][A-Za-z0-9 ]{2,24})/g)) pushFont(c, m[1]);
}

/** Lee un archivo de texto y devuelve lo que encuentra. */
export function candidatesFromText(fileName: string, text: string): Candidates {
  const c = emptyCandidates();
  c.sources.push(fileName);
  const trimmed = text.trim();
  if (!trimmed) return c;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      if (isSystemFile(json)) {
        c.system = { tokens: json.tokens, components: json.components };
        c.notes.push(`«${fileName}» es un sistema de Forma: trae ${json.tokens.colors.length} colores y ${json.components.length} componentes.`);
        return c;
      }
      walkJson(c, json, []);
      return c;
    } catch {
      c.notes.push(`«${fileName}» parece JSON, pero no es válido. Se leyó como texto.`);
    }
  }
  if (/<\w+[\s>]/.test(trimmed)) {
    const styles = [...trimmed.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
    const inline = [...trimmed.matchAll(/style="([^"]*)"/gi)].map((m) => `x{${m[1]}}`).join('\n');
    scanCss(c, `${styles}\n${inline}`);
    scanNamedHex(c, trimmed.replace(/<[^>]+>/g, ' '));
    return c;
  }
  if (/module\.exports|export default|theme\s*:|extend\s*:/.test(trimmed)) scanCodeObject(c, trimmed);
  scanCss(c, trimmed);
  if (!c.colors.length) scanNamedHex(c, trimmed);
  return c;
}

// ---------- Roles y construcción de tokens ----------

export const ROLES: { name: string; label: string; group: string }[] = [
  { name: 'primary', label: 'Primario (acciones)', group: 'Marca' },
  { name: 'secondary', label: 'Secundario', group: 'Marca' },
  { name: 'background', label: 'Fondo de pantalla', group: 'Superficies' },
  { name: 'surface', label: 'Superficie (tarjetas y campos)', group: 'Superficies' },
  { name: 'subtle', label: 'Superficie sutil', group: 'Superficies' },
  { name: 'border', label: 'Bordes', group: 'Superficies' },
  { name: 'onSurface', label: 'Texto principal', group: 'Texto' },
  { name: 'muted', label: 'Texto secundario', group: 'Texto' },
  { name: 'success', label: 'Éxito', group: 'Estados' },
  { name: 'warning', label: 'Advertencia', group: 'Estados' },
  { name: 'danger', label: 'Error', group: 'Estados' },
  { name: 'focus', label: 'Anillo de foco', group: 'Estados' },
];

const KEYWORDS: [string, RegExp][] = [
  ['primary', /primar|brand|marca|accent|acento|principal|main/i],
  ['secondary', /secondar|secundari/i],
  ['background', /background|fondo|^bg$|canvas/i],
  ['surface', /surface|superficie|card|tarjeta|paper/i],
  ['subtle', /subtle|sutil|muted-?bg|neutral-?(50|100)|gray-?(50|100)|grey-?(50|100)/i],
  ['border', /border|borde|divider|stroke|outline(?!.*focus)/i],
  ['onSurface', /^text$|text-?(primary|default)|ink|foreground|^fg$|on-?surface|texto(?!.*secund)/i],
  ['muted', /muted|secondary-?text|text-?secondary|placeholder|subtext|texto-?secund/i],
  ['success', /success|éxito|exito|positive|green|verde/i],
  ['warning', /warning|advertencia|caution|amber|yellow|naranj/i],
  ['danger', /danger|error|negative|destructive|red|rojo/i],
  ['focus', /focus|foco|ring/i],
];

export function hsl(hex: string): [number, number, number] {
  const rgb = hexToRgb(hex) ?? [0, 0, 0];
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a) ?? [0, 0, 0];
  const y = hexToRgb(b) ?? [0, 0, 0];
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** Propone qué color va en cada rol. Lo que no se encuentra conserva el valor actual. */
export function suggestMapping(colors: ColorCandidate[], current: Tokens): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const [role, re] of KEYWORDS) {
    const hit = colors.find((c) => c.name && re.test(c.name) && !used.has(c.hex));
    if (hit) {
      mapping[role] = hit.hex;
      used.add(hit.hex);
    }
  }
  const free = colors.filter((c) => !used.has(c.hex)).sort((a, b) => b.count - a.count);
  const pick = (role: string, test: (h: [number, number, number]) => boolean) => {
    if (mapping[role]) return;
    const hit = free.find((c) => !used.has(c.hex) && test(hsl(c.hex)));
    if (hit) {
      mapping[role] = hit.hex;
      used.add(hit.hex);
    }
  };
  pick('primary', ([h, s, l]) => s > 0.35 && l > 0.2 && l < 0.65 && !(h > 90 && h < 160 && s < 0.6));
  pick('onSurface', ([, s, l]) => l < 0.25 && s < 0.6);
  pick('background', ([, s, l]) => l > 0.95 && s < 0.4);
  pick('border', ([, s, l]) => l > 0.82 && l <= 0.95 && s < 0.25);
  pick('success', ([h, s, l]) => h >= 90 && h <= 170 && s > 0.3 && l > 0.2 && l < 0.6);
  pick('danger', ([h, s, l]) => (h <= 15 || h >= 345) && s > 0.45 && l > 0.3 && l < 0.6);
  pick('warning', ([h, s, l]) => h > 25 && h < 55 && s > 0.5 && l > 0.3 && l < 0.65);
  pick('muted', ([, s, l]) => l >= 0.3 && l < 0.55 && s < 0.2);
  const background = mapping.background ?? current.colors.find((c) => c.name === 'background')?.light ?? '#FFFFFF';
  for (const role of ['onSurface', 'muted']) {
    if (mapping[role] && (contrast(mapping[role], background) ?? 21) < 4.5) delete mapping[role];
  }
  return mapping;
}

const textOn = (bg: string, light = '#FFFFFF', dark = '#111418') => ((contrast(light, bg) ?? 0) >= 4.5 ? light : dark);

/** Construye los tokens finales a partir del mapeo, derivando hover, presionado, suaves y modo oscuro. */
export function buildTokens(current: Tokens, rawMapping: Record<string, string>, opts: { font?: string; radiusLg?: number; spaceLg?: number } = {}): Tokens {
  // Solo se aplican hexadecimales completos: lo que se está escribiendo a medias no rompe la vista previa.
  const mapping: Record<string, string> = Object.fromEntries(
    Object.entries(rawMapping)
      .filter(([, v]) => /^#[0-9a-f]{6}$/i.test(v ?? ''))
      .map(([k, v]) => [k, v.toUpperCase()]),
  );
  const colors: ColorToken[] = current.colors.map((c) => ({ ...c }));
  const set = (name: string, light: string, dark: string, description?: string) => {
    const e = colors.find((c) => c.name === name);
    if (e) Object.assign(e, { light, dark });
    else colors.push({ name, light, dark, description });
  };
  const darkBg = current.colors.find((c) => c.name === 'background')?.dark ?? '#0E1318';
  const brandDark = (hex: string) => {
    let d = hex;
    for (let t = 0.15; (contrast(d, darkBg) ?? 21) < 4.5 && t <= 0.9; t += 0.15) d = mix(hex, '#FFFFFF', t);
    return d;
  };
  for (const [role, hex] of Object.entries(mapping)) {
    if (!hex) continue;
    const e = colors.find((c) => c.name === role);
    const neutral = ['background', 'surface', 'subtle', 'border', 'onSurface', 'muted'].includes(role);
    set(role, hex, neutral ? (e?.dark ?? hex) : brandDark(hex));
  }
  if (mapping.primary) {
    const p = mapping.primary;
    const pd = brandDark(p);
    set('primaryHover', mix(p, '#000000', 0.08), mix(pd, '#FFFFFF', 0.12));
    set('primaryPressed', mix(p, '#000000', 0.18), mix(pd, '#FFFFFF', 0.24));
    set('primarySubtle', mix(p, '#FFFFFF', 0.9), mix(p, darkBg, 0.78));
    set('onPrimary', textOn(p), textOn(pd));
  }
  if (mapping.success) set('successSubtle', mix(mapping.success, '#FFFFFF', 0.88), mix(mapping.success, darkBg, 0.78));
  if (mapping.danger) set('dangerSubtle', mix(mapping.danger, '#FFFFFF', 0.9), mix(mapping.danger, darkBg, 0.78));
  const font = opts.font?.trim();
  const fontFamily = font ? (font.includes(',') ? font : `'${font}', system-ui, -apple-system, 'Segoe UI', sans-serif`) : current.fontFamily;
  const scale = (list: { name: string; value: number }[], lg: number | undefined, ratios: Record<string, number>) =>
    lg && lg > 0 ? list.map((s) => (ratios[s.name] != null ? { ...s, value: Math.max(0, Math.round(lg * ratios[s.name])) } : { ...s })) : list.map((s) => ({ ...s }));
  return ensureColors({
    ...current,
    fontFamily,
    colors,
    radius: scale(current.radius, opts.radiusLg, { sm: 0.5, md: 0.75, lg: 1 }),
    space: scale(current.space, opts.spaceLg, { xs: 0.25, sm: 0.5, md: 0.75, lg: 1, xl: 1.5, xxl: 2 }),
  });
}

/** Valor más frecuente de una lista, redondeado. */
export const mode = (values: number[]) => {
  if (!values.length) return undefined;
  const counts = new Map<number, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
};

/** Componentes de un archivo externo que tengan forma válida. */
export function validComponents(list: Component[]): Component[] {
  const types = new Set(BLOCK_TYPES.map((b) => b.type));
  return list.filter((c) => c && typeof c.name === 'string' && types.has(c.type) && c.states && STATES.every((s) => typeof c.states[s] === 'object'));
}
