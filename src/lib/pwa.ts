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

// ---------- Pantalla completa durante la prueba ----------

type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void; webkitFullscreenEnabled?: boolean };

/**
 * Cómo ocultar el navegador durante la prueba.
 * fullscreen: el navegador lo permite · ios: iPhone solo lo logra agregando la prueba a la pantalla de inicio ·
 * in-app: WhatsApp, Instagram y similares no lo permiten (hay que abrir el enlace en el navegador) · none: ya no hay barra.
 */
export type ImmersiveMode = 'fullscreen' | 'ios' | 'in-app' | 'none';

export function immersiveMode(ua: string, standalone: boolean, fullscreenSupported: boolean): ImmersiveMode {
  if (standalone) return 'none';
  const ios = /iphone|ipad|ipod/i.test(ua);
  const android = /android/i.test(ua);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|Snapchat|TikTok|MicroMessenger|; wv\)/i.test(ua);
  if ((ios || android) && inApp) return 'in-app';
  if (fullscreenSupported) return 'fullscreen';
  if (ios) return 'ios';
  return 'none';
}

const fullscreenSupported = () => {
  if (typeof document === 'undefined') return false;
  const d = document as FsDocument;
  const el = document.documentElement as FsElement;
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled) && !!(el.requestFullscreen || el.webkitRequestFullscreen);
};

export function useImmersiveMode(): ImmersiveMode {
  if (typeof navigator === 'undefined') return 'none';
  // iPadOS se presenta como Mac: se reconoce por la pantalla táctil.
  const ua = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1 ? `${navigator.userAgent} iPad` : navigator.userAgent;
  return immersiveMode(ua, isStandalone(), fullscreenSupported());
}

const fullscreenElement = () => (typeof document === 'undefined' ? null : document.fullscreenElement ?? (document as FsDocument).webkitFullscreenElement ?? null);

export async function enterFullscreen(): Promise<boolean> {
  const el = document.documentElement as FsElement;
  try {
    if (el.requestFullscreen) {
      // Algunos navegadores dejan el pedido sin respuesta: tras 2 s se considera rechazado para avisar a la persona.
      const answered = await Promise.race([el.requestFullscreen({ navigationUI: 'hide' }).then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 2000))]);
      return answered || !!fullscreenElement();
    }
    if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function exitFullscreen() {
  if (!fullscreenElement()) return;
  const d = document as FsDocument;
  if (d.exitFullscreen) void d.exitFullscreen().catch(() => undefined);
  else d.webkitExitFullscreen?.();
}

export function useIsFullscreen() {
  return useSyncExternalStore(
    (l) => {
      document.addEventListener('fullscreenchange', l);
      document.addEventListener('webkitfullscreenchange', l);
      return () => {
        document.removeEventListener('fullscreenchange', l);
        document.removeEventListener('webkitfullscreenchange', l);
      };
    },
    () => !!fullscreenElement(),
    () => false,
  );
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
