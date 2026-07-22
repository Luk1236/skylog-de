// Hell/Dunkel-Umschaltung. Das Theme wird über das Attribut
// data-theme="dark" am <html>-Element gesteuert; die Farbumdefinition dazu
// steht in index.css. Persistenz über localStorage; erste Wahl folgt der
// System-Einstellung.

export type Theme = 'light' | 'dark';

const KEY = 'skylog_theme';

/** Vom System bevorzugtes Theme (prefers-color-scheme). */
export function systemBevorzugt(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** Gespeichertes Theme, sonst System-Vorgabe. */
export function ladeTheme(): Theme {
  const gespeichert = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
  return gespeichert === 'dark' || gespeichert === 'light' ? gespeichert : systemBevorzugt();
}

/** Setzt das Attribut am <html> und aktualisiert die Statusleisten-Farbe. */
export function wendeAn(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#1e3a8a');
}

/** Speichert und wendet an. */
export function setzeTheme(theme: Theme): void {
  try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  wendeAn(theme);
}

/** Kippt zwischen hell und dunkel und gibt das neue Theme zurück. */
export function toggleTheme(aktuell: Theme): Theme {
  const neu: Theme = aktuell === 'dark' ? 'light' : 'dark';
  setzeTheme(neu);
  return neu;
}
