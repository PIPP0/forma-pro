import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEventHandler, type ReactNode, type Ref } from 'react';
import type { Block, Mode, Project, Screen } from '../lib/model';
import { baseId, breakpointOf, screenFor, withValues } from '../lib/model';
import { colorValue, findComponent, spaceValue } from '../lib/tokens';
import { BlockView } from './BlockView';
import { IconShield } from './icons';

/** Marco de dispositivo escalado. Con `scale` usa un zoom fijo; sin él, cabe en su contenedor. */
export function ScaledFrame({
  width,
  height,
  fixed,
  children,
  maxScale = 1,
  scale: fixedScale,
  className = '',
}: {
  width: number;
  height: number;
  fixed?: boolean;
  children: ReactNode;
  maxScale?: number;
  scale?: number;
  className?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [innerH, setInnerH] = useState(height);
  const scale = fixedScale ?? fit;

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      if (fixedScale == null) setFit(Math.max(0.2, Math.min(maxScale, (o.clientWidth - 2) / width)));
      setInnerH(i.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [width, maxScale, fixedScale]);

  return (
    <div ref={outer} className={`frame-outer ${className}`} style={fixedScale != null ? { width: width * scale } : undefined}>
      <div style={{ width: width * scale, height: innerH * scale, margin: '0 auto', position: 'relative' }}>
        <div
          ref={inner}
          className={`device device-${width < 600 ? 'phone' : 'wide'}`}
          style={{ width, height: fixed ? height : undefined, minHeight: height, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

const screenPadding = (p: Project) => ({ top: spaceValue(p.tokens, 'sm', 8), side: spaceValue(p.tokens, 'lg', 16) + 4, bottom: spaceValue(p.tokens, 'xl', 24) });

export function screenStyle(p: Project, mode: Mode, wireframe?: boolean): CSSProperties {
  const pad = screenPadding(p);
  const surface = colorValue(p.tokens, 'surface', mode, '#FFF');
  const background = colorValue(p.tokens, 'background', mode, mode === 'dark' ? '#111' : '#FFF');
  return {
    background: wireframe ? '#FFFFFF' : p.backgroundStyle === 'gradient' ? `linear-gradient(180deg, ${surface} 0px, ${surface} 120px, ${background} 320px)` : background,
    padding: `${pad.top}px ${pad.side}px ${pad.bottom}px`,
    display: 'flex',
    flexDirection: 'column',
    gap: spaceValue(p.tokens, 'lg', 16),
    minHeight: '100%',
    boxSizing: 'border-box',
    fontFamily: p.tokens.fontFamily,
  };
}

export const contentWidth = (screen: Screen) => (screen.breakpoint === 'desktop' ? 560 : screen.breakpoint === 'tablet' ? 520 : undefined);

/** Ajustes de ubicación por bloque: barra inferior fija, pestañas y carruseles a sangre. */
export function blockWrapperStyle(p: Project, b: Block, maxW?: number): CSSProperties | undefined {
  const pad = screenPadding(p);
  const variant = findComponent(p, b.componentId)?.variant ?? b.variant;
  if (b.type === 'tabBar') return { marginTop: 'auto', marginLeft: -pad.side, marginRight: -pad.side, marginBottom: -pad.bottom, position: 'sticky', bottom: 0, zIndex: 3 };
  if (b.type === 'tabs' && variant === 'underline') return { marginLeft: -pad.side, marginRight: -pad.side };
  if (b.type === 'carousel') return { marginRight: -pad.side };
  if (maxW && b.type !== 'navbar') return { width: '100%', maxWidth: maxW, alignSelf: 'center' };
  return undefined;
}

export const SCRIM = 'rgba(15, 23, 42, 0.5)';

/** Pantalla que queda detrás de una hoja inferior: la anterior en el prototipo, o la elegida en el lienzo. */
export function sheetBackdrop(p: Project, screen: Screen, previousId?: string): Screen | undefined {
  if (screen.presentation !== 'sheet') return undefined;
  const s = screenFor(p, previousId ?? screen.sheetOver ?? p.startScreenId, screen.breakpoint);
  return s && baseId(s) !== baseId(screen) ? s : undefined;
}

/** Hoja inferior: la pantalla de fondo atenuada y el contenido en una hoja que sube desde abajo. */
export function SheetLayout({
  project,
  mode,
  wireframe,
  backdrop,
  children,
  overlay,
  hostRef,
  onClick,
  fill,
  animate,
  minHeight,
}: {
  project: Project;
  mode: Mode;
  wireframe?: boolean;
  backdrop?: Screen;
  children: ReactNode;
  overlay?: ReactNode;
  hostRef?: Ref<HTMLDivElement>;
  onClick?: MouseEventHandler<HTMLDivElement>;
  fill?: boolean;
  animate?: boolean;
  minHeight?: number;
}) {
  const pad = screenPadding(project);
  const surface = wireframe ? '#FFFFFF' : colorValue(project.tokens, 'surface', mode, '#FFF');
  return (
    <div ref={hostRef} className="sheet-host" onClick={onClick} style={{ position: 'relative', flex: 1, height: fill ? '100%' : undefined, minHeight: minHeight ?? 0, overflow: 'hidden', fontFamily: project.tokens.fontFamily }}>
      {backdrop && (
        // isolation: la barra inferior fija del fondo no puede quedar sobre la hoja.
        <div className="screen" aria-hidden="true" inert style={{ ...screenStyle(project, mode, wireframe), position: 'absolute', inset: 0, minHeight: 0, overflow: 'hidden', pointerEvents: 'none', isolation: 'isolate', zIndex: 0 }}>
          {backdrop.blocks.map((b) => (
            <div key={b.id} style={blockWrapperStyle(project, b)}>
              <BlockView project={project} block={withValues(b)} mode={mode} wireframe={wireframe} />
            </div>
          ))}
        </div>
      )}
      <div data-scrim="" aria-label="Cerrar" style={{ position: 'absolute', inset: 0, background: SCRIM, zIndex: 1 }} />
      <div
        role="dialog"
        aria-modal="true"
        className={`sheet${animate ? ' sheet-animate' : ''}`}
        style={{
          position: 'absolute',
          zIndex: 2,
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '90%',
          overflowY: 'auto',
          background: surface,
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 30px rgba(15, 23, 42, 0.18)',
          padding: `10px ${pad.side}px ${pad.bottom}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: spaceValue(project.tokens, 'lg', 16),
        }}
      >
        <span aria-hidden="true" style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, background: '#C5CCD4', flex: 'none' }} />
        {children}
      </div>
      {overlay}
    </div>
  );
}

/** Barra de estado, nota al pie e indicador de inicio de un teléfono. */
export function PhoneChrome({ project, mode, wireframe, enabled, dim, children }: { project: Project; mode: Mode; wireframe?: boolean; enabled: boolean; dim?: boolean; children: ReactNode }) {
  if (!enabled) return <>{children}</>;
  const gradient = project.backgroundStyle === 'gradient';
  const bg = wireframe ? '#FFFFFF' : colorValue(project.tokens, gradient ? 'surface' : 'background', mode, '#FFF');
  const fg = wireframe ? '#3A424A' : colorValue(project.tokens, 'onSurface', mode, '#111');
  const muted = wireframe ? '#7C868F' : colorValue(project.tokens, 'muted', mode, '#666');
  const wave = project.statusBar === 'wave';
  const statusColor = wave && !wireframe ? '#FFFFFF' : fg;
  return (
    <div className="phone" style={{ background: bg, fontFamily: project.tokens.fontFamily }}>
      <div className="phone-status" style={{ color: statusColor, position: 'relative', overflow: 'hidden' }}>
        {wave && (
          <svg aria-hidden="true" viewBox="0 0 375 56" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <rect width="375" height="56" fill={wireframe ? '#9AA0A6' : '#4A86D6'} />
            <path d="M0 56 V46 C 60 34 120 34 175 46 L 160 56 Z" fill={wireframe ? '#80868C' : '#E5484D'} />
            <path d="M190 56 C 250 46 310 36 375 34 V56 Z" fill={wireframe ? '#B5BABE' : '#F4C430'} />
            <path d="M120 56 C 200 46 290 48 375 48 V56 Z" fill={bg} />
          </svg>
        )}
        <span style={{ position: 'relative' }}>9:41</span>
        <span className="phone-status-icons" aria-hidden="true" style={{ position: 'relative' }}>
          <svg width="16" height="10" viewBox="0 0 16 10" fill={statusColor}>
            <rect x="0" y="6" width="3" height="4" rx="0.6" />
            <rect x="4.3" y="4" width="3" height="6" rx="0.6" />
            <rect x="8.6" y="2" width="3" height="8" rx="0.6" />
            <rect x="12.9" y="0" width="3" height="10" rx="0.6" />
          </svg>
          <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke={statusColor} strokeWidth="1.6" strokeLinecap="round">
            <path d="M1 3.6a8.5 8.5 0 0112 0M3.2 6a5.3 5.3 0 017.6 0" />
            <circle cx="7" cy="8.6" r="0.9" fill={statusColor} stroke="none" />
          </svg>
          <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
            <rect x="0.6" y="0.6" width="18" height="9.8" rx="2.6" stroke={statusColor} strokeOpacity="0.45" />
            <rect x="2.2" y="2.2" width="14.8" height="6.6" rx="1.5" fill={statusColor} />
            <rect x="19.8" y="3.6" width="1.6" height="3.8" rx="0.8" fill={statusColor} fillOpacity="0.45" />
          </svg>
        </span>
        {dim && <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: SCRIM }} />}
      </div>
      {children}
      {project.footnote && (
        <div className="phone-foot" style={{ color: muted }}>
          <IconShield size={11} color={muted} /> {project.footnote}
        </div>
      )}
      <div className="phone-home" style={{ background: fg }} />
    </div>
  );
}

export function ScreenCanvas({
  project,
  screen,
  mode,
  wireframe,
  selectedBlockId,
  onSelect,
  measures,
  overlay,
  scale,
}: {
  project: Project;
  screen: Screen;
  mode: Mode;
  wireframe?: boolean;
  selectedBlockId?: string;
  onSelect?: (blockId: string | undefined) => void;
  measures?: boolean;
  overlay?: ReactNode;
  scale?: number;
}) {
  const bp = breakpointOf(screen.breakpoint);
  const maxW = contentWidth(screen);
  const pendingRequired = screen.blocks.some((x) => x.required && !x.value);
  const sheet = screen.presentation === 'sheet';
  const nodes = (
    <>
      {screen.blocks.map((b) => (
        <div
          key={b.id}
          data-block-id={b.id}
          className={`blk ${selectedBlockId === b.id ? 'selected' : ''}`}
          style={blockWrapperStyle(project, b, maxW)}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(b.id);
          }}
        >
          <BlockView project={project} block={withValues(b)} mode={mode} wireframe={wireframe} pendingRequired={b.type === 'button' && !!b.disableUntilValid && pendingRequired} />
          {measures && selectedBlockId === b.id && <Measure />}
        </div>
      ))}
      {!screen.blocks.length && <div className="screen-empty">Pantalla vacía. Agrega componentes desde el explorador.</div>}
    </>
  );
  return (
    <ScaledFrame width={bp.width} height={bp.height} scale={scale}>
      <PhoneChrome project={project} mode={mode} wireframe={wireframe} enabled={screen.breakpoint === 'mobile'} dim={sheet}>
        {sheet ? (
          <SheetLayout project={project} mode={mode} wireframe={wireframe} backdrop={sheetBackdrop(project, screen)} overlay={overlay} minHeight={bp.height - 90} onClick={() => onSelect?.(undefined)}>
            {nodes}
          </SheetLayout>
        ) : (
          <div className="screen" style={screenStyle(project, mode, wireframe)} onClick={() => onSelect?.(undefined)}>
            <div style={{ display: 'contents' }}>{nodes}</div>
            {overlay}
          </div>
        )}
      </PhoneChrome>
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
      setDims({ w: Math.round(host.offsetWidth), h: Math.round(host.offsetHeight), gap: prev ? Math.round(host.offsetTop - (prev.offsetTop + prev.offsetHeight)) : null });
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
