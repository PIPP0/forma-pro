import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Block, BlockType, Component, ComponentCategory, Mode, OpInput, Project, StateName, StyleProps } from '../lib/model';
import { STATES, STATE_LABEL, STYLE_KEYS, TYPE_ROLE_LABEL, blockMeta, plainText } from '../lib/model';
import {
  CATALOG,
  CATEGORIES,
  OPTION_HINT,
  STATES_REV,
  categoryOf,
  componentSample,
  componentSummary,
  contentFields,
  entryForComponent,
  projectCategories,
  sampleContent,
} from '../lib/catalog';
import { builtInStyle, colorValue, componentCss, componentHtml, componentReact, componentStyle, contrast, parseRef, resolve, typeToken } from '../lib/tokens';
import { checkProject } from '../lib/flowCheck';
import { applyOps } from '../lib/store';
import { clone, edit } from '../lib/ops';
import { uid } from '../lib/ids';
import { notify } from '../lib/toast';
import { href } from '../lib/router';
import { BlockView } from './BlockView';
import { FitPreview } from './FitPreview';
import { CommitInput, ValuePicker } from './inputs';
import { Badge, Button, Code, Empty, Field, Modal, Tabs } from './ui';
import { IconCheck, IconPlus, IconSearch } from './icons';

type DetailTab = 'overview' | 'content' | 'styles' | 'code' | 'usage';
type SampleKey = 'label' | 'detail' | 'value' | 'options' | 'linkLabel';

const ratioText = (n: number | null) => (n == null ? 'n/a' : `${String(n).replace('.', ',')}:1`);
const NEW_CATEGORY = '__nueva';

const previewBlock = (p: Project, c: Component): Block => ({ id: `pv-${c.id}`, type: c.type, componentId: c.id, ...componentSample(c, p.brand) }) as Block;

/** Qué cambia un estado respecto de reposo, en palabras del sistema. */
function changesIn(c: Pick<Component, 'states'>, st: StateName): string[] {
  const s = componentStyle(c as Component, st);
  const d = componentStyle(c as Component, 'default');
  return STYLE_KEYS.filter((k) => (s[k.key] ?? '') !== (d[k.key] ?? '')).map((k) => {
    const v = s[k.key];
    const ref = parseRef(v);
    const shown = !v ? 'sin valor' : ref ? ref.name : k.key === 'type' ? (TYPE_ROLE_LABEL[v as keyof typeof TYPE_ROLE_LABEL] ?? v) : v;
    return `${k.label.toLowerCase()} ${shown}`;
  });
}

/** Estudio de componentes: lista por categoría y una ficha visual de cada componente. */
export function ComponentStudio({ p, editable, mode }: { p: Project; editable: boolean; mode: Mode }) {
  const [sel, setSel] = useState<string | undefined>(p.components[0]?.id);
  const [q, setQ] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const c = p.components.find((x) => x.id === sel) ?? p.components[0];

  const uses = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of p.screens) for (const b of s.blocks) if (b.componentId) m.set(b.componentId, (m.get(b.componentId) ?? 0) + 1);
    return m;
  }, [p.screens]);

  const needle = q.trim().toLowerCase();
  const groups = projectCategories(p).map((cat) => ({
    cat,
    custom: !CATEGORIES.some((x) => x.id === cat.id),
    items: p.components.filter((x) => categoryOf(x, p) === cat.id && (!needle || x.name.toLowerCase().includes(needle) || blockMeta(x.type).label.toLowerCase().includes(needle))),
  }));

  return (
    <div className="cs">
      <aside className="cs-list" aria-label="Componentes del sistema">
        <div className="sl-head">
          <strong>{p.components.length} componentes</strong>
          {editable && (
            <span className="row">
              <Button size="sm" tone="ghost" onClick={() => setCatsOpen(true)}>
                Categorías
              </Button>
              <Button size="sm" onClick={() => setNewOpen(true)}>
                <IconPlus size={14} /> Nuevo
              </Button>
            </span>
          )}
        </div>
        <label className="search cs-search">
          <IconSearch size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar componente" aria-label="Buscar componente" />
        </label>
        {groups.map(
          ({ cat, custom, items }) =>
            (items.length > 0 || (custom && !needle)) && (
              <div key={cat.id} className="cs-group">
                <span className="cs-group-label">
                  {cat.label}
                  <span>{items.length}</span>
                </span>
                {items.map((x) => (
                  <button key={x.id} type="button" className="sl-item" aria-current={x.id === c?.id} onClick={() => setSel(x.id)}>
                    <span>{x.name}</span>
                    <span className="muted small" title="Instancias en pantallas">
                      {uses.get(x.id) ?? 0}
                    </span>
                  </button>
                ))}
                {items.length === 0 && <span className="cs-group-empty">Sin componentes todavía.</span>}
              </div>
            ),
        )}
        {groups.every((g) => !g.items.length) && needle && <p className="muted small">Ningún componente coincide con «{q}».</p>}
      </aside>

      {c ? (
        <ComponentDetail key={c.id} p={p} c={c} editable={editable} mode={mode} uses={uses.get(c.id) ?? 0} onSelect={setSel} />
      ) : (
        <Empty title="Sin componentes">Crea el primero para que tus pantallas hereden estilos y estados.</Empty>
      )}

      <NewComponentModal
        p={p}
        open={newOpen}
        from={c}
        onClose={() => setNewOpen(false)}
        onCreated={(id) => {
          setSel(id);
          setNewOpen(false);
        }}
      />
      <CategoriesModal p={p} open={catsOpen} onClose={() => setCatsOpen(false)} />
    </div>
  );
}

