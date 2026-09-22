import { describe, expect, it } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exampleStudy, transferProject } from './seed';
import { personasBase, simularTanda } from './synthetic';
import { descargarDeck } from './deck';

describe('presentación del estudio', () => {
  it('arma un pptx válido con una lámina por idea', async () => {
    const p = transferProject('u1');
    const { study, sessions, events } = exampleStudy(p, 'u1');
    const sint = simularTanda(study, [{ persona: personasBase()[4], cantidad: 3 }], 31);
    const ss = [...sessions, ...sint.map((s) => s.session)];
    const ee = [...events, ...sint.flatMap((s) => s.events)];
    const ruta = join(tmpdir(), `forma-deck-${Date.now()}.pptx`);

    const laminas = await descargarDeck(study, ss, ee, ruta, { autor: 'Equipo' });
    // Portada, índice, indicadores, resumen, 3 hallazgos, tareas, perfiles, método y próximos pasos.
    expect(laminas).toBe(11);

    // Un .pptx es un zip: si el archivo no empieza con la firma, PowerPoint no lo abriría.
    const bytes = readFileSync(ruta);
    expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');
    expect(bytes.length).toBeGreaterThan(20_000);
    const texto = bytes.toString('latin1');
    expect(texto).toContain('ppt/slides/slide1.xml');
    expect(texto).toContain('ppt/slides/slide11.xml');
    rmSync(ruta, { force: true });
  }, 30000);

  it('un estudio sin sesiones no revienta al exportar', async () => {
    const p = transferProject('u1');
    const { study } = exampleStudy(p, 'u1');
    const ruta = join(tmpdir(), `forma-deck-vacio-${Date.now()}.pptx`);
    const laminas = await descargarDeck({ ...study, summary: undefined }, [], [], ruta, {});
    expect(laminas).toBeGreaterThan(5);
    rmSync(ruta, { force: true });
  }, 30000);
});
