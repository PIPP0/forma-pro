import type { Block, Component, OpInput, Path, Project, Screen, StateName, StyleKey, Tokens } from './model';

// Guardado por operación: cada cambio es una operación pequeña, invertible y registrable.

export const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

export function getIn(obj: unknown, path: Path): unknown {
  let cur: any = obj;
  for (const k of path) {
    if (cur == null) return undefined;
    cur = cur[k as any];
  }
  return cur;
}

function setIn(obj: any, path: Path, fn: (v: any) => any): any {
  if (path.length === 0) return fn(obj);
  const [k, ...rest] = path;
  const copy: any = Array.isArray(obj) ? obj.slice() : { ...(obj ?? {}) };
  const next = setIn(obj?.[k as any], rest, fn);
  if (next === undefined && !Array.isArray(copy)) delete copy[k as any];
  else copy[k as any] = next;
  return copy;
}

export interface Applied<T> {
  doc: T;
  op: OpInput;
  prev: unknown;
}

export function applyOp<T>(doc: T, op: OpInput): Applied<T> {
  switch (op.kind) {
    case 'set': {
      const prev = clone(getIn(doc, op.path));
      return { doc: setIn(doc, op.path, () => clone(op.value)), op, prev };
    }
    case 'insert': {
      const arr = (getIn(doc, op.path) as unknown[] | undefined) ?? [];
      const index = Math.max(0, Math.min(op.index, arr.length));
      const next = setIn(doc, op.path, (a: unknown[] = []) => {
        const b = a.slice();
        b.splice(index, 0, clone(op.value));
        return b;
      });
      return { doc: next, op: { ...op, index }, prev: undefined };
    }
    case 'remove': {
      const arr = getIn(doc, op.path) as unknown[] | undefined;
      if (!arr || op.index < 0 || op.index >= arr.length) throw new Error('Operación inválida: índice fuera de rango');
      const prev = clone(arr[op.index]);
      return { doc: setIn(doc, op.path, (a: unknown[]) => a.filter((_, i) => i !== op.index)), op, prev };
    }
    case 'move': {
      const arr = getIn(doc, op.path) as unknown[] | undefined;
      if (!arr) throw new Error('Operación inválida: lista inexistente');
      const to = Math.max(0, Math.min(op.to, arr.length - 1));
      const next = setIn(doc, op.path, (a: unknown[]) => {
        const b = a.slice();
        const [x] = b.splice(op.from, 1);
        b.splice(to, 0, x);
        return b;
      });
      return { doc: next, op: { ...op, to }, prev: undefined };
    }
  }
}

export function invertOp(op: OpInput, prev: unknown): OpInput {
  switch (op.kind) {
    case 'set':
      return { kind: 'set', path: op.path, value: prev };
    case 'insert':
      return { kind: 'remove', path: op.path, index: op.index };
    case 'remove':
      return { kind: 'insert', path: op.path, index: op.index, value: prev };
    case 'move':
      return { kind: 'move', path: op.path, from: op.to, to: op.from };
  }
}

// ---------- Constructores de operaciones sobre el proyecto ----------

const si = (p: Project, screenId: string) => {
  const i = p.screens.findIndex((s) => s.id === screenId);
  if (i < 0) throw new Error('Pantalla no encontrada');
  return i;
};
const bi = (p: Project, screenId: string, blockId: string) => {
  const i = p.screens[si(p, screenId)].blocks.findIndex((b) => b.id === blockId);
  if (i < 0) throw new Error('Bloque no encontrado');
  return i;
};
const ci = (p: Project, componentId: string) => {
  const i = p.components.findIndex((c) => c.id === componentId);
  if (i < 0) throw new Error('Componente no encontrado');
  return i;
};

