// Akku-Analytik: Gesundheit, Restlebensdauer und Trend-Prognose. Reine
// Berechnung aus den Akkudaten — kein Netz, keine Seiteneffekte.

import type { Battery, BatteryReading } from './db';

const STANDARD_MAX_ZYKLEN = 200;  // typischer Richtwert für Consumer-LiPo
export const AUSTAUSCH_SCHWELLE = 60;    // % SOH, ab dem Austausch empfohlen

/** Aktuelle Gesundheit (SOH). Nutzt den erfassten Wert, sonst aus Zyklen
 *  geschätzt (LiPo verliert grob 0,15 %/Zyklus). Nie unter der Schwelle
 *  „geschätzt", weil eine reine Schätzung keinen Totalausfall behaupten soll. */
export function effektiveGesundheit(b: Battery): number {
  if (typeof b.health === 'number' && b.health > 0) return b.health;
  return Math.max(AUSTAUSCH_SCHWELLE, Math.round(100 - (b.cycles || 0) * 0.15));
}

/** Verbleibende Ladezyklen bis zur Hersteller-Grenze. */
export function restZyklen(b: Battery): number {
  const max = b.maxCycles || STANDARD_MAX_ZYKLEN;
  return Math.max(0, max - (b.cycles || 0));
}

export type LebensLevel = 'gut' | 'beobachten' | 'austausch';

export interface LebensBewertung {
  level: LebensLevel;
  gesundheit: number;
  restZyklen: number;
  text: string;
}

// Gesamturteil aus Gesundheit UND Zyklen — was zuerst kritisch wird, zählt.
export function lebensdauerBewertung(b: Battery): LebensBewertung {
  const soh = effektiveGesundheit(b);
  const rest = restZyklen(b);
  const max = b.maxCycles || STANDARD_MAX_ZYKLEN;

  let level: LebensLevel = 'gut';
  if (soh < AUSTAUSCH_SCHWELLE || rest === 0) level = 'austausch';
  else if (soh < 75 || rest <= max * 0.15) level = 'beobachten';

  const text =
    level === 'austausch'
      ? 'Austausch empfohlen — Gesundheit oder Zyklen am Limit.'
      : level === 'beobachten'
        ? `Im Auge behalten. Noch ~${rest} Ladezyklen, SOH ${soh}%.`
        : `Guter Zustand. Noch ~${rest} Ladezyklen, SOH ${soh}%.`;

  return { level, gesundheit: soh, restZyklen: rest, text };
}

export interface Projektion {
  /** SOH-Rückgang pro Monat (negativ = Verschleiß). null wenn nicht ermittelbar. */
  trendProMonat: number | null;
  /** Monate, bis die Austausch-Schwelle erreicht wird. null wenn nicht ermittelbar. */
  monateBisAustausch: number | null;
  text: string;
}

// Lineare Regression der Gesundheit über die Zeit. Braucht mindestens zwei
// Messungen mit health-Wert. Aus der Steigung wird hochgerechnet, wann die
// Austausch-Schwelle erreicht ist.
export function gesundheitsProjektion(
  history: BatteryReading[] = [],
  now: Date = new Date()
): Projektion {
  const punkte = history
    .filter(r => typeof r.health === 'number' && r.date)
    .map(r => ({ t: new Date(r.date).getTime(), h: r.health as number }))
    .filter(p => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);

  if (punkte.length < 2) {
    return { trendProMonat: null, monateBisAustausch: null, text: 'Zu wenige Messungen für eine Prognose (mindestens zwei nötig).' };
  }

  const MONAT = 1000 * 60 * 60 * 24 * 30;
  // Zeit in Monaten relativ zum ersten Punkt, damit die Zahlen handlich bleiben.
  const xs = punkte.map(p => (p.t - punkte[0].t) / MONAT);
  const ys = punkte.map(p => p.h);
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let zaehler = 0, nenner = 0;
  for (let i = 0; i < n; i++) {
    zaehler += (xs[i] - mx) * (ys[i] - my);
    nenner += (xs[i] - mx) ** 2;
  }
  if (nenner === 0) {
    return { trendProMonat: null, monateBisAustausch: null, text: 'Messungen liegen zeitlich zu dicht beieinander.' };
  }
  const steigung = zaehler / nenner;              // SOH-Punkte pro Monat
  const achsen = my - steigung * mx;
  const trendProMonat = Math.round(steigung * 10) / 10;

  // Aktuelle Projektion an der letzten (relativen) Zeit.
  const jetztX = (now.getTime() - punkte[0].t) / MONAT;
  const aktuellSoh = steigung * jetztX + achsen;

  if (steigung >= 0) {
    return { trendProMonat, monateBisAustausch: null, text: 'Kein Verschleißtrend erkennbar — Gesundheit stabil.' };
  }

  const monateBis = Math.max(0, Math.round((AUSTAUSCH_SCHWELLE - aktuellSoh) / steigung));
  return {
    trendProMonat,
    monateBisAustausch: monateBis,
    text: `Rückgang ~${Math.abs(trendProMonat)}%/Monat. Austausch-Schwelle (${AUSTAUSCH_SCHWELLE}%) in ~${monateBis} Monaten erreicht.`,
  };
}
