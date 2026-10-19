import { describe, it, expect } from 'vitest';
import { verschluessele, entschluessele, istVerschluesselt, FalschesPasswortFehler } from './backupCrypto';

// Wenige Runden im Test - die Logik ist dieselbe, nur schneller.
const ITER = 1000;

describe('backupCrypto', () => {
  it('verschlüsselt und entschlüsselt verlustfrei (auch Umlaute, große Daten)', async () => {
    const klar = JSON.stringify({ app: 'SkyLog DE', notiz: 'Flug über Großhöhe ✈', daten: 'x'.repeat(200_000) });
    const datei = await verschluessele(klar, 'geheimes-passwort', ITER);
    expect(istVerschluesselt(datei)).toBe(true);
    expect(JSON.stringify(datei)).not.toContain('Großhöhe');
    expect(await entschluessele(datei, 'geheimes-passwort')).toBe(klar);
  });

  it('meldet ein falsches Passwort klar', async () => {
    const datei = await verschluessele('{"a":1}', 'richtiges-passwort', ITER);
    await expect(entschluessele(datei, 'falsches-passwort')).rejects.toBeInstanceOf(FalschesPasswortFehler);
  });

  it('erkennt veränderte Dateien', async () => {
    const datei = await verschluessele('{"a":1}', 'richtiges-passwort', ITER);
    const kaputt = { ...datei, daten: datei.daten.slice(0, -4) + 'AAAA' };
    await expect(entschluessele(kaputt, 'richtiges-passwort')).rejects.toBeInstanceOf(FalschesPasswortFehler);
  });

  it('verlangt mindestens 8 Zeichen', async () => {
    await expect(verschluessele('{}', 'kurz', ITER)).rejects.toThrow(/8 Zeichen/);
  });

  it('nutzt jedes Mal neues Salz und IV', async () => {
    const a = await verschluessele('{}', 'passwort123', ITER);
    const b = await verschluessele('{}', 'passwort123', ITER);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });

  it('istVerschluesselt lehnt normale Sicherungen ab', () => {
    expect(istVerschluesselt({ app: 'SkyLog DE', drones: [] })).toBe(false);
    expect(istVerschluesselt(null)).toBe(false);
  });
});
