// Grabaciones de audio en IndexedDB (localStorage no admite archivos binarios).
import type { Session, StudyEvent } from './model';

const DB_NAME = 'formapro-blobs';
const STORE = 'audio';

let conn: Promise<IDBDatabase> | undefined;

// Una sola conexión: las transacciones se crean en el mismo orden en que se piden (los trozos no se desordenan).
function open(): Promise<IDBDatabase> {
  conn ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB no disponible'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((e) => {
    conn = undefined;
    throw e;
  });
  return conn;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await open();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const saveAudio = (sessionId: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, sessionId));
export const getAudio = (sessionId: string) => tx<Blob | undefined>('readonly', (s) => s.get(sessionId) as IDBRequest<Blob | undefined>);
export const deleteAudio = async (sessionId: string) => {
  try {
    await tx('readwrite', (s) => s.delete(sessionId));
  } catch {
    /* sin grabación */
  }
};

// ---------- Prueba en curso ----------
// Mientras la persona participa se guarda su avance y cada trozo de audio (1 s). Si cierra la pestaña,
// al volver a abrir el enlace puede enviar o guardar lo que alcanzó: los trozos se unen en una sola grabación.

export interface SessionDraft {
  session: Session;
  events: StudyEvent[];
  mimeType?: string;
  chunks: number;
  /** Trozos de audio que ya subieron a la nube (para borrarlos al subir la grabación completa). */
  cloudParts?: number;
  savedAt: number;
}

const draftKey = (studyId: string) => `draft:${studyId}`;
const chunkRange = (sessionId: string) => IDBKeyRange.bound(`chunk:${sessionId}:`, `chunk:${sessionId}:￿`);

export const saveDraft = (studyId: string, draft: SessionDraft) => tx('readwrite', (s) => s.put(draft, draftKey(studyId)));

export const saveDraftChunk = (sessionId: string, index: number, blob: Blob) => tx('readwrite', (s) => s.put(blob, `chunk:${sessionId}:${String(index).padStart(6, '0')}`));

export async function loadDraft(studyId: string): Promise<{ draft: SessionDraft; audio?: Blob } | undefined> {
  try {
    const draft = await tx<SessionDraft | undefined>('readonly', (s) => s.get(draftKey(studyId)) as IDBRequest<SessionDraft | undefined>);
    if (!draft?.session) return undefined;
    const parts = await tx<Blob[]>('readonly', (s) => s.getAll(chunkRange(draft.session.id)) as IDBRequest<Blob[]>);
    return { draft, audio: parts.length ? new Blob(parts, { type: draft.mimeType || parts[0].type }) : undefined };
  } catch {
    return undefined;
  }
}

export async function clearDraft(studyId: string, sessionId: string) {
  try {
    await tx('readwrite', (s) => s.delete(draftKey(studyId)));
    await tx('readwrite', (s) => s.delete(chunkRange(sessionId)));
  } catch {
    /* sin avance guardado */
  }
}
