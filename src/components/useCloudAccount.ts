import { useEffect, useState } from 'react';
import { ensureCloudAccount, type CloudAccount } from '../lib/cloud';
import { iniciarSync } from './useSync';

// Cuenta en la nube compartida por toda la app: se crea sola (anónima) y la actualiza guardar el acceso con correo.
let cached: CloudAccount | null | undefined;
let pending: Promise<void> | undefined;
const listeners = new Set<() => void>();

export function setCloudAccountCache(account: CloudAccount | null) {
  cached = account;
  // Con correo guardado, el espacio de trabajo viaja: la sincronización arranca sola.
  if (account?.email) iniciarSync();
  listeners.forEach((l) => l());
}

function load() {
  if (cached || pending) return;
  pending = ensureCloudAccount()
    .then(setCloudAccountCache)
    // Sin conexión: se reintenta la próxima vez que una vista la pida.
    .catch(() => setCloudAccountCache(null))
    .finally(() => {
      pending = undefined;
    });
}

export function useCloudAccount(): { account: CloudAccount | null; loading: boolean } {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { account: cached ?? null, loading: !!pending || cached === undefined };
}
