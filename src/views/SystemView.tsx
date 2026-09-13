import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Mode, OpInput, Project, Role, StyleKey } from '../lib/model';
import { STATES, STYLE_KEYS, TYPE_ROLE_LABEL, blockMeta } from '../lib/model';
import { applyOps, releasesFor, useDb } from '../lib/store';
import { can } from '../lib/permissions';
import { download } from '../lib/share';
import { FONT_INTER } from '../lib/seed';
import { IconCheck, IconChevronDown, IconDiamond, IconDownload, IconUpload } from '../components/icons';
import { edit, renameTokenOps } from '../lib/ops';
import { colorValue, contrast, exportCss, exportStyleDictionary, isRaw, parseRef, refOf, resolve } from '../lib/tokens';
import { checkProject } from '../lib/flowCheck';
import { adoption, tokenUses } from '../lib/metrics';
import { notify } from '../lib/toast';
import { href } from '../lib/router';
import { categoryOf, componentSummary, coverage, entryForComponent, projectCategories } from '../lib/catalog';
import { exportDtcg, exportSystemJson, exportTailwind } from '../lib/systemIO';
import { ColorCell, CommitInput, CommitNumber } from '../components/inputs';
import { Badge, Button, CopyButton, Field, PageHead, Tabs } from '../components/ui';
import { ComponentStudio } from '../components/ComponentStudio';
import { ImportSystemModal } from '../components/ImportSystemModal';
import { SystemDoc } from '../components/SystemDoc';

type Tab = 'foundations' | 'components' | 'docs';

const validName = (n: string) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(n);
const ratio = (n: number | null) => (n == null ? 'n/a' : `${String(n).replace('.', ',')}:1`);

const COLOR_LABEL: Record<string, string> = {
  primary: 'Primario',
  primaryHover: 'Primario hover',
  primaryPressed: 'Primario presionado',
  primarySubtle: 'Primario suave',
  onPrimary: 'Texto sobre primario',
  secondary: 'Secundario',
  background: 'Fondo',
  surface: 'Superficie',
  subtle: 'Superficie sutil',
  onSurface: 'Texto',
  muted: 'Texto secundario',
  border: 'Borde',
  focus: 'Foco',
  success: 'Éxito',
  successSubtle: 'Éxito suave',
  warning: 'Advertencia',
  danger: 'Error',
  dangerSubtle: 'Error suave',
  star: 'Calificación',
  cardDark: 'Tarjeta oscura',
  cardDarkEnd: 'Tarjeta oscura, degradado',
  onDark: 'Texto sobre oscuro',
};
const colorLabel = (name: string) => COLOR_LABEL[name] ?? name;

const FONTS = [
  { label: 'Inter', value: FONT_INTER },
  { label: 'Sistema', value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { label: 'Serif', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Monoespaciada', value: "'JetBrains Mono', ui-monospace, monospace" },
];

export function SystemView({ project, role }: { project: Project; role: Role }) {
  const db = useDb();
  const [tab, setTab] = useState<Tab>('foundations');
  const [mode, setMode] = useState<Mode>('light');
  const [importOpen, setImportOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const editable = can(role, 'edit');
  const libVersion = project.library?.version ?? releasesFor(db, project.id)[0]?.version;
  const cov = coverage(project);
  const fileSlug = project.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

  return (
    <div className="page page-wide">
      <PageHead
        eyebrow="BIBLIOTECA DEL PROYECTO"
        title="Un sistema completo. Una sola fuente de verdad."
        sub="Fundamentos, tokens, componentes, estados e interacciones compartidos. Importa el sistema de tu equipo o expórtalo para desarrollo, Figma y documentación."
        actions={
          <>
            <ExportMenu p={project} slug={fileSlug} onPrint={() => setPrinting(true)} />
            {editable && (
              <Button tone="primary" onClick={() => setImportOpen(true)}>
                <IconUpload size={17} /> Importar sistema
              </Button>
            )}
          </>
        }
      />
      <ImportSystemModal p={project} open={importOpen} onClose={() => setImportOpen(false)} />
      {printing && <SystemDoc p={project} onDone={() => setPrinting(false)} />}

      <section className="card lib-hero">
        <span className="icon-tile lg">
          <IconDiamond size={30} />
        </span>
        <div className="lib-hero-text">
          <h2>
            {project.brand} UI <span className="pill">{libVersion ? `v${libVersion}` : 'sin publicar'}</span>
          </h2>
          <p>
            Sistema de diseño del proyecto «{project.name}». {project.footnote ? 'Sistema de exploración con datos ficticios.' : 'Cada cambio se refleja al instante en pantallas y prototipos.'}
          </p>
        </div>
        <ul className="lib-checks">
          <li>
            <IconCheck size={15} /> {project.tokens.colors.length} tokens semánticos
          </li>
          <li>
            <IconCheck size={15} /> {project.components.length} componentes
          </li>
          <li>
            <IconCheck size={15} /> {cov.covered} de {cov.total} patrones del catálogo
          </li>
          <li>
            <IconCheck size={15} /> {STATES.length} estados interactivos
          </li>
        </ul>
      </section>

      {!editable && <p className="notice">Tu rol es de lectura: puedes revisar el sistema, pero no modificarlo.</p>}

      <div className="system-tabs">
        <Tabs
          small
          label="Secciones del sistema"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'foundations', label: 'Fundamentos' },
            { id: 'components', label: 'Componentes' },
            { id: 'docs', label: 'Documentación' },
          ]}
        />
        <Tabs
          small
          label="Modo de vista previa"
          value={mode}
          onChange={setMode}
          items={[
            { id: 'light', label: 'Claro' },
            { id: 'dark', label: 'Oscuro' },
          ]}
        />
      </div>

      {tab === 'foundations' && <FoundationsTab p={project} editable={editable} mode={mode} onImport={() => setImportOpen(true)} />}
      {tab === 'components' && (
        <section className="card system-panel">
          <ComponentStudio p={project} editable={editable} mode={mode} />
        </section>
      )}
      {tab === 'docs' && <DocsTab p={project} editable={editable} />}
    </div>
  );
}

