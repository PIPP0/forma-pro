// Personas sintéticas: seis perfiles de banca y el motor que recorre un prototipo con ellos.
// No sustituyen a una persona real; sirven para detectar tropiezos antes de convocar gente.
import type { Breakpoint, Project, Screen, Session, StudyEvent, SyntheticUser, Study, TaskFeedback } from './model';
import { baseId } from './model';
import { navGraph } from './flowCheck';
import { mulberry32, uid } from './ids';

/** Los seis segmentos de banca con los que nace el espacio de trabajo. */
export function personasBase(): SyntheticUser[] {
  const now = Date.now();
  const p = (u: Omit<SyntheticUser, 'builtIn' | 'createdAt'>): SyntheticUser => ({ ...u, builtIn: true, createdAt: now });
  return [
    p({
      id: 'sy_universitario',
      name: 'David Cáceres',
      age: 21,
      segment: 'Universitario',
      role: 'Estudiante de Ingeniería Comercial',
      city: 'Santiago',
      bio: 'Vive con sus padres y se financia con una beca y trabajos esporádicos. Todo lo resuelve en el celular, entre clases, con poca batería y a una mano.',
      quote: 'Si me pide más de dos pasos, lo dejo y lo hago después. Casi siempre no lo hago después.',
      goals: ['Transferir su parte de los gastos compartidos', 'Ver cuánto le queda antes del fin de mes', 'Activar la tarjeta sin llamar a nadie'],
      frustrations: ['Formularios largos', 'Claves que no recuerda', 'Que la app lo devuelva al inicio'],
      device: 'mobile',
      traits: { digital: 5, paciencia: 2, lectura: 1, cautela: 2, prisa: 5 },
    }),
    p({
      id: 'sy_masivo',
      name: 'Carolina Muñoz',
      age: 34,
      segment: 'Masivo',
      role: 'Técnica en enfermería',
      city: 'Maipú',
      bio: 'Sueldo mensual, presupuesto ajustado y turnos rotativos. Entra a la app varias veces al día para confirmar que el saldo alcanza antes de comprar.',
      quote: 'Reviso el saldo, pago la cuenta y salgo. Si algo se ve raro, mejor lo dejo para después.',
      goals: ['Pagar cuentas antes del vencimiento', 'Confirmar que llegó el sueldo', 'Evitar comisiones'],
      frustrations: ['No encontrar el comprobante', 'Saldos que no cuadran', 'Publicidad donde espera un botón'],
      device: 'mobile',
      traits: { digital: 3, paciencia: 3, lectura: 3, cautela: 4, prisa: 3 },
    }),
    p({
      id: 'sy_preferencial',
      name: 'Rodrigo Pizarro',
      age: 43,
      segment: 'Preferencial',
      role: 'Jefe de operaciones logísticas',
      city: 'Ñuñoa',
      bio: 'Tiene crédito hipotecario, dos tarjetas y un fondo mutuo. Compara condiciones antes de decidir y guarda capturas de todo lo que contrata.',
      quote: 'Antes de apretar quiero ver la tasa, el plazo y el costo total. Si no está, no firmo.',
      goals: ['Simular un crédito y comparar cuotas', 'Mover dinero entre sus productos', 'Revisar el detalle de cada cobro'],
      frustrations: ['Cifras sin explicación', 'Tener que llamar para algo simple', 'Que el detalle esté escondido'],
      device: 'mobile',
      traits: { digital: 4, paciencia: 4, lectura: 5, cautela: 4, prisa: 2 },
    }),
    p({
      id: 'sy_premium',
      name: 'Isidora Vergara',
      age: 51,
      segment: 'Premium',
      role: 'Gerenta comercial',
      city: 'Vitacura',
      bio: 'Patrimonio alto y agenda saturada. Delega lo operativo en su ejecutiva y usa la app entre reuniones, casi siempre para autorizar algo puntual.',
      quote: 'No tengo tiempo de aprender dónde está cada cosa. O está a la vista, o llamo a mi ejecutiva.',
      goals: ['Autorizar transferencias grandes sin fricción', 'Ver el patrimonio consolidado', 'Contactar a su ejecutiva en un toque'],
      frustrations: ['Pasos de seguridad repetidos', 'Menús con demasiadas opciones', 'Esperar la carga de pantallas'],
      device: 'mobile',
      traits: { digital: 4, paciencia: 1, lectura: 2, cautela: 3, prisa: 5 },
    }),
    p({
      id: 'sy_mayor',
      name: 'Óscar Jiménez',
      age: 72,
      segment: 'Adulto mayor',
      role: 'Jubilado, ex maestro de obra',
      city: 'Valparaíso',
      bio: 'Recibe su pensión el día 3 y transfiere a sus hijos y nietos. Aprendió a usar la app con ayuda de su hija y sigue los pasos siempre en el mismo orden.',
      quote: 'Leo todo dos veces. Si me equivoco con la plata, no sé a quién reclamarle.',
      goals: ['Transferir a un destinatario ya guardado', 'Confirmar que la pensión llegó', 'Guardar el comprobante'],
      frustrations: ['Letra chica', 'Pantallas que cambian de lugar los botones', 'Perder el paso y tener que empezar de nuevo'],
      device: 'mobile',
      traits: { digital: 1, paciencia: 5, lectura: 5, cautela: 5, prisa: 1 },
    }),
    p({
      id: 'sy_familiar',
      name: 'Paulina Soto',
      age: 38,
      segment: 'Familiar',
      role: 'Contadora, dos hijos en edad escolar',
      city: 'La Florida',
      bio: 'Administra el presupuesto del hogar con su pareja. Usa la app en ratos cortos e interrumpidos: mientras cocina, en la fila del colegio, antes de dormir.',
      quote: 'Empiezo algo, me interrumpen y vuelvo veinte minutos después. Necesito retomar donde iba.',
      goals: ['Repartir el sueldo entre gastos y ahorro', 'Pagar el colegio y la luz de una vez', 'Ver en qué se fue el mes'],
      frustrations: ['Perder lo escrito al salir', 'No distinguir las cuentas entre sí', 'Tener que repetir datos que el banco ya tiene'],
      device: 'mobile',
      traits: { digital: 3, paciencia: 3, lectura: 3, cautela: 3, prisa: 4 },
    }),
  ];
}

