// Tu espacio de trabajo en cualquier computador: proyectos y estudios viajan con tu cuenta.
//
// Cada proyecto y cada estudio se compara por su fecha de modificación: gana el más reciente.
// Las sesiones no se editan, solo se crean, así que se unen por id y nunca chocan.
import type { DB, Membership, Project, Session, Study, StudyEvent } from './model';
import { roleFor } from './permissions';
import { uid } from './ids';
import { borrarDelEspacio, bajarDelEspacio, ensureCloudAccount, leerIndiceEspacio, subirAlEspacio, type EntradaEspacio } from './cloud';
import { currentUser, getDb, reemplazarDesdeNube } from './store';

/** Paquete de un estudio: lo que hace falta para que sus resultados se vean en otro equipo. */
interface PaqueteEstudio {
  study: Study;
  sessions: Session[];
  events: StudyEvent[];
}

export interface ResumenSync {
  subidos: number;
  bajados: number;
  borrados: number;
  /** Nombres que cambiaron en dos equipos a la vez: ganó el más reciente. */
  conflictos: string[];
  error?: string;
}

/** Cuándo cambió un estudio por última vez, mirando todo lo que lo compone. */
export function marcaEstudio(study: Study, sessions: Session[]): number {
  const deSesiones = sessions.filter((s) => s.studyId === study.id).map((s) => s.endedAt ?? s.startedAt);
  return Math.max(study.updatedAt ?? study.created, study.summary?.at ?? 0, ...deSesiones, 0);
}

export const clave = (e: { tipo: string; id: string }) => `${e.tipo}_${e.id}`;

export interface Plan {
  /** Claves que hay que subir porque aquí son más nuevas. */
  subir: string[];
  /** Claves que hay que traer porque allá son más nuevas. */
  bajar: string[];
  /** Claves borradas en otro equipo: se quitan aquí. */
  quitar: string[];
  /** Proyectos de ejemplo de un navegador recién estrenado: sobran cuando la nube trae trabajo real. */
  descartar: string[];
  /** Nombres que cambiaron en los dos lados: gana el más reciente. */
  conflictos: string[];
}

/**
 * Qué mover y en qué dirección. Es la decisión delicada —puede quitar cosas de este navegador—
 * así que vive aparte de la red, se lee de un vistazo y se prueba sola.
 */
export function planificar(locales: { tipo: 'proyecto' | 'estudio'; id: string; nombre: string; actualizado: number; prescindible?: boolean }[], indice: EntradaEspacio[]): Plan {
  const plan: Plan = { subir: [], bajar: [], quitar: [], descartar: [], conflictos: [] };
  const remoto = new Map(indice.map((e) => [clave(e), e]));
  const porClave = new Map(locales.map((l) => [clave(l), l]));

  // Navegador recién estrenado: todo lo local son ejemplos intactos y en la nube hay trabajo real.
  const hayEnNube = indice.some((e) => !e.borrado);
  const proyectosLocales = locales.filter((l) => l.tipo === 'proyecto');
  if (hayEnNube && proyectosLocales.length && proyectosLocales.every((l) => l.prescindible && !remoto.has(clave(l)))) {
    plan.descartar = proyectosLocales.map((l) => l.id);
  }
  const descartados = new Set(plan.descartar);

  for (const l of locales) {
    if (l.tipo === 'proyecto' && descartados.has(l.id)) continue;
    const r = remoto.get(clave(l));
    if (r?.borrado && r.actualizado > l.actualizado) continue;
    if (r && !r.borrado && r.actualizado >= l.actualizado) continue;
    plan.subir.push(clave(l));
    if (r && !r.borrado) plan.conflictos.push(l.nombre);
  }

  for (const r of indice) {
    const l = porClave.get(clave(r));
    if (r.borrado) {
      if (l && r.actualizado > l.actualizado) plan.quitar.push(clave(r));
      continue;
    }
    if (l && l.actualizado >= r.actualizado) continue;
    plan.bajar.push(clave(r));
  }
  return plan;
}

/**
 * Pone de acuerdo este navegador con la nube. Devuelve qué se movió, para poder contarlo.
 * Sin cuenta con correo no hace nada: la cuenta anónima es de este navegador y no viaja.
 */
