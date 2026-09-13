import { describe, expect, it } from 'vitest';
import { exampleStudy, transferProject } from './seed';
import { checkProject, hasBlockingErrors } from './flowCheck';
import { analyzeStudy } from './analysis';
import { applyOp, clone, edit, invertOp, renameTokenOps } from './ops';
import { contrast, exportCss, exportStyleDictionary, resolve } from './tokens';
import { importTokens } from './importer';
import { can } from './permissions';
import type { OpInput, Project } from './model';

describe('operaciones invertibles', () => {
  it('cada operación se deshace exactamente', () => {
    const p = transferProject('u1');
    const ops: OpInput[] = [
      edit.block(p, 's-nueva', 'b-nm-monto', 'label', 'Monto a ahorrar'),
      edit.addBlock(p, 's-nueva', { id: 'nuevo', type: 'text', label: 'Hola' }, 1),
      edit.moveBlock(p, 's-inicio', 0, 3),
      edit.removeScreen(p, 's-metas'),
    ];
    for (const op of ops) {
      const r = applyOp(p, op);
      const back = applyOp(r.doc, invertOp(r.op, r.prev));
      expect(back.doc).toEqual(p);
    }
  });

  it('renombrar un token actualiza sus referencias', () => {
    const p = transferProject('u1');
    let doc: Project = p;
    for (const op of renameTokenOps(p, 'color', 'primary', 'brand')) doc = applyOp(doc, op).doc;
    expect(doc.tokens.colors.some((c) => c.name === 'brand')).toBe(true);
    expect(JSON.stringify(doc.components)).not.toContain('{color.primary}');
    expect(JSON.stringify(doc.components)).toContain('{color.brand}');
  });
});

describe('guardarraíl de flujo', () => {
  it('el proyecto de ejemplo no tiene errores críticos y detecta la sobrescritura suelta', () => {
    const issues = checkProject(transferProject('u1'));
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(hasBlockingErrors(issues)).toBe(false);
    expect(issues.some((i) => i.area === 'sistema' && i.blockId === 'b-nm-continuar')).toBe(true);
  });

  it('bloquea destinos rotos y contraste insuficiente', () => {
    const p = clone(transferProject('u1'));
    p.screens.find((s) => s.id === 's-nueva')!.blocks.find((b) => b.id === 'b-nm-continuar')!.target = 'no-existe';
    p.tokens.colors.find((c) => c.name === 'onPrimary')!.light = '#2050D0';
    const issues = checkProject(p);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('pantalla eliminada'))).toBe(true);
    expect(issues.some((i) => i.severity === 'error' && i.area === 'accesibilidad' && i.message.includes('Contraste'))).toBe(true);
  });

  it('detecta pantallas inalcanzables', () => {
    const p = clone(transferProject('u1'));
    p.screens.push({ id: 's-suelta', name: 'Promociones', breakpoint: 'mobile', blocks: [] });
    expect(checkProject(p).some((i) => i.message.includes('«Promociones» no es alcanzable'))).toBe(true);
  });
});

describe('análisis de estudios', () => {
  it('agrega evidencia con citas por sesión', () => {
    const p = transferProject('u1');
    const { study, sessions, events } = exampleStudy(p, 'u1');
    const a = analyzeStudy(study, sessions, events);
    expect(a.total).toBe(15);
    const hes = a.themes.find((t) => t.kind === 'hesitation' && t.blockId === 'b-nm-monto')!;
    expect(hes.title).toBe('6 de 15 personas dudaron en «¿Cuánto quieres ahorrar?»');
    expect(hes.citations).toHaveLength(6);
    const t1 = a.tasks.find((t) => t.taskId === 't1')!;
    expect(t1.success).toBe(12);
    expect(t1.giveup).toBe(3);
    expect(a.themes.some((t) => t.kind === 'detour' && t.count === 2)).toBe(true);
    expect(a.themes.find((t) => t.kind === 'giveup' && t.count === 1)?.title).toBe('1 de 15 personas no logró «Encuentra dónde ver tus metas de ahorro»');
  });
});

