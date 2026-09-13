import { useState, type CSSProperties } from 'react';
import type { Block, Mode, Project, StateName } from '../lib/model';
import { effectiveStyle, resolve, toCss } from '../lib/tokens';

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
  return digits ? `$${Number(digits).toLocaleString('es-CL')}` : '';
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
    borderRadius: bordered ? 4 : 0,
    outline: css.outline ? `2px dashed ${WIRE}` : 'none',
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

  const style = effectiveStyle(p, b, active);
  const bordered = ['input', 'amount', 'select', 'button', 'listItem', 'alert', 'image', 'navbar'].includes(b.type);
  let css = toCss(style, p.tokens, mode);
  if (!css.outline) css.outline = 'none';
  if (wireframe) css = wire(css, bordered);

  const labelCss: CSSProperties = wireframe
    ? { ...wire(toCss({ type: 'label' }, p.tokens, mode), false), display: 'block', marginBottom: 6 }
    : { ...toCss({ fg: '{color.onSurface}', type: 'label' }, p.tokens, mode), display: 'block', marginBottom: 6 };
  const noteCss: CSSProperties = wireframe
    ? { ...wire(toCss({ type: 'caption' }, p.tokens, mode), false), display: 'block' }
    : { ...toCss({ fg: '{color.muted}', type: 'caption' }, p.tokens, mode), display: 'block' };
  const errCss: CSSProperties = {
    ...toCss({ fg: '{color.danger}', type: 'caption' }, p.tokens, mode),
    display: 'block',
    marginTop: 6,
  };

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

  switch (b.type) {
    case 'navbar': {
      const { border, ...rest } = css;
      return (
        <div style={{ ...rest, display: 'flex', alignItems: 'center', gap: 8, minHeight: 28, borderBottom: border, borderRadius: 0 }}>
          {b.action === 'back' && (
            <button type="button" tabIndex={tab} aria-label="Volver" style={{ all: 'unset', cursor: 'pointer', fontSize: 24, lineHeight: 1, padding: '0 6px 2px 0' }} {...handlers}>
              ‹
            </button>
          )}
          <span>{b.label}</span>
        </div>
      );
    }
    case 'heading':
      return (
        <div role="heading" aria-level={b.variant === 'display' ? 1 : 2} style={{ ...css, margin: 0 }}>
          {b.label}
          {b.detail && <span style={{ ...noteCss, marginTop: 4 }}>{b.detail}</span>}
        </div>
      );
    case 'text':
      return <p style={{ ...css, margin: 0 }}>{b.label}</p>;
    case 'input':
    case 'amount': {
      const val = live ? (value ?? '') : (b.value ?? '');
      return (
        <label style={{ display: 'block' }}>
          <span style={labelCss}>
            {b.label}
            {b.required && <span aria-hidden="true"> *</span>}
          </span>
          <input
            style={{ ...css, width: '100%', boxSizing: 'border-box', display: 'block' }}
            placeholder={b.detail}
            value={val}
            readOnly={!live}
            tabIndex={tab}
            disabled={b.disabled}
            required={b.required}
            aria-invalid={!!error}
            inputMode={b.type === 'amount' ? 'numeric' : undefined}
            onChange={(e) => onValue?.(b.type === 'amount' ? formatAmount(e.target.value) : e.target.value)}
            {...handlers}
          />
          {error && (
            <span role="alert" style={errCss}>
              {error}
            </span>
          )}
        </label>
      );
    }
    case 'select':
      return (
        <label style={{ display: 'block' }}>
          <span style={labelCss}>
            {b.label}
            {b.required && <span aria-hidden="true"> *</span>}
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
          {error && (
            <span role="alert" style={errCss}>
              {error}
            </span>
          )}
        </label>
      );
    case 'checkbox': {
      const on = live ? !!checked : b.value === 'true';
      const primary = wireframe ? WIRE : (resolve('{color.primary}', p.tokens, mode) ?? '#1646C8');
      const border = wireframe ? WIRE : (resolve('{color.border}', p.tokens, mode) ?? '#999');
      return (
        <button
          type="button"
          role="checkbox"
          aria-checked={on}
          tabIndex={tab}
          disabled={b.disabled}
          style={{ ...css, display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: live ? 'pointer' : 'default' }}
          {...handlers}
        >
          <span
            aria-hidden="true"
            style={{
              width: 20,
              height: 20,
              flex: 'none',
              borderRadius: 5,
              border: `2px solid ${on ? primary : border}`,
              background: on ? primary : 'transparent',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 13,
            }}
          >
            {on ? '✓' : ''}
          </span>
          {b.label}
        </button>
      );
    }
    case 'button':
      return (
        <button type="button" tabIndex={tab} disabled={b.disabled} style={{ ...css, width: '100%', textAlign: 'center', cursor: live ? 'pointer' : 'default' }} {...handlers}>
          {b.label}
        </button>
      );
    case 'link':
      return (
        <button
          type="button"
          tabIndex={tab}
          disabled={b.disabled}
          style={{ ...css, background: 'none', border: 'none', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3, textAlign: 'left', alignSelf: 'flex-start', cursor: live ? 'pointer' : 'default' }}
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
          style={{ ...css, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textAlign: 'left', cursor: live ? 'pointer' : 'default' }}
          {...handlers}
        >
          <span>
            <span style={{ display: 'block' }}>{b.label}</span>
            {b.detail && <span style={noteCss}>{b.detail}</span>}
          </span>
          {b.action === 'navigate' && (
            <span aria-hidden="true" style={{ fontSize: 22, opacity: 0.6 }}>
              ›
            </span>
          )}
        </button>
      );
    case 'alert':
      return (
        <div role="status" style={css}>
          <span style={{ display: 'block' }}>{b.label}</span>
          {b.detail && <span style={{ ...noteCss, color: css.color, fontWeight: 400 }}>{b.detail}</span>}
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
            backgroundImage: wireframe ? `linear-gradient(to top right, transparent calc(50% - 1px), ${WIRE}, transparent calc(50% + 1px)), linear-gradient(to top left, transparent calc(50% - 1px), ${WIRE}, transparent calc(50% + 1px))` : undefined,
          }}
        >
          {!wireframe && b.label}
        </div>
      );
    case 'divider':
      return <hr style={{ border: 0, borderTop: wireframe ? `1.5px dashed ${WIRE}` : `1px solid ${resolve(style.border, p.tokens, mode) ?? '#ddd'}`, margin: 0 }} />;
  }
}
