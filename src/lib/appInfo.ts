import { Capacitor } from '@capacitor/core';

/** Version aus dem Build (Git-Tag bzw. package.json), siehe vite.config.ts. */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unbekannt';

/** Worauf die App gerade läuft - für „Über die App“ und Fehlermeldungen. */
export function plattform(tx: (de: string, en: string) => string): string {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() === 'ios' ? tx('iOS-App', 'iOS app') : tx('Android-App', 'Android app');
  }
  const installiert = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;
  return installiert ? tx('Installierte Web-App', 'Installed web app') : tx('Browser', 'Browser');
}