describe('redacción de hallazgos', () => {
  it('usa singular cuando una sola persona se desvía', () => {
    const p = transferProject('u1');
    const { study, sessions, events } = exampleStudy(p, 'u1');
    const withoutP8 = sessions.filter((s) => s.participant !== 'P8');
    const a = analyzeStudy(study, withoutP8, events);
    const detour = a.themes.find((t) => t.kind === 'detour')!;
    expect(detour.title).toBe('1 de 14 personas se desvió a «Mis metas» mientras intentaba «Crea una meta de ahorro de $500.000 para tu próximo viaje»');
  });
});

describe('tokens', () => {
  it('resuelve referencias por modo y calcula contraste', () => {
    const p = transferProject('u1');
    expect(resolve('{color.primary}', p.tokens, 'dark')).toBe('#5AB0F0');
    expect(resolve('{space.lg}', p.tokens, 'light')).toBe('16px');
    expect(contrast('#FFFFFF', '#000000')).toBe(21);
  });

  it('exporta CSS y Style Dictionary', () => {
    const p = transferProject('u1');
    expect(exportCss(p.tokens)).toContain('--color-on-primary: #FFFFFF;');
    expect(JSON.parse(exportStyleDictionary(p.tokens)).color.dark.primary.value).toBe('#5AB0F0');
  });

  it('importa variables CSS con modo oscuro', () => {
    const p = transferProject('u1');
    const r = importTokens(':root { --color-brand-accent: #ff0055; --space-huge: 48px; } [data-theme="dark"] { --color-brand-accent: #ff88aa; }', p.tokens);
    const c = r.tokens.colors.find((x) => x.name === 'brandAccent')!;
    expect(c.light).toBe('#FF0055');
    expect(c.dark).toBe('#FF88AA');
    expect(r.tokens.space.find((s) => s.name === 'huge')?.value).toBe(48);
  });
});

describe('enlace público de estudio', () => {
  it('la copia congelada viaja comprimida en el enlace y vuelve intacta', async () => {
    const { encodeStudy, decodeStudy } = await import('./share');
    const { study } = exampleStudy(transferProject('u1'), 'u1');
    const encoded = await encodeStudy(study);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded.length).toBeLessThan(JSON.stringify(study.snapshot).length);
    const back = await decodeStudy(encoded);
    expect(back.id).toBe(study.id);
    expect(back.tasks).toEqual(study.tasks);
    expect(back.snapshot).toEqual(study.snapshot);
  });
});

describe('sistema desde IA', () => {
  it('convierte la propuesta a tokens y descarta valores que no son tokens', async () => {
    const { convertSystem } = await import('./ai');
    const empty = { bg: '', fg: '', border: '', outline: '', radius: '', padY: '', padX: '', type: '' };
    const p = transferProject('u1');
    const out = convertSystem(
      {
        fontFamily: "'Roboto', sans-serif",
        colors: [
          { name: 'primary', light: '#ff0055', dark: '#ff88aa', description: 'Marca' },
          { name: 'brand violeta', light: '#123', dark: '#456', description: '' },
        ],
        space: { xs: 4, sm: 8, md: 12, lg: 20, xl: 24, xxl: 32 },
        radius: { sm: 4, md: 8, lg: 24 },
        components: [
          {
            name: 'Botón de marca',
            type: 'button',
            variant: 'primary',
            default: { ...empty, bg: 'primary', fg: 'onPrimary', radius: 'lg', padY: 'md', type: 'label' },
            hover: { ...empty, bg: '#000000' },
            pressed: empty,
            disabled: empty,
            focus: { ...empty, outline: 'focus' },
          },
        ],
        notes: 'Detecté un botón principal.',
      },
      p.tokens,
    );
    expect(out.tokens.colors.find((c) => c.name === 'primary')?.light).toBe('#FF0055');
    expect(out.tokens.colors.some((c) => c.name === 'brand violeta')).toBe(false);
    expect(out.tokens.space.find((s) => s.name === 'lg')?.value).toBe(20);
    expect(out.tokens.fontFamily).toBe("'Roboto', sans-serif");
    const btn = out.components[0];
    expect(btn.states.default.bg).toBe('{color.primary}');
    expect(btn.states.default.radius).toBe('{radius.lg}');
    expect(btn.states.focus.outline).toBe('{color.focus}');
    expect(out.dropped).toBe(2);
  });
});

