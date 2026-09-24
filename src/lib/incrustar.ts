// Imágenes dentro del proyecto, no como enlaces aparte.
//
// Una pantalla importada guarda la URL de su imagen en la nube. Eso es lo liviano y lo normal,
// pero depende de que el navegador pueda pedirla: hay equipos con bloqueadores o redes que
// filtran ese dominio y dejan el marco vacío. Al incrustarlas, la imagen viaja dentro del JSON
// del proyecto y llega a cualquier parte donde llegue el proyecto.
import type { OpInput, Project, Screen } from './model';
import { edit } from './ops';

export interface ResumenIncrustado {
  ops: OpInput[];
  /** Cuántas pantallas quedaron con su imagen dentro. */
  listas: number;
  /** Cuántas no se pudieron traer: sin ellas, incrustar no arregla nada. */
  fallidas: number;
  /** Peso final aproximado del proyecto, en bytes. */
  peso: number;
}

const yaIncrustada = (s: Screen) => !!s.image?.data;

/** Pantallas cuya imagen todavía se pide por separado. */
export const conImagenExterna = (p: Project) => p.screens.filter((s) => s.image && !yaIncrustada(s));

async function aDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise<string | null>((listo) => {
      const lector = new FileReader();
      lector.onload = () => listo(typeof lector.result === 'string' ? lector.result : null);
      lector.onerror = () => listo(null);
      lector.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Trae cada imagen y la deja dentro de su pantalla. Se ejecuta desde un equipo donde las
 * imágenes sí cargan: desde uno bloqueado no habría nada que traer.
 */
export async function incrustarImagenes(p: Project, avance?: (hechas: number, total: number) => void): Promise<ResumenIncrustado> {
  const pendientes = conImagenExterna(p);
  const ops: OpInput[] = [];
  let listas = 0;
  let fallidas = 0;
  let peso = JSON.stringify(p).length;

  for (const s of pendientes) {
    const data = await aDataUrl(s.image!.url);
    if (!data) {
      fallidas++;
    } else {
      ops.push(edit.screen(p, s.id, 'image', { ...s.image!, data }));
      listas++;
      peso += data.length;
    }
    avance?.(listas + fallidas, pendientes.length);
  }
  return { ops, listas, fallidas, peso };
}
