import type { CSSProperties } from 'react';
import type { Block, BlockType, Component, Mode, Project, StateName, StyleKey, StyleProps, Tokens, TypeRole } from './model';
import { TYPE_ROLES } from './model';

export const REF = /^\{(color|space|radius)\.([A-Za-z0-9_-]+)\}$/;

export const isRef = (v?: string) => !!v && REF.test(v);
export const refOf = (group: 'color' | 'space' | 'radius', name: string) => `{${group}.${name}}`;
export const parseRef = (v?: string) => {
  const m = v ? REF.exec(v) : null;
  return m ? { group: m[1] as 'color' | 'space' | 'radius', name: m[2] } : null;
};

/** Valor crudo: no es token y no es rol tipográfico. Rompe el sistema de diseño. */
export const isRaw = (key: StyleKey, v?: string) => !!v && key !== 'type' && !isRef(v);

export function tokenExists(t: Tokens, v: string): boolean {
  const r = parseRef(v);
  if (!r) return true;
  if (r.group === 'color') return t.colors.some((c) => c.name === r.name);
  return (t[r.group] as { name: string }[]).some((s) => s.name === r.name);
}

export function resolve(v: string | undefined, t: Tokens, mode: Mode): string | undefined {
  if (v == null || v === '') return undefined;
  const r = parseRef(v);
  if (!r) return /^\d+(\.\d+)?$/.test(v) ? `${v}px` : v;
  if (r.group === 'color') return t.colors.find((c) => c.name === r.name)?.[mode];
  const s = (t[r.group] as { name: string; value: number }[]).find((x) => x.name === r.name);
  return s ? `${s.value}px` : undefined;
}

const FOCUS: StyleProps = { outline: '{color.focus}' };

/** Estados de un elemento tocable dentro de un contenedor: opción, fila, acceso, estrella o tarjeta de carrusel. */
const ITEM: Partial<Record<StateName, StyleProps>> = {
  hover: { bg: '{color.subtle}', fg: '{color.onSurface}' },
  pressed: { bg: '{color.primarySubtle}', fg: '{color.primaryPressed}' },
  // Fondo sutil y texto atenuado: se distingue aunque el reposo ya use texto atenuado (barra inferior, accesos).
  disabled: { bg: '{color.subtle}', fg: '{color.muted}' },
  focus: FOCUS,
};
/** Estados de una tarjeta que se toca completa. */
const CARD: Partial<Record<StateName, StyleProps>> = {
  hover: { bg: '{color.subtle}' },
  pressed: { border: '{color.primary}' },
  disabled: { fg: '{color.muted}' },
  focus: FOCUS,
};
/** Estados de un campo de formulario. */
const FIELD: Partial<Record<StateName, StyleProps>> = {
  hover: { border: '{color.muted}' },
  pressed: { border: '{color.primary}' },
  disabled: { bg: '{color.subtle}', fg: '{color.muted}' },
  focus: { border: '{color.primary}', ...FOCUS },
};