export const edit = {
  project: (key: keyof Project, value: unknown): OpInput => ({ kind: 'set', path: [key], value }),
  replaceAll: (value: Project): OpInput => ({ kind: 'set', path: [], value }),

  screen: (p: Project, screenId: string, key: keyof Screen, value: unknown): OpInput => ({
    kind: 'set',
    path: ['screens', si(p, screenId), key],
    value,
  }),
  addScreen: (p: Project, screen: Screen, index?: number): OpInput => ({
    kind: 'insert',
    path: ['screens'],
    index: index ?? p.screens.length,
    value: screen,
  }),
  removeScreen: (p: Project, screenId: string): OpInput => ({ kind: 'remove', path: ['screens'], index: si(p, screenId) }),

  block: (p: Project, screenId: string, blockId: string, key: keyof Block, value: unknown): OpInput => ({
    kind: 'set',
    path: ['screens', si(p, screenId), 'blocks', bi(p, screenId, blockId), key],
    value,
  }),
  blockOverride: (p: Project, screenId: string, blockId: string, key: StyleKey, value: string | undefined): OpInput => ({
    kind: 'set',
    path: ['screens', si(p, screenId), 'blocks', bi(p, screenId, blockId), 'overrides', key],
    value,
  }),
  addBlock: (p: Project, screenId: string, block: Block, index?: number): OpInput => ({
    kind: 'insert',
    path: ['screens', si(p, screenId), 'blocks'],
    index: index ?? p.screens[si(p, screenId)].blocks.length,
    value: block,
  }),
  removeBlock: (p: Project, screenId: string, blockId: string): OpInput => ({
    kind: 'remove',
    path: ['screens', si(p, screenId), 'blocks'],
    index: bi(p, screenId, blockId),
  }),
  moveBlock: (p: Project, screenId: string, from: number, to: number): OpInput => ({
    kind: 'move',
    path: ['screens', si(p, screenId), 'blocks'],
    from,
    to,
  }),

  token: (group: keyof Omit<Tokens, 'fontFamily'>, index: number, key: string, value: unknown): OpInput => ({
    kind: 'set',
    path: ['tokens', group, index, key],
    value,
  }),
  addToken: (p: Project, group: keyof Omit<Tokens, 'fontFamily'>, value: unknown): OpInput => ({
    kind: 'insert',
    path: ['tokens', group],
    index: (p.tokens[group] as unknown[]).length,
    value,
  }),
  removeToken: (group: keyof Omit<Tokens, 'fontFamily'>, index: number): OpInput => ({
    kind: 'remove',
    path: ['tokens', group],
    index,
  }),

  component: (p: Project, componentId: string, key: keyof Component, value: unknown): OpInput => ({
    kind: 'set',
    path: ['components', ci(p, componentId), key],
    value,
  }),
  componentState: (p: Project, componentId: string, state: StateName, key: StyleKey, value: string | undefined): OpInput => ({
    kind: 'set',
    path: ['components', ci(p, componentId), 'states', state, key],
    value,
  }),
  addComponent: (p: Project, c: Component): OpInput => ({
    kind: 'insert',
    path: ['components'],
    index: p.components.length,
    value: c,
  }),
  removeComponent: (p: Project, componentId: string): OpInput => ({
    kind: 'remove',
    path: ['components'],
    index: ci(p, componentId),
  }),
};

/** Operaciones para renombrar un token y actualizar todas sus referencias. */
export function renameTokenOps(p: Project, group: 'color' | 'space' | 'radius', from: string, to: string): OpInput[] {
  const key = group === 'color' ? 'colors' : group;
  const list = p.tokens[key] as { name: string }[];
  const index = list.findIndex((t) => t.name === from);
  if (index < 0) return [];
  const oldRef = `{${group}.${from}}`;
  const newRef = `{${group}.${to}}`;
  const ops: OpInput[] = [{ kind: 'set', path: ['tokens', key, index, 'name'], value: to }];
  p.components.forEach((c, cIdx) => {
    for (const [state, props] of Object.entries(c.states)) {
      for (const [k, v] of Object.entries(props ?? {})) {
        if (v === oldRef) ops.push({ kind: 'set', path: ['components', cIdx, 'states', state, k], value: newRef });
      }
    }
  });
  p.screens.forEach((s, sIdx) =>
    s.blocks.forEach((b, bIdx) => {
      for (const [k, v] of Object.entries(b.overrides ?? {})) {
        if (v === oldRef) ops.push({ kind: 'set', path: ['screens', sIdx, 'blocks', bIdx, 'overrides', k], value: newRef });
      }
    }),
  );
  return ops;
}
