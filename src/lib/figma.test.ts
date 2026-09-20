import { describe, expect, it } from 'vitest';
import { alcanzablesDesde, framesFromPage, hotspotsIn, interaccionesDe, parseFigmaUrl, planImportacion, startFrameOf, type FigmaNode } from './figma';

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const alTocar = (destino: string, navegacion = 'NAVIGATE') => [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'NODE', destinationId: destino, navigation: navegacion }] }];

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
        { id: '1:3', name: 'Botón crear', type: 'INSTANCE', absoluteBoundingBox: box(20, 700, 350, 56), interactions: alTocar('1:10') },
        // Interacción antigua (transitionNodeID) dentro de un grupo anidado.
        { id: '1:4', name: 'Grupo', type: 'GROUP', absoluteBoundingBox: box(0, 100, 390, 200), children: [{ id: '1:5', name: 'Tarjeta', type: 'FRAME', absoluteBoundingBox: box(39, 100, 195, 84), transitionNodeID: '1:10' }] },
        // Abre una hoja encima: es navegación, pero marcada como superposición.
        { id: '1:6', name: 'Ayuda', type: 'INSTANCE', absoluteBoundingBox: box(300, 40, 60, 40), interactions: alTocar('1:30', 'OVERLAY') },
        // Al pasar el mouse: en Figma es temporal, no es una transición del flujo.
        { id: '1:7', name: 'Hover', type: 'FRAME', absoluteBoundingBox: box(0, 300, 100, 40), interactions: [{ trigger: { type: 'ON_HOVER' }, actions: [{ type: 'NODE', destinationId: '1:10', navigation: 'NAVIGATE' }] }] },
        // Desplazar dentro de la misma pantalla y abrir una URL: tampoco cambian de pantalla.
        { id: '1:8', name: 'Ir al pie', type: 'FRAME', absoluteBoundingBox: box(0, 360, 100, 40), interactions: alTocar('1:9', 'SCROLL_TO') },
        { id: '1:9', name: 'Sitio', type: 'FRAME', absoluteBoundingBox: box(0, 420, 100, 40), interactions: [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'URL', url: 'https://ejemplo.cl' }] }] },
        { id: '1:12', name: 'Oculto', type: 'FRAME', visible: false, absoluteBoundingBox: box(0, 0, 390, 100), transitionNodeID: '1:10' },
      ],
    },
    {
      id: '1:10',
      name: 'Meta creada',
      type: 'FRAME',
      absoluteBoundingBox: box(500, 0, 390, 844),
      // Después de 2 s vuelve sola al inicio.
      interactions: [{ trigger: { type: 'AFTER_TIMEOUT', timeout: 2 }, actions: [{ type: 'NODE', destinationId: '1:2', navigation: 'NAVIGATE' }] }],
      children: [{ id: '1:11', name: 'Volver', type: 'INSTANCE', absoluteBoundingBox: box(516, 16, 40, 40), interactions: [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'BACK' }] }] }],
    },
    { id: '1:30', name: 'Hoja de ayuda', type: 'FRAME', absoluteBoundingBox: box(1000, 500, 390, 320), children: [{ id: '1:31', name: 'Cerrar', type: 'INSTANCE', absoluteBoundingBox: box(1330, 520, 40, 40), interactions: [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'CLOSE' }] }] }] },
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
    // Enlace real de un prototipo: trae página y punto de inicio.
    expect(
      parseFigmaUrl('https://www.figma.com/proto/aho61DN4Cz9EklxvOMttxX/Bank-App--Community-?node-id=1-2&p=f&t=4vkziRYZdv3LguoG-0&scaling=scale-down&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=1%3A2'),
    ).toEqual({ fileKey: 'aho61DN4Cz9EklxvOMttxX', nodeId: '1:2', pageId: '0:1', startId: '1:2' });
  });

  it('convierte los frames en pantallas', () => {
    const frames = framesFromPage(page);
    expect(frames.map((f) => f.name)).toEqual(['Inicio', 'Meta creada', 'Hoja de ayuda']);
    expect(frames[0]).toMatchObject({ width: 390, height: 844 });
  });

  it('toma solo las interacciones que cambian de pantalla', () => {
    const zonas = framesFromPage(page)[0].hotspots;
    expect(zonas.map((z) => z.id).sort()).toEqual(['1:3', '1:5', '1:6']);
    // La más chica queda primero para que se pueda tocar aunque otra la contenga.
    expect(zonas[0]).toMatchObject({ id: '1:6', destino: '1:30', overlay: true });
    expect(zonas.find((z) => z.id === '1:5')).toMatchObject({ destino: '1:10', x: 0.1, y: 0.118, w: 0.5 });
    // Hover, desplazar, abrir URL y lo oculto no son zonas tocables.
    expect(zonas.some((z) => ['1:7', '1:8', '1:9', '1:12'].includes(z.id))).toBe(false);
  });

  it('entiende volver, cerrar y las transiciones automáticas', () => {
    const frames = framesFromPage(page);
    const meta = frames.find((f) => f.id === '1:10')!;
    expect(meta.hotspots[0]).toMatchObject({ id: '1:11', volver: true });
    expect(meta.hotspots[0].destino).toBeUndefined();
    expect(meta.auto).toEqual({ segundos: 2, destino: '1:2', volver: undefined });

    const hoja = frames.find((f) => f.id === '1:30')!;
    expect(hoja.hotspots[0]).toMatchObject({ id: '1:31', volver: true });
    expect(frames[0].auto).toBeUndefined();
  });

  it('lee los dos formatos de interacción y descarta lo que no navega', () => {
    expect(interaccionesDe({ id: 'a', name: 'a', type: 'FRAME', transitionNodeID: '2:2' }).toque).toEqual({ destino: '2:2' });
    expect(interaccionesDe({ id: 'a', name: 'a', type: 'FRAME', interactions: [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'CLOSE' }] }] }).toque).toEqual({ volver: true });
    expect(interaccionesDe({ id: 'a', name: 'a', type: 'FRAME' }).toque).toBeUndefined();
    expect(interaccionesDe({ id: 'a', name: 'a', type: 'FRAME', interactions: alTocar('2:2', 'CHANGE_TO') }).toque).toBeUndefined();
    expect(hotspotsIn({ id: 'a', name: 'a', type: 'FRAME' })).toEqual([]);
  });

  it('sigue las flechas desde el inicio y deja fuera los frames sueltos', () => {
    const frames = [...framesFromPage(page), { id: '9:9', name: 'Suelta', width: 390, height: 844, hotspots: [] }];
    // Inicio → Meta creada (toque) → Inicio (automática); Inicio → Hoja de ayuda (superposición).
    expect(alcanzablesDesde(frames, '1:2')).toEqual(['1:2', '1:10', '1:30']);
    // Desde una pantalla sin salidas, solo ella.
    expect(alcanzablesDesde(frames, '9:9')).toEqual(['9:9']);
    expect(alcanzablesDesde([], '1:2')).toEqual([]);
  });

  it('usa la pantalla de inicio del prototipo', () => {
    const frames = framesFromPage(page);
    expect(startFrameOf(page, frames)).toBe('1:2');
    expect(startFrameOf({ ...page, prototypeStartNodeID: null }, frames)).toBe('1:2');
    expect(startFrameOf({ ...page, prototypeStartNodeID: '9:9' }, frames)).toBe('1:2');
    expect(startFrameOf({ ...page, flowStartingPoints: [{ nodeId: '1:10' }] }, frames)).toBe('1:10');
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
