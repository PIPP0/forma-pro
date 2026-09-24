// Resultados de pruebas en la nube (Firebase: Auth, Firestore y Storage).
// Se carga bajo demanda: quien nunca conecta la nube no descarga el SDK.
//
// studies/{studyId}                         dueño, nombre y estado del estudio (lo escribe quien diseña)
// studies/{studyId}/sessions/{sessionId}    sesión y eventos (lo escribe la persona participante, anónima)
// Storage studies/{studyId}/sessions/{sessionId}/parts/{n} y /audio   grabación por trozos y completa
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore/lite';
import type { FirebaseStorage } from 'firebase/storage';
import { FIREBASE_CONFIG } from './cloudConfig';
import type { Session, Study, StudyEvent } from './model';
import { encodeStudy } from './share';

interface Cloud {
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  fa: typeof import('firebase/auth');
  fs: typeof import('firebase/firestore/lite');
  st: typeof import('firebase/storage');
}

let loading: Promise<Cloud> | undefined;

function cloud(): Promise<Cloud> {
  loading ??= (async () => {
    const [app, fa, fs, st] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore/lite'), import('firebase/storage')]);
    const fbApp = app.initializeApp(FIREBASE_CONFIG);
    const auth = fa.getAuth(fbApp);
    await auth.authStateReady();
    return { auth, db: fs.getFirestore(fbApp), storage: st.getStorage(fbApp), fa, fs, st };
  })().catch((e) => {
    loading = undefined;
    throw e;
  });
  return loading;
}

// ---------- Cuenta de quien diseña (enlace de acceso por correo) ----------

export interface CloudAccount {
  uid: string;
  /** null: cuenta anónima de este navegador (sin correo guardado). */
  email: string | null;
}

const EMAIL_KEY = 'formapro.cloud.email';

const readLocal = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeLocal = (k: string, v: string | null) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* almacenamiento no disponible */
  }
};

/** Cuenta en la nube de este navegador. Si no hay, se crea una anónima: los estudios quedan a su nombre. */
export async function ensureCloudAccount(): Promise<CloudAccount> {
  const c = await cloud();
  if (!c.auth.currentUser) await c.fa.signInAnonymously(c.auth);
  const u = c.auth.currentUser!;
  return { uid: u.uid, email: u.isAnonymous ? null : u.email };
}

/** Envía el enlace de acceso. Al abrirlo en este navegador, la nube queda conectada. */
/**
 * Entrar con correo y contraseña. Si el correo no existe todavía, crea la cuenta con esa clave.
 * La cuenta anónima de este navegador se vincula para no perder los estudios ya publicados.
 */
export async function entrarConPassword(email: string, password: string): Promise<CloudAccount> {
  // Se valida antes de llamar: con una clave corta, Firebase responde «credencial inválida» y el
  // mensaje que llegaría a la pantalla diría algo que no es.
  if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
  const c = await cloud();
  const correo = email.trim().toLowerCase();
  const actual = c.auth.currentUser;
  const credencial = c.fa.EmailAuthProvider.credential(correo, password);

  const entrar = async () => (await c.fa.signInWithEmailAndPassword(c.auth, correo, password)).user;

  try {
    let user;
    if (actual?.isAnonymous) {
      try {
        user = (await c.fa.linkWithCredential(actual, credencial)).user;
      } catch (e) {
        const code = (e as { code?: string }).code;
        // El correo ya tenía cuenta (otro equipo, o esta misma persona): se entra con ella.
        if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use') user = await entrar();
        else throw e;
      }
    } else {
      try {
        user = await entrar();
      } catch (e) {
        if ((e as { code?: string }).code === 'auth/user-not-found') user = (await c.fa.createUserWithEmailAndPassword(c.auth, correo, password)).user;
        else throw e;
      }
    }
    writeLocal(EMAIL_KEY, null);
    return { uid: user.uid, email: user.email ?? correo };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password')
      throw new Error('La contraseña no coincide. Si nunca le pusiste una a este correo, usa «Crear o recuperar contraseña».');
    if (code === 'auth/weak-password') throw new Error('La contraseña debe tener al menos 6 caracteres.');
    if (code === 'auth/invalid-email') throw new Error('Ese correo no tiene un formato válido.');
    if (code === 'auth/too-many-requests') throw new Error('Demasiados intentos seguidos. Espera un momento y vuelve a probar.');
    if (code === 'auth/network-request-failed') throw new Error('No hay conexión con la nube. Revisa tu red e inténtalo de nuevo.');
    throw new Error('No pudimos entrar con ese correo. Inténtalo de nuevo en un momento.');
  }
}

