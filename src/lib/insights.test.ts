import { describe, expect, it } from 'vitest';
import { exampleStudy, transferProject } from './seed';
import { personasBase, simularTanda } from './synthetic';
import { construirInforme, segmentoDe, wilson } from './insights';
import { informeHtml, informeMarkdown } from './report';

function escenario(semilla = 11) {
  const p = transferProject('u1');
  const { study, sessions, events } = exampleStudy(p, 'u1');
  const base = personasBase();
  const sint = simularTanda(
    study,
    [
      { persona: base[0], cantidad: 2 },
      { persona: base[4], cantidad: 2 },
    ],
    semilla,
  );
  return { study, sessions: [...sessions, ...sint.map((s) => s.session)], events: [...events, ...sint.flatMap((s) => s.events)] };
}

describe('intervalo de confianza', () => {
  it('se ensancha cuando hay pocas sesiones', () => {
    const pocas = wilson(4, 5);
    const muchas = wilson(80, 100);
    expect(pocas[1] - pocas[0]).toBeGreaterThan(muchas[1] - muchas[0]);
    expect(muchas[0]).toBeLessThan(0.8);
    expect(muchas[1]).toBeGreaterThan(0.8);
  });

  it('sin datos no inventa un rango', () => {
    expect(wilson(0, 0)).toEqual([0, 0]);
  });
});

describe('informe', () => {
  it('ordena los hallazgos por impacto y les pone severidad y recomendación', () => {
    const { study, sessions, events } = escenario();
    const inf = construirInforme(study, sessions, events);
    expect(inf.hallazgos.length).toBeGreaterThan(0);
    for (let i = 1; i < inf.hallazgos.length; i++) expect(inf.hallazgos[i - 1].puntaje).toBeGreaterThanOrEqual(inf.hallazgos[i].puntaje);
    for (const h of inf.hallazgos) {
      expect(h.recomendacion.length).toBeGreaterThan(40);
      expect(h.evidencia.length).toBeGreaterThan(0);
      expect(['critica', 'alta', 'media', 'baja']).toContain(h.severidad);
    }
    // Un abandono pesa más que una duda con la misma frecuencia.
    const abandono = inf.hallazgos.find((h) => h.kind === 'giveup');
    const duda = inf.hallazgos.find((h) => h.kind === 'hesitation');
    if (abandono && duda && abandono.afectados >= duda.afectados) expect(abandono.puntaje).toBeGreaterThan(duda.puntaje);
  });

  it('la recomendación nombra la pantalla real, no una plantilla', () => {
    const { study, sessions, events } = escenario();
    const inf = construirInforme(study, sessions, events);
    const conPantalla = inf.hallazgos.filter((h) => h.screenId);
    expect(conPantalla.length).toBeGreaterThan(0);
    expect(conPantalla.some((h) => h.recomendacion.includes('«'))).toBe(true);
  });

  it('mide eficiencia contra el camino más corto', () => {
    const { study, sessions, events } = escenario();
    const inf = construirInforme(study, sessions, events);
    for (const t of inf.tareas) {
      if (t.pasosOptimos != null) expect(t.pasosOptimos).toBeGreaterThan(0);
      if (t.eficiencia != null) {
        expect(t.eficiencia).toBeGreaterThan(0);
        expect(t.eficiencia).toBeLessThanOrEqual(1);
      }
    }
    expect(inf.metricas.indice).not.toBeNull();
    expect(inf.metricas.indice!).toBeGreaterThanOrEqual(0);
    expect(inf.metricas.indice!).toBeLessThanOrEqual(100);
  });

  it('separa segmentos y advierte cuando hay sesiones sintéticas', () => {
    const { study, sessions, events } = escenario();
    const inf = construirInforme(study, sessions, events);
    expect(inf.segmentos.length).toBeGreaterThan(1);
    expect(inf.segmentos.map((s) => s.nombre)).toContain('Adulto mayor');
    // Se ordenan de peor a mejor: arriba, a quien el flujo le exige más.
    for (let i = 1; i < inf.segmentos.length; i++) expect(inf.segmentos[i - 1].exitoPct).toBeLessThanOrEqual(inf.segmentos[i].exitoPct);
    expect(inf.metricas.sinteticas).toBe(4);
    expect(inf.limitaciones.some((l) => l.includes('sintéticos'))).toBe(true);
  });

  it('el segmento sale del perfil sintético y, si no, del dispositivo', () => {
    const { sessions } = escenario();
    const sint = sessions.find((s) => s.source === 'synthetic')!;
    const real = sessions.find((s) => s.source !== 'synthetic')!;
    expect(sint.participant).toContain(segmentoDe(sint));
    expect(['Móvil', 'Tablet', 'Escritorio']).toContain(segmentoDe(real));
  });
});

describe('documento exportado', () => {
  it('el HTML trae portada, hallazgos, método y anexo, y escapa el contenido', () => {
    const { study, sessions, events } = escenario();
    const html = informeHtml({ ...study, name: 'Prueba <script>alert(1)</script>' }, sessions, events, 'Equipo');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    for (const seccion of ['Resumen ejecutivo', 'Hallazgos priorizados', 'Desempeño por tarea', 'Cómo se obtuvo esto', 'Alcance y limitaciones'])
      expect(html).toContain(seccion);
  });

  it('el texto plano sirve para pegar en un correo', () => {
    const { study, sessions, events } = escenario();
    const md = informeMarkdown(study, sessions, events);
    expect(md).toContain('## Resumen ejecutivo');
    expect(md).toContain('## Hallazgos priorizados');
    expect(md).toContain('| Indicador | Valor |');
  });
});
