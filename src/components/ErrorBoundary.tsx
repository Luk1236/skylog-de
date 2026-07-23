// Absturz-Netz für die Oberfläche.
//
// Ohne das reißt ein einziger Render-Fehler in irgendeiner Ansicht die ganze
// App in einen weißen Bildschirm — und weil alle Daten nur lokal liegen, liest
// sich das wie „alles weg". Der Boundary fängt den Fehler ab, zeigt eine ruhige
// Meldung mit der Zusicherung, dass die Daten sicher sind, und einen
// Neuladen-Knopf.
//
// Bewusst eine Klassenkomponente: React fängt Render-Fehler nur über
// componentDidCatch / getDerivedStateFromError ab, und das gibt es nur in
// Klassen. Bewusst ohne useSprache-Context: der Context könnte selbst Teil des
// Fehlers sein. Die Sprache kommt daher direkt aus localStorage.

import * as React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

type Texte = {
  titel: string;
  beruhigung: string;
  hinweis: string;
  neuladen: string;
};

/** Fallback-Texte in der gespeicherten Sprache. Rein und ohne React, damit sie
 *  auch dann funktionieren, wenn der Rest der App gerade nicht rendert. */
export function fehlerText(sprache: string): Texte {
  if (sprache === 'en') {
    return {
      titel: 'Something went wrong',
      beruhigung: 'Your data is safe. It stays stored locally on this device and was not affected.',
      hinweis: 'Reloading the app usually fixes this.',
      neuladen: 'Reload app',
    };
  }
  return {
    titel: 'Etwas ist schiefgelaufen',
    beruhigung: 'Deine Daten sind sicher. Sie liegen weiterhin lokal auf diesem Gerät und sind nicht betroffen.',
    hinweis: 'Ein Neuladen der App behebt das meistens.',
    neuladen: 'App neu laden',
  };
}

function gespeicherteSprache(): string {
  try {
    return localStorage.getItem('skylog_sprache') || 'de';
  } catch {
    return 'de';
  }
}

export class ErrorBoundary extends React.Component<Props, State> {
  // state und die Kinder explizit deklariert: Das Projekt hat kein
  // @types/react installiert, weshalb die Basisklasse hier keine Typen für
  // this.state / this.props liefert. Diese Deklarationen machen den Boundary
  // unabhängig davon — und at runtime nutzt Vite ohnehin den Babel-Transform.
  declare state: State;
  private kinder: React.ReactNode;

  constructor(props: Props) {
    super(props);
    this.kinder = props.children;
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // In die Konsole, damit sich der Fehler beim Debuggen nachvollziehen lässt.
    console.error('SkyLog UI-Fehler:', error, info.componentStack);
  }

  private neuladen = () => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.kinder;

    const t = fehlerText(gespeicherteSprache());
    return (
      <div className="fixed inset-0 bg-slate-50 flex items-center justify-center p-6 z-[200]">
        <div className="max-w-sm w-full bg-white rounded-3xl border border-slate-200 shadow-sm p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h1 className="text-lg font-black text-slate-900 mb-2">{t.titel}</h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-1">{t.beruhigung}</p>
          <p className="text-xs text-slate-400 mb-5">{t.hinweis}</p>
          <button
            onClick={this.neuladen}
            className="w-full bg-brand-blue text-white font-bold py-3 rounded-2xl active:scale-95 transition-transform"
          >
            {t.neuladen}
          </button>
          {this.state.message && (
            <p className="mt-4 text-[10px] text-slate-300 font-mono break-words">{this.state.message}</p>
          )}
        </div>
      </div>
    );
  }
}