/** Para cuando alguien olvida su contraseña: llega un correo para ponerla de nuevo. */
export async function enviarCambioDePassword(email: string) {
  const c = await cloud();
  await c.fa.sendPasswordResetEmail(c.auth, email.trim().toLowerCase(), { url: `${location.origin}${location.pathname}` });
}

export async function sendAccessLink(email: string) {
  const c = await cloud();
  await c.fa.sendSignInLinkToEmail(c.auth, email, { url: `${location.origin}${location.pathname}`, handleCodeInApp: true });
  writeLocal(EMAIL_KEY, email);
}

export const isAccessLink = () => /[?&]oobCode=/.test(location.search) && /[?&]mode=signIn/.test(location.search);

export async function completeAccessLink(): Promise<CloudAccount> {
  const c = await cloud();
  if (!c.fa.isSignInWithEmailLink(c.auth, location.href)) throw new Error('El enlace de acceso no es válido o ya se usó. Pide uno nuevo desde Ajustes.');
  const email = readLocal(EMAIL_KEY);
  if (!email) throw new Error('Abre el enlace en el mismo navegador donde lo pediste, o pide uno nuevo desde Ajustes.');
  const current = c.auth.currentUser;
  let user;
  if (current?.isAnonymous) {
    // Se vincula el correo a la cuenta anónima: los estudios y resultados siguen siendo suyos.
    try {
      user = (await c.fa.linkWithCredential(current, c.fa.EmailAuthProvider.credentialWithLink(email, location.href))).user;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'auth/email-already-in-use' && code !== 'auth/credential-already-in-use') throw e;
      // El correo ya tenía acceso (por ejemplo, desde otro equipo): se entra con esa cuenta.
      user = (await c.fa.signInWithEmailLink(c.auth, email, location.href)).user;
    }
  } else {
    user = (await c.fa.signInWithEmailLink(c.auth, email, location.href)).user;
  }
  writeLocal(EMAIL_KEY, null);
  return { uid: user.uid, email: user.email ?? email };
}

/** Credencial de la sesión actual para llamar a las funciones del proyecto. Vacía si la cuenta es anónima. */
export async function idTokenConCorreo(): Promise<string | null> {
  const c = await cloud();
  const u = c.auth.currentUser;
  if (!u || u.isAnonymous || !u.email) return null;
  return u.getIdToken();
}

export async function disconnectCloud() {
  const c = await cloud();
  await c.fa.signOut(c.auth);
}

async function designer(): Promise<Cloud & { uid: string; email: string }> {
  const c = await cloud();
  if (!c.auth.currentUser) await c.fa.signInAnonymously(c.auth);
  const u = c.auth.currentUser!;
  return { ...c, uid: u.uid, email: u.isAnonymous ? '' : (u.email ?? '') };
}

// ---------- Estudios (quien diseña) ----------

/** Límite de un documento de Firestore (1 MiB), con margen. */
const MAX_PAYLOAD = 1_000_000;

export async function publishStudyToCloud(study: Study) {
  const c = await designer();
  const payload = await encodeStudy({ ...study, cloud: true });
  if (payload.length > MAX_PAYLOAD) throw new Error('El prototipo es demasiado grande para el enlace corto. Quita imágenes pesadas o sigue usando el enlace largo.');
  await c.fs.setDoc(c.fs.doc(c.db, 'studies', study.id), {
    ownerUid: c.uid,
    ownerEmail: c.email,
    name: study.name,
    status: study.status,
    askAudio: study.askAudio,
    created: study.created,
    updatedAt: Date.now(),
  });
  // Copia congelada que abre el enlace corto (se puede leer con el id, no se puede listar).
  await c.fs.setDoc(c.fs.doc(c.db, 'publicStudies', study.id), { ownerUid: c.uid, payload, status: study.status, updatedAt: Date.now() });
}

export async function setCloudStudyStatus(studyId: string, status: Study['status']) {
  const c = await designer();
  await c.fs.updateDoc(c.fs.doc(c.db, 'studies', studyId), { status, updatedAt: Date.now() });
  await c.fs.updateDoc(c.fs.doc(c.db, 'publicStudies', studyId), { status, updatedAt: Date.now() }).catch(() => undefined);
}

