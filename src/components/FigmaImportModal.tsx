import { useState } from 'react';
import type { Breakpoint, Hotspot, OpInput, Project, Screen } from '../lib/model';
import { applyOps } from '../lib/store';
import { edit } from '../lib/ops';
import { uid } from '../lib/ids';
import { notify } from '../lib/toast';
import { go } from '../lib/router';
import { uploadPrototypeImage } from '../lib/cloud';
import { FigmaError, frameImages, getFigmaToken, listPages, loadPage, parseFigmaUrl, planImportacion, type FigmaFrame, type FigmaPage } from '../lib/figma';
import { Button, Field, Modal } from './ui';

const breakpointFor = (w: number): Breakpoint => (w < 600 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop');

/** Trae un flujo de Figma: cada frame entra como pantalla-imagen con sus zonas tocables. */
export function FigmaImportModal({ open, project, onClose, onDone }: { open: boolean; project: Project; onClose: () => void; onDone: (screenId: string) => void }) {
  const [url, setUrl] = useState('');
  const [fileKey, setFileKey] = useState('');
  const [pages, setPages] = useState<FigmaPage[]>([]);
  const [pageId, setPageId] = useState('');
  const [frames, setFrames] = useState<FigmaFrame[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [startId, setStartId] = useState('');
  const [asStart, setAsStart] = useState(!project.screens.length);
  const [busy, setBusy] = useState('');

  const token = getFigmaToken();
  const chosen = frames.filter((f) => picked[f.id]);

  const close = () => {
    setFrames([]);
    setPages([]);
    setBusy('');
    onClose();
  };

  const fail = (e: unknown) => notify(e instanceof FigmaError ? e.message : 'No pudimos leer ese archivo de Figma.', 'error');

  const openPage = async (key: string, page: string) => {
    setBusy('Leyendo las pantallas…');
    try {
      const { frames: fs, startId: start } = await loadPage(token, key, page);
      setPageId(page);
      setFrames(fs);
      setPicked(Object.fromEntries(fs.map((f) => [f.id, true])));
      setStartId(start ?? fs[0].id);
    } catch (e) {
      setFrames([]);
      fail(e);
    } finally {
      setBusy('');
    }
  };

  const search = async () => {
    const link = parseFigmaUrl(url);
    if (!link) return notify('Pega el enlace de un archivo o prototipo de Figma.', 'error');
    if (!token) return notify('Primero agrega tu token de Figma en Ajustes.', 'error');
    setBusy('Buscando páginas…');
    try {
      const { pages: ps } = await listPages(token, link.fileKey);
      if (!ps.length) throw new FigmaError('Ese archivo de Figma no tiene páginas con contenido.');
      setFileKey(link.fileKey);
      setPages(ps);
      // Si el enlace traía una página o un frame, se abre la página que lo contiene.
      const page = ps.find((p) => p.id === link.nodeId) ?? ps.find((p) => link.nodeId && p.frameIds.includes(link.nodeId)) ?? ps[0];
      await openPage(link.fileKey, page.id);
    } catch (e) {
      fail(e);
      setBusy('');
    }
  };

  const importFrames = async () => {
    if (!chosen.length) return notify('Elige al menos una pantalla.', 'error');
    try {
      setBusy('Pidiendo las imágenes a Figma…');
      const images = await frameImages(token, fileKey, chosen.map((f) => f.id));
      // Un frame ya importado conserva su pantalla: así siguen valiendo los destinos que apuntaban a ella.
      const plan = planImportacion(chosen.map((f) => f.id), project.screens, () => uid('s_'));
      const ids = new Map(Object.entries(plan.idPorFrame));
      const screens: Screen[] = [];
      let linked = 0;
      let done = 0;
      for (const f of chosen) {
        const sid = ids.get(f.id)!;
        setBusy(`Guardando pantallas… ${++done} de ${chosen.length}`);
        const source = images[f.id];
        if (!source) continue;
        let image = source;
        try {
          const blob = await (await fetch(source)).blob();
          image = await uploadPrototypeImage(project.id, `${sid}.png`, blob);
        } catch {
          // Sin copia propia queda la imagen de Figma, que vence a los 30 días.
          linked++;
        }
        const hotspots: Hotspot[] = f.hotspots.map((h) => ({
          id: uid('h_'),
          x: h.x,
          y: h.y,
          w: h.w,
          h: h.h,
          label: h.name,
          ...(h.back ? { back: true } : {}),
          ...(h.destination && ids.has(h.destination) ? { target: ids.get(h.destination) } : {}),
        }));
        screens.push({ id: sid, name: f.name, breakpoint: breakpointFor(f.width), image: { url: image, width: f.width, height: f.height }, hotspots, figmaId: f.id, blocks: [] });
      }
      if (!screens.length) throw new FigmaError('Figma no entregó imágenes de esas pantallas.');

      const first = ids.get(startId) ?? screens[0].id;
      const ops: OpInput[] = [];
      let nuevas = 0;
      let actualizadas = 0;
      for (const s of screens) {
        if (project.screens.some((x) => x.id === s.id)) {
          // Ya existía: se cambia lo que viene de Figma y se respeta su nombre y su lugar en el flujo.
          ops.push(edit.screen(project, s.id, 'image', s.image), edit.screen(project, s.id, 'hotspots', s.hotspots), edit.screen(project, s.id, 'figmaId', s.figmaId));
          actualizadas++;
        } else {
          ops.push(edit.addScreen(project, s, project.screens.length + nuevas++));
        }
      }
      if (asStart) ops.push(edit.project('startScreenId', first));
      setBusy('');
      const resumen = [nuevas ? `${nuevas} ${nuevas === 1 ? 'pantalla nueva' : 'pantallas nuevas'}` : '', actualizadas ? `${actualizadas} ${actualizadas === 1 ? 'actualizada' : 'actualizadas'}` : ''].filter(Boolean).join(' y ');
      if (!applyOps(project.id, ops, `Importar desde Figma: ${resumen}`)) return;
      notify(`Desde Figma: ${resumen}.`, 'success');
      if (linked) notify(`${linked} ${linked === 1 ? 'imagen quedó enlazada' : 'imágenes quedaron enlazadas'} a Figma y vencen en 30 días. Conecta la nube para guardarlas en Forma.`, 'info');
      onDone(first);
      close();
    } catch (e) {
      setBusy('');
      fail(e);
    }
  };

  return (
    <Modal
      open={open}
      wide
      title="Importar desde Figma"
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancelar</Button>
          {frames.length > 0 ? (
            <Button tone="primary" disabled={!!busy || !chosen.length} onClick={() => void importFrames()}>
              {busy || `Importar ${chosen.length} ${chosen.length === 1 ? 'pantalla' : 'pantallas'}`}
            </Button>
          ) : (
            <Button tone="primary" disabled={!!busy || !url.trim()} onClick={() => void search()}>
              {busy || 'Buscar pantallas'}
            </Button>
          )}
        </>
      }
    >
      <div className="stack">
        {!token && (
          <p className="warn-text">
            Falta tu token de Figma.{' '}
            <button type="button" className="link-btn" onClick={() => go('/settings')}>
              Agrégalo en Ajustes
            </button>{' '}
            y vuelve a intentarlo.
          </p>
        )}
        <Field label="Enlace de Figma" hint="Sirve el del archivo o el del prototipo. Tu token debe poder ver ese archivo.">
          <input className="input" value={url} placeholder="https://www.figma.com/design/…" onChange={(e) => setUrl(e.target.value)} />
        </Field>

        {pages.length > 1 && frames.length > 0 && (
          <Field label="Página">
            <select value={pageId} onChange={(e) => void openPage(fileKey, e.target.value)}>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {frames.length > 0 && (
          <>
            <div className="row">
              <span className="muted small">
                {frames.length} {frames.length === 1 ? 'pantalla encontrada' : 'pantallas encontradas'}. Las flechas de tu prototipo llegan como zonas tocables.
              </span>
              <Button size="sm" onClick={() => setPicked(Object.fromEntries(frames.map((f) => [f.id, chosen.length !== frames.length])))}>
                {chosen.length === frames.length ? 'Quitar todas' : 'Elegir todas'}
              </Button>
            </div>
            <ul className="figma-frames">
              {frames.map((f) => (
                <li key={f.id}>
                  <label className="check">
                    <input type="checkbox" checked={!!picked[f.id]} onChange={(e) => setPicked((p) => ({ ...p, [f.id]: e.target.checked }))} />
                    <span>
                      <strong>{f.name}</strong>
                      <span className="muted small">
                        {f.width} × {f.height} · {f.hotspots.length} {f.hotspots.length === 1 ? 'zona tocable' : 'zonas tocables'}
                        {project.screens.some((s) => s.figmaId === f.id) ? ' · ya importada, se actualiza' : ''}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <Field label="Pantalla de inicio del flujo">
              <select value={startId} onChange={(e) => setStartId(e.target.value)}>
                {chosen.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <label className="check">
              <input type="checkbox" checked={asStart} onChange={(e) => setAsStart(e.target.checked)} />
              <span>Usar esa pantalla como inicio del proyecto</span>
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}
