import { describe, expect, it } from 'vitest';
import { audioToBlob, blobToAudio, isAudioPayload, megabytes, resultsFile, studyLink } from './share';
import { transferProject } from './seed';
import type { Study } from './model';

describe('enlace del estudio', () => {
  it('es corto cuando la copia está en la nube y largo sin ella', async () => {
    const g = globalThis as { location?: unknown };
    const prev = g.location;
    g.location = { origin: 'https://pipp0.github.io', pathname: '/forma-pro/' };
    try {
      const study: Study = { id: 'st_1', projectId: 'p1', name: 'Estudio', tasks: [], snapshot: transferProject('u1'), askAudio: false, owner: 'u1', status: 'open', created: 0 };
      expect(await studyLink({ ...study, cloud: true, shortLink: true })).toBe('https://pipp0.github.io/forma-pro/#/t/st_1');
      const long = await studyLink(study);
      expect(long.startsWith('https://pipp0.github.io/forma-pro/#/t/st_1?d=')).toBe(true);
      expect(long.length).toBeGreaterThan(1000);
      // Conectado pero sin copia publicada todavía: sigue el enlace largo que funciona.
      expect((await studyLink({ ...study, cloud: true })).includes('?d=')).toBe(true);
    } finally {
      g.location = prev;
    }
  });
});

describe('audio en el archivo de resultados', () => {
  it('la grabación viaja y vuelve byte a byte', async () => {
    const bytes = new Uint8Array(70000).map((_, i) => (i * 31) % 256);
    const payload = await blobToAudio(new Blob([bytes], { type: 'audio/webm;codecs=opus' }));
    expect(isAudioPayload(payload)).toBe(true);
    const back = audioToBlob(payload);
    expect(back.type).toBe('audio/webm;codecs=opus');
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(bytes);
  });

  it('el archivo incluye el audio solo si hay grabaciones', async () => {
    const audio = { se_1: await blobToAudio(new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mp4' })) };
    expect(JSON.parse(resultsFile('st_1', [], [], audio)).audio.se_1.type).toBe('audio/mp4');
    expect(JSON.parse(resultsFile('st_1', [], [], {})).audio).toBeUndefined();
    expect(JSON.parse(resultsFile('st_1', [], [])).audio).toBeUndefined();
  });

  it('rechaza audio inválido y formatea tamaños', () => {
    expect(isAudioPayload({ type: 'text/plain', data: 'AAAA' })).toBe(false);
    expect(isAudioPayload({ type: 'audio/webm', data: '' })).toBe(false);
    expect(isAudioPayload(undefined)).toBe(false);
    expect(megabytes(1048576 * 2.5)).toBe('2,5 MB');
  });
});
