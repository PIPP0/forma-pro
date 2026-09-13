import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Block, Mode, Project } from '../lib/model';
import { STYLE_KEYS, TYPE_ROLE_LABEL } from '../lib/model';
import { CATEGORIES, coverage, entryForComponent, sampleContent } from '../lib/catalog';
import { contrast, parseRef, resolve } from '../lib/tokens';
import { BlockView } from './BlockView';

const ratio = (n: number | null) => (n == null ? 'n/a' : `${String(n).replace('.', ',')}:1`);
const tokenName = (v: string) => {
  const r = parseRef(v);
  return r ? `${r.group}.${r.name}` : (TYPE_ROLE_LABEL[v as keyof typeof TYPE_ROLE_LABEL] ?? v);
};

/** Documentación imprimible del sistema. Se abre el diálogo de impresión para guardarla como PDF. */
export function SystemDoc({ p, onDone }: { p: Project; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    document.body.classList.add('printing');
    const after = () => done.current();
    window.addEventListener('afterprint', after);
    const timer = window.setTimeout(() => window.print(), 450);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', after);
      document.body.classList.remove('printing');
    };
  }, []);

  const cov = coverage(p);
  const bg = (m: Mode) => resolve('{color.background}', p.tokens, m) ?? '#FFFFFF';
  const date = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

  return createPortal(
    <div className="print-root">
      <article className="doc">
        <section className="doc-cover">
          <span className="doc-meta">Sistema de diseño · {date}</span>
          <h1>{p.brand} UI</h1>
          <p>
            Proyecto «{p.name}». {p.tokens.colors.length} colores semánticos, {p.components.length} componentes con cinco estados y {cov.covered} de {cov.total} patrones del catálogo.
          </p>
        </section>

        <h2>Color</h2>
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Modo claro</th>
              <th>Modo oscuro</th>
              <th>Contraste sobre fondo</th>
              <th>Uso</th>
            </tr>
          </thead>
          <tbody>
            {p.tokens.colors.map((c) => (
              <tr key={c.name}>
                <td>
                  <code>{c.name}</code>
                </td>
                <td>
                  <i className="doc-swatch" style={{ background: c.light }} />
                  {c.light}
                </td>
                <td>
                  <i className="doc-swatch" style={{ background: c.dark }} />
                  {c.dark}
                </td>
                <td>
                  {ratio(contrast(c.light, bg('light')))} y {ratio(contrast(c.dark, bg('dark')))}
                </td>
                <td>{c.description ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Tipografía</h2>
        <p className="doc-meta">Familia: {p.tokens.fontFamily}</p>
        <table>
          <thead>
            <tr>
              <th>Rol</th>
              <th>Tamaño e interlineado</th>
              <th>Peso</th>
              <th>Muestra</th>
            </tr>
          </thead>
          <tbody>
            {p.tokens.type.map((t) => (
              <tr key={t.role}>
                <td>{TYPE_ROLE_LABEL[t.role]}</td>
                <td>
                  {t.size}/{t.lineHeight} px
                </td>
                <td>{t.weight}</td>
                <td style={{ fontFamily: p.tokens.fontFamily, fontSize: Math.min(t.size, 26), lineHeight: `${Math.min(t.lineHeight, 32)}px`, fontWeight: t.weight }}>Información clara para decidir</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Espaciado y radios</h2>
        <div className="doc-two">
          <table>
            <thead>
              <tr>
                <th>Espaciado</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {p.tokens.space.map((s) => (
                <tr key={s.name}>
                  <td>
                    <code>space.{s.name}</code>
                  </td>
                  <td>
                    <i className="doc-bar" style={{ width: Math.min(s.value, 64) }} /> {s.value} px
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <table>
            <thead>
              <tr>
                <th>Radio</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {p.tokens.radius.map((s) => (
                <tr key={s.name}>
                  <td>
                    <code>radius.{s.name}</code>
                  </td>
                  <td>{s.value} px</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {CATEGORIES.map((cat) => {
          const items = p.components.filter((c) => entryForComponent(c).category === cat.id);
          if (!items.length) return null;
          return (
            <section key={cat.id} className="doc-section">
              <h2>{cat.label}</h2>
              {items.map((c) => {
                const e = entryForComponent(c);
                return (
                  <div key={c.id} className="doc-comp">
                    <div className="doc-preview" style={{ background: bg('light') }}>
                      <BlockView project={p} block={{ id: `doc-${c.id}`, type: c.type, componentId: c.id, ...sampleContent(c.type, c.variant, p.brand) } as Block} mode="light" />
                    </div>
                    <div>
                      <h3>{c.name}</h3>
                      <p>{e.summary}</p>
                      <p className="doc-meta">
                        <strong>Úsalo para:</strong> {e.use.join(' ')} <strong>Evítalo cuando:</strong> {e.avoid.join(' ')}
                      </p>
                      <p className="doc-meta">
                        <strong>Anatomía:</strong> {e.anatomy.join(', ')}. <strong>Accesibilidad:</strong> {e.a11y}
                      </p>
                      <p className="doc-meta">
                        <strong>Reposo:</strong>{' '}
                        {STYLE_KEYS.filter((k) => c.states.default[k.key])
                          .map((k) => `${k.label.toLowerCase()} ${tokenName(c.states.default[k.key]!)}`)
                          .join(', ')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </article>
    </div>,
    document.body,
  );
}
