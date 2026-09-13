import { useState } from 'react';
import type { Mode, Project, Role } from '../lib/model';
import { BREAKPOINTS, STYLE_KEYS, TYPE_ROLE_LABEL, baseId, blockMeta } from '../lib/model';
import { componentCss, componentHtml, componentReact, cssRef, effectiveStyle, exportCss, exportJs, exportStyleDictionary, findComponent, parseRef, resolve, typeToken } from '../lib/tokens';
import { download } from '../lib/share';
import { exportDtcg, exportTailwind } from '../lib/systemIO';
import { ScreenCanvas } from '../components/ScreenCanvas';
import { Badge, Button, Code, Empty, Field, Tabs } from '../components/ui';

type Tab = 'inspect' | 'tokens' | 'components';

export function HandoffView({ project }: { project: Project; role: Role }) {
  const [tab, setTab] = useState<Tab>('inspect');
  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Entrega a desarrollo</h1>
          <p className="page-sub">Medidas reales, el token correcto para cada propiedad y código de referencia. Sin capturas ni mensajes sueltos.</p>
        </div>
      </div>
      <Tabs
        label="Secciones de entrega"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'inspect', label: 'Inspección' },
          { id: 'tokens', label: 'Tokens' },
          { id: 'components', label: 'Componentes' },
        ]}
      />
      {tab === 'inspect' && <Inspect p={project} />}
      {tab === 'tokens' && <TokenExports p={project} />}
      {tab === 'components' && <ComponentExports p={project} />}
    </div>
  );
}