export interface SalidaSimulacion {
  session: Session;
  events: StudyEvent[];
}

interface Salida {
  /** Id de la pantalla destino. */
  destino: string;
  /** Bloque o zona que hay que tocar. */
  elemento?: string;
  /** Texto visible, para las citas. */
  etiqueta: string;
  /** Posición relativa dentro de la pantalla (0 a 1). */
  x: number;
  y: number;
}

/** Salidas de una pantalla: bloques con acción y zonas tocables de una pantalla-imagen. */
export function salidasDe(p: Project, s: Screen): Salida[] {
  const existe = new Set(p.screens.map((x) => x.id));
  const out: Salida[] = [];
  const alto = Math.max(1, s.blocks.length);
  s.blocks.forEach((b, i) => {
    const y = (i + 0.5) / alto;
    if (b.action === 'navigate' && b.target && existe.has(b.target)) out.push({ destino: b.target, elemento: b.id, etiqueta: b.label || 'un botón', x: 0.5, y });
    for (const [opcion, destino] of Object.entries(b.optionTargets ?? {})) {
      if (destino && existe.has(destino)) out.push({ destino, elemento: b.id, etiqueta: opcion, x: 0.5, y });
    }
  });
  for (const h of s.hotspots ?? []) {
    if (h.target && existe.has(h.target)) out.push({ destino: h.target, elemento: h.id, etiqueta: h.label || 'una zona', x: h.x + h.w / 2, y: h.y + h.h / 2 });
  }
  return out;
}

/** Distancia en pasos de cada pantalla al objetivo, para saber qué salida acerca y cuál desvía. */
function distanciasAlObjetivo(p: Project, objetivo: string): Map<string, number> {
  const g = navGraph(p);
  const inverso = new Map<string, Set<string>>();
  for (const [desde, hacia] of g) {
    for (const h of hacia) {
      if (!inverso.has(h)) inverso.set(h, new Set());
      inverso.get(h)!.add(desde);
    }
  }
  const base = (id: string) => {
    const s = p.screens.find((x) => x.id === id);
    return s ? baseId(s) : id;
  };
  const dist = new Map<string, number>([[base(objetivo), 0]]);
  const cola = [base(objetivo)];
  while (cola.length) {
    const cur = cola.shift()!;
    for (const prev of inverso.get(cur) ?? []) {
      if (!dist.has(prev)) {
        dist.set(prev, dist.get(cur)! + 1);
        cola.push(prev);
      }
    }
  }
  return dist;
}
const entre = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

