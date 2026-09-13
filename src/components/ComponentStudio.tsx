import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Block, Component, Mode, Project, StateName } from '../lib/model';
import { STATES, STATE_LABEL, STYLE_KEYS, TYPE_ROLE_LABEL, blockMeta, plainText } from '../lib/model';
import { CATALOG, CATEGORIES, entryForComponent, fixContrast, sampleContent } from '../lib/catalog';
import { builtInStyle, colorValue, componentCss, componentHtml, componentReact, componentStyle, contrast, parseRef, resolve, typeToken } from '../lib/tokens';
import { checkProject } from '../lib/flowCheck';
import { applyOps } from '../lib/store';
import { edit } from '../lib/ops';
import { uid } from '../lib/ids';
import { notify } from '../lib/toast';
import { href } from '../lib/router';
import { BlockView } from './BlockView';
import { FitPreview } from './FitPreview';
import { CommitInput, ValuePicker } from './inputs';
import { Badge, Button, Code, Empty, Field, Modal, Tabs } from './ui';
import { IconCheck, IconPlus, IconSearch } from './icons';

type DetailTab = 'overview' | 'styles' | 'code' | 'usage';

const ratioText = (n: number | null) => (n == null ? 'n/a' : `${String(n).replace('.', ',')}:1`);

const previewBlock = (p: Project, c: Pick<Component, 'id' | 'type' | 'variant'>, linked = true): Block =>
  ({ id: `pv-${c.id}`, type: c.type, ...(linked ? { componentId: c.id } : { variant: c.variant }), ...sampleContent(c.type, c.variant, p.brand) }) as Block;

/** Estudio de componentes: lista por categoría y una ficha visual de cada componente. */
export function ComponentStudio({ p, editable, mode }: { p: Project; editable: boolean; mode: Mode }) {
  const [sel, setSel] = useState<string | undefined>(p.components[0]?.id);
  const [q, setQ] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const c = p.components.find((x) => x.id === sel) ?? p.components[0];

  const uses = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of p.screens) for (const b of s.blocks) if (b.componentId) m.set(b.componentId, (m.get(b.componentId) ?? 0) + 1);
    return m;
  }, [p.screens]);

  const needle = q.trim().toLowerCase();
  const groups = CATEGORIES.map((cat) => ({
    cat,
    items: p.components.filter((x) => entryForComponent(x).category === cat.id && (!needle || x.name.toLowerCase().includes(needle) || blockMeta(x.type).label.toLowerCase().includes(needle))),
  }));

  return (
    <div className="cs">
      <aside className="cs-list" aria-label="Componentes del sistema">
        <div className="sl-head">
          <strong>{p.components.length} componentes</strong>
          {editable && (
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <IconPlus size={14} /> Nuevo
            </Button>
          )}
        </div>
        <label className="search cs-search">
          <IconSearch size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar componente" aria-label="Buscar componente" />
        </label>
        {groups.map(
          ({ cat, items }) =>
            items.length > 0 && (
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
              </div>
            ),
        )}
        {groups.every((g) => !g.items.length) && <p className="muted small">Ningún componente coincide con «{q}».</p>}
      </aside>

      {c ? (
        <ComponentDetail key={c.id} p={p} c={c} editable={editable} mode={mode} uses={uses.get(c.id) ?? 0} onSelect={setSel} />
      ) : (
        <Empty title="Sin componentes">Crea el primero para que tus pantallas hereden estilos y estados.</Empty>
      )}

      <NewComponentModal
        p={p}
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(id) => {
          setSel(id);
          setNewOpen(false);
        }}
      />
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

function ComponentDetail({ p, c, editable, mode, uses, onSelect }: { p: Project; c: Component; editable: boolean; mode: Mode; uses: number; onSelect: (id?: string) => void }) {
  const [tab, setTab] = useState<DetailTab>('overview');
  const [state, setState] = useState<StateName>('default');
  const [live, setLive] = useState(false);
  const entry = entryForComponent(c);
  const category = CATEGORIES.find((x) => x.id === entry.category)!;
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
  const changesIn = (st: StateName) => {
    const s = componentStyle(c, st);
    const d = componentStyle(c, 'default');
    return STYLE_KEYS.filter((k) => (s[k.key] ?? '') !== (d[k.key] ?? '')).map((k) => {
      const v = s[k.key];
      const ref = parseRef(v);
      const shown = !v ? 'sin valor' : ref ? ref.name : k.key === 'type' ? TYPE_ROLE_LABEL[v as keyof typeof TYPE_ROLE_LABEL] ?? v : v;
      return `${k.label.toLowerCase()} ${shown}`;
    });
  };
  const shownStates: StateName[] = meta.interactive ? STATES.filter((st) => st === 'default' || changesIn(st).length > 0) : ['default'];
  const sameStates = meta.interactive ? STATES.filter((st) => !shownStates.includes(st)) : [];

  const contrastIn = (m: Mode) => {
    if (!style.fg) return null;
    const bg = resolve(style.bg, p.tokens, m) ?? resolve('{color.background}', p.tokens, m) ?? '#FFFFFF';
    const ratio = contrast(resolve(style.fg, p.tokens, m), bg);
    return ratio == null ? null : { ratio, min: style.type === 'display' || style.type === 'title' ? 3 : 4.5 };
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
                : `Estado ${STATE_LABEL[state].toLowerCase()} en ${mode === 'light' ? 'modo claro' : 'modo oscuro'}, con contenido de ejemplo y el ancho real de un teléfono.`}
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
                    <span className="cs-state-change">{st === 'default' ? 'Base del componente' : changesIn(st).join(' · ')}</span>
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
              <p className="cs-summary">{entry.summary}</p>
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

function NewComponentModal({ p, open, onClose, onCreated }: { p: Project; open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [key, setKey] = useState(CATALOG[0].key);
  const [name, setName] = useState('');
  const entry = CATALOG.find((e) => e.key === key)!;

  const create = () => {
    const finalName = name.trim() || entry.name;
    if (p.components.some((x) => x.name.toLowerCase() === finalName.toLowerCase())) return notify(`Ya existe un componente llamado «${finalName}». Ponle otro nombre.`, 'error');
    const comp = fixContrast({ id: uid('cmp_'), name: finalName, type: entry.type, variant: entry.variant, states: builtInStyle(entry.type, entry.variant) }, p.tokens);
    if (applyOps(p.id, [edit.addComponent(p, comp)], `Crear componente «${finalName}»`)) {
      setName('');
      onCreated(comp.id);
    }
  };

  return (
    <Modal
      open={open}
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
      <Field label="Patrón" hint="Parte con los estilos base del patrón, sus cinco estados y tus tokens.">
        <select value={key} onChange={(e) => setKey(e.target.value)}>
          {CATEGORIES.map((cat) => (
            <optgroup key={cat.id} label={cat.label}>
              {CATALOG.filter((e) => e.category === cat.id).map((e) => (
                <option key={e.key} value={e.key}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="Nombre">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${entry.name} de campaña`} />
      </Field>
      <p className="muted small">{entry.summary}</p>
      <div className="cs-stage cs-stage-sm" style={{ backgroundColor: colorValue(p.tokens, 'background', 'light', '#FFFFFF') }}>
        <FitPreview width={343}>
          <BlockView project={p} block={previewBlock(p, { id: 'nuevo', type: entry.type, variant: entry.variant }, false)} mode="light" />
        </FitPreview>
      </div>
    </Modal>
  );
}