/** Estilos base de cada patrón. Los interactivos definen sus cinco estados; los de contenido, solo reposo. */
export function builtInStyle(type: BlockType, variant?: string): Record<StateName, StyleProps> {
  const s = (d: StyleProps, extra: Partial<Record<StateName, StyleProps>> = {}): Record<StateName, StyleProps> => ({
    default: d,
    hover: {},
    pressed: {},
    disabled: {},
    focus: {},
    ...JSON.parse(JSON.stringify(extra)),
  });
  const field: StyleProps = {
    bg: '{color.surface}',
    fg: '{color.onSurface}',
    border: '{color.border}',
    radius: '{radius.sm}',
    padY: '{space.md}',
    padX: '{space.md}',
    type: 'body',
  };
  switch (type) {
    case 'heading':
      return s({ fg: '{color.onSurface}', type: variant === 'display' ? 'display' : 'title' });
    case 'text':
      return s({
        fg: variant === 'muted' || variant === 'caption' ? '{color.muted}' : '{color.onSurface}',
        type: variant === 'caption' ? 'caption' : 'body',
      });
    case 'navbar':
      return s({ fg: '{color.onSurface}', type: 'title' }, ITEM);
    case 'tabBar':
      return s({ bg: '{color.surface}', fg: '{color.muted}', border: '{color.border}', type: 'caption' }, ITEM);
    case 'menuList':
      if (variant === 'plain') return s({ fg: '{color.onSurface}', border: '{color.border}', padY: '{space.lg}', padX: '{space.xs}', type: 'body' }, ITEM);
      return s({ bg: '{color.surface}', fg: '{color.onSurface}', radius: '{radius.lg}', padY: '{space.lg}', padX: '{space.lg}', type: 'body' }, ITEM);
    case 'accountCard':
      return s({ bg: '{color.surface}', fg: '{color.onSurface}', radius: '{radius.lg}', padY: '{space.lg}', padX: '{space.lg}', type: 'display' }, CARD);
    case 'creditCard':
      return s(
        { bg: '{color.cardDark}', fg: '{color.onDark}', radius: '{radius.lg}', padY: '{space.lg}', padX: '{space.lg}', type: 'display' },
        { hover: { bg: '{color.cardDarkEnd}' }, pressed: { border: '{color.primary}' }, disabled: { fg: '{color.muted}' }, focus: FOCUS },
      );
    case 'carousel':
      return s({ bg: '{color.surface}', fg: '{color.onSurface}', radius: '{radius.lg}', padY: '{space.lg}', padX: '{space.lg}', type: 'label' }, ITEM);
    case 'financeCard':
      return s({ bg: '{color.surface}', fg: '{color.onSurface}', radius: '{radius.lg}', padY: '{space.lg}', padX: '{space.lg}', type: 'title' }, CARD);
    case 'rating':
      return s({ fg: '{color.onSurface}', border: '{color.star}', type: 'title' }, ITEM);
    case 'iconGrid':
      return s({ bg: '{color.surface}', fg: '{color.muted}', radius: '{radius.lg}', padY: '{space.xl}', padX: '{space.md}', type: 'caption' }, ITEM);
    case 'balance':
      return s({ bg: '{color.primary}', fg: '{color.onPrimary}', radius: '{radius.lg}', padY: '{space.lg}', padX: '{space.lg}', type: 'display' });
    case 'help':
      return s({ bg: '{color.subtle}', fg: '{color.onSurface}', radius: '{radius.md}', padY: '{space.md}', padX: '{space.lg}', type: 'label' });
    case 'card':
      return s({ bg: '{color.surface}', fg: '{color.onSurface}', border: '{color.border}', radius: '{radius.lg}', padY: '{space.lg}', padX: '{space.lg}', type: 'label' }, CARD);
    case 'radio':
      if (variant === 'numbers')
        return s(
          { fg: '{color.muted}', border: '{color.primary}', type: 'display' },
          { hover: { fg: '{color.onSurface}' }, pressed: { fg: '{color.primaryPressed}' }, disabled: { fg: '{color.border}' }, focus: FOCUS },
        );
      return s({ fg: '{color.onSurface}', type: 'body' }, ITEM);
    case 'switch':
    case 'checkbox':
      return s({ fg: '{color.onSurface}', type: 'body' }, ITEM);
    case 'tabs':
      if (variant === 'underline') return s({ bg: '{color.surface}', fg: '{color.muted}', border: '{color.primary}', type: 'body' }, ITEM);
      return s(
        { bg: '{color.subtle}', fg: '{color.onSurface}', radius: '{radius.md}', padY: '{space.xs}', padX: '{space.xs}', type: 'label' },
        { hover: { bg: '{color.border}' }, pressed: { bg: '{color.primarySubtle}', fg: '{color.primaryPressed}' }, disabled: { fg: '{color.muted}' }, focus: FOCUS },
      );
    case 'tag':
      return s({ bg: '{color.primarySubtle}', fg: '{color.primaryPressed}', radius: '{radius.pill}', padY: '{space.xs}', padX: '{space.sm}', type: 'caption' });
    case 'avatar':
      return s({ bg: '{color.primarySubtle}', fg: '{color.primaryPressed}', radius: '{radius.pill}', type: 'label' });
    case 'progress':
      return s({ bg: '{color.subtle}', fg: '{color.onSurface}', border: '{color.primary}', radius: '{radius.pill}', type: 'caption' });
    case 'statusIcon':
      return s({ bg: '{color.successSubtle}', fg: '{color.success}', radius: '{radius.pill}', type: 'display' });
    case 'input':
    case 'textarea':
    case 'select':
      if (type === 'input' && variant === 'search')
        return s({ ...field, border: '{color.onSurface}', radius: '{radius.md}' }, { ...FIELD, hover: { bg: '{color.subtle}' } });
      return s(field, FIELD);
    case 'amount':
      return s({ ...field, type: 'display' }, FIELD);
    case 'button':
      if (variant === 'success')
        return s(
          { bg: '{color.success}', fg: '{color.onPrimary}', radius: '{radius.pill}', padY: '{space.lg}', padX: '{space.lg}', type: 'label' },
          { hover: { bg: '{color.successHover}' }, pressed: { bg: '{color.successPressed}' }, disabled: { bg: '{color.subtle}', fg: '{color.muted}' }, focus: FOCUS },
        );
      if (variant === 'secondary')
        return s(
          { bg: '{color.surface}', fg: '{color.primary}', border: '{color.border}', radius: '{radius.md}', padY: '{space.md}', padX: '{space.lg}', type: 'label' },
          {
            hover: { bg: '{color.subtle}', fg: '{color.primaryPressed}' },
            pressed: { bg: '{color.primarySubtle}', fg: '{color.primaryPressed}', border: '{color.primary}' },
            disabled: { bg: '{color.subtle}', fg: '{color.muted}', border: '{color.border}' },
            focus: FOCUS,
          },
        );
      return s(
        { bg: '{color.primary}', fg: '{color.onPrimary}', radius: '{radius.md}', padY: '{space.md}', padX: '{space.lg}', type: 'label' },
        { hover: { bg: '{color.primaryHover}' }, pressed: { bg: '{color.primaryPressed}' }, disabled: { bg: '{color.subtle}', fg: '{color.muted}' }, focus: FOCUS },
      );
    case 'link':
      return s(
        { fg: '{color.primary}', type: 'label' },
        { hover: { fg: '{color.primaryPressed}' }, pressed: { bg: '{color.primarySubtle}', fg: '{color.primaryPressed}' }, disabled: { fg: '{color.muted}' }, focus: FOCUS },
      );
    case 'listItem':
      if (variant === 'icon' || variant === 'profile')
        return s({ bg: '{color.surface}', fg: '{color.onSurface}', radius: '{radius.lg}', padY: '{space.lg}', padX: '{space.lg}', type: 'body' }, CARD);
      if (variant === 'contact') return s({ fg: '{color.onSurface}', border: '{color.border}', padY: '{space.lg}', type: 'body' }, ITEM);
      if (variant === 'notification') return s({ bg: '{color.surface}', fg: '{color.onSurface}', border: '{color.border}', padY: '{space.lg}', padX: '{space.lg}', type: 'body' }, ITEM);
      if (variant === 'logout')
        return s(
          { bg: '{color.subtle}', fg: '{color.onSurface}', padY: '{space.lg}', padX: '{space.lg}', type: 'body' },
          { hover: { bg: '{color.border}' }, pressed: { bg: '{color.dangerSubtle}' }, disabled: { fg: '{color.muted}' }, focus: FOCUS },
        );
      return s({ bg: '{color.surface}', fg: '{color.onSurface}', border: '{color.border}', radius: '{radius.md}', padY: '{space.md}', padX: '{space.lg}', type: 'body' }, CARD);
    case 'alert':
      return s({
        bg: variant === 'danger' ? '{color.dangerSubtle}' : '{color.successSubtle}',
        fg: '{color.onSurface}',
        radius: '{radius.md}',
        padY: '{space.md}',
        padX: '{space.lg}',
        type: 'label',
      });
    case 'image':
      return s({ bg: '{color.subtle}', fg: '{color.muted}', radius: '{radius.md}', type: 'caption' });
    case 'divider':
      return s({ border: '{color.border}' });
  }
}

