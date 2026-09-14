import { useEffect, useState } from 'react';
import { cloudAccount, cloudWasConnected, type CloudAccount } from '../lib/cloud';

// Estado compartido de la cuenta en la nube: se consulta una vez y lo actualizan conectar y desconectar.
let cached: CloudAccount | null | undefined;
let pending: Promise<void> | undefined;
const listeners = new Set<() => void>();

export function setCloudAccountCache(account: CloudAccount | null) {
  cached = account;
  listeners.forEach((l) => l());
}

function load() {
  if (cached !== undefined || pending) return;
  if (!cloudWasConnected()) {
    cached = null;
    return;
  }
  pending = cloudAccount()
    .then(setCloudAccountCache)
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
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { account: cached ?? null, loading: cached === undefined };
}
