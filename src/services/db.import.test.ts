import { afterEach, describe, expect, it, vi } from 'vitest';

// importAllData ohne echte IndexedDB: Die nachgebaute Transaktion verhält sich
// in dem Punkt wie die echte, auf den es ankommt - put() wirft SOFORT, wenn der
// Schlüssel fehlt, und ohne abort() wird trotzdem festgeschrieben.
const protokoll = vi.hoisted(() => ({ schritte: [] as string[] }));

vi.mock('idb', () => ({
  openDB: async () => ({
    transaction: () => {
      let abgebrochen = false;
      const done = new Promise<void>((fertig, fehlgeschlagen) => {
        setTimeout(() => {
          if (abgebrochen) fehlgeschlagen(new DOMException('Transaktion abgebrochen', 'AbortError'));
          else { protokoll.schritte.push('festgeschrieben'); fertig(); }
        }, 0);
      });
      return {
        done,
        abort: () => { abgebrochen = true; protokoll.schritte.push('abgebrochen'); },
        objectStore: (name: string) => ({
          clear: () => { protokoll.schritte.push(`geleert ${name}`); return Promise.resolve(); },
          put: (wert: { id?: unknown } | null) => {
            if (!wert || wert.id == null) throw new DOMException('Key path did not yield a value.', 'DataError');
            protokoll.schritte.push(`geschrieben ${name}`);
            return Promise.resolve();
          },
        }),
      };
    },
  }),
}));

const { dbService } = await import('./db');

const leer = { drones: [], flights: [], batteries: [], maintenance: [], pilots: [], profile: null, documents: [] };

afterEach(() => { protokoll.schritte = []; });

describe('importAllData', () => {
  it('rollt beim Ersetzen alles zurück, wenn ein Eintrag unbrauchbar ist', async () => {
    const kaputt = { ...leer, drones: [{ id: 'd1' }], flights: [{ id: 'f1' }, { date: '2026-10-21' }] } as never;
    await expect(dbService.importAllData(kaputt, 'replace')).rejects.toThrow(/Key path/);
    expect(protokoll.schritte).toContain('geleert flights');
    expect(protokoll.schritte).toContain('abgebrochen');
    expect(protokoll.schritte).not.toContain('festgeschrieben');
  });

  it('schreibt heile Daten fest', async () => {
    await dbService.importAllData({ ...leer, drones: [{ id: 'd1' }] } as never, 'replace');
    expect(protokoll.schritte).toContain('geschrieben drones');
    expect(protokoll.schritte.at(-1)).toBe('festgeschrieben');
    expect(protokoll.schritte).not.toContain('abgebrochen');
  });
});
