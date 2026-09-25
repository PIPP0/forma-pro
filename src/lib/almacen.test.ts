import { describe, expect, it } from 'vitest';
import { conArchivosDe, sinArchivos } from './store';
import { emptyDb } from './model';
import type { DB, Project } from './model';

// El espacio se guarda entero en IndexedDB y, cuando no cabe, sin archivos en localStorage.
// Estas dos funciones son el puente entre ambas copias: si se equivocan, se pierden imágenes.

const proyecto = (extra: Partial<Project> = {}): Project =>
  ({
    id: 'p1',
    name: 'App',
    createdAt: 1,
    updatedAt: 1,
    owner: 'u1',
    screens: [{ id: 's1', name: 'Inicio', blocks: [], image: { url: 'https://figma/x.png', width: 390, height: 844, data: 'data:image/png;base64,AAA' } }],
    components: [],
    tokens: {},
    sounds: [{ id: 'snd1', name: 'Toque', data: 'data:audio/wav;base64,BBB', bytes: 3 }],
    ...extra,
  }) as unknown as Project;

const espacio = (p: Project): DB => ({ ...emptyDb(), projects: [p] });

describe('la copia sin archivos', () => {
  it('deja fuera la imagen y el sonido, y conserva todo lo demás', () => {
    const ligero = sinArchivos(espacio(proyecto()));
    expect(ligero.projects[0].screens[0].image?.data).toBeUndefined();
    expect(ligero.projects[0].screens[0].image?.url).toBe('https://figma/x.png');
    expect(ligero.projects[0].sounds?.[0].data).toBe('');
    expect(ligero.projects[0].sounds?.[0].name).toBe('Toque');
  });

  it('no altera el original', () => {
    const completo = espacio(proyecto());
    sinArchivos(completo);
    expect(completo.projects[0].screens[0].image?.data).toBe('data:image/png;base64,AAA');
  });
});

describe('recuperar los archivos', () => {
  it('devuelve imagen y sonido a la copia liviana', () => {
    const completo = espacio(proyecto());
    const recuperado = conArchivosDe(sinArchivos(completo), completo);
    expect(recuperado.projects[0].screens[0].image?.data).toBe('data:image/png;base64,AAA');
    expect(recuperado.projects[0].sounds?.[0].data).toBe('data:audio/wav;base64,BBB');
  });

  it('no pisa lo que ya está en pantalla: gana lo actual', () => {
    const actual = espacio(proyecto({ name: 'App renombrada' }));
    const viejo = espacio(proyecto({ name: 'App' }));
    expect(conArchivosDe(actual, viejo).projects[0].name).toBe('App renombrada');
  });

  it('un proyecto nuevo, que la copia guardada no conoce, pasa intacto', () => {
    const actual = espacio(proyecto({ id: 'p2' }));
    expect(conArchivosDe(actual, espacio(proyecto())).projects[0].screens[0].image?.data).toBe('data:image/png;base64,AAA');
  });

  it('un proyecto borrado aquí no vuelve desde la copia guardada', () => {
    const vacio: DB = { ...emptyDb(), projects: [] };
    expect(conArchivosDe(vacio, espacio(proyecto())).projects).toEqual([]);
  });
});
