import { useSyncExternalStore } from 'react';
import type { Comment, DB, LibraryRelease, Op, OpInput, Project, ProjectVersion, Role, Session, Study, StudyEvent, StudyTask, User } from './model';
import { emptyDb } from './model';
import { applyOp, clone, edit, invertOp } from './ops';
import { can, roleFor, type Permission, ROLE_LABEL } from './permissions';
import { blankProject, exampleStudy, transferProject } from './seed';
import { bancoNewProject } from './seedBancoNew';
import { completeSystem, upgradeProjectStates } from './catalog';
import { checkProject, hasBlockingErrors } from './flowCheck';
import { uid } from './ids';
import { notify } from './toast';
import { deleteAudio } from './blobs';

const KEY = 'formapro.db.v1';
const OPS_PER_PROJECT = 300;

function load(): DB {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d?.schema === 1) return migrate({ ...emptyDb(), ...d });
    }
  } catch {
    /* almacenamiento no disponible */
  }
  return emptyDb();
}

let db: DB = load();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function flush() {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(db));
  } catch {
    notify('No se pudo guardar en este navegador: el almacenamiento está lleno. Exporta un respaldo y elimina estudios antiguos.', 'error');
  }
}

function commit(next: DB) {
  db = next;
  clearTimeout(timer);
  timer = setTimeout(flush, 120);
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  // Otra pestaña (por ejemplo, una sesión de prueba) guardó cambios.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      db = { ...emptyDb(), ...JSON.parse(e.newValue) };
      listeners.forEach((l) => l());
    } catch {
      /* ignorar */
    }
  });
}

export const getDb = () => db;

/** Vuelve a leer lo guardado (por ejemplo, sesiones terminadas en otra pestaña). */
export function refreshFromStorage() {
  db = load();
  listeners.forEach((l) => l());
  notify('Datos actualizados.', 'success');
}
export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useDb = () => useSyncExternalStore(subscribe, getDb, getDb);

/** Solo para pruebas automatizadas. */
export function __resetForTests(next: DB = emptyDb()) {
  db = next;
  stacks.clear();
}

// ---------- Identidad ----------

export const currentUser = (d: DB = db): User | undefined => d.users.find((u) => u.id === d.currentUserId);
export const userName = (d: DB, id: string) => d.users.find((u) => u.id === id)?.name ?? 'Persona invitada';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function signIn(name: string, email: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  if (!name.trim() || !EMAIL.test(cleanEmail)) {
    notify('Escribe tu nombre y un correo válido.', 'error');
    return false;
  }
  let user = db.users.find((u) => u.email === cleanEmail);
  let next = db;
  if (!user) {
    user = { id: uid('u_'), name: name.trim(), email: cleanEmail };
    next = { ...next, users: [...next.users, user] };
  }
  next = { ...next, currentUserId: user.id };
  commit(next);
  if (!projectsFor(db, user).length) createProject({ name: 'Ahorro con propósito', business: 'Proyecto bancario', template: 'transfer' });
  void ensureSamples();
  return true;
}

// ---------- Proyecto de ejemplo Banco New ----------

const SAMPLE = 'bancoNew';
let adopting = false;

export interface SampleFile {
  project: Project;
  versions: ProjectVersion[];
  studies: Study[];
  sessions: Session[];
  events: StudyEvent[];
}

/** Agrega Banco New, con su estudio y resultados de QA, una sola vez a cada persona. */
export async function ensureSamples() {
  const user = currentUser();
  if (!user || adopting || user.samples?.includes(SAMPLE) || typeof fetch === 'undefined') return;
  adopting = true;
  try {
    const res = await fetch('./examples/banco-new.json');
    if (!res.ok) return;
    const sample = (await res.json()) as SampleFile;
    const fresh = currentUser();
    if (!fresh || fresh.id !== user.id || fresh.samples?.includes(SAMPLE)) return;
    commit(adoptSample(db, fresh, sample));
  } catch {
    /* sin conexión: se intenta en la próxima visita */
  } finally {
    adopting = false;
  }
}

/**
 * Ajusta proyectos Banco New creados antes de que existieran las hojas inferiores: «Accesos rápidos»
 * pasa a abrirse como modal sobre Inicio. Las copias congeladas de los estudios no se tocan.
 */
