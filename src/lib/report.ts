// Informe de estudio: un documento que se puede mandar a un comité sin retocar nada.
// Sale como HTML autocontenido; el navegador lo imprime a PDF con Cmd+P.
import type { Session, Study, StudyEvent } from './model';
import { blockLabel, fmtDuration, screenName, taskFunnel } from './analysis';
import { SEVERIDAD_LABEL, construirInforme, pct, segmentoDe, type Hallazgo, type Informe } from './insights';

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fecha = (ts: number) => new Date(ts).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

const MARCA = `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M7.5 3.3h9a4.2 4.2 0 0 1 4.2 4.2v9a4.2 4.2 0 0 1-4.2 4.2h-9a4.2 4.2 0 0 1-4.2-4.2v-9a4.2 4.2 0 0 1 4.2-4.2Z" fill="none" stroke="#1d1d27" stroke-width="2.5" stroke-linejoin="round"/><circle cx="16.7" cy="12" r="2.05" fill="#5b4de0"/></svg>`;

/** Anillo con el índice: la primera cifra que alguien va a mirar. */
function anillo(valor: number) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const avance = (Math.max(0, Math.min(100, valor)) / 100) * c;
  return `<svg viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="Índice Forma ${valor} de 100">
    <circle cx="64" cy="64" r="${r}" fill="none" stroke="#e9e7f6" stroke-width="10"/>
    <circle cx="64" cy="64" r="${r}" fill="none" stroke="#5b4de0" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${avance.toFixed(1)} ${(c - avance).toFixed(1)}" transform="rotate(-90 64 64)"/>
    <text x="64" y="70" text-anchor="middle" font-size="34" font-weight="600" fill="#1d1d27">${valor}</text>
    <text x="64" y="88" text-anchor="middle" font-size="11" fill="#8b8b99">de 100</text>
  </svg>`;
}

const barra = (v: number, tono = '#5b4de0') =>
  `<span class="barra"><span style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%;background:${tono}"></span></span>`;

function tarjeta(valor: string, etiqueta: string, nota?: string) {
  return `<div class="kpi"><span class="kpi-v">${esc(valor)}</span><span class="kpi-l">${esc(etiqueta)}</span>${nota ? `<span class="kpi-n">${esc(nota)}</span>` : ''}</div>`;
}

function bloqueHallazgo(h: Hallazgo, i: number, citasTexto: string[]) {
  return `<article class="hallazgo sev-${h.severidad}">
    <header>
      <span class="orden">${String(i + 1).padStart(2, '0')}</span>
      <div>
        <h3>${esc(h.titulo)}</h3>
        <p class="meta"><span class="sev">${SEVERIDAD_LABEL[h.severidad]}</span> · afecta a ${h.afectados} de ${h.total} · impacto ${h.puntaje}/100${h.segmentos.length ? ` · se concentra en ${esc(h.segmentos.join(', '))}` : ''}</p>
      </div>
    </header>
    <div class="cols">
      <div>
        <h4>Evidencia</h4>
        <ul>${h.evidencia.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
      </div>
      <div>
        <h4>Qué hacer</h4>
        <p>${esc(h.recomendacion)}</p>
      </div>
    </div>
    ${citasTexto.length ? `<div class="voces">${citasTexto.map((c) => `<blockquote>${esc(c)}</blockquote>`).join('')}</div>` : ''}
  </article>`;
}