function PressableCard({ selected, onPress, className, children, label }: { selected?: boolean; onPress: () => void; className: string; children: ReactNode; label: string }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={label}
      className={`${className} ${selected ? 'on' : ''}`}
      onClick={onPress}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPress();
        }
      }}
    >
      {children}
    </div>
  );
}

/** Alto del campo según el texto: una línea si cabe en una, hasta cuatro si trae saltos. */
const lineRows = (text: string | undefined, min: number) => Math.min(4, Math.max(min, (text ?? '').split('\n').length));

/** Campos de contenido de ejemplo según el patrón. */
function SampleFields({ type, variant, sample, disabled, onChange }: { type: BlockType; variant?: string; sample: Partial<Block>; disabled?: boolean; onChange: (key: SampleKey, value: string | string[] | undefined) => void }) {
  const fields = contentFields(type, variant);
  return (
    <>
      {type !== 'divider' && (
        <Field label="Texto principal" hint="Usa **negritas** para destacar.">
          <CommitInput multiline rows={lineRows(sample.label, 1)} value={sample.label ?? ''} disabled={disabled} onCommit={(v) => onChange('label', v)} />
        </Field>
      )}
      {fields.detail && (
        <Field label="Texto de apoyo">
          <CommitInput multiline rows={lineRows(sample.detail, 1)} value={sample.detail ?? ''} disabled={disabled} onCommit={(v) => onChange('detail', v || undefined)} />
        </Field>
      )}
      {fields.value && (
        <Field label={fields.value}>
          <CommitInput value={sample.value ?? ''} disabled={disabled} onCommit={(v) => onChange('value', v || undefined)} />
        </Field>
      )}
      {fields.options && (
        <Field label="Opciones" hint={OPTION_HINT[type] ?? 'Una por línea.'}>
          <CommitInput
            multiline
            rows={Math.min(6, Math.max(2, (sample.options ?? []).length))}
            value={(sample.options ?? []).join('\n')}
            disabled={disabled}
            onCommit={(v) =>
              onChange(
                'options',
                v
                  .split('\n')
                  .map((o) => o.trim())
                  .filter(Boolean),
              )
            }
          />
        </Field>
      )}
      {fields.linkLabel && (
        <Field label="Enlace al pie">
          <CommitInput value={sample.linkLabel ?? ''} disabled={disabled} onCommit={(v) => onChange('linkLabel', v.trim() || undefined)} />
        </Field>
      )}
    </>
  );
}

/** Selector de categoría con opción de crear una nueva en el mismo lugar. */
function CategoryPicker({ p, value, disabled, onPick }: { p: Project; value: string; disabled?: boolean; onPick: (id: string, created?: ComponentCategory) => void }) {
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const cats = projectCategories(p);
  const create = () => {
    const clean = label.trim();
    if (!clean) return notify('Escribe el nombre de la categoría.', 'error');
    const existing = cats.find((x) => x.label.toLowerCase() === clean.toLowerCase());
    if (existing) onPick(existing.id);
    else onPick(uid('cat_'), { id: '', label: clean });
    setCreating(false);
    setLabel('');
  };
  return (
    <div className="stack-xs">
      <select
        value={creating ? NEW_CATEGORY : value}
        disabled={disabled}
        aria-label="Categoría"
        onChange={(e) => {
          if (e.target.value === NEW_CATEGORY) setCreating(true);
          else {
            setCreating(false);
            onPick(e.target.value);
          }
        }}
      >
        <optgroup label="Del catálogo">
          {CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label}
            </option>
          ))}
        </optgroup>
        {(p.categories ?? []).length > 0 && (
          <optgroup label="Del proyecto">
            {(p.categories ?? []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </optgroup>
        )}
        <option value={NEW_CATEGORY}>Nueva categoría…</option>
      </select>
      {creating && (
        <div className="row cs-newcat">
          <input
            className="input grow"
            autoFocus
            value={label}
            placeholder="Ej: Onboarding, Campañas, Pagos"
            aria-label="Nombre de la nueva categoría"
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                create();
              }
              if (e.key === 'Escape') setCreating(false);
            }}
          />
          <Button size="sm" tone="primary" onClick={create}>
            Crear
          </Button>
        </div>
      )}
    </div>
  );
}

