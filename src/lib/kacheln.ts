// Kartenkacheln an einer Stelle - mit der Namensnennung, die die Lizenz (ODbL)
// verlangt. Neue Kachel-Server auch in der Datenschutzerklärung und in der CSP
// (api/_lib/sicherheitsHeader.ts, vercel.json) ergänzen; src/konfiguration.test.ts
// prüft die Datenschutzerklärung.

const OSM_RECHTE = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Hauptkarte: HOT-Stil, betrieben von OpenStreetMap France (dort mit a/b/c-Subdomains). */
export const HOT_KACHELN = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
export const HOT_NAMENSNENNUNG = `${OSM_RECHTE}, tiles style by <a href="https://www.hotosm.org/">HOT</a>, hosted by <a href="https://www.openstreetmap.fr/">OSM France</a>`;

/** Flugplaner und Flugspur: Standard-Kacheln der OpenStreetMap Foundation. Deren
 *  Regeln verlangen genau diese Adresse (ohne a/b/c) und die Namensnennung. */
export const OSM_KACHELN = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_NAMENSNENNUNG = OSM_RECHTE;
