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
    expect(p.components.length).toBe(34);
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

describe('permisos', () => {
  it('el rol lector no edita', () => {
    expect(can('viewer', 'edit')).toBe(false);
    expect(can('viewer', 'comment')).toBe(true);
    expect(can('editor', 'manageMembers')).toBe(false);
    expect(can('owner', 'delete')).toBe(true);
  });
});
