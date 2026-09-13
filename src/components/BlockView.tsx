import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { loadFont } from '../lib/fonts';
import type { Block, Mode, Project, StateName, StyleProps } from '../lib/model';
import { effectiveStyle, findComponent, grayTokens, resolve, toCss, typeToken } from '../lib/tokens';
import { AppIcon, BrandMark, IconArrowLeft, IconArrowUpRight, IconBell, IconCheck, IconChevronRight, IconInfo, IconTarget, IconWallet } from './icons';

export interface BlockViewProps {
  project: Project;
  block: Block;
  mode: Mode;
  wireframe?: boolean;
  forceState?: StateName;
  live?: boolean;
  value?: string;
  checked?: boolean;
  error?: string;
  onValue?: (v: string) => void;
  /** Hay campos obligatorios sin completar: el botón se ve deshabilitado. */
  pendingRequired?: boolean;
}

export const formatAmount = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  return digits ? `$ ${Number(digits).toLocaleString('es-CL')}` : '';
};

/** Texto con **negritas** marcadas en la etiqueta. */
export function rich(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.length > 4 && part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} style={{ fontWeight: 700 }}>
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

const EMOJI: Record<string, string> = { money: '💵', rocket: '🚀', trophy: '🏆', deposit: '💰', chart: '📈', gift: '🎁', shield: '🛡️', card: '💳', piggy: '🐷' };

function Illustration({ name, size = 64, gray }: { name: string; size?: number; gray?: boolean }) {
  return (
    <span aria-hidden="true" style={{ fontSize: size, lineHeight: 1, flex: 'none', filter: gray ? 'grayscale(1)' : undefined }}>
      {EMOJI[name] ?? name}
    </span>
  );
}

const WIRE = '#7C868F';
const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };
const firstOther = (keys: string[], current?: string) => keys.find((k) => k !== current) ?? keys[0];