export const findComponent = (p: Project, id?: string): Component | undefined =>
  id ? p.components.find((c) => c.id === id) : undefined;

/** Estilo efectivo de un bloque para un conjunto ordenado de estados activos. */
export function effectiveStyle(p: Project, block: Block, active: StateName[]): StyleProps {
  const comp = findComponent(p, block.componentId);
  const states = comp?.states ?? builtInStyle(block.type, block.variant);
  let out: StyleProps = { ...states.default };
  for (const st of active) if (st !== 'default') out = { ...out, ...clean(states[st]) };
  out = { ...out, ...clean(block.overrides) };
  return out;
}

export function componentStyle(c: Component, state: StateName): StyleProps {
  return state === 'default' ? { ...c.states.default } : { ...c.states.default, ...clean(c.states[state]) };
}

const clean = (s?: StyleProps): StyleProps => {
  const o: StyleProps = {};
  for (const [k, v] of Object.entries(s ?? {})) if (v != null && v !== '') o[k as StyleKey] = v;
  return o;
};

export function typeToken(t: Tokens, role?: string) {
  const r = (TYPE_ROLES as string[]).includes(role ?? '') ? (role as TypeRole) : 'body';
  return t.type.find((x) => x.role === r) ?? { role: r, size: 16, lineHeight: 24, weight: 400 };
}

