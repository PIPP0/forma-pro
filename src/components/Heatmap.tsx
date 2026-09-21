import { useLayoutEffect, useRef } from 'react';
import type { Mode, Project, Screen, StudyEvent } from '../lib/model';
import { ScreenCanvas } from './ScreenCanvas';

/** Mapa de calor sobre la pantalla real: los toques se ubican relativos al bloque tocado. */
export function Heatmap({ project, screen, events, mode }: { project: Project; screen: Screen; events: StudyEvent[]; mode: Mode }) {
  return <ScreenCanvas project={project} screen={screen} mode={mode} overlay={<HeatLayer events={events} />} />;
}

/** Del frío al caliente: azul donde hubo pocos toques, rojo donde se concentraron. */
const RAMPA: [number, number, number, number][] = [
  [0, 56, 118, 240],
  [0.25, 44, 190, 214],
  [0.45, 58, 200, 118],
  [0.65, 244, 212, 58],
  [0.82, 242, 142, 46],
  [1, 230, 56, 44],
];

function color(t: number): [number, number, number] {
  for (let i = 1; i < RAMPA.length; i++) {
    const [p1, r1, g1, b1] = RAMPA[i - 1];
    const [p2, r2, g2, b2] = RAMPA[i];
    if (t <= p2) {
      const k = p2 === p1 ? 0 : (t - p1) / (p2 - p1);
      return [Math.round(r1 + (r2 - r1) * k), Math.round(g1 + (g2 - g1) * k), Math.round(b1 + (b2 - b1) * k)];
    }
  }
  const [, r, g, b] = RAMPA[RAMPA.length - 1];
  return [r, g, b];
}

function HeatLayer({ events }: { events: StudyEvent[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    const screenEl = canvas?.parentElement;
    if (!canvas || !screenEl) return;

    const dibujar = () => {
      const W = screenEl.offsetWidth;
      const H = screenEl.offsetHeight;
      if (!W || !H) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!events.length) return;

      // Cada toque suma una mancha suave; donde se superponen, el valor crece.
      const radio = Math.max(30, Math.round(Math.min(W, H) * 0.13));
      for (const e of events) {
        const el = e.block ? screenEl.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(e.block)}"], [data-hotspot-id="${CSS.escape(e.block)}"]`) : null;
        const x = el && e.bx != null ? el.offsetLeft + e.bx * el.offsetWidth : e.x * W;
        const y = el && e.by != null ? el.offsetTop + e.by * el.offsetHeight : e.y * H;
        const g = ctx.createRadialGradient(x, y, 0, x, y, radio);
        g.addColorStop(0, 'rgba(0,0,0,0.34)');
        g.addColorStop(0.5, 'rgba(0,0,0,0.13)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, radio, 0, Math.PI * 2);
        ctx.fill();
      }

      // La densidad acumulada se traduce a color, en relación con el punto más caliente.
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = img.data;
      let pico = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > pico) pico = d[i];
      if (!pico) return;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (!a) continue;
        // Con gamma, la zona templada se ve sin tener que acumular decenas de toques.
        const t = Math.min(1, Math.pow(a / pico, 0.7));
        if (t < 0.05) {
          d[i + 3] = 0;
          continue;
        }
        const [r, g, b] = color(t);
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = Math.round(Math.min(1, 0.3 + t * 0.85) * 205);
      }
      ctx.putImageData(img, 0, 0);
    };

    dibujar();
    const ro = new ResizeObserver(dibujar);
    ro.observe(screenEl);
    // Las imágenes de Figma tardan en cargar y cambian el alto del contenedor.
    const imgs = [...screenEl.querySelectorAll('img')];
    imgs.forEach((i) => i.addEventListener('load', dibujar));
    return () => {
      ro.disconnect();
      imgs.forEach((i) => i.removeEventListener('load', dibujar));
    };
  }, [events]);

  return <canvas ref={ref} className="heat-layer" aria-hidden="true" />;
}
