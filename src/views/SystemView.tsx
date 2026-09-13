import { useMemo, useState } from 'react';
import type { Block, BlockType, Mode, OpInput, Project, Role, StateName, StyleKey } from '../lib/model';
import { BLOCK_TYPES, STATES, STATE_LABEL, STYLE_KEYS, TYPE_ROLE_LABEL, blockMeta } from '../lib/model';
import { applyOps, saveVersion } from '../lib/store';
import { can } from '../lib/permissions';
import { extractSystem, fileToImage, getAiKey, type ExtractedSystem, type ImageInput } from '../lib/ai';
import { IconClose, IconSparkle, IconUpload } from '../components/icons';
import { edit, renameTokenOps } from '../lib/ops';
import { builtInStyle, colorValue, contrast, isRaw, parseRef, refOf, resolve } from '../lib/tokens';
import { checkProject } from '../lib/flowCheck';
import { adoption, tokenUses } from '../lib/metrics';
import { importTokens, type TokenImport } from '../lib/importer';
import { notify } from '../lib/toast';
import { uid } from '../lib/ids';
import { href } from '../lib/router';
import { BlockView } from '../components/BlockView';
import { ColorCell, CommitInput, CommitNumber, ValuePicker } from '../components/inputs';
import { Badge, Button, Empty, Field, Modal, Tabs, pickFile } from '../components/ui';

type Tab = 'tokens' | 'type' | 'components' | 'health';

const validName = (n: string) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(n);
const ratio = (n: number | null) => (n == null ? 'n/a' : `${String(n).replace('.', ',')}:1`);

export function SystemView({ project, role }: { project: Project; role: Role }) {
  const [tab, setTab] = useState<Tab>('tokens');
  const [mode, setMode] = useState<Mode>('light');
  const [aiOpen, setAiOpen] = useState(false);
  const editable = can(role, 'edit');
  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Sistema de diseño</h1>
          <p className="page-sub">Una sola fuente de verdad. Lo que cambies aquí se refleja al instante en pantallas, prototipos y entrega.</p>
        </div>
        <div className="row">
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
          {editable && (
            <button type="button" className="btn-ai" onClick={() => setAiOpen(true)}>
              <IconSparkle size={16} /> Crear sistema con IA
            </button>
          )}
        </div>
      </div>
      <AiSystemModal p={project} open={aiOpen} onClose={() => setAiOpen(false)} />
      {!editable && <p className="notice">Tu rol es de lectura: puedes revisar el sistema, pero no modificarlo.</p>}
      <Tabs
        label="Secciones del sistema"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'tokens', label: 'Tokens' },
          { id: 'type', label: 'Tipografía' },
          { id: 'components', label: 'Componentes' },
          { id: 'health', label: 'Salud del sistema' },
        ]}
      />
      {tab === 'tokens' && <TokensTab p={project} editable={editable} />}
      {tab === 'type' && <TypeTab p={project} editable={editable} mode={mode} />}
      {tab === 'components' && <ComponentsTab p={project} editable={editable} mode={mode} />}
      {tab === 'health' && <HealthTab p={project} editable={editable} />}
    </div>
  );
}

