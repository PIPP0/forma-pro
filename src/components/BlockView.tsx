import { useState, type CSSProperties } from 'react';
import type { Block, Mode, Project, StateName } from '../lib/model';
import { effectiveStyle, findComponent, resolve, toCss, typeToken } from '../lib/tokens';
import { BrandMark, IconArrowLeft, IconArrowUpRight, IconBell, IconCheck, IconChevronRight, IconInfo, IconTarget, IconWallet } from './icons';

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
}

export const formatAmount = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  return digits ? `$ ${Number(digits).toLocaleString('es-CL')}` : '';
};

const WIRE = '#7C868F';

function wire(css: CSSProperties, bordered: boolean): CSSProperties {
  return {
    fontFamily: css.fontFamily,
    fontSize: css.fontSize,
    lineHeight: css.lineHeight,
    fontWeight: css.fontWeight,
    padding: css.padding,
    color: '#3A424A',
    background: 'transparent',
    border: bordered ? `1.5px dashed ${WIRE}` : 'none',
    borderRadius: bordered ? (css.borderRadius ?? 4) : 0,
    outline: css.outline && css.outline !== 'none' ? `2px dashed ${WIRE}` : 'none',
    outlineOffset: 2,
  };
}

/** Un bloque renderizado con los tokens y estados del sistema. Es el mismo en el lienzo, el prototipo y el estudio. */
export function BlockView({ project: p, block: b, mode, wireframe, forceState, live, value, checked, error, onValue }: BlockViewProps) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focus, setFocus] = useState(false);

  const active: StateName[] = forceState
    ? [forceState]
    : b.disabled
      ? ['disabled']
      : [...(hover ? (['hover'] as const) : []), ...(focus ? (['focus'] as const) : []), ...(pressed ? (['pressed'] as const) : [])];

  const t = p.tokens;
  const style = effectiveStyle(p, b, active);
  const bordered = ['input', 'textarea', 'amount', 'select', 'button', 'listItem', 'alert', 'image', 'card', 'help', 'balance', 'tabs', 'tag', 'avatar', 'statusIcon'].includes(b.type);
  let css = toCss(style, t, mode);
  if (!css.outline) css.outline = 'none';
  if (wireframe) css = wire(css, bordered);

  const token = (ref: string, fallback: string) => (wireframe ? WIRE : (resolve(ref, t, mode) ?? fallback));
  const primary = token('{color.primary}', '#0074C8');
  const primaryPressed = token('{color.primaryPressed}', primary);
  const primarySubtle = wireframe ? 'transparent' : (resolve('{color.primarySubtle}', t, mode) ?? '#EAF3FB');
  const muted = token('{color.muted}', '#5F6773');
  const borderColor = token('{color.border}', '#D0D5DB');
  const danger = token('{color.danger}', '#C62828');
  const align: CSSProperties = b.align === 'center' ? { textAlign: 'center' } : {};

  const labelCss: CSSProperties = wireframe
    ? { ...wire(toCss({ type: 'label' }, t, mode), false), display: 'block', marginBottom: 6 }
    : { ...toCss({ fg: '{color.onSurface}', type: 'label' }, t, mode), display: 'block', marginBottom: 6 };
  const noteCss: CSSProperties = wireframe
    ? { ...wire(toCss({ type: 'caption' }, t, mode), false), display: 'block', fontWeight: 400 }
    : { ...toCss({ fg: '{color.muted}', type: 'caption' }, t, mode), display: 'block', fontWeight: 400 };
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
  const tab = live ? 0 : -1;
  const cursor = live ? 'pointer' : 'default';
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

  switch (b.type) {
    case 'navbar':
      return (
        <div style={{ display: 'grid', gap: 12, fontFamily: t.fontFamily }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: css.color }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BrandMark colors={[token('{color.danger}', '#C62828'), primary, token('{color.success}', '#1E8E5A')]} />
              <span style={{ fontWeight: 800, fontSize: Math.max(18, Number(css.fontSize) || 22), letterSpacing: '-0.045em', lineHeight: 1 }}>{b.label}</span>
              {b.detail && <span style={{ fontSize: 7, letterSpacing: '0.14em', color: muted, alignSelf: 'flex-end', marginBottom: 1 }}>{b.detail}</span>}
            </span>
            <IconBell size={17} color={muted} />
          </div>
          {b.action === 'back' && (
            <button
              type="button"
              tabIndex={tab}
              aria-label="Volver"
              style={{ all: 'unset', cursor, display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 12, color: primary, justifySelf: 'start', outline: css.outline }}
              {...handlers}
            >
              <IconArrowLeft size={13} color={primary} /> Volver
            </button>
          )}
        </div>
      );

    case 'heading':
      return (
        <div role="heading" aria-level={variant === 'display' ? 1 : 2} style={{ ...css, margin: 0, letterSpacing: '-0.015em', ...align }}>
          {b.label}
          {b.detail && <span style={{ ...noteCss, marginTop: 6, letterSpacing: 0 }}>{b.detail}</span>}
        </div>
      );

    case 'text':
      return <p style={{ ...css, margin: 0, ...align }}>{b.label}</p>;

    case 'balance': {
      const big = typeToken(t, style.type);
      return (
        <div
          style={{
            ...css,
            fontSize: 12,
            lineHeight: '16px',
            fontWeight: 500,
            backgroundImage: wireframe ? undefined : `linear-gradient(135deg, ${resolve(style.bg, t, mode) ?? primary} 0%, ${primaryPressed} 100%)`,
            display: 'grid',
            gap: 10,
          }}
        >
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{b.label}</span>
            <IconWallet size={16} color={String(css.color ?? '#fff')} />
          </span>
          <span style={{ fontSize: big.size, lineHeight: `${big.lineHeight}px`, fontWeight: big.weight, letterSpacing: '-0.02em' }}>{b.value || '$ 0'}</span>
          <span
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: `1px solid ${wireframe ? WIRE : 'rgba(255,255,255,0.28)'}`,
              paddingTop: 10,
              fontSize: 11,
            }}
          >
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
          <IconInfo size={16} color={primary} style={{ marginTop: 2 }} />
          <span>
            <span style={{ display: 'block' }}>{b.label}</span>
            {b.detail && <span style={{ ...noteCss, marginTop: 3 }}>{b.detail}</span>}
          </span>
        </div>
      );

    case 'card':
      return (
        <button
          type="button"
          tabIndex={tab}
          disabled={b.disabled}
          style={{ ...css, width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', cursor }}
          {...handlers}
        >
          <span
            aria-hidden="true"
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: primarySubtle,
              border: wireframe ? `1.5px dashed ${WIRE}` : 'none',
              display: 'grid',
              placeItems: 'center',
              flex: 'none',
            }}
          >
            <IconTarget size={20} color={primary} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block' }}>{b.label}</span>
            {b.detail && <span style={{ ...noteCss, marginTop: 3 }}>{b.detail}</span>}
          </span>
          {b.action === 'navigate' && <IconArrowUpRight size={14} color={muted} />}
        </button>
      );

    case 'input':
    case 'amount':
    case 'textarea': {
      const val = live ? (value ?? '') : (b.value ?? '');
      const fieldCss: CSSProperties = { ...css, width: '100%', boxSizing: 'border-box', display: 'block', resize: 'none' };
      const common = {
        style: fieldCss,
        placeholder: b.detail,
        readOnly: !live,
        tabIndex: tab,
        disabled: b.disabled,
        required: b.required,
        'aria-invalid': !!error,
        ...handlers,
      };
      return (
        <label style={{ display: 'block' }}>
          <span style={labelCss}>
            {b.label}
            {required}
          </span>
          {b.type === 'textarea' ? (
            <textarea rows={3} value={val} onChange={(e) => onValue?.(e.target.value)} {...common} />
          ) : (
            <input
              value={val}
              inputMode={b.type === 'amount' ? 'numeric' : undefined}
              onChange={(e) => onValue?.(b.type === 'amount' ? formatAmount(e.target.value) : e.target.value)}
              {...common}
            />
          )}
          {errorNode}
        </label>
      );
    }

    case 'select':
      return (
        <label style={{ display: 'block' }}>
          <span style={labelCss}>
            {b.label}
            {required}
          </span>
          <select
            style={{ ...css, width: '100%', boxSizing: 'border-box', display: 'block', appearance: 'auto' }}
            value={live ? (value ?? '') : (b.value ?? '')}
            disabled={b.disabled || !live}
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
      return (
        <div role="radiogroup" aria-label={b.label}>
          <span style={labelCss}>
            {b.label}
            {required}
          </span>
          <div style={{ display: 'grid', gap: 10 }}>
            {(b.options ?? []).map((o) => {
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
                  style={{ ...css, display: 'flex', gap: 10, alignItems: 'center', background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor }}
                  {...handlers}
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
        <div>
          <button
            type="button"
            role="checkbox"
            aria-checked={on}
            tabIndex={tab}
            disabled={b.disabled}
            style={{ ...css, display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor }}
            {...handlers}
          >
            <span
              aria-hidden="true"
              style={{ width: 20, height: 20, flex: 'none', borderRadius: 6, border: `2px solid ${on ? primary : borderColor}`, background: on ? primary : 'transparent', display: 'grid', placeItems: 'center' }}
            >
              {on && <IconCheck size={13} color="#fff" strokeWidth={3} />}
            </span>
            {b.label}
            {required}
          </button>
          {errorNode}
        </div>
      );
    }

    case 'switch': {
      const on = live ? !!checked : b.value === 'true';
      return (
        <div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            tabIndex={tab}
            disabled={b.disabled}
            style={{ ...css, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor }}
            {...handlers}
          >
            <span>
              {b.label}
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
      const surface = wireframe ? 'transparent' : (resolve('{color.surface}', t, mode) ?? '#fff');
      return (
        <div role="tablist" aria-label={b.label} style={{ ...css, display: 'flex', gap: 4 }}>
          {(b.options ?? []).map((o) => {
            const on = current === o;
            return (
              <button
                key={o}
                type="button"
                role="tab"
                aria-selected={on}
                data-option={o}
                tabIndex={tab}
                style={{
                  all: 'unset',
                  flex: 1,
                  textAlign: 'center',
                  padding: '8px 6px',
                  borderRadius: 9,
                  background: on ? surface : 'transparent',
                  boxShadow: on && !wireframe ? '0 1px 3px rgba(15,23,42,0.12)' : 'none',
                  border: on && wireframe ? `1.5px dashed ${WIRE}` : undefined,
                  cursor,
                  fontSize: css.fontSize,
                  fontWeight: css.fontWeight,
                  color: css.color,
                  fontFamily: css.fontFamily,
                }}
                {...handlers}
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
          style={{ ...css, width: '100%', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor }}
          {...handlers}
        >
          <span>{b.label}</span>
          {b.action === 'navigate' && variant !== 'secondary' && <IconChevronRight size={16} color={String(css.color ?? '#fff')} style={{ position: 'absolute', right: 14 }} />}
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
            background: 'none',
            border: 'none',
            padding: 0,
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            textAlign: b.align === 'center' ? 'center' : 'left',
            alignSelf: b.align === 'center' ? 'center' : 'flex-start',
            cursor,
          }}
          {...handlers}
        >
          {b.label}
        </button>
      );

    case 'listItem':
      return (
        <button
          type="button"
          tabIndex={tab}
          disabled={b.disabled}
          style={{ ...css, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textAlign: 'left', cursor }}
          {...handlers}
        >
          <span>
            <span style={{ display: 'block' }}>{b.label}</span>
            {b.detail && <span style={noteCss}>{b.detail}</span>}
          </span>
          {b.action === 'navigate' && <IconChevronRight size={16} color={muted} />}
        </button>
      );

    case 'tag':
      return <span style={{ ...css, display: 'inline-flex', width: 'fit-content', ...align }}>{b.label}</span>;

    case 'avatar': {
      const initials = b.label
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden="true" style={{ ...css, width: 40, height: 40, padding: 0, display: 'grid', placeItems: 'center', flex: 'none' }}>
            {initials}
          </span>
          <span>
            <span style={{ ...labelCss, marginBottom: 0 }}>{b.label}</span>
            {b.detail && <span style={noteCss}>{b.detail}</span>}
          </span>
        </div>
      );
    }

    case 'progress': {
      const pct = Math.max(0, Math.min(100, Number(b.value ?? 0) || 0));
      const fill = wireframe ? WIRE : (resolve(style.border, t, mode) ?? primary);
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
            <span style={{ ...labelCss, marginBottom: 0, fontSize: 12 }}>{b.label}</span>
            {b.detail && <span style={{ ...noteCss, display: 'inline', fontSize: 11 }}>{b.detail}</span>}
          </div>
          <div
            role="progressbar"
            aria-label={b.label}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ height: 8, borderRadius: css.borderRadius ?? 999, background: css.backgroundColor ?? 'transparent', border: wireframe ? `1.5px dashed ${WIRE}` : 'none', overflow: 'hidden' }}
          >
            <span style={{ display: 'block', height: '100%', width: `${Math.max(pct, 1.5)}%`, background: fill, borderRadius: 'inherit' }} />
          </div>
        </div>
      );
    }

    case 'statusIcon':
      return (
        <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 2px' }}>
          <span
            role="img"
            aria-label={b.label}
            style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              background: css.backgroundColor ?? 'transparent',
              border: wireframe ? `1.5px dashed ${WIRE}` : 'none',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <IconCheck size={36} color={String(css.color ?? '#1E8E5A')} strokeWidth={2.6} />
          </span>
        </div>
      );

    case 'alert':
      return (
        <div role="status" style={css}>
          <span style={{ display: 'block' }}>{b.label}</span>
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
            backgroundImage: wireframe
              ? `linear-gradient(to top right, transparent calc(50% - 1px), ${WIRE}, transparent calc(50% + 1px)), linear-gradient(to top left, transparent calc(50% - 1px), ${WIRE}, transparent calc(50% + 1px))`
              : undefined,
          }}
        >
          {!wireframe && b.label}
        </div>
      );

    case 'divider':
      return <hr style={{ border: 0, borderTop: wireframe ? `1.5px dashed ${WIRE}` : `1px solid ${resolve(style.border, t, mode) ?? '#ddd'}`, margin: 0 }} />;
  }
}
