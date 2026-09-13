import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { Block, Breakpoint, Mode, Project, StudyEvent } from '../lib/model';
import { blockMeta, breakpointOf, screenFor } from '../lib/model';
import { BlockView } from './BlockView';
import { ScaledFrame, contentWidth, navbarBleed, screenStyle } from './ScreenCanvas';

export type RunnerEvent = Pick<StudyEvent, 'screen' | 'block' | 'kind' | 'x' | 'y' | 'bx' | 'by' | 'dwell'>;

const HESITATION_MS = 3500;
const clamp = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 1000) / 1000;

/** Reproduce el prototipo con los mismos bloques del diseño y registra la interacción. */
export function Runner({
  project,
  startScreenId,
  breakpoint,
  mode,
  onEvent,
  onScreen,
  fill,
  maxScale,
}: {
  project: Project;
  startScreenId: string;
  breakpoint: Breakpoint;
  mode: Mode;
  onEvent?: (e: RunnerEvent) => void;
  onScreen?: (screenId: string) => void;
  fill?: boolean;
  maxScale?: number;
}) {
  const [stack, setStack] = useState<string[]>([startScreenId]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const last = useRef(performance.now());
  const typed = useRef(new Set<string>());
  const content = useRef<HTMLDivElement>(null);

  const current = screenFor(project, stack[stack.length - 1], breakpoint);

  useEffect(() => {
    if (!current) return;
    last.current = performance.now();
    typed.current = new Set();
    onScreen?.(current.id);
    content.current?.parentElement?.scrollTo?.({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return <div className="empty">La pantalla de inicio de esta tarea ya no existe.</div>;

  const emit = (e: RunnerEvent) => onEvent?.(e);

  const coords = (e: MouseEvent, el: Element | null) => {
    const r = content.current!.getBoundingClientRect();
    const out: Pick<RunnerEvent, 'x' | 'y' | 'bx' | 'by'> = {
      x: clamp((e.clientX - r.left) / r.width),
      y: clamp((e.clientY - r.top) / r.height),
    };
    if (el) {
      const br = el.getBoundingClientRect();
      out.bx = clamp((e.clientX - br.left) / br.width);
      out.by = clamp((e.clientY - br.top) / br.height);
    }
    return out;
  };

  const navigate = (block: Block) => {
    if (block.action === 'back') {
      if (stack.length > 1) {
        const next = stack.slice(0, -1);
        setStack(next);
        emit({ kind: 'navigate', screen: screenFor(project, next[next.length - 1], breakpoint)!.id, x: 0, y: 0 });
      }
      return;
    }
    if (block.action === 'navigate' && block.target) {
      if (block.type === 'button') {
        const missing = current.blocks.filter((b) => b.required && !(b.type === 'checkbox' ? checked[b.id] : values[b.id]?.trim()));
        if (missing.length) {
          setErrors(Object.fromEntries(missing.map((m) => [m.id, 'Completa este campo para continuar.'])));
          return 'blocked' as const;
        }
      }
      setErrors({});
      setStack((s) => [...s, block.target!]);
      emit({ kind: 'navigate', screen: screenFor(project, block.target, breakpoint)?.id ?? block.target, x: 0, y: 0 });
    }
  };

  const onClick = (e: MouseEvent) => {
    const el = (e.target as Element).closest('[data-block-id]');
    const block = el ? current.blocks.find((b) => b.id === el.getAttribute('data-block-id')) : undefined;
    const c = coords(e, el);
    const now = performance.now();
    const gap = now - last.current;
    last.current = now;
    const isBack = block?.type === 'navbar' && !!(e.target as Element).closest('button');
    if (!block || !blockMeta(block.type).interactive || block.disabled || (block.type === 'navbar' && !isBack)) {
      emit({ kind: 'misclick', screen: current.id, block: block?.id, ...c });
      return;
    }
    if (gap > HESITATION_MS) emit({ kind: 'hesitation', screen: current.id, block: block.id, dwell: Math.round(gap), ...c });
    if (blockMeta(block.type).field) {
      emit({ kind: 'tap', screen: current.id, block: block.id, ...c });
      if (block.type === 'checkbox') {
        setChecked((s) => ({ ...s, [block.id]: !s[block.id] }));
        setErrors((er) => ({ ...er, [block.id]: '' }));
      }
      return;
    }
    const result = navigate(block);
    emit({ kind: result === 'blocked' ? 'blocked' : 'tap', screen: current.id, block: block.id, ...c });
  };

  const setValue = (block: Block, v: string) => {
    setValues((s) => ({ ...s, [block.id]: v }));
    setErrors((er) => ({ ...er, [block.id]: '' }));
    last.current = performance.now();
    if (!typed.current.has(block.id)) {
      typed.current.add(block.id);
      emit({ kind: 'input', screen: current.id, block: block.id, x: 0, y: 0 });
    }
  };

  const maxW = contentWidth(current);
  const body = (
    <div ref={content} className="screen" style={screenStyle(project, mode)} onClick={onClick}>
      {current.blocks.map((b, i) => (
        <div
          key={b.id}
          data-block-id={b.id}
          style={{
            ...(b.type === 'navbar' && i === 0 ? navbarBleed(project) : {}),
            ...(maxW && b.type !== 'navbar' ? { width: '100%', maxWidth: maxW, alignSelf: 'center' } : {}),
          }}
        >
          <BlockView
            project={project}
            block={b}
            mode={mode}
            live
            value={values[b.id]}
            checked={checked[b.id]}
            error={errors[b.id] || undefined}
            onValue={(v) => setValue(b, v)}
          />
        </div>
      ))}
    </div>
  );

  if (fill) return <div className="runner-fill">{body}</div>;
  // El marco sigue a la pantalla resuelta: si no hay variante para este dispositivo, se ve la base.
  const bp = breakpointOf(current.breakpoint);
  return (
    <ScaledFrame width={bp.width} height={bp.height} fixed maxScale={maxScale}>
      <div className="device-scroll">{body}</div>
    </ScaledFrame>
  );
}
