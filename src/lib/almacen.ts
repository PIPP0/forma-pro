// Dónde vive tu espacio de trabajo en este navegador.
//
// Empezó en localStorage, que es cómodo —se lee de golpe, sin esperar— pero tiene un techo bajo:
// unos 5 MB por sitio, y contando cada carácter como dos bytes. Un proyecto con sus pantallas de
// Figma dentro y unos cuantos sonidos propios lo llena, y cuando se llena el navegador no guarda
// nada más: el trabajo sigue en pantalla y desaparece al recargar.
//
// Por eso el espacio completo vive en IndexedDB, que admite cientos de MB. localStorage queda como
// lo que siempre fue bueno: un caché para pintar la primera pantalla sin esperar a nadie.
const DB_NAME = 'formapro-estado';
const STORE = 'espacio';
const CLAVE = 'db';

let conn: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  conn ??= new Promise<IDBDatabase>((listo, falla) => {
    if (typeof indexedDB === 'undefined') return falla(new Error('IndexedDB no disponible'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => listo(req.result);
    req.onerror = () => falla(req.error);
  }).catch((e) => {
    conn = undefined;
    throw e;
  });
  return conn;
}

function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (d) =>
      new Promise<T>((listo, falla) => {
        const req = fn(d.transaction(STORE, modo).objectStore(STORE));
        req.onsuccess = () => listo(req.result);
        req.onerror = () => falla(req.error);
      }),
  );
}

/**
 * Guarda el espacio completo. Se pasa el objeto tal cual: IndexedDB lo clona por su cuenta, sin
 * convertirlo a texto, así que no hay copia intermedia de varios MB en memoria.
 */
export const guardarEstado = (db: unknown) => tx('readwrite', (s) => s.put(db, CLAVE));

export const leerEstado = <T>() => tx<T | undefined>('readonly', (s) => s.get(CLAVE) as IDBRequest<T | undefined>);

export const olvidarEstado = () => tx('readwrite', (s) => s.delete(CLAVE));

/** Cuánto ocupa tu espacio y cuánto te permite este navegador. Sirve para avisar antes del tope. */
export async function espacioUsado(): Promise<{ usado: number; disponible: number } | undefined> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e || e.usage === undefined || !e.quota) return undefined;
    return { usado: e.usage, disponible: e.quota };
  } catch {
    return undefined;
  }
}