describe('embudo de tarea', () => {
  it('cuenta cuántas personas llegan a cada pantalla del camino', async () => {
    const { taskFunnel } = await import('./analysis');
    const p = transferProject('u1');
    const { study, sessions, events } = exampleStudy(p, 'u1');
    const steps = taskFunnel(study, sessions, events, 't1');
    expect(steps.map((s) => s.screenId)).toEqual(['s-inicio', 's-nueva', 's-confirmacion', 's-creada']);
    expect(steps.map((s) => s.reached)).toEqual([15, 15, 12, 12]);
  });
});

describe('plantilla Banco New', () => {
  it('no tiene errores del guardarraíl y todas sus pantallas son alcanzables', async () => {
    const { bancoNewProject } = await import('./seedBancoNew');
    const p = bancoNewProject('u1');
    const issues = checkProject(p);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(issues.filter((i) => i.message.includes('no es alcanzable') || i.message.includes('callejón'))).toEqual([]);
    expect(p.screens.length).toBe(19);
    const { CATALOG, coverage } = await import('./catalog');
    expect(coverage(p).covered).toBe(CATALOG.length);
    expect(p.components.some((c) => c.id === 'cmp-bn-appbar')).toBe(true);
    const ids = new Set(p.screens.map((s) => s.id));
    for (const s of p.screens) for (const b of s.blocks) for (const target of Object.values(b.optionTargets ?? {})) expect(ids.has(target)).toBe(true);
  });
});

describe('datos ingresados en pantallas siguientes', () => {
  it('muestra lo que escribió la persona o el ejemplo', async () => {
    const { fillValues, plainText } = await import('./model');
    expect(fillValues('Monto|{{bn-mo-monto|$ 50.000}}', { 'bn-mo-monto': '$ 75.000' })).toBe('Monto|$ 75.000');
    expect(fillValues('Monto|{{bn-mo-monto|$ 50.000}}', {})).toBe('Monto|$ 50.000');
    expect(fillValues('{{bn-mo-mensaje}}', { 'bn-mo-mensaje': '  ' })).toBe('');
    expect(plainText('Recibirá **{{m|$ 1}}**')).toBe('Recibirá $ 1');
  });
});

describe('ejemplo Banco New en espacios existentes', () => {
  it('se agrega una sola vez, con ids nuevos y la persona como dueña', async () => {
    const { adoptSample } = await import('./store');
    const { bancoNewProject } = await import('./seedBancoNew');
    const { emptyDb } = await import('./model');
    const user = { id: 'u1', name: 'Ana Soto', email: 'ana@correo.cl' };
    const project = bancoNewProject('otra');
    const ex = exampleStudy(transferProject('otra'), 'otra');
    const sample = { project, versions: [], studies: [{ ...ex.study, projectId: project.id }], sessions: ex.sessions, events: ex.events };
    const once = adoptSample({ ...emptyDb(), users: [user], currentUserId: 'u1' }, user, sample);
    expect(once.projects).toHaveLength(1);
    expect(once.projects[0].id).not.toBe(project.id);
    expect(once.projects[0].owner).toBe('u1');
    expect(once.studies[0].projectId).toBe(once.projects[0].id);
    expect(once.sessions.every((s) => s.studyId === once.studies[0].id)).toBe(true);
    expect(once.events.every((e) => once.sessions.some((s) => s.id === e.sessionId))).toBe(true);
    expect(once.users[0].samples).toContain('bancoNew');
    expect(adoptSample(once, once.users[0], sample).projects).toHaveLength(1);
  });
});

