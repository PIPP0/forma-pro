import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { dismiss, notify, useToasts } from '../lib/toast';

type Tone = 'primary' | 'default' | 'ghost' | 'danger';

export function Button({
  tone = 'default',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: 'sm' | 'md' }) {
  return <button type={type} className={`btn btn-${tone} btn-${size} ${className}`} {...rest} />;
}

export function Field({ label, hint, children, className = '' }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="modal-body">
          <header className="modal-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}>
              ×
            </button>
          </header>
          <div className="modal-content">{children}</div>
          {footer && <footer className="modal-foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  small,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: ReactNode }[];
  small?: boolean;
  label: string;
}) {
  return (
    <div className={small ? 'seg' : 'tabs'} role="tablist" aria-label={label}>
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" aria-selected={value === it.id} className={small ? 'seg-item' : 'tab'} onClick={() => onChange(it.id)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'ok' | 'warn' | 'err' | 'accent'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export async function copyText(text: string, what = 'Copiado al portapapeles.') {
  try {
    await navigator.clipboard.writeText(text);
    notify(what, 'success');
  } catch {
    notify('No se pudo copiar. Selecciona el texto y cópialo manualmente.', 'error');
  }
}

export function CopyButton({ text, label = 'Copiar', done }: { text: string; label?: string; done?: string }) {
  return (
    <Button size="sm" onClick={() => copyText(text, done)}>
      {label}
    </Button>
  );
}

export function Code({ code, label }: { code: string; label: string }) {
  return (
    <div className="code">
      <div className="code-head">
        <span>{label}</span>
        <CopyButton text={code} done={`Copiaste ${label}.`} />
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function pickFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? await f.text() : null);
    };
    input.click();
  });
}

export function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <span>{t.message}</span>
          <button type="button" className="icon-btn" aria-label="Cerrar aviso" onClick={() => dismiss(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export const timeAgo = (ts: number) => {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'hace un momento';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(ts).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
};