export function migrate(d: DB): DB {
  const needs = (p: Project) => p.screens.some((s) => s.id === 's-bn-accesos' && !s.presentation);
  const sheets = d.projects.map((p) =>
      needs(p)
        ? {
            ...p,
            components: p.components.map((c) => (c.id === 'cmp-bn-grid' && !c.variant ? { ...c, variant: 'flat' } : c)),
            screens: p.screens.map((s) =>
              s.id === 's-bn-accesos' ? { ...s, presentation: 'sheet' as const, sheetOver: 's-bn-inicio', blocks: s.blocks.filter((b) => b.id !== 'bn-ac-texto') } : s,
            ),
          }
        : p,
  );
  // Cada proyecto tiene la biblioteca completa: se agregan los patrones y colores que falten.
  const projects = sheets.map((p) => upgradeProjectStates(completeSystem(p)));
  return projects.every((p, i) => p === d.projects[i]) ? d : { ...d, projects };
}

/** Copia el ejemplo con identificadores nuevos y la persona actual como dueña. */
export function adoptSample(d: DB, user: User, s: SampleFile): DB {
  const users = d.users.map((u) => (u.id === user.id ? { ...u, samples: [...(u.samples ?? []), SAMPLE] } : u));
  if (projectsFor(d, user).some((p) => p.name === s.project.name)) return { ...d, users };
  const projectId = uid('p_');
  const studyIds = new Map(s.studies.map((x) => [x.id, uid('st_')]));
  const sessionIds = new Map(s.sessions.map((x) => [x.id, uid('se_')]));
  const own = (p: Project): Project => ({ ...p, id: projectId, owner: user.id });
  return migrateAdopted({
    ...d,
    users,
    projects: [...d.projects, { ...own(s.project), updatedAt: Date.now() }],
    memberships: [...d.memberships, { id: uid('m_'), subjectType: 'project' as const, subjectId: projectId, email: user.email, role: 'owner' as const }],
    versions: [...d.versions, ...s.versions.map((v) => ({ ...v, id: uid('v_'), projectId, createdBy: user.id, snapshot: own(v.snapshot) }))],
    studies: [...d.studies, ...s.studies.map((x) => ({ ...x, id: studyIds.get(x.id)!, projectId, owner: user.id, snapshot: own(x.snapshot) }))],
    sessions: [...d.sessions, ...s.sessions.filter((x) => studyIds.has(x.studyId)).map((x) => ({ ...x, id: sessionIds.get(x.id)!, studyId: studyIds.get(x.studyId)! }))],
    events: [...d.events, ...s.events.filter((e) => sessionIds.has(e.sessionId)).map((e) => ({ ...e, id: uid('ev_'), sessionId: sessionIds.get(e.sessionId)! }))],
  });
}

const migrateAdopted = (d: DB) => migrate(d);

// Personas que ya tenían sesión abierta antes de que existiera el ejemplo.
if (typeof window !== 'undefined') void Promise.resolve().then(ensureSamples);

export const signOut = () => commit({ ...db, currentUserId: undefined });
export const switchUser = (id: string) => commit({ ...db, currentUserId: id });

export const projectsFor = (d: DB, user?: User) => (user ? d.projects.filter((p) => roleFor(d, p, user)) : []);

function guard(projectId: string, perm: Permission): { user: User; project: Project; role: Role } | null {
  const user = currentUser();
  const project = db.projects.find((p) => p.id === projectId);
  if (!user || !project) {
    notify('No encontramos ese proyecto.', 'error');
    return null;
  }
  const role = roleFor(db, project, user);
  if (!can(role, perm)) {
    notify(`Tu rol (${role ? ROLE_LABEL[role] : 'sin acceso'}) no permite esta acción.`, 'error');
    return null;
  }
  return { user, project, role: role! };
}

// ---------- Operaciones, deshacer y rehacer ----------

interface Entry {
  label: string;
  applied: { op: OpInput; prev: unknown }[];
}
const stacks = new Map<string, { undo: Entry[]; redo: Entry[] }>();
const stackFor = (id: string) => {
  if (!stacks.has(id)) stacks.set(id, { undo: [], redo: [] });
  return stacks.get(id)!;
};

export const canUndo = (projectId: string) => stackFor(projectId).undo.length > 0;
export const canRedo = (projectId: string) => stackFor(projectId).redo.length > 0;
export const undoLabel = (projectId: string) => stackFor(projectId).undo.at(-1)?.label;

