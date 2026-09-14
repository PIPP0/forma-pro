import { describe, expect, it } from 'vitest';
import { __resetForTests, getDb, mergeCloudSessions } from './store';
import { transferProject } from './seed';
import { emptyDb, type Session, type Study, type StudyEvent } from './model';

const study: Study = { id: 'st1', projectId: 'p1', name: 'Estudio', tasks: [], snapshot: transferProject('u1'), askAudio: true, owner: 'u1', status: 'open', created: 0, cloud: true };

const session = (id: string, startedAt: number, patch: Partial<Session> = {}): Session => ({
  id,
  studyId: 'st1',
  participant: 'P',
  device: { breakpoint: 'mobile', width: 390, height: 844 },
  consent: { participate: true, audio: true, at: startedAt },
  feedback: [],
  status: 'in_progress',
  source: 'local',
  startedAt,
  ...patch,
});
const event = (sessionId: string, elapsed: number): StudyEvent => ({ id: `ev-${sessionId}-${elapsed}`, sessionId, taskId: 't1', screen: 's1', kind: 'tap', x: 0, y: 0, elapsed });

describe('sesiones que llegan desde la nube', () => {
  it('agrega las nuevas en orden de inicio y actualiza las que avanzaron', () => {
    __resetForTests({ ...emptyDb(), studies: [study] });
    const fresh = mergeCloudSessions('st1', [
      { session: session('b', 200), events: [event('b', 1)], updatedAt: 10 },
      { session: session('a', 100), events: [event('a', 1)], updatedAt: 10 },
    ]);
    expect(fresh).toBe(2);
    const byId = (id: string) => getDb().sessions.find((s) => s.id === id)!;
    expect(byId('a').participant).toBe('P1');
    expect(byId('b').participant).toBe('P2');
    expect(byId('a').source).toBe('cloud');

    // La sesión «a» terminó: se actualiza sin cambiar su número ni duplicar eventos.
    const again = mergeCloudSessions('st1', [{ session: session('a', 100, { status: 'completed', hasAudio: true }), events: [event('a', 1), event('a', 2)], updatedAt: 20 }]);
    expect(again).toBe(0);
    expect(byId('a')).toMatchObject({ participant: 'P1', status: 'completed', hasAudio: true, cloudUpdatedAt: 20 });
    expect(getDb().events.filter((e) => e.sessionId === 'a')).toHaveLength(2);
    expect(getDb().sessions).toHaveLength(2);

    // Una versión más antigua no pisa la más reciente.
    mergeCloudSessions('st1', [{ session: session('a', 100), events: [], updatedAt: 15 }]);
    expect(byId('a').status).toBe('completed');
  });

  it('no pisa sesiones importadas o hechas en este navegador, ni de otros estudios', () => {
    __resetForTests({ ...emptyDb(), studies: [study], sessions: [session('x', 50, { source: 'import', participant: 'P1', status: 'completed' })] });
    const fresh = mergeCloudSessions('st1', [
      { session: session('x', 50), events: [], updatedAt: 99 },
      { session: session('y', 60, { studyId: 'otro' }), events: [], updatedAt: 99 },
    ]);
    expect(fresh).toBe(0);
    expect(getDb().sessions).toHaveLength(1);
    expect(getDb().sessions[0]).toMatchObject({ source: 'import', status: 'completed' });
  });
});
