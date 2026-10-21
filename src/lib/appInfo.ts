import { Capacitor } from '@capacitor/core';

/** Version aus dem Build (Git-Tag bzw. package.json), siehe vite.config.ts. */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unbekannt';

/** Feste Kennung der App für OpenStreetMap-Dienste (deren Regeln verlangen sie von
 *  Apps). Steht gleichlautend als appendUserAgent in capacitor.config.ts. */
export const APP_KENNUNG = 'SkyLogDE (+https://github.com/Luk1236/skylog-de)';

/** Kopfzeile mit der App-Kennung für native Abrufe. Im Browser leer: Dort darf
 *  eine Seite den User-Agent nicht setzen (Firefox schickte sonst eine
 *  CORS-Vorabanfrage), und der Referer nennt die Seite ohnehin. */
export function appKennungKopf(): Record<string, string> {
  return Capacitor.isNativePlatform() ? { 'User-Agent': APP_KENNUNG } : {};
}

/** Als Web-App installiert (Startbildschirm), nicht im normalen Browser-Tab. */
export function istInstallierteWebApp(): boolean {
  return !Capacitor.isNativePlatform() && typeof window !== 'undefined'
    && !!window.matchMedia?.('(display-mode: standalone)').matches;
}

/** Worauf die App gerade läuft - für „Über die App“ und Fehlermeldungen. */
export function plattform(tx: (de: string, en: string) => string): string {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() === 'ios' ? tx('iOS-App', 'iOS app') : tx('Android-App', 'Android app');
  }
  return istInstallierteWebApp() ? tx('Installierte Web-App', 'Installed web app') : tx('Browser', 'Browser');
}
