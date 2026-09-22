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

/** Frases de cierre, en la voz de cada perfil, según cómo le fue. */
function comentario(u: SyntheticUser, errores: number, dudas: number, logrado: boolean, pantalla: string, azar: () => number): string | undefined {
  const facil = [
    'Se entendió al tiro, no tuve que pensarlo.',
    'Fue directo, justo lo que esperaba.',
    'Claro. Terminé antes de lo que creía.',
  ];
  const dudo = [
    `En «${pantalla}» dudé un rato: no tenía claro qué tocar.`,
    `Me detuve en «${pantalla}» porque no sabía si esa era la opción.`,
    `Tuve que leer dos veces «${pantalla}» para decidir.`,
  ];
  const fallo = [
    `Toqué donde no era en «${pantalla}» y no pasó nada.`,
    `Me perdí en «${pantalla}»; probé por otro lado y volví.`,
    `En «${pantalla}» me fui por el camino equivocado.`,
  ];
  const abandono = [
    `No encontré cómo seguir desde «${pantalla}».`,
    `Me quedé dando vueltas en «${pantalla}» y preferí dejarlo.`,
    `Después de intentarlo varias veces en «${pantalla}», lo dejé.`,
  ];
  const propias: Record<string, string[]> = {
    sy_universitario: ['Muy largo para lo simple que era.', 'Esperaba resolverlo en dos toques.'],
    sy_masivo: ['Me habría gustado ver el saldo antes de confirmar.', 'Quedé con la duda de si se hizo o no.'],
    sy_preferencial: ['Faltó el detalle: quiero ver los números antes de aceptar.', 'No vi dónde comparar las opciones.'],
    sy_premium: ['Demasiados pasos para algo que debería ser inmediato.', 'Si me pasa esto, termino llamando a mi ejecutiva.'],
    sy_mayor: ['La letra es chica y los botones quedan muy juntos.', 'Me habría ayudado un aviso de que iba bien encaminado.'],
    sy_familiar: ['Si me interrumpen aquí, pierdo lo que llevaba.', 'No distinguí bien entre una cuenta y la otra.'],
  };
  const pool = !logrado ? abandono : errores > 0 ? fallo : dudas > 0 ? dudo : facil;
  const base = pool[Math.floor(azar() * pool.length)];
  const extra = propias[u.id] ?? [];
  // Cuando algo salió mal, la persona suele agregar su propia manía.
  if (extra.length && (errores > 0 || !logrado || azar() < 0.3)) return `${base} ${extra[Math.floor(azar() * extra.length)]}`;
  return errores === 0 && dudas === 0 && azar() < 0.45 ? undefined : base;
}

/** Recorre el prototipo con una persona y devuelve su sesión con todos los eventos. */
export function simularSesion(study: Study, persona: SyntheticUser, indice: number, semilla = Date.now()): SalidaSimulacion {
  const p = study.snapshot;
  const azar = mulberry32(Math.floor(semilla) + indice * 7919);
  const t0 = Date.now() - Math.floor(azar() * 90_000);
  const sessionId = uid('se_');
  const events: StudyEvent[] = [];
  const feedback: TaskFeedback[] = [];
  const t = persona.traits;
  let reloj = 0;

  const anotar = (e: Omit<StudyEvent, 'id' | 'sessionId' | 'elapsed'>) => {
    events.push({ ...e, id: uid('ev_'), sessionId, elapsed: reloj });
  };

  for (const tarea of study.tasks) {
    const inicioTarea = reloj;
    const distancias = distanciasAlObjetivo(p, tarea.successScreenId);
    const baseDe = (id: string) => {
      const s = p.screens.find((x) => x.id === id);
      return s ? baseId(s) : id;
    };
    let actual = p.screens.find((s) => s.id === tarea.startScreenId) ?? p.screens[0];
    let errores = 0;
    let dudas = 0;
    let pasos = 0;
    let logrado = false;
    let ultima = actual.name;
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
      const pensar = Math.max(320, lectura * (0.6 + azar() * 0.8));
      reloj += Math.round(pensar);

      // Elegir salida: la que acerca al objetivo, salvo que se equivoque.
      const puntuadas = salidas.map((s) => ({ s, d: distancias.get(baseDe(s.destino)) ?? 99 }));
      const mejor = puntuadas.reduce((a, b) => (a.d <= b.d ? a : b));
      const alternativas = puntuadas.filter((x) => x.s.destino !== mejor.s.destino);
      const probError = entre(0.34 - t.digital * 0.05 - t.lectura * 0.03 + t.prisa * 0.025 + (salidas.length - 2) * 0.04, 0.02, 0.55);
      const elegida = alternativas.length && azar() < probError ? alternativas[Math.floor(azar() * alternativas.length)] : mejor;
      if (elegida.d > mejor.d) errores++;

      // Duda: se queda mirando el elemento antes de tocarlo. Queda anotada sobre ese elemento.
      const probDuda = entre(0.36 - t.digital * 0.05 + (5 - t.paciencia) * 0.02 + (salidas.length - 1) * 0.05, 0.03, 0.6);
      if (azar() < probDuda) {
        dudas++;
        const dwell = 2600 + Math.round(azar() * 3200) + (5 - t.digital) * 500;
        anotar({ kind: 'hesitation', taskId: tarea.id, screen: actual.id, block: elegida.s.elemento, x: elegida.s.x, y: elegida.s.y, dwell });
        reloj += dwell;
      }

      // Toque sin acción: más probable con poca soltura digital y mucha prisa.
      const probMisclick = entre(0.3 - t.digital * 0.045 + t.prisa * 0.02 - t.lectura * 0.015, 0.02, 0.45);
      if (azar() < probMisclick) {
        errores++;
        anotar({ kind: 'misclick', taskId: tarea.id, screen: actual.id, x: 0.2 + azar() * 0.6, y: 0.2 + azar() * 0.6 });
        reloj += 900 + Math.round(azar() * 1200);
        if (errores > tope) break;
      }

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
      reloj += 260 + Math.round(azar() * 260);

      const siguiente = p.screens.find((s) => s.id === elegida.s.destino);
      if (!siguiente) break;
      actual = siguiente;
      pasos++;
      anotar({ kind: 'navigate', taskId: tarea.id, screen: actual.id, x: 0.5, y: 0.5 });
      if (errores > tope) break;
    }

    if (baseDe(actual.id) === baseDe(tarea.successScreenId)) logrado = true;
    anotar({ kind: logrado ? 'task_success' : 'task_giveup', taskId: tarea.id, screen: actual.id, x: 0.5, y: 0.5 });

    // Dificultad percibida: parte del sesgo del perfil y sube con cada tropiezo.
    const sesgo = 1.4 + (5 - t.digital) * 0.35 + (5 - t.paciencia) * 0.15;
    const dificultad = entre(Math.round(sesgo + errores * 0.9 + dudas * 0.4 + (logrado ? 0 : 1.2)), 1, 5);
    feedback.push({
      taskId: tarea.id,
      outcome: logrado ? 'success' : 'giveup',
      difficulty: dificultad,
      comment: comentario(persona, errores, dudas, logrado, ultima, azar),
      durationMs: Math.max(1500, reloj - inicioTarea),
    });
    reloj += 1200;
  }

  const anchos: Record<Breakpoint, [number, number]> = { mobile: [390, 844], tablet: [834, 1112], desktop: [1440, 900] };
  const [w, h] = anchos[persona.device] ?? anchos.mobile;
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