function TokensTab({ p, editable }: { p: Project; editable: boolean }) {
  const [newColor, setNewColor] = useState('');
  const [importOpen, setImportOpen] = useState(false);
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
            <Button size="sm" onClick={() => setImportOpen(true)}>
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
                      <CommitInput
                        className="input input-code"
                        value={c.name}
                        disabled={!editable}
                        aria-label={`Nombre del token ${c.name}`}
                        onCommit={(v) => rename('color', colorNames, c.name, v)}
                      />
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
        <Field label="Pila de fuentes (font-family)" hint="Incluye siempre fuentes de respaldo del sistema.">
          <CommitInput
            className="input input-code"
            value={p.tokens.fontFamily}
            disabled={!editable}
            onCommit={(v) => v.trim() && apply([{ kind: 'set', path: ['tokens', 'fontFamily'], value: v.trim() }], 'Cambiar familia tipográfica')}
          />
        </Field>
      </section>

      <ImportTokensModal p={p} open={importOpen} onClose={() => setImportOpen(false)} />
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
                <td>
                  {group === 'space' ? (
                    <span className="space-bar" style={{ width: Math.min(s.value, 64) }} />
                  ) : (
                    <span className="radius-box" style={{ borderTopLeftRadius: Math.min(s.value, 24) }} />
                  )}
                </td>
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
                  <CommitNumber
                    value={t.lineHeight}
                    min={8}
                    label={`Interlineado de ${t.role}`}
                    disabled={!editable}
                    onCommit={(n) => applyOps(p.id, [edit.token('type', i, 'lineHeight', n)], `Cambiar interlineado ${TYPE_ROLE_LABEL[t.role]}`)}
                  />
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
                  <div
                    style={{
                      fontFamily: p.tokens.fontFamily,
                      fontSize: t.size,
                      lineHeight: `${t.lineHeight}px`,
                      fontWeight: t.weight,
                      color: colorValue(p.tokens, 'onSurface', mode, '#111'),
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Transfiere en segundos
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const SAMPLE: Partial<Record<BlockType, Partial<Block>>> = {
  button: { label: 'Continuar' },
  input: { label: 'Nombre', detail: 'Escribe tu nombre' },
  amount: { label: 'Monto', detail: '$0' },
  select: { label: 'Cuenta de origen', options: ['Cuenta vista'] },
  listItem: { label: 'Martina Rojas', detail: 'BancoEstado', action: 'navigate' },
  alert: { label: 'Transferencia enviada', detail: 'Llegará en minutos.' },
  link: { label: 'Ver detalle' },
  checkbox: { label: 'Guardar como favorito' },
  navbar: { label: 'Transferir', action: 'back' },
  heading: { label: 'Título de pantalla' },
  text: { label: 'Texto de apoyo' },
  image: { label: 'Imagen' },
  divider: { label: '' },
};

function ComponentsTab({ p, editable, mode }: { p: Project; editable: boolean; mode: Mode }) {
  const [sel, setSel] = useState(p.components[0]?.id);
  const [state, setState] = useState<StateName>('default');
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<BlockType>('button');
  const c = p.components.find((x) => x.id === sel) ?? p.components[0];

  const instances = (id: string) => p.screens.reduce((n, s) => n + s.blocks.filter((b) => b.componentId === id).length, 0);
  const overridden = c
    ? p.screens.flatMap((s) => s.blocks.filter((b) => b.componentId === c.id && Object.values(b.overrides ?? {}).some(Boolean)).map((b) => ({ s, b })))
    : [];

  const create = () => {
    const name = newName.trim();
    if (!name) return notify('Ponle un nombre al componente.', 'error');
    const comp = { id: uid('cmp_'), name, type: newType, states: builtInStyle(newType) };
    if (applyOps(p.id, [edit.addComponent(p, comp)], `Crear componente «${name}»`)) {
      setSel(comp.id);
      setNewOpen(false);
      setNewName('');
    }
  };

  return (
    <section className="section split">
      <div className="split-list">
        <div className="sl-head">
          <strong>{p.components.length} componentes</strong>
          {editable && (
            <Button size="sm" onClick={() => setNewOpen(true)}>
              Nuevo
            </Button>
          )}
        </div>
        {p.components.map((x) => (
          <button key={x.id} type="button" className="sl-item" aria-current={x.id === c?.id} onClick={() => setSel(x.id)}>
            <span>{x.name}</span>
            <span className="muted small">{instances(x.id)}</span>
          </button>
        ))}
      </div>

      {!c ? (
        <Empty title="Sin componentes">Crea el primero para que tus pantallas hereden estilos y estados desde un maestro.</Empty>
      ) : (
        <div className="stack-lg" key={c.id}>
          <div className="row between">
            <div className="stack-xs">
              <CommitInput
                className="input input-title"
                value={c.name}
                disabled={!editable}
                aria-label="Nombre del componente"
                onCommit={(v) => v.trim() && applyOps(p.id, [edit.component(p, c.id, 'name', v.trim())], `Renombrar componente a «${v.trim()}»`)}
              />
              <span className="muted">
                {blockMeta(c.type).label}, {instances(c.id)} {instances(c.id) === 1 ? 'instancia' : 'instancias'} en pantallas
              </span>
            </div>
            {editable && (
              <Button
                size="sm"
                tone="danger"
                disabled={instances(c.id) > 0}
                title={instances(c.id) > 0 ? 'Tiene instancias: desvincúlalas primero' : undefined}
                onClick={() => applyOps(p.id, [edit.removeComponent(p, c.id)], `Eliminar componente «${c.name}»`)}
              >
                Eliminar componente
              </Button>
            )}
          </div>

          <div className="table-wrap">
            <div className="state-grid">
              {STATES.map((st) => (
                <div key={st} className={`state-cell ${st === state ? 'current' : ''}`}>
                  <h4>
                    <button type="button" className="link-btn" onClick={() => setState(st)}>
                      {STATE_LABEL[st]}
                    </button>
                  </h4>
                  <div className="state-preview" style={{ background: colorValue(p.tokens, 'background', mode, '#fff') }}>
                    <BlockView project={p} block={{ id: `preview-${st}`, type: c.type, componentId: c.id, label: '', ...SAMPLE[c.type] } as Block} mode={mode} forceState={st} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="row between">
              <h3 className="sub-title">Propiedades del estado {STATE_LABEL[state].toLowerCase()}</h3>
              <Tabs small label="Estado a editar" value={state} onChange={setState} items={STATES.map((s) => ({ id: s, label: STATE_LABEL[s] }))} />
            </div>
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
          </div>

          {overridden.length > 0 && (
            <div>
              <h3 className="sub-title">Instancias que sobrescriben este componente</h3>
              <ul className="plain-list">
                {overridden.map(({ s, b }) => (
                  <li key={b.id}>
                    <a href={href(`/p/${p.id}/screens?s=${s.id}`)}>
                      «{b.label}» en «{s.name}»
                    </a>{' '}
                    <span className="muted">
                      {Object.entries(b.overrides ?? {})
                        .filter(([, v]) => v)
                        .map(([k, v]) => `${STYLE_KEYS.find((x) => x.key === k)?.label.toLowerCase()}: ${parseRef(v)?.name ?? v}`)
                        .join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Modal
        open={newOpen}
        title="Nuevo componente"
        onClose={() => setNewOpen(false)}
        footer={
          <>
            <Button onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button tone="primary" onClick={create}>
              Crear componente
            </Button>
          </>
        }
      >
        <Field label="Nombre">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Botón de peligro" autoFocus />
        </Field>
        <Field label="Tipo de bloque" hint="Parte con los estilos base de ese tipo, con sus cinco estados.">
          <select value={newType} onChange={(e) => setNewType(e.target.value as BlockType)}>
            {BLOCK_TYPES.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </Modal>
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

/** La IA lee capturas o código y propone tokens y componentes. Nada se aplica hasta confirmar. */
function AiSystemModal({ p, open, onClose }: { p: Project; open: boolean; onClose: () => void }) {
  const [images, setImages] = useState<ImageInput[]>([]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ExtractedSystem | null>(null);
  const [mode, setMode] = useState<Mode>('light');
  const hasKey = !!getAiKey();
  const preview: Project | null = result ? { ...p, tokens: result.tokens, components: result.components } : null;

  const close = () => {
    setImages([]);
    setCode('');
    setResult(null);
    setError('');
    onClose();
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    try {
      const next = await Promise.all([...files].slice(0, 5).map(fileToImage));
      setImages((imgs) => [...imgs, ...next].slice(0, 5));
      setResult(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const analyze = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await extractSystem({ images, code }, p.tokens));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const applyResult = () => {
    if (!result) return;
    saveVersion(p.id, 'Antes de crear el sistema con IA', true);
    const merged = [...p.components];
    let replaced = 0;
    let added = 0;
    for (const c of result.components) {
      const i = merged.findIndex((m) => m.name.toLowerCase() === c.name.toLowerCase() && m.type === c.type);
      if (i >= 0) {
        merged[i] = { ...c, id: merged[i].id };
        replaced++;
      } else {
        merged.push(c);
        added++;
      }
    }
    if (applyOps(p.id, [edit.project('tokens', result.tokens), edit.project('components', merged)], 'Crear sistema con IA')) {
      notify(`Aplicaste el sistema: ${added} ${added === 1 ? 'componente nuevo' : 'componentes nuevos'} y ${replaced} ${replaced === 1 ? 'actualizado' : 'actualizados'}. La versión anterior quedó en Historial.`, 'success');
      close();
    }
  };

  return (
    <Modal
      open={open}
      wide
      title="Crear sistema de diseño con IA"
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancelar</Button>
          {result ? (
            <>
              <Button onClick={() => setResult(null)}>Volver a analizar</Button>
              <Button tone="primary" onClick={applyResult}>
                Aplicar al sistema
              </Button>
            </>
          ) : (
            <Button tone="primary" disabled={busy || !hasKey || (!images.length && !code.trim())} onClick={analyze}>
              {busy ? 'Analizando…' : 'Analizar con IA'}
            </Button>
          )}
        </>
      }
    >
      {!hasKey && (
        <p className="notice">
          Para usar la IA, agrega tu clave de API de Anthropic en <a href={href('/settings')}>Ajustes</a>. Se guarda solo en este navegador.
        </p>
      )}
      {!result && (
        <>
          <p className="muted">
            Sube capturas de tu app, un kit de UI o una página de estilos, o pega código. La IA propone colores para modo claro y oscuro, espaciados, radios y componentes con sus cinco estados, usando solo tokens.
          </p>
          <label
            className="drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
          >
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
            <IconUpload size={22} />
            <strong>Sube o arrastra capturas</strong>
            <span className="small">PNG, JPG o WebP. Hasta 5 imágenes.</span>
          </label>
          {images.length > 0 && (
            <div className="thumbs">
              {images.map((img, i) => (
                <div key={i} className="thumb">
                  <img src={`data:${img.mediaType};base64,${img.data}`} alt={img.name} />
                  <button type="button" className="icon-btn thumb-remove" aria-label={`Quitar ${img.name}`} onClick={() => setImages((imgs) => imgs.filter((_, j) => j !== i))}>
                    <IconClose size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Field label="O pega código o estilos" hint="CSS, variables, tokens en JSON, HTML o componentes JSX.">
            <textarea className="input input-code" rows={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder={'.btn-primary { background: #0074C8; border-radius: 12px; }\n.card { border: 1px solid #E3E7EC; padding: 16px; }'} />
          </Field>
          <Button
            size="sm"
            tone="ghost"
            onClick={async () => {
              const t = await pickFile('.css,.scss,.json,.html,.jsx,.tsx,.js,.ts,.txt');
              if (t != null) setCode(t);
            }}
          >
            Cargar archivo de código
          </Button>
        </>
      )}
      {error && <p className="error-text">{error}</p>}
      {result && preview && (
        <div className="stack">
          {result.notes && <p>{result.notes}</p>}
          <div className="row between">
            <strong>{result.tokens.colors.length} colores</strong>
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
          <div className="ai-colors">
            {result.tokens.colors.map((c) => (
              <span key={c.name} className="ai-color">
                <i style={{ background: c[mode] }} />
                {c.name}
              </span>
            ))}
          </div>
          <strong>{result.components.length} componentes</strong>
          <div className="ai-components">
            {result.components.map((c) => (
              <div key={c.id} className="ai-component">
                <header>
                  <span>{c.name}</span>
                  <span className="muted">{blockMeta(c.type).label}</span>
                </header>
                <div className="state-preview" style={{ background: colorValue(result.tokens, 'background', mode, '#fff') }}>
                  <BlockView project={preview} block={{ id: `ai-${c.id}`, type: c.type, componentId: c.id, label: '', ...SAMPLE[c.type] } as Block} mode={mode} />
                </div>
              </div>
            ))}
          </div>
          {result.dropped > 0 && <p className="muted small">Se descartaron {result.dropped} valores que no correspondían a un token válido.</p>}
          <p className="muted small">Al aplicar, los componentes con el mismo nombre y tipo se actualizan y conservan sus instancias; los demás se agregan. Antes guardamos una versión para que puedas volver atrás.</p>
        </div>
      )}
    </Modal>
  );
}

function ImportTokensModal({ p, open, onClose }: { p: Project; open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<TokenImport | null>(null);
  const [error, setError] = useState('');

  const review = (value = text) => {
    try {
      setResult(importTokens(value, p.tokens));
      setError('');
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    }
  };

  const close = () => {
    setText('');
    setResult(null);
    setError('');
    onClose();
  };

  return (
    <Modal
      open={open}
      wide
      title="Importar tokens desde código"
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancelar</Button>
          <Button
            tone="primary"
            disabled={!result}
            onClick={() => {
              if (result && applyOps(p.id, [edit.project('tokens', result.tokens)], 'Importar tokens')) {
                notify(`Importaste ${result.summary.join(', ')}.`, 'success');
                close();
              }
            }}
          >
            Aplicar tokens
          </Button>
        </>
      }
    >
      <p className="muted">Acepta JSON (Style Dictionary, tokens de diseño o un objeto plano) y variables CSS, incluido un bloque [data-theme="dark"] para el modo oscuro.</p>
      <textarea
        className="input input-code"
        rows={10}
        aria-label="Contenido de tokens"
        placeholder={':root {\n  --color-primary: #1646C8;\n  --space-lg: 16px;\n}\n[data-theme="dark"] {\n  --color-primary: #7D9CFF;\n}'}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
      />
      <div className="row">
        <Button size="sm" onClick={() => review()}>
          Revisar cambios
        </Button>
        <Button
          size="sm"
          tone="ghost"
          onClick={async () => {
            const t = await pickFile('.json,.css,.txt');
            if (t != null) {
              setText(t);
              review(t);
            }
          }}
        >
          Cargar archivo
        </Button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {result && <p className="ok-text">Listo para aplicar: {result.summary.join(', ')}. Puedes deshacerlo después.</p>}
    </Modal>
  );
}