function Inspect({ p }: { p: Project }) {
  const [screenId, setScreenId] = useState(p.startScreenId);
  const [blockId, setBlockId] = useState<string>();
  const [mode, setMode] = useState<Mode>('light');
  const screen = p.screens.find((s) => s.id === screenId) ?? p.screens[0];
  if (!screen) return <Empty title="No hay pantallas que inspeccionar" />;
  const block = screen.blocks.find((b) => b.id === blockId);
  const group = p.screens.filter((s) => baseId(s) === baseId(screen));

  return (
    <div className="inspect">
      <div className="inspect-canvas mat-lite">
        <div className="row">
          <Field label="Pantalla">
            <select
              value={baseId(screen)}
              onChange={(e) => {
                setScreenId(e.target.value);
                setBlockId(undefined);
              }}
            >
              {p.screens
                .filter((s) => !s.variantOf)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
          {group.length > 1 && (
            <Tabs
              small
              label="Dispositivo"
              value={screen.id}
              onChange={(id) => {
                setScreenId(id);
                setBlockId(undefined);
              }}
              items={group.map((s) => ({ id: s.id, label: BREAKPOINTS.find((b) => b.id === s.breakpoint)!.label }))}
            />
          )}
          <Tabs
            small
            label="Modo"
            value={mode}
            onChange={setMode}
            items={[
              { id: 'light', label: 'Claro' },
              { id: 'dark', label: 'Oscuro' },
            ]}
          />
        </div>
        <p className="muted small">Toca un bloque para ver sus medidas y tokens.</p>
        <ScreenCanvas project={p} screen={screen} mode={mode} selectedBlockId={blockId} onSelect={setBlockId} measures />
      </div>

      <div className="inspect-panel">
        {!block ? (
          <Empty title="Selecciona un bloque">Verás su tamaño real, la distancia con el bloque anterior, cada token con su valor en ambos modos y el código de referencia.</Empty>
        ) : (
          <BlockSpec p={p} blockId={block.id} screenId={screen.id} />
        )}
      </div>
    </div>
  );
}

function BlockSpec({ p, screenId, blockId }: { p: Project; screenId: string; blockId: string }) {
  const screen = p.screens.find((s) => s.id === screenId)!;
  const block = screen.blocks.find((b) => b.id === blockId)!;
  const comp = findComponent(p, block.componentId);
  const style = effectiveStyle(p, block, ['default']);
  const tt = typeToken(p.tokens, style.type);
  // Mismos valores que aplica screenStyle: separación space.lg y margen lateral space.lg + 4.
  const gap = p.tokens.space.find((s) => s.name === 'lg');
  const pad = p.tokens.space.find((s) => s.name === 'lg');
  const cls = comp ? componentCss(comp) : null;
  const inlineCss = [
    `/* ${block.label || blockMeta(block.type).label} */`,
    ...STYLE_KEYS.filter((k) => style[k.key] && k.key !== 'type').map((k) => `${k.label}: ${cssRef(style[k.key])};`),
    style.type ? `font: var(--type-${style.type}-weight) var(--type-${style.type}-size)/var(--type-${style.type}-line-height) var(--font-family);` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="stack">
      <div className="row between">
        <h2 className="section-title">{block.label || blockMeta(block.type).label}</h2>
        {comp ? <Badge tone="accent">{comp.name}</Badge> : <Badge tone="warn">Bloque suelto</Badge>}
      </div>
      <p className="muted small">
        El rótulo sobre el bloque muestra ancho × alto reales en px. La separación vertical entre bloques es el token <code>space.lg</code> ({gap?.value ?? 16}px) y el margen lateral de pantalla es <code>space.lg</code> + 4 ({(pad?.value ?? 16) + 4}px).
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Propiedad</th>
              <th>Token</th>
              <th>Claro</th>
              <th>Oscuro</th>
            </tr>
          </thead>
          <tbody>
            {STYLE_KEYS.filter((k) => style[k.key]).map((k) => {
              const v = style[k.key]!;
              const overridden = !!block.overrides?.[k.key];
              if (k.key === 'type')
                return (
                  <tr key={k.key}>
                    <td>{k.label}</td>
                    <td>
                      <code>type.{v}</code> <span className="muted">{TYPE_ROLE_LABEL[tt.role]}</span>
                    </td>
                    <td colSpan={2}>
                      {tt.size}px / {tt.lineHeight}px, peso {tt.weight}
                    </td>
                  </tr>
                );
              const ref = parseRef(v);
              return (
                <tr key={k.key}>
                  <td>
                    {k.label} {overridden && <Badge tone="warn">Sobrescrito</Badge>}
                  </td>
                  <td>{ref ? <code>{`${ref.group}.${ref.name}`}</code> : <Badge tone="warn">Valor suelto</Badge>}</td>
                  <td>
                    <SpecValue v={resolve(v, p.tokens, 'light')} />
                  </td>
                  <td>
                    <SpecValue v={resolve(v, p.tokens, 'dark')} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {block.action === 'navigate' && block.target && (
        <p className="small">
          Al tocar navega a «{p.screens.find((s) => s.id === block.target)?.name ?? 'pantalla eliminada'}».
        </p>
      )}
      {cls ? <Code label={`CSS de ${comp!.name} con sus estados`} code={cls} /> : <Code label="CSS de referencia" code={inlineCss} />}
      {comp && <Code label="React de referencia" code={componentReact(comp)} />}
      {comp && <Code label="HTML de referencia" code={componentHtml(comp, block.label)} />}
    </div>
  );
}

function SpecValue({ v }: { v?: string }) {
  if (!v) return <span className="muted">n/a</span>;
  return (
    <span className="spec-value">
      {v.startsWith('#') && <span className="swatch-dot" style={{ background: v }} aria-hidden="true" />}
      <code>{v}</code>
    </span>
  );
}

function TokenExports({ p }: { p: Project }) {
  const [format, setFormat] = useState<'css' | 'js' | 'sd' | 'dtcg' | 'tailwind'>('css');
  const out =
    format === 'css'
      ? exportCss(p.tokens)
      : format === 'js'
        ? exportJs(p.tokens)
        : format === 'dtcg'
          ? exportDtcg(p.tokens)
          : format === 'tailwind'
            ? exportTailwind(p.tokens)
            : exportStyleDictionary(p.tokens);
  const file = { css: 'tokens.css', js: 'tokens.js', sd: 'tokens.json', dtcg: 'tokens.dtcg.json', tailwind: 'tailwind.config.js' }[format];
  return (
    <section className="section stack">
      <div className="row between">
        <Tabs
          small
          label="Formato"
          value={format}
          onChange={setFormat}
          items={[
            { id: 'css', label: 'CSS' },
            { id: 'js', label: 'JavaScript' },
            { id: 'tailwind', label: 'Tailwind' },
            { id: 'dtcg', label: 'Figma (W3C)' },
            { id: 'sd', label: 'Style Dictionary' },
          ]}
        />
        <Button size="sm" onClick={() => download(file, out, format === 'sd' || format === 'dtcg' ? 'application/json' : format === 'css' ? 'text/css' : 'text/javascript')}>
          Descargar {file}
        </Button>
      </div>
      <Code label={file} code={out} />
    </section>
  );
}

function ComponentExports({ p }: { p: Project }) {
  if (!p.components.length) return <Empty title="Sin componentes">Crea componentes en Sistema para exportarlos.</Empty>;
  const all = p.components.map((c) => componentCss(c)).join('\n\n');
  return (
    <section className="section stack">
      <div className="row between">
        <p className="muted">Clases con estados hover, presionado, deshabilitado y foco, usando las variables de tokens.</p>
        <Button size="sm" onClick={() => download('componentes.css', `${exportCss(p.tokens)}\n\n${all}\n`, 'text/css')}>
          Descargar componentes.css
        </Button>
      </div>
      {p.components.map((c) => (
        <details key={c.id} className="comp-export">
          <summary>
            <strong>{c.name}</strong> <span className="muted">{blockMeta(c.type).label}</span>
          </summary>
          <div className="stack">
            <Code label="CSS" code={componentCss(c)} />
            <Code label="React" code={componentReact(c)} />
            <Code label="HTML" code={componentHtml(c)} />
          </div>
        </details>
      ))}
    </section>
  );
}