function run(projectId: string, inputs: OpInput[], label: string, history: 'push' | 'undo' | 'redo' | 'none'): Entry | null {
  const g = guard(projectId, 'edit');
  if (!g) return null;
  let doc: Project = g.project;
  const applied: Entry['applied'] = [];
  try {
    for (const input of inputs) {
      const r = applyOp(doc, input);
      doc = r.doc;
      applied.push({ op: r.op, prev: r.prev });
    }
  } catch (e) {
    notify(`No se pudo aplicar el cambio: ${(e as Error).message}`, 'error');
    return null;
  }
  const at = Date.now();
  doc = { ...doc, id: g.project.id, owner: g.project.owner, createdAt: g.project.createdAt, version: g.project.version + 1, updatedAt: at };
  const logged: Op[] = applied.map(
    (a) =>
      ({
        ...a.op,
        ...(a.op.kind === 'set' && a.op.path.length === 0 ? { value: '(proyecto completo)' } : {}),
        id: uid('op_'),
        projectId,
        by: g.user.id,
        at,
        label,
        prev: a.op.kind === 'set' && a.op.path.length === 0 ? undefined : a.prev,
      }) as Op,
  );
  const own = db.ops.filter((o) => o.projectId === projectId);
  commit({
    ...db,
    projects: db.projects.map((p) => (p.id === projectId ? doc : p)),
    ops: [...db.ops.filter((o) => o.projectId !== projectId), ...[...own, ...logged].slice(-OPS_PER_PROJECT)],
  });
  const entry = { label, applied };
  const st = stackFor(projectId);
  if (history === 'push') {
    st.undo.push(entry);
    st.undo = st.undo.slice(-100);
    st.redo = [];
  }
  return entry;
}

export function applyOps(projectId: string, inputs: OpInput[], label: string): boolean {
  if (!inputs.length) return true;
  return !!run(projectId, inputs, label, 'push');
}

export function undo(projectId: string) {
  const st = stackFor(projectId);
  const entry = st.undo.pop();
  if (!entry) return;
  const inverses = entry.applied
    .slice()
    .reverse()
    .map((a) => invertOp(a.op, a.prev));
  if (run(projectId, inverses, `Deshacer: ${entry.label}`, 'undo')) st.redo.push(entry);
  else st.undo.push(entry);
}

export function redo(projectId: string) {
  const st = stackFor(projectId);
  const entry = st.redo.pop();
  if (!entry) return;
  const again = run(
    projectId,
    entry.applied.map((a) => a.op),
    entry.label,
    'redo',
  );
  if (again) st.undo.push(again);
  else st.redo.push(entry);
}

// ---------- Proyectos ----------

export function createProject(opts: { name: string; business: string; template: 'transfer' | 'blank' | 'bancoNew'; withExampleStudy?: boolean }): string | undefined {
  const user = currentUser();
  if (!user) return undefined;
  const name = opts.name.trim() || (opts.template === 'bancoNew' ? 'Banco New' : 'Proyecto sin nombre');
  const project =
    opts.template === 'transfer' ? transferProject(user.id, name) : opts.template === 'bancoNew' ? bancoNewProject(user.id, name) : blankProject(user.id, name, opts.business.trim());
  if (opts.business.trim()) project.business = opts.business.trim();
  let next: DB = {
    ...db,
    projects: [...db.projects, project],
    memberships: [...db.memberships, { id: uid('m_'), subjectType: 'project', subjectId: project.id, email: user.email, role: 'owner' }],
    versions: [
      ...db.versions,
      { id: uid('v_'), projectId: project.id, label: 'Punto de partida', snapshot: clone(project), createdBy: user.id, createdAt: Date.now() },
    ],
  };
  // Sin sesiones ni métricas inventadas: el estudio de ejemplo solo se crea si se pide.
  if (opts.withExampleStudy) {
    const ex = exampleStudy(project, user.id);
    next = { ...next, studies: [...next.studies, ex.study], sessions: [...next.sessions, ...ex.sessions], events: [...next.events, ...ex.events] };
  }
  commit(next);
  return project.id;
}

export function renameProject(projectId: string, name: string) {
  applyOps(projectId, [edit.project('name', name)], 'Renombrar proyecto');
}

