import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { Block, Breakpoint, Mode, Project, StudyEvent } from '../lib/model';
import { CHOICE_TYPES, TOGGLE_TYPES, baseId, blockMeta, breakpointOf, screenFor, withValues } from '../lib/model';
import { BlockView } from './BlockView';
import { ImageScreen, PhoneChrome, ScaledFrame, SheetLayout, blockWrapperStyle, contentWidth, screenStyle, sheetBackdrop } from './ScreenCanvas';

export type RunnerEvent = Pick<StudyEvent, 'screen' | 'block' | 'option' | 'kind' | 'x' | 'y' | 'bx' | 'by' | 'dwell'>;

const HESITATION_MS = 3500;
const clamp = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 1000) / 1000;
/** Bloques contenedores: tocar fuera de sus opciones es un toque sin acción. */
const CONTAINERS = ['menuList', 'carousel', 'iconGrid', 'tabBar'];

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
  const first = useRef(true);
  const typed = useRef(new Set<string>());
  const content = useRef<HTMLDivElement>(null);

  const current = screenFor(project, stack[stack.length - 1], breakpoint);

  useEffect(() => {
    if (!current) return;
    last.current = performance.now();
    typed.current = new Set();
    onScreen?.(current.id);
    content.current?.closest('.device-scroll, .runner-fill')?.scrollTo?.({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Transición automática de Figma: la pantalla pasa sola después de unos segundos.
  useEffect(() => {
    const auto = current?.autoNext;
    if (!auto) return;
    const t = window.setTimeout(() => {
      if (auto.back) navigate({ id: '', type: 'button', label: '', action: 'back' });
      else if (auto.target) goTo(auto.target);
    }, Math.max(0, auto.ms));
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return <div className="empty">La pantalla de inicio de esta tarea ya no existe.</div>;

  const emit = (e: RunnerEvent) => onEvent?.(e);

  const coords = (e: MouseEvent, el: Element | null) => {
    const r = content.current!.getBoundingClientRect();
    const out: Pick<RunnerEvent, 'x' | 'y' | 'bx' | 'by'> = { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
    if (el) {
      const br = el.getBoundingClientRect();
      out.bx = clamp((e.clientX - br.left) / br.width);
      out.by = clamp((e.clientY - br.top) / br.height);
    }
    return out;
  };

  const isFilled = (b: Block) => (TOGGLE_TYPES.includes(b.type) ? !!checked[b.id] : !!(values[b.id] ?? (b.type === 'tabs' ? b.value : ''))?.trim());
  const pending = current.blocks.some((b) => b.required && !isFilled(b));

  const goTo = (targetId: string) => {
    const target = screenFor(project, targetId, breakpoint);
    if (!target || baseId(target) === baseId(current)) return;
    setErrors({});
    setStack((s) => [...s, targetId]);
    emit({ kind: 'navigate', screen: target.id, x: 0, y: 0 });
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
        const missing = current.blocks.filter((b) => b.required && !isFilled(b));
        if (missing.length) {
          setErrors(Object.fromEntries(missing.map((m) => [m.id, 'Completa este campo para continuar.'])));
          return 'blocked' as const;
        }
      }
      goTo(block.target);
    }
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

  /** Pantalla importada como imagen: se navega por sus zonas tocables. */
  const onImageClick = (e: MouseEvent) => {
    const el = (e.target as Element).closest('[data-hotspot-id]');
    const hotspot = el ? current.hotspots?.find((h) => h.id === el.getAttribute('data-hotspot-id')) : undefined;
    const c = coords(e, el);
    const now = performance.now();
    const gap = now - last.current;
    last.current = now;
    const wasFirst = first.current;
    first.current = false;
    if (!hotspot) {
      emit({ kind: 'misclick', screen: current.id, ...c });
      return;
    }
    if (gap > HESITATION_MS && !wasFirst) emit({ kind: 'hesitation', screen: current.id, block: hotspot.id, dwell: Math.round(gap), ...c });
    emit({ kind: 'tap', screen: current.id, block: hotspot.id, ...c });
    if (hotspot.back) {
      navigate({ id: '', type: 'button', label: '', action: 'back' });
      return;
    }
    if (hotspot.target) goTo(hotspot.target);
  };

  const onClick = (e: MouseEvent) => {
    const target = e.target as Element;
    if (target.closest('[data-scrim]')) {
      // Tocar fuera de la hoja inferior la cierra, como en una app real.
      if (stack.length > 1) navigate({ id: '', type: 'button', label: '', action: 'back' });
      return;
    }
    const el = target.closest('[data-block-id]');
    const block = el ? current.blocks.find((b) => b.id === el.getAttribute('data-block-id')) : undefined;
    const c = coords(e, el);
    const now = performance.now();
    const gap = now - last.current;
    last.current = now;
    // La primera acción de la tarea incluye leer la instrucción: ese tiempo no es una duda.
    const wasFirst = first.current;
    first.current = false;
    const option = target.closest('[data-option]')?.getAttribute('data-option') ?? undefined;
    const optionTarget = option ? block?.optionTargets?.[option] : undefined;
    const isBack = block?.type === 'navbar' && !!target.closest('button') && !option;

    if (!block || !blockMeta(block.type).interactive || block.disabled || (block.type === 'navbar' && !isBack && !option) || (CONTAINERS.includes(block.type) && !option)) {
      emit({ kind: 'misclick', screen: current.id, block: block?.id, ...c });
      return;
    }
    if (gap > HESITATION_MS && !wasFirst) emit({ kind: 'hesitation', screen: current.id, block: block.id, option, dwell: Math.round(gap), ...c });

    if (optionTarget) {
      emit({ kind: 'tap', screen: current.id, block: block.id, option, ...c });
      goTo(optionTarget);
      return;
    }
    if (blockMeta(block.type).field) {
      emit({ kind: 'tap', screen: current.id, block: block.id, option, ...c });
      if (TOGGLE_TYPES.includes(block.type)) {
        setChecked((s) => ({ ...s, [block.id]: !s[block.id] }));
        setErrors((er) => ({ ...er, [block.id]: '' }));
      }
      if (CHOICE_TYPES.includes(block.type) && block.type !== 'select' && option) setValue(block, option);
      return;
    }
    if (option) {
      // Opción sin destino (por ejemplo, la pestaña actual): se registra el toque sin navegar.
      emit({ kind: 'tap', screen: current.id, block: block.id, option, ...c });
      return;
    }
    const result = navigate(block);
    emit({ kind: result === 'blocked' ? 'blocked' : 'tap', screen: current.id, block: block.id, ...c });
  };

  const maxW = contentWidth(current);
  const blocks = current.blocks.map((b) => (
    <div key={b.id} data-block-id={b.id} style={blockWrapperStyle(project, b, maxW)}>
      <BlockView
        project={project}
        block={withValues(b, values)}
        mode={mode}
        live
        value={values[b.id]}
        checked={checked[b.id]}
        error={errors[b.id] || undefined}
        onValue={(v) => setValue(b, v)}
        pendingRequired={b.type === 'button' && !!b.disableUntilValid && pending}
      />
    </div>
  ));
  const sheet = current.presentation === 'sheet';
  const body = current.image ? (
    sheet ? (
      // Superposición de Figma: la pantalla se ve encima de la anterior.
      <SheetLayout
        key={current.id}
        project={project}
        mode={mode}
        backdrop={sheetBackdrop(project, current, stack.length > 1 ? stack[stack.length - 2] : undefined)}
        hostRef={content}
        onClick={onImageClick}
        fill={fill}
        animate
      >
        <ImageScreen screen={current} />
      </SheetLayout>
    ) : (
      <div ref={content} className="screen screen-image" onClick={onImageClick}>
        <ImageScreen screen={current} />
      </div>
    )
  ) : sheet ? (
    <SheetLayout
      key={current.id}
      project={project}
      mode={mode}
      backdrop={sheetBackdrop(project, current, stack.length > 1 ? stack[stack.length - 2] : undefined)}
      hostRef={content}
      onClick={onClick}
      fill={fill}
      animate
    >
      {blocks}
    </SheetLayout>
  ) : (
    <div ref={content} className="screen" style={screenStyle(project, mode)} onClick={onClick}>
      {blocks}
    </div>
  );

  if (fill)
    return (
      <div className="runner-fill">
        <PhoneChrome project={{ ...project, footnote: undefined }} mode={mode} enabled={false}>
          {body}
        </PhoneChrome>
      </div>
    );
  // El marco sigue a la pantalla resuelta: si no hay variante para este dispositivo, se ve la base.
  const bp = breakpointOf(current.breakpoint);
  return (
    <ScaledFrame width={bp.width} height={bp.height} fixed maxScale={maxScale}>
      <div className="device-scroll">
        <PhoneChrome project={project} mode={mode} enabled={current.breakpoint === 'mobile'} dim={sheet}>
          {body}
        </PhoneChrome>
      </div>
    </ScaledFrame>
  );
}