export async function sincronizarEspacio(): Promise<ResumenSync> {
  const vacio: ResumenSync = { subidos: 0, bajados: 0, borrados: 0, conflictos: [] };
  let indice: EntradaEspacio[];
  let correoCuenta = '';
  try {
    correoCuenta = (await ensureCloudAccount()).email ?? '';
    if (!correoCuenta) return vacio;
    indice = await leerIndiceEspacio();
  } catch {
    return { ...vacio, error: 'No pudimos leer tu espacio en la nube. Revisa tu conexión.' };
  }

  const db = getDb();
  const remoto = new Map(indice.map((e) => [clave(e), e]));
  const resumen: ResumenSync = { ...vacio, conflictos: [] };

  // Lo local, con su fecha de modificación.
  const locales: { entrada: EntradaEspacio; contenido: unknown }[] = [
    ...db.projects.map((p) => ({ entrada: { tipo: 'proyecto' as const, id: p.id, nombre: p.name, actualizado: p.updatedAt }, contenido: p })),
    ...db.studies.map((s) => {
      const sessions = db.sessions.filter((x) => x.studyId === s.id);
      const ids = new Set(sessions.map((x) => x.id));
      return {
        entrada: { tipo: 'estudio' as const, id: s.id, nombre: s.name, actualizado: marcaEstudio(s, sessions) },
        contenido: { study: s, sessions, events: db.events.filter((e) => ids.has(e.sessionId)) } satisfies PaqueteEstudio,
      };
    }),
  ];
  // Un proyecto de ejemplo recién sembrado: nunca se editó y no tiene estudios.
  const intacto = (p?: Project) => !!p && p.updatedAt === p.createdAt && !db.studies.some((s) => s.projectId === p.id);

  // Qué mover, decidido aparte.
  const plan = planificar(
    locales.map((l) => ({
      ...l.entrada,
      prescindible: l.entrada.tipo === 'proyecto' && intacto(db.projects.find((p) => p.id === l.entrada.id)!),
    })),
    indice,
  );
  const descartar = new Set(plan.descartar);
  resumen.conflictos = plan.conflictos;

  // 1. Subir lo que aquí es más nuevo o todavía no existe allá.
  const aSubir = new Set(plan.subir);
  for (const l of locales) {
    if (!aSubir.has(clave(l.entrada))) continue;
    try {
      await subirAlEspacio(l.entrada, l.contenido);
      resumen.subidos++;
    } catch {
      resumen.error = 'Algo no se pudo subir. Se reintenta en la próxima sincronización.';
    }
  }

  // 2. Bajar lo que allá es más nuevo o falta aquí, y aplicar los borrados de otros equipos.
  //
  // Lo que viene de otro equipo trae el id de usuario de ese equipo. Como el espacio es de una
  // sola cuenta, se adopta a nombre de quien está en este navegador: si no, quedaría invisible.
  const usuariosLocales = new Set(db.users.map((u) => u.id));
  const yo = db.currentUserId ?? db.users[0]?.id ?? '';
  const adoptar = <T extends { owner: string }>(x: T): T => (usuariosLocales.has(x.owner) ? x : { ...x, owner: yo });
  const proyectos = new Map(db.projects.map((p) => [p.id, p]));
  const estudios = new Map(db.studies.map((s) => [s.id, s]));
  let sesiones = db.sessions;
  let eventos = db.events;
  const fuera = { proyectos: new Set<string>(), estudios: new Set<string>() };

  const aBajar = new Set(plan.bajar);
  const aQuitar = new Set(plan.quitar);
  for (const r of indice) {
    if (aQuitar.has(clave(r))) {
      if (r.tipo === 'proyecto') fuera.proyectos.add(r.id);
      else fuera.estudios.add(r.id);
      resumen.borrados++;
      continue;
    }
    if (!aBajar.has(clave(r))) continue;
    if (r.tipo === 'proyecto') {
      const p = await bajarDelEspacio<Project>(r);
      if (!p) continue;
      proyectos.set(p.id, adoptar(p));
      resumen.bajados++;
    } else {
      const paquete = await bajarDelEspacio<PaqueteEstudio>(r);
      if (!paquete?.study) continue;
      estudios.set(paquete.study.id, adoptar(paquete.study));
      // Las sesiones se unen por id: en un equipo pudieron llegar unas y en otro, otras.
      const conocidas = new Set(sesiones.map((s) => s.id));
      sesiones = [...sesiones, ...(paquete.sessions ?? []).filter((s) => !conocidas.has(s.id))];
      const conocidos = new Set(eventos.map((e) => e.id));
      eventos = [...eventos, ...(paquete.events ?? []).filter((e) => !conocidos.has(e.id))];
      resumen.bajados++;
    }
  }

  descartar.forEach((id) => fuera.proyectos.add(id));

  // Todo lo que está en tu espacio de nube es tuyo: si por lo que sea no tendrías acceso —porque
  // el proyecto nació en otro equipo a nombre de otra persona— se te da aquí. Se revisa en cada
  // sincronización, así que también corrige lo que haya quedado mal en una pasada anterior.
  const ahora = getDb();
  const persona = currentUser(ahora);
  const membresias: Membership[] = [];
  if (persona) {
    for (const p of proyectos.values()) {
      if (fuera.proyectos.has(p.id)) continue;
      if (!remoto.has(`proyecto_${p.id}`) && !plan.subir.includes(`proyecto_${p.id}`)) continue;
      if (roleFor(ahora, p, persona)) continue;
      if (membresias.some((m) => m.subjectId === p.id)) continue;
      membresias.push({ id: uid('m_'), subjectType: 'project', subjectId: p.id, email: persona.email, role: 'owner' });
    }
  }

  if (resumen.bajados || resumen.borrados || descartar.size || membresias.length) {
    const estudiosFinales = [...estudios.values()].filter((s) => !fuera.estudios.has(s.id) && !fuera.proyectos.has(s.projectId));
    const idsEstudio = new Set(estudiosFinales.map((s) => s.id));
    const sesionesFinales = sesiones.filter((s) => idsEstudio.has(s.studyId));
    const idsSesion = new Set(sesionesFinales.map((s) => s.id));
    const proximo: DB = {
      ...db,
      memberships: [...db.memberships, ...membresias],
      projects: [...proyectos.values()].filter((p) => !fuera.proyectos.has(p.id)),
      studies: estudiosFinales,
      sessions: sesionesFinales,
      events: eventos.filter((e) => idsSesion.has(e.sessionId)),
    };
    reemplazarDesdeNube(proximo);
  }

  return resumen;
}

/** Al eliminar algo aquí hay que decirlo allá, o volvería en la próxima sincronización. */
export function escucharBorrados() {
  if (typeof window === 'undefined') return;
  window.addEventListener('forma:borrado', (e) => {
    const d = (e as CustomEvent<{ tipo: 'proyecto' | 'estudio'; id: string; nombre: string }>).detail;
    if (d) void borrarDelEspacio(d).catch(() => undefined);
  });
}
