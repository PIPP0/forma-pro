import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Mode, Project, Screen } from '../lib/model';
import { breakpointOf } from '../lib/model';
import { colorValue, spaceValue } from '../lib/tokens';
import { BlockView } from './BlockView';

/** Marco de dispositivo escalado para caber en su contenedor, sin perder medidas reales. */
export function ScaledFrame({
  width,
  height,
  fixed,
  children,
  maxScale = 1,
  className = '',
}: {
  width: number;
  height: number;
  fixed?: boolean;
  children: ReactNode;
  maxScale?: number;
  className?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerH, setInnerH] = useState(height);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      setScale(Math.max(0.2, Math.min(maxScale, (o.clientWidth - 2) / width)));
      setInnerH(i.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [width, maxScale]);

  return (
    <div ref={outer} className={`frame-outer ${className}`}>
      <div style={{ width: width * scale, height: innerH * scale, margin: '0 auto', position: 'relative' }}>
        <div
          ref={inner}
          className="device"
          data-scale={scale}
          style={{
            width,
            height: fixed ? height : undefined,
            minHeight: height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function screenStyle(p: Project, mode: Mode, wireframe?: boolean): CSSProperties {
  const pad = spaceValue(p.tokens, 'lg', 16);
  return {
    background: wireframe ? '#FFFFFF' : colorValue(p.tokens, 'background', mode, mode === 'dark' ? '#111' : '#F7F7F7'),
    padding: pad,
    display: 'flex',
    flexDirection: 'column',
    gap: spaceValue(p.tokens, 'md', 12),
    minHeight: '100%',
    boxSizing: 'border-box',
    fontFamily: p.tokens.fontFamily,
  };
}

/** Margen negativo para que la barra superior toque los bordes de la pantalla. */
export const navbarBleed = (p: Project): CSSProperties => {
  const pad = spaceValue(p.tokens, 'lg', 16);
  return { margin: `-${pad}px -${pad}px 0` };
};

export const contentWidth = (screen: Screen) => (screen.breakpoint === 'desktop' ? 560 : screen.breakpoint === 'tablet' ? 520 : undefined);

export function ScreenCanvas({
  project,
  screen,
  mode,
  wireframe,
  selectedBlockId,
  onSelect,
  measures,
  overlay,
}: {
  project: Project;
  screen: Screen;
  mode: Mode;
  wireframe?: boolean;
  selectedBlockId?: string;
  onSelect?: (blockId: string | undefined) => void;
  measures?: boolean;
  overlay?: ReactNode;
}) {
  const bp = breakpointOf(screen.breakpoint);
  const maxW = contentWidth(screen);
  return (
    <ScaledFrame width={bp.width} height={bp.height}>
      <div className="screen" style={screenStyle(project, mode, wireframe)} onClick={() => onSelect?.(undefined)}>
        <div style={{ display: 'contents' }}>
          {screen.blocks.map((b, i) => (
            <div
              key={b.id}
              data-block-id={b.id}
              className={`blk ${selectedBlockId === b.id ? 'selected' : ''}`}
              style={{
                ...(b.type === 'navbar' && i === 0 ? navbarBleed(project) : {}),
                ...(maxW && b.type !== 'navbar' ? { width: '100%', maxWidth: maxW, alignSelf: 'center' } : {}),
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(b.id);
              }}
            >
              <BlockView project={project} block={b} mode={mode} wireframe={wireframe} />
              {measures && selectedBlockId === b.id && <Measure />}
            </div>
          ))}
          {!screen.blocks.length && <div className="screen-empty">Pantalla vacía. Agrega bloques desde el panel derecho.</div>}
        </div>
        {overlay}
      </div>
    </ScaledFrame>
  );
}

/** Etiqueta de medidas reales del bloque seleccionado (sin escala). */
function Measure() {
  const ref = useRef<HTMLSpanElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number; gap: number | null }>({ w: 0, h: 0, gap: null });
  useLayoutEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const measure = () => {
      const prev = host.previousElementSibling as HTMLElement | null;
      setDims({
        w: Math.round(host.offsetWidth),
        h: Math.round(host.offsetHeight),
        gap: prev ? Math.round(host.offsetTop - (prev.offsetTop + prev.offsetHeight)) : null,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);
  return (
    <>
      <span ref={ref} className="measure-label">
        {dims.w} × {dims.h}
      </span>
      {dims.gap != null && dims.gap > 0 && (
        <span className="measure-gap" style={{ height: dims.gap, top: -dims.gap }}>
          <span>{dims.gap}</span>
        </span>
      )}
    </>
  );
}
