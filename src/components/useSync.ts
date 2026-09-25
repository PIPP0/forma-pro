import { useEffect, useState } from 'react';
import { getDb, subscribe } from '../lib/store';
import { escucharBorrados, sincronizarEspacio, type ResumenSync } from '../lib/sync';
import { notify } from '../lib/toast';

// Mantiene este navegador al día con el espacio en la nube, sin que nadie tenga que pedirlo.
// Se sincroniza al abrir, al volver a la pestaña, después de trabajar y cada tanto.

export interface EstadoSync {
  activo: boolean;
  sincronizando: boolean;
  ultima?: number;
  error?: string;
}

let estado: EstadoSync = { activo: false, sincronizando: false };
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((l) => l());
const set = (parche: Partial<EstadoSync>) => {
  estado = { ...estado, ...parche };
  avisar();
};

let enCurso: Promise<ResumenSync> | undefined;
let pendiente: ReturnType<typeof setTimeout> | undefined;
let arrancado = false;

// 20 s de margen: bastante para una conexión lenta, y suficiente para no dejar a nadie mirando
// «Sincronizando…» para siempre si algo se cuelga (una cuenta de nube que no termina de
// resolverse, por ejemplo). Sin este límite, un cuelgue ahí dejaba `enCurso` puesto para
// siempre, así que ni el botón «Sincronizar ahora» ni los reintentos automáticos volvían a
// intentarlo — el espacio dejaba de subir nada y nadie se enteraba.
const TIEMPO_LIMITE_MS = 20_000;
const fallo = (mensaje: string): ResumenSync => ({ subidos: 0, bajados: 0, borrados: 0, conflictos: [], error: mensaje });

function conLimite(promesa: Promise<ResumenSync>): Promise<ResumenSync> {
  const limite = new Promise<ResumenSync>((resolve) => {
    setTimeout(() => resolve(fallo('La sincronización está tardando demasiado. Revisa tu conexión e inténtalo de nuevo.')), TIEMPO_LIMITE_MS);
  });
  return Promise.race([promesa, limite]).catch(() => fallo('No pudimos sincronizar. Lo intentamos de nuevo en un rato.'));
}

/** Una sincronización a la vez: si ya hay una corriendo, se espera esa. */
export function sincronizarAhora(manual = false): Promise<ResumenSync> {
  if (enCurso) return enCurso;
  set({ sincronizando: true, error: undefined });
  enCurso = conLimite(sincronizarEspacio())
    .then((r) => {
      set({ sincronizando: false, ultima: Date.now(), error: r.error, activo: true });
      if (manual) {
        const partes = [r.bajados && `${r.bajados} ${r.bajados === 1 ? 'traído' : 'traídos'}`, r.subidos && `${r.subidos} ${r.subidos === 1 ? 'subido' : 'subidos'}`].filter(Boolean);
        notify(r.error ?? (partes.length ? `Espacio al día: ${partes.join(' y ')}.` : 'Tu espacio ya estaba al día.'), r.error ? 'error' : 'success');
      }
      return r;
    })
    .finally(() => {
      enCurso = undefined;
    });
  return enCurso;
}

/** Arranca la sincronización automática. Se llama una vez, cuando hay cuenta con correo. */
export function iniciarSync() {
  if (arrancado || typeof window === 'undefined') return;
  arrancado = true;
  set({ activo: true });
  escucharBorrados();
  void sincronizarAhora();

  // Después de trabajar un rato, sube lo hecho sin interrumpir. Y si cambia la persona que está
  // usando la app —al arrancar, la sesión local se decide un instante después—, se sincroniza ya:
  // de eso depende quién tiene acceso a lo que baja.
  let ultimoUsuario = getDb().currentUserId;
  subscribe(() => {
    const ahora = getDb().currentUserId;
    if (ahora !== ultimoUsuario) {
      ultimoUsuario = ahora;
      void sincronizarAhora();
      return;
    }
    clearTimeout(pendiente);
    pendiente = setTimeout(() => void sincronizarAhora(), 8000);
  });

  // Al volver a la pestaña: puede haber cambiado algo en el otro computador.
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - (estado.ultima ?? 0) > 60_000) void sincronizarAhora();
  });

  window.setInterval(() => {
    if (document.visibilityState === 'visible') void sincronizarAhora();
  }, 180_000);

  // Lo último que se hace antes de cerrar: dejar todo arriba.
  window.addEventListener('pagehide', () => void sincronizarAhora());
}

export function useEstadoSync(): EstadoSync {
  const [, forzar] = useState(0);
  useEffect(() => {
    const l = () => forzar((n) => n + 1);
    oyentes.add(l);
    return () => {
      oyentes.delete(l);
    };
  }, []);
  return estado;
}