export function deleteProject(projectId: string): boolean {
  const g = guard(projectId, 'delete');
  if (!g) return false;
  const studyIds = new Set(db.studies.filter((s) => s.projectId === projectId).map((s) => s.id));
  const sessionIds = new Set(db.sessions.filter((s) => studyIds.has(s.studyId)).map((s) => s.id));
  sessionIds.forEach((id) => void deleteAudio(id));
  commit({
    ...db,
    projects: db.projects.filter((p) => p.id !== projectId),
    ops: db.ops.filter((o) => o.projectId !== projectId),
    versions: db.versions.filter((v) => v.projectId !== projectId),
    memberships: db.memberships.filter((m) => m.subjectId !== projectId),
    comments: db.comments.filter((c) => c.projectId !== projectId),
    studies: db.studies.filter((s) => !studyIds.has(s.id)),
    sessions: db.sessions.filter((s) => !sessionIds.has(s.id)),
    events: db.events.filter((e) => !sessionIds.has(e.sessionId)),
  });
  stacks.delete(projectId);
  notify(`Eliminaste «${g.project.name}».`, 'success');
  return true;
}

// ---------- Versiones con nombre ----------

export function saveVersion(projectId: string, label: string, silent = false): boolean {
  const g = guard(projectId, 'publish');
  if (!g) return false;
  const clean = label.trim();
  if (!clean) {
    notify('Ponle un nombre a la versión.', 'error');
    return false;
  }
  commit({
    ...db,
    versions: [...db.versions, { id: uid('v_'), projectId, label: clean, snapshot: clone(g.project), createdBy: g.user.id, createdAt: Date.now() }],
  });
  if (!silent) notify(`Guardaste la versión «${clean}».`, 'success');
  return true;
}

export function restoreVersion(versionId: string): boolean {
  const v = db.versions.find((x) => x.id === versionId);
  if (!v) return false;
  const g = guard(v.projectId, 'edit');
  if (!g) return false;
  if (!saveVersion(v.projectId, `Antes de restaurar «${v.label}»`, true)) return false;
  const snapshot: Project = { ...clone(v.snapshot), id: g.project.id, owner: g.project.owner, createdAt: g.project.createdAt };
  const ok = applyOps(v.projectId, [edit.replaceAll(snapshot)], `Restaurar «${v.label}»`);
  if (ok) notify(`Restauraste «${v.label}». La versión anterior quedó guardada en el historial.`, 'success');
  return ok;
}

// ---------- Personas y roles ----------

export function invite(projectId: string, email: string, role: Role): boolean {
  const g = guard(projectId, 'manageMembers');
  if (!g) return false;
  const clean = email.trim().toLowerCase();
  if (!EMAIL.test(clean)) {
    notify('Escribe un correo válido.', 'error');
    return false;
  }
  if (role === 'owner') {
    notify('Solo puede haber un dueño por proyecto.', 'error');
    return false;
  }
  const owner = db.users.find((u) => u.id === g.project.owner);
  if (owner?.email === clean) {
    notify('Esa persona ya es dueña del proyecto.', 'error');
    return false;
  }
  const existing = db.memberships.find((m) => m.subjectId === projectId && m.email === clean);
  commit({
    ...db,
    memberships: existing
      ? db.memberships.map((m) => (m.id === existing.id ? { ...m, role } : m))
      : [...db.memberships, { id: uid('m_'), subjectType: 'project', subjectId: projectId, email: clean, role }],
  });
  notify(existing ? `Actualizaste el rol de ${clean}.` : `Invitaste a ${clean} como ${ROLE_LABEL[role].toLowerCase()}.`, 'success');
  return true;
}

export function setMemberRole(membershipId: string, role: Role) {
  const m = db.memberships.find((x) => x.id === membershipId);
  if (!m || m.role === 'owner' || role === 'owner') return;
  if (!guard(m.subjectId, 'manageMembers')) return;
  commit({ ...db, memberships: db.memberships.map((x) => (x.id === membershipId ? { ...x, role } : x)) });
}

export function removeMember(membershipId: string) {
  const m = db.memberships.find((x) => x.id === membershipId);
  if (!m || m.role === 'owner') return;
  if (!guard(m.subjectId, 'manageMembers')) return;
  commit({ ...db, memberships: db.memberships.filter((x) => x.id !== membershipId) });
  notify(`Quitaste el acceso de ${m.email}.`, 'success');
}

// ---------- Comentarios anclados ----------

