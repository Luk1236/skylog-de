import { describe, it, expect } from 'vitest';
import { importBackup, BACKUP_VERSION, ohneZugangsdaten } from './backup';
import type { UserProfile } from './db';

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

describe('ohneZugangsdaten', () => {
  const profil = {
    id: 'main_profile',
    name: 'Testpilot',
    eid: 'DEU-eID-test',
    licenseType: 'A2',
    insuranceNumber: 'V-123',
    notamClientId: 'geheime-id',
    notamClientSecret: 'geheimes-secret',
  } as UserProfile;

  it('entfernt die NOTAM-Zugangsdaten', () => {
    const sauber = ohneZugangsdaten(profil)!;
    expect(sauber.notamClientId).toBeUndefined();
    expect(sauber.notamClientSecret).toBeUndefined();
    // Nichts davon darf in irgendeiner Form uebrig bleiben
    expect(JSON.stringify(sauber)).not.toMatch(/geheim/);
  });

  it('laesst alle uebrigen Felder unangetastet', () => {
    const sauber = ohneZugangsdaten(profil)!;
    expect(sauber.name).toBe('Testpilot');
    expect(sauber.eid).toBe('DEU-eID-test');
    expect(sauber.insuranceNumber).toBe('V-123');
    expect(sauber.licenseType).toBe('A2');
  });

  it('kommt mit null zurecht', () => {
    expect(ohneZugangsdaten(null)).toBeNull();
  });
});
