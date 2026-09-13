import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Dibuja el contenido a su ancho real (el de un teléfono) y lo escala para que quepa en su espacio. */
export function FitPreview({ width = 343, maxScale = 1, children, className = '' }: { width?: number; maxScale?: number; children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      setScale(Math.max(0.2, Math.min(maxScale, o.clientWidth / width)));
      setHeight(i.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [width, maxScale]);

  const fits = scale >= maxScale;
  return (
    <div ref={outer} className={`fit-preview ${className}`} style={{ height: height ? height * scale : undefined }}>
      <div
        ref={inner}
        style={{
          width,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          marginLeft: fits ? `calc((100% - ${width * scale}px) / 2)` : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
