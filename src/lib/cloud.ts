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
