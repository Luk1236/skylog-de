import { describe, it, expect } from 'vitest';
import { luftfahrtwetter, zonen, karte } from './proxys';

// Nur die Pruefungen VOR dem Netzabruf - die laufen ohne Internet.
describe('Proxys - Eingabepruefung', () => {
  it('Luftfahrtwetter verlangt ids oder bbox', async () => {
    expect((await luftfahrtwetter('metar')).status).toBe(400);
  });

  it('Zonen nur fuer Laender mit gepruefter Direktquelle', async () => {
    const r = await zonen('AT');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: 'Fuer dieses Land ist keine Direktquelle hinterlegt' });
  });

  it('Karte nur mit sauberem Dateinamen (kein Pfad, keine fremde Endung)', async () => {
    expect((await karte('../geheim.pmtiles')).status).toBe(400);
    expect((await karte('hessen.zip')).status).toBe(400);
  });
});
