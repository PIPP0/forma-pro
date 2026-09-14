import { describe, expect, it } from 'vitest';
import { audioToBlob, blobToAudio, isAudioPayload, megabytes, resultsFile } from './share';

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
