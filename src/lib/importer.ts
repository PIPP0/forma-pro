import type { Block, BlockType, ColorToken, SizeToken, Tokens } from './model';
import { uid } from './ids';
import { clone } from './ops';

// Importadores de código: tokens (JSON / Style Dictionary / CSS) y pantallas desde HTML.

const camel = (s: string) => s.replace(/[-_\s]+([a-z0-9])/gi, (_, c: string) => c.toUpperCase()).replace(/^[A-Z]/, (c) => c.toLowerCase());
const isColor = (v: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
const num = (v: string | number) => (typeof v === 'number' ? v : parseFloat(String(v)));

interface Found {
  colors: Map<string, { light?: string; dark?: string }>;
  space: Map<string, number>;
  radius: Map<string, number>;
}

const emptyFound = (): Found => ({ colors: new Map(), space: new Map(), radius: new Map() });

function classify(found: Found, path: string[], value: string | number, mode: 'light' | 'dark' = 'light') {
  const [head, ...rest] = path.map((x) => x.toLowerCase());
  let parts = rest;
  let m = mode;
  if ((head === 'color' || head === 'colors') && (rest[0] === 'light' || rest[0] === 'dark')) {
    m = rest[0] as 'light' | 'dark';
    parts = rest.slice(1);
  }
  const name = camel(parts.join('-')) || camel(path.join('-'));
  if (head === 'color' || head === 'colors' || (typeof value === 'string' && isColor(value))) {
    if (typeof value !== 'string' || !isColor(value)) return;
    const key = head === 'color' || head === 'colors' ? name : camel(path.join('-'));
    const entry = found.colors.get(key) ?? {};
    entry[m] = value.toUpperCase();
    found.colors.set(key, entry);
  } else if (head === 'space' || head === 'spacing' || head === 'size') {
    if (!Number.isNaN(num(value))) found.space.set(name, num(value));
  } else if (head === 'radius' || head === 'radii' || head === 'borderradius') {
    if (!Number.isNaN(num(value))) found.radius.set(name, num(value));
  }
}

function walkJson(found: Found, obj: unknown, path: string[] = []) {
  if (obj == null) return;
  if (typeof obj === 'string' || typeof obj === 'number') return classify(found, path, obj);
  if (typeof obj !== 'object') return;
  const o = obj as Record<string, unknown>;
  const leaf = o.value ?? o.$value;
  if (typeof leaf === 'string' || typeof leaf === 'number') return classify(found, path, leaf);
  if (o.light && o.dark && typeof o.light === 'string' && typeof o.dark === 'string') {
    classify(found, path, o.light, 'light');
    classify(found, path, o.dark, 'dark');
    return;
  }
  for (const [k, v] of Object.entries(o)) walkJson(found, v, [...path, k]);
}

function parseCss(found: Found, css: string) {
  const darkBlocks: string[] = [];
  const stripped = css
    .replace(/\[data-theme=["']?dark["']?\]\s*\{([^}]*)\}/g, (_, body: string) => {
      darkBlocks.push(body);
      return '';
    })
    .replace(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*[^{]*\{([^}]*)\}\s*\}/g, (_, body: string) => {
      darkBlocks.push(body);
      return '';
    });
  const vars = (text: string) => [...text.matchAll(/--([A-Za-z0-9-_]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()] as const);
  for (const [name, value] of vars(stripped)) classify(found, name.split('-'), value.replace(/px$/, ''));
  for (const body of darkBlocks) for (const [name, value] of vars(body)) classify(found, name.split('-'), value, 'dark');
}

export interface TokenImport {
  tokens: Tokens;
  summary: string[];
}

export function importTokens(text: string, current: Tokens): TokenImport {
  const found = emptyFound();
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Pega el contenido de tus tokens.');
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('El JSON no es válido. Revisa comas y comillas.');
    }
    walkJson(found, parsed);
  } else {
    parseCss(found, trimmed);
  }
  const next = clone(current);
  let addedColors = 0,
    updatedColors = 0;
  for (const [name, v] of found.colors) {
    const existing = next.colors.find((c) => c.name === name);
    if (existing) {
      if (v.light) existing.light = v.light;
      if (v.dark) existing.dark = v.dark;
      updatedColors++;
    } else {
      const light = v.light ?? v.dark!;
      next.colors.push({ name, light, dark: v.dark ?? light } as ColorToken);
      addedColors++;
    }
  }
  const mergeSizes = (list: SizeToken[], map: Map<string, number>) => {
    let n = 0;
    for (const [name, value] of map) {
      const e = list.find((s) => s.name === name);
      if (e) e.value = value;
      else list.push({ name, value });
      n++;
    }
    return n;
  };
  const space = mergeSizes(next.space, found.space);
  const radius = mergeSizes(next.radius, found.radius);
  if (!addedColors && !updatedColors && !space && !radius) throw new Error('No encontramos tokens de color, espacio o radio en ese contenido.');
  const summary = [
    addedColors && `${addedColors} ${addedColors === 1 ? 'color nuevo' : 'colores nuevos'}`,
    updatedColors && `${updatedColors} ${updatedColors === 1 ? 'color actualizado' : 'colores actualizados'}`,
    space && `${space} ${space === 1 ? 'espacio' : 'espacios'}`,
    radius && `${radius} ${radius === 1 ? 'radio' : 'radios'}`,
  ].filter(Boolean) as string[];
  return { tokens: next, summary };
}

