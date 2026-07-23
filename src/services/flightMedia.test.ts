import { describe, it, expect } from 'vitest';
import {
  istBild, formatGroesse, gesamtGroesse, pruefeDatei,
  mediaHinzufuegen, mediaEntfernen,
  MAX_BILD_BYTES, MAX_FLUG_BYTES,
} from './flightMedia';
import type { FlightMedia } from './db';

function bild(over: Partial<FlightMedia> = {}): FlightMedia {
  return { id: 'm1', name: 'foto.jpg', type: 'image/jpeg', dataUrl: 'data:,', size: 1024, addedAt: 0, ...over };
}

describe('istBild', () => {
  it('akzeptiert Bild-MIME-Typen', () => {
    expect(istBild('image/jpeg')).toBe(true);
    expect(istBild('image/heic')).toBe(true);
  });
  it('lehnt anderes ab', () => {
    expect(istBild('video/mp4')).toBe(false);
    expect(istBild('application/pdf')).toBe(false);
    expect(istBild('')).toBe(false);
  });
});

describe('formatGroesse', () => {
  it('zeigt KB unter einem MB', () => {
    expect(formatGroesse(2048)).toBe('2 KB');
  });
  it('zeigt MB mit deutschem Komma', () => {
    expect(formatGroesse(1.5 * 1024 * 1024)).toBe('1,5 MB');
  });
  it('kommt mit 0 und Unsinn klar', () => {
    expect(formatGroesse(0)).toBe('0 KB');
    expect(formatGroesse(NaN)).toBe('0 KB');
  });
});

describe('gesamtGroesse', () => {
  it('summiert die Bytes', () => {
    expect(gesamtGroesse([bild({ size: 100 }), bild({ size: 250 })])).toBe(350);
  });
  it('ist 0 ohne Bilder', () => {
    expect(gesamtGroesse()).toBe(0);
  });
});

describe('pruefeDatei', () => {
  it('lässt ein normales Bild durch', () => {
    expect(pruefeDatei({ name: 'a.jpg', type: 'image/jpeg', size: 500_000 }).ok).toBe(true);
  });

  it('lehnt Nicht-Bilder mit klarer Meldung ab', () => {
    const r = pruefeDatei({ name: 'v.mp4', type: 'video/mp4', size: 1000 });
    expect(r.ok).toBe(false);
    expect(r.fehler).toMatch(/Nur Bilder/);
  });

  it('lehnt ein zu großes Einzelbild ab', () => {
    const r = pruefeDatei({ name: 'gross.jpg', type: 'image/jpeg', size: MAX_BILD_BYTES + 1 });
    expect(r.ok).toBe(false);
    expect(r.fehler).toMatch(/Grenze/);
  });

  it('lehnt ab, wenn der Flug damit über das Gesamtlimit ginge', () => {
    const voll = [bild({ size: MAX_FLUG_BYTES - 1000 })];
    const r = pruefeDatei({ name: 'a.jpg', type: 'image/jpeg', size: 500_000 }, voll);
    expect(r.ok).toBe(false);
    expect(r.fehler).toMatch(/entfernen/);
  });
});

describe('mediaHinzufuegen / mediaEntfernen', () => {
  it('hängt an', () => {
    expect(mediaHinzufuegen([], bild())).toHaveLength(1);
  });
  it('entfernt nach ID', () => {
    const l = [bild({ id: 'a' }), bild({ id: 'b' })];
    expect(mediaEntfernen(l, 'a').map(m => m.id)).toEqual(['b']);
  });
  it('kommt mit undefined als Liste klar', () => {
    expect(mediaHinzufuegen(undefined, bild())).toHaveLength(1);
    expect(mediaEntfernen(undefined, 'x')).toEqual([]);
  });
});
