import { describe, expect, it } from 'vitest';
import { destinationOf, framesFromPage, hotspotsIn, parseFigmaUrl, planImportacion, startFrameOf, type FigmaNode } from './figma';

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

const page: FigmaNode = {
  id: '0:1',
  name: 'Flujo',
  type: 'CANVAS',
  prototypeStartNodeID: '1:2',
  children: [
    {
      id: '1:2',
      name: 'Inicio',
      type: 'FRAME',
      absoluteBoundingBox: box(0, 0, 390, 844),
      children: [
        // Interacción actual: navega a otro frame.
        { id: '1:3', name: 'Botón crear', type: 'INSTANCE', absoluteBoundingBox: box(20, 700, 350, 56), interactions: [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'NODE', destinationId: '1:10', navigation: 'NAVIGATE' }] }] },
        // Interacción clásica dentro de un grupo anidado.
        { id: '1:4', name: 'Grupo', type: 'GROUP', absoluteBoundingBox: box(0, 100, 390, 200), children: [{ id: '1:5', name: 'Tarjeta', type: 'FRAME', absoluteBoundingBox: box(39, 100, 195, 84), transitionNodeID: '1:10' }] },
        // Sin interacción: no es zona tocable.
        { id: '1:6', name: 'Texto', type: 'TEXT', absoluteBoundingBox: box(20, 40, 200, 24) },
        // Oculta: se ignora.
        { id: '1:7', name: 'Oculto', type: 'FRAME', visible: false, absoluteBoundingBox: box(0, 0, 390, 100), transitionNodeID: '1:10' },
      ],
    },
    { id: '1:10', name: 'Meta creada', type: 'FRAME', absoluteBoundingBox: box(500, 0, 390, 844), children: [{ id: '1:11', name: 'Volver', type: 'INSTANCE', absoluteBoundingBox: box(516, 16, 40, 40), interactions: [{ actions: [{ type: 'NODE', navigation: 'BACK' }] }] }] },
    // Sin tamaño: no es una pantalla.
    { id: '1:20', name: 'Nota', type: 'TEXT', absoluteBoundingBox: box(0, 900, 100, 20) },
  ],
};

describe('importar desde Figma', () => {
  it('lee la clave del archivo y el nodo del enlace', () => {
    expect(parseFigmaUrl('https://www.figma.com/design/abcDEF123456/Banco?node-id=12-34&t=x')).toEqual({ fileKey: 'abcDEF123456', nodeId: '12:34' });
    expect(parseFigmaUrl('https://www.figma.com/proto/abcDEF123456/Banco?node-id=1-2&scaling=scale-down')).toMatchObject({ fileKey: 'abcDEF123456' });
    expect(parseFigmaUrl('https://www.figma.com/file/abcDEF123456/Banco')).toEqual({ fileKey: 'abcDEF123456', nodeId: undefined });
    expect(parseFigmaUrl('https://example.com/nada')).toBeNull();
  });

  it('convierte los frames en pantallas y sus interacciones en zonas tocables', () => {
    const frames = framesFromPage(page);
    expect(frames.map((f) => f.name)).toEqual(['Inicio', 'Meta creada']);
    expect(frames[0]).toMatchObject({ width: 390, height: 844 });

    const zonas = frames[0].hotspots;
    expect(zonas).toHaveLength(2);
    // La más chica queda primero para que se pueda tocar aunque otra la contenga.
    expect(zonas[0]).toMatchObject({ id: '1:5', destination: '1:10', x: 0.1, y: 0.118, w: 0.5 });
    expect(zonas[1]).toMatchObject({ id: '1:3', destination: '1:10' });
    expect(zonas.some((z) => z.id === '1:7')).toBe(false);

    expect(frames[1].hotspots[0]).toMatchObject({ id: '1:11', back: true });
    expect(frames[1].hotspots[0].destination).toBeUndefined();
  });

  it('usa la pantalla de inicio del prototipo', () => {
    const frames = framesFromPage(page);
    expect(startFrameOf(page, frames)).toBe('1:2');
    expect(startFrameOf({ ...page, prototypeStartNodeID: null }, frames)).toBe('1:2');
    expect(startFrameOf({ ...page, prototypeStartNodeID: '9:9' }, frames)).toBe('1:2');
    expect(startFrameOf({ ...page, flowStartingPoints: [{ nodeId: '1:10' }] }, frames)).toBe('1:10');
  });

  it('entiende los dos formatos de interacción de Figma', () => {
    expect(destinationOf({ id: 'a', name: 'a', type: 'FRAME', transitionNodeID: '2:2' })).toEqual({ destination: '2:2' });
    expect(destinationOf({ id: 'a', name: 'a', type: 'FRAME', interactions: [{ actions: [{ type: 'BACK' }] }] })).toEqual({ back: true });
    expect(destinationOf({ id: 'a', name: 'a', type: 'FRAME' })).toBeUndefined();
    expect(hotspotsIn({ id: 'a', name: 'a', type: 'FRAME' })).toEqual([]);
  });
});

describe('volver a importar', () => {
  it('actualiza las pantallas que ya vienen de Figma y crea solo las nuevas', () => {
    let n = 0;
    const nuevoId = () => `s_nuevo_${++n}`;
    const screens = [
      { id: 's_vieja', figmaId: '1:2' },
      { id: 's_a_mano' },
    ];
    const plan = planImportacion(['1:2', '1:10'], screens, nuevoId);
    expect(plan.idPorFrame).toEqual({ '1:2': 's_vieja', '1:10': 's_nuevo_1' });
    expect(plan.actualizados).toEqual(['1:2']);
    expect(plan.nuevos).toEqual(['1:10']);
  });

  it('sin pantallas previas, todo es nuevo', () => {
    const plan = planImportacion(['1:2'], [], () => 's_x');
    expect(plan).toEqual({ idPorFrame: { '1:2': 's_x' }, nuevos: ['1:2'], actualizados: [] });
  });
});