/** Un bloque renderizado con los tokens y estados del sistema. Es el mismo en el lienzo, el prototipo y el estudio. */
export function BlockView({ project: source, block: b, mode, wireframe: grayscale, forceState, live, value, checked, error, onValue, pendingRequired }: BlockViewProps) {
  // El wireframe es la misma pantalla en escala de grises, como en Forma Studio.
  const p = useMemo(() => (grayscale ? { ...source, tokens: grayTokens(source.tokens) } : source), [grayscale, source]);
  useEffect(() => loadFont(source.tokens.fontFamily), [source.tokens.fontFamily]);
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focus, setFocus] = useState(false);
  const [hotKey, setHotKey] = useState<string>();

  const active: StateName[] = forceState
    ? [forceState]
    : b.disabled || pendingRequired
      ? ['disabled']
      : [...(hover ? (['hover'] as const) : []), ...(focus ? (['focus'] as const) : []), ...(pressed ? (['pressed'] as const) : [])];

  const t = p.tokens;
  const style = effectiveStyle(p, b, active);
  const base = effectiveStyle(p, b, []);
  const css = toCss(style, t, mode);
  if (!css.outline) css.outline = 'none';
  const isDisabled = active.includes('disabled');
  // En los contenedores, deshabilitado cambia todo el componente; los demás estados, solo el elemento tocado.
  const baseCss = toCss(isDisabled ? style : base, t, mode);

  // Lo que el estado activo cambia respecto de reposo.
  const delta: StyleProps = {};
  for (const k of Object.keys(style) as (keyof StyleProps)[]) if (style[k] !== base[k]) delta[k] = style[k];
  const itemState = !isDisabled && active.some((s) => s !== 'default') && Object.keys(delta).length > 0;
  // Deshabilitado sin fondo propio: se atenúa todo el componente, igual en todos los patrones.
  const dim: CSSProperties = isDisabled && !delta.bg ? { opacity: 0.5 } : {};
  const stateFg = resolve(delta.fg, t, mode);

  /** Aplica el estado activo a un elemento: fondo, texto, borde como anillo y foco. */
  const withState = (s: CSSProperties, on: boolean, inset = false): CSSProperties => {
    if (!on) return s;
    const out: CSSProperties = { ...s };
    const bg = resolve(delta.bg, t, mode);
    const ring = resolve(delta.border, t, mode);
    const ol = resolve(delta.outline, t, mode);
    if (bg) {
      out.backgroundColor = bg;
      out.backgroundImage = 'none';
    }
    if (stateFg) out.color = stateFg;
    if (ring) out.boxShadow = [`inset 0 0 0 2px ${ring}`, s.boxShadow].filter(Boolean).join(', ');
    if (ol) {
      out.outline = `2px solid ${ol}`;
      out.outlineOffset = inset ? -3 : 2;
    }
    return out;
  };
  /** En contenedores, el estado se ve en el elemento tocado; en la vista del sistema, en el primero no seleccionado. */
  const isHot = (key: string, previewKey?: string) => itemState && (forceState ? key === previewKey : key === hotKey);

  const token = (ref: string, fallback: string) => resolve(ref, t, mode) ?? fallback;
  const primary = token('{color.primary}', '#1A66CC');
  const primaryPressed = token('{color.primaryPressed}', primary);
  const primarySubtle = token('{color.primarySubtle}', '#EAF3FB');
  const muted = token('{color.muted}', '#5F6773');
  const onSurfaceColor = token('{color.onSurface}', '#1B1F24');
  const borderColor = token('{color.border}', '#D0D5DB');
  const danger = token('{color.danger}', '#C62828');
  const successColor = token('{color.success}', '#1E8E5A');
  const warningColor = token('{color.warning}', '#C96A12');
  const starColor = token('{color.star}', '#F5C518');
  const shadow = '0 2px 14px rgba(24, 58, 110, 0.08)';
  const pad = css.padding ?? '16px 16px';
  const padY = resolve(style.padY, t, mode) ?? '16px';
  const padX = resolve(style.padX, t, mode) ?? '16px';
  const align: CSSProperties = b.align === 'center' ? { textAlign: 'center' } : {};

  const labelCss: CSSProperties = { ...toCss({ fg: '{color.onSurface}', type: 'label' }, t, mode), display: 'block', marginBottom: 6 };
  const noteCss: CSSProperties = { ...toCss({ fg: '{color.muted}', type: 'caption' }, t, mode), display: 'block', fontWeight: 400 };
  const errCss: CSSProperties = { ...toCss({ fg: '{color.danger}', type: 'caption' }, t, mode), display: 'block', marginTop: 6 };

  const interactive = live && !b.disabled;
  const handlers = interactive
    ? {
        onMouseEnter: () => setHover(true),
        onMouseLeave: () => {
          setHover(false);
          setPressed(false);
        },
        onPointerDown: () => setPressed(true),
        onPointerUp: () => setPressed(false),
        onFocus: () => setFocus(true),
        onBlur: () => setFocus(false),
      }
    : {};
  const itemHandlers = (key: string) =>
    interactive
      ? {
          onMouseEnter: () => {
            setHover(true);
            setHotKey(key);
          },
          onMouseLeave: () => {
            setHover(false);
            setPressed(false);
            setHotKey(undefined);
          },
          onPointerDown: () => {
            setPressed(true);
            setHotKey(key);
          },
          onPointerUp: () => setPressed(false),
          onFocus: () => {
            setFocus(true);
            setHotKey(key);
          },
          onBlur: () => {
            setFocus(false);
            setHotKey(undefined);
          },
        }
      : {};
  const tab = live ? 0 : -1;
  const cursor = live ? 'pointer' : 'default';
  const unset: CSSProperties = { all: 'unset', boxSizing: 'border-box', cursor, fontFamily: t.fontFamily };
  const required = b.required && (
    <span aria-hidden="true" style={{ color: danger }}>
      {' '}
      *
    </span>
  );
  const errorNode = error && (
    <span role="alert" style={errCss}>
      {error}
    </span>
  );
  const variant = findComponent(p, b.componentId)?.variant ?? b.variant;
  const split = (o: string) => o.split('|').map((x) => x.trim());

  switch (b.type) {
    case 'navbar': {
      const color = String(baseCss.color ?? onSurfaceColor);
      const iconButton = (key: string, preview: string, extra: CSSProperties = {}) =>
        withState({ ...unset, lineHeight: 0, padding: 6, margin: -6, borderRadius: 12, color, ...extra }, isHot(key, preview), true);
      const iconColor = (key: string, preview: string) => (isHot(key, preview) && stateFg ? stateFg : color);
      if (variant === 'app')
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', color, padding: '4px 0', fontFamily: t.fontFamily, ...dim }}>
            <button type="button" data-option="menu" aria-label="Menú" tabIndex={tab} style={iconButton('menu', 'menu', { justifySelf: 'start' })} {...itemHandlers('menu')}>
              <AppIcon name="menu" size={30} color={iconColor('menu', 'menu')} />
            </button>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BrandMark colors={[danger, starColor, primary, successColor]} />
              <span style={{ fontWeight: 800, fontSize: 26, letterSpacing: '-0.03em', lineHeight: 1 }}>{b.label}</span>
            </span>
            <span style={{ justifySelf: 'end', display: 'flex', gap: 16 }}>
              <button type="button" data-option="qr" aria-label="Pago con QR" tabIndex={tab} style={iconButton('qr', 'menu')} {...itemHandlers('qr')}>
                <AppIcon name="qr" size={28} color={iconColor('qr', 'menu')} />
              </button>
              <button type="button" data-option="bell" aria-label="Notificaciones" tabIndex={tab} style={iconButton('bell', 'menu')} {...itemHandlers('bell')}>
                <AppIcon name="bell" size={28} color={iconColor('bell', 'menu')} />
              </button>
            </span>
          </div>
        );
      if (variant === 'title') {
        const preview = b.action === 'back' ? 'back' : 'right';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, color, padding: '6px 0', fontFamily: t.fontFamily, ...dim }}>
            {b.action === 'back' && (
              <button type="button" aria-label="Volver" tabIndex={tab} style={iconButton('back', preview)} {...itemHandlers('back')}>
                <AppIcon name="back" size={28} color={iconColor('back', preview)} />
              </button>
            )}
            <span style={{ flex: 1, fontSize: baseCss.fontSize, fontWeight: baseCss.fontWeight, lineHeight: baseCss.lineHeight }}>{b.label}</span>
            {b.value && (
              <button type="button" data-option="right" aria-label={b.detail || 'Opción'} tabIndex={tab} style={iconButton('right', preview)} {...itemHandlers('right')}>
                <AppIcon name={b.value} size={26} color={iconColor('right', preview)} />
              </button>
            )}
          </div>
        );
      }
      if (variant === 'close')
        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color, padding: '6px 0', fontFamily: t.fontFamily, ...dim }}>
            <span style={{ fontSize: baseCss.fontSize, fontWeight: baseCss.fontWeight }}>{b.label}</span>
            <button type="button" aria-label="Cerrar" tabIndex={tab} style={iconButton('close', 'close')} {...itemHandlers('close')}>
              <AppIcon name="close" size={28} color={iconColor('close', 'close')} />
            </button>
          </div>
        );
      return (
        <div style={{ display: 'grid', gap: 12, fontFamily: t.fontFamily, ...dim }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: baseCss.color }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BrandMark colors={[danger, primary, successColor]} />
              <span style={{ fontWeight: 800, fontSize: Math.max(18, Number(baseCss.fontSize) || 22), letterSpacing: '-0.045em', lineHeight: 1 }}>{b.label}</span>
              {b.detail && <span style={{ fontSize: 7, letterSpacing: '0.14em', color: muted, alignSelf: 'flex-end', marginBottom: 1 }}>{b.detail}</span>}
            </span>
            <IconBell size={17} color={muted} />
          </div>
          {b.action === 'back' && (
            <button
              type="button"
              tabIndex={tab}
              aria-label="Volver"
              style={withState({ ...unset, display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 12, color: primary, justifySelf: 'start', padding: '4px 8px', margin: '-4px -8px', borderRadius: 8 }, isHot('back', 'back'), true)}
              {...itemHandlers('back')}
            >
              <IconArrowLeft size={13} color={isHot('back', 'back') && stateFg ? stateFg : primary} /> Volver
            </button>
          )}
        </div>
      );
    }

    case 'heading':
      return (
        <div role="heading" aria-level={variant === 'display' ? 1 : 2} style={{ ...css, margin: 0, letterSpacing: '-0.015em', ...align }}>
          {rich(b.label)}
          {b.detail && <span style={{ ...noteCss, marginTop: 6, letterSpacing: 0 }}>{b.detail}</span>}
        </div>
      );

    case 'text':
      return <p style={{ ...css, margin: 0, ...align }}>{rich(b.label)}</p>;

    case 'balance': {
      const big = typeToken(t, style.type);
      return (
        <div
          style={{
            ...css,
            fontSize: 12,
            lineHeight: '16px',
            fontWeight: 500,
            backgroundImage: grayscale ? undefined : `linear-gradient(135deg, ${resolve(style.bg, t, mode) ?? primary} 0%, ${primaryPressed} 100%)`,
            display: 'grid',
            gap: 10,
          }}
        >
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{b.label}</span>
            <IconWallet size={16} color={String(css.color ?? '#fff')} />
          </span>
          <span style={{ fontSize: big.size, lineHeight: `${big.lineHeight}px`, fontWeight: big.weight, letterSpacing: '-0.02em' }}>{b.value || '$ 0'}</span>
          <span style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.28)', paddingTop: 10, fontSize: 11 }}>
            <span>{b.detail}</span>
            {b.options?.[0] && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                {b.options[0]} <IconChevronRight size={12} color={String(css.color ?? '#fff')} />
              </span>
            )}
          </span>
        </div>
      );
    }

    case 'help':
      return (
        <div style={{ ...css, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <IconInfo size={18} color={primary} style={{ marginTop: 2 }} />
          <span>
            <span style={{ display: 'block' }}>{rich(b.label)}</span>
            {b.detail && <span style={{ ...noteCss, marginTop: 3 }}>{b.detail}</span>}
          </span>
        </div>
      );

    case 'card':
      return (
        <button type="button" tabIndex={tab} disabled={b.disabled} style={{ ...css, ...dim, width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', cursor }} {...handlers}>
          <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: '50%', background: primarySubtle, display: 'grid', placeItems: 'center', flex: 'none' }}>
            <IconTarget size={20} color={primary} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block' }}>{rich(b.label)}</span>
            {b.detail && <span style={{ ...noteCss, marginTop: 3 }}>{b.detail}</span>}
          </span>
          {b.action === 'navigate' && <IconArrowUpRight size={14} color={muted} />}
        </button>
      );

    case 'input':
    case 'amount':
    case 'textarea': {
      const val = live ? (value ?? '') : (b.value ?? '');
      if (b.type === 'input' && variant === 'search')
        return (
          <label style={{ ...css, ...dim, display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box', position: 'relative' }}>
            <span style={srOnly}>{b.label}</span>
            <AppIcon name="search" size={24} color={muted} />
            <input
              value={val}
              placeholder={b.detail}
              readOnly={!live}
              tabIndex={tab}
              onChange={(e) => onValue?.(e.target.value)}
              style={{ all: 'unset', flex: 1, minWidth: 0, fontSize: css.fontSize, lineHeight: css.lineHeight, color: css.color, fontFamily: t.fontFamily }}
              {...handlers}
            />
          </label>
        );
      const fieldCss: CSSProperties = { ...css, ...dim, width: '100%', boxSizing: 'border-box', display: 'block', resize: 'none' };
      const common = { style: fieldCss, placeholder: b.detail, readOnly: !live, tabIndex: tab, disabled: b.disabled, required: b.required, 'aria-invalid': !!error, ...handlers };
      return (
        <label style={{ display: 'block' }}>
          <span style={labelCss}>
            {rich(b.label)}
            {required}
          </span>
          {b.type === 'textarea' ? (
            <textarea rows={3} value={val} onChange={(e) => onValue?.(e.target.value)} {...common} />
          ) : (
            <input value={val} inputMode={b.type === 'amount' ? 'numeric' : undefined} onChange={(e) => onValue?.(b.type === 'amount' ? formatAmount(e.target.value) : e.target.value)} {...common} />
          )}
          {errorNode}
        </label>
      );
    }

    case 'select':
      return (
        <label style={{ display: 'block' }}>
          <span style={labelCss}>
            {rich(b.label)}
            {required}
          </span>
          <select
            style={{ ...css, ...dim, width: '100%', boxSizing: 'border-box', display: 'block', appearance: 'auto', pointerEvents: live ? undefined : 'none' }}
            value={live ? (value ?? '') : (b.value ?? '')}
            disabled={b.disabled}
            tabIndex={tab}
            aria-invalid={!!error}
            onChange={(e) => onValue?.(e.target.value)}
            {...handlers}
          >
            <option value="">{b.detail || 'Selecciona una opción'}</option>
            {(b.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {errorNode}
        </label>
      );

    case 'radio': {
      const current = live ? value : b.value;
      const options = b.options ?? [];
      const preview = firstOther(options, current);
      if (variant === 'numbers')
        return (
          <div role="radiogroup" aria-label={b.label} style={dim}>
            <div style={{ display: 'flex', gap: 26, overflowX: 'auto', padding: '4px 2px 8px', scrollbarWidth: 'none' }}>
              {options.map((o) => {
                const on = current === o;
                return (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${o} cuotas`}
                    data-option={o}
                    tabIndex={tab}
                    style={withState(
                      { ...unset, fontSize: baseCss.fontSize, fontWeight: 600, color: on ? primary : baseCss.color, borderBottom: `3px solid ${on ? primary : 'transparent'}`, padding: '0 6px 4px', borderRadius: 6, flex: 'none' },
                      isHot(o, preview),
                      true,
                    )}
                    {...itemHandlers(o)}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
            {errorNode}
          </div>
        );
      return (
        <div role="radiogroup" aria-label={b.label} style={dim}>
          <span style={labelCss}>
            {rich(b.label)}
            {required}
          </span>
          <div style={{ display: 'grid', gap: 4 }}>
            {options.map((o) => {
              const on = current === o;
              return (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-option={o}
                  tabIndex={tab}
                  disabled={b.disabled}
                  style={withState(
                    { ...baseCss, display: 'flex', gap: 10, alignItems: 'center', background: 'transparent', border: 'none', padding: '6px 8px', margin: '0 -8px', width: 'calc(100% + 16px)', borderRadius: 10, textAlign: 'left', cursor },
                    isHot(o, preview),
                    true,
                  )}
                  {...itemHandlers(o)}
                >
                  <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${on ? primary : borderColor}`, display: 'grid', placeItems: 'center', flex: 'none' }}>
                    {on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: primary }} />}
                  </span>
                  {o}
                </button>
              );
            })}
          </div>
          {errorNode}
        </div>
      );
    }

    case 'checkbox': {
      const on = live ? !!checked : b.value === 'true';
      return (
        <div style={dim}>
          <button
            type="button"
            role="checkbox"
            aria-checked={on}
            tabIndex={tab}
            disabled={b.disabled}
            style={withState(
              { ...baseCss, display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', padding: '8px 10px', margin: '0 -10px', width: 'calc(100% + 20px)', borderRadius: 10, textAlign: 'left', cursor },
              itemState,
              true,
            )}
            {...handlers}
          >
            <span aria-hidden="true" style={{ width: 20, height: 20, flex: 'none', borderRadius: 6, border: `2px solid ${on ? primary : borderColor}`, background: on ? primary : 'transparent', display: 'grid', placeItems: 'center' }}>
              {on && <IconCheck size={13} color="#fff" strokeWidth={3} />}
            </span>
            {rich(b.label)}
            {required}
          </button>
          {errorNode}
        </div>
      );
    }

    case 'switch': {
      const on = live ? !!checked : b.value === 'true';
      return (
        <div style={dim}>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            tabIndex={tab}
            disabled={b.disabled}
            style={withState(
              { ...baseCss, width: 'calc(100% + 20px)', margin: '0 -10px', padding: '8px 10px', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', textAlign: 'left', cursor },
              itemState,
              true,
            )}
            {...handlers}
          >
            <span>
              {rich(b.label)}
              {required}
            </span>
            <span aria-hidden="true" style={{ width: 42, height: 24, borderRadius: 12, background: on ? primary : borderColor, position: 'relative', flex: 'none', transition: 'background 0.15s' }}>
              <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.25)', transition: 'left 0.15s' }} />
            </span>
          </button>
          {errorNode}
        </div>
      );
    }

    case 'tabs': {
      const current = live ? (value ?? b.value) : b.value;
      const options = b.options ?? [];
      const preview = firstOther(options, current);
      if (variant === 'underline')
        return (
          <div role="tablist" aria-label={b.label} style={{ display: 'flex', backgroundColor: baseCss.backgroundColor, borderBottom: `1px solid ${borderColor}`, fontFamily: t.fontFamily, ...dim }}>
            {options.map((o) => {
              const on = current === o;
              return (
                <button
                  key={o}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  data-option={o}
                  tabIndex={tab}
                  style={withState(
                    {
                      ...unset,
                      flex: 1,
                      textAlign: 'center',
                      padding: '14px 4px 11px',
                      color: on ? primary : baseCss.color,
                      fontSize: baseCss.fontSize,
                      borderBottom: `3px solid ${on ? (resolve(base.border, t, mode) ?? primary) : 'transparent'}`,
                      marginBottom: -1,
                      borderRadius: '8px 8px 0 0',
                    },
                    isHot(o, preview),
                    true,
                  )}
                  {...itemHandlers(o)}
                >
                  {o}
                </button>
              );
            })}
          </div>
        );
      const surface = resolve('{color.surface}', t, mode) ?? '#fff';
      return (
        <div role="tablist" aria-label={b.label} style={{ ...baseCss, display: 'flex', gap: 4, ...dim }}>
          {options.map((o) => {
            const on = current === o;
            return (
              <button
                key={o}
                type="button"
                role="tab"
                aria-selected={on}
                data-option={o}
                tabIndex={tab}
                style={withState(
                  {
                    ...unset,
                    flex: 1,
                    textAlign: 'center',
                    padding: '8px 6px',
                    borderRadius: 9,
                    backgroundColor: on ? surface : 'transparent',
                    boxShadow: on ? '0 1px 3px rgba(15,23,42,0.12)' : 'none',
                    fontSize: baseCss.fontSize,
                    fontWeight: baseCss.fontWeight,
                    color: baseCss.color,
                  },
                  isHot(o, preview),
                  true,
                )}
                {...itemHandlers(o)}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }

    case 'button':
      return (
        <button
          type="button"
          tabIndex={tab}
          disabled={b.disabled}
          aria-disabled={pendingRequired || undefined}
          style={{ ...css, ...dim, border: css.border ?? 'none', width: '100%', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor }}
          {...handlers}
        >
          <span>{b.label}</span>
          {b.action === 'navigate' && variant !== 'secondary' && variant !== 'success' && !pendingRequired && (
            <IconChevronRight size={16} color={String(css.color ?? '#fff')} style={{ position: 'absolute', right: 14 }} />
          )}
        </button>
      );

    case 'link':
      return (
        <button
          type="button"
          tabIndex={tab}
          disabled={b.disabled}
          style={{
            ...css,
            ...dim,
            backgroundColor: css.backgroundColor ?? 'transparent',
            border: 'none',
            padding: '2px 6px',
            margin: '-2px -6px',
            borderRadius: 6,
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            textAlign: b.align === 'center' ? 'center' : 'left',
            alignSelf: b.align === 'center' ? 'center' : 'flex-start',
            cursor,
          }}
          {...handlers}
        >
          {rich(b.label)}
        </button>
      );

    case 'listItem': {
      if (variant === 'contact') {
        const lines = (b.detail ?? '').split('\n').filter(Boolean);
        return (
          <button
            type="button"
            tabIndex={tab}
            disabled={b.disabled}
            style={withState(
              { ...unset, width: 'calc(100% + 16px)', margin: '0 -8px', display: 'flex', gap: 12, padding: `${padY} 8px`, borderRadius: 10, borderBottom: `1px solid ${borderColor}`, color: baseCss.color, ...dim },
              itemState,
              true,
            )}
            {...handlers}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: baseCss.fontSize, lineHeight: baseCss.lineHeight }}>{rich(b.label)}</span>
              {lines.map((l, i) => (
                <span key={i} style={{ ...noteCss, fontSize: 15, marginTop: 6 }}>
                  {l}
                </span>
              ))}
            </span>
            <AppIcon name="more" size={24} color={itemState && stateFg ? stateFg : onSurfaceColor} />
          </button>
        );
      }
      if (variant === 'notification' || variant === 'logout') {
        const row = withState(
          { ...unset, width: '100%', display: 'flex', gap: 14, alignItems: variant === 'logout' ? 'center' : 'flex-start', padding: pad, backgroundColor: baseCss.backgroundColor, borderBottom: variant === 'notification' ? `1px solid ${borderColor}` : undefined, color: baseCss.color, ...dim },
          itemState,
          true,
        );
        if (variant === 'logout')
          return (
            <button type="button" tabIndex={tab} style={row} {...handlers}>
              <AppIcon name="power" size={28} color={danger} />
              <span style={{ flex: 1, fontSize: baseCss.fontSize }}>{rich(b.label)}</span>
              {b.detail && <span style={{ ...noteCss, fontSize: 15, display: 'inline' }}>{b.detail}</span>}
            </button>
          );
        return (
          <button type="button" tabIndex={tab} style={row} {...handlers}>
            <AppIcon name="doc" size={26} color={muted} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 15, lineHeight: 1.45 }}>{rich(b.label)}</span>
              {b.detail && <span style={{ ...noteCss, fontSize: 14, marginTop: 8 }}>{b.detail}</span>}
            </span>
            {b.value !== 'read' && <span role="img" aria-label="Sin leer" style={{ width: 14, height: 14, borderRadius: '50%', background: primary, flex: 'none', marginTop: 4 }} />}
          </button>
        );
      }
      if (variant === 'profile' || variant === 'icon')
        return (
          <button type="button" tabIndex={tab} disabled={b.disabled} style={{ ...css, ...dim, border: css.border ?? 'none', boxShadow: shadow, width: '100%', display: 'flex', gap: 14, alignItems: 'center', textAlign: 'left', cursor }} {...handlers}>
            {variant === 'profile' ? (
              <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" style={{ flex: 'none' }}>
                <circle cx="15" cy="15" r="15" fill={starColor} />
                <circle cx="15" cy="12" r="4.5" fill="#595959" />
                <path d="M6.5 25c1.5-4.3 4.7-6.3 8.5-6.3s7 2 8.5 6.3" fill="#595959" />
              </svg>
            ) : (
              <AppIcon name={b.value || 'info'} size={28} color={successColor} />
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block' }}>{rich(b.label)}</span>
              {b.detail && <span style={{ ...noteCss, fontSize: 15, marginTop: 6 }}>{b.detail}</span>}
            </span>
            <IconChevronRight size={20} color={muted} />
          </button>
        );
      return (
        <button type="button" tabIndex={tab} disabled={b.disabled} style={{ ...css, ...dim, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textAlign: 'left', cursor }} {...handlers}>
          <span>
            <span style={{ display: 'block' }}>{rich(b.label)}</span>
            {b.detail && <span style={noteCss}>{b.detail}</span>}
          </span>
          {b.action === 'navigate' && <IconChevronRight size={16} color={muted} />}
        </button>
      );
    }

    case 'menuList': {
      const plain = variant === 'plain';
      const info = variant === 'info';
      const rows = (b.options ?? []).map(split);
      const hasHead = !plain && !!(b.label || b.detail);
      const hero = !!b.value;
      const preview = rows[0]?.[0];
      return (
        <div style={{ backgroundColor: baseCss.backgroundColor, color: baseCss.color, borderRadius: baseCss.borderRadius, boxShadow: plain ? 'none' : shadow, overflow: 'hidden', fontFamily: t.fontFamily, ...dim }}>
          {hasHead && (
            <div style={{ padding: hero ? `${padY} ${padX} 28px` : `${padY} ${padX} ${rows.length ? '4px' : padY}`, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {b.label && <div style={{ fontSize: hero ? 28 : 20, lineHeight: 1.3, fontWeight: hero ? 400 : 600 }}>{rich(b.label)}</div>}
                {b.detail && <div style={{ ...noteCss, fontSize: 16, lineHeight: 1.5, marginTop: 12 }}>{rich(b.detail)}</div>}
              </div>
              {hero && <Illustration name={b.value!} gray={grayscale} />}
            </div>
          )}
          {rows.map(([title, sub, icon], i) => {
            const hot = isHot(title, preview);
            return (
              <button
                key={`${title}-${i}`}
                type="button"
                data-option={title}
                tabIndex={tab}
                style={withState(
                  { ...unset, width: '100%', display: 'flex', alignItems: 'flex-start', gap: 14, padding: `${padY} ${padX}`, borderTop: i > 0 || hasHead ? `1px solid ${borderColor}` : 'none', borderBottom: plain ? `1px solid ${borderColor}` : undefined, color: baseCss.color },
                  hot,
                  true,
                )}
                {...itemHandlers(title)}
              >
                {icon && <AppIcon name={icon} size={plain ? 28 : 24} color={hot && stateFg ? stateFg : plain ? onSurfaceColor : muted} style={{ marginTop: 1 }} />}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: baseCss.fontSize, lineHeight: baseCss.lineHeight, fontWeight: plain ? 600 : 400 }}>{rich(title)}</span>
                  {sub && <span style={{ ...noteCss, fontSize: 15, marginTop: 6 }}>{sub}</span>}
                </span>
                {!info && <IconChevronRight size={20} color={hot && stateFg ? stateFg : muted} style={{ marginTop: 2 }} />}
              </button>
            );
          })}
        </div>
      );
    }

    case 'accountCard': {
      const rows = (b.options ?? []).map(split);
      const big = typeToken(t, style.type);
      const summary = variant === 'summary';
      return (
        <div
          style={withState({ backgroundColor: baseCss.backgroundColor, color: baseCss.color, borderRadius: baseCss.borderRadius, boxShadow: shadow, fontFamily: t.fontFamily, overflow: 'hidden', ...dim }, itemState, true)}
          {...handlers}
        >
          <div style={{ padding: `${padY} ${padX} 14px` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.3 }}>{rich(b.label)}</span>
              {!summary && <AppIcon name="more" size={24} color={muted} />}
            </div>
            {summary && b.detail && <div style={{ fontSize: 15, marginTop: 16, fontWeight: 500 }}>{b.detail}</div>}
            <div style={{ fontSize: big.size, lineHeight: `${big.lineHeight}px`, fontWeight: big.weight, margin: summary ? '6px 0 2px' : '20px 0 6px', letterSpacing: '-0.01em' }}>{b.value}</div>
            {!summary && b.detail && <div style={{ ...noteCss, fontSize: 15 }}>{b.detail}</div>}
          </div>
          {rows.map(([label, val, sub, trend], i) => (
            <div key={i} style={{ margin: `0 ${padX}`, padding: '16px 0', borderTop: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <span>
                <span style={{ display: 'block', fontSize: 16 }}>{label}</span>
                {sub && <span style={{ ...noteCss, fontSize: 14, marginTop: 4 }}>{sub}</span>}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, color: trend === 'up' ? successColor : undefined, whiteSpace: 'nowrap' }}>
                {val}
                {(trend === 'in' || trend === 'out') && <AppIcon name={trend === 'in' ? 'trendIn' : 'trendUp'} size={20} strokeWidth={2} color={trend === 'in' ? successColor : warningColor} />}
              </span>
            </div>
          ))}
          {b.linkLabel && <div style={{ margin: `0 ${padX}`, padding: '16px 0 18px', borderTop: `1px solid ${borderColor}`, color: primary, fontWeight: 600, fontSize: 16 }}>{b.linkLabel}</div>}
        </div>
      );
    }

    case 'creditCard': {
      const cols = (b.options ?? []).map(split);
      const end = token('{color.cardDarkEnd}', '#111113');
      return (
        <div
          style={withState(
            {
              borderRadius: baseCss.borderRadius,
              color: baseCss.color,
              backgroundColor: baseCss.backgroundColor,
              backgroundImage: grayscale ? undefined : `linear-gradient(165deg, ${baseCss.backgroundColor} 0%, ${end} 100%)`,
              padding: pad,
              fontFamily: t.fontFamily,
              display: 'grid',
              gap: 22,
              boxShadow: shadow,
              ...dim,
            },
            itemState,
            true,
          )}
          {...handlers}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>
              <span style={{ display: 'block', fontSize: 18, fontWeight: 600 }}>{b.label}</span>
              {b.detail && <span style={{ display: 'block', fontSize: 14, opacity: 0.85, marginTop: 4 }}>{b.detail}</span>}
            </span>
            {b.value && <span style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1 }}>{b.value}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(cols.length, 1)}, 1fr)` }}>
            {cols.map(([label, main, second], i) => (
              <div key={i} style={{ padding: i ? '0 0 0 18px' : '0 18px 0 0', borderLeft: i ? '1px solid rgba(255,255,255,0.35)' : 'none' }}>
                <span style={{ display: 'block', fontSize: 14, opacity: 0.9 }}>{label}</span>
                <span style={{ display: 'block', fontSize: 22, fontWeight: 600, marginTop: 6 }}>{main}</span>
                {second && <span style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>{second}</span>}
              </div>
            ))}
          </div>
          {b.linkLabel && <span style={{ justifySelf: 'end', border: '1.5px solid currentColor', borderRadius: 999, padding: '7px 20px', fontSize: 15 }}>{b.linkLabel}</span>}
        </div>
      );
    }

    case 'carousel': {
      const items = (b.options ?? []).map(split);
      const keyOf = (parts: string[]) => (variant === 'contacts' || variant === 'feature' ? parts[1] : parts[1]) ?? parts[0];
      const preview = items[0] ? keyOf(items[0]) : undefined;
      const card = (key: string, extra: CSSProperties): CSSProperties =>
        withState({ ...unset, flex: 'none', backgroundColor: baseCss.backgroundColor, color: baseCss.color, borderRadius: baseCss.borderRadius, boxShadow: shadow, ...extra }, isHot(key, preview), true);
      const dots = variant !== 'contacts' && items.length > 1;
      return (
        <div style={dim}>
          <div role="list" aria-label={b.label} style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '2px 2px 10px', scrollbarWidth: 'none' }}>
            {items.map((parts, i) => {
              if (variant === 'contacts') {
                const [ini, name, sub] = parts;
                return (
                  <button key={i} role="listitem" type="button" data-option={name} tabIndex={tab} style={card(name, { width: 172, padding: '18px 12px', display: 'grid', justifyItems: 'center', gap: 4, textAlign: 'center' })} {...itemHandlers(name)}>
                    <span aria-hidden="true" style={{ width: 50, height: 50, borderRadius: '50%', border: '1.5px solid currentColor', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 17, marginBottom: 6 }}>
                      {ini}
                    </span>
                    <span style={{ fontSize: 16, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    {sub && <span style={{ ...noteCss, fontSize: 15 }}>{sub}</span>}
                  </button>
                );
              }
              if (variant === 'feature') {
                const [emoji, title, desc, link] = parts;
                return (
                  <button key={i} role="listitem" type="button" data-option={title} tabIndex={tab} style={card(title, { width: '88%', display: 'grid' })} {...itemHandlers(title)}>
                    <span style={{ display: 'flex', gap: 12, padding: `${padY} ${padX}` }}>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 26, lineHeight: 1.25 }}>{rich(title)}</span>
                        {desc && <span style={{ ...noteCss, fontSize: 16, marginTop: 12, lineHeight: 1.5 }}>{desc}</span>}
                      </span>
                      <Illustration name={emoji} size={56} gray={grayscale} />
                    </span>
                    {link && <span style={{ borderTop: `1px solid ${borderColor}`, padding: `${padY} ${padX}`, color: primary, fontWeight: 600, fontSize: 16 }}>{link}</span>}
                  </button>
                );
              }
              const [emoji, text] = parts;
              return (
                <button key={i} role="listitem" type="button" data-option={text} tabIndex={tab} style={card(text, { width: 182, minHeight: 220, padding: `${padY} ${padX}`, display: 'grid', alignContent: 'start', gap: 18 })} {...itemHandlers(text)}>
                  <Illustration name={emoji} size={48} gray={grayscale} />
                  <span style={{ fontSize: 18, lineHeight: 1.35 }}>{rich(text)}</span>
                </button>
              );
            })}
          </div>
          {dots && (
            <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6 }}>
              {items.map((_, i) => (
                <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? primary : borderColor }} />
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'financeCard': {
      const metrics = (b.options ?? []).map(split);
      return (
        <div
          style={withState({ backgroundColor: baseCss.backgroundColor, color: baseCss.color, borderRadius: baseCss.borderRadius, boxShadow: shadow, fontFamily: t.fontFamily, overflow: 'hidden', ...dim }, itemState, true)}
          {...handlers}
        >
          <div style={{ padding: `${padY} ${padX}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>
                <span style={{ display: 'block', fontSize: 19, fontWeight: 600 }}>{b.label}</span>
                {b.detail && <span style={{ ...noteCss, fontSize: 16, marginTop: 4 }}>{b.detail}</span>}
              </span>
              {b.value === 'donut' && (
                <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                  <circle cx="32" cy="32" r="26" fill="none" stroke={primary} strokeWidth="10" strokeDasharray="150 14" transform="rotate(-80 32 32)" />
                  <path d="M26 38l12-12M31 26h7v7" stroke={onSurfaceColor} strokeWidth="1.6" fill="none" />
                </svg>
              )}
              {b.value === 'bars' && (
                <svg width="66" height="52" viewBox="0 0 66 52" aria-hidden="true">
                  <rect x="10" y="4" width="6" height="40" fill={successColor} opacity="0.3" />
                  <rect x="18" y="4" width="6" height="40" fill={warningColor} opacity="0.3" />
                  <rect x="42" y="34" width="6" height="10" fill={successColor} />
                  <rect x="50" y="37" width="6" height="7" fill={warningColor} />
                  <path d="M4 44h60" stroke={borderColor} />
                </svg>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(metrics.length, 1)}, 1fr)`, gap: 12, marginTop: 26 }}>
              {metrics.map(([label, val, trend], i) => (
                <span key={i} style={{ textAlign: i === metrics.length - 1 && metrics.length > 1 ? 'right' : 'left' }}>
                  <span style={{ ...noteCss, fontSize: 15 }}>{label}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 20, fontWeight: 700, marginTop: 6, whiteSpace: 'nowrap' }}>
                    {val}
                    {trend && <AppIcon name={trend === 'in' ? 'trendIn' : 'trendUp'} size={20} strokeWidth={2} color={trend === 'in' ? successColor : warningColor} />}
                  </span>
                </span>
              ))}
            </div>
          </div>
          {b.linkLabel && <div style={{ borderTop: `1px solid ${borderColor}`, padding: `${padY} ${padX}`, color: primary, fontWeight: 600, fontSize: 16 }}>{b.linkLabel}</div>}
        </div>
      );
    }

    case 'rating': {
      const current = Number((live ? value : b.value) ?? 0) || 0;
      const star = resolve(base.border, t, mode) ?? starColor;
      const preview = String(current > 0 && current < 5 ? current + 1 : 1);
      return (
        <div role="radiogroup" aria-label={plainTextOf(b.label)} style={dim}>
          <span style={{ display: 'block', margin: '0 0 14px', fontSize: baseCss.fontSize, lineHeight: baseCss.lineHeight, fontWeight: 400, color: baseCss.color, fontFamily: t.fontFamily }}>
            {rich(b.label)}
            {required}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={current === n}
                aria-label={`${n} de 5`}
                data-option={String(n)}
                tabIndex={tab}
                style={withState({ ...unset, lineHeight: 0, padding: 4, borderRadius: 12 }, isHot(String(n), preview), true)}
                {...itemHandlers(String(n))}
              >
                <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z" fill={n <= current ? star : 'none'} stroke={star} strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
          {errorNode}
        </div>
      );
    }

    case 'iconGrid': {
      const items = (b.options ?? []).map(split);
      const current = live ? (value ?? b.value) : b.value;
      const preview = firstOther(
        items.map((i) => i[0]),
        current,
      );
      return (
        <div
          style={{
            // Sin tarjeta el fondo es transparente, salvo deshabilitado: así ese estado también se distingue.
            backgroundColor: variant === 'flat' && !isDisabled ? 'transparent' : baseCss.backgroundColor,
            borderRadius: baseCss.borderRadius,
            boxShadow: variant === 'flat' ? 'none' : shadow,
            padding: variant === 'flat' ? `${padY} 0` : pad,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            rowGap: 18,
            columnGap: 6,
            fontFamily: t.fontFamily,
            ...dim,
          }}
        >
          {items.map(([label, icon]) => {
            const on = current === label;
            const hot = isHot(label, preview);
            const color = hot && stateFg ? stateFg : on ? primary : String(baseCss.color ?? muted);
            return (
              <button
                key={label}
                type="button"
                data-option={label}
                tabIndex={tab}
                style={withState({ ...unset, display: 'grid', justifyItems: 'center', gap: 8, color: on ? primary : baseCss.color, fontSize: 15, textAlign: 'center', padding: '8px 2px', borderRadius: 12 }, hot, true)}
                {...itemHandlers(label)}
              >
                <AppIcon name={icon} size={34} color={color} />
                {label}
              </button>
            );
          })}
        </div>
      );
    }

    case 'tabBar': {
      const opts = (b.options ?? []).map(split);
      const current = live ? (value ?? b.value) : b.value;
      const preview = firstOther(
        opts.filter((o) => o[1] !== 'plus').map((o) => o[0]),
        current,
      );
      return (
        <nav
          aria-label={b.label || 'Navegación principal'}
          style={{ backgroundColor: baseCss.backgroundColor, borderTop: baseCss.border, display: 'grid', gridTemplateColumns: `repeat(${Math.max(opts.length, 1)}, 1fr)`, alignItems: 'center', padding: '8px 6px 10px', gap: 2, fontFamily: t.fontFamily, ...dim }}
        >
          {opts.map(([label, icon]) => {
            const on = current === label;
            const hot = isHot(label, preview);
            const color = hot && stateFg ? stateFg : on ? primary : String(baseCss.color ?? muted);
            return (
              <button
                key={label}
                type="button"
                data-option={label}
                tabIndex={tab}
                aria-current={on ? 'page' : undefined}
                aria-label={label}
                style={withState({ ...unset, display: 'grid', justifyItems: 'center', gap: 5, color: on ? primary : baseCss.color, fontSize: 14, lineHeight: '18px', padding: '4px 0', borderRadius: 12 }, hot, true)}
                {...itemHandlers(label)}
              >
                {icon === 'plus' ? (
                  <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: '50%', border: `1.5px solid ${onSurfaceColor}`, display: 'grid', placeItems: 'center' }}>
                    <AppIcon name="plus" size={24} color={onSurfaceColor} />
                  </span>
                ) : (
                  <>
                    <AppIcon name={icon || 'info'} size={28} color={color} />
                    <span>{label}</span>
                  </>
                )}
              </button>
            );
          })}
        </nav>
      );
    }

    case 'tag':
      return <span style={{ ...css, display: 'inline-flex', width: 'fit-content', ...align }}>{rich(b.label)}</span>;

    case 'avatar': {
      const initials = b.label
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span aria-hidden="true" style={{ ...css, width: 64, height: 64, padding: 0, display: 'grid', placeItems: 'center', flex: 'none', fontSize: 22 }}>
            {initials}
          </span>
          <span>
            <span style={{ ...labelCss, marginBottom: 0, fontSize: 19 }}>{b.label}</span>
            {b.detail && <span style={noteCss}>{b.detail}</span>}
          </span>
        </div>
      );
    }

    case 'progress': {
      const pct = Math.max(0, Math.min(100, Number(b.value ?? 0) || 0));
      const fill = resolve(style.border, t, mode) ?? primary;
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
            <span style={{ ...labelCss, marginBottom: 0, fontSize: 12 }}>{b.label}</span>
            {b.detail && <span style={{ ...noteCss, display: 'inline', fontSize: 11 }}>{b.detail}</span>}
          </div>
          <div role="progressbar" aria-label={b.label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ height: 8, borderRadius: css.borderRadius ?? 999, background: css.backgroundColor ?? 'transparent', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${Math.max(pct, 1.5)}%`, background: fill, borderRadius: 'inherit' }} />
          </div>
        </div>
      );
    }

    case 'statusIcon':
      return (
        <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 2px' }}>
          <span role="img" aria-label={b.label} style={{ width: 76, height: 76, borderRadius: '50%', background: css.backgroundColor ?? 'transparent', display: 'grid', placeItems: 'center' }}>
            <IconCheck size={36} color={String(css.color ?? '#1E8E5A')} strokeWidth={2.6} />
          </span>
        </div>
      );

    case 'alert':
      return (
        <div role="status" style={css}>
          <span style={{ display: 'block' }}>{rich(b.label)}</span>
          {b.detail && <span style={{ ...noteCss, color: css.color }}>{b.detail}</span>}
        </div>
      );

    case 'image':
      return (
        <div
          role="img"
          aria-label={b.label}
          style={{
            ...css,
            aspectRatio: '16 / 9',
            display: 'grid',
            placeItems: 'center',
            backgroundImage: grayscale ? `linear-gradient(to top right, transparent calc(50% - 1px), ${WIRE}, transparent calc(50% + 1px))` : undefined,
          }}
        >
          {b.label}
        </div>
      );

    case 'divider':
      return <hr style={{ border: 0, borderTop: `1px solid ${resolve(style.border, t, mode) ?? '#ddd'}`, margin: 0 }} />;
  }
}

const plainTextOf = (s: string) => s.replace(/\*\*/g, '');
