import type { Mode, Project, StateName, StyleProps } from './model';
import { STATE_LABEL, STYLE_KEYS, baseId, blockMeta } from './model';
import { componentStyle, contrast, effectiveStyle, isRaw, resolve, tokenExists } from './tokens';

export type Severity = 'error' | 'warning';
export type Area = 'flujo' | 'accesibilidad' | 'sistema';

export interface Issue {
  id: string;
  severity: Severity;
  area: Area;
  message: string;
  screenId?: string;
  blockId?: string;
  componentId?: string;
}

export const AREA_LABEL: Record<Area, string> = { flujo: 'Flujo', accesibilidad: 'Accesibilidad', sistema: 'Sistema' };

/** Grafo de navegación entre pantallas base (las variantes comparten nodo). */
export function navGraph(p: Project): Map<string, Set<string>> {
  const ids = new Map(p.screens.map((s) => [s.id, s]));
  const g = new Map<string, Set<string>>();
  for (const s of p.screens) {
    const from = baseId(s);
    if (!g.has(from)) g.set(from, new Set());
    for (const b of s.blocks) {
      if (b.action === 'navigate' && b.target && ids.has(b.target)) g.get(from)!.add(baseId(ids.get(b.target)!));
      for (const target of Object.values(b.optionTargets ?? {})) {
        if (target && ids.has(target)) g.get(from)!.add(baseId(ids.get(target)!));
      }
    }
  }
  return g;
}

export function bfs(g: Map<string, Set<string>>, start: string): Map<string, number> {
  const dist = new Map<string, number>([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of g.get(cur) ?? []) {
      if (!dist.has(n)) {
        dist.set(n, dist.get(cur)! + 1);
        queue.push(n);
      }
    }
  }
  return dist;
}

const MODES: Mode[] = ['light', 'dark'];
const modeLabel = (m: Mode) => (m === 'light' ? 'modo claro' : 'modo oscuro');