export function toCss(style: StyleProps, t: Tokens, mode: Mode): CSSProperties {
  const tt = typeToken(t, style.type);
  const css: CSSProperties = {
    fontFamily: t.fontFamily,
    fontSize: tt.size,
    lineHeight: `${tt.lineHeight}px`,
    fontWeight: tt.weight,
  };
  const bg = resolve(style.bg, t, mode);
  const fg = resolve(style.fg, t, mode);
  const border = resolve(style.border, t, mode);
  const outline = resolve(style.outline, t, mode);
  if (bg) css.backgroundColor = bg;
  if (fg) css.color = fg;
  if (border) css.border = `1px solid ${border}`;
  if (outline) {
    css.outline = `2px solid ${outline}`;
    css.outlineOffset = 2;
  }
  const radius = resolve(style.radius, t, mode);
  if (radius) css.borderRadius = radius;
  const py = resolve(style.padY, t, mode);
  const px = resolve(style.padX, t, mode);
  if (py || px) css.padding = `${py ?? '0px'} ${px ?? '0px'}`;
  return css;
}

export const spaceValue = (t: Tokens, name: string, fallback: number) => t.space.find((s) => s.name === name)?.value ?? fallback;

export const colorValue = (t: Tokens, name: string, mode: Mode, fallback: string) =>
  t.colors.find((c) => c.name === name)?.[mode] ?? fallback;

// ---------- Contraste WCAG ----------

export function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace('#', '');
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) return null;
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

const lum = ([r, g, b]: [number, number, number]) => {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export function contrast(a?: string, b?: string): number | null {
  const x = a ? hexToRgb(a) : null;
  const y = b ? hexToRgb(b) : null;
  if (!x || !y) return null;
  const [l1, l2] = [lum(x), lum(y)].sort((m, n) => n - m);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}

const toGray = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const l = Math.round(0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]);
  const h = l.toString(16).padStart(2, '0').toUpperCase();
  return `#${h}${h}${h}`;
};

/** Tokens en escala de grises: el wireframe usa el mismo dato y la misma jerarquía, sin color de marca. */
export const grayTokens = (t: Tokens): Tokens => ({ ...t, colors: t.colors.map((c) => ({ ...c, light: toGray(c.light), dark: toGray(c.dark) })) });

// ---------- Exportación de tokens ----------

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
export const cssVar = (group: string, name: string) => `--${group}-${kebab(name)}`;

export function exportCss(t: Tokens): string {
  const lines = [':root {', `  --font-family: ${t.fontFamily};`];
  t.colors.forEach((c) => lines.push(`  ${cssVar('color', c.name)}: ${c.light};`));
  t.space.forEach((s) => lines.push(`  ${cssVar('space', s.name)}: ${s.value}px;`));
  t.radius.forEach((r) => lines.push(`  ${cssVar('radius', r.name)}: ${r.value}px;`));
  t.type.forEach((y) => {
    lines.push(`  ${cssVar('type', y.role)}-size: ${y.size}px;`);
    lines.push(`  ${cssVar('type', y.role)}-line-height: ${y.lineHeight}px;`);
    lines.push(`  ${cssVar('type', y.role)}-weight: ${y.weight};`);
  });
  lines.push('}', '', '[data-theme="dark"] {');
  t.colors.forEach((c) => lines.push(`  ${cssVar('color', c.name)}: ${c.dark};`));
  lines.push('}');
  return lines.join('\n');
}

export function exportJs(t: Tokens): string {
  const obj = {
    fontFamily: t.fontFamily,
    color: Object.fromEntries(t.colors.map((c) => [c.name, { light: c.light, dark: c.dark }])),
    space: Object.fromEntries(t.space.map((s) => [s.name, s.value])),
    radius: Object.fromEntries(t.radius.map((s) => [s.name, s.value])),
    type: Object.fromEntries(t.type.map((y) => [y.role, { size: y.size, lineHeight: y.lineHeight, weight: y.weight }])),
  };
  return `export const tokens = ${JSON.stringify(obj, null, 2)};\n\nexport default tokens;\n`;
}