export function addComment(projectId: string, screenId: string, blockId: string | undefined, text: string): boolean {
  const g = guard(projectId, 'comment');
  if (!g || !text.trim()) return false;
  const mentions = [...text.matchAll(/@([\p{L}\p{N}._-]+)/gu)].map((m) => m[1].toLowerCase());
  const c: Comment = { id: uid('c_'), projectId, screenId, blockId, author: g.user.id, text: text.trim(), mentions, at: Date.now(), resolved: false };
  commit({ ...db, comments: [...db.comments, c] });
  return true;
}

export function resolveComment(id: string, resolved: boolean) {
  const c = db.comments.find((x) => x.id === id);
  if (!c || !guard(c.projectId, 'comment')) return;
  commit({ ...db, comments: db.comments.map((x) => (x.id === id ? { ...x, resolved } : x)) });
}

// ---------- Estudios ----------

export function createStudy(projectId: string, input: { name: string; tasks: Omit<StudyTask, 'id'>[]; askAudio: boolean }): string | undefined {
  const g = guard(projectId, 'runStudy');
  if (!g) return undefined;
  if (!input.name.trim()) {
    notify('Ponle un nombre al estudio.', 'error');
    return undefined;
  }
  if (!input.tasks.length || input.tasks.some((t) => !t.prompt.trim())) {
    notify('Cada tarea necesita una instrucción.', 'error');
    return undefined;
  }
  const ids = new Set(g.project.screens.map((s) => s.id));
  if (input.tasks.some((t) => !ids.has(t.startScreenId) || !ids.has(t.successScreenId) || t.startScreenId === t.successScreenId)) {
    notify('Cada tarea necesita una pantalla de inicio y una de éxito distintas.', 'error');
    return undefined;
  }
  const issues = checkProject(g.project);
  if (hasBlockingErrors(issues)) {
    notify('Corrige los errores críticos del guardarraíl antes de publicar un estudio.', 'error');
    return undefined;
  }
  const study: Study = {
    id: uid('st_'),
    projectId,
    name: input.name.trim(),
    tasks: input.tasks.map((t) => ({ ...t, id: uid('t_'), prompt: t.prompt.trim() })),
    snapshot: clone(g.project),
    askAudio: input.askAudio,
    owner: g.user.id,
    status: 'open',
    created: Date.now(),
  };
  commit({ ...db, studies: [...db.studies, study] });
  notify(`Publicaste «${study.name}» sobre una copia congelada del proyecto (v${g.project.version}).`, 'success');
  return study.id;
}

export function setStudyStatus(studyId: string, status: Study['status']) {
  const s = db.studies.find((x) => x.id === studyId);
  if (!s || !guard(s.projectId, 'runStudy')) return;
  commit({ ...db, studies: db.studies.map((x) => (x.id === studyId ? { ...x, status } : x)) });
  notify(status === 'closed' ? 'Cerraste el estudio. El enlace deja de aceptar sesiones.' : 'Reabriste el estudio.', 'success');
}

export function deleteStudy(studyId: string) {
  const s = db.studies.find((x) => x.id === studyId);
  if (!s || !guard(s.projectId, 'runStudy')) return;
  const sessionIds = new Set(db.sessions.filter((x) => x.studyId === studyId).map((x) => x.id));
  sessionIds.forEach((id) => void deleteAudio(id));
  commit({
    ...db,
    studies: db.studies.filter((x) => x.id !== studyId),
    sessions: db.sessions.filter((x) => !sessionIds.has(x.id)),
    events: db.events.filter((e) => !sessionIds.has(e.sessionId)),
  });
  notify(`Eliminaste «${s.name}» y sus resultados.`, 'success');
}

/** Guarda una sesión (enlace público: no requiere cuenta). */
export function saveSession(session: Session, events: StudyEvent[]) {
  if (!db.studies.some((s) => s.id === session.studyId)) return false;
  commit({
    ...db,
    sessions: [...db.sessions.filter((s) => s.id !== session.id), session],
    events: [...db.events.filter((e) => e.sessionId !== session.id), ...events],
  });
  return true;
}

