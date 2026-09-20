import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Block, BlockType, Breakpoint, Component, Hotspot, Mode, OpInput, Project, Role, Screen } from '../lib/model';
import { BLOCK_TYPES, BREAKPOINTS, STYLE_KEYS, baseId, blockMeta, breakpointOf, optionKeys, plainText } from '../lib/model';
import { addComment, applyOps, canRedo, canUndo, getDb, redo, releasesFor, resolveComment, undo, useDb, userName } from '../lib/store';
import { can } from '../lib/permissions';
import { clone, edit } from '../lib/ops';
import { checkProject, AREA_LABEL, type Issue } from '../lib/flowCheck';
import { colorValue, effectiveStyle, findComponent } from '../lib/tokens';
import { importHtml } from '../lib/importer';
import { uid } from '../lib/ids';
import { notify } from '../lib/toast';
import { href } from '../lib/router';
import { FONT_INTER } from '../lib/seed';
import { OPTION_HINT, categoryOf, componentSample, componentSummary, projectCategories, sampleContent } from '../lib/catalog';
import { ScreenCanvas } from '../components/ScreenCanvas';
import { FigmaImportModal } from '../components/FigmaImportModal';
import { Runner } from '../components/Runner';
import { BlockView } from '../components/BlockView';
import { FitPreview } from '../components/FitPreview';
import { CopilotPanel } from '../components/CopilotPanel';
import { ColorCell, CommitInput, CommitNumber, ValuePicker } from '../components/inputs';
import { Button, Field, Modal, Tabs, timeAgo } from '../components/ui';
import { IconArrowUpRight, IconChevronRight, IconCursor, IconDiamond, IconExpand, IconFileImage, IconFrame, IconLink, IconMessage, IconMinus, IconMoon, IconPlay, IconPlus, IconRedo, IconSearch, IconShield, IconSliders, IconSparkle, IconSun, IconUndo } from '../components/icons';


/** Bloque que instancia un componente, con su contenido de ejemplo propio. */
function blockFromComponent(c: Component, brand?: string): Block {
  return { id: uid('b_'), type: c.type, ...componentSample(c, brand), ...(c.variant ? { variant: c.variant } : {}), componentId: c.id } as Block;
}

/** Bloque nuevo con el contenido de ejemplo de su patrón y variante (el mismo de las vistas previas del sistema). */
function newBlock(type: BlockType, componentId?: string, variant?: string, brand?: string): Block {
  return { id: uid('b_'), type, ...sampleContent(type, variant, brand), ...(variant ? { variant } : {}), ...(componentId ? { componentId } : {}) } as Block;
}

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
  navbar: [
    { v: '', l: 'Marca' },
    { v: 'app', l: 'Barra de la app' },
    { v: 'title', l: 'Título con volver' },
    { v: 'close', l: 'Cierre' },
  ],
  listItem: [
    { v: '', l: 'Fila' },
    { v: 'icon', l: 'Fila destacada con ícono' },
    { v: 'profile', l: 'Perfil' },
    { v: 'contact', l: 'Contacto' },
    { v: 'notification', l: 'Notificación' },
    { v: 'logout', l: 'Cerrar sesión' },
  ],
  tabs: [
    { v: '', l: 'Segmentadas' },
    { v: 'underline', l: 'Subrayadas' },
  ],
  radio: [
    { v: '', l: 'Lista' },
    { v: 'numbers', l: 'Números en fila' },
  ],
  input: [
    { v: '', l: 'Campo' },
    { v: 'search', l: 'Buscador' },
  ],
  carousel: [
    { v: 'promo', l: 'Promociones' },
    { v: 'contacts', l: 'Contactos' },
    { v: 'feature', l: 'Destacado' },
  ],
  menuList: [
    { v: '', l: 'Tarjeta con opciones' },
    { v: 'info', l: 'Datos sin navegación' },
    { v: 'plain', l: 'Menú sin tarjeta' },
  ],
  accountCard: [
    { v: '', l: 'Cuenta' },
    { v: 'summary', l: 'Resumen' },
  ],
  iconGrid: [
    { v: '', l: 'En tarjeta' },
    { v: 'flat', l: 'Sin tarjeta (para hojas)' },
  ],
};

