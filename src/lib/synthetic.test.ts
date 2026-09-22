import { describe, expect, it } from 'vitest';
import { exampleStudy, transferProject } from './seed';
import { personasBase, salidasDe, simularSesion, simularTanda } from './synthetic';
import { analyzeStudy } from './analysis';

const estudio = () => {
  const p = transferProject('u1');
  return exampleStudy(p, 'u1').study;
};

describe('personas sintéticas', () => {
  it('nacen los seis segmentos, con id estable y rasgos en rango', () => {
    const base = personasBase();
    expect(base.map((p) => p.segment)).toEqual(['Universitario', 'Masivo', 'Preferencial', 'Premium', 'Adulto mayor', 'Familiar']);
    for (const p of base) {
      expect(p.builtIn).toBe(true);
      expect(p.goals.length).toBeGreaterThan(0);
      expect(p.frustrations.length).toBeGreaterThan(0);
      expect(p.quote.length).toBeGreaterThan(10);
      for (const v of Object.values(p.traits)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(5);
      }
    }
  });

  it('las salidas de una pantalla apuntan a pantallas que existen', () => {
    const p = transferProject('u1');
    for (const s of p.screens) {
      for (const salida of salidasDe(p, s)) {
        expect(p.screens.some((x) => x.id === salida.destino)).toBe(true);
        expect(salida.x).toBeGreaterThanOrEqual(0);
        expect(salida.x).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('simulación', () => {
  it('produce una sesión completa y marcada como sintética', () => {
    const study = estudio();
    const [david] = personasBase();
    const { session, events } = simularSesion(study, david, 0, 42);
    expect(session.source).toBe('synthetic');
    expect(session.syntheticId).toBe(david.id);
    expect(session.status).toBe('completed');
    expect(session.consent.participate).toBe(true);
    expect(session.hasAudio).toBeUndefined();
    expect(session.feedback).toHaveLength(study.tasks.length);
    expect(events.every((e) => e.sessionId === session.id)).toBe(true);
    expect(events.filter((e) => e.kind === 'task_start')).toHaveLength(study.tasks.length);
    for (const f of session.feedback) {
      expect(f.difficulty).toBeGreaterThanOrEqual(1);
      expect(f.difficulty).toBeLessThanOrEqual(5);
      expect(f.durationMs).toBeGreaterThan(0);
    }
  });

  it('la misma semilla repite el recorrido y otra semilla lo cambia', () => {
    const study = estudio();
    const [david] = personasBase();
    const kinds = (semilla: number) => simularSesion(study, david, 0, semilla).events.map((e) => `${e.kind}:${e.screen}`).join('|');
    expect(kinds(7)).toEqual(kinds(7));
    expect(kinds(7)).not.toEqual(kinds(99));
  });

  it('quien tiene menos soltura digital se demora más que quien tiene más', () => {
    const study = estudio();
    const base = personasBase();
    const david = base[0];
    const oscar = base[4];
    const duracion = (p: (typeof base)[number]) => {
      let total = 0;
      for (let i = 0; i < 12; i++) {
        const { session } = simularSesion(study, p, i, 1234);
        total += session.endedAt! - session.startedAt;
      }
      return total;
    };
    expect(duracion(oscar)).toBeGreaterThan(duracion(david));
  });

  it('una tanda respeta las cantidades pedidas y da sesiones distintas', () => {
    const study = estudio();
    const base = personasBase();
    const salidas = simularTanda(study, [
      { persona: base[0], cantidad: 2 },
      { persona: base[4], cantidad: 3 },
    ], 5);
    expect(salidas).toHaveLength(5);
    expect(new Set(salidas.map((s) => s.session.id)).size).toBe(5);
    expect(salidas.filter((s) => s.session.syntheticId === base[4].id)).toHaveLength(3);
  });

  it('el análisis lee las sesiones sintéticas como cualquier otra', () => {
    const study = estudio();
    const salidas = simularTanda(study, personasBase().map((p) => ({ persona: p, cantidad: 1 })), 3);
    const eventos = salidas.flatMap((s) => s.events);
    const a = analyzeStudy(study, salidas.map((s) => s.session), eventos);
    expect(a.total).toBe(6);
    expect(a.tasks).toHaveLength(study.tasks.length);
    // Las dudas tienen que llegar como eventos con duración: si no, los resultados dirían «0 dudas».
    const dudas = eventos.filter((e) => e.kind === 'hesitation');
    expect(dudas.length).toBeGreaterThan(0);
    expect(dudas.every((e) => (e.dwell ?? 0) > 0)).toBe(true);
  });
});
