import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// El bug real: si sincronizarEspacio() se cuelga (una promesa que nunca resuelve ni rechaza),
// «Sincronizando…» se quedaba así para siempre y nadie podía volver a intentarlo. Este archivo
// prueba justo ese caso límite, con temporizadores falsos para no esperar 20 s de verdad.

vi.mock('../lib/sync', () => ({
  sincronizarEspacio: vi.fn(),
  escucharBorrados: vi.fn(),
}));

describe('sincronizarAhora ante un cuelgue', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('no se queda pegado en "sincronizando": a los 20 s se da por vencido y queda libre para reintentar', async () => {
    const { sincronizarEspacio } = await import('../lib/sync');
    vi.mocked(sincronizarEspacio).mockReturnValue(new Promise(() => {})); // nunca resuelve
    const { sincronizarAhora, useEstadoSync } = await import('./useSync');

    const p = sincronizarAhora();
    await vi.advanceTimersByTimeAsync(20_000);
    const r = await p;

    expect(r.error).toBeTruthy();
    // Ya no debería quedar «en curso»: una llamada nueva vuelve a intentarlo, no reutiliza la colgada.
    vi.mocked(sincronizarEspacio).mockResolvedValue({ subidos: 0, bajados: 0, borrados: 0, conflictos: [] });
    const r2 = await sincronizarAhora();
    expect(r2.error).toBeUndefined();
    void useEstadoSync;
  });

  it('si termina antes del límite, usa el resultado real tal cual', async () => {
    const { sincronizarEspacio } = await import('../lib/sync');
    vi.mocked(sincronizarEspacio).mockResolvedValue({ subidos: 2, bajados: 1, borrados: 0, conflictos: [] });
    const { sincronizarAhora } = await import('./useSync');

    const r = await sincronizarAhora();
    expect(r).toEqual({ subidos: 2, bajados: 1, borrados: 0, conflictos: [] });
  });
});
