// Sonido y vibración de un prototipo: lo que hace que una confirmación se sienta confirmada.
//
// Los sonidos se sintetizan aquí mismo con Web Audio: no hay archivos que subir, que pesar
// ni que cargar desde la nube. Cada uno es una pequeña partitura de tonos con su envolvente.
//
// La vibración usa navigator.vibrate, que existe en Android y no en iPhone: Safari no la
// expone. En iPhone el prototipo suena pero no vibra, y eso se dice donde se elige.

export type SonidoId = 'toque' | 'exito' | 'error' | 'aviso' | 'transicion' | 'envio' | 'recibo' | 'teclado';
export type VibracionId = 'corta' | 'doble' | 'larga' | 'exito' | 'error';

interface Nota {
  /** Frecuencia en hercios. */
  hz: number;
  /** Cuándo empieza, en segundos desde el disparo. */
  en: number;
  /** Cuánto dura, en segundos. */
  dura: number;
  /** Volumen relativo, de 0 a 1. */
  vol?: number;
  tipo?: OscillatorType;
}

export const SONIDOS: { id: SonidoId; nombre: string; descripcion: string; notas: Nota[] }[] = [
  { id: 'toque', nombre: 'Toque', descripcion: 'Un clic seco, para botones y selecciones.', notas: [{ hz: 880, en: 0, dura: 0.04, vol: 0.28, tipo: 'triangle' }] },
  {
    id: 'exito',
    nombre: 'Éxito',
    descripcion: 'Dos notas que suben: transferencia hecha, meta creada.',
    notas: [
      { hz: 660, en: 0, dura: 0.1, vol: 0.3 },
      { hz: 990, en: 0.09, dura: 0.18, vol: 0.32 },
    ],
  },
  {
    id: 'error',
    nombre: 'Error',
    descripcion: 'Dos notas que bajan: algo no se pudo hacer.',
    notas: [
      { hz: 320, en: 0, dura: 0.12, vol: 0.3, tipo: 'square' },
      { hz: 220, en: 0.11, dura: 0.2, vol: 0.26, tipo: 'square' },
    ],
  },
  { id: 'aviso', nombre: 'Aviso', descripcion: 'Una campanita breve para llamar la atención.', notas: [{ hz: 1320, en: 0, dura: 0.12, vol: 0.22 }, { hz: 1760, en: 0.06, dura: 0.14, vol: 0.18 }] },
  { id: 'transicion', nombre: 'Transición', descripcion: 'Un barrido suave al cambiar de pantalla.', notas: [{ hz: 520, en: 0, dura: 0.16, vol: 0.16, tipo: 'sine' }, { hz: 700, en: 0.05, dura: 0.16, vol: 0.12 }] },
  {
    id: 'envio',
    nombre: 'Envío',
    descripcion: 'Algo sale: pago enviado, mensaje despachado.',
    notas: [
      { hz: 440, en: 0, dura: 0.07, vol: 0.24 },
      { hz: 740, en: 0.06, dura: 0.09, vol: 0.24 },
      { hz: 1180, en: 0.13, dura: 0.14, vol: 0.2 },
    ],
  },
  {
    id: 'recibo',
    nombre: 'Abono',
    descripcion: 'Algo llega: dinero recibido, comprobante listo.',
    notas: [
      { hz: 1180, en: 0, dura: 0.08, vol: 0.2 },
      { hz: 880, en: 0.07, dura: 0.1, vol: 0.24 },
      { hz: 660, en: 0.15, dura: 0.2, vol: 0.26 },
    ],
  },
  { id: 'teclado', nombre: 'Tecla', descripcion: 'El golpe corto de escribir un monto o una clave.', notas: [{ hz: 1500, en: 0, dura: 0.02, vol: 0.14, tipo: 'square' }] },
];

export const VIBRACIONES: { id: VibracionId; nombre: string; descripcion: string; patron: number[] }[] = [
  { id: 'corta', nombre: 'Toque', descripcion: 'Un golpe seco, como al pulsar.', patron: [12] },
  { id: 'doble', nombre: 'Doble', descripcion: 'Dos golpes: algo cambió de estado.', patron: [14, 60, 14] },
  { id: 'larga', nombre: 'Larga', descripcion: 'Una vibración sostenida, para lo importante.', patron: [140] },
  { id: 'exito', nombre: 'Éxito', descripcion: 'Corta y luego larga: operación completada.', patron: [18, 50, 90] },
  { id: 'error', nombre: 'Error', descripcion: 'Tres golpes iguales: algo salió mal.', patron: [60, 70, 60, 70, 60] },
];

/** Sonido y vibración de una pantalla o de una zona tocable. */
export interface Feedback {
  sonido?: SonidoId;
  vibracion?: VibracionId;
}

let ctx: AudioContext | null = null;
let silenciado = false;

/** ¿Este navegador puede vibrar? Android sí; iPhone no lo permite desde la web. */
export const vibracionDisponible = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export const silenciar = (v: boolean) => {
  silenciado = v;
  if (v && ctx) void ctx.suspend().catch(() => undefined);
};
export const estaSilenciado = () => silenciado;

/**
 * El audio de un navegador solo arranca tras un gesto de la persona. Se llama al primer
 * toque de la prueba para que el primer sonido no llegue tarde ni se pierda.
 */
export function prepararSonido() {
  if (silenciado || typeof window === 'undefined') return;
  try {
    ctx ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  } catch {
    ctx = null;
  }
}

export function reproducir(id?: SonidoId) {
  if (!id || silenciado) return;
  const receta = SONIDOS.find((s) => s.id === id);
  if (!receta) return;
  prepararSonido();
  if (!ctx || ctx.state !== 'running') return;
  const ahora = ctx.currentTime;
  for (const n of receta.notas) {
    const osc = ctx.createOscillator();
    const gan = ctx.createGain();
    osc.type = n.tipo ?? 'sine';
    osc.frequency.setValueAtTime(n.hz, ahora + n.en);
    // Ataque corto y caída suave: sin esto, cada nota suena como un chasquido.
    const vol = n.vol ?? 0.25;
    gan.gain.setValueAtTime(0.0001, ahora + n.en);
    gan.gain.exponentialRampToValueAtTime(vol, ahora + n.en + 0.012);
    gan.gain.exponentialRampToValueAtTime(0.0001, ahora + n.en + n.dura);
    osc.connect(gan).connect(ctx.destination);
    osc.start(ahora + n.en);
    osc.stop(ahora + n.en + n.dura + 0.02);
  }
}

export function vibrar(id?: VibracionId) {
  if (!id || silenciado || !vibracionDisponible()) return;
  const v = VIBRACIONES.find((x) => x.id === id);
  if (v) navigator.vibrate(v.patron);
}

/** Lo que ocurre al llegar a una pantalla o al tocar una zona. */
export function emitir(f?: { sonido?: string; vibracion?: string }) {
  if (!f) return;
  reproducir(f.sonido as SonidoId | undefined);
  vibrar(f.vibracion as VibracionId | undefined);
}

export const nombreSonido = (id?: SonidoId) => SONIDOS.find((s) => s.id === id)?.nombre ?? 'Sin sonido';
export const nombreVibracion = (id?: VibracionId) => VIBRACIONES.find((v) => v.id === id)?.nombre ?? 'Sin vibración';
