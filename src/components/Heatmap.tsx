import { useLayoutEffect, useRef, useState } from 'react';
import type { Mode, Project, Screen, StudyEvent } from '../lib/model';
import { ScreenCanvas } from './ScreenCanvas';

/** Mapa de calor sobre la pantalla real: los toques se ubican relativos al bloque tocado. */
export function Heatmap({ project, screen, events, mode }: { project: Project; screen: Screen; events: StudyEvent[]; mode: Mode }) {
  return <ScreenCanvas project={project} screen={screen} mode={mode} overlay={<HeatLayer events={events} />} />;
}

function HeatLayer({ events }: { events: StudyEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<{ x: number; y: number; kind: string }[]>([]);

  useLayoutEffect(() => {
    const screenEl = ref.current?.parentElement;
    if (!screenEl) return;
    const compute = () => {
      const W = screenEl.offsetWidth;
      const H = screenEl.offsetHeight;
      setPoints(
        events.map((e) => {
          // El toque puede ser sobre un bloque o sobre una zona de una pantalla-imagen.
          const el = e.block ? screenEl.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(e.block)}"], [data-hotspot-id="${CSS.escape(e.block)}"]`) : null;
          if (el && e.bx != null && e.by != null) return { x: el.offsetLeft + e.bx * el.offsetWidth, y: el.offsetTop + e.by * el.offsetHeight, kind: e.kind };
          return { x: e.x * W, y: e.y * H, kind: e.kind };
        }),
      );
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(screenEl);
    return () => ro.disconnect();
  }, [events]);

  return (
    <div ref={ref} className="heat-layer" aria-hidden="true">
      {points.map((p, i) => (
        <span key={i} className={`heat-dot heat-${p.kind}`} style={{ left: p.x, top: p.y }} />
      ))}
    </div>
  );
}