type Rasgos = SyntheticUser['traits'];

/** En qué circunstancia ocurre la sesión. Dos personas del mismo perfil casi nunca llegan igual. */
interface Contexto {
  id: string;
  etiqueta: string;
  ajuste: Partial<Rasgos>;
  /** Peso por perfil: quién llega más seguido en esta circunstancia. */
  peso: (u: SyntheticUser) => number;
  nota?: string;
}

const CONTEXTOS: Contexto[] = [
  {
    id: 'tranquilo',
    etiqueta: 'en casa, con tiempo',
    ajuste: { paciencia: 1, lectura: 1, prisa: -1 },
    peso: (u) => (u.traits.prisa <= 2 ? 3 : 1),
  },
  {
    id: 'movimiento',
    etiqueta: 'en la calle, a una mano',
    ajuste: { paciencia: -1, lectura: -1, prisa: 1 },
    peso: (u) => (u.traits.digital >= 4 ? 3 : 1),
    nota: 'Iba caminando, lo hice a una mano.',
  },
  {
    id: 'interrumpido',
    etiqueta: 'entre interrupciones',
    ajuste: { paciencia: -1, prisa: 1 },
    peso: (u) => (u.segment === 'Familiar' ? 4 : 2),
    nota: 'Me interrumpieron a la mitad y tuve que retomar.',
  },
  {
    id: 'apuro',
    etiqueta: 'con el tiempo justo',
    ajuste: { paciencia: -2, lectura: -1, prisa: 2 },
    peso: (u) => (u.traits.prisa >= 4 ? 3 : 1),
    nota: 'Andaba con el tiempo justo.',
  },
  {
    id: 'primera',
    etiqueta: 'primera vez en esta app',
    ajuste: { digital: -1, lectura: 1, prisa: -1 },
    peso: (u) => (u.traits.digital <= 2 ? 3 : 1),
    nota: 'Es primera vez que entro a algo así.',
  },
  {
    id: 'rutina',
    etiqueta: 'algo que ya hace seguido',
    ajuste: { digital: 1, lectura: -1 },
    peso: (u) => (u.traits.digital >= 3 ? 2 : 1),
  },
];

/** Elige contexto con la ruleta ponderada del perfil. */
function contextoDe(u: SyntheticUser, azar: () => number): Contexto {
  const pesos = CONTEXTOS.map((c) => c.peso(u));
  const suma = pesos.reduce((a, b) => a + b, 0);
  let corte = azar() * suma;
  for (let i = 0; i < CONTEXTOS.length; i++) {
    corte -= pesos[i];
    if (corte <= 0) return CONTEXTOS[i];
  }
  return CONTEXTOS[CONTEXTOS.length - 1];
}

/** El perfil marca la tendencia; el día y el ánimo la mueven un punto arriba o abajo. */
function rasgosDelDia(u: SyntheticUser, ctx: Contexto, azar: () => number): Rasgos {
  const ruido = () => (azar() < 0.22 ? -1 : azar() < 0.28 ? 1 : 0);
  const r = { ...u.traits };
  for (const k of Object.keys(r) as (keyof Rasgos)[]) r[k] = entre(r[k] + (ctx.ajuste[k] ?? 0) + ruido(), 1, 5);
  return r;
}

/** Tamaños reales de pantalla: no todo el mundo prueba en el mismo teléfono. */
const PANTALLAS: Record<Breakpoint, [number, number][]> = {
  mobile: [
    [375, 667],
    [390, 844],
    [393, 852],
    [412, 915],
    [430, 932],
  ],
  tablet: [
    [768, 1024],
    [834, 1112],
  ],
  desktop: [
    [1366, 768],
    [1440, 900],
    [1680, 1050],
  ],
};

interface Dolor {
  pantalla: string;
  elemento: string;
  tipo: 'duda' | 'toque' | 'desvio' | 'campo';
}

interface Cierre {
  logrado: boolean;
  errores: number;
  dudas: number;
  desvios: number;
  bloqueos: number;
  dolor?: Dolor;
  pantalla: string;
}

const elegir = <T,>(xs: T[], azar: () => number) => xs[Math.floor(azar() * xs.length)];

