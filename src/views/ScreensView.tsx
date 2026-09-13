import { useEffect, useMemo, useState } from 'react';
import type { Block, BlockType, Breakpoint, Mode, OpInput, Project, Role, Screen } from '../lib/model';
import { BLOCK_TYPES, BREAKPOINTS, STYLE_KEYS, baseId, blockMeta } from '../lib/model';
import { addComment, applyOps, resolveComment, useDb, userName } from '../lib/store';
import { can } from '../lib/permissions';
import { clone, edit } from '../lib/ops';
import { checkProject, AREA_LABEL, type Issue } from '../lib/flowCheck';
import { effectiveStyle, findComponent } from '../lib/tokens';
import { importHtml } from '../lib/importer';
import { uid } from '../lib/ids';
import { notify } from '../lib/toast';
import { href } from '../lib/router';
import { ScreenCanvas } from '../components/ScreenCanvas';
import { Runner } from '../components/Runner';
import { CopilotPanel } from '../components/CopilotPanel';
import { CommitInput, ValuePicker } from '../components/inputs';
import { Badge, Button, Empty, Field, Modal, Tabs, timeAgo } from '../components/ui';

const DEFAULT_LABEL: Record<BlockType, string> = {
  navbar: 'Título de sección',
  heading: 'Título',
  text: 'Texto de apoyo',
  input: 'Etiqueta del campo',
  amount: 'Monto',
  select: 'Selecciona una opción',
  checkbox: 'Acepto las condiciones',
  button: 'Continuar',
  link: 'Ver más',
  listItem: 'Elemento de la lista',
  alert: 'Aviso',
  image: 'Imagen',
  divider: '',
};

const VARIANTS: Partial<Record<BlockType, { v: string; l: string }[]>> = {
  heading: [
    { v: 'title', l: 'Título' },
    { v: 'display', l: 'Display' },
  ],
  text: [
    { v: '', l: 'Cuerpo' },
    { v: 'muted', l: 'Secundario' },
    { v: 'caption', l: 'Nota' },
  ],
  button: [
    { v: 'primary', l: 'Principal' },
    { v: 'secondary', l: 'Secundario' },
  ],
  alert: [
    { v: '', l: 'Éxito' },
    { v: 'danger', l: 'Error' },
  ],
};

function newBlock(type: BlockType, componentId?: string, variant?: string): Block {
  const b: Block = { id: uid('b_'), type, label: DEFAULT_LABEL[type] };
  if (type === 'select') b.options = ['Opción 1', 'Opción 2'];
  if (type === 'heading') b.variant = 'title';
  if (variant) b.variant = variant;
  if (componentId) b.componentId = componentId;
  return b;
}

type Panel = 'inspect' | 'comments' | 'copilot';

