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

describe('permisos', () => {
  it('el rol lector no edita', () => {
    expect(can('viewer', 'edit')).toBe(false);
    expect(can('viewer', 'comment')).toBe(true);
    expect(can('editor', 'manageMembers')).toBe(false);
    expect(can('owner', 'delete')).toBe(true);
  });
});