describe('hoja inferior', () => {
  it('Accesos rápidos se abre como modal y los proyectos anteriores se ajustan una sola vez', async () => {
    const { bancoNewProject } = await import('./seedBancoNew');
    const { migrate } = await import('./store');
    const { emptyDb } = await import('./model');
    const p = bancoNewProject('u1');
    expect(p.screens.find((s) => s.id === 's-bn-accesos')?.presentation).toBe('sheet');
    const old = clone(p);
    const acc = old.screens.find((s) => s.id === 's-bn-accesos')!;
    delete acc.presentation;
    delete acc.sheetOver;
    acc.blocks.push({ id: 'bn-ac-texto', type: 'text', label: 'Elige un acceso' });
    const once = migrate({ ...emptyDb(), projects: [old] });
    const fixed = once.projects[0].screens.find((s) => s.id === 's-bn-accesos')!;
    expect(fixed.presentation).toBe('sheet');
    expect(fixed.sheetOver).toBe('s-bn-inicio');
    expect(fixed.blocks.some((b) => b.id === 'bn-ac-texto')).toBe(false);
    expect(migrate(once)).toBe(once);
  });
});

describe('biblioteca completa en cada proyecto', () => {
  it('las tres plantillas cubren el catálogo sin errores del guardarraíl', async () => {
    const { CATALOG, coverage } = await import('./catalog');
    const { bancoNewProject } = await import('./seedBancoNew');
    const { blankProject } = await import('./seed');
    for (const p of [blankProject('u1', 'En blanco', ''), transferProject('u1'), bancoNewProject('u1')]) {
      expect(coverage(p).covered).toBe(CATALOG.length);
      expect(checkProject(p).filter((i) => i.severity === 'error')).toEqual([]);
    }
  });

  it('completa un proyecto antiguo sin tocar lo existente, sin errores de contraste y una sola vez', async () => {
    const { completeSystem, CATALOG } = await import('./catalog');
    const old = clone(transferProject('u1'));
    old.components = old.components.slice(0, 2);
    old.tokens.colors = old.tokens.colors
      .filter((c) => !['star', 'cardDark', 'cardDarkEnd', 'onDark', 'warning'].includes(c.name))
      .map((c) => (c.name === 'success' ? { ...c, light: '#1E8E5A' } : c));
    const once = completeSystem(old);
    expect(once.components.slice(0, 2)).toEqual(old.components);
    expect(once.components).toHaveLength(CATALOG.length);
    expect(once.tokens.colors.some((c) => c.name === 'cardDark')).toBe(true);
    expect(checkProject(once).filter((i) => i.severity === 'error')).toEqual([]);
    expect(completeSystem(once)).toBe(once);
  });

  it('cada patrón trae guía completa y contenido para su vista previa', async () => {
    const { CATALOG, sampleContent } = await import('./catalog');
    for (const e of CATALOG) {
      expect(e.summary && e.use.length && e.avoid.length && e.anatomy.length && e.a11y).toBeTruthy();
      if (e.type !== 'divider') expect(sampleContent(e.type, e.variant, 'Marca').label).toBeTruthy();
    }
    expect(new Set(CATALOG.map((e) => e.key)).size).toBe(CATALOG.length);
    expect(sampleContent('navbar', 'app', 'New').label).toBe('New');
  });
});

