import type { Project, StyleProps } from './model';
import { builtInStyle } from './tokens';

/** Bloques instanciados desde un componente, sobre los tipos que el sistema cubre. */
export function adoption(p: Project) {
  const types = new Set(p.components.map((c) => c.type));
  const ids = new Set(p.components.map((c) => c.id));
  const eligible = p.screens.flatMap((s) => s.blocks).filter((b) => types.has(b.type));
  const instanced = eligible.filter((b) => b.componentId && ids.has(b.componentId));
  return { eligible: eligible.length, instanced: instanced.length, pct: eligible.length ? instanced.length / eligible.length : 1 };
}

export function tokenUses(p: Project, ref: string): number {
  let n = 0;
  const count = (s?: StyleProps) => {
    for (const v of Object.values(s ?? {})) if (v === ref) n++;
  };
  p.components.forEach((c) => Object.values(c.states).forEach(count));
  p.screens.forEach((s) =>
    s.blocks.forEach((b) => {
      count(b.overrides);
      if (!b.componentId) Object.values(builtInStyle(b.type, b.variant)).forEach(count);
    }),
  );
  return n;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Diferencias legibles entre una versión guardada y el estado actual. */
export function diffSummary(from: Project, to: Project): string[] {
  const out: string[] = [];
  const fromIds = new Map(from.screens.map((s) => [s.id, s]));
  const toIds = new Map(to.screens.map((s) => [s.id, s]));
  const added = to.screens.filter((s) => !fromIds.has(s.id));
  const removed = from.screens.filter((s) => !toIds.has(s.id));
  const changed = to.screens.filter((s) => fromIds.has(s.id) && JSON.stringify(fromIds.get(s.id)) !== JSON.stringify(s));
  if (added.length) out.push(`Hoy hay ${plural(added.length, 'pantalla que no existía', 'pantallas que no existían')}: ${added.map((s) => `«${s.name}»`).join(', ')}.`);
  if (removed.length) out.push(`${plural(removed.length, 'pantalla fue eliminada', 'pantallas fueron eliminadas')} después: ${removed.map((s) => `«${s.name}»`).join(', ')}.`);
  if (changed.length) out.push(`${plural(changed.length, 'pantalla cambió', 'pantallas cambiaron')}: ${changed.map((s) => `«${s.name}»`).join(', ')}.`);
  const colorChanges = to.tokens.colors.filter((c) => {
    const f = from.tokens.colors.find((x) => x.name === c.name);
    return !f || f.light !== c.light || f.dark !== c.dark;
  }).length;
  const removedColors = from.tokens.colors.filter((c) => !to.tokens.colors.some((x) => x.name === c.name)).length;
  if (colorChanges || removedColors) out.push(`${plural(colorChanges + removedColors, 'token de color distinto', 'tokens de color distintos')}.`);
  if (JSON.stringify(from.tokens.space) !== JSON.stringify(to.tokens.space) || JSON.stringify(from.tokens.radius) !== JSON.stringify(to.tokens.radius) || JSON.stringify(from.tokens.type) !== JSON.stringify(to.tokens.type))
    out.push('Cambió la escala de espaciado, radios o tipografía.');
  const compChanged = to.components.filter((c) => JSON.stringify(from.components.find((x) => x.id === c.id)) !== JSON.stringify(c)).length;
  const compRemoved = from.components.filter((c) => !to.components.some((x) => x.id === c.id)).length;
  if (compChanged || compRemoved) out.push(`${plural(compChanged + compRemoved, 'componente distinto', 'componentes distintos')}.`);
  if (!out.length) out.push('Sin diferencias con el estado actual.');
  return out;
}