/** Elige sin repetir dentro de la misma sesión: nadie dice dos veces exactamente lo mismo. */
function elegirNuevo(xs: string[], dichas: Set<string>, azar: () => number): string {
  const libres = xs.filter((x) => !dichas.has(x));
  const elegido = elegir(libres.length ? libres : xs, azar);
  dichas.add(elegido);
  return elegido;
}

/** Coletillas propias de cada perfil: lo que esa persona siempre termina diciendo. */
const MANIAS: Record<string, string[]> = {
  sy_universitario: ['Muy largo para lo simple que era.', 'Esperaba resolverlo en dos toques.', 'Si esto me pasa apurado, lo dejo para después.', 'Prefiero mil veces hacerlo desde el celular, pero rápido.'],
  sy_masivo: ['Me habría gustado ver el saldo antes de confirmar.', 'Quedé con la duda de si se hizo o no.', 'Necesito el comprobante a mano, si no, no me quedo tranquila.', 'Con la plata justa uno no puede equivocarse.'],
  sy_preferencial: ['Faltó el detalle: quiero ver los números antes de aceptar.', 'No vi dónde comparar las opciones.', 'Me falta saber el costo total, no solo la cuota.', 'Si no está la letra chica a la vista, desconfío.'],
  sy_premium: ['Demasiados pasos para algo que debería ser inmediato.', 'Si me pasa esto, termino llamando a mi ejecutiva.', 'No tengo tiempo de andar buscando dónde está cada cosa.', 'Esperaba tenerlo en la primera pantalla.'],
  sy_mayor: ['La letra es chica y los botones quedan muy juntos.', 'Me habría ayudado un aviso de que iba bien encaminado.', 'Prefiero ir despacio y estar seguro de lo que aprieto.', 'Cuando cambia de lugar un botón, me pierdo.'],
  sy_familiar: ['Si me interrumpen aquí, pierdo lo que llevaba.', 'No distinguí bien entre una cuenta y la otra.', 'Necesito poder retomar donde iba.', 'Lo hago en ratos cortos, tiene que ser rápido de volver.'],
};

/**
 * Comentario de cierre: se arma con la circunstancia, lo que pasó y dónde pasó.
 * Cada parte se elige aparte, así dos sesiones del mismo perfil casi nunca dicen lo mismo.
 */
function comentario(u: SyntheticUser, ctx: Contexto, c: Cierre, dichas: Set<string>, azar: () => number): string | undefined {
  const donde = c.dolor?.pantalla ?? c.pantalla;
  const que = c.dolor?.elemento;
  const conElemento = que ? `«${que}»` : 'lo que había que tocar';

  const facil = [
    'Se entendió al tiro, no tuve que pensarlo.',
    'Fue directo, justo lo que esperaba.',
    'Claro. Terminé antes de lo que creía.',
    `Encontré ${conElemento} de inmediato.`,
    'Sin vueltas: hice lo que venía a hacer y salí.',
    'Me resultó obvio dónde seguir en cada paso.',
  ];
  const dudo = [
    `En «${donde}» me detuve: no tenía claro si ${conElemento} era lo correcto.`,
    `Dudé un rato en «${donde}». Tuve que leer dos veces para decidirme.`,
    `Me quedé mirando «${donde}» sin saber por dónde seguía.`,
    `${conElemento[0].toUpperCase()}${conElemento.slice(1)} no me decía del todo qué iba a pasar al tocarlo.`,
    `Avancé, pero no con la seguridad que me gustaría en «${donde}».`,
  ];
  const toque = [
    `Toqué en «${donde}» donde creí que había algo y no pasó nada.`,
    `Le di a ${conElemento} y no reaccionó como esperaba.`,
    `En «${donde}» probé un par de cosas antes de dar con la buena.`,
    `Me confundí: en «${donde}» hay cosas que parecen botones y no lo son.`,
  ];
  const desvio = [
    `Me fui para «${donde}» pensando que por ahí era, y tuve que volver.`,
    `Terminé en «${donde}» sin querer y perdí el hilo.`,
    `Entré a ${conElemento} buscando otra cosa y me desvié.`,
    `Di una vuelta larga: pasé por «${donde}» y no era por ahí.`,
  ];
  const campo = [
    `Intenté continuar en «${donde}» y me frenó sin decirme claramente qué faltaba.`,
    `No me di cuenta de que había un campo obligatorio hasta que no me dejó avanzar.`,
    `El botón de «${donde}» no hacía nada y recién ahí vi lo que faltaba llenar.`,
  ];
  const abandono = [
    `No encontré cómo seguir desde «${donde}».`,
    `Me quedé dando vueltas en «${donde}» y preferí dejarlo.`,
    `Después de varios intentos en «${donde}», lo dejé hasta ahí.`,
    `No me resultó. En «${donde}» me rendí.`,
    `Habría preguntado en una sucursal antes que seguir peleando con «${donde}».`,
  ];

  const pool = !c.logrado
    ? abandono
    : c.bloqueos > 0 && (c.dolor?.tipo === 'campo' || azar() < 0.5)
      ? campo
      : c.desvios > 0 && (c.dolor?.tipo === 'desvio' || azar() < 0.5)
        ? desvio
        : c.errores > 0
          ? toque
          : c.dudas > 0
            ? dudo
            : facil;

  const partes = [elegirNuevo(pool, dichas, azar)];
  // La circunstancia se menciona una sola vez por sesión, cuando explica algo de lo que pasó.
  if (ctx.nota && !dichas.has(ctx.nota) && (!c.logrado || c.errores > 0 || azar() < 0.35)) {
    dichas.add(ctx.nota);
    partes.unshift(ctx.nota);
  }
  const manias = (MANIAS[u.id] ?? []).filter((m) => !dichas.has(m));
  if (manias.length && (!c.logrado || c.errores > 0 || c.bloqueos > 0 || azar() < 0.35)) partes.push(elegirNuevo(manias, dichas, azar));

  // Quien logra todo sin tropiezos a veces no comenta nada, como en la vida real.
  if (c.logrado && c.errores === 0 && c.dudas === 0 && c.bloqueos === 0 && azar() < 0.4) return undefined;
  return partes.join(' ');
}