export function importResults(text: string): number {
  let data: { kind?: string; studyId?: string; sessions?: Session[]; events?: StudyEvent[] };
  try {
    data = JSON.parse(text);
  } catch {
    notify('El archivo no es un JSON válido.', 'error');
    return 0;
  }
  if (data.kind !== 'forma-results' || !Array.isArray(data.sessions) || !Array.isArray(data.events)) {
    notify('El archivo no contiene resultados de Forma.', 'error');
    return 0;
  }
  const study = db.studies.find((s) => s.id === data.studyId);
  if (!study) {
    notify('Estos resultados pertenecen a un estudio que no está en este espacio de trabajo.', 'error');
    return 0;
  }
  const known = new Set(db.sessions.map((s) => s.id));
  const fresh = data.sessions.filter((s) => s.studyId === study.id && !known.has(s.id)).map((s) => ({ ...s, source: 'import' as const }));
  const freshIds = new Set(fresh.map((s) => s.id));
  const count = db.sessions.filter((s) => s.studyId === study.id).length;
  fresh.forEach((s, i) => (s.participant = `P${count + i + 1}`));
  commit({ ...db, sessions: [...db.sessions, ...fresh], events: [...db.events, ...data.events.filter((e) => freshIds.has(e.sessionId))] });
  notify(fresh.length ? `Importaste ${fresh.length} ${fresh.length === 1 ? 'sesión' : 'sesiones'}.` : 'Esas sesiones ya estaban importadas.', fresh.length ? 'success' : 'info');
  return fresh.length;
}

export function nextParticipant(studyId: string) {
  return `P${db.sessions.filter((s) => s.studyId === studyId).length + 1}`;
}

// ---------- Biblioteca versionada ----------

const bump = (v: string, kind: 'major' | 'minor' | 'patch') => {
  const [a, b, c] = v.split('.').map(Number);
  if (kind === 'major') return `${a + 1}.0.0`;
  if (kind === 'minor') return `${a}.${b + 1}.0`;
  return `${a}.${b}.${c + 1}`;
};

export const releasesFor = (d: DB, libraryId: string) =>
  d.releases.filter((r) => r.libraryId === libraryId).sort((a, b) => b.publishedAt - a.publishedAt);

export function publishRelease(projectId: string, kind: 'major' | 'minor' | 'patch', notes: string): boolean {
  const g = guard(projectId, 'publish');
  if (!g) return false;
  const last = releasesFor(db, projectId)[0];
  const version = last ? bump(last.version, kind) : '1.0.0';
  const release: LibraryRelease = {
    id: uid('r_'),
    libraryId: projectId,
    version,
    notes: notes.trim(),
    snapshot: { tokens: clone(g.project.tokens), components: clone(g.project.components) },
    publishedBy: g.user.id,
    publishedAt: Date.now(),
  };
  commit({ ...db, releases: [...db.releases, release] });
  notify(`Publicaste la biblioteca v${version}.`, 'success');
  return true;
}

export function adoptRelease(projectId: string, releaseId: string): boolean {
  const r = db.releases.find((x) => x.id === releaseId);
  const p = db.projects.find((x) => x.id === projectId);
  if (!r || !p) return false;
  const releaseIds = new Set(r.snapshot.components.map((c) => c.id));
  const components = [...clone(r.snapshot.components), ...p.components.filter((c) => !releaseIds.has(c.id))];
  const ok = applyOps(
    projectId,
    [
      edit.project('tokens', clone(r.snapshot.tokens)),
      edit.project('components', components),
      edit.project('library', { releaseId: r.id, version: r.version, sourceProjectId: r.libraryId }),
    ],
    `Usar biblioteca v${r.version}`,
  );
  if (ok) notify(`El proyecto ahora usa la biblioteca v${r.version}.`, 'success');
  return ok;
}

// ---------- Respaldo ----------

export const exportWorkspace = () => JSON.stringify(db, null, 2);

export function importWorkspace(text: string): boolean {
  try {
    const d = JSON.parse(text);
    if (d?.schema !== 1 || !Array.isArray(d.projects)) throw new Error();
    commit({ ...emptyDb(), ...d, currentUserId: db.currentUserId && d.users?.some((u: User) => u.id === db.currentUserId) ? db.currentUserId : d.currentUserId });
    stacks.clear();
    notify('Restauraste el respaldo del espacio de trabajo.', 'success');
    return true;
  } catch {
    notify('El archivo no es un respaldo válido de Forma.', 'error');
    return false;
  }
}

export function resetWorkspace() {
  commit(emptyDb());
  stacks.clear();
  flush();
}