describe('importar sistemas', () => {
  it('lee variables CSS con modo oscuro, SCSS y selectores', async () => {
    const { candidatesFromText } = await import('./systemIO');
    const c = candidatesFromText(
      'tokens.css',
      ':root { --color-primary: #0074c8; --radius-lg: 16px; font-family: "Roboto", sans-serif; }\n[data-theme="dark"] { --color-primary: #5AB0F0; }\n.btn-danger { background: #C62828; }',
    );
    const primary = c.colors.find((x) => x.name === 'primary')!;
    expect(primary.hex).toBe('#0074C8');
    expect(primary.dark).toBe('#5AB0F0');
    expect(c.colors.some((x) => x.hex === '#C62828' && x.name === 'btnDanger')).toBe(true);
    expect(c.radius).toContain(16);
    expect(c.fonts).toContain('Roboto');
    const s = candidatesFromText('vars.scss', '$brand-primary: #FF0055;\n$text-muted: #666666;');
    expect(s.colors.find((x) => x.name === 'brandPrimary')?.hex).toBe('#FF0055');
  });

  it('lee tailwind.config, W3C Design Tokens y el sistema exportado de Forma', async () => {
    const { candidatesFromText, exportDtcg, exportSystemJson, exportTailwind } = await import('./systemIO');
    const tw = candidatesFromText(
      'tailwind.config.js',
      "module.exports = { theme: { extend: { colors: { primary: { DEFAULT: '#1A66CC', 600: '#1554A6' }, danger: '#D0343A' }, fontFamily: { sans: ['Overpass', 'sans-serif'] }, borderRadius: { lg: '1rem' } } } }",
    );
    expect(tw.colors.find((x) => x.name === 'primary')?.hex).toBe('#1A66CC');
    expect(tw.colors.find((x) => x.name === 'primary600')?.hex).toBe('#1554A6');
    expect(tw.fonts).toContain('Overpass');
    expect(tw.radius).toContain(16);
    const tokens = transferProject('u1').tokens;
    const dtcg = candidatesFromText('tokens.json', exportDtcg(tokens));
    expect(dtcg.colors.find((x) => x.name === 'primary')?.hex).toBe('#0074C8');
    expect(dtcg.colors.find((x) => x.name === 'primary')?.dark).toBe('#5AB0F0');
    expect(dtcg.fonts).toContain('Inter');
    const sys = candidatesFromText('sistema.json', exportSystemJson(transferProject('u1')));
    expect(sys.system?.components.length).toBeGreaterThan(40);
    expect(exportTailwind(tokens)).toContain('var(--color-primary)');
  });

  it('propone roles y deriva estados y modo oscuro con contraste', async () => {
    const { buildTokens, suggestMapping } = await import('./systemIO');
    const current = transferProject('u1').tokens;
    const mapping = suggestMapping(
      [
        { hex: '#E4002B', name: 'Rojo marca', count: 3 },
        { hex: '#111827', count: 9 },
        { hex: '#FFFFFF', count: 20 },
        { hex: '#16A34A', count: 2 },
      ],
      current,
    );
    expect(mapping.primary).toBe('#E4002B');
    expect(mapping.onSurface).toBe('#111827');
    expect(mapping.success).toBe('#16A34A');
    const t = buildTokens(current, { ...mapping, border: '#12' }, { font: 'Roboto', radiusLg: 20 });
    const get = (n: string) => t.colors.find((c) => c.name === n)!;
    expect(contrast(get('onPrimary').light, get('primary').light)!).toBeGreaterThanOrEqual(4.5);
    expect(contrast(get('primary').dark, get('background').dark)!).toBeGreaterThanOrEqual(4.5);
    expect(get('border').light).toBe(current.colors.find((c) => c.name === 'border')!.light);
    expect(t.fontFamily.startsWith("'Roboto'")).toBe(true);
    expect(t.radius.find((r) => r.name === 'md')?.value).toBe(15);
  });

  it('lee colores, textos y fuentes de un PDF', async () => {
    const { scanContent, fontsFromPdf } = await import('./pdfExtract');
    const colors = new Map<string, number>();
    const texts: string[] = [];
    scanContent('q 0 0.455 0.784 rg 10 10 80 40 re f BT /F1 12 Tf (Primario #0074C8) Tj [(Az) 20 (ul)] TJ ET 0 0 0 1 k', colors, texts);
    expect(colors.has('#0074C8')).toBe(true);
    expect(colors.has('#000000')).toBe(true);
    expect(texts).toContain('Primario #0074C8');
    expect(texts).toContain('Azul');
    expect(fontsFromPdf('<< /Type /Font /BaseFont /ABCDEF+Inter-Bold >> << /BaseFont /Roboto-Regular >>')).toEqual(['Inter', 'Roboto']);
  });
});

describe('permisos', () => {
  it('el rol lector no edita', () => {
    expect(can('viewer', 'edit')).toBe(false);
    expect(can('viewer', 'comment')).toBe(true);
    expect(can('editor', 'manageMembers')).toBe(false);
    expect(can('owner', 'delete')).toBe(true);
  });
});