// ---------- HTML a bloques ----------

const SELECTOR = 'h1,h2,h3,h4,p,input,select,textarea,button,a,img,hr,[role="alert"],header,nav';

export function importHtml(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const picked: Element[] = [];
  doc.body.querySelectorAll(SELECTOR).forEach((el) => {
    if (picked.some((p) => p.contains(el))) return;
    picked.push(el);
  });
  const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const labelFor = (el: Element) => {
    const id = el.getAttribute('id');
    const byFor = id ? doc.querySelector(`label[for="${id}"]`) : null;
    const wrap = el.closest('label');
    // Sin etiqueta real queda vacío: el guardarraíl lo marca como problema de accesibilidad.
    const t = (byFor && text(byFor)) || (wrap && text(wrap)) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    return t;
  };
  const blocks: Block[] = [];
  const push = (type: BlockType, label: string, extra: Partial<Block> = {}) => blocks.push({ id: uid('b_'), type, label, ...extra });

  for (const el of picked) {
    const tag = el.tagName.toLowerCase();
    const cls = (el.getAttribute('class') ?? '').toLowerCase();
    if (tag === 'header' || tag === 'nav') {
      push('navbar', text(el).slice(0, 40) || 'Barra superior');
    } else if (tag === 'h1') push('heading', text(el), { variant: 'display' });
    else if (tag === 'h2' || tag === 'h3' || tag === 'h4') push('heading', text(el), { variant: 'title' });
    else if (tag === 'p') {
      if (text(el)) push('text', text(el));
    } else if (tag === 'input' || tag === 'textarea') {
      const type = (el.getAttribute('type') ?? 'text').toLowerCase();
      if (type === 'hidden' || type === 'submit') {
        if (type === 'submit') push('button', el.getAttribute('value') ?? 'Enviar');
        continue;
      }
      const label = labelFor(el);
      if (type === 'checkbox' || type === 'radio') push('checkbox', label);
      else {
        const numeric = type === 'number' || el.getAttribute('inputmode') === 'numeric' || /monto|amount|importe/i.test(label + (el.getAttribute('name') ?? ''));
        push(numeric ? 'amount' : 'input', label, {
          detail: el.getAttribute('placeholder') ?? undefined,
          required: el.hasAttribute('required') || undefined,
        });
      }
    } else if (tag === 'select') {
      push('select', labelFor(el), {
        options: [...el.querySelectorAll('option')].map((o) => text(o)).filter(Boolean),
        required: el.hasAttribute('required') || undefined,
      });
    } else if (tag === 'button') {
      push('button', text(el), { variant: /secondary|outline|ghost/.test(cls) ? 'secondary' : undefined });
    } else if (tag === 'a') {
      if (text(el)) push('link', text(el));
    } else if (tag === 'img') {
      push('image', el.getAttribute('alt') ?? 'Imagen');
    } else if (tag === 'hr') {
      push('divider', '');
    } else if (el.getAttribute('role') === 'alert') {
      push('alert', text(el));
    }
  }
  return blocks;
}