const FONTS = [
  { label: 'Inter / Sans serif', value: FONT_INTER },
  { label: 'Sistema', value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { label: 'Serif', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Monoespaciada', value: "'JetBrains Mono', ui-monospace, monospace" },
];

const BP_EYEBROW: Record<Breakpoint, string> = { mobile: 'EXPERIENCIA MÓVIL', tablet: 'EXPERIENCIA TABLET', desktop: 'EXPERIENCIA ESCRITORIO' };
const FRAME_GAP = 36;
const clampZoom = (z: number) => Math.round(Math.max(0.3, Math.min(1.25, z)) * 100) / 100;

type Panel = 'props' | 'comments' | 'ai';

export function ScreensView({ project, role, initialScreen, openAi, openPlay }: { project: Project; role: Role; initialScreen?: string; openAi?: boolean; openPlay?: boolean }) {
  const editable = can(role, 'edit');
  const db = useDb();
  const [screenId, setScreenId] = useState(() => (initialScreen && project.screens.some((s) => s.id === initialScreen) ? initialScreen : project.startScreenId));
  const [blockId, setBlockId] = useState<string>();
  const [bp, setBp] = useState<Breakpoint>('mobile');
  const [mode, setMode] = useState<Mode>('light');
  const [wireframe, setWireframe] = useState(false);
  const [play, setPlay] = useState(false);
  const [panel, setPanel] = useState<Panel>(openAi ? 'ai' : 'props');
  const [explorer, setExplorer] = useState<'screens' | 'components'>('screens');
  const [q, setQ] = useState('');
  const [zoom, setZoom] = useState(0.75);
  const [guardOpen, setGuardOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [figmaOpen, setFigmaOpen] = useState(false);
  const [dibujando, setDibujando] = useState(false);
  const [drag, setDrag] = useState<string>();
  const [dropOn, setDropOn] = useState<string>();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openAi) setPanel('ai');
  }, [openAi]);
  useEffect(() => {
    if (openPlay) setPlay(true);
  }, [openPlay]);
  useEffect(() => {
    if (initialScreen && project.screens.some((s) => s.id === initialScreen)) setScreenId(initialScreen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScreen]);

  const bases = project.screens.filter((s) => !s.variantOf);
  const screen = project.screens.find((s) => s.id === screenId) ?? project.screens.find((s) => s.id === project.startScreenId) ?? project.screens[0];
  const block = screen?.blocks.find((b) => b.id === blockId);
  const issues = useMemo(() => checkProject(project), [project]);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  const apply = (ops: OpInput[], label: string) => applyOps(project.id, ops, label);
  const bpInfo = breakpointOf(bp);
  const frameW = bpInfo.width * zoom;
  const frameH = bpInfo.height * zoom;

  const select = (sid: string, bid?: string) => {
    setScreenId(sid);
    setBlockId(bid);
  };

  const addScreen = () => {
    const nav = project.components.find((c) => c.type === 'navbar' && c.variant === 'title') ?? project.components.find((c) => c.type === 'navbar');
    const navBlock = nav ? blockFromComponent(nav, project.brand) : newBlock('navbar', undefined, undefined, project.brand);
    if (nav?.variant === 'title') Object.assign(navBlock, { label: 'Nueva pantalla', value: undefined, detail: undefined });
    const heading = project.components.find((c) => c.type === 'heading' && c.variant !== 'display');
    const s: Screen = {
      id: uid('s_'),
      name: 'Nueva pantalla',
      breakpoint: 'mobile',
      blocks: [navBlock, { ...(heading ? blockFromComponent(heading, project.brand) : newBlock('heading', undefined, 'title', project.brand)), label: 'Título de la pantalla', detail: 'Texto de apoyo' }],
    };
    const ops = [edit.addScreen(project, s)];
    if (!project.screens.some((x) => x.id === project.startScreenId)) ops.push(edit.project('startScreenId', s.id));
    if (apply(ops, 'Agregar pantalla')) {
      select(s.id);
      setBp('mobile');
      requestAnimationFrame(() => scroller.current?.scrollTo({ left: scroller.current.scrollWidth, behavior: 'smooth' }));
    }
  };

  useEffect(() => {
    if (!editable || !block || !screen || play) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest('input, textarea, select, [contenteditable], dialog')) return;
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
        <div className="empty">
          <h3>Este proyecto no tiene pantallas</h3>
          <p>Las pantallas se conectan por acciones y se prueban tal como las diseñas.</p>
          {editable && (
            <Button tone="primary" onClick={addScreen}>
              Crear la primera pantalla
            </Button>
          )}
        </div>
      </div>
    );

  const createVariant = (base: Screen, target: Breakpoint) => {
    const v: Screen = { id: uid('s_'), name: base.name, breakpoint: target, variantOf: base.id, terminal: base.terminal, blocks: base.blocks.map((b) => ({ ...clone(b), id: uid('b_') })) };
    if (apply([edit.addScreen(project, v)], `Crear variante ${BREAKPOINTS.find((b) => b.id === target)!.label.toLowerCase()} de «${base.name}»`)) select(v.id);
  };

  const deleteScreen = () => {
    if (screen.id === project.startScreenId) return notify('Es la pantalla de inicio. Elige otra como inicio antes de eliminarla.', 'error');
    const targets = project.screens
      .map((s, i) => ({ s, i }))
      .filter((x) => (screen.variantOf ? x.s.id === screen.id : baseId(x.s) === screen.id))
      .sort((a, b) => b.i - a.i);
    const ops: OpInput[] = targets.map((x) => ({ kind: 'remove', path: ['screens'], index: x.i }));
    if (apply(ops, `Eliminar «${screen.name}»${targets.length > 1 ? ' y sus variantes' : ''}`)) select(screen.variantOf ?? project.startScreenId);
  };

  const duplicateScreen = () => {
    const base = project.screens.find((s) => s.id === baseId(screen))!;
    const copy: Screen = { ...clone(base), id: uid('s_'), name: `${base.name} (copia)`, blocks: base.blocks.map((b) => ({ ...clone(b), id: uid('b_') })) };
    const index = project.screens.findIndex((s) => s.id === base.id) + 1;
    if (apply([edit.addScreen(project, copy, index)], `Duplicar «${base.name}»`)) {
      setBp(copy.breakpoint);
      select(copy.id);
    }
  };

  const moveInTree = (fromId?: string, toId?: string) => {
    const from = screen.blocks.findIndex((b) => b.id === fromId);
    const to = screen.blocks.findIndex((b) => b.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    apply([edit.moveBlock(project, screen.id, from, to)], 'Mover bloque');
  };

  const insertBlock = (b: Block) => {
    let i = block ? screen.blocks.findIndex((x) => x.id === block.id) + 1 : screen.blocks.length;
    // La barra inferior queda siempre al final: lo nuevo entra antes de ella.
    if (b.type !== 'tabBar' && screen.blocks[i - 1]?.type === 'tabBar') i -= 1;
    if (apply([edit.addBlock(project, screen.id, b, i)], `Agregar ${blockMeta(b.type).label.toLowerCase()} en «${screen.name}»`)) {
      setBlockId(b.id);
      setPanel('props');
    }
  };

  /** Zona dibujada a mano sobre una pantalla-imagen (por ejemplo, si el Figma no traía flechas). */
  const agregarZona = (r: { x: number; y: number; w: number; h: number }) => {
    const zonas = screen.hotspots ?? [];
    const zona: Hotspot = { id: uid('h_'), ...r, label: `Zona ${zonas.length + 1}` };
    if (apply([edit.screen(project, screen.id, 'hotspots', [...zonas, zona])], `Agregar zona en «${screen.name}»`)) {
      setDibujando(false);
      setBlockId(zona.id);
      setPanel('props');
      notify('Zona creada. Elige a qué pantalla lleva.', 'success');
    }
  };

  const goIssue = (i: Issue) => {
    setGuardOpen(false);
    if (i.screenId) {
      const s = project.screens.find((x) => x.id === i.screenId);
      if (s) setBp(s.breakpoint);
      select(i.screenId, i.blockId);
      setPanel('props');
    }
  };

  const scrollToFrame = (index: number) => scroller.current?.scrollTo({ left: Math.max(0, index * (frameW + FRAME_GAP) - 40), behavior: 'smooth' });
  const fit = () => {
    const w = (scroller.current?.clientWidth ?? 1000) - 80;
    setZoom(clampZoom(w / (bases.length * (bpInfo.width + FRAME_GAP / 0.75))));
  };
  const connected = (from: Screen, toId: string) => project.screens.some((s) => baseId(s) === from.id && s.blocks.some((x) => x.action === 'navigate' && x.target === toId));
  const match = (text: string) => !q.trim() || text.toLowerCase().includes(q.trim().toLowerCase());
  const libVersion = project.library?.version ?? releasesFor(db, project.id)[0]?.version;
  const commentCount = db.comments.filter((c) => c.projectId === project.id && c.screenId === screen.id && !c.resolved).length;

  return (
    <div className="studio">
      <aside className="explorer" aria-label="Explorador">
        <div className="panel-head">
          <h2>Explorador</h2>
          {editable && (
            <button type="button" className="icon-btn" aria-label="Nueva pantalla" title="Nueva pantalla" onClick={addScreen}>
              <IconPlus size={18} />
            </button>
          )}
        </div>
        <div className="explorer-tabs">
          <Tabs
            small
            label="Contenido del explorador"
            value={explorer}
            onChange={setExplorer}
            items={[
              { id: 'screens', label: 'Pantallas' },
              { id: 'components', label: 'Componentes' },
            ]}
          />
        </div>
        <label className="search">
          <IconSearch size={15} />
          <input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={explorer === 'screens' ? 'Buscar pantallas' : 'Buscar componentes'} />
        </label>
        <div className="explorer-body">
          {explorer === 'screens' ? (
            <>
              <div className="lib-head">
                <span>{(project.flowName || 'Flujo principal').toUpperCase()}</span>
                <span>{bases.length}</span>
              </div>
              {bases.map((s, i) => {
                const open = baseId(screen) === s.id;
                const shown = open ? screen : s;
                const blocks = shown.blocks;
                const blockName = (b: Block) => plainText(b.label) || blockMeta(b.type).label;
                if (!match(s.name) && !blocks.some((b) => match(blockName(b)))) return null;
                return (
                  <div key={s.id}>
                    <button
                      type="button"
                      className="tree-row tree-screen"
                      aria-current={open && !blockId}
                      aria-expanded={open}
                      onClick={() => {
                        const variant = s.breakpoint === bp ? s : project.screens.find((v) => v.variantOf === s.id && v.breakpoint === bp);
                        if (!variant) setBp(s.breakpoint);
                        select((variant ?? s).id);
                        scrollToFrame(i);
                      }}
                    >
                      <IconFrame size={17} />
                      <span className="tree-name">
                        {String(i + 1).padStart(2, '0')} · {s.name}
                      </span>
                      {s.id === project.startScreenId && (
                        <span className="tree-start" title="Pantalla de inicio">
                          <IconPlay size={15} />
                        </span>
                      )}
                    </button>
                    {open && (
                      <div className="tree-children">
                        {blocks
                          .filter((b) => match(s.name) || match(blockName(b)))
                          .map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              className={`tree-row tree-block ${dropOn === b.id && drag && drag !== b.id ? 'drop-target' : ''} ${drag === b.id ? 'dragging' : ''}`}
                              aria-current={blockId === b.id}
                              draggable={editable}
                              title={editable ? 'Arrastra para reordenar' : undefined}
                              onDragStart={(e) => {
                                setDrag(b.id);
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', b.id);
                              }}
                              onDragOver={(e) => {
                                if (!drag) return;
                                e.preventDefault();
                                setDropOn(b.id);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                moveInTree(drag, b.id);
                                setDrag(undefined);
                                setDropOn(undefined);
                              }}
                              onDragEnd={() => {
                                setDrag(undefined);
                                setDropOn(undefined);
                              }}
                              onClick={() => {
                                setBlockId(b.id);
                                setPanel('props');
                              }}
                            >
                              <IconDiamond size={14} />
                              <span className="tree-name">{blockName(b)}</span>
                              <span className="tree-type">{blockMeta(b.type).label}</span>
                            </button>
                          ))}
                        {project.screens
                          .filter((v) => v.variantOf === s.id)
                          .map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              className="tree-row tree-block tree-variant"
                              aria-current={screen.id === v.id && !blockId}
                              onClick={() => {
                                setBp(v.breakpoint);
                                select(v.id);
                                scrollToFrame(i);
                              }}
                            >
                              <IconFrame size={13} />
                              <span className="tree-name">Variante {BREAKPOINTS.find((b) => b.id === v.breakpoint)!.label.toLowerCase()}</span>
                            </button>
                          ))}
                        {editable && blocks.length > 1 && <span className="tree-hint">Arrastra para reordenar, o Alt + ↑ ↓</span>}
                      </div>
                    )}
                  </div>
                );
              })}
              {editable && (
                <>
                  <button type="button" className="tree-row tree-add" onClick={addScreen}>
                    <IconPlus size={16} /> Nueva pantalla
                  </button>
                  <button type="button" className="tree-action" onClick={() => setImportOpen(true)}>
                    Importar pantalla desde HTML
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <div className="lib-head">
                <span>BIBLIOTECA DEL PROYECTO</span>
                <span>{project.components.length}</span>
              </div>
              {editable &&
                (project.components.length ? (
                  <p className="lib-help">Toca un componente para agregarlo a «{screen.name}».</p>
                ) : (
                  <p className="lib-help">Este proyecto no tiene sistema de diseño. Sus pantallas vienen de imágenes; si vas a armarlas aquí, agrega la biblioteca desde Sistema.</p>
                ))}
              {projectCategories(project).map((cat) => {
                const items = project.components.filter((c) => categoryOf(c, project) === cat.id && (match(c.name) || match(blockMeta(c.type).label)));
                if (!items.length) return null;
                return (
                  <div key={cat.id} className="lib-group">
                    <div className="lib-sub">
                      {cat.label} <span>{items.length}</span>
                    </div>
                    {items.map((c) => {
                      const add = () => editable && insertBlock(blockFromComponent(c, project.brand));
                      return (
                        <div
                          key={c.id}
                          role="button"
                          tabIndex={editable ? 0 : -1}
                          aria-disabled={!editable}
                          aria-label={`Agregar ${c.name} a ${screen.name}`}
                          className="lib-tile"
                          title={componentSummary(c)}
                          onClick={add}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              add();
                            }
                          }}
                        >
                          <span className="lib-tile-view" aria-hidden="true" style={{ backgroundColor: colorValue(project.tokens, 'background', 'light', '#FFFFFF') }}>
                            <FitPreview width={343}>
                              <BlockView project={project} block={{ id: `lib-${c.id}`, type: c.type, componentId: c.id, ...componentSample(c, project.brand) } as Block} mode="light" />
                            </FitPreview>
                          </span>
                          <span className="lib-tile-meta">
                            <span className="lib-tile-text">
                              <strong>{c.name}</strong>
                              <span>{blockMeta(c.type).label}</span>
                            </span>
                            {editable && (
                              <span className="lib-tile-add" aria-hidden="true">
                                <IconPlus size={14} /> Agregar
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {editable && (
                <details className="loose">
                  <summary>Bloques sueltos, sin componente</summary>
                  <div className="palette">
                    {BLOCK_TYPES.filter((t) => match(t.label)).map((t) => (
                      <button key={t.type} type="button" className="chip chip-quiet" onClick={() => insertBlock(newBlock(t.type, undefined, undefined, project.brand))}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
        <a className="lib-card" href={href(`/p/${project.id}/library`)}>
          <span className="lib-card-icon">
            <IconDiamond size={18} />
          </span>
          <span className="lib-card-text">
            <strong>{project.brand} UI</strong>
            <span>
              {project.components.length} componentes · {libVersion ? `v${libVersion}` : 'sin publicar'}
            </span>
          </span>
          <i className={`status-dot ${libVersion ? 'on' : ''}`} aria-label={libVersion ? 'Biblioteca publicada' : 'Biblioteca sin publicar'} />
        </a>
      </aside>

      <section className="canvas-area" aria-label="Lienzo">
        <div className="canvas-top">
          <nav className="canvas-crumb" aria-label="Flujo">
            <span>{project.flowName || 'Flujo principal'}</span>
            <IconChevronRight size={14} />
            <span className="muted">
              {bases.length} {bases.length === 1 ? 'pantalla' : 'pantallas'}
            </span>
          </nav>
          <div className="canvas-tools">
            <Tabs small label="Dispositivo" value={bp} onChange={setBp} items={BREAKPOINTS.map((b) => ({ id: b.id, label: b.label }))} />
            <button type="button" className="icon-btn" aria-label={mode === 'light' ? 'Ver en modo oscuro' : 'Ver en modo claro'} title={mode === 'light' ? 'Modo oscuro' : 'Modo claro'} onClick={() => setMode((m) => (m === 'light' ? 'dark' : 'light'))}>
              {mode === 'light' ? <IconMoon size={17} /> : <IconSun size={17} />}
            </button>
            <Tabs
              small
              label="Fidelidad"
              value={wireframe ? 'wire' : 'hifi'}
              onChange={(v) => setWireframe(v === 'wire')}
              items={[
                { id: 'wire', label: 'Wireframe' },
                { id: 'hifi', label: 'Alta fidelidad' },
              ]}
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setPlay(true)}>
              <IconPlay size={14} /> Probar
            </button>
          </div>
        </div>

        <div
          className="canvas-scroll"
          ref={scroller}
          onClick={(e) => {
            const el = e.target as HTMLElement;
            if (el === e.currentTarget || el.classList.contains('frames') || el.classList.contains('canvas-head')) setBlockId(undefined);
          }}
        >
          <header className="canvas-head">
            <div>
              <span className="eyebrow">
                <i aria-hidden="true" /> {BP_EYEBROW[bp]}
              </span>
              <h1 className="canvas-title">{project.tagline || project.name}</h1>
              {project.summary && <p className="canvas-sub">{project.summary}</p>}
            </div>
            <div className="guard-wrap">
              <button type="button" className={`sys-pill ${errors ? 'err' : ''}`} aria-expanded={guardOpen} onClick={() => setGuardOpen((v) => !v)}>
                <IconShield size={14} />
                {errors ? `${errors} ${errors === 1 ? 'error crítico' : 'errores críticos'}` : 'Sistema conectado'}
                {warnings > 0 && <span className="sys-count">{warnings}</span>}
              </button>
              {guardOpen && (
                <div className="guard-pop" role="dialog" aria-label="Guardarraíl">
                  <strong>Guardarraíl de flujo, contraste y sistema</strong>
                  <p className="muted small">
                    {errors === 0 && warnings === 0
                      ? 'Todo en orden. Puedes publicar un estudio.'
                      : `${errors} ${errors === 1 ? 'error crítico' : 'errores críticos'} y ${warnings} ${warnings === 1 ? 'aviso' : 'avisos'}.${errors ? ' Corrige los errores antes de publicar un estudio.' : ''}`}
                  </p>
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
                </div>
              )}
            </div>
          </header>

          <div className="frames" style={{ gap: 0 }}>
            {bases.map((s, i) => {
              const shown = s.breakpoint === bp ? s : project.screens.find((v) => v.variantOf === s.id && v.breakpoint === bp);
              const isSel = !!shown && screen.id === shown.id;
              return (
                <Fragment key={s.id}>
                  <div className="frame" style={{ width: frameW }}>
                    <div className="frame-label">
                      <button type="button" className="frame-name" onClick={() => select(shown?.id ?? s.id)}>
                        <IconFrame size={13} /> {String(i + 1).padStart(2, '0')} — {s.name}
                      </button>
                      {s.id === project.startScreenId && (
                        <span className="frame-badge">
                          <IconPlay size={9} /> Inicio
                        </span>
                      )}
                    </div>
                    {shown ? (
                      <div className={`frame-device ${isSel ? 'is-selected' : ''}`}>
                        <ScreenCanvas
                          project={project}
                          screen={shown}
                          mode={mode}
                          wireframe={wireframe}
                          scale={zoom}
                          selectedBlockId={isSel ? blockId : undefined}
                          onSelect={(bid) => select(shown.id, bid)}
                          measures={isSel}
                          drawing={isSel && dibujando && !!shown.image && editable}
                          onDrawn={agregarZona}
                        />
                      </div>
                    ) : (
                      <div className="frame-missing" style={{ height: frameH }}>
                        <p>
                          «{s.name}» aún no tiene variante para {bpInfo.label.toLowerCase()}.
                        </p>
                        {editable && (
                          <Button size="sm" onClick={() => createVariant(s, bp)}>
                            Crear variante
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {i < bases.length - 1 && <div className={`connector ${connected(s, bases[i + 1].id) ? 'on' : ''}`} style={{ marginTop: 32 + Math.min(frameH, 560 * zoom) / 2 }} aria-hidden="true" />}
                </Fragment>
              );
            })}
            {editable && (
              <>
                <div className="connector" aria-hidden="true" />
                <button type="button" className="frame-add" style={{ height: Math.min(frameH, 420), width: Math.max(140, frameW * 0.6) }} onClick={addScreen}>
                  <IconPlus size={18} />
                  Nueva pantalla
                </button>
              </>
            )}
          </div>
        </div>

        {!block && (
          <p className="canvas-hint">
            <IconDiamond size={14} /> Selecciona un componente para editar sus propiedades e interacciones.
          </p>
        )}
        <div className="toolbar-float" role="toolbar" aria-label="Herramientas del lienzo">
          <button type="button" className="tool active" title="Seleccionar" aria-label="Seleccionar" aria-pressed="true">
            <IconCursor size={18} />
          </button>
          <button type="button" className="tool" title="Nueva pantalla" aria-label="Nueva pantalla" disabled={!editable} onClick={addScreen}>
            <IconFrame size={18} />
          </button>
          <button type="button" className="tool" title="Importar desde Figma" aria-label="Importar desde Figma" disabled={!editable} onClick={() => setFigmaOpen(true)}>
            <IconFileImage size={18} />
          </button>
          <button type="button" className="tool" title="Componentes del sistema" aria-label="Componentes del sistema" onClick={() => setExplorer('components')}>
            <IconDiamond size={18} />
          </button>
          <button type="button" className="tool" title="Asistente IA" aria-label="Asistente IA" onClick={() => setPanel('ai')}>
            <IconSparkle size={18} />
          </button>
          <span className="tool-sep" aria-hidden="true" />
          <button type="button" className="tool" title="Deshacer" aria-label="Deshacer" disabled={!editable || !canUndo(project.id)} onClick={() => undo(project.id)}>
            <IconUndo size={18} />
          </button>
          <button type="button" className="tool" title="Rehacer" aria-label="Rehacer" disabled={!editable || !canRedo(project.id)} onClick={() => redo(project.id)}>
            <IconRedo size={18} />
          </button>
        </div>
        <div className="zoom-float" role="group" aria-label="Zoom">
          <button type="button" className="tool sm" aria-label="Alejar" onClick={() => setZoom((z) => clampZoom(z - 0.1))}>
            <IconMinus size={15} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" className="tool sm" aria-label="Acercar" onClick={() => setZoom((z) => clampZoom(z + 0.1))}>
            <IconPlus size={15} />
          </button>
          <button type="button" className="tool sm" aria-label="Ajustar a la vista" title="Ajustar a la vista" onClick={fit}>
            <IconExpand size={15} />
          </button>
        </div>
      </section>

      <aside className="props" aria-label="Panel lateral">
        <div className="panel-head">
          <h2>{panel === 'props' ? 'Propiedades' : panel === 'comments' ? 'Comentarios' : 'Asistente IA'}</h2>
          <div className="head-icons">
            <button type="button" className={`icon-btn ${panel === 'props' ? 'on' : ''}`} aria-label="Propiedades" aria-pressed={panel === 'props'} onClick={() => setPanel('props')}>
              <IconSliders size={17} />
            </button>
            <button type="button" className={`icon-btn ${panel === 'comments' ? 'on' : ''}`} aria-label="Comentarios" aria-pressed={panel === 'comments'} onClick={() => setPanel('comments')}>
              <IconMessage size={17} />
              {commentCount > 0 && <span className="count-dot">{commentCount}</span>}
            </button>
          </div>
        </div>
        <div className="props-body">
          {panel === 'props' &&
            (block ? (
              <BlockProps key={block.id} project={project} screen={screen} block={block} editable={editable} onSelect={setBlockId} />
            ) : (
              <ScreenProps
                key={screen.id}
                project={project}
                screen={screen}
                editable={editable}
                onDelete={deleteScreen}
                onDuplicate={duplicateScreen}
                onAdd={insertBlock}
                drawing={dibujando}
                onDrawing={setDibujando}
              />
            ))}
          {panel === 'comments' && <CommentsPanel project={project} screen={screen} block={block} canComment={can(role, 'comment')} />}
          {panel === 'ai' && (
            <div className="props-section">
              <CopilotPanel
                project={project}
                screen={screen}
                editable={editable}
                onApplied={(id) => {
                  select(id);
                  setBp('mobile');
                  setPanel('props');
                  requestAnimationFrame(() => scroller.current?.scrollTo({ left: scroller.current.scrollWidth, behavior: 'smooth' }));
                }}
                onSelectBlock={(id) => {
                  setBlockId(id);
                  setPanel('props');
                }}
              />
            </div>
          )}
        </div>
        {panel !== 'ai' && (
          <button type="button" className="props-foot" onClick={() => setPanel('ai')}>
            <IconSparkle size={15} /> Explorar con IA <IconArrowUpRight size={13} />
          </button>
        )}
      </aside>

      {play && <PlayOverlay project={project} screen={screen} mode={mode} onClose={() => setPlay(false)} />}

      <FigmaImportModal
        open={figmaOpen}
        project={project}
        onClose={() => setFigmaOpen(false)}
        onDone={(id) => {
          const imported = getDb().projects.find((x) => x.id === project.id)?.screens.find((x) => x.id === id);
          if (imported) setBp(imported.breakpoint);
          select(id);
          setPanel('props');
        }}
      />

      <ImportHtmlModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(name, blocks) => {
          const s: Screen = { id: uid('s_'), name, breakpoint: 'mobile', blocks };
          if (apply([edit.addScreen(project, s)], `Importar «${name}» desde HTML`)) {
            select(s.id);
            setImportOpen(false);
            notify(`Importaste ${blocks.length} bloques. Vincúlalos a componentes para que hereden el sistema.`, 'success');
          }
        }}
      />
    </div>
  );
}

/** Destinos de una pantalla importada como imagen. */
function HotspotsSection({
  project,
  screen,
  editable,
  drawing,
  onDrawing,
}: {
  project: Project;
  screen: Screen;
  editable: boolean;
  drawing: boolean;
  onDrawing: (v: boolean) => void;
}) {
  const hotspots = screen.hotspots ?? [];
  const save = (next: Hotspot[], label: string) => applyOps(project.id, [edit.screen(project, screen.id, 'hotspots', next)], label);
  const targets = project.screens.filter((s) => !s.variantOf && s.id !== screen.id);
  return (
    <Section title="Zonas tocables" aside={hotspots.length ? `${hotspots.length}` : undefined}>
      {!hotspots.length && <p className="muted small">Esta pantalla no tiene zonas tocables. Llegan desde las flechas de prototipo de Figma, o las dibujas aquí sobre la imagen.</p>}
      {screen.autoNext && (
        <p className="muted small">
          Avanza sola {screen.autoNext.back ? 'a la pantalla anterior' : `a «${project.screens.find((s) => s.id === screen.autoNext!.target)?.name ?? 'otra pantalla'}»`} después de{' '}
          {(screen.autoNext.ms / 1000).toFixed(1).replace('.', ',')} s, como en Figma.
        </p>
      )}
      {editable && (
        <div className="row">
          <Button size="sm" tone={drawing ? 'primary' : undefined} aria-pressed={drawing} onClick={() => onDrawing(!drawing)}>
            {drawing ? 'Listo' : 'Dibujar zona'}
          </Button>
          {drawing && <span className="muted small">Arrastra sobre la imagen para marcar dónde se toca.</span>}
        </div>
      )}
      {hotspots.map((h, i) => (
        <Field key={h.id} label={h.label?.trim() || `Zona ${i + 1}`}>
          <div className="row">
            <select
              className="grow"
              value={h.back ? 'back' : (h.target ?? '')}
              disabled={!editable}
              onChange={(e) => {
                const v = e.target.value;
                const patch: Hotspot = v === 'back' ? { ...h, back: true, target: undefined } : { ...h, back: undefined, target: v || undefined };
                save(
                  hotspots.map((x) => (x.id === h.id ? patch : x)),
                  `Cambiar el destino de «${h.label || 'la zona'}»`,
                );
              }}
            >
              <option value="">Sin destino</option>
              <option value="back">Volver</option>
              {targets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {editable && (
              <Button
                size="sm"
                tone="ghost"
                onClick={() =>
                  save(
                    hotspots.filter((x) => x.id !== h.id),
                    'Quitar zona tocable',
                  )
                }
              >
                Quitar
              </Button>
            )}
          </div>
        </Field>
      ))}
    </Section>
  );
}

function Section({ title, aside, icon, children }: { title: string; aside?: ReactNode; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="props-section">
      <div className="props-section-head">
        <h3>{title}</h3>
        {aside && <span className="props-aside">{aside}</span>}
        {icon}
      </div>
      <div className="stack">{children}</div>
    </section>
  );
}

function GlobalTokens({ project, editable }: { project: Project; editable: boolean }) {
  const t = project.tokens;
  const pi = t.colors.findIndex((c) => c.name === 'primary');
  const ri = t.radius.findIndex((r) => r.name === 'lg');
  const si = t.space.findIndex((s) => s.name === 'lg');
  const fonts = FONTS.some((f) => f.value === t.fontFamily) ? FONTS : [...FONTS, { label: 'Personalizada', value: t.fontFamily }];
  return (
    <>
      {pi >= 0 && (
        <div className="grid-2">
          {(['light', 'dark'] as const).map((m) => (
            <Field key={m} label={m === 'light' ? 'Principal, claro' : 'Principal, oscuro'}>
              <ColorCell
                value={t.colors[pi][m]}
                disabled={!editable}
                label={`Color principal en modo ${m === 'light' ? 'claro' : 'oscuro'}`}
                onCommit={(v) => {
                  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim())) applyOps(project.id, [edit.token('colors', pi, m, v.trim().toUpperCase())], `Cambiar color principal (${m === 'light' ? 'claro' : 'oscuro'})`);
                  else notify('Usa un color hexadecimal, por ejemplo #0074C8.', 'error');
                }}
              />
            </Field>
          ))}
        </div>
      )}
      <div className="grid-2">
        {ri >= 0 && (
          <Field label="Radio">
            <CommitNumber value={t.radius[ri].value} label="Radio" disabled={!editable} onCommit={(n) => applyOps(project.id, [edit.token('radius', ri, 'value', n)], 'Cambiar radio global')} />
          </Field>
        )}
        {si >= 0 && (
          <Field label="Espaciado">
            <CommitNumber value={t.space[si].value} label="Espaciado" disabled={!editable} onCommit={(n) => applyOps(project.id, [edit.token('space', si, 'value', n)], 'Cambiar espaciado global')} />
          </Field>
        )}
      </div>
      <Field label="Tipografía">
        <select value={t.fontFamily} disabled={!editable} onChange={(e) => applyOps(project.id, [{ kind: 'set', path: ['tokens', 'fontFamily'], value: e.target.value }], 'Cambiar tipografía')}>
          {fonts.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

function ScreenProps({
  project,
  screen,
  editable,
  onDelete,
  onDuplicate,
  onAdd,
  drawing,
  onDrawing,
}: {
  project: Project;
  screen: Screen;
  editable: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onAdd: (b: Block) => void;
  drawing: boolean;
  onDrawing: (v: boolean) => void;
}) {
  const apply = (ops: OpInput[], label: string) => applyOps(project.id, ops, label);
  const base = project.screens.find((s) => s.id === baseId(screen))!;
  const setProject = (key: 'tagline' | 'summary' | 'flowName' | 'footnote', label: string) => (v: string) => apply([edit.project(key, v.trim() || undefined)], `Cambiar ${label}`);
  return (
    <>
      <div className="sel-card">
        <span className="sel-icon">
          <IconFrame size={18} />
        </span>
        <span className="sel-text">
          <strong>{screen.name}</strong>
          <span>
            Pantalla · {BREAKPOINTS.find((b) => b.id === screen.breakpoint)!.label}
            {screen.variantOf ? ' · variante' : ''}
          </span>
        </span>
      </div>
      {screen.image && <HotspotsSection project={project} screen={screen} editable={editable} drawing={drawing} onDrawing={onDrawing} />}
      <Section title="Contenido">
        <Field label="Nombre de pantalla">
          <CommitInput
            value={screen.name}
            disabled={!editable}
            onCommit={(v) => v.trim() && apply(project.screens.filter((s) => baseId(s) === base.id).map((s) => edit.screen(project, s.id, 'name', v.trim())), `Renombrar pantalla a «${v.trim()}»`)}
          />
        </Field>
        <label className="check">
          <input
            type="checkbox"
            checked={!!base.terminal}
            disabled={!editable}
            onChange={(e) => apply([edit.screen(project, base.id, 'terminal', e.target.checked || undefined)], e.target.checked ? `Marcar «${base.name}» como final` : `Desmarcar «${base.name}» como final`)}
          />
          <span>Pantalla final del flujo (no necesita salida)</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={base.presentation === 'sheet'}
            disabled={!editable}
            onChange={(e) =>
              apply(
                [edit.screen(project, base.id, 'presentation', e.target.checked ? 'sheet' : undefined)],
                e.target.checked ? `Abrir «${base.name}» como hoja inferior` : `Abrir «${base.name}» como pantalla completa`,
              )
            }
          />
          <span>Se abre como hoja inferior (modal sobre la pantalla anterior)</span>
        </label>
        {base.presentation === 'sheet' && (
          <Field label="Fondo en el lienzo" hint="En el prototipo se ve de fondo la pantalla desde donde se abrió.">
            <select value={base.sheetOver ?? project.startScreenId} disabled={!editable} onChange={(e) => apply([edit.screen(project, base.id, 'sheetOver', e.target.value)], `Cambiar el fondo de «${base.name}»`)}>
              {project.screens
                .filter((s) => !s.variantOf && s.id !== base.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <div className="row">
          {!screen.variantOf && (
            <Button size="sm" disabled={!editable} onClick={onDuplicate}>
              Duplicar pantalla
            </Button>
          )}
          {base.id !== project.startScreenId && (
            <Button size="sm" disabled={!editable} onClick={() => apply([edit.project('startScreenId', base.id)], `Usar «${base.name}» como inicio`)}>
              Usar como inicio
            </Button>
          )}
          <Button size="sm" tone="danger" disabled={!editable} onClick={onDelete}>
            {screen.variantOf ? 'Eliminar variante' : 'Eliminar pantalla'}
          </Button>
        </div>
      </Section>
      <Section title="Proyecto y lienzo">
        <Field label="Nombre del proyecto">
          <CommitInput value={project.name} disabled={!editable} onCommit={(v) => v.trim() && apply([edit.project('name', v.trim())], `Renombrar proyecto a «${v.trim()}»`)} />
        </Field>
        <div className="grid-2">
          <Field label="Marca">
            <CommitInput value={project.brand} disabled={!editable} onCommit={(v) => v.trim() && apply([edit.project('brand', v.trim())], 'Cambiar la marca')} />
          </Field>
          <Field label="Negocio">
            <CommitInput value={project.business} disabled={!editable} onCommit={(v) => apply([edit.project('business', v.trim())], 'Cambiar el negocio')} />
          </Field>
        </div>
        <Field label="Titular">
          <CommitInput value={project.tagline ?? ''} disabled={!editable} onCommit={setProject('tagline', 'titular del flujo')} />
        </Field>
        <Field label="Descripción">
          <CommitInput value={project.summary ?? ''} disabled={!editable} onCommit={setProject('summary', 'descripción del flujo')} />
        </Field>
        <Field label="Nombre del flujo">
          <CommitInput value={project.flowName ?? ''} disabled={!editable} onCommit={setProject('flowName', 'nombre del flujo')} />
        </Field>
        <Field label="Nota al pie de cada pantalla">
          <CommitInput value={project.footnote ?? ''} disabled={!editable} onCommit={setProject('footnote', 'nota al pie')} />
        </Field>
      </Section>
      <Section title="Diseño" aside="Tokens globales">
        <GlobalTokens project={project} editable={editable} />
      </Section>
      {editable && (
        <Section title={`Agregar a «${screen.name}»`}>
          <div className="palette">
            {project.components.map((c) => (
              <button key={c.id} type="button" className="chip" onClick={() => onAdd(blockFromComponent(c, project.brand))}>
                {c.name}
              </button>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function BlockProps({ project, screen, block, editable, onSelect }: { project: Project; screen: Screen; block: Block; editable: boolean; onSelect: (id?: string) => void }) {
  const meta = blockMeta(block.type);
  const name = block.label || meta.label;
  const set = (key: keyof Block, value: unknown, label = `Editar «${name}»`) => applyOps(project.id, [edit.block(project, screen.id, block.id, key, value)], label);
  const index = screen.blocks.findIndex((b) => b.id === block.id);
  const comps = project.components.filter((c) => c.type === block.type);
  const comp = findComponent(project, block.componentId);
  const inherited = effectiveStyle(project, { ...block, overrides: undefined }, ['default']);
  const bases = project.screens.filter((s) => !s.variantOf);
  const base = project.screens.find((s) => s.id === baseId(screen))!;

  const detailTypes: BlockType[] = ['navbar', 'heading', 'balance', 'help', 'card', 'input', 'textarea', 'amount', 'select', 'listItem', 'alert', 'avatar', 'progress', 'menuList', 'accountCard', 'creditCard', 'financeCard'];
  const valueLabel: Partial<Record<BlockType, string>> = {
    balance: 'Monto',
    progress: 'Porcentaje (0 a 100)',
    tabs: 'Pestaña activa',
    tabBar: 'Pestaña activa',
    iconGrid: 'Acceso activo',
    accountCard: 'Monto',
    creditCard: 'Red de la tarjeta',
    financeCard: 'Gráfico: donut, bars o vacío',
    menuList: 'Ilustración (emoji o money, rocket, deposit…)',
    listItem: 'Ícono (icon) o «read» para notificación leída',
    navbar: 'Ícono a la derecha (title)',
    rating: 'Valor inicial (1 a 5)',
  };
  const optionTypes: BlockType[] = ['select', 'radio', 'tabs', 'tabBar', 'menuList', 'accountCard', 'creditCard', 'carousel', 'financeCard', 'iconGrid'];
  const linkTypes: BlockType[] = ['accountCard', 'creditCard', 'financeCard'];
  const variant = comp?.variant ?? block.variant;
  const keys = optionKeys(block.type, variant, block.options);
  const keyLabel = (k: string) => ({ menu: 'Menú', qr: 'Código QR', bell: 'Notificaciones', right: 'Ícono derecho' })[k] ?? plainText(k);
  const alignTypes: BlockType[] = ['heading', 'text', 'link'];
  // En los contenedores cada opción navega por separado: no hay una acción para todo el bloque.
  const hasAction = meta.interactive && !meta.field && !['tabBar', 'menuList', 'carousel', 'iconGrid'].includes(block.type) && !(block.type === 'navbar' && variant === 'app');
  const valueText =
    block.type === 'listItem'
      ? variant === 'notification'
        ? 'Estado: escribe «read» si ya se leyó'
        : variant === 'icon'
          ? 'Ícono (ej: coin, card, info)'
          : undefined
      : block.type === 'navbar' && variant !== 'title'
        ? undefined
        : block.type === 'menuList' && variant
          ? undefined
          : valueLabel[block.type];

  return (
    <>
      <div className="sel-card">
        <span className="sel-icon">
          <IconDiamond size={18} />
        </span>
        <span className="sel-text">
          <strong>{name}</strong>
          <span>{comp ? `Instancia editable de «${comp.name}»` : `${meta.label} suelto`}</span>
        </span>
        {comp && (
          <span className="ds-tag" title="Viene del sistema de diseño">
            DS
          </span>
        )}
      </div>

      {editable && (
        <div className="props-actions props-actions-top" role="toolbar" aria-label="Acciones del bloque">
          <Button size="sm" disabled={index === 0} title="Subir (Alt + ↑)" onClick={() => applyOps(project.id, [edit.moveBlock(project, screen.id, index, index - 1)], 'Mover bloque')}>
            ↑ Subir
          </Button>
          <Button size="sm" disabled={index === screen.blocks.length - 1} title="Bajar (Alt + ↓)" onClick={() => applyOps(project.id, [edit.moveBlock(project, screen.id, index, index + 1)], 'Mover bloque')}>
            ↓ Bajar
          </Button>
          <Button
            size="sm"
            title="Duplicar bloque"
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
            title="Eliminar (Supr)"
            onClick={() => {
              if (applyOps(project.id, [edit.removeBlock(project, screen.id, block.id)], `Eliminar «${name}»`)) onSelect(undefined);
            }}
          >
            Eliminar
          </Button>
        </div>
      )}

      <Section title="Contenido">
        {block.type !== 'divider' && (
          <Field label="Texto principal">
            <CommitInput multiline value={block.label} disabled={!editable} onCommit={(v) => set('label', v)} />
          </Field>
        )}
        {detailTypes.includes(block.type) && (
          <Field label={meta.field ? 'Texto de ejemplo dentro del campo' : block.type === 'navbar' ? 'Texto junto a la marca' : 'Texto de apoyo'}>
            <CommitInput multiline value={block.detail ?? ''} disabled={!editable} onCommit={(v) => set('detail', v || undefined)} />
          </Field>
        )}
        {valueText && (
          <Field label={valueText}>
            <CommitInput value={block.value ?? ''} disabled={!editable} onCommit={(v) => set('value', v || undefined)} />
          </Field>
        )}
        {block.type === 'balance' && (
          <Field label="Referencia de la cuenta">
            <CommitInput value={block.options?.[0] ?? ''} disabled={!editable} onCommit={(v) => set('options', v ? [v] : undefined)} />
          </Field>
        )}
        {linkTypes.includes(block.type) && (
          <Field label="Enlace al pie">
            <CommitInput value={block.linkLabel ?? ''} disabled={!editable} onCommit={(v) => set('linkLabel', v.trim() || undefined)} />
          </Field>
        )}
        {optionTypes.includes(block.type) && (
          <Field label="Opciones" hint={OPTION_HINT[block.type] ?? 'Una por línea.'}>
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
        {alignTypes.includes(block.type) && (
          <Field label="Alineación">
            <Tabs
              small
              label="Alineación"
              value={block.align ?? 'start'}
              onChange={(v) => editable && set('align', v === 'start' ? undefined : v)}
              items={[
                { id: 'start', label: 'Izquierda' },
                { id: 'center', label: 'Centro' },
              ]}
            />
          </Field>
        )}
      </Section>

      <Section title="Diseño" aside="Tokens globales">
        <GlobalTokens project={project} editable={editable} />
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
      </Section>

      <Section title="Interacción" icon={<IconLink size={15} />}>
        {hasAction && (
          <>
            <Field label="Al tocar">
              <select value={block.action ?? 'none'} disabled={!editable} onChange={(e) => set('action', e.target.value === 'none' ? undefined : e.target.value, `Cambiar interacción de «${name}»`)}>
                <option value="none">No hace nada</option>
                {block.type !== 'navbar' && <option value="navigate">Ir a una pantalla</option>}
                <option value="back">Volver a la anterior</option>
              </select>
            </Field>
            {block.action === 'navigate' && (
              <Field label="Destino">
                <select value={block.target ?? ''} disabled={!editable} onChange={(e) => set('target', e.target.value || undefined, `Conectar «${name}»`)}>
                  <option value="">Elige una pantalla</option>
                  {bases
                    .filter((s) => s.id !== base.id)
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
        {keys.length > 0 && (
          <div className="stack">
            <span className="field-label">Destino de cada opción</span>
            {keys.map((key) => (
              <Field key={key} label={keyLabel(key)}>
                <select
                  value={block.optionTargets?.[key] ?? ''}
                  disabled={!editable}
                  onChange={(e) => {
                    const next = { ...(block.optionTargets ?? {}) };
                    if (e.target.value) next[key] = e.target.value;
                    else delete next[key];
                    set('optionTargets', Object.keys(next).length ? next : undefined, `Conectar «${keyLabel(key)}»`);
                  }}
                >
                  <option value="">No navega</option>
                  {bases.filter((s) => s.id !== base.id).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
        )}
        {block.type === 'button' && (
          <label className="check">
            <input type="checkbox" checked={!!block.disableUntilValid} disabled={!editable} onChange={(e) => set('disableUntilValid', e.target.checked || undefined)} />
            <span>Se ve deshabilitado hasta completar los obligatorios</span>
          </label>
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
        {!meta.interactive && <p className="muted small">Este componente no tiene interacción. Los toques sobre él se registran como zonas sin acción en las pruebas.</p>}
      </Section>

      {block.type !== 'divider' && (
        <details className="props-details" open={!!block.overrides && Object.values(block.overrides).some(Boolean)}>
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

    </>
  );
}

function PlayOverlay({ project, screen, mode, onClose }: { project: Project; screen: Screen; mode: Mode; onClose: () => void }) {
  const [m, setM] = useState<Mode>(mode);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  const bp = breakpointOf(screen.breakpoint);
  const s = Math.min(1, (size.h - 110) / bp.height, (size.w - 48) / bp.width);
  return (
    <div className="play-overlay" role="dialog" aria-modal="true" aria-label={`Probando desde ${screen.name}`}>
      <div className="play-bar">
        <span>
          <IconPlay size={14} /> Probando desde «{screen.name}»
        </span>
        <div className="row">
          <Tabs
            small
            label="Modo de color"
            value={m}
            onChange={setM}
            items={[
              { id: 'light', label: 'Claro' },
              { id: 'dark', label: 'Oscuro' },
            ]}
          />
          <Button size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
      <div style={{ width: bp.width * s }}>
        <Runner project={project} startScreenId={screen.id} breakpoint={screen.breakpoint} mode={m} maxScale={s} />
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
    <Section title={block ? `En «${block.label || blockMeta(block.type).label}»` : `En «${screen.name}»`}>
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
            Comentar {block ? 'en este componente' : 'en la pantalla'}
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
    </Section>
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
      {blocks.length > 0 && <p className="ok-text">Se detectaron: {blocks.map((b) => blockMeta(b.type).label.toLowerCase()).join(', ')}.</p>}
    </Modal>
  );
}
