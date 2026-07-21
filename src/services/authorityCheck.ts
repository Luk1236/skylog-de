// Behörden-Check: bündelt die Nachweise, die bei einer Polizei-/Behörden-
// kontrolle in Deutschland verlangt werden, in eine anzeigbare Übersicht plus
// einen QR-Code-Inhalt. Reiner Datenaufbau — das QR-Rendering passiert in der
// Komponente, damit diese Logik ohne DOM testbar bleibt.

import type { UserProfile, Drone } from './db';

export interface CheckZeile {
  label: string;
  wert: string;
  /** true, wenn dieser Punkt ein Problem ist (fehlt oder abgelaufen). */
  problem?: boolean;
}

export interface BehoerdenCheck {
  zeilen: CheckZeile[];
  /** Kompakter Text, der in den QR-Code kodiert wird. */
  qrInhalt: string;
  /** Kritische Mängel, die der Pilot VOR einer Kontrolle beheben sollte. */
  warnungen: string[];
}

function istAbgelaufen(iso?: string, jetzt: number = Date.now()): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t < jetzt;
}

function datumDE(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : iso;
}

const LIZENZ_TEXT: Record<UserProfile['licenseType'], string> = {
  'A1/A3': 'EU-Kompetenznachweis A1/A3',
  'A2': 'EU-Fernpilotenzeugnis A2',
  'STS': 'STS-Fernpilotenzeugnis',
  'None': 'Kein Nachweis',
};

// Baut die Kontroll-Übersicht aus Profil und (optional) der geflogenen Drohne.
export function baueBehoerdenCheck(
  profile: UserProfile | null,
  drohne: Drone | null,
  jetzt: number = Date.now()
): BehoerdenCheck {
  const zeilen: CheckZeile[] = [];
  const warnungen: string[] = [];

  // Betreiber-Registrierung (e-ID) — der zentrale Punkt jeder Kontrolle.
  const eid = profile?.eid?.trim();
  zeilen.push({ label: 'Betreiber-ID (e-ID)', wert: eid || 'FEHLT', problem: !eid });
  if (!eid) warnungen.push('Keine Betreiber-ID (e-ID) hinterlegt — in DE Pflicht (Registrierung beim LBA).');

  zeilen.push({ label: 'Betreiber', wert: profile?.name?.trim() || '—', problem: !profile?.name?.trim() });

  // Kompetenznachweis inkl. Ablauf.
  const lizenz = profile ? LIZENZ_TEXT[profile.licenseType] : 'Kein Nachweis';
  const abgelaufen = istAbgelaufen(profile?.licenseExpiry, jetzt);
  const lizenzWert = profile?.licenseExpiry
    ? `${lizenz} (gültig bis ${datumDE(profile.licenseExpiry)})`
    : lizenz;
  zeilen.push({ label: 'Kompetenznachweis', wert: lizenzWert, problem: profile?.licenseType === 'None' || abgelaufen });
  if (profile?.licenseType === 'None') warnungen.push('Kein Kompetenznachweis hinterlegt.');
  if (abgelaufen) warnungen.push(`Kompetenznachweis abgelaufen (seit ${datumDE(profile?.licenseExpiry)}).`);

  // Haftpflicht — in DE für Drohnen Pflicht.
  const vers = profile?.insuranceNumber?.trim();
  zeilen.push({ label: 'Haftpflichtversicherung', wert: vers || 'FEHLT', problem: !vers });
  if (!vers) warnungen.push('Keine Versicherungsnummer hinterlegt — Haftpflicht ist Pflicht.');

  // Drohnendaten (falls eine ausgewählt ist).
  if (drohne) {
    zeilen.push({ label: 'Drohne', wert: `${drohne.model} (${drohne.uasClass}, ${drohne.weight} g)` });
    const reg = drohne.eId?.trim() || drohne.serialNumber?.trim();
    zeilen.push({ label: 'Drohnen-Kennung', wert: reg || '—', problem: !reg });
  }

  // QR-Inhalt: kompakt, aber offline lesbar (die Kontrolle scannt und liest direkt).
  const qrZeilen = [
    'SkyLog DE — Betreiber-Nachweis',
    `Betreiber-ID: ${eid || '-'}`,
    `Betreiber: ${profile?.name || '-'}`,
    `Nachweis: ${lizenz}${profile?.licenseExpiry ? ' bis ' + datumDE(profile.licenseExpiry) : ''}`,
    `Versicherung: ${vers || '-'}`,
  ];
  if (drohne) {
    qrZeilen.push(`Drohne: ${drohne.model} (${drohne.uasClass})`);
    qrZeilen.push(`Kennung: ${drohne.eId?.trim() || drohne.serialNumber?.trim() || '-'}`);
  }

  return { zeilen, qrInhalt: qrZeilen.join('\n'), warnungen };
}