export function informeHtml(study: Study, sessions: Session[], events: StudyEvent[], autor?: string): string {
  const inf: Informe = construirInforme(study, sessions, events);
  const p = study.snapshot;
  const m = inf.metricas;
  const ok = sessions.filter((s) => s.studyId === study.id && s.consent.participate);

  // Para cada hallazgo, una o dos frases textuales de quienes lo vivieron.
  // Una cita se usa una sola vez en todo el documento: repetirla haría parecer que hay más evidencia de la que hay.
  const citadas = new Set<string>();
  const comentarioDe = (sessionId: string, taskId: string) => {
    const s = ok.find((x) => x.id === sessionId);
    const f = s?.feedback.find((x) => x.taskId === taskId);
    if (!f?.comment || citadas.has(`${sessionId}|${taskId}`)) return undefined;
    citadas.add(`${sessionId}|${taskId}`);
    return `${f.comment} — ${s!.participant}`;
  };

  const embudos = study.tasks
    .map((t) => {
      const pasos = taskFunnel(study, sessions, events, t.id);
      if (!pasos.length) return '';
      return `<div class="embudo">
        <h4>${esc(t.prompt)}</h4>
        <ol>${pasos
          .map(
            (s, i) =>
              `<li><span class="paso">${String(i + 1).padStart(2, '0')}</span><span class="nom">${esc(s.name)}</span>${barra(s.started ? s.reached / s.started : 0)}<span class="cifra">${s.reached} de ${s.started}</span></li>`,
          )
          .join('')}</ol>
      </div>`;
    })
    .join('');

  const verbatims = inf.quotes
    .filter((q) => q.comment.length > 25)
    .slice(0, 8)
    .map((q) => `<figure><blockquote>${esc(q.comment)}</blockquote><figcaption>${esc(q.participant)}${q.difficulty ? ` · dificultad ${q.difficulty} de 5` : ''}</figcaption></figure>`)
    .join('');

  const filasSesion = ok
    .map((s) => {
      const logros = s.feedback.filter((f) => f.outcome === 'success').length;
      return `<tr>
        <td>${esc(s.participant)}</td>
        <td>${esc(segmentoDe(s))}</td>
        <td>${esc(s.context ?? '—')}</td>
        <td class="num">${logros} de ${study.tasks.length}</td>
        <td class="num">${s.feedback.length ? (s.feedback.reduce((a, f) => a + (f.difficulty ?? 0), 0) / s.feedback.length).toFixed(1).replace('.', ',') : '—'}</td>
        <td>${s.source === 'synthetic' ? 'Sintética' : s.source === 'example' ? 'Ejemplo' : s.source === 'import' ? 'Importada' : s.source === 'cloud' ? 'Remota' : 'Local'}</td>
        <td>${new Date(s.startedAt).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
      </tr>`;
    })
    .join('');

  const css = `
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--ink:#1d1d27;--ink2:#5d5d6d;--ink3:#8b8b99;--linea:#e6e6ec;--acento:#5b4de0;--suave:#f4f3fb}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font:400 11.5pt/1.55 'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;color:var(--ink);background:#f1f1f4;font-feature-settings:'cv11','ss01';font-variant-numeric:tabular-nums}
  .hoja{width:210mm;min-height:297mm;margin:0 auto 10mm;padding:22mm 20mm;background:#fff;box-shadow:0 1px 3px rgba(20,20,40,.12)}
  h1{font-size:30pt;line-height:1.1;letter-spacing:-.02em;font-weight:600}
  h2{font-size:15pt;font-weight:600;letter-spacing:-.01em;margin:0 0 10px}
  h3{font-size:12.5pt;font-weight:600;line-height:1.35}
  h4{font-size:8.5pt;text-transform:uppercase;letter-spacing:.09em;color:var(--ink3);font-weight:600;margin-bottom:6px}
  p{margin:0 0 8px}
  .rotulo{font-size:8.5pt;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3)}
  .cab{display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid var(--linea);margin-bottom:26px}
  .cab .marca{display:flex;align-items:center;gap:8px;font-weight:600;letter-spacing:-.01em}
  .portada{display:flex;flex-direction:column;min-height:245mm}
  .portada .centro{margin-top:auto;margin-bottom:auto}
  .portada h1{margin:14px 0 18px;max-width:15ch}
  .ficha{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 28px;margin-top:26px;padding-top:18px;border-top:1px solid var(--linea);max-width:135mm}
  .ficha div span{display:block}
  .ficha .k{font-size:8.5pt;letter-spacing:.09em;text-transform:uppercase;color:var(--ink3)}
  .ficha .v{font-size:11pt}
  .indice{display:flex;align-items:center;gap:22px;padding:18px 20px;background:var(--suave);border-radius:10px;margin:20px 0 26px}
  .indice p{margin:0;color:var(--ink2);max-width:52ch}
  .indice strong{display:block;color:var(--ink);font-size:12pt;margin-bottom:4px}
  .resumen li{margin:0 0 10px 18px;padding-left:4px}
  .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--linea);border:1px solid var(--linea);border-radius:8px;overflow:hidden;margin:16px 0 26px}
  .kpi{background:#fff;padding:12px 14px;display:flex;flex-direction:column;gap:2px}
  .kpi-v{font-size:19pt;font-weight:600;letter-spacing:-.02em}
  .kpi-l{font-size:9pt;color:var(--ink2)}
  .kpi-n{font-size:8pt;color:var(--ink3)}
  table{width:100%;border-collapse:collapse;font-size:10pt;table-layout:fixed}
  th{text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;padding:0 10px 7px 0;border-bottom:1px solid var(--linea);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  td{padding:9px 10px 9px 0;border-bottom:1px solid #f1f1f5;vertical-align:top;word-break:break-word}
  td.num,th.num{text-align:right;padding-right:0;white-space:nowrap}
  td:last-child,th:last-child{padding-right:0}
  td:last-child:not(.num),th:last-child:not(.num){padding-left:14px}
  .sub{display:block;color:var(--ink3);font-size:8.5pt;margin-top:2px}
  table.anexo{font-size:9pt}
  table.anexo td{padding:7px 8px 7px 0}
  .barra{display:inline-block;width:100%;height:5px;border-radius:3px;background:#ecebf4;overflow:hidden;vertical-align:middle}
  .barra span{display:block;height:100%;border-radius:3px}
  .hallazgo{border-top:2px solid var(--ink);padding:14px 0 18px;page-break-inside:avoid}
  .hallazgo.sev-critica{border-top-color:#c2312f}
  .hallazgo.sev-alta{border-top-color:#c9701c}
  .hallazgo.sev-media{border-top-color:#5b4de0}
  .hallazgo.sev-baja{border-top-color:#9a9aa8}
  .hallazgo header{display:flex;gap:14px;align-items:flex-start}
  .orden{font-size:10pt;color:var(--ink3);padding-top:2px;min-width:22px}
  .meta{font-size:9pt;color:var(--ink3);margin:4px 0 0}
  .sev{font-weight:600;color:var(--ink)}
  .sev-critica .sev{color:#c2312f}
  .sev-alta .sev{color:#c9701c}
  .cols{display:grid;grid-template-columns:1.25fr 1fr;gap:26px;margin:12px 0 0;padding-left:36px}
  .cols ul{margin:0;padding-left:16px}
  .cols li{margin-bottom:4px;color:var(--ink2)}
  .cols p{color:var(--ink2)}
  .voces{padding-left:36px;margin-top:10px}
  .voces blockquote{border-left:2px solid var(--linea);padding:2px 0 2px 12px;color:var(--ink2);font-style:italic;font-size:10pt;margin-top:6px}
  .embudo{margin-bottom:18px;page-break-inside:avoid}
  .embudo h4{color:var(--ink);text-transform:none;letter-spacing:0;font-size:10.5pt;margin-bottom:8px}
  .embudo ol{list-style:none}
  .embudo li{display:grid;grid-template-columns:26px minmax(0,1fr) 90px 70px;align-items:center;gap:10px;padding:4px 0;font-size:9.5pt}
  .embudo .paso{color:var(--ink3);font-size:8.5pt}
  .embudo .cifra{text-align:right;color:var(--ink2);font-size:9pt}
  figure{margin:0 0 12px;page-break-inside:avoid}
  figure blockquote{font-size:12pt;line-height:1.5;color:var(--ink);border-left:2px solid var(--acento);padding-left:14px}
  figcaption{font-size:9pt;color:var(--ink3);padding-left:16px;margin-top:4px}
  .nota{font-size:9.5pt;color:var(--ink2);border-left:2px solid var(--linea);padding-left:12px;margin-top:10px}
  .pie{margin-top:26px;padding-top:10px;border-top:1px solid var(--linea);font-size:8.5pt;color:var(--ink3);display:flex;justify-content:space-between}
  .seccion{margin-bottom:30px}
  @media print{body{background:#fff}.hoja{box-shadow:none;margin:0;width:auto;min-height:0;padding:16mm 14mm;page-break-after:always}.hoja:last-child{page-break-after:auto}}
  `;

  const hoja = (contenido: string, titulo: string) => `<section class="hoja">
    <div class="cab"><span class="marca">${MARCA} forma <span style="color:#8b8b99;font-weight:400">studio</span></span><span class="rotulo">${esc(titulo)}</span></div>
    ${contenido}
    <div class="pie"><span>${esc(study.name)}</span><span>${esc(p.name)} · v${p.version}</span></div>
  </section>`;

  const portada = `<section class="hoja portada">
    <div class="cab"><span class="marca">${MARCA} forma <span style="color:#8b8b99;font-weight:400">studio</span></span><span class="rotulo">Informe de investigación</span></div>
    <div class="centro">
      <span class="rotulo">${esc(p.name)} · versión v${p.version}</span>
      <h1>${esc(study.name)}</h1>
      <p style="font-size:12.5pt;color:var(--ink2);max-width:60ch">${esc(inf.resumen[0] ?? '')}</p>
      <div class="ficha">
        <div><span class="k">Fecha del informe</span><span class="v">${esc(fecha(inf.generado))}</span></div>
        <div><span class="k">Sesiones analizadas</span><span class="v">${m.sesiones}${m.sinteticas ? ` (${m.reales} reales, ${m.sinteticas} sintéticas)` : ''}</span></div>
        <div><span class="k">Tareas evaluadas</span><span class="v">${study.tasks.length}</span></div>
        <div><span class="k">Preparado por</span><span class="v">${esc(autor || 'Equipo de diseño')}</span></div>
      </div>
    </div>
    <div class="pie"><span>Forma Studio</span><span>Documento interno</span></div>
  </section>`;

  const resumen = hoja(
    `<div class="seccion">
      <span class="rotulo">01 · Resumen ejecutivo</span>
      <h2 style="margin-top:8px">Qué encontramos y qué decidir</h2>
      ${m.indice != null ? `<div class="indice">${anillo(m.indice)}<p><strong>Índice Forma ${m.indice}/100</strong>${esc(m.lectura)} El índice combina tasa de éxito (45%), eficiencia frente al camino más corto (25%) y esfuerzo percibido (30%).</p></div>` : ''}
      <ul class="resumen">${inf.resumen
        .slice(1)
        .filter((r) => !(m.indice != null && r.startsWith('Índice Forma')))
        .map((r) => `<li>${esc(r)}</li>`)
        .join('')}</ul>
    </div>
    <div class="seccion">
      <span class="rotulo">02 · Indicadores</span>
      <div class="kpis">
        ${tarjeta(pct(m.exitoPct), 'Tareas logradas', `IC 95%: ${pct(m.ic[0])}–${pct(m.ic[1])}`)}
        ${tarjeta(m.medianaMs != null ? fmtDuration(m.medianaMs) : '—', 'Mediana por tarea', m.p75Ms != null ? `75% termina bajo ${fmtDuration(m.p75Ms)}` : undefined)}
        ${tarjeta(m.dificultad != null ? m.dificultad.toFixed(1).replace('.', ',') : '—', 'Dificultad percibida', 'Escala 1 a 5')}
        ${tarjeta(m.eficiencia != null ? pct(m.eficiencia) : '—', 'Eficiencia de recorrido', 'Camino más corto vs. real')}
        ${tarjeta(m.erroresPorSesion.toFixed(1).replace('.', ','), 'Toques sin acción', 'Por sesión')}
        ${tarjeta(m.dudasPorSesion.toFixed(1).replace('.', ','), 'Dudas detectadas', 'Pausas antes de actuar')}
        ${tarjeta(String(inf.hallazgos.filter((h) => h.severidad === 'critica' || h.severidad === 'alta').length), 'Hallazgos prioritarios', 'Severidad crítica o alta')}
        ${tarjeta(String(m.sesiones), 'Sesiones', m.confianza === 'alta' ? 'Muestra suficiente para priorizar' : 'Muestra exploratoria')}
      </div>
    </div>`,
    'Resumen ejecutivo',
  );

  const hojaHallazgos = hoja(
    `<div class="seccion">
      <span class="rotulo">03 · Hallazgos priorizados</span>
      <h2 style="margin-top:8px">Ordenados por impacto sobre la tarea</h2>
      <p style="color:var(--ink2);max-width:66ch">El impacto combina qué tan grave es el problema para completar la tarea con cuánta gente lo vivió. Cada hallazgo trae su evidencia y la acción concreta que lo resuelve.</p>
    </div>
    ${
      inf.hallazgos.length
        ? inf.hallazgos
            .slice(0, 12)
            .map((h, i) =>
              bloqueHallazgo(
                h,
                i,
                h.citations
                  .map((c) => comentarioDe(c.sessionId, c.taskId))
                  .filter((x): x is string => !!x)
                  .slice(0, 2),
              ),
            )
            .join('')
        : '<p>No se detectaron problemas en las sesiones analizadas.</p>'
    }`,
    'Hallazgos',
  );

  const hojaTareas = hoja(
    `<div class="seccion">
      <span class="rotulo">04 · Desempeño por tarea</span>
      <h2 style="margin-top:8px">Dónde cuesta y cuánto</h2>
      <table>
        <colgroup><col style="width:34%"><col style="width:12%"><col style="width:11%"><col style="width:11%"><col style="width:12%"><col style="width:20%"></colgroup>
        <thead><tr><th>Tarea</th><th class="num">Éxito</th><th class="num">Mediana</th><th class="num">Pasos</th><th class="num">Dificultad</th><th>Se pierde en</th></tr></thead>
        <tbody>${inf.tareas
          .map(
            (t) => `<tr>
              <td>${esc(t.prompt)}</td>
              <td class="num">${pct(t.exitoPct)}<span class="sub">${t.exito} de ${t.personas}</span></td>
              <td class="num">${t.medianaMs != null ? fmtDuration(t.medianaMs) : '—'}</td>
              <td class="num">${t.pasosMediana ?? '—'}${t.pasosOptimos != null ? `<span class="sub">óptimo ${t.pasosOptimos}</span>` : ''}</td>
              <td class="num">${t.dificultad != null ? t.dificultad.toFixed(1).replace('.', ',') : '—'}</td>
              <td>${
                t.corte
                  ? `${esc(t.corte.desde)} → ${esc(t.corte.hacia)}<span class="sub">−${t.corte.perdidos} ${t.corte.perdidos === 1 ? 'persona' : 'personas'}</span>`
                  : t.fuga
                    ? `${esc(t.fuga.nombre)}<span class="sub">${t.fuga.n} ${t.fuga.n === 1 ? 'persona' : 'personas'}</span>`
                    : '—'
              }</td>
            </tr>`,
          )
          .join('')}</tbody>
      </table>
    </div>
    <div class="seccion">
      <h4 style="color:var(--ink);text-transform:none;letter-spacing:0;font-size:11pt">Recorrido del camino más corto</h4>
      ${embudos}
    </div>`,
    'Desempeño por tarea',
  );

  const hojaSegmentos = inf.segmentos.length > 1
    ? hoja(
        `<div class="seccion">
          <span class="rotulo">05 · Comparativa por perfil</span>
          <h2 style="margin-top:8px">El mismo flujo no le sirve igual a todos</h2>
          <table>
            <colgroup><col style="width:30%"><col style="width:13%"><col style="width:13%"><col style="width:14%"><col style="width:14%"><col style="width:16%"></colgroup>
            <thead><tr><th>Perfil o dispositivo</th><th class="num">Sesiones</th><th class="num">Éxito</th><th class="num">Mediana</th><th class="num">Dificultad</th><th class="num">Sin acción</th></tr></thead>
            <tbody>${inf.segmentos
              .map(
                (s) => `<tr>
                  <td>${esc(s.nombre)}</td>
                  <td class="num">${s.n}</td>
                  <td class="num">${pct(s.exitoPct)}</td>
                  <td class="num">${s.medianaMs != null ? fmtDuration(s.medianaMs) : '—'}</td>
                  <td class="num">${s.dificultad != null ? s.dificultad.toFixed(1).replace('.', ',') : '—'}</td>
                  <td class="num">${s.erroresPorPersona.toFixed(1).replace('.', ',')}</td>
                </tr>`,
              )
              .join('')}</tbody>
          </table>
          <p class="nota">La tabla se ordena de menor a mayor tasa de éxito: arriba está el perfil al que el flujo le exige más.</p>
        </div>
        ${verbatims ? `<div class="seccion"><span class="rotulo">06 · En sus palabras</span><h2 style="margin-top:8px">Lo que dijeron</h2>${verbatims}</div>` : ''}`,
        'Perfiles y voces',
      )
    : verbatims
      ? hoja(`<div class="seccion"><span class="rotulo">05 · En sus palabras</span><h2 style="margin-top:8px">Lo que dijeron</h2>${verbatims}</div>`, 'Voces')
      : '';

  const hojaMetodo = hoja(
    `<div class="seccion">
      <span class="rotulo">Método</span>
      <h2 style="margin-top:8px">Cómo se obtuvo esto</h2>
      <p style="color:var(--ink2);max-width:68ch">Cada persona recibió las tareas en orden sobre una copia congelada del prototipo (versión v${p.version}, ${p.screens.length} pantallas). Se registró cada toque, cada pausa antes de actuar, cada toque sin efecto y la ruta completa entre pantallas, además de la dificultad percibida al terminar cada tarea y un comentario abierto.</p>
      <table style="margin-top:14px">
        <colgroup><col style="width:58%"><col style="width:21%"><col style="width:21%"></colgroup>
        <thead><tr><th>Tarea</th><th>Desde</th><th>Objetivo</th></tr></thead>
        <tbody>${study.tasks
          .map((t) => `<tr><td>${esc(t.prompt)}</td><td>${esc(screenName(p, t.startScreenId))}</td><td>${esc(screenName(p, t.successScreenId))}</td></tr>`)
          .join('')}</tbody>
      </table>
    </div>
    <div class="seccion">
      <span class="rotulo">Alcance y limitaciones</span>
      <ul class="resumen" style="margin-top:10px">${inf.limitaciones.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    </div>
    <div class="seccion">
      <span class="rotulo">Anexo · Sesiones</span>
      <table class="anexo" style="margin-top:10px">
        <colgroup><col style="width:17%"><col style="width:15%"><col style="width:22%"><col style="width:13%"><col style="width:12%"><col style="width:11%"><col style="width:10%"></colgroup>
        <thead><tr><th>Participante</th><th>Perfil</th><th>Circunstancia</th><th class="num">Logradas</th><th class="num">Dificultad</th><th>Origen</th><th>Fecha</th></tr></thead>
        <tbody>${filasSesion}</tbody>
      </table>
    </div>`,
    'Método y anexos',
  );

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(study.name)} · Informe Forma Studio</title><style>${css}</style></head>
<body>${portada}${resumen}${hojaHallazgos}${hojaTareas}${hojaSegmentos}${hojaMetodo}</body></html>`;
}

/** Versión en texto para pegar en un correo o un ticket. */
export function informeMarkdown(study: Study, sessions: Session[], events: StudyEvent[]): string {
  const inf = construirInforme(study, sessions, events);
  const m = inf.metricas;
  const p = study.snapshot;
  const l: string[] = [];
  l.push(`# ${study.name}`, '', `Informe de investigación · ${p.name} v${p.version} · ${fecha(inf.generado)}`, '');
  l.push('## Resumen ejecutivo', '');
  for (const r of inf.resumen) l.push(`- ${r}`);
  l.push('', '## Indicadores', '');
  l.push(`| Indicador | Valor |`, `| --- | --- |`);
  l.push(`| Tareas logradas | ${pct(m.exitoPct)} (IC 95%: ${pct(m.ic[0])}–${pct(m.ic[1])}) |`);
  l.push(`| Mediana por tarea | ${m.medianaMs != null ? fmtDuration(m.medianaMs) : '—'} |`);
  l.push(`| Dificultad percibida | ${m.dificultad != null ? m.dificultad.toFixed(1).replace('.', ',') : '—'} de 5 |`);
  l.push(`| Eficiencia de recorrido | ${m.eficiencia != null ? pct(m.eficiencia) : '—'} |`);
  l.push(`| Índice Forma | ${m.indice ?? '—'} de 100 |`);
  l.push('', '## Hallazgos priorizados', '');
  inf.hallazgos.slice(0, 12).forEach((h, i) => {
    l.push(`### ${i + 1}. ${h.titulo}`, '');
    l.push(`**Severidad ${SEVERIDAD_LABEL[h.severidad].toLowerCase()}** · afecta a ${h.afectados} de ${h.total} · impacto ${h.puntaje}/100`, '');
    for (const e of h.evidencia) l.push(`- ${e}`);
    l.push('', `**Qué hacer:** ${h.recomendacion}`, '');
  });
  l.push('## Desempeño por tarea', '');
  l.push('| Tarea | Éxito | Mediana | Pasos (óptimo) | Dificultad | Se pierde en |', '| --- | --- | --- | --- | --- | --- |');
  for (const t of inf.tareas)
    l.push(
      `| ${t.prompt} | ${pct(t.exitoPct)} (${t.exito}/${t.personas}) | ${t.medianaMs != null ? fmtDuration(t.medianaMs) : '—'} | ${t.pasosMediana ?? '—'} (${t.pasosOptimos ?? '—'}) | ${t.dificultad != null ? t.dificultad.toFixed(1).replace('.', ',') : '—'} | ${t.corte ? `${t.corte.desde} → ${t.corte.hacia} (−${t.corte.perdidos})` : '—'} |`,
    );
  if (inf.segmentos.length > 1) {
    l.push('', '## Por perfil', '', '| Perfil | Sesiones | Éxito | Dificultad |', '| --- | --- | --- | --- |');
    for (const s of inf.segmentos) l.push(`| ${s.nombre} | ${s.n} | ${pct(s.exitoPct)} | ${s.dificultad != null ? s.dificultad.toFixed(1).replace('.', ',') : '—'} |`);
  }
  l.push('', '## Alcance y limitaciones', '');
  for (const x of inf.limitaciones) l.push(`- ${x}`);
  return l.join('\n');
}

export { construirInforme };
export const nombreElemento = blockLabel;