export function exportStyleDictionary(t: Tokens): string {
  const obj = {
    color: {
      light: Object.fromEntries(t.colors.map((c) => [c.name, { value: c.light, comment: c.description ?? '' }])),
      dark: Object.fromEntries(t.colors.map((c) => [c.name, { value: c.dark, comment: c.description ?? '' }])),
    },
    space: Object.fromEntries(t.space.map((s) => [s.name, { value: `${s.value}px` }])),
    radius: Object.fromEntries(t.radius.map((s) => [s.name, { value: `${s.value}px` }])),
    typography: Object.fromEntries(
      t.type.map((y) => [
        y.role,
        { fontFamily: { value: t.fontFamily }, fontSize: { value: `${y.size}px` }, lineHeight: { value: `${y.lineHeight}px` }, fontWeight: { value: String(y.weight) } },
      ]),
    ),
  };
  return JSON.stringify(obj, null, 2);
}

/** Valor CSS de referencia (var() para tokens, crudo para valores sueltos). */
export function cssRef(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const r = parseRef(v);
  if (!r) return /^\d+(\.\d+)?$/.test(v) ? `${v}px` : v;
  return `var(${cssVar(r.group, r.name)})`;
}

function cssDecls(s: StyleProps, withType: boolean): string[] {
  const d: string[] = [];
  if (s.bg) d.push(`background: ${cssRef(s.bg)};`);
  if (s.fg) d.push(`color: ${cssRef(s.fg)};`);
  if (s.border) d.push(`border: 1px solid ${cssRef(s.border)};`);
  if (s.outline) d.push(`outline: 2px solid ${cssRef(s.outline)};`, 'outline-offset: 2px;');
  if (s.radius) d.push(`border-radius: ${cssRef(s.radius)};`);
  if (s.padY || s.padX) d.push(`padding: ${cssRef(s.padY) ?? '0'} ${cssRef(s.padX) ?? '0'};`);
  if (withType && s.type) {
    d.push(
      `font-family: var(--font-family);`,
      `font-size: var(${cssVar('type', s.type)}-size);`,
      `line-height: var(${cssVar('type', s.type)}-line-height);`,
      `font-weight: var(${cssVar('type', s.type)}-weight);`,
    );
  }
  return d;
}

export const componentClass = (c: { name: string }) =>
  'c-' +
  c.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const PSEUDO: Record<Exclude<StateName, 'default'>, string> = {
  hover: ':hover:not(:disabled)',
  pressed: ':active:not(:disabled)',
  disabled: ':disabled',
  focus: ':focus-visible',
};

export function componentCss(c: { name: string; states: Record<StateName, StyleProps> }): string {
  const cls = componentClass(c);
  const out = [`.${cls} {`, ...cssDecls(c.states.default, true).map((l) => `  ${l}`), '}'];
  (['hover', 'pressed', 'disabled', 'focus'] as const).forEach((st) => {
    const decls = cssDecls(c.states[st] ?? {}, false);
    if (decls.length) out.push(`.${cls}${PSEUDO[st]} {`, ...decls.map((l) => `  ${l}`), '}');
  });
  return out.join('\n');
}

const TAG: Partial<Record<BlockType, string>> = {
  button: 'button',
  link: 'a',
  input: 'input',
  amount: 'input',
  select: 'select',
  listItem: 'button',
  heading: 'h2',
  text: 'p',
  alert: 'div',
  navbar: 'header',
};

const pascal = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');

export function componentReact(c: { name: string; type: BlockType }): string {
  const cls = componentClass(c);
  const name = pascal(c.name) || 'Componente';
  const tag = TAG[c.type] ?? 'div';
  if (tag === 'input')
    return `export function ${name}({ label, ...props }) {\n  return (\n    <label className="${cls}-field">\n      <span>{label}</span>\n      <input className="${cls}" ${c.type === 'amount' ? 'inputMode="numeric" ' : ''}{...props} />\n    </label>\n  );\n}\n`;
  return `export function ${name}({ children, ...props }) {\n  return (\n    <${tag} className="${cls}" {...props}>\n      {children}\n    </${tag}>\n  );\n}\n`;
}

export function componentHtml(c: { name: string; type: BlockType }, label = 'Texto'): string {
  const cls = componentClass(c);
  const tag = TAG[c.type] ?? 'div';
  if (tag === 'input') return `<label>\n  <span>${label}</span>\n  <input class="${cls}" />\n</label>`;
  return `<${tag} class="${cls}">${label}</${tag}>`;
}
