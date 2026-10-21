import { describe, it, expect, vi } from 'vitest';
import {
  importBackup, BACKUP_VERSION, ohneZugangsdaten, leseBackupText, PasswortNoetigFehler,
  BeschaedigteSicherungFehler, findeSchaeden, type BackupData,
} from './backup';
import { verschluessele, FalschesPasswortFehler } from './backupCrypto';
import { dbService, type UserProfile } from './db';

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

  it('weist Einträge ohne ID ab, bevor die Datenbank angefasst wird', async () => {
    const einspielen = vi.spyOn(dbService, 'importAllData');
    const kaputt = JSON.stringify({
      app: 'SkyLog DE', version: BACKUP_VERSION, drones: [{ id: 'd1' }],
      flights: [{ id: 'f1' }, { date: '2026-10-21' }, { id: '' }], customers: 'keine Liste',
    });
    const fehler = await importBackup(datei(kaputt), 'replace').catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(BeschaedigteSicherungFehler);
    expect((fehler as Error).message).toMatch(/3 Einträge .*Flüge, Kunden: keine Liste.*nichts verändert/);
    expect((fehler as BeschaedigteSicherungFehler).textEn).toMatch(/3 entries .*flights, customers: not a list.*Nothing was changed/);
    expect(einspielen).not.toHaveBeenCalled();
    einspielen.mockRestore();
  });
});

describe('findeSchaeden', () => {
  const heil = { app: 'SkyLog DE', version: 1, drones: [{ id: 'd1' }], flights: [{ id: 'f1' }], batteries: [], maintenance: [], pilots: [], profile: null, documents: [] } as unknown as BackupData;

  it('findet nichts in einer heilen Sicherung, auch ohne die Listen ab Format 2', () => {
    expect(findeSchaeden(heil)).toEqual([]);
  });

  it('nimmt Zahlen als ID an, aber keine leeren oder fehlenden', () => {
    expect(findeSchaeden({ ...heil, flights: [{ id: 7 }, { id: '' }, null] } as unknown as BackupData))
      .toEqual([{ de: 'Flüge', en: 'flights', anzahl: 2 }]);
  });

  it('prüft das Profil', () => {
    expect(findeSchaeden({ ...heil, profile: { name: 'ohne id' } } as unknown as BackupData))
      .toEqual([{ de: 'Profil', en: 'profile', anzahl: 1 }]);
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

describe('leseBackupText — verschlüsselte Sicherungen', () => {
  const klar = JSON.stringify({ app: 'SkyLog DE', version: BACKUP_VERSION, drones: [{ id: 'd1' }] });

  it('liest unverschlüsselte Dateien direkt', async () => {
    expect((await leseBackupText(klar)).drones).toHaveLength(1);
  });

  it('verlangt bei verschlüsselten Dateien ein Passwort', async () => {
    const datei = JSON.stringify(await verschluessele(klar, 'sicheres-passwort', 1000));
    await expect(leseBackupText(datei)).rejects.toBeInstanceOf(PasswortNoetigFehler);
    await expect(leseBackupText(datei, 'falsches-passwort')).rejects.toBeInstanceOf(FalschesPasswortFehler);
    expect((await leseBackupText(datei, 'sicheres-passwort')).drones).toEqual([{ id: 'd1' }]);
  });
});
