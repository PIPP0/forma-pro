import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import type { TokenGroup, Tokens } from '../lib/model';
import { TYPE_ROLES, TYPE_ROLE_LABEL } from '../lib/model';
import { isRef, parseRef, refOf, resolve } from '../lib/tokens';
import { notify } from '../lib/toast';

/** Campo que confirma al salir o con Enter: una operación por edición, no por tecla. */
export function CommitInput({
  value,
  onCommit,
  multiline,
  rows = 3,
  className = 'input',
  ...rest
}: { value: string; onCommit: (v: string) => void; multiline?: boolean; rows?: number } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  // Si el campo desaparece antes de perder el foco, el cambio no se pierde.
  const pending = useRef({ draft, value, onCommit });
  pending.current = { draft, value, onCommit };
  useEffect(
    () => () => {
      const { draft: d, value: v, onCommit: c } = pending.current;
      if (d !== v) c(d);
    },
    [],
  );
  if (multiline)
    return (
      <textarea
        className={className}
        value={draft}
        rows={rows}
        disabled={rest.disabled}
        placeholder={rest.placeholder}
        aria-label={rest['aria-label']}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
    );
  return (
    <input
      {...rest}
      className={className}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setDraft(value);
      }}
    />
  );
}

export function CommitNumber({
  value,
  onCommit,
  min = 0,
  label,
  disabled,
}: {
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  label: string;
  disabled?: boolean;
}) {
  return (
    <CommitInput
      type="number"
      className="input input-num"
      min={min}
      value={String(value)}
      aria-label={label}
      disabled={disabled}
      onCommit={(s) => {
        const n = Number(s);
        if (!Number.isFinite(n) || n < min) {
          notify(`Usa un número mayor o igual a ${min}.`, 'error');
          return;
        }
        onCommit(n);
      }}
    />
  );
}

export function ColorCell({ value, onCommit, disabled, label }: { value: string; onCommit: (v: string) => void; disabled?: boolean; label: string }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const full = /^#[0-9a-f]{3}$/i.test(draft) ? '#' + draft.slice(1).split('').map((c) => c + c).join('') : draft;
  return (
    <div className="color-cell">
      <input
        type="color"
        aria-label={label}
        value={/^#[0-9a-f]{6}$/i.test(full) ? full : '#000000'}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value.toUpperCase();
          setDraft(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onCommit(v), 350);
        }}
      />
      <CommitInput className="input input-code" value={value} disabled={disabled} aria-label={`${label}, hexadecimal`} onCommit={onCommit} />
    </div>
  );
}

const shortRef = (v?: string) => parseRef(v)?.name ?? v ?? '';

/** Selector de valor para una propiedad de estilo: token del sistema o valor suelto. */
export function ValuePicker({
  tokens,
  group,
  value,
  inherited,
  onChange,
  disabled,
  label,
}: {
  tokens: Tokens;
  group: TokenGroup;
  value?: string;
  inherited?: string;
  onChange: (v?: string) => void;
  disabled?: boolean;
  label: string;
}) {
  const raw = !!value && group !== 'type' && !isRef(value);
  const [rawMode, setRawMode] = useState(raw);
  useEffect(() => {
    if (value) setRawMode(raw);
  }, [value, raw]);

  const options =
    group === 'type'
      ? TYPE_ROLES.map((r) => ({ v: r, l: TYPE_ROLE_LABEL[r] }))
      : group === 'color'
        ? tokens.colors.map((c) => ({ v: refOf('color', c.name), l: c.name }))
        : tokens[group].map((s) => ({ v: refOf(group, s.name), l: `${s.name} (${s.value})` }));
  const known = !value || rawMode || options.some((o) => o.v === value);
  const swatch = group === 'color' ? resolve(value ?? inherited, tokens, 'light') : undefined;

  return (
    <div className="picker">
      <span className="picker-label">{label}</span>
      <div className="picker-row">
        {group === 'color' && <span className="swatch-dot" style={{ background: swatch ?? 'transparent' }} aria-hidden="true" />}
        <select
          aria-label={label}
          value={rawMode ? '__raw' : (value ?? '')}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '__raw') setRawMode(true);
            else {
              setRawMode(false);
              onChange(v || undefined);
            }
          }}
        >
          <option value="">{inherited ? `Hereda: ${group === 'type' ? TYPE_ROLE_LABEL[inherited as keyof typeof TYPE_ROLE_LABEL] ?? inherited : shortRef(inherited)}` : 'Sin valor'}</option>
          {!known && <option value={value}>{shortRef(value)} (no existe)</option>}
          {options.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
          {group !== 'type' && <option value="__raw">Valor suelto…</option>}
        </select>
        {rawMode && (
          <CommitInput
            className="input input-code picker-raw"
            value={raw ? value! : ''}
            placeholder={group === 'color' ? '#1646C8' : '12'}
            disabled={disabled}
            aria-label={`${label}, valor suelto`}
            onCommit={(v) => onChange(v.trim() || undefined)}
          />
        )}
      </div>
      {raw && <span className="picker-warn">Valor suelto: rompe el sistema</span>}
    </div>
  );
}