export function ScreensView({ project, role, initialScreen }: { project: Project; role: Role; initialScreen?: string }) {
  const editable = can(role, 'edit');
  const [screenId, setScreenId] = useState(() => (initialScreen && project.screens.some((s) => s.id === initialScreen) ? initialScreen : project.startScreenId));
  const [blockId, setBlockId] = useState<string>();
  const [mode, setMode] = useState<Mode>('light');
  const [wireframe, setWireframe] = useState(false);
  const [play, setPlay] = useState(false);
  const [panel, setPanel] = useState<Panel>('inspect');
  const [guardOpen, setGuardOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (initialScreen && project.screens.some((s) => s.id === initialScreen)) setScreenId(initialScreen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScreen]);

  const screen = project.screens.find((s) => s.id === screenId) ?? project.screens.find((s) => s.id === project.startScreenId) ?? project.screens[0];
  const block = screen?.blocks.find((b) => b.id === blockId);
  const issues = useMemo(() => checkProject(project), [project]);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  const apply = (ops: OpInput[], label: string) => applyOps(project.id, ops, label);

  const addScreen = () => {
    const s: Screen = { id: uid('s_'), name: 'Nueva pantalla', breakpoint: 'mobile', blocks: [newBlock('heading')] };
    const ops = [edit.addScreen(project, s)];
    if (!project.screens.some((x) => x.id === project.startScreenId)) ops.push(edit.project('startScreenId', s.id));
    if (apply(ops, 'Agregar pantalla')) {
      setScreenId(s.id);
      setBlockId(undefined);
      setPlay(false);
    }
  };

  // Atajos de teclado para el bloque seleccionado
  useEffect(() => {
    if (!editable || !block || !screen || play) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable], dialog')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (apply([edit.removeBlock(project, screen.id, block.id)], `Eliminar «${block.label || blockMeta(block.type).label}»`)) setBlockId(undefined);
      }
      if (e.key === 'Escape') setBlockId(undefined);
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const i = screen.blocks.findIndex((b) => b.id === block.id);
        const to = e.key === 'ArrowUp' ? i - 1 : i + 1;
        if (to >= 0 && to < screen.blocks.length) apply([edit.moveBlock(project, screen.id, i, to)], 'Mover bloque');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!screen)
    return (
      <div className="page">
        <Empty
          title="Este proyecto no tiene pantallas"
          action={
            editable && (
              <Button tone="primary" onClick={addScreen}>
                Crear la primera pantalla
              </Button>
            )
          }
        >
          Las pantallas se conectan por acciones y se prueban tal como las diseñas.
        </Empty>
      </div>
    );

  const bases = project.screens.filter((s) => !s.variantOf);
  const groupId = baseId(screen);
  const group = project.screens.filter((s) => baseId(s) === groupId);

  const createVariant = (bp: Breakpoint) => {
    const base = project.screens.find((s) => s.id === groupId)!;
    const v: Screen = {
      id: uid('s_'),
      name: base.name,
      breakpoint: bp,
      variantOf: base.id,
      terminal: base.terminal,
      blocks: base.blocks.map((b) => ({ ...clone(b), id: uid('b_') })),
    };
    if (apply([edit.addScreen(project, v)], `Crear variante ${BREAKPOINTS.find((b) => b.id === bp)!.label.toLowerCase()} de «${base.name}»`)) {
      setScreenId(v.id);
      setBlockId(undefined);
    }
  };

  const deleteScreen = () => {
    if (screen.id === project.startScreenId) return notify('Es la pantalla de inicio. Elige otra como inicio antes de eliminarla.', 'error');
    const targets = project.screens
      .map((s, i) => ({ s, i }))
      .filter((x) => (screen.variantOf ? x.s.id === screen.id : baseId(x.s) === screen.id))
      .sort((a, b) => b.i - a.i);
    const ops: OpInput[] = targets.map((x) => ({ kind: 'remove', path: ['screens'], index: x.i }));
    if (apply(ops, `Eliminar «${screen.name}»${targets.length > 1 ? ' y sus variantes' : ''}`)) {
      setScreenId(screen.variantOf ?? project.startScreenId);
      setBlockId(undefined);
    }
  };

  const insertBlock = (b: Block) => {
    const i = block ? screen.blocks.findIndex((x) => x.id === block.id) + 1 : screen.blocks.length;
    if (apply([edit.addBlock(project, screen.id, b, i)], `Agregar ${blockMeta(b.type).label.toLowerCase()}`)) {
      setBlockId(b.id);
      setPanel('inspect');
    }
  };

  const goIssue = (i: Issue) => {
    if (i.screenId) {
      setScreenId(i.screenId);
      setBlockId(i.blockId);
      setPlay(false);
      setPanel('inspect');
    }
  };

  return (
    <div className="editor">
      <aside className="screens-list" aria-label="Pantallas">
        <div className="sl-head">
          <strong>Pantallas</strong>
          {editable && (
            <Button size="sm" onClick={addScreen}>
              Agregar
            </Button>
          )}
        </div>
        {bases.map((s) => (
          <div key={s.id}>
            <button
              type="button"
              className="sl-item"
              aria-current={screen.id === s.id}
              onClick={() => {
                setScreenId(s.id);
                setBlockId(undefined);
              }}
            >
              <span className="sl-name">{s.name}</span>
              <span className="sl-tags">
                {s.id === project.startScreenId && <Badge tone="accent">Inicio</Badge>}
                {s.terminal && <Badge>Final</Badge>}
              </span>
            </button>
            {project.screens
              .filter((v) => v.variantOf === s.id)
              .map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="sl-item sl-variant"
                  aria-current={screen.id === v.id}
                  onClick={() => {
                    setScreenId(v.id);
                    setBlockId(undefined);
                  }}
                >
                  {BREAKPOINTS.find((b) => b.id === v.breakpoint)!.label}
                </button>
              ))}
          </div>
        ))}
        {editable && (
          <Button size="sm" tone="ghost" className="sl-import" onClick={() => setImportOpen(true)}>
            Importar pantalla desde HTML
          </Button>
        )}
      </aside>

      <section className="mat" aria-label="Lienzo">
        <div className="mat-toolbar">
          <Tabs
            small
            label="Dispositivo"
            value={screen.breakpoint}
            onChange={(bp) => {
              const existing = group.find((s) => s.breakpoint === bp);
              if (existing) {
                setScreenId(existing.id);
                setBlockId(undefined);
              } else if (editable) createVariant(bp);
              else notify('Esta pantalla no tiene variante para ese dispositivo.', 'info');
            }}
            items={BREAKPOINTS.map((b) => ({
              id: b.id,
              label: group.some((s) => s.breakpoint === b.id) ? b.label : `${b.label} +`,
            }))}
          />
          <Tabs
            small
            label="Modo de color"
            value={mode}
            onChange={setMode}
            items={[
              { id: 'light', label: 'Claro' },
              { id: 'dark', label: 'Oscuro' },
            ]}
          />
          <Tabs
            small
            label="Fidelidad"
            value={wireframe ? 'wire' : 'hifi'}
            onChange={(v) => setWireframe(v === 'wire')}
            items={[
              { id: 'hifi', label: 'Alta fidelidad' },
              { id: 'wire', label: 'Wireframe' },
            ]}
          />
          <div className="grow" />
          <Button tone={play ? 'primary' : 'default'} size="sm" onClick={() => setPlay((v) => !v)} aria-pressed={play}>
            {play ? 'Volver a editar' : 'Probar prototipo'}
          </Button>
        </div>

        <div className={`guard ${errors ? 'has-errors' : warnings ? 'has-warnings' : 'clean'}`}>
          <button type="button" className="guard-summary" aria-expanded={guardOpen} onClick={() => setGuardOpen((v) => !v)}>
            <span className={`dot ${errors ? 'dot-error' : warnings ? 'dot-warning' : 'dot-ok'}`} aria-hidden="true" />
            <strong>Guardarraíl</strong>
            <span>
              {errors === 0 && warnings === 0
                ? 'Flujo, contraste y sistema en orden. Listo para probar con personas.'
                : `${errors} ${errors === 1 ? 'error crítico' : 'errores críticos'} y ${warnings} ${warnings === 1 ? 'aviso' : 'avisos'}${errors ? '. Corrige los errores antes de publicar un estudio.' : '.'}`}
            </span>
            {issues.length > 0 && <span className="guard-toggle">{guardOpen ? 'Ocultar' : 'Ver detalle'}</span>}
          </button>
          {guardOpen && issues.length > 0 && (
            <ul className="issues">
              {issues.map((i) => (
                <li key={i.id}>
                  {i.screenId ? (
                    <button type="button" className="issue" onClick={() => goIssue(i)}>
                      <span className={`dot dot-${i.severity}`} aria-hidden="true" />
                      <span>
                        <span className="issue-area">{AREA_LABEL[i.area]}</span> {i.message}
                      </span>
                    </button>
                  ) : (
                    <a className="issue" href={href(`/p/${project.id}/system`)}>
                      <span className={`dot dot-${i.severity}`} aria-hidden="true" />
                      <span>
                        <span className="issue-area">{AREA_LABEL[i.area]}</span> {i.message}
                      </span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mat-stage">
          <div className="ruler" aria-hidden="true" />
          {play ? (
            <Runner key={`${screen.id}-${project.version}`} project={project} startScreenId={screen.id} breakpoint={screen.breakpoint} mode={mode} />
          ) : (
            <ScreenCanvas project={project} screen={screen} mode={mode} wireframe={wireframe} selectedBlockId={blockId} onSelect={setBlockId} measures />
          )}
        </div>
      </section>

      <aside className="inspector" aria-label="Inspector">
        <div className="insp-tabs">
          <Tabs
            label="Panel"
            value={panel}
            onChange={setPanel}
            items={[
              { id: 'inspect', label: 'Inspector' },
              { id: 'comments', label: 'Comentarios' },
              { id: 'copilot', label: 'Copiloto' },
            ]}
          />
        </div>
        {panel === 'inspect' &&
          (block ? (
            <BlockInspector key={block.id} project={project} screen={screen} block={block} editable={editable} onSelect={setBlockId} />
          ) : (
            <ScreenInspector key={screen.id} project={project} screen={screen} editable={editable} onDelete={deleteScreen} />
          ))}
        {panel === 'inspect' && editable && <BlockPalette project={project} onAdd={insertBlock} after={block} />}
        {panel === 'comments' && <CommentsPanel project={project} screen={screen} block={block} canComment={can(role, 'comment')} />}
        {panel === 'copilot' && (
          <div className="insp-section">
            <CopilotPanel
              project={project}
              screen={screen}
              editable={editable}
              onApplied={(id) => {
                setScreenId(id);
                setBlockId(undefined);
                setPanel('inspect');
              }}
              onSelectBlock={(id) => {
                setBlockId(id);
                setPlay(false);
                setPanel('inspect');
              }}
            />
          </div>
        )}
      </aside>

      <ImportHtmlModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(name, blocks) => {
          const s: Screen = { id: uid('s_'), name, breakpoint: 'mobile', blocks };
          if (apply([edit.addScreen(project, s)], `Importar «${name}» desde HTML`)) {
            setScreenId(s.id);
            setBlockId(undefined);
            setImportOpen(false);
            notify(`Importaste ${blocks.length} bloques. Vincúlalos a componentes para que hereden el sistema.`, 'success');
          }
        }}
      />
    </div>
  );
}

function ScreenInspector({ project, screen, editable, onDelete }: { project: Project; screen: Screen; editable: boolean; onDelete: () => void }) {
  const apply = (ops: OpInput[], label: string) => applyOps(project.id, ops, label);
  const base = project.screens.find((s) => s.id === baseId(screen))!;
  return (
    <div className="insp-section stack">
      <h3 className="insp-title">Pantalla</h3>
      <Field label="Nombre">
        <CommitInput
          value={screen.name}
          disabled={!editable || !!screen.variantOf}
          onCommit={(v) => {
            if (!v.trim()) return;
            // El nombre se comparte entre variantes
            const ops = project.screens.filter((s) => baseId(s) === base.id).map((s) => edit.screen(project, s.id, 'name', v.trim()));
            apply(ops, `Renombrar pantalla a «${v.trim()}»`);
          }}
        />
      </Field>
      {screen.variantOf && <p className="muted small">Variante de «{base.name}» para {BREAKPOINTS.find((b) => b.id === screen.breakpoint)!.label.toLowerCase()}. El nombre y las conexiones se definen en la base.</p>}
      <label className="check">
        <input
          type="checkbox"
          checked={!!base.terminal}
          disabled={!editable}
          onChange={(e) => apply([edit.screen(project, base.id, 'terminal', e.target.checked || undefined)], e.target.checked ? `Marcar «${base.name}» como final` : `Desmarcar «${base.name}» como final`)}
        />
        <span>Es una pantalla final del flujo (no necesita salida)</span>
      </label>
      <div className="row">
        {base.id !== project.startScreenId && (
          <Button size="sm" disabled={!editable} onClick={() => apply([edit.project('startScreenId', base.id)], `Usar «${base.name}» como inicio`)}>
            Usar como inicio
          </Button>
        )}
        <Button size="sm" tone="danger" disabled={!editable} onClick={onDelete}>
          {screen.variantOf ? 'Eliminar variante' : 'Eliminar pantalla'}
        </Button>
      </div>
      <p className="muted small">Selecciona un bloque en el lienzo para editarlo. Con un bloque seleccionado: Supr lo elimina y Alt + flechas lo mueve.</p>
    </div>
  );
}

function BlockInspector({ project, screen, block, editable, onSelect }: { project: Project; screen: Screen; block: Block; editable: boolean; onSelect: (id?: string) => void }) {
  const meta = blockMeta(block.type);
  const name = block.label || meta.label;
  const set = (key: keyof Block, value: unknown, label = `Editar «${name}»`) => applyOps(project.id, [edit.block(project, screen.id, block.id, key, value)], label);
  const index = screen.blocks.findIndex((b) => b.id === block.id);
  const comps = project.components.filter((c) => c.type === block.type);
  const comp = findComponent(project, block.componentId);
  const inherited = effectiveStyle(project, { ...block, overrides: undefined }, ['default']);
  const bases = project.screens.filter((s) => !s.variantOf);

  return (
    <div className="insp-section stack">
      <div className="row between">
        <h3 className="insp-title">{meta.label}</h3>
        {comp ? <Badge tone="accent">{comp.name}</Badge> : <Badge>Sin componente</Badge>}
      </div>

      {block.type !== 'divider' && (
        <Field label={meta.field ? 'Etiqueta visible' : 'Texto'}>
          <CommitInput value={block.label} disabled={!editable} onCommit={(v) => set('label', v)} />
        </Field>
      )}
      {['heading', 'input', 'amount', 'select', 'listItem', 'alert'].includes(block.type) && (
        <Field label={meta.field ? 'Texto de ayuda dentro del campo' : 'Texto secundario'}>
          <CommitInput value={block.detail ?? ''} disabled={!editable} onCommit={(v) => set('detail', v || undefined)} />
        </Field>
      )}
      {VARIANTS[block.type] && !comp && (
        <Field label="Variante">
          <select value={block.variant ?? ''} disabled={!editable} onChange={(e) => set('variant', e.target.value || undefined)}>
            {VARIANTS[block.type]!.map((v) => (
              <option key={v.v} value={v.v}>
                {v.l}
              </option>
            ))}
          </select>
        </Field>
      )}
      {comps.length > 0 && (
        <Field label="Componente del sistema" hint="La instancia hereda estilos y estados del maestro.">
          <select value={block.componentId ?? ''} disabled={!editable} onChange={(e) => set('componentId', e.target.value || undefined, e.target.value ? `Vincular «${name}» a componente` : `Desvincular «${name}»`)}>
            <option value="">Sin componente (bloque suelto)</option>
            {comps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {meta.interactive && !meta.field && (
        <>
          <Field label="Al tocar">
            <select
              value={block.action ?? 'none'}
              disabled={!editable}
              onChange={(e) => set('action', e.target.value === 'none' ? undefined : e.target.value, `Cambiar acción de «${name}»`)}
            >
              <option value="none">No hace nada</option>
              <option value="navigate">Ir a una pantalla</option>
              <option value="back">Volver a la anterior</option>
            </select>
          </Field>
          {block.action === 'navigate' && (
            <Field label="Destino">
              <select value={block.target ?? ''} disabled={!editable} onChange={(e) => set('target', e.target.value || undefined, `Conectar «${name}»`)}>
                <option value="">Elige una pantalla</option>
                {bases
                  .filter((s) => s.id !== baseId(screen))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        </>
      )}

      {block.type === 'select' && (
        <Field label="Opciones" hint="Una por línea.">
          <CommitInput
            multiline
            value={(block.options ?? []).join('\n')}
            disabled={!editable}
            onCommit={(v) =>
              set(
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
      {meta.field && (
        <label className="check">
          <input type="checkbox" checked={!!block.required} disabled={!editable} onChange={(e) => set('required', e.target.checked || undefined)} />
          <span>Obligatorio para continuar</span>
        </label>
      )}
      {meta.interactive && (
        <label className="check">
          <input type="checkbox" checked={!!block.disabled} disabled={!editable} onChange={(e) => set('disabled', e.target.checked || undefined)} />
          <span>Deshabilitado</span>
        </label>
      )}

      {block.type !== 'divider' && (
        <details className="overrides" open={!!block.overrides && Object.values(block.overrides).some(Boolean)}>
          <summary>Sobrescribir estilo de esta instancia</summary>
          <p className="muted small">Úsalo con cuidado: los valores sueltos se marcan en el guardarraíl.</p>
          <div className="picker-grid one">
            {STYLE_KEYS.filter((k) => k.key !== 'outline').map((k) => (
              <ValuePicker
                key={k.key}
                tokens={project.tokens}
                group={k.group}
                label={k.label}
                disabled={!editable}
                value={block.overrides?.[k.key]}
                inherited={inherited[k.key]}
                onChange={(v) => applyOps(project.id, [edit.blockOverride(project, screen.id, block.id, k.key, v)], `Sobrescribir ${k.label.toLowerCase()} de «${name}»`)}
              />
            ))}
          </div>
        </details>
      )}

      {editable && (
        <div className="row">
          <Button size="sm" disabled={index === 0} onClick={() => applyOps(project.id, [edit.moveBlock(project, screen.id, index, index - 1)], 'Mover bloque')}>
            Subir
          </Button>
          <Button size="sm" disabled={index === screen.blocks.length - 1} onClick={() => applyOps(project.id, [edit.moveBlock(project, screen.id, index, index + 1)], 'Mover bloque')}>
            Bajar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const copy = { ...clone(block), id: uid('b_') };
              if (applyOps(project.id, [edit.addBlock(project, screen.id, copy, index + 1)], `Duplicar «${name}»`)) onSelect(copy.id);
            }}
          >
            Duplicar
          </Button>
          <Button
            size="sm"
            tone="danger"
            onClick={() => {
              if (applyOps(project.id, [edit.removeBlock(project, screen.id, block.id)], `Eliminar «${name}»`)) onSelect(undefined);
            }}
          >
            Eliminar
          </Button>
        </div>
      )}
    </div>
  );
}

function BlockPalette({ project, onAdd, after }: { project: Project; onAdd: (b: Block) => void; after?: Block }) {
  return (
    <div className="insp-section">
      <h3 className="insp-title">{after ? `Agregar después de «${after.label || blockMeta(after.type).label}»` : 'Agregar bloque'}</h3>
      <p className="palette-label">Desde el sistema</p>
      <div className="palette">
        {project.components.map((c) => (
          <button key={c.id} type="button" className="chip" onClick={() => onAdd(newBlock(c.type, c.id, c.variant))}>
            {c.name}
          </button>
        ))}
      </div>
      <p className="palette-label">Bloque suelto</p>
      <div className="palette">
        {BLOCK_TYPES.map((t) => (
          <button key={t.type} type="button" className="chip chip-quiet" onClick={() => onAdd(newBlock(t.type))}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function renderMentions(text: string) {
  return text.split(/(@[\p{L}\p{N}._-]+)/u).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="mention">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function CommentsPanel({ project, screen, block, canComment }: { project: Project; screen: Screen; block?: Block; canComment: boolean }) {
  const db = useDb();
  const [text, setText] = useState('');
  const list = db.comments
    .filter((c) => c.projectId === project.id && c.screenId === screen.id && (!block || c.blockId === block.id))
    .sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.at - a.at);
  const label = (id?: string) => (id ? screen.blocks.find((b) => b.id === id)?.label || 'bloque eliminado' : 'la pantalla');

  return (
    <div className="insp-section stack">
      <h3 className="insp-title">{block ? `Comentarios en «${block.label || blockMeta(block.type).label}»` : `Comentarios en «${screen.name}»`}</h3>
      {canComment && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (addComment(project.id, screen.id, block?.id, text)) setText('');
          }}
        >
          <textarea className="input" rows={3} aria-label="Nuevo comentario" placeholder="Escribe un comentario. Menciona con @nombre." value={text} onChange={(e) => setText(e.target.value)} />
          <Button size="sm" type="submit" disabled={!text.trim()}>
            Comentar {block ? 'en este bloque' : 'en la pantalla'}
          </Button>
        </form>
      )}
      {list.length === 0 ? (
        <p className="muted small">Sin comentarios todavía.</p>
      ) : (
        <ul className="plain-list">
          {list.map((c) => (
            <li key={c.id} className={`comment ${c.resolved ? 'resolved' : ''}`}>
              <div className="row between">
                <strong>{userName(db, c.author)}</strong>
                <span className="muted small">{timeAgo(c.at)}</span>
              </div>
              {!block && <span className="muted small">Sobre {label(c.blockId)}</span>}
              <p>{renderMentions(c.text)}</p>
              {canComment && (
                <button type="button" className="link-btn" onClick={() => resolveComment(c.id, !c.resolved)}>
                  {c.resolved ? 'Reabrir' : 'Marcar como resuelto'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ImportHtmlModal({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (name: string, blocks: Block[]) => void }) {
  const [html, setHtml] = useState('');
  const [name, setName] = useState('Pantalla importada');
  const blocks = useMemo(() => {
    try {
      return html.trim() ? importHtml(html) : [];
    } catch {
      return [];
    }
  }, [html]);
  return (
    <Modal
      open={open}
      wide
      title="Importar pantalla desde HTML"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button tone="primary" disabled={!blocks.length} onClick={() => onImport(name.trim() || 'Pantalla importada', blocks)}>
            Importar {blocks.length} bloques
          </Button>
        </>
      }
    >
      <Field label="Nombre de la pantalla">
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="HTML" hint="Reconoce títulos, párrafos, campos (con su label), selectores, botones, enlaces, imágenes y separadores.">
        <textarea className="input input-code" rows={10} value={html} onChange={(e) => setHtml(e.target.value)} placeholder={'<h2>Datos de contacto</h2>\n<label for="mail">Correo</label>\n<input id="mail" type="email" required>\n<button>Guardar</button>'} />
      </Field>
      {blocks.length > 0 && (
        <p className="ok-text">
          Se detectaron: {blocks.map((b) => blockMeta(b.type).label.toLowerCase()).join(', ')}.
        </p>
      )}
    </Modal>
  );
}