function ComponentDetail({ p, c, editable, mode, uses, onSelect }: { p: Project; c: Component; editable: boolean; mode: Mode; uses: number; onSelect: (id?: string) => void }) {
  const [tab, setTab] = useState<DetailTab>('overview');
  const [state, setState] = useState<StateName>('default');
  const [live, setLive] = useState(false);
  const entry = entryForComponent(c);
  const category = projectCategories(p).find((x) => x.id === categoryOf(c, p))!;
  const stageBg = colorValue(p.tokens, 'background', mode, '#FFFFFF');
  const block = useMemo(() => previewBlock(p, c), [p, c]);
  const issues = useMemo(() => checkProject(p).filter((i) => i.componentId === c.id), [p, c.id]);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const siblings = p.components.filter((x) => x.type === c.type && x.id !== c.id);
  const style = componentStyle(c, state);
  const instances = p.screens.flatMap((s) => s.blocks.filter((b) => b.componentId === c.id).map((b) => ({ s, b })));
  const view = (st?: StateName, interactive = false) => <BlockView project={p} block={block} mode={mode} forceState={interactive ? undefined : st} live={interactive} />;

  // Solo se muestran los estados que cambian algo respecto de reposo; los de contenido solo tienen reposo.
  const meta = blockMeta(c.type);
  const shownStates: StateName[] = meta.interactive ? STATES.filter((st) => st === 'default' || changesIn(c, st).length > 0) : ['default'];
  const sameStates = meta.interactive ? STATES.filter((st) => !shownStates.includes(st)) : [];

  const contrastIn = (m: Mode) => {
    if (!style.fg) return null;
    const bg = resolve(style.bg, p.tokens, m) ?? resolve('{color.background}', p.tokens, m) ?? '#FFFFFF';
    const r = contrast(resolve(style.fg, p.tokens, m), bg);
    return r == null ? null : { ratio: r, min: style.type === 'display' || style.type === 'title' ? 3 : 4.5 };
  };

  const setCategory = (id: string, created?: ComponentCategory) => {
    const ops: OpInput[] = [];
    if (created) ops.push(edit.project('categories', [...(p.categories ?? []), { id, label: created.label }]));
    ops.push(edit.component(p, c.id, 'category', id));
    applyOps(p.id, ops, created ? `Crear la categoría «${created.label}» y mover «${c.name}»` : `Mover «${c.name}» de categoría`);
  };

  return (
    <div className="cs-detail">
      <div className="cs-head">
        <div className="stack-xs">
          <span className="cs-kicker">
            {category.label} · {blockMeta(c.type).label}
            {c.variant && entry.variantLabel ? ` · ${entry.variantLabel}` : ''}
          </span>
          <CommitInput
            className="input input-title"
            value={c.name}
            disabled={!editable}
            aria-label="Nombre del componente"
            onCommit={(v) => v.trim() && applyOps(p.id, [edit.component(p, c.id, 'name', v.trim())], `Renombrar componente a «${v.trim()}»`)}
          />
          <span className="muted small">
            {uses} {uses === 1 ? 'instancia' : 'instancias'} en pantallas
          </span>
        </div>
        <div className="row">
          {errors > 0 ? (
            <Badge tone="err">
              {errors} {errors === 1 ? 'problema' : 'problemas'} de accesibilidad
            </Badge>
          ) : (
            <Badge tone="ok">
              <IconCheck size={12} /> Contraste AA en claro y oscuro
            </Badge>
          )}
          {editable && (
            <Button
              size="sm"
              tone="danger"
              disabled={uses > 0}
              title={uses > 0 ? 'Tiene instancias: desvincúlalas primero' : undefined}
              onClick={() => {
                if (applyOps(p.id, [edit.removeComponent(p, c.id)], `Eliminar componente «${c.name}»`)) onSelect(p.components.find((x) => x.id !== c.id)?.id);
              }}
            >
              Eliminar
            </Button>
          )}
        </div>
      </div>

      <Tabs
        label="Secciones del componente"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Vista general' },
          { id: 'content', label: 'Contenido y categoría' },
          { id: 'styles', label: 'Estilos por estado' },
          { id: 'code', label: 'Código' },
          { id: 'usage', label: `Uso en pantallas (${uses})` },
        ]}
      />

      {tab === 'overview' && (
        <>
          <section className="cs-stage-card" aria-label="Vista previa">
            <div className="cs-stage-bar">
              {shownStates.length > 1 ? (
                <Tabs
                  small
                  label="Estado de la vista previa"
                  value={state}
                  onChange={(s) => {
                    setState(s);
                    setLive(false);
                  }}
                  items={shownStates.map((s) => ({ id: s, label: STATE_LABEL[s] }))}
                />
              ) : (
                <span className="cs-kicker">Solo estado en reposo</span>
              )}
              {meta.interactive && (
                <label className="check cs-live">
                  <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
                  <span>Probar interacción</span>
                </label>
              )}
            </div>
            <div className="cs-stage" style={{ backgroundColor: stageBg }}>
              <FitPreview width={343} maxScale={1.1}>
                {view(state, live)}
              </FitPreview>
            </div>
            <p className="cs-stage-note">
              {live
                ? 'Pasa el cursor, presiona o usa Tab para ver los estados reales.'
                : `Estado ${STATE_LABEL[state].toLowerCase()} en ${mode === 'light' ? 'modo claro' : 'modo oscuro'}, al ancho real de un teléfono. `}
              {!live && editable && (
                <button type="button" className="link-btn" onClick={() => setTab('content')}>
                  Editar el contenido de ejemplo
                </button>
              )}
            </p>
          </section>

          {shownStates.length > 1 && (
            <div className="cs-states" aria-label="Estados del componente">
              {shownStates.map((st) => (
                <PressableCard
                  key={st}
                  className="cs-state"
                  selected={st === state}
                  label={`Ver estado ${STATE_LABEL[st].toLowerCase()}`}
                  onPress={() => {
                    setState(st);
                    setLive(false);
                  }}
                >
                  <span className="cs-state-name">
                    {STATE_LABEL[st]}
                    <span className="cs-state-change">{st === 'default' ? 'Base del componente' : changesIn(c, st).join(' · ')}</span>
                  </span>
                  <span className="cs-state-view" aria-hidden="true" style={{ backgroundColor: stageBg }}>
                    <FitPreview width={343}>{view(st)}</FitPreview>
                  </span>
                </PressableCard>
              ))}
            </div>
          )}
          {!meta.interactive && <p className="cs-states-note">Es un componente de contenido: no se toca ni recibe foco, por eso solo tiene estado en reposo.</p>}
          {sameStates.length > 0 && (
            <p className="cs-states-note">
              Igual que reposo: {sameStates.map((s) => STATE_LABEL[s].toLowerCase()).join(', ')}. Defínelos en «Estilos por estado» para que se distingan.
            </p>
          )}

          <div className="cs-grid-2">
            <section className="cs-card">
              <h3>Especificación en {STATE_LABEL[state].toLowerCase()}</h3>
              <div className="table-wrap">
                <table className="table cs-specs">
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
                      if (k.key === 'type') {
                        const tt = typeToken(p.tokens, v);
                        return (
                          <tr key={k.key}>
                            <td>{k.label}</td>
                            <td>
                              <code>type.{tt.role}</code>
                            </td>
                            <td colSpan={2}>
                              {TYPE_ROLE_LABEL[tt.role]}, {tt.size}/{tt.lineHeight} px, peso {tt.weight}
                            </td>
                          </tr>
                        );
                      }
                      const ref = parseRef(v);
                      return (
                        <tr key={k.key}>
                          <td>{k.label}</td>
                          <td>{ref ? <code>{`${ref.group}.${ref.name}`}</code> : <Badge tone="warn">Valor suelto</Badge>}</td>
                          <td>
                            <Spec v={resolve(v, p.tokens, 'light')} />
                          </td>
                          <td>
                            <Spec v={resolve(v, p.tokens, 'dark')} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="cs-contrast">
                {(['light', 'dark'] as Mode[]).map((m) => {
                  const r = contrastIn(m);
                  if (!r) return null;
                  const ok = r.ratio >= r.min;
                  return (
                    <Badge key={m} tone={ok ? 'ok' : 'err'}>
                      Texto {m === 'light' ? 'en claro' : 'en oscuro'}: {ratioText(r.ratio)}, {ok ? 'cumple AA' : `mínimo ${String(r.min).replace('.', ',')}:1`}
                    </Badge>
                  );
                })}
              </div>
              {issues.length > 0 && (
                <ul className="issues">
                  {issues.map((i) => (
                    <li key={i.id} className="issue static">
                      <span className={`dot dot-${i.severity}`} aria-hidden="true" />
                      <span>{i.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="cs-card">
              <h3>Guía de uso</h3>
              <p className="cs-summary">{componentSummary(c)}</p>
              <div className="cs-grid-2 cs-tight">
                <div>
                  <h4>Úsalo para</h4>
                  <ul>
                    {entry.use.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Evítalo cuando</h4>
                  <ul>
                    {entry.avoid.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <h4 className="cs-gap">Anatomía</h4>
              <ul className="cs-anatomy">
                {entry.anatomy.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <h4 className="cs-gap">Accesibilidad</h4>
              <p className="cs-a11y">{entry.a11y}</p>
            </section>
          </div>

          {siblings.length > 0 && (
            <section className="stack">
              <h3 className="sub-title">Otras variantes de {blockMeta(c.type).label.toLowerCase()}</h3>
              <div className="cs-variants">
                {siblings.map((x) => (
                  <PressableCard key={x.id} className="cs-state" label={`Abrir ${x.name}`} onPress={() => onSelect(x.id)}>
                    <span className="cs-state-name">{x.name}</span>
                    <span className="cs-state-view" aria-hidden="true" style={{ backgroundColor: stageBg }}>
                      <FitPreview width={343}>
                        <BlockView project={p} block={previewBlock(p, x)} mode={mode} />
                      </FitPreview>
                    </span>
                  </PressableCard>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {tab === 'content' && (
        <div className="cs-styles">
          <div className="stack">
            <Field label="Categoría" hint="Agrupa el componente en la biblioteca, en Diseñar y en la documentación.">
              <CategoryPicker p={p} value={categoryOf(c, p)} disabled={!editable} onPick={setCategory} />
            </Field>
            <Field label="Descripción" hint="Qué es y para qué sirve. Si la dejas vacía, se usa la del patrón.">
              <CommitInput
                multiline
                value={c.description ?? ''}
                placeholder={entry.summary}
                disabled={!editable}
                onCommit={(v) => applyOps(p.id, [edit.component(p, c.id, 'description', v.trim() || undefined)], `Describir «${c.name}»`)}
              />
            </Field>
            <h3 className="sub-title">Contenido de ejemplo</h3>
            <p className="muted small">Es lo que se ve en las vistas previas, en el explorador de Diseñar y lo que trae el componente al agregarlo a una pantalla.</p>
            <SampleFields
              type={c.type}
              variant={c.variant}
              sample={componentSample(c, p.brand)}
              disabled={!editable}
              onChange={(key, v) => applyOps(p.id, [edit.component(p, c.id, 'sample', { ...(c.sample ?? {}), [key]: v })], `Editar el contenido de «${c.name}»`)}
            />
            {editable && c.sample && (
              <div className="row">
                <Button size="sm" onClick={() => applyOps(p.id, [edit.component(p, c.id, 'sample', undefined)], `Restablecer el contenido de «${c.name}»`)}>
                  Volver al contenido del patrón
                </Button>
              </div>
            )}
          </div>
          <div className="cs-styles-preview" style={{ backgroundColor: stageBg }}>
            <span className="cs-kicker" style={{ color: colorValue(p.tokens, 'muted', mode, '#666') }}>
              Vista previa interactiva
            </span>
            <FitPreview width={343}>{view(undefined, meta.interactive)}</FitPreview>
          </div>
        </div>
      )}

      {tab === 'styles' && (
        <div className="cs-styles">
          <div className="stack">
            {meta.interactive ? (
              <Tabs small label="Estado a editar" value={state} onChange={setState} items={STATES.map((s) => ({ id: s, label: STATE_LABEL[s] }))} />
            ) : (
              <p className="muted small">Componente de contenido: solo se edita el estado en reposo.</p>
            )}
            {state !== 'default' && <p className="muted small">Lo que dejes en «Hereda» toma el valor del estado en reposo.</p>}
            <div className="picker-grid">
              {STYLE_KEYS.map((k) => (
                <ValuePicker
                  key={k.key}
                  tokens={p.tokens}
                  group={k.group}
                  label={k.label}
                  disabled={!editable}
                  value={c.states[state]?.[k.key]}
                  inherited={state !== 'default' ? c.states.default[k.key] : undefined}
                  onChange={(v) => applyOps(p.id, [edit.componentState(p, c.id, state, k.key, v)], `Editar «${c.name}» (${STATE_LABEL[state].toLowerCase()})`)}
                />
              ))}
            </div>
            {editable && (
              <div className="row">
                <Button
                  size="sm"
                  onClick={() =>
                    applyOps(p.id, [edit.component(p, c.id, 'states', { ...c.states, [state]: builtInStyle(c.type, c.variant)[state] })], `Restablecer «${c.name}» (${STATE_LABEL[state].toLowerCase()})`)
                  }
                >
                  Restablecer este estado
                </Button>
              </div>
            )}
          </div>
          <div className="cs-styles-preview" style={{ backgroundColor: stageBg }}>
            <span className="cs-kicker" style={{ color: colorValue(p.tokens, 'muted', mode, '#666') }}>
              Vista previa en {STATE_LABEL[state].toLowerCase()}
            </span>
            <FitPreview width={343}>{view(state)}</FitPreview>
          </div>
        </div>
      )}

      {tab === 'code' && (
        <div className="stack">
          <Code label={`CSS de ${c.name} con sus estados`} code={componentCss(c)} />
          <Code label="React" code={componentReact(c)} />
          <Code label="HTML" code={componentHtml(c, plainText(block.label) || c.name)} />
        </div>
      )}

      {tab === 'usage' &&
        (instances.length === 0 ? (
          <Empty title="Todavía no se usa en pantallas">Agrégalo desde Diseñar, en la pestaña Componentes del explorador.</Empty>
        ) : (
          <ul className="plain-list cs-usage">
            {instances.map(({ s, b }) => (
              <li key={b.id}>
                <a href={href(`/p/${p.id}/screens?s=${s.id}`)}>
                  «{plainText(b.label) || blockMeta(b.type).label}» en «{s.name}»
                </a>
                {Object.values(b.overrides ?? {}).some(Boolean) && <Badge tone="warn">Sobrescribe estilos</Badge>}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

function Spec({ v }: { v?: string }) {
  if (!v) return <span className="muted">n/a</span>;
  return (
    <span className="spec-value">
      {v.startsWith('#') && <span className="swatch-dot" style={{ background: v }} aria-hidden="true" />}
      <code>{v}</code>
    </span>
  );
}

interface Draft {
  source: string;
  name: string;
  type: BlockType;
  variant?: string;
  category: string;
  newCategory?: ComponentCategory;
  description: string;
  sample: Partial<Block>;
  states: Record<StateName, StyleProps>;
}

function draftFrom(p: Project, source: string): Draft {
  if (source.startsWith('dup:')) {
    const comp = p.components.find((x) => x.id === source.slice(4));
    if (comp)
      return {
        source,
        name: `${comp.name} (copia)`,
        type: comp.type,
        variant: comp.variant,
        category: categoryOf(comp, p),
        description: comp.description ?? '',
        sample: componentSample(comp, p.brand),
        states: clone(comp.states),
      };
  }
  const e = CATALOG.find((x) => `cat:${x.key}` === source) ?? CATALOG[0];
  return { source: `cat:${e.key}`, name: '', type: e.type, variant: e.variant, category: e.category, description: '', sample: sampleContent(e.type, e.variant, p.brand), states: builtInStyle(e.type, e.variant) };
}

/** Crear un componente: patrón o duplicado, con nombre, categoría, contenido y estilos editables en vivo. */
function NewComponentModal({ p, open, from, onClose, onCreated }: { p: Project; open: boolean; from?: Component; onClose: () => void; onCreated: (id: string) => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(p, `cat:${CATALOG[0].key}`));
  const [editState, setEditState] = useState<StateName>('default');
  const [panel, setPanel] = useState<'content' | 'styles'>('content');
  const [mode, setMode] = useState<Mode>('light');
  // En «Contenido» la vista previa responde al cursor; en «Estilos» muestra el estado que se edita.
  const previewState: StateName | 'live' = panel === 'styles' ? editState : 'live';

  useEffect(() => {
    if (!open) return;
    setDraft(draftFrom(p, `cat:${CATALOG[0].key}`));
    setEditState('default');
    setPanel('content');
    // Al abrir se parte siempre desde el primer patrón; el proyecto puede cambiar mientras está cerrado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const entry = CATALOG.find((x) => `cat:${x.key}` === draft.source) ?? entryForComponent({ type: draft.type, variant: draft.variant });
  const meta = blockMeta(draft.type);
  const baseName = draft.source.startsWith('dup:') ? draft.name : entry.name;
  const draftComponent: Component = {
    id: 'cmp-borrador',
    name: draft.name || baseName,
    type: draft.type,
    variant: draft.variant,
    states: draft.states,
    sample: draft.sample,
    description: draft.description,
    rev: STATES_REV,
  };
  const draftProject = useMemo(
    () => ({
      ...p,
      components: [...p.components, draftComponent],
      // La categoría nueva del borrador se muestra solo si aún no existe en el proyecto (evita duplicarla al reabrir).
      categories:
        draft.newCategory && !(p.categories ?? []).some((x) => x.id === draft.category) ? [...(p.categories ?? []), { ...draft.newCategory, id: draft.category }] : p.categories,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p, draft],
  );
  const stageBg = colorValue(p.tokens, 'background', mode, '#FFFFFF');
  const style = componentStyle(draftComponent, editState);
  const contrastIn = (m: Mode) => {
    if (!style.fg) return null;
    const r = contrast(resolve(style.fg, p.tokens, m), resolve(style.bg, p.tokens, m) ?? resolve('{color.background}', p.tokens, m) ?? '#FFFFFF');
    return r == null ? null : { ratio: r, min: style.type === 'display' || style.type === 'title' ? 3 : 4.5 };
  };

  const create = () => {
    const finalName = draft.name.trim() || baseName;
    if (p.components.some((x) => x.name.toLowerCase() === finalName.toLowerCase())) return notify(`Ya existe un componente llamado «${finalName}». Ponle otro nombre.`, 'error');
    const ops: OpInput[] = [];
    if (draft.newCategory) ops.push(edit.project('categories', [...(p.categories ?? []), { id: draft.category, label: draft.newCategory.label }]));
    const comp: Component = {
      id: uid('cmp_'),
      name: finalName,
      type: draft.type,
      variant: draft.variant,
      states: draft.states,
      rev: STATES_REV,
      category: draft.category,
      sample: draft.sample,
      ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    };
    ops.push(edit.addComponent(p, comp));
    if (applyOps(p.id, ops, `Crear componente «${finalName}»`)) onCreated(comp.id);
  };

  const categoryLabel = draft.newCategory?.label ?? projectCategories(p).find((x) => x.id === draft.category)?.label;

  return (
    <Modal
      open={open}
      xl
      title="Nuevo componente"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button tone="primary" onClick={create}>
            Crear componente
          </Button>
        </>
      }
    >
      <div className="cs-new">
        <div className="stack cs-new-form">
          <div className="grid-2">
            <Field label="Basado en">
              <select
                value={draft.source}
                onChange={(e) => {
                  setDraft(draftFrom(p, e.target.value));
                  setEditState('default');
                }}
              >
                {from && (
                  <optgroup label="Copiar un componente del proyecto">
                    <option value={`dup:${from.id}`}>{from.name} (seleccionado)</option>
                    {p.components
                      .filter((x) => x.id !== from.id)
                      .map((x) => (
                        <option key={x.id} value={`dup:${x.id}`}>
                          {x.name}
                        </option>
                      ))}
                  </optgroup>
                )}
                {CATEGORIES.map((cat) => (
                  <optgroup key={cat.id} label={`Catálogo · ${cat.label}`}>
                    {CATALOG.filter((e) => e.category === cat.id).map((e) => (
                      <option key={e.key} value={`cat:${e.key}`}>
                        {e.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Nombre">
              <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder={baseName} />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Categoría">
              <CategoryPicker
                p={draftProject}
                value={draft.category}
                onPick={(id, created) => setDraft((d) => ({ ...d, category: id, newCategory: created ? { id, label: created.label } : d.newCategory?.id === id ? d.newCategory : undefined }))}
              />
            </Field>
            <Field label="Descripción (opcional)">
              <input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Para qué sirve" title={entry.summary} />
            </Field>
          </div>

          <div className="cs-new-panel">
            <Tabs
              label="Qué personalizar"
              value={panel}
              onChange={setPanel}
              items={[
                { id: 'content', label: 'Contenido' },
                { id: 'styles', label: meta.interactive ? 'Estilos por estado' : 'Estilos' },
              ]}
            />
            {panel === 'content' ? (
              <div className="stack">
                <SampleFields
                  type={draft.type}
                  variant={draft.variant}
                  sample={draft.sample}
                  onChange={(key, v) => setDraft((d) => ({ ...d, sample: { ...d.sample, [key]: v } }))}
                />
              </div>
            ) : (
              <div className="stack">
                {meta.interactive ? (
                  <Tabs small label="Estado a editar" value={editState} onChange={setEditState} items={STATES.map((s) => ({ id: s, label: STATE_LABEL[s] }))} />
                ) : (
                  <p className="muted small">Este patrón muestra contenido y no cambia al tocarlo: solo tiene estilo en reposo.</p>
                )}
                <div className="picker-grid">
                  {STYLE_KEYS.map((k) => (
                    <ValuePicker
                      key={`${editState}-${k.key}`}
                      tokens={p.tokens}
                      group={k.group}
                      label={k.label}
                      value={draft.states[editState]?.[k.key]}
                      inherited={editState !== 'default' ? draft.states.default[k.key] : undefined}
                      onChange={(v) => setDraft((d) => ({ ...d, states: { ...d.states, [editState]: { ...d.states[editState], [k.key]: v } } }))}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="cs-new-preview">
          <div className="row between">
            <strong>Vista previa</strong>
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
          <div className="cs-stage cs-stage-sm" style={{ backgroundColor: stageBg }}>
            <FitPreview width={343}>
              <BlockView
                project={draftProject}
                block={previewBlock(draftProject, draftComponent)}
                mode={mode}
                live={meta.interactive && previewState === 'live'}
                forceState={previewState === 'live' ? undefined : previewState}
              />
            </FitPreview>
          </div>
          <p className="muted small">
            {draft.name.trim() || baseName} · {categoryLabel} · {blockMeta(draft.type).label}
          </p>
          <div className="cs-contrast">
            {(['light', 'dark'] as Mode[]).map((m) => {
              const r = contrastIn(m);
              if (!r) return null;
              const ok = r.ratio >= r.min;
              return (
                <Badge key={m} tone={ok ? 'ok' : 'err'}>
                  {STATE_LABEL[editState]} {m === 'light' ? 'en claro' : 'en oscuro'}: {ratioText(r.ratio)}
                </Badge>
              );
            })}
          </div>
        </aside>
      </div>
    </Modal>
  );
}

/** Categorías del proyecto: crear, renombrar y eliminar. Las del catálogo son fijas. */
function CategoriesModal({ p, open, onClose }: { p: Project; open: boolean; onClose: () => void }) {
  const [label, setLabel] = useState('');
  const custom = p.categories ?? [];
  const count = (id: string) => p.components.filter((c) => categoryOf(c, p) === id).length;

  const add = () => {
    const clean = label.trim();
    if (!clean) return notify('Escribe el nombre de la categoría.', 'error');
    if (projectCategories(p).some((x) => x.label.toLowerCase() === clean.toLowerCase())) return notify(`Ya existe la categoría «${clean}».`, 'error');
    if (applyOps(p.id, [edit.project('categories', [...custom, { id: uid('cat_'), label: clean }])], `Crear la categoría «${clean}»`)) setLabel('');
  };

  const rename = (id: string, v: string) => {
    const clean = v.trim();
    if (!clean) return;
    if (projectCategories(p).some((x) => x.id !== id && x.label.toLowerCase() === clean.toLowerCase())) return notify(`Ya existe la categoría «${clean}».`, 'error');
    applyOps(p.id, [edit.project('categories', custom.map((x) => (x.id === id ? { ...x, label: clean } : x)))], `Renombrar la categoría a «${clean}»`);
  };

  const remove = (cat: ComponentCategory) => {
    const ops: OpInput[] = p.components.filter((c) => c.category === cat.id).map((c) => edit.component(p, c.id, 'category', undefined));
    ops.push(edit.project('categories', custom.filter((x) => x.id !== cat.id)));
    applyOps(p.id, ops, `Eliminar la categoría «${cat.label}»`);
  };

  return (
    <Modal open={open} title="Categorías de componentes" onClose={onClose} footer={<Button onClick={onClose}>Listo</Button>}>
      <p className="muted modal-lede">Crea categorías para ordenar la biblioteca a la medida de tu producto. Al eliminar una, sus componentes vuelven a la categoría de su patrón.</p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input className="input grow" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nueva categoría, ej: Onboarding" aria-label="Nombre de la nueva categoría" />
        <Button type="submit" tone="primary">
          Crear
        </Button>
      </form>
      <h3 className="sub-title">Del proyecto</h3>
      {custom.length === 0 ? (
        <p className="muted small">Todavía no hay categorías propias.</p>
      ) : (
        <ul className="plain-list cs-cats">
          {custom.map((cat) => (
            <li key={cat.id}>
              <CommitInput className="input" value={cat.label} aria-label={`Nombre de la categoría ${cat.label}`} onCommit={(v) => rename(cat.id, v)} />
              <span className="muted small nowrap">
                {count(cat.id)} {count(cat.id) === 1 ? 'componente' : 'componentes'}
              </span>
              <Button size="sm" tone="ghost" onClick={() => remove(cat)}>
                Eliminar
              </Button>
            </li>
          ))}
        </ul>
      )}
      <h3 className="sub-title">Del catálogo</h3>
      <ul className="plain-list cs-cats">
        {CATEGORIES.map((cat) => (
          <li key={cat.id}>
            <span>{cat.label}</span>
            <span className="muted small nowrap">
              {count(cat.id)} {count(cat.id) === 1 ? 'componente' : 'componentes'}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
