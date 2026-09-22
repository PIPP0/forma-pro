// Presentación del estudio: el mismo informe, pero para defender una decisión frente a otras personas.
// Sale como .pptx editable; no pasa por ninguna API, se arma con los datos que ya están en este navegador.
import type PptxGenJS from 'pptxgenjs';
import type { Session, Study, StudyEvent } from './model';
import { fmtDuration, screenName, taskFunnel } from './analysis';
import { SEVERIDAD_LABEL, construirInforme, pct, type Hallazgo } from './insights';

const TINTA = '1D1D27';
const GRIS = '8B8B99';
const GRIS_TEXTO = '5D5D6D';
const ACENTO = '5B4DE0';
const ACENTO_SUAVE = 'F4F3FB';
const LINEA = 'E6E6EC';
const FUENTE = 'Arial';

/** Color de cada severidad: el mismo código del informe y de la pantalla. */
const COLOR_SEVERIDAD: Record<Hallazgo['severidad'], string> = {
  critica: 'C2312F',
  alta: 'C9701C',
  media: ACENTO,
  baja: '9A9AA8',
};

const fmt1 = (n: number) => n.toFixed(1).replace('.', ',');

export interface OpcionesDeck {
  autor?: string;
}

/** Arma la presentación y la descarga. Devuelve cuántas láminas quedaron. */
export async function descargarDeck(study: Study, sessions: Session[], events: StudyEvent[], nombreArchivo: string, opciones: OpcionesDeck = {}): Promise<number> {
  // La librería se carga solo cuando alguien exporta: no pesa en la carga inicial de la app.
  const { default: Pptx } = await import('pptxgenjs');
  const inf = construirInforme(study, sessions, events);
  const p = study.snapshot;
  const m = inf.metricas;
  const pptx = new Pptx();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = opciones.autor ?? 'Forma Studio';
  pptx.company = 'Forma Studio';
  pptx.title = study.name;
  pptx.subject = 'Informe de investigación con usuarios';

  const ANCHO = 10;
  const MARGEN = 0.62;
  const UTIL = ANCHO - MARGEN * 2;

  let numero = 0;
  /** Cada lámina nace con la misma cabecera y pie: la baraja se lee como un solo documento. */
  const lamina = (rotulo: string, notas?: string) => {
    const s = pptx.addSlide();
    numero++;
    s.background = { color: 'FFFFFF' };
    s.addText(
      [
        { text: 'forma', options: { bold: true, color: TINTA } },
        { text: '  studio', options: { color: GRIS } },
      ],
      { x: MARGEN, y: 0.26, w: 3, h: 0.25, fontSize: 11, fontFace: FUENTE },
    );
    s.addText(rotulo.toUpperCase(), { x: ANCHO - MARGEN - 4, y: 0.26, w: 4, h: 0.25, fontSize: 9, color: GRIS, align: 'right', charSpacing: 1.4, fontFace: FUENTE });
    s.addShape('line', { x: MARGEN, y: 0.58, w: UTIL, h: 0, line: { color: LINEA, width: 0.75 } });
    s.addText(`${study.name}  ·  v${p.version}`, { x: MARGEN, y: 5.18, w: 6, h: 0.25, fontSize: 8, color: GRIS, fontFace: FUENTE });
    s.addText(String(numero), { x: ANCHO - MARGEN - 1, y: 5.18, w: 1, h: 0.25, fontSize: 8, color: GRIS, align: 'right', fontFace: FUENTE });
    if (notas) s.addNotes(notas);
    return s;
  };

  const titulo = (s: PptxGenJS.Slide, texto: string, sub?: string) => {
    s.addText(texto, { x: MARGEN, y: 0.78, w: UTIL, h: 0.5, fontSize: 24, bold: true, color: TINTA, fontFace: FUENTE });
    if (sub) s.addText(sub, { x: MARGEN, y: 1.3, w: UTIL, h: 0.3, fontSize: 12, color: GRIS_TEXTO, fontFace: FUENTE });
  };

  // ---------- 1. Portada ----------
  {
    const s = lamina('Informe de investigación', 'Presenta el estudio: qué se probó, con cuánta gente y sobre qué versión del prototipo.');
    s.addShape('rect', { x: 0, y: 0, w: 0.16, h: 5.63, fill: { color: ACENTO } });
    s.addText(`${p.name.toUpperCase()}  ·  VERSIÓN V${p.version}`, { x: MARGEN, y: 1.55, w: UTIL, h: 0.3, fontSize: 10, color: GRIS, charSpacing: 1.6, fontFace: FUENTE });
    s.addText(study.name, { x: MARGEN, y: 1.9, w: UTIL * 0.82, h: 1.1, fontSize: 36, bold: true, color: TINTA, fontFace: FUENTE, lineSpacingMultiple: 0.95, shrinkText: true });
    s.addText(inf.resumen[0] ?? '', { x: MARGEN, y: 3.05, w: UTIL * 0.78, h: 0.6, fontSize: 13, color: GRIS_TEXTO, fontFace: FUENTE, shrinkText: true });
    s.addShape('line', { x: MARGEN, y: 3.9, w: UTIL, h: 0, line: { color: LINEA, width: 0.75 } });
    const ficha: [string, string][] = [
      ['Sesiones', m.sinteticas ? `${m.sesiones} (${m.reales} reales, ${m.sinteticas} sintéticas)` : String(m.sesiones)],
      ['Tareas evaluadas', String(study.tasks.length)],
      ['Fecha', new Date(inf.generado).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })],
      ['Preparado por', opciones.autor || 'Equipo de diseño'],
    ];
    ficha.forEach(([k, v], i) => {
      const x = MARGEN + i * (UTIL / 4);
      s.addText(k.toUpperCase(), { x, y: 4.1, w: UTIL / 4 - 0.2, h: 0.2, fontSize: 8, color: GRIS, charSpacing: 1.2, fontFace: FUENTE });
      s.addText(v, { x, y: 4.32, w: UTIL / 4 - 0.2, h: 0.4, fontSize: 11, color: TINTA, fontFace: FUENTE });
    });
  }

  // ---------- 2. El número ----------
  if (m.indice != null) {
    const s = lamina('Resultado general', `El Índice Forma resume tres cosas: cuánta gente logró la tarea, cuánto le costó frente al camino más corto y cuánto esfuerzo sintió. ${m.lectura}`);
    titulo(s, 'Índice Forma');
    s.addShape('roundRect', { x: MARGEN, y: 1.75, w: 2.9, h: 2.5, fill: { color: ACENTO_SUAVE }, line: { color: 'FFFFFF', width: 0 }, rectRadius: 0.12 });
    s.addText(String(m.indice), { x: MARGEN, y: 2.05, w: 2.9, h: 1.3, fontSize: 80, bold: true, color: ACENTO, align: 'center', fontFace: FUENTE });
    s.addText('de 100', { x: MARGEN, y: 3.35, w: 2.9, h: 0.3, fontSize: 12, color: GRIS_TEXTO, align: 'center', fontFace: FUENTE });
    // Barra de avance: la misma cifra, para quien lee de lejos.
    s.addShape('roundRect', { x: MARGEN + 0.4, y: 3.8, w: 2.1, h: 0.14, fill: { color: 'E4E2F4' }, rectRadius: 0.07 });
    s.addShape('roundRect', { x: MARGEN + 0.4, y: 3.8, w: Math.max(0.14, (2.1 * m.indice) / 100), h: 0.14, fill: { color: ACENTO }, rectRadius: 0.07 });

    s.addText(m.lectura, { x: MARGEN + 3.3, y: 1.85, w: UTIL - 3.3, h: 0.9, fontSize: 17, bold: true, color: TINTA, fontFace: FUENTE, lineSpacingMultiple: 1.1 });
    s.addText('Combina tareas logradas (45%), eficiencia frente al camino más corto (25%) y esfuerzo percibido (30%).', {
      x: MARGEN + 3.3,
      y: 2.85,
      w: UTIL - 3.3,
      h: 0.5,
      fontSize: 11,
      color: GRIS_TEXTO,
      fontFace: FUENTE,
    });
    if (m.confianza !== 'alta')
      s.addText(`Muestra ${m.confianza === 'media' ? 'acotada' : 'exploratoria'}: ${m.sesiones} ${m.sesiones === 1 ? 'sesión' : 'sesiones'}. Sirve para priorizar, no para afirmar magnitudes.`, {
        x: MARGEN + 3.3,
        y: 3.5,
        w: UTIL - 3.3,
        h: 0.45,
        fontSize: 10,
        color: '946200',
        fill: { color: 'FFF3D6' },
        fontFace: FUENTE,
        margin: 8,
      });
  }

  // ---------- 3. Indicadores ----------
  {
    const s = lamina('Indicadores', 'Las cuatro cifras que sostienen el índice. El intervalo de confianza acompaña la tasa de éxito porque con pocas sesiones el porcentaje solo no basta.');
    titulo(s, 'Los números', 'Cada cifra sale de los eventos registrados en las sesiones, no de una estimación.');
    const tarjetas: [string, string, string][] = [
      ['Tareas logradas', pct(m.exitoPct), `IC 95%: ${pct(m.ic[0])}–${pct(m.ic[1])}`],
      ['Mediana por tarea', m.medianaMs != null ? fmtDuration(m.medianaMs) : '—', m.p75Ms != null ? `75% bajo ${fmtDuration(m.p75Ms)}` : ''],
      ['Eficiencia de recorrido', m.eficiencia != null ? pct(m.eficiencia) : '—', 'camino más corto vs. real'],
      ['Dificultad percibida', m.dificultad != null ? fmt1(m.dificultad) : '—', 'escala 1 a 5'],
    ];
    const ancho = (UTIL - 0.3 * 3) / 4;
    tarjetas.forEach(([etiqueta, valor, nota], i) => {
      const x = MARGEN + i * (ancho + 0.3);
      s.addShape('roundRect', { x, y: 1.95, w: ancho, h: 1.5, fill: { color: 'FFFFFF' }, line: { color: LINEA, width: 1 }, rectRadius: 0.1 });
      s.addText(valor, { x, y: 2.15, w: ancho, h: 0.65, fontSize: 30, bold: true, color: TINTA, align: 'center', fontFace: FUENTE });
      s.addText(etiqueta, { x, y: 2.82, w: ancho, h: 0.25, fontSize: 11, color: TINTA, align: 'center', fontFace: FUENTE });
      if (nota) s.addText(nota, { x, y: 3.05, w: ancho, h: 0.3, fontSize: 9, color: GRIS, align: 'center', fontFace: FUENTE });
    });
    const abajo: string[] = [
      `${fmt1(m.erroresPorSesion)} toques sin acción por sesión`,
      `${fmt1(m.dudasPorSesion)} dudas por sesión`,
      (() => {
        const n = inf.hallazgos.filter((h) => h.severidad === 'critica' || h.severidad === 'alta').length;
        return `${n} ${n === 1 ? 'hallazgo' : 'hallazgos'} de severidad crítica o alta`;
      })(),
    ];
    s.addText(abajo.join('     ·     '), { x: MARGEN, y: 3.75, w: UTIL, h: 0.3, fontSize: 11, color: GRIS_TEXTO, align: 'center', fontFace: FUENTE });
  }

  // ---------- 4. Qué decidir ----------
  {
    const s = lamina('Resumen ejecutivo', 'Si alguien solo escucha una lámina, que sea esta.');
    titulo(s, 'Qué encontramos y qué decidir');
    const puntos = inf.resumen.slice(1).filter((r) => !r.startsWith('Índice Forma'));
    s.addText(
      puntos.map((t) => ({ text: t, options: { bullet: { code: '2022', indent: 14 }, breakLine: true, paraSpaceAfter: 10 } })),
      { x: MARGEN, y: 1.6, w: UTIL, h: 3.3, fontSize: 13, color: TINTA, fontFace: FUENTE, lineSpacingMultiple: 1.15, valign: 'top', shrinkText: true },
    );
  }

  // ---------- 5 a 7. Un hallazgo por lámina ----------
  const comentarioDe = (sessionId: string, taskId: string) => {
    const ses = sessions.find((x) => x.id === sessionId);
    const f = ses?.feedback.find((x) => x.taskId === taskId);
    return f?.comment ? `«${f.comment}»  — ${ses!.participant}` : undefined;
  };

  inf.hallazgos.slice(0, 3).forEach((h, i) => {
    const color = COLOR_SEVERIDAD[h.severidad];
    const s = lamina(`Hallazgo ${i + 1} de ${Math.min(3, inf.hallazgos.length)}`, `Severidad ${SEVERIDAD_LABEL[h.severidad].toLowerCase()}, impacto ${h.puntaje} de 100. ${h.recomendacion}`);
    s.addShape('rect', { x: MARGEN, y: 0.78, w: 0.06, h: 0.62, fill: { color } });
    s.addText(h.titulo, { x: MARGEN + 0.24, y: 0.76, w: UTIL - 0.24, h: 0.66, fontSize: 19, bold: true, color: TINTA, fontFace: FUENTE, lineSpacingMultiple: 1, shrinkText: true });
    s.addText(
      [
        { text: SEVERIDAD_LABEL[h.severidad], options: { color, bold: true } },
        { text: `   ·   afecta a ${h.afectados} de ${h.total}   ·   impacto ${h.puntaje}/100${h.segmentos.length ? `   ·   se concentra en ${h.segmentos.join(', ')}` : ''}`, options: { color: GRIS } },
      ],
      { x: MARGEN + 0.24, y: 1.45, w: UTIL - 0.24, h: 0.25, fontSize: 10, fontFace: FUENTE },
    );

    s.addText('EVIDENCIA', { x: MARGEN + 0.24, y: 1.92, w: 4.6, h: 0.22, fontSize: 9, bold: true, color: GRIS, charSpacing: 1.2, fontFace: FUENTE });
    s.addText(
      h.evidencia.slice(0, 4).map((e) => ({ text: e, options: { bullet: { code: '2022', indent: 14 }, breakLine: true, paraSpaceAfter: 6 } })),
      { x: MARGEN + 0.24, y: 2.18, w: 4.6, h: 2.1, fontSize: 11, color: GRIS_TEXTO, fontFace: FUENTE, valign: 'top', shrinkText: true },
    );

    s.addShape('roundRect', { x: MARGEN + 5.2, y: 1.92, w: UTIL - 5.2, h: 2.05, fill: { color: ACENTO_SUAVE }, line: { color: 'FFFFFF', width: 0 }, rectRadius: 0.1 });
    s.addText('QUÉ HACER', { x: MARGEN + 5.4, y: 2.06, w: UTIL - 5.6, h: 0.22, fontSize: 9, bold: true, color: ACENTO, charSpacing: 1.2, fontFace: FUENTE });
    s.addText(h.recomendacion, { x: MARGEN + 5.4, y: 2.3, w: UTIL - 5.6, h: 1.6, fontSize: 10.5, color: TINTA, fontFace: FUENTE, valign: 'top', shrinkText: true });

    const cita = h.citations.map((c) => comentarioDe(c.sessionId, c.taskId)).find((x): x is string => !!x);
    if (cita) {
      s.addShape('rect', { x: MARGEN + 5.2, y: 4.15, w: 0.04, h: 0.8, fill: { color: LINEA } });
      s.addText(cita, { x: MARGEN + 5.36, y: 4.1, w: UTIL - 5.5, h: 0.9, fontSize: 10, italic: true, color: GRIS_TEXTO, fontFace: FUENTE, valign: 'top', shrinkText: true });
    }
  });

  // ---------- 8. Desempeño por tarea ----------
  {
    const s = lamina('Desempeño por tarea', 'El corte muestra el paso exacto del camino más corto donde se pierde más gente: ahí conviene intervenir primero.');
    titulo(s, 'Dónde cuesta y cuánto');
    const filas: PptxGenJS.TableRow[] = [
      [
        { text: 'Tarea', options: { bold: true, color: GRIS, fontSize: 9 } },
        { text: 'Lograda', options: { bold: true, color: GRIS, fontSize: 9, align: 'right' } },
        { text: 'Mediana', options: { bold: true, color: GRIS, fontSize: 9, align: 'right' } },
        { text: 'Pasos', options: { bold: true, color: GRIS, fontSize: 9, align: 'right' } },
        { text: 'Se pierde en', options: { bold: true, color: GRIS, fontSize: 9 } },
      ],
      ...inf.tareas.map((t): PptxGenJS.TableRow => [
        { text: t.prompt, options: { fontSize: 10, color: TINTA } },
        { text: `${pct(t.exitoPct)}\n${t.exito} de ${t.personas}`, options: { fontSize: 10, color: TINTA, align: 'right' } },
        { text: t.medianaMs != null ? fmtDuration(t.medianaMs) : '—', options: { fontSize: 10, color: TINTA, align: 'right' } },
        { text: `${t.pasosMediana ?? '—'}${t.pasosOptimos != null ? `\nóptimo ${t.pasosOptimos}` : ''}`, options: { fontSize: 10, color: TINTA, align: 'right' } },
        { text: t.corte ? `${t.corte.desde} → ${t.corte.hacia}\n−${t.corte.perdidos}` : '—', options: { fontSize: 10, color: TINTA } },
      ]),
    ];
    s.addTable(filas, {
      x: MARGEN,
      y: 1.6,
      w: UTIL,
      colW: [3.5, 1.1, 1, 0.95, 2.21],
      border: { type: 'solid', color: LINEA, pt: 0.5 },
      fontFace: FUENTE,
      valign: 'middle',
      rowH: 0.42,
      autoPage: false,
    });
  }

  // ---------- 9. Por perfil ----------
  if (inf.segmentos.length > 1) {
    const s = lamina('Comparativa por perfil', 'Arriba, a quien el flujo le exige más. Un promedio general esconde estas diferencias.');
    titulo(s, 'El mismo flujo no le sirve igual a todos');
    const filas: PptxGenJS.TableRow[] = [
      [
        { text: 'Perfil o dispositivo', options: { bold: true, color: GRIS, fontSize: 9 } },
        { text: 'Sesiones', options: { bold: true, color: GRIS, fontSize: 9, align: 'right' } },
        { text: 'Logradas', options: { bold: true, color: GRIS, fontSize: 9, align: 'right' } },
        { text: 'Mediana', options: { bold: true, color: GRIS, fontSize: 9, align: 'right' } },
        { text: 'Dificultad', options: { bold: true, color: GRIS, fontSize: 9, align: 'right' } },
      ],
      ...inf.segmentos.slice(0, 7).map((g): PptxGenJS.TableRow => [
        { text: g.nombre, options: { fontSize: 10, color: TINTA } },
        { text: String(g.n), options: { fontSize: 10, color: TINTA, align: 'right' } },
        { text: pct(g.exitoPct), options: { fontSize: 10, color: TINTA, align: 'right' } },
        { text: g.medianaMs != null ? fmtDuration(g.medianaMs) : '—', options: { fontSize: 10, color: TINTA, align: 'right' } },
        { text: g.dificultad != null ? `${fmt1(g.dificultad)} de 5` : '—', options: { fontSize: 10, color: TINTA, align: 'right' } },
      ]),
    ];
    s.addTable(filas, { x: MARGEN, y: 1.6, w: UTIL, colW: [3.3, 1.3, 1.4, 1.4, 1.36], border: { type: 'solid', color: LINEA, pt: 0.5 }, fontFace: FUENTE, valign: 'middle', rowH: 0.4, autoPage: false });
  }

  // ---------- 10. Método y límites ----------
  {
    const s = lamina('Método y alcance', 'Decir los límites antes de que los pregunten es lo que hace creíble el resto.');
    titulo(s, 'Cómo se obtuvo esto');
    s.addText(
      `Cada persona recibió las tareas en orden sobre una copia congelada del prototipo (versión v${p.version}, ${p.screens.length} pantallas). Se registró cada toque, cada pausa antes de actuar, cada toque sin efecto y la ruta completa entre pantallas, además de la dificultad percibida y un comentario abierto al terminar cada tarea.`,
      { x: MARGEN, y: 1.55, w: UTIL, h: 0.8, fontSize: 11.5, color: GRIS_TEXTO, fontFace: FUENTE, valign: 'top' },
    );
    s.addText('ALCANCE Y LIMITACIONES', { x: MARGEN, y: 2.5, w: UTIL, h: 0.22, fontSize: 9, bold: true, color: GRIS, charSpacing: 1.2, fontFace: FUENTE });
    s.addText(
      inf.limitaciones.map((t) => ({ text: t, options: { bullet: { code: '2022', indent: 14 }, breakLine: true, paraSpaceAfter: 8 } })),
      { x: MARGEN, y: 2.78, w: UTIL, h: 2.1, fontSize: 11, color: GRIS_TEXTO, fontFace: FUENTE, valign: 'top', shrinkText: true },
    );
  }

  // ---------- 11. Próximos pasos ----------
  {
    const acciones = inf.hallazgos.slice(0, 4).map((h, i) => `${i + 1}. ${h.recomendacion.split('.')[0]}.`);
    const s = lamina('Próximos pasos', 'Las acciones salen de los hallazgos, en el mismo orden de impacto.');
    titulo(s, 'Qué haríamos ahora', acciones.length ? 'En orden de impacto sobre la tarea.' : undefined);
    if (acciones.length)
      s.addText(
        acciones.map((t) => ({ text: t, options: { breakLine: true, paraSpaceAfter: 12 } })),
        { x: MARGEN, y: 1.75, w: UTIL, h: 2.6, fontSize: 13, color: TINTA, fontFace: FUENTE, valign: 'top', lineSpacingMultiple: 1.1, shrinkText: true },
      );
    else s.addText('No se detectaron problemas que corregir en las sesiones analizadas.', { x: MARGEN, y: 1.9, w: UTIL, h: 0.5, fontSize: 13, color: TINTA, fontFace: FUENTE });
    s.addShape('line', { x: MARGEN, y: 4.5, w: UTIL, h: 0, line: { color: LINEA, width: 0.75 } });
    s.addText(
      m.sinteticas ? `Este estudio incluye ${m.sinteticas} ${m.sinteticas === 1 ? 'sesión sintética' : 'sesiones sintéticas'}: confirma los hallazgos con personas reales antes de decisiones irreversibles.` : 'Vuelve a medir las mismas tareas después de corregir, para comprobar que la tasa de éxito subió.',
      { x: MARGEN, y: 4.62, w: UTIL, h: 0.4, fontSize: 10.5, color: GRIS_TEXTO, italic: true, fontFace: FUENTE },
    );
  }

  await pptx.writeFile({ fileName: nombreArchivo });
  return numero;
}
