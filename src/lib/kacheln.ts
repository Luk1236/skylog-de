// Kartenkacheln an einer Stelle - mit der Namensnennung, die die Lizenz (ODbL)
// verlangt. Neue Kachel-Server auch in der Datenschutzerklärung und in der CSP
// (api/_lib/sicherheitsHeader.ts, vercel.json) ergänzen; src/konfiguration.test.ts
// prüft die Datenschutzerklärung.

const OSM_RECHTE = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Hauptkarte: HOT-Stil, betrieben von OpenStreetMap France (dort mit a/b/c-Subdomains). */
export const HOT_KACHELN = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
/** Kurz gehalten, damit sie am Handy in eine Zeile passt (OSM-Richtlinie: „© OpenStreetMap“
 *  mit Link auf die Lizenzseite genügt; Kartenstil und Server werden mitgenannt). */
export const HOT_NAMENSNENNUNG = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · <a href="https://www.hotosm.org/">HOT</a> · <a href="https://www.openstreetmap.fr/">OSM France</a>';

/** Flugplaner und Flugspur: Standard-Kacheln der OpenStreetMap Foundation. Deren
 *  Regeln verlangen genau diese Adresse (ohne a/b/c) und die Namensnennung. */
export const OSM_KACHELN = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_NAMENSNENNUNG = OSM_RECHTE;

/** Klasse für die Grundkarten-Ebene: Im Dunkelmodus dunkelt src/index.css nur
 *  diese Ebene ab - die Geozonen darüber behalten ihre Warnfarben. */
export const GRUNDKARTE_KLASSE = 'karte-grundlage';
