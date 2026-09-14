import type { Session, Study, StudyEvent } from './model';

// Enlace público sin servidor: el estudio congelado viaja comprimido en el propio enlace.

const toB64 = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

const toB64Url = (bytes: Uint8Array) => toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromB64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function pipe(data: BlobPart, stream: CompressionStream | DecompressionStream) {
  return new Response(new Blob([data]).stream().pipeThrough(stream)).arrayBuffer();
}

export type SharedStudy = Pick<Study, 'id' | 'name' | 'tasks' | 'snapshot' | 'askAudio' | 'status' | 'cloud'>;

export async function encodeStudy(study: Study): Promise<string> {
  const payload: SharedStudy = {
    id: study.id,
    name: study.name,
    tasks: study.tasks,
    snapshot: study.snapshot,
    askAudio: study.askAudio,
    status: study.status,
    ...(study.cloud ? { cloud: true } : {}),
  };
  const buf = await pipe(JSON.stringify({ v: 1, study: payload }), new CompressionStream('deflate-raw'));
  return toB64Url(new Uint8Array(buf));
}

export async function decodeStudy(data: string): Promise<SharedStudy> {
  const buf = await pipe(fromB64Url(data) as BlobPart, new DecompressionStream('deflate-raw'));
  const parsed = JSON.parse(new TextDecoder().decode(buf));
  if (parsed?.v !== 1 || !parsed.study?.snapshot) throw new Error('Enlace de estudio inválido');
  return parsed.study as SharedStudy;
}

export async function studyLink(study: Study): Promise<string> {
  const base = `${location.origin}${location.pathname}`;
  // En la nube, la copia congelada se descarga al abrir: el enlace solo lleva el id.
  if (study.cloud && study.shortLink) return `${base}#/t/${study.id}`;
  return `${base}#/t/${study.id}?d=${await encodeStudy(study)}`;
}

// Grabaciones dentro del archivo de resultados: el audio (ya comprimido por el navegador) viaja en base64 por sesión.

export interface AudioPayload {
  type: string;
  data: string;
}
export type AudioMap = Record<string, AudioPayload>;

export async function blobToAudio(blob: Blob): Promise<AudioPayload> {
  return { type: blob.type || 'audio/webm', data: toB64(new Uint8Array(await blob.arrayBuffer())) };
}

export function audioToBlob(a: AudioPayload): Blob {
  return new Blob([fromB64Url(a.data) as BlobPart], { type: a.type });
}

export const isAudioPayload = (a: unknown): a is AudioPayload =>
  !!a && typeof (a as AudioPayload).data === 'string' && (a as AudioPayload).data.length > 0 && typeof (a as AudioPayload).type === 'string' && (a as AudioPayload).type.startsWith('audio/');

/** Tamaño aproximado en MB de un texto o archivo, para avisar antes de enviarlo. */
export const megabytes = (bytes: number) => `${String(Math.max(0.1, Math.round(bytes / 104857.6) / 10)).replace('.', ',')} MB`;

export function resultsFile(studyId: string, sessions: Session[], events: StudyEvent[], audio?: AudioMap) {
  const withAudio = audio && Object.keys(audio).length ? { audio } : {};
  return JSON.stringify({ kind: 'forma-results', v: 1, studyId, exportedAt: new Date().toISOString(), sessions, events, ...withAudio }, null, 2);
}

export function download(filename: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows: (string | number | undefined | null)[][]) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = c == null ? '' : String(c);
          return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\n');
}