function ExportMenu({ p, slug, onPrint }: { p: Project; slug: string; onPrint: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const items = [
    { label: 'Sistema completo', note: 'JSON de Forma con tokens y componentes. Se importa tal cual en otro proyecto.', run: () => download(`${slug}-sistema.json`, exportSystemJson(p)) },
    { label: 'Tokens para Figma', note: 'W3C Design Tokens, compatible con Tokens Studio y Style Dictionary 4.', run: () => download(`${slug}-tokens.dtcg.json`, exportDtcg(p.tokens)) },
    { label: 'Variables CSS', note: 'Modo claro y oscuro con [data-theme="dark"].', run: () => download(`${slug}-tokens.css`, exportCss(p.tokens), 'text/css') },
    { label: 'Tailwind', note: 'tailwind.config.js conectado a las variables CSS.', run: () => download('tailwind.config.js', exportTailwind(p.tokens), 'text/javascript') },
    { label: 'Style Dictionary', note: 'Formato clásico con value y comment.', run: () => download(`${slug}-tokens.json`, exportStyleDictionary(p.tokens)) },
    { label: 'Documentación en PDF', note: 'Colores, tipografía y cada componente con su guía. Elige «Guardar como PDF».', run: onPrint },
  ];

  return (
    <div className="export-menu" ref={ref}>
      <Button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <IconDownload size={17} /> Exportar <IconChevronDown size={14} />
      </Button>
      {open && (
        <div className="menu" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.run();
              }}
            >
              <strong>{it.label}</strong>
              <span>{it.note}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CardHead({ n, title, hint }: { n: string; title: string; hint?: string }) {
  return (
    <div className="found-head">
      <h2>
        <span className="found-num">{n}</span> {title}
      </h2>
      {hint && <span className="found-hint">{hint}</span>}
    </div>
  );
}

function SwatchTile({ name, value, mode, editable, onCommit }: { name: string; value: string; mode: Mode; editable: boolean; onCommit: (v: string) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const full = /^#[0-9a-f]{6}$/i.test(draft) ? draft : '#000000';
  return (
    <div className="swatch-tile">
      <label className="swatch-color" style={{ background: draft }}>
        <input
          type="color"
          value={full}
          disabled={!editable}
          aria-label={`${colorLabel(name)}, modo ${mode === 'light' ? 'claro' : 'oscuro'}`}
          onChange={(e) => {
            const v = e.target.value.toUpperCase();
            setDraft(v);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => onCommit(v), 400);
          }}
        />
      </label>
      <strong>{colorLabel(name)}</strong>
      <code>{draft}</code>
    </div>
  );
}

function TokenSlider({ label, value, min, max, disabled, onCommit }: { label: string; value: number; min: number; max: number; disabled: boolean; onCommit: (n: number) => void }) {
  const [v, setV] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => setV(value), [value]);
  return (
    <label className="slider">
      <span className="slider-head">
        <span>{label}</span>
        <strong>{v}px</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={v}
        disabled={disabled}
        style={{ '--pct': `${((v - min) / (max - min)) * 100}%` } as CSSProperties}
        onChange={(e) => {
          const n = Number(e.target.value);
          setV(n);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onCommit(n), 400);
        }}
      />
    </label>
  );
}

function FoundationsTab({ p, editable, mode, onImport }: { p: Project; editable: boolean; mode: Mode; onImport: () => void }) {
  const t = p.tokens;
  const display = t.type.find((x) => x.role === 'display');
  const body = t.type.find((x) => x.role === 'body');
  const ri = t.radius.findIndex((r) => r.name === 'lg');
  const si = t.space.findIndex((s) => s.name === 'lg');
  const fonts = FONTS.some((f) => f.value === t.fontFamily) ? FONTS : [...FONTS, { label: 'Personalizada', value: t.fontFamily }];
  const css = exportCss(t);

  return (
    <div className="found-grid">
      <section className="card found-card found-colors">
        <CardHead n="01" title="Color semántico" hint="Edita cada rol sin romper el significado del sistema." />
        <div className="swatches">
          {t.colors.map((c, i) => (
            <SwatchTile
              key={c.name}
              name={c.name}
              value={c[mode]}
              mode={mode}
              editable={editable}
              onCommit={(v) => applyOps(p.id, [edit.token('colors', i, mode, v)], `Cambiar ${colorLabel(c.name).toLowerCase()} (${mode === 'light' ? 'claro' : 'oscuro'})`)}
            />
          ))}
        </div>
      </section>

      <section className="card found-card">
        <CardHead n="02" title="Tipografía" hint="Familia global para producto y prototipos." />
        <div className="type-specimen">
          <span className="type-aa" style={{ fontFamily: t.fontFamily }}>
            Aa
          </span>
          <div>
            {display && (
              <>
                <span className="type-meta">
                  Display · {display.size}/{display.lineHeight}
                </span>
                <p style={{ fontFamily: t.fontFamily, fontSize: Math.min(display.size, 24), fontWeight: display.weight, margin: '4px 0 12px', letterSpacing: '-0.01em' }}>{p.tagline || 'Pequeños pasos, grandes metas.'}</p>
              </>
            )}
            {body && (
              <>
                <span className="type-meta">
                  Body · {body.size}/{body.lineHeight}
                </span>
                <p style={{ fontFamily: t.fontFamily, fontSize: body.size, margin: '4px 0 0', color: 'var(--ink-2)' }}>Información clara para tomar mejores decisiones.</p>
              </>
            )}
          </div>
        </div>
        <select
          className="input"
          aria-label="Familia tipográfica"
          value={t.fontFamily}
          disabled={!editable}
          onChange={(e) => applyOps(p.id, [{ kind: 'set', path: ['tokens', 'fontFamily'], value: e.target.value }], 'Cambiar tipografía')}
        >
          {fonts.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <details className="found-more">
          <summary>Ver escala tipográfica</summary>
          <TypeTab p={p} editable={editable} mode={mode} />
        </details>
      </section>

      <section className="card found-card">
        <CardHead n="03" title="Geometría y ritmo" hint="Escala coherente para todas las pantallas." />
        {ri >= 0 && <TokenSlider label="Radio de borde" value={t.radius[ri].value} min={0} max={32} disabled={!editable} onCommit={(n) => applyOps(p.id, [edit.token('radius', ri, 'value', n)], 'Cambiar radio de borde')} />}
        {si >= 0 && <TokenSlider label="Espaciado base" value={t.space[si].value} min={4} max={32} disabled={!editable} onCommit={(n) => applyOps(p.id, [edit.token('space', si, 'value', n)], 'Cambiar espaciado base')} />}
      </section>

      <section className="card found-card">
        <CardHead n="04" title="Tokens para desarrollo" hint="Exporta una base CSS lista para integrar." />
        <pre className="code-dark">
          <code>{css}</code>
        </pre>
        <div className="row">
          <CopyButton text={css} label="Copiar CSS" done="Copiaste los tokens en CSS." />
        </div>
      </section>

      <section className="card found-card found-wide">
        <details className="found-more">
          <summary>Editar todos los tokens: nombres, modo oscuro, espaciado, radios e importación</summary>
          <TokensTab p={p} editable={editable} onImport={onImport} />
        </details>
      </section>
    </div>
  );
}

function DocsTab({ p, editable }: { p: Project; editable: boolean }) {
  const instances = (id: string) => p.screens.reduce((n, s) => n + s.blocks.filter((b) => b.componentId === id).length, 0);
  const groups = projectCategories(p)
    .map((cat) => ({ cat, items: p.components.filter((c) => categoryOf(c, p) === cat.id) }))
    .filter((g) => g.items.length);
  return (
    <div className="found-grid">
      {groups.map(({ cat, items }, gi) => (
        <section key={cat.id} className="card found-card found-wide">
          <CardHead n={String(gi + 1).padStart(2, '0')} title={cat.label} hint={`${items.length} ${items.length === 1 ? 'componente' : 'componentes'}`} />
          <ul className="doc-list">
            {items.map((c) => {
              const e = entryForComponent(c);
              const n = instances(c.id);
              return (
                <li key={c.id}>
                  <IconDiamond size={16} />
                  <span className="doc-text">
                    <strong>{c.name}</strong>
                    <span>{componentSummary(c)}</span>
                    <span className="doc-use">
                      <b>Úsalo para:</b> {e.use[0]} <b>Evítalo:</b> {e.avoid[0]}
                    </span>
                  </span>
                  <span className="muted small nowrap">
                    {n} {n === 1 ? 'uso' : 'usos'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <section className="card found-card found-wide">
        <CardHead n={String(groups.length + 1).padStart(2, '0')} title="Salud del sistema" hint="Contraste, foco, adopción y sobrescrituras." />
        <HealthTab p={p} editable={editable} />
      </section>
    </div>
  );
}

function TokensTab({ p, editable, onImport }: { p: Project; editable: boolean; onImport: () => void }) {
  const [newColor, setNewColor] = useState('');
  const apply = (ops: OpInput[], label: string) => applyOps(p.id, ops, label);

  const rename = (group: 'color' | 'space' | 'radius', names: string[], from: string, to: string) => {
    const clean = to.trim();
    if (clean === from) return;
    if (!validName(clean)) return notify('Usa letras, números, guion o guion bajo, sin espacios y empezando con una letra.', 'error');
    if (names.includes(clean)) return notify(`Ya existe un token llamado ${clean}.`, 'error');
    apply(renameTokenOps(p, group, from, clean), `Renombrar token ${from} a ${clean}`);
  };

  const setHex = (index: number, key: 'light' | 'dark', v: string) => {
    const hex = v.trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return notify('Usa un color hexadecimal, por ejemplo #1646C8.', 'error');
    apply([edit.token('colors', index, key, hex.toUpperCase())], `Cambiar ${p.tokens.colors[index].name} (${key === 'light' ? 'claro' : 'oscuro'})`);
  };

  const bgLight = colorValue(p.tokens, 'background', 'light', '#FFFFFF');
  const bgDark = colorValue(p.tokens, 'background', 'dark', '#000000');
  const colorNames = p.tokens.colors.map((c) => c.name);

  return (
    <>
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Color</h2>
          {editable && (
            <Button size="sm" onClick={onImport}>
              Importar tokens
            </Button>
          )}
        </div>
        <div className="table-wrap">
          <table className="table tokens-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Modo claro</th>
                <th>Modo oscuro</th>
                <th>Contraste sobre fondo</th>
                <th>Usos</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {p.tokens.colors.map((c, i) => {
                const uses = tokenUses(p, refOf('color', c.name));
                return (
                  <tr key={c.name}>
                    <td>
                      <CommitInput className="input input-code" value={c.name} disabled={!editable} aria-label={`Nombre del token ${c.name}`} onCommit={(v) => rename('color', colorNames, c.name, v)} />
                      {c.description && <div className="cell-note">{c.description}</div>}
                    </td>
                    <td>
                      <ColorCell value={c.light} disabled={!editable} label={`${c.name} en modo claro`} onCommit={(v) => setHex(i, 'light', v)} />
                    </td>
                    <td>
                      <ColorCell value={c.dark} disabled={!editable} label={`${c.name} en modo oscuro`} onCommit={(v) => setHex(i, 'dark', v)} />
                    </td>
                    <td className="muted nowrap">
                      {ratio(contrast(c.light, bgLight))} y {ratio(contrast(c.dark, bgDark))}
                    </td>
                    <td>{uses}</td>
                    <td className="t-right">
                      {editable && (
                        <Button
                          size="sm"
                          tone="ghost"
                          disabled={uses > 0}
                          title={uses > 0 ? 'Está en uso: quita sus referencias primero' : undefined}
                          onClick={() => apply([edit.removeToken('colors', i)], `Eliminar color ${c.name}`)}
                        >
                          Eliminar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {editable && (
          <form
            className="row add-row"
            onSubmit={(e) => {
              e.preventDefault();
              const n = newColor.trim();
              if (!validName(n)) return notify('Usa letras y números, sin espacios, empezando con una letra.', 'error');
              if (colorNames.includes(n)) return notify(`Ya existe un token llamado ${n}.`, 'error');
              if (apply([edit.addToken(p, 'colors', { name: n, light: '#6B7280', dark: '#A1A8B3' })], `Agregar color ${n}`)) setNewColor('');
            }}
          >
            <input className="input" aria-label="Nombre del nuevo color" placeholder="Nombre del nuevo color, ej: warning" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
            <Button type="submit">Agregar color</Button>
          </form>
        )}
      </section>

      <section className="section grid-2 gap-lg">
        <SizeTokens p={p} group="space" title="Espaciado" editable={editable} onRename={rename} />
        <SizeTokens p={p} group="radius" title="Radios" editable={editable} onRename={rename} />
      </section>

      <section className="section">
        <h2 className="section-title">Familia tipográfica</h2>
        <Field label="Pila de fuentes (font-family)" hint="Incluye siempre fuentes de respaldo del sistema. Las fuentes de Google Fonts se cargan solas.">
          <CommitInput className="input input-code" value={p.tokens.fontFamily} disabled={!editable} onCommit={(v) => v.trim() && apply([{ kind: 'set', path: ['tokens', 'fontFamily'], value: v.trim() }], 'Cambiar familia tipográfica')} />
        </Field>
      </section>
    </>
  );
}

function SizeTokens({
  p,
  group,
  title,
  editable,
  onRename,
}: {
  p: Project;
  group: 'space' | 'radius';
  title: string;
  editable: boolean;
  onRename: (group: 'space' | 'radius', names: string[], from: string, to: string) => void;
}) {
  const list = p.tokens[group];
  const [name, setName] = useState('');
  const names = list.map((s) => s.name);
  return (
    <div>
      <h2 className="section-title">{title}</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Token</th>
            <th>Valor (px)</th>
            <th>Muestra</th>
            <th>Usos</th>
            <th>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map((s, i) => {
            const uses = tokenUses(p, refOf(group, s.name));
            return (
              <tr key={s.name}>
                <td>
                  <CommitInput className="input input-code input-short" value={s.name} disabled={!editable} aria-label={`Nombre de ${s.name}`} onCommit={(v) => onRename(group, names, s.name, v)} />
                </td>
                <td>
                  <CommitNumber value={s.value} label={`Valor de ${s.name}`} disabled={!editable} onCommit={(n) => applyOps(p.id, [edit.token(group, i, 'value', n)], `Cambiar ${group === 'space' ? 'espacio' : 'radio'} ${s.name}`)} />
                </td>
                <td>{group === 'space' ? <span className="space-bar" style={{ width: Math.min(s.value, 64) }} /> : <span className="radius-box" style={{ borderTopLeftRadius: Math.min(s.value, 24) }} />}</td>
                <td>{uses}</td>
                <td className="t-right">
                  {editable && (
                    <Button size="sm" tone="ghost" disabled={uses > 0} title={uses > 0 ? 'Está en uso' : undefined} onClick={() => applyOps(p.id, [edit.removeToken(group, i)], `Eliminar ${s.name}`)}>
                      Eliminar
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {editable && (
        <form
          className="row add-row"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!validName(n) || names.includes(n)) return notify('Usa un nombre válido que no exista.', 'error');
            if (applyOps(p.id, [edit.addToken(p, group, { name: n, value: 20 })], `Agregar ${n}`)) setName('');
          }}
        >
          <input className="input" aria-label={`Nuevo token de ${title.toLowerCase()}`} placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit">Agregar</Button>
        </form>
      )}
    </div>
  );
}

function TypeTab({ p, editable, mode }: { p: Project; editable: boolean; mode: Mode }) {
  return (
    <section className="section">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Rol</th>
              <th>Tamaño</th>
              <th>Interlineado</th>
              <th>Peso</th>
              <th>Muestra</th>
            </tr>
          </thead>
          <tbody>
            {p.tokens.type.map((t, i) => (
              <tr key={t.role}>
                <td>
                  <strong>{TYPE_ROLE_LABEL[t.role]}</strong>
                  {t.lineHeight < t.size * 1.1 && (
                    <div>
                      <Badge tone="warn">Interlineado muy ajustado</Badge>
                    </div>
                  )}
                </td>
                <td>
                  <CommitNumber value={t.size} min={8} label={`Tamaño de ${t.role}`} disabled={!editable} onCommit={(n) => applyOps(p.id, [edit.token('type', i, 'size', n)], `Cambiar tamaño ${TYPE_ROLE_LABEL[t.role]}`)} />
                </td>
                <td>
                  <CommitNumber value={t.lineHeight} min={8} label={`Interlineado de ${t.role}`} disabled={!editable} onCommit={(n) => applyOps(p.id, [edit.token('type', i, 'lineHeight', n)], `Cambiar interlineado ${TYPE_ROLE_LABEL[t.role]}`)} />
                </td>
                <td>
                  <select
                    className="input"
                    aria-label={`Peso de ${t.role}`}
                    value={t.weight}
                    disabled={!editable}
                    onChange={(e) => applyOps(p.id, [edit.token('type', i, 'weight', Number(e.target.value))], `Cambiar peso ${TYPE_ROLE_LABEL[t.role]}`)}
                  >
                    {[400, 500, 600, 650, 700, 800].map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ background: colorValue(p.tokens, 'background', mode, '#fff') }}>
                  <div style={{ fontFamily: p.tokens.fontFamily, fontSize: t.size, lineHeight: `${t.lineHeight}px`, fontWeight: t.weight, color: colorValue(p.tokens, 'onSurface', mode, '#111'), whiteSpace: 'nowrap' }}>Transfiere en segundos</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HealthTab({ p, editable }: { p: Project; editable: boolean }) {
  const issues = useMemo(() => checkProject(p).filter((i) => i.area !== 'flujo'), [p]);
  const ad = adoption(p);
  const overrides = p.screens.flatMap((s) =>
    s.blocks.flatMap((b) =>
      Object.entries(b.overrides ?? {})
        .filter(([, v]) => v)
        .map(([k, v]) => ({ s, b, k: k as StyleKey, v: v as string })),
    ),
  );
  const pct = Math.round(ad.pct * 100);

  return (
    <>
      <section className="section">
        <h2 className="section-title">Adopción del sistema</h2>
        <p>
          <strong>{pct}%</strong> de los bloques instancian un componente ({ad.instanced} de {ad.eligible}). El objetivo es 80% o más.
        </p>
        <div className="bar bar-wide" role="img" aria-label={`${pct}% de adopción`}>
          <span style={{ width: `${pct}%`, background: pct >= 80 ? 'var(--ok)' : 'var(--warn)' }} />
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Accesibilidad y consistencia</h2>
        {issues.length === 0 ? (
          <p className="muted">Sin problemas de contraste, foco ni tokens rotos.</p>
        ) : (
          <ul className="issues">
            {issues.map((i) => (
              <li key={i.id} className="issue static">
                <span className={`dot dot-${i.severity}`} aria-hidden="true" />
                <span>
                  <span className="sr-only">{i.severity === 'error' ? 'Error: ' : 'Aviso: '}</span>
                  {i.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Sobrescrituras en pantallas</h2>
        {overrides.length === 0 ? (
          <p className="muted">Ninguna instancia sobrescribe el sistema.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pantalla</th>
                  <th>Bloque</th>
                  <th>Propiedad</th>
                  <th>Valor</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {overrides.map(({ s, b, k, v }) => (
                  <tr key={`${b.id}-${k}`}>
                    <td>
                      <a href={href(`/p/${p.id}/screens?s=${s.id}`)}>{s.name}</a>
                    </td>
                    <td>{b.label || blockMeta(b.type).label}</td>
                    <td>{STYLE_KEYS.find((x) => x.key === k)?.label}</td>
                    <td>
                      <code>{parseRef(v)?.name ?? v}</code> {isRaw(k, v) ? <Badge tone="warn">Valor suelto</Badge> : <Badge>Token</Badge>}
                      {k !== 'type' && resolve(v, p.tokens, 'light') === undefined && <Badge tone="err">No existe</Badge>}
                    </td>
                    <td className="t-right">
                      {editable && (
                        <Button size="sm" tone="ghost" onClick={() => applyOps(p.id, [edit.blockOverride(p, s.id, b.id, k, undefined)], `Quitar sobrescritura de «${b.label}»`)}>
                          Quitar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