export function checkProject(p: Project): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const add = (i: Omit<Issue, 'id'>) => {
    const key = `${i.area}|${i.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ id: `iss-${issues.length}`, ...i });
  };

  if (!p.screens.length) {
    add({ severity: 'error', area: 'flujo', message: 'El proyecto no tiene pantallas.' });
    return issues;
  }

  const byId = new Map(p.screens.map((s) => [s.id, s]));
  const start = byId.get(p.startScreenId);
  if (!start) add({ severity: 'error', area: 'flujo', message: 'Define cuál es la pantalla de inicio del flujo.' });

  for (const s of p.screens) {
    if (s.variantOf && !byId.has(s.variantOf))
      add({ severity: 'error', area: 'flujo', screenId: s.id, message: `«${s.name}» es variante de una pantalla que ya no existe.` });

    for (const b of s.blocks) {
      const meta = blockMeta(b.type);
      const name = b.label.trim() || meta.label;
      if (b.action === 'navigate') {
        if (!b.target)
          add({ severity: 'error', area: 'flujo', screenId: s.id, blockId: b.id, message: `«${name}» en «${s.name}» navega, pero no tiene destino.` });
        else if (!byId.has(b.target))
          add({ severity: 'error', area: 'flujo', screenId: s.id, blockId: b.id, message: `«${name}» en «${s.name}» apunta a una pantalla eliminada.` });
      }
      for (const [opt, target] of Object.entries(b.optionTargets ?? {})) {
        if (target && !byId.has(target))
          add({ severity: 'error', area: 'flujo', screenId: s.id, blockId: b.id, message: `La opción «${opt.replace(/\*\*/g, '')}» de «${name.replace(/\*\*/g, '')}» en «${s.name}» apunta a una pantalla eliminada.` });
      }
      if (meta.field && !b.label.trim())
        add({ severity: 'error', area: 'accesibilidad', screenId: s.id, blockId: b.id, message: `Un ${meta.label.toLowerCase()} en «${s.name}» no tiene etiqueta visible.` });
      if ((b.type === 'button' || b.type === 'link' || b.type === 'listItem' || b.type === 'card') && !b.label.trim())
        add({ severity: 'error', area: 'accesibilidad', screenId: s.id, blockId: b.id, message: `Un ${meta.label.toLowerCase()} en «${s.name}» no tiene texto.` });
      if (b.componentId && !p.components.some((c) => c.id === b.componentId))
        add({ severity: 'error', area: 'sistema', screenId: s.id, blockId: b.id, message: `«${name}» en «${s.name}» usa un componente que ya no existe.` });

      for (const [k, v] of Object.entries(b.overrides ?? {})) {
        if (!v) continue;
        const label = STYLE_KEYS.find((x) => x.key === k)?.label.toLowerCase() ?? k;
        if (!tokenExists(p.tokens, v))
          add({ severity: 'error', area: 'sistema', screenId: s.id, blockId: b.id, message: `«${name}» en «${s.name}» usa el token ${v}, que no existe.` });
        else if (isRaw(k as keyof StyleProps, v))
          add({
            severity: 'warning',
            area: 'sistema',
            screenId: s.id,
            blockId: b.id,
            message: `«${name}» en «${s.name}» sobrescribe ${label} con un valor suelto (${v}) en vez de un token.`,
          });
      }
    }

    if (s.blocks.some((b) => b.required) && !s.blocks.some((b) => b.type === 'button' && b.action === 'navigate'))
      add({ severity: 'warning', area: 'flujo', screenId: s.id, message: `«${s.name}» tiene campos obligatorios, pero ningún botón para continuar.` });
  }

  for (const c of p.components) {
    for (const [st, props] of Object.entries(c.states)) {
      for (const [k, v] of Object.entries(props ?? {})) {
        if (v && !tokenExists(p.tokens, v))
          add({ severity: 'error', area: 'sistema', componentId: c.id, message: `«${c.name}» (${STATE_LABEL[st as StateName]}) usa el token ${v}, que no existe.` });
      }
    }
  }

  // Alcance y callejones sin salida
  if (start) {
    const g = navGraph(p);
    const dist = bfs(g, baseId(start));
    const withBack = new Set(p.screens.filter((s) => s.blocks.some((b) => b.action === 'back')).map(baseId));
    const terminal = new Set(p.screens.filter((s) => s.terminal).map(baseId));
    for (const s of p.screens) {
      if (s.variantOf) continue;
      if (!dist.has(s.id))
        add({ severity: 'warning', area: 'flujo', screenId: s.id, message: `«${s.name}» no es alcanzable desde «${start.name}».` });
      else if (!terminal.has(s.id) && !(g.get(s.id)?.size ?? 0) && !withBack.has(s.id))
        add({
          severity: 'warning',
          area: 'flujo',
          screenId: s.id,
          message: `«${s.name}» es un callejón sin salida: no tiene acciones ni está marcada como pantalla final.`,
        });
    }
  }

  // Contraste (WCAG AA)
  const checkPair = (style: StyleProps, mode: Mode, where: string, ref: Partial<Issue>) => {
    const fg = resolve(style.fg, p.tokens, mode);
    const bg = resolve(style.bg, p.tokens, mode) ?? resolve('{color.background}', p.tokens, mode) ?? '#FFFFFF';
    const ratio = contrast(fg, bg);
    if (ratio == null) return;
    const large = style.type === 'display' || style.type === 'title';
    const min = large ? 3 : 4.5;
    if (ratio < min)
      add({
        severity: 'error',
        area: 'accesibilidad',
        ...ref,
        message: `Contraste insuficiente en ${where}, ${modeLabel(mode)}: ${String(ratio).replace('.', ',')}:1 (mínimo ${String(min).replace('.', ',')}:1).`,
      });
  };

  for (const mode of MODES) {
    for (const c of p.components) {
      for (const st of ['default', 'hover', 'pressed', 'focus'] as StateName[]) {
        checkPair(componentStyle(c, st), mode, `«${c.name}» (${STATE_LABEL[st].toLowerCase()})`, { componentId: c.id });
      }
    }
    for (const s of p.screens) {
      for (const b of s.blocks) {
        if (b.componentId && !b.overrides?.fg && !b.overrides?.bg) continue;
        if (b.disabled) continue;
        checkPair(effectiveStyle(p, b, ['default']), mode, `«${b.label || blockMeta(b.type).label}» de «${s.name}»`, { screenId: s.id, blockId: b.id });
      }
    }
  }

  // Foco visible
  for (const c of p.components) {
    if (!blockMeta(c.type).interactive) continue;
    const f = c.states.focus ?? {};
    if (!f.outline && !f.border && !f.bg)
      add({ severity: 'warning', area: 'accesibilidad', componentId: c.id, message: `«${c.name}» no tiene un estado de foco visible para teclado.` });
  }

  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
}

export const hasBlockingErrors = (issues: Issue[]) => issues.some((i) => i.severity === 'error');
