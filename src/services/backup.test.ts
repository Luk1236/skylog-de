import { describe, it, expect } from 'vitest';
import { importBackup, BACKUP_VERSION } from './backup';

// importBackup prüft die Datei, bevor es die Datenbank anfasst. Diese
// Schutzwälle lassen sich deshalb ohne IndexedDB testen — sie werfen, bevor
// dbService überhaupt aufgerufen wird.
function datei(inhalt: string): File {
  return new Blob([inhalt], { type: 'application/json' }) as File;
}

describe('importBackup — Schutzwälle', () => {
  it('weist eine Datei ab, die gar kein JSON ist', async () => {
    await expect(importBackup(datei('das ist ein Foto'))).rejects.toThrow(/kein JSON/);
  });

  it('weist fremde JSON-Dateien ab', async () => {
    const fremd = JSON.stringify({ app: 'IrgendeineAndereApp', drones: [] });
    await expect(importBackup(datei(fremd))).rejects.toThrow(/keine SkyLog-DE-Sicherungsdatei/);
  });

  it('weist eine Sicherung ohne Drohnen-Liste ab', async () => {
    const kaputt = JSON.stringify({ app: 'SkyLog DE', version: BACKUP_VERSION });
    await expect(importBackup(datei(kaputt))).rejects.toThrow(/keine SkyLog-DE-Sicherungsdatei/);
  });

  it('weist eine Sicherung aus einer neueren App-Version ab', async () => {
    const zuNeu = JSON.stringify({
      app: 'SkyLog DE',
      version: BACKUP_VERSION + 1,
      drones: [],
    });
    await expect(importBackup(datei(zuNeu))).rejects.toThrow(/neueren SkyLog-Version/);
  });
});
