// Grabaciones de audio en IndexedDB (localStorage no admite archivos binarios).

const DB_NAME = 'formapro-blobs';
const STORE = 'audio';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB no disponible'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