/** Copia congelada de un estudio con enlace corto. No requiere cuenta. */
export async function fetchSharedStudy(studyId: string): Promise<{ payload: string; status: Study['status'] } | null> {
  const c = await cloud();
  const snap = await c.fs.getDoc(c.fs.doc(c.db, 'publicStudies', studyId));
  if (!snap.exists()) return null;
  const x = snap.data();
  return { payload: String(x.payload), status: x.status === 'closed' ? 'closed' : 'open' };
}

export interface CloudSession {
  session: Session;
  events: StudyEvent[];
  updatedAt: number;
}

export async function fetchCloudSessions(studyId: string): Promise<CloudSession[]> {
  const c = await designer();
  const snap = await c.fs.getDocs(c.fs.collection(c.db, 'studies', studyId, 'sessions'));
  const out: CloudSession[] = [];
  for (const d of snap.docs) {
    const x = d.data();
    try {
      out.push({ session: { ...(JSON.parse(x.sessionJson) as Session), source: 'cloud' }, events: JSON.parse(x.eventsJson) as StudyEvent[], updatedAt: Number(x.updatedAt) || 0 });
    } catch {
      /* documento dañado: se omite */
    }
  }
  return out;
}

const sessionPath = (studyId: string, sessionId: string) => `studies/${studyId}/sessions/${sessionId}`;

const notFound = (e: unknown) => (e as { code?: string })?.code === 'storage/object-not-found';

/** Grabación de una sesión: la completa si terminó, o los trozos unidos si quedó a medias. */
export async function downloadCloudAudio(studyId: string, sessionId: string): Promise<{ blob: Blob; complete: boolean } | undefined> {
  const c = await designer();
  const base = sessionPath(studyId, sessionId);
  try {
    return { blob: await c.st.getBlob(c.st.ref(c.storage, `${base}/audio`)), complete: true };
  } catch (e) {
    if (!notFound(e)) throw e;
  }
  const list = await c.st.listAll(c.st.ref(c.storage, `${base}/parts`));
  if (!list.items.length) return undefined;
  const items = [...list.items].sort((a, b) => a.name.localeCompare(b.name));
  const parts = await Promise.all(items.map((i) => c.st.getBlob(i)));
  return { blob: new Blob(parts, { type: parts[0].type || 'audio/webm' }), complete: false };
}

/** Borra una sesión en la nube con su grabación, para que no vuelva al sincronizar. */
export async function deleteCloudSession(studyId: string, sessionId: string) {
  const c = await designer();
  const base = sessionPath(studyId, sessionId);
  const [parts, top] = await Promise.all([c.st.listAll(c.st.ref(c.storage, `${base}/parts`)).catch(() => undefined), c.st.listAll(c.st.ref(c.storage, base)).catch(() => undefined)]);
  await Promise.all([...(parts?.items ?? []), ...(top?.items ?? [])].map((i) => c.st.deleteObject(i).catch(() => undefined)));
  await c.fs.deleteDoc(c.fs.doc(c.db, 'studies', studyId, 'sessions', sessionId));
}

/** Borra el estudio en la nube con sus sesiones y grabaciones. */
export async function deleteCloudStudy(studyId: string) {
  const c = await designer();
  const snap = await c.fs.getDocs(c.fs.collection(c.db, 'studies', studyId, 'sessions'));
  for (const d of snap.docs) {
    const base = sessionPath(studyId, d.id);
    const [parts, top] = await Promise.all([c.st.listAll(c.st.ref(c.storage, `${base}/parts`)).catch(() => undefined), c.st.listAll(c.st.ref(c.storage, base)).catch(() => undefined)]);
    await Promise.all([...(parts?.items ?? []), ...(top?.items ?? [])].map((i) => c.st.deleteObject(i).catch(() => undefined)));
    await c.fs.deleteDoc(d.ref);
  }
  await c.fs.deleteDoc(c.fs.doc(c.db, 'publicStudies', studyId)).catch(() => undefined);
  await c.fs.deleteDoc(c.fs.doc(c.db, 'studies', studyId));
}

/** Imagen de una pantalla importada (Figma). Queda pública por enlace, como la copia del prototipo. */
export async function uploadPrototypeImage(projectId: string, name: string, blob: Blob): Promise<string> {
  const c = await designer();
  const ref = c.st.ref(c.storage, `prototypes/${c.uid}/${projectId}/${name}`);
  await c.st.uploadBytes(ref, blob, { contentType: blob.type || 'image/png' });
  return c.st.getDownloadURL(ref);
}

// ---------- Espacio de trabajo en la nube ----------
//
// El índice vive en Firestore (una lectura para saber qué hay y cuándo cambió) y el contenido
// en Storage (un archivo por proyecto o estudio, sin el tope de 1 MiB de un documento).

