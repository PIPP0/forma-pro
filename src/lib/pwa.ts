import { useSyncExternalStore } from 'react';

// Instalación como app en el celular (PWA) y apertura directa del último prototipo.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export const LAST_STUDY_KEY = 'formapro.lastStudyLink';

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

export const canInstall = () => !!deferred;

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const ev = deferred;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  deferred = null;
  emit();
  return outcome === 'accepted';
}

export function useInstallable() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    canInstall,
    () => false,
  );
}

export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // En desarrollo local el service worker interfiere con la recarga en caliente.
  if (['localhost', '127.0.0.1'].includes(location.hostname)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

export function rememberStudyLink() {
  try {
    localStorage.setItem(LAST_STUDY_KEY, location.hash);
  } catch {
    /* sin almacenamiento */
  }
}

/** Si la app se abre instalada y sin ruta, vuelve al último prototipo visitado. */
export function restoreInstalledStudy() {
  if (!isStandalone() || (location.hash && location.hash !== '#/')) return;
  try {
    const last = localStorage.getItem(LAST_STUDY_KEY);
    if (last?.startsWith('#/t/')) location.hash = last;
  } catch {
    /* sin almacenamiento */
  }
}
