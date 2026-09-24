import { describe, expect, it } from 'vitest';
import { clave, marcaEstudio, planificar } from './sync';
import type { Session, Study } from './model';

const local = (tipo: 'proyecto' | 'estudio', id: string, actualizado: number, extra: { nombre?: string; prescindible?: boolean } = {}) => ({
  tipo,
  id,
  nombre: extra.nombre ?? id,
  actualizado,
  prescindible: extra.prescindible,
});
const remoto = (tipo: 'proyecto' | 'estudio', id: string, actualizado: number, borrado = false) => ({ tipo, id, nombre: id, actualizado, borrado });

describe('qué mover al sincronizar', () => {
  it('sube lo que existe aquí y no allá', () => {
    const plan = planificar([local('proyecto', 'p1', 100)], []);
    expect(plan.subir).toEqual(['proyecto_p1']);
    expect(plan.bajar).toEqual([]);
    expect(plan.conflictos).toEqual([]);
  });

  it('baja lo que existe allá y no aquí', () => {
    const plan = planificar([], [remoto('proyecto', 'p1', 100)]);
    expect(plan.bajar).toEqual(['proyecto_p1']);
    expect(plan.subir).toEqual([]);
  });

  it('gana el más reciente, en cualquiera de los dos sentidos', () => {
    expect(planificar([local('proyecto', 'p1', 200)], [remoto('proyecto', 'p1', 100)]).subir).toEqual(['proyecto_p1']);
    expect(planificar([local('proyecto', 'p1', 100)], [remoto('proyecto', 'p1', 200)]).bajar).toEqual(['proyecto_p1']);
  });

  it('no mueve nada cuando los dos lados están igual', () => {
    const plan = planificar([local('proyecto', 'p1', 100)], [remoto('proyecto', 'p1', 100)]);
    expect(plan.subir).toEqual([]);
    expect(plan.bajar).toEqual([]);
  });

  it('avisa cuando el mismo proyecto cambió en los dos equipos', () => {
    const plan = planificar([local('proyecto', 'p1', 300, { nombre: 'Transferencias' })], [remoto('proyecto', 'p1', 200)]);
    expect(plan.subir).toEqual(['proyecto_p1']);
    expect(plan.conflictos).toEqual(['Transferencias']);
  });

  it('un borrado reciente en otro equipo se respeta; uno viejo no pisa lo que sigues editando', () => {
    expect(planificar([local('proyecto', 'p1', 100)], [remoto('proyecto', 'p1', 200, true)]).quitar).toEqual(['proyecto_p1']);
    const despues = planificar([local('proyecto', 'p1', 300)], [remoto('proyecto', 'p1', 200, true)]);
    expect(despues.quitar).toEqual([]);
    expect(despues.subir).toEqual(['proyecto_p1']);
  });

  it('en un navegador recién estrenado descarta los ejemplos y trae lo real', () => {
    const plan = planificar(
      [local('proyecto', 'ejemplo1', 10, { prescindible: true }), local('proyecto', 'ejemplo2', 10, { prescindible: true })],
      [remoto('proyecto', 'real', 500)],
    );
    expect(plan.descartar).toEqual(['ejemplo1', 'ejemplo2']);
    expect(plan.subir).toEqual([]);
    expect(plan.bajar).toEqual(['proyecto_real']);
  });

  it('no descarta nada si aquí ya se trabajó', () => {
    const plan = planificar([local('proyecto', 'ejemplo1', 10, { prescindible: true }), local('proyecto', 'mio', 400)], [remoto('proyecto', 'real', 500)]);
    expect(plan.descartar).toEqual([]);
    expect(plan.subir).toEqual(['proyecto_ejemplo1', 'proyecto_mio']);
  });

  it('con la nube vacía no descarta los ejemplos: no hay nada que ponga en su lugar', () => {
    const plan = planificar([local('proyecto', 'ejemplo1', 10, { prescindible: true })], []);
    expect(plan.descartar).toEqual([]);
    expect(plan.subir).toEqual(['proyecto_ejemplo1']);
  });

  it('distingue un proyecto de un estudio con el mismo id', () => {
    const plan = planificar([local('proyecto', 'x', 100), local('estudio', 'x', 100)], [remoto('proyecto', 'x', 100)]);
    expect(plan.subir).toEqual(['estudio_x']);
    expect(clave({ tipo: 'estudio', id: 'x' })).toBe('estudio_x');
  });
});

describe('cuándo cambió un estudio', () => {
  const base: Study = {
    id: 'st1',
    projectId: 'p1',
    name: 'Prueba',
    tasks: [],
    snapshot: {} as Study['snapshot'],
    askAudio: false,
    owner: 'u1',
    status: 'open',
    created: 1000,
  };

  it('una sesión nueva lo vuelve más reciente, aunque el estudio no se haya tocado', () => {
    const sesion = { id: 's1', studyId: 'st1', startedAt: 5000, endedAt: 9000 } as Session;
    expect(marcaEstudio(base, [sesion])).toBe(9000);
  });

  it('el resumen por IA también cuenta como cambio', () => {
    expect(marcaEstudio({ ...base, summary: { themes: [], discardedThemes: 0, huella: 'h', at: 7000 } }, [])).toBe(7000);
  });

  it('sin nada más, vale su fecha de creación', () => {
    expect(marcaEstudio(base, [])).toBe(1000);
  });

  it('ignora las sesiones de otros estudios', () => {
    const ajena = { id: 's9', studyId: 'otro', startedAt: 99999, endedAt: 99999 } as Session;
    expect(marcaEstudio(base, [ajena])).toBe(1000);
  });
});