/** Campos obligatorios que hay que llenar antes de avanzar en esta pantalla. */
function camposRequeridos(s: Screen) {
  return s.blocks.filter((b) => b.required && (b.type === 'input' || b.type === 'select' || b.type === 'textarea'));
}

/** Recorre el prototipo con una persona y devuelve su sesión con todos los eventos. */
export function simularSesion(study: Study, persona: SyntheticUser, indice: number, semilla = Date.now()): SalidaSimulacion {
  const p = study.snapshot;
  const azar = mulberry32(Math.floor(semilla) + indice * 7919);
  const t0 = Date.now() - Math.floor(azar() * 90_000);
  const sessionId = uid('se_');
  const events: StudyEvent[] = [];
  const feedback: TaskFeedback[] = [];
  const ctx = contextoDe(persona, azar);
  // Lo que esta persona ya dijo: evita que las dos tareas suenen calcadas.
  const dichas = new Set<string>();
  const base = rasgosDelDia(persona, ctx, azar);
  // Ritmo personal: hay gente que hace lo mismo al doble de velocidad.
  const ritmo = 0.7 + azar() * 0.75;
  let reloj = 0;

  const anotar = (e: Omit<StudyEvent, 'id' | 'sessionId' | 'elapsed'>) => {
    events.push({ ...e, id: uid('ev_'), sessionId, elapsed: reloj });
  };

  study.tasks.forEach((tarea, iTarea) => {
    const inicioTarea = reloj;
    // Cansancio y aprendizaje: al avanzar el estudio hay menos paciencia, pero más oficio.
    const fatiga = study.tasks.length > 1 ? iTarea / (study.tasks.length - 1) : 0;
    const t: Rasgos = {
      digital: entre(base.digital + (fatiga > 0.5 ? 1 : 0), 1, 5),
      paciencia: entre(Math.round(base.paciencia - fatiga * 1.5), 1, 5),
      lectura: entre(Math.round(base.lectura - fatiga), 1, 5),
      cautela: base.cautela,
      prisa: entre(Math.round(base.prisa + fatiga * 1.5), 1, 5),
    };
    const distancias = distanciasAlObjetivo(p, tarea.successScreenId);
    const baseDe = (id: string) => {
      const s = p.screens.find((x) => x.id === id);
      return s ? baseId(s) : id;
    };
    let actual = p.screens.find((s) => s.id === tarea.startScreenId) ?? p.screens[0];
    let anterior: Screen | undefined;
    let errores = 0;
    let dudas = 0;
    let desvios = 0;
    let bloqueos = 0;
    let pasos = 0;
    let logrado = false;
    let dolor: Dolor | undefined;
    let ultima = actual.name;
    const llenados = new Set<string>();
    // La paciencia marca cuántos tropiezos aguanta antes de rendirse.
    const tope = 2 + t.paciencia;
    const maxPasos = 4 + study.tasks.length * 2 + t.paciencia * 2;

    anotar({ kind: 'task_start', taskId: tarea.id, screen: actual.id, x: 0.5, y: 0.5 });

    while (pasos < maxPasos) {
      if (baseDe(actual.id) === baseDe(tarea.successScreenId)) {
        logrado = true;
        break;
      }
      const salidas = salidasDe(p, actual);
      if (!salidas.length) break;
      ultima = actual.name;

      // Leer y decidir: quien lee más tarda más, quien anda con prisa tarda menos.
      const lectura = 700 + t.lectura * 420 + salidas.length * 130 - t.prisa * 120;
      const pensar = Math.max(320, lectura * (0.6 + azar() * 0.8) * ritmo);
      reloj += Math.round(pensar);

      // Elegir salida: la que acerca al objetivo, salvo que se equivoque.
      const puntuadas = salidas.map((s) => ({ s, d: distancias.get(baseDe(s.destino)) ?? 99 }));
      const mejor = puntuadas.reduce((a, b) => (a.d <= b.d ? a : b));
      const alternativas = puntuadas.filter((x) => x.s.destino !== mejor.s.destino);
      const probError = entre(0.34 - t.digital * 0.05 - t.lectura * 0.03 + t.prisa * 0.025 + (salidas.length - 2) * 0.04, 0.02, 0.55);
      const elegida = alternativas.length && azar() < probError ? alternativas[Math.floor(azar() * alternativas.length)] : mejor;
      const desvia = elegida.d > mejor.d;
      if (desvia) {
        errores++;
        desvios++;
        dolor = { pantalla: p.screens.find((s) => s.id === elegida.s.destino)?.name ?? actual.name, elemento: elegida.s.etiqueta, tipo: 'desvio' };
      }

      // Campos obligatorios: con prisa se intenta avanzar antes de llenarlos.
      const requeridos = camposRequeridos(actual).filter((b) => !llenados.has(b.id));
      if (requeridos.length) {
        const saltaLectura = azar() < entre(0.2 + t.prisa * 0.1 - t.lectura * 0.05 - t.cautela * 0.04, 0.05, 0.6);
        if (saltaLectura) {
          bloqueos++;
          errores++;
          dolor = { pantalla: actual.name, elemento: elegida.s.etiqueta, tipo: 'campo' };
          anotar({ kind: 'blocked', taskId: tarea.id, screen: actual.id, block: elegida.s.elemento, x: elegida.s.x, y: elegida.s.y });
          reloj += Math.round((1400 + azar() * 2200) * ritmo);
        }
        for (const campo of requeridos) {
          llenados.add(campo.id);
          anotar({ kind: 'input', taskId: tarea.id, screen: actual.id, block: campo.id, x: 0.5, y: 0.5 });
          reloj += Math.round((1800 + azar() * 2600 + (5 - t.digital) * 700) * ritmo);
        }
      }

      // Duda: se queda mirando el elemento antes de tocarlo. Queda anotada sobre ese elemento.
      const probDuda = entre(0.36 - t.digital * 0.05 + (5 - t.paciencia) * 0.02 + (salidas.length - 1) * 0.05, 0.03, 0.6);
      if (azar() < probDuda) {
        dudas++;
        const dwell = Math.round((2600 + azar() * 3200 + (5 - t.digital) * 500) * ritmo);
        if (!dolor || dwell > 5000) dolor = { pantalla: actual.name, elemento: elegida.s.etiqueta, tipo: 'duda' };
        anotar({ kind: 'hesitation', taskId: tarea.id, screen: actual.id, block: elegida.s.elemento, x: elegida.s.x, y: elegida.s.y, dwell });
        reloj += dwell;
      }

      // Toque sin acción: más probable con poca soltura digital y mucha prisa.
      const probMisclick = entre(0.2 - t.digital * 0.035 + t.prisa * 0.01 - t.lectura * 0.005, 0.02, 0.3);
      let toquesVacios = 0;
      // Insistir dos veces en el mismo punto muerto es raro; tres, casi nunca.
      while (toquesVacios < 2 && azar() < probMisclick / (toquesVacios * 3 + 1)) {
        toquesVacios++;
        errores++;
        if (!dolor) dolor = { pantalla: actual.name, elemento: elegida.s.etiqueta, tipo: 'toque' };
        anotar({ kind: 'misclick', taskId: tarea.id, screen: actual.id, x: 0.2 + azar() * 0.6, y: 0.2 + azar() * 0.6 });
        reloj += Math.round((900 + azar() * 1200) * ritmo);
      }
      if (errores > tope) break;

      const jitter = (n: number) => entre(n + (azar() - 0.5) * 0.06, 0.02, 0.98);
      anotar({
        kind: 'tap',
        taskId: tarea.id,
        screen: actual.id,
        block: elegida.s.elemento,
        x: jitter(elegida.s.x),
        y: jitter(elegida.s.y),
        bx: entre(0.5 + (azar() - 0.5) * 0.7, 0.05, 0.95),
        by: entre(0.5 + (azar() - 0.5) * 0.6, 0.1, 0.9),
      });
      reloj += Math.round((260 + azar() * 260) * ritmo);

      const siguiente = p.screens.find((s) => s.id === elegida.s.destino);
      if (!siguiente) break;
      anterior = actual;
      actual = siguiente;
      pasos++;
      anotar({ kind: 'navigate', taskId: tarea.id, screen: actual.id, x: 0.5, y: 0.5 });
      if (errores > tope) break;

      // Volver atrás: quien se dio cuenta del desvío rehace el camino en vez de seguir perdido.
      if (desvia && anterior && azar() < entre(0.25 + t.digital * 0.1 + t.cautela * 0.05, 0.2, 0.85)) {
        reloj += Math.round((900 + azar() * 1800) * ritmo);
        actual = anterior;
        pasos++;
        anotar({ kind: 'navigate', taskId: tarea.id, screen: actual.id, x: 0.5, y: 0.5 });
      }
    }

    if (baseDe(actual.id) === baseDe(tarea.successScreenId)) logrado = true;
    anotar({ kind: logrado ? 'task_success' : 'task_giveup', taskId: tarea.id, screen: actual.id, x: 0.5, y: 0.5 });

    // Dificultad percibida: parte del sesgo del perfil, sube con cada tropiezo y nunca es del todo previsible.
    const sesgo = 1.4 + (5 - t.digital) * 0.35 + (5 - t.paciencia) * 0.15;
    // Quien no tropezó no califica difícil; el resto tiene un día mejor o peor.
    const tropiezos = errores + dudas + bloqueos;
    const humor = tropiezos === 0 ? (azar() < 0.25 ? -1 : 0) : azar() < 0.3 ? (azar() < 0.5 ? -1 : 1) : 0;
    const dificultad = entre(Math.round(sesgo + errores * 0.75 + dudas * 0.4 + bloqueos * 0.5 + (logrado ? 0 : 1.2) + humor), 1, 5);
    feedback.push({
      taskId: tarea.id,
      outcome: logrado ? 'success' : 'giveup',
      difficulty: dificultad,
      comment: comentario(persona, ctx, { logrado, errores, dudas, desvios, bloqueos, dolor, pantalla: ultima }, dichas, azar),
      durationMs: Math.max(1500, reloj - inicioTarea),
    });
    reloj += Math.round((1200 + azar() * 1600) * ritmo);
  });

  const opciones = PANTALLAS[persona.device] ?? PANTALLAS.mobile;
  const [w, h] = opciones[Math.floor(azar() * opciones.length)];
  const session: Session = {
    id: sessionId,
    studyId: study.id,
    participant: `${persona.name.split(' ')[0]} · ${persona.segment}`,
    device: { breakpoint: persona.device, width: w, height: h },
    consent: { participate: true, audio: false, at: t0 },
    feedback,
    status: 'completed',
    source: 'synthetic',
    syntheticId: persona.id,
    context: ctx.etiqueta,
    startedAt: t0,
    endedAt: t0 + reloj,
  };
  return { session, events };
}

/** Simula una tanda: cada entrada dice cuántas sesiones correr con esa persona. */
export function simularTanda(study: Study, tanda: { persona: SyntheticUser; cantidad: number }[], semilla = Date.now()): SalidaSimulacion[] {
  const salidas: SalidaSimulacion[] = [];
  let i = 0;
  for (const { persona, cantidad } of tanda) {
    for (let n = 0; n < cantidad; n++) salidas.push(simularSesion(study, persona, i++, semilla));
  }
  return salidas;
}