export interface EntradaEspacio {
  tipo: 'proyecto' | 'estudio';
  id: string;
  nombre: string;
  actualizado: number;
  /** Se borró en algún equipo: hay que quitarlo también en los demás. */
  borrado?: boolean;
}

const rutaEspacio = (uid: string, e: { tipo: string; id: string }) => `espacios/${uid}/${e.tipo}s/${e.id}.json`;

/** Qué hay en la nube y desde cuándo, sin descargar el contenido. */
export async function leerIndiceEspacio(): Promise<EntradaEspacio[]> {
  const c = await cloud();
  const u = c.auth.currentUser;
  if (!u || u.isAnonymous) return [];
  const snap = await c.fs.getDocs(c.fs.collection(c.db, 'espacios', u.uid, 'indice'));
  return snap.docs.map((d) => d.data() as EntradaEspacio);
}

/** Sube un proyecto o un estudio completo y deja su marca en el índice. */
export async function subirAlEspacio(entrada: EntradaEspacio, contenido: unknown) {
  const c = await cloud();
  const u = c.auth.currentUser;
  if (!u || u.isAnonymous) throw new Error('sin cuenta con correo');
  const ref = c.st.ref(c.storage, rutaEspacio(u.uid, entrada));
  await c.st.uploadBytes(ref, new Blob([JSON.stringify(contenido)], { type: 'application/json' }), { contentType: 'application/json' });
  await c.fs.setDoc(c.fs.doc(c.db, 'espacios', u.uid, 'indice', `${entrada.tipo}_${entrada.id}`), { ...entrada, borrado: false });
}

export async function bajarDelEspacio<T>(entrada: { tipo: 'proyecto' | 'estudio'; id: string }): Promise<T | undefined> {
  const c = await cloud();
  const u = c.auth.currentUser;
  if (!u || u.isAnonymous) return undefined;
  try {
    const url = await c.st.getDownloadURL(c.st.ref(c.storage, rutaEspacio(u.uid, entrada)));
    const r = await fetch(url);
    if (!r.ok) return undefined;
    return (await r.json()) as T;
  } catch {
    return undefined;
  }
}

/** Marca de borrado: sin ella, el otro equipo volvería a subir lo que acabas de eliminar. */
export async function borrarDelEspacio(entrada: { tipo: 'proyecto' | 'estudio'; id: string; nombre: string }) {
  const c = await cloud();
  const u = c.auth.currentUser;
  if (!u || u.isAnonymous) return;
  await c.st.deleteObject(c.st.ref(c.storage, rutaEspacio(u.uid, entrada))).catch(() => undefined);
  await c.fs.setDoc(c.fs.doc(c.db, 'espacios', u.uid, 'indice', `${entrada.tipo}_${entrada.id}`), { ...entrada, borrado: true, actualizado: Date.now() });
}

// ---------- Sesión en curso (persona participante, anónima) ----------

async function participant(): Promise<Cloud & { uid: string }> {
  const c = await cloud();
  if (!c.auth.currentUser) await c.fa.signInAnonymously(c.auth);
  return { ...c, uid: c.auth.currentUser!.uid };
}

export async function uploadSession(studyId: string, session: Session, events: StudyEvent[]) {
  const c = await participant();
  await c.fs.setDoc(c.fs.doc(c.db, 'studies', studyId, 'sessions', session.id), {
    participantUid: c.uid,
    sessionJson: JSON.stringify(session),
    eventsJson: JSON.stringify(events),
    updatedAt: Date.now(),
  });
}

export async function uploadAudioPart(studyId: string, sessionId: string, index: number, blob: Blob) {
  const c = await participant();
  await c.st.uploadBytes(c.st.ref(c.storage, `${sessionPath(studyId, sessionId)}/parts/${String(index).padStart(6, '0')}`), blob, { contentType: blob.type || 'audio/webm' });
}

/** Sube la grabación completa y borra los trozos que ya no hacen falta. */
export async function uploadFullAudio(studyId: string, sessionId: string, blob: Blob, partCount: number) {
  const c = await participant();
  const base = sessionPath(studyId, sessionId);
  await c.st.uploadBytes(c.st.ref(c.storage, `${base}/audio`), blob, { contentType: blob.type || 'audio/webm' });
  await Promise.all(
    Array.from({ length: partCount }, (_, i) => c.st.deleteObject(c.st.ref(c.storage, `${base}/parts/${String(i).padStart(6, '0')}`)).catch(() => undefined)),
  );
}
