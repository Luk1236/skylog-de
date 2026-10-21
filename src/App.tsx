import { useState, useEffect, useMemo, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import {
  Plane, Map as MapIcon, Book, Settings, ShieldCheck, AlertTriangle, User, ShieldAlert, Library, History,
  TrendingUp, Package, QrCode, Route, LayoutGrid, Building2, Shield, Layers, PlusCircle, DatabaseBackup,
  Scale, ClipboardCheck, CircleUser,
} from 'lucide-react';

import { Dialog, Knopf } from './components/ui';
import { dbService, type Drone, type Flight, type AppDocument, type Battery, type UserProfile } from './services/db';

import { getLastBackupAt } from './services/backup';
import { getSicherungsIntervall } from './services/sicherungsErinnerung';
import { planeBenachrichtigungen, synchronisiereBenachrichtigungen } from './services/benachrichtigungen';
import { getReminders } from './services/reminders';
import { sichtbareHinweise } from './services/ausgeblendeteHinweise';
import { startOrt } from './services/startOrt';
import { schliesseOberste } from './services/ebenen';
import { dauerhaftAnfordern } from './services/speicherSchutz';
import { istInstallierteWebApp } from './lib/appInfo';

import { ladeTheme, toggleTheme, type Theme } from './services/theme';
import { uebersetze, ladeSprache, setzeSprache, andereSprache, type Sprache } from './services/i18n';
import { SprachProvider } from './lib/sprache';
import { useStandort } from './lib/useStandort';
import type { View } from './lib/ansichten';
import { DialogHost } from './components/DialogHost';
import { HinweisLeiste } from './components/HinweisLeiste';
import { DroneMap } from './components/DroneMap';
import { StandortHinweis } from './components/StandortHinweis';
import { MehrSheet, NavButton, SeitenleistenMenue, type MenueEintrag, type MenueGruppe } from './components/AppNavigation';

import { PinLockDialog } from './components/PinLockDialog';
// Modale Dialoge: lazy geladen, um das Haupt-Bundle klein zu halten (s. lazyDialogs.tsx).
import {
  FlightPlannerDialog, BehoerdenCheckDialog, EidDialog, LocationFavoritesDialog, CustomerManagerDialog,
  SoraWizardDialog, DatensicherungDialog, EinrichtungsAssistent, StaffelMatrixDialog, PreFlightSafetyDialog,
  ManualLocationDialog, RiskAssessmentDialog, IncidentReportDialog,
} from './components/lazyDialogs';
// Ansichten ausser der Startkarte: lazy geladen (s. lazyViews.tsx).
import {
  KnowledgeView, InventoryView, PilotsView, RoadmapView, SafetyView, ProfileView, EinstellungenView, GarageView, LogbookView,
} from './views/lazyViews';
import { isPinEnabled } from './services/pinProtection';
import type { LocationFavorite, Customer } from './services/db';

// Ansichten, die nicht fest unten stehen, sondern hinter „Mehr" liegen - der
// „Mehr"-Knopf wird aktiv, sobald eine davon offen ist.
const MEHR_VIEWS: View[] = ['inventory', 'pilots', 'knowledge', 'roadmap', 'profile', 'settings'];

export default function App() {
  const [activeView, setActiveView] = useState<View>('map');
  const [drones, setDrones] = useState<Drone[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const startOrtGeprueft = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBehoerdenCheck, setShowBehoerdenCheck] = useState(false);
  const [showEidDialog, setShowEidDialog] = useState(false);
  const [showLocationFavoritesDialog, setShowLocationFavoritesDialog] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(() => isPinEnabled());
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [locationFavorites, setLocationFavorites] = useState<LocationFavorite[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerManager, setShowCustomerManager] = useState(false);
  const [showSoraWizard, setShowSoraWizard] = useState(false);
  const [showCloudBackup, setShowCloudBackup] = useState(false);
  const [showStaffelMatrix, setShowStaffelMatrix] = useState(false);
  const [showPreFlightSafety, setShowPreFlightSafety] = useState(false);
  const [showRisiko, setShowRisiko] = useState(false);
  const [showVorfall, setShowVorfall] = useState(false);
  const [showMehr, setShowMehr] = useState(false);
  const [showPlaner, setShowPlaner] = useState(false);
  // „Flug loggen" auf der Karte öffnet das Logbuch gleich mit dem Formular.
  const [logbuchMitFormular, setLogbuchMitFormular] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => ladeTheme());
  const [sprache, setSprache] = useState<Sprache>(() => ladeSprache());
  // Kurzform fuer die Uebersetzung in dieser Komponente.
  const t = (key: string) => uebersetze(key, sprache);
  // App liegt ueber dem SprachProvider - daher eigenes tx statt useSprache().
  const tx = (de: string, en: string) => (sprache === 'en' ? en : de);
  const spracheWechseln = () => {
    const neu = andereSprache(sprache);
    setzeSprache(neu);
    setSprache(neu);
  };
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showEinrichtung, setShowEinrichtung] = useState(false);
  const [ladeDemo, setLadeDemo] = useState(false);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  // Einmal beim Start laden; loadData liest bei jedem Aufruf frisch aus der DB.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, []);

  // Installierte Web-App: dauerhaften Speicher anfordern, damit der Browser die
  // Flüge bei Speichermangel nicht räumt. Chrome gewährt das installierten Apps
  // ohne Rückfrage; im Browser-Tab gibt es dafür den Knopf in den Einstellungen.
  useEffect(() => {
    if (istInstallierteWebApp()) void dauerhaftAnfordern();
  }, []);

  // Seitensprache für Screenreader und Silbentrennung
  useEffect(() => {
    document.documentElement.lang = sprache;
  }, [sprache]);

  // Vordergrund/Hintergrund: im Browser über visibilitychange, in der
  // Android-App zusätzlich über den App-Status von Capacitor.
  const [imVordergrund, setImVordergrund] = useState(() => document.visibilityState !== 'hidden');
  useEffect(() => {
    const sichtbarkeit = () => setImVordergrund(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', sichtbarkeit);
    const nativ = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('appStateChange', ({ isActive }) => setImVordergrund(isActive))
      : null;
    return () => {
      document.removeEventListener('visibilitychange', sichtbarkeit);
      void nativ?.then(h => h.remove());
    };
  }, []);

  // Standort nur verfolgen, wo er gebraucht wird: auf der Karte und in der
  // Sicherheitsansicht (Notfall-Koordinaten), im Vordergrund und nach Zustimmung.
  const {
    location, weather, isLocating, gpsFehler, standortBekannt, standortFreigabe,
    standortWaehlen, orten, setzeVonHand, setzeStartOrt,
  } = useStandort(imVordergrund && (activeView === 'map' || activeView === 'safety'));
  // Escape (Laptop) wirkt wie Zurück: schließt nur die oberste Ebene
  // (services/ebenen.ts). Die App-Sperre meldet sich dort gar nicht an,
  // Escape umgeht den PIN-Schutz also nicht.
  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => { if (e.key === 'Escape') schliesseOberste(); };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, []);

  // Android-Zurück-Taste: erst die oberste Ebene schließen, dann zur Karte,
  // erst dort die App minimieren. Ohne Listener beendete Zurück die App.
  const zurueckZustand = useRef({ ansicht: activeView, gesperrt: isAppLocked });
  useEffect(() => {
    zurueckZustand.current = { ansicht: activeView, gesperrt: isAppLocked };
  });
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapacitorApp.addListener('backButton', () => {
      const { ansicht, gesperrt } = zurueckZustand.current;
      if (gesperrt) { void CapacitorApp.minimizeApp(); return; }
      if (schliesseOberste()) return;
      if (ansicht !== 'map') { setActiveView('map'); return; }
      void CapacitorApp.minimizeApp();
    });
    return () => { void handle.then(h => h.remove()); };
  }, []);

  async function loadData() {
    const [d, f, doc, b, p, favs, custs] = await Promise.all([
      dbService.getDrones(),
      dbService.getFlights(),
      dbService.getDocuments(),
      dbService.getBatteries(),
      dbService.getProfile(),
      dbService.getLocationFavorites(),
      dbService.getCustomers(),
    ]);
    setDrones(d);
    setFlights(f);
    setDocuments(doc);
    setBatteries(b);
    setProfile(p);
    setLocationFavorites(favs);
    setCustomers(custs);
    setIsLoading(false);
    if (!p && d.length === 0) setShowOnboarding(true);
    // Ohne GPS nicht in Berlin starten, sondern dort, wo geflogen wird.
    if (!startOrtGeprueft.current) {
      startOrtGeprueft.current = true;
      setzeStartOrt(startOrt(favs, f));
    }
  }

  // Reminders in Root-Scope: wird für NavBar-Badges benötigt. Ausgeblendete
  // („in 7 Tagen erinnern") zählen nicht mit.
  const appReminders = useMemo(
    () => sichtbareHinweise(getReminders(profile, drones, batteries, getLastBackupAt(), Date.now(), getSicherungsIntervall())),
    [profile, drones, batteries]
  );
  // Dringende Erinnerungen (level 'alert') als roter Zaehler in der Navigation.
  const highPrioCount = appReminders.filter(r => r.level === 'alert').length;

  const ansichtTitel: string = {
    map: t('nav.karte'), logbook: t('nav.logbuch'), garage: t('nav.flotte'), safety: t('nav.safety'),
    inventory: t('nav.inventar'), pilots: t('nav.piloten'), knowledge: t('nav.lbaInfo'),
    roadmap: t('nav.roadmap'), profile: t('nav.profil'), settings: t('nav.einstellungen'),
  }[activeView];

  // Ein Menü für alles, nach dem Ablauf geordnet - im Mehr-Blatt (Handy) und
  // in der Seitenleiste (Laptop) gleich.
  const menue: MenueGruppe[] = [
    {
      titel: tx('Vor dem Flug', 'Before the flight'),
      eintraege: [
        { id: 'vorflug', icon: ShieldCheck, label: tx('Vorflug-Check & Kp-Index', 'Pre-flight check & Kp index'), oeffnen: () => setShowPreFlightSafety(true) },
        { id: 'planer', icon: Route, label: tx('Flugplaner', 'Flight planner'), oeffnen: () => setShowPlaner(true) },
        { id: 'risiko', icon: Scale, label: tx('Risiko-Check', 'Risk check'), oeffnen: () => setShowRisiko(true) },
        { id: 'sora', icon: Shield, label: tx('SORA-2.5-Assistent (PDF)', 'SORA 2.5 assistant (PDF)'), oeffnen: () => setShowSoraWizard(true) },
      ],
    },
    {
      titel: tx('Nach dem Flug', 'After the flight'),
      eintraege: [
        { id: 'vorfall', icon: ClipboardCheck, label: tx('Vorfall-Bericht', 'Incident report'), oeffnen: () => setShowVorfall(true) },
        { id: 'sicherung', icon: DatabaseBackup, label: tx('Datensicherung & Erinnerung', 'Backup & reminder'), oeffnen: () => setShowCloudBackup(true) },
      ],
    },
    {
      titel: tx('Verwaltung', 'Management'),
      eintraege: [
        { id: 'inventory', icon: Package, label: t('nav.inventar'), view: 'inventory' },
        { id: 'pilots', icon: User, label: t('nav.piloten'), view: 'pilots' },
        { id: 'kunden', icon: Building2, label: tx('Kunden (CRM)', 'Customers (CRM)'), oeffnen: () => setShowCustomerManager(true) },
        { id: 'staffel', icon: Layers, label: tx('Staffel- & Flottenmatrix', 'Squadron & fleet matrix'), oeffnen: () => setShowStaffelMatrix(true) },
      ],
    },
    {
      titel: tx('Wissen & Konto', 'Knowledge & account'),
      eintraege: [
        { id: 'knowledge', icon: Library, label: t('nav.lbaInfo'), view: 'knowledge' },
        { id: 'profile', icon: CircleUser, label: t('nav.profil'), view: 'profile' },
        { id: 'settings', icon: Settings, label: t('nav.einstellungen'), view: 'settings' },
        { id: 'roadmap', icon: TrendingUp, label: t('nav.roadmap'), view: 'roadmap' },
      ],
    },
  ];
  const waehle = (e: MenueEintrag) => {
    setShowMehr(false);
    if (e.view) setActiveView(e.view);
    else e.oeffnen?.();
  };

  // Android: Fristen als echte Benachrichtigungen planen (im Browser ohne Wirkung).
  // Erst nach dem Laden - sonst wuerden leere Listen alle geplanten Termine loeschen.
  useEffect(() => {
    if (isLoading) return;
    void synchronisiereBenachrichtigungen(
      planeBenachrichtigungen(profile, drones, batteries, getLastBackupAt(), getSicherungsIntervall()),
    );
  }, [isLoading, profile, drones, batteries]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center app-shell bg-brand-blue gap-4">
        <div className="bg-white/20 p-5 rounded-3xl">
          <Plane className="w-14 h-14 text-white animate-pulse" />
        </div>
        <h1 className="text-white font-black text-2xl tracking-tight">SkyLog DE</h1>
        <p className="text-blue-200 text-sm font-bold">{tx('Wird geladen …', 'Loading …')}</p>
      </div>
    );
  }

  const lizenzTage = profile?.licenseExpiry
    ? Math.ceil((new Date(profile.licenseExpiry).getTime() - Date.now()) / 86400000)
    : null;
  const letzterFlug = [...flights].sort((a, b) => b.createdAt - a.createdAt)[0];
  const letzteDrohne = letzterFlug ? drones.find(d => d.id === letzterFlug.droneId) : undefined;
  // Seitenwechsel: kurze Einblendung per CSS (vorher die motion-Bibliothek im Erststart).
  const ansichtKlasse = 'absolute inset-0 overflow-y-auto p-4 bg-slate-50 ansicht-ein';
  // Der Scrollbereich jeder Ansicht ist per Tastatur erreichbar (Pfeiltasten/Bild ab).
  const ansichtBereich = { tabIndex: 0, role: 'region', 'aria-label': ansichtTitel } as const;

  return (
    <SprachProvider sprache={sprache}>
    <div className="flex flex-col lg:flex-row app-shell overflow-hidden bg-slate-50 font-sans">
      {/* Inhalts-Spalte: auf Desktop rechts neben der Seitenleiste, auf dem
          Handy der übliche Stapel Header → Inhalt über der unteren Leiste. */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-700 text-white text-xs font-bold px-4 py-2 flex items-center gap-2 z-50">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {tx('Kein Internet – Wetter & NOTAM nicht verfügbar. Das Logbuch funktioniert offline.', 'No internet – weather & NOTAMs unavailable. The logbook works offline.')}
        </div>
      )}

      {/* Begrüßung beim ersten Start - im selben Dialog-Stil wie der Rest */}
      {showOnboarding && (
        <Dialog
          titel={tx('Willkommen bei SkyLog DE', 'Welcome to SkyLog DE')}
          untertitel={tx('Dein digitales Flugbuch für Drohnen', 'Your digital drone logbook')}
          icon={Plane}
          breite="sm"
          onClose={() => setShowOnboarding(false)}
          schliesstBeiKlickDaneben={false}
        >
          <p className="text-sm text-slate-600 leading-relaxed">
            {tx('Leg dein Pilotenprofil an – oder schau dir die App erst mit Beispieldaten an. Alles lässt sich später ändern.', 'Set up your pilot profile – or try the app with sample data first. You can change everything later.')}
          </p>
          <div className="space-y-2">
            <Knopf voll onClick={() => { setShowOnboarding(false); setShowEinrichtung(true); }}>
              {tx('Profil einrichten', 'Set up profile')}
            </Knopf>
            <Knopf
              variante="sekundaer"
              voll
              disabled={ladeDemo}
              onClick={async () => {
                setLadeDemo(true);
                const { ladeBeispieldaten } = await import('./services/demoDaten');
                await ladeBeispieldaten();
                startOrtGeprueft.current = false;
                await loadData();
                setLadeDemo(false);
                setShowOnboarding(false);
                setActiveView('logbook');
              }}
            >
              {ladeDemo ? tx('Lädt …', 'Loading …') : tx('Mit Beispieldaten ausprobieren', 'Try with sample data')}
            </Knopf>
            <Knopf variante="geist" voll onClick={() => setShowOnboarding(false)}>
              {tx('Später', 'Later')}
            </Knopf>
          </div>
          <p className="text-xs text-slate-500 text-center">{tx('Alle Daten bleiben lokal auf deinem Gerät.', 'All data stays on your device.')}</p>
        </Dialog>
      )}

      {/* Header */}
      {/* Auf breiten Bildschirmen steht die Marke schon in der Seitenleiste -
          dort traegt die Kopfzeile nur noch die Aktionen (rechts). */}
      <header className="bg-brand-blue text-white px-4 pb-3 pt-safe flex items-center justify-between shadow-md z-10">
        {/* Laptop: statt der Marke (steht in der Seitenleiste) der Name der Ansicht */}
        <h1 className="hidden lg:block font-black text-lg tracking-tight pl-2">{ansichtTitel}</h1>
        <div className="flex items-center gap-2 lg:hidden">
          <div className="bg-white/20 p-2 rounded-lg">
            <Plane className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none tracking-tight">SkyLog DE</h1>
            <p className="text-xs text-blue-200 font-medium mt-0.5">{t('app.untertitel')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-xs font-medium border border-white/5">
            <ShieldCheck className="w-3 h-3 text-green-400" />
            <span>{t('app.lokal')}</span>
          </div>
          {/* Behörden-Check: einziger Kopf-Knopf, für eine Kontrolle unterwegs
              schnell erreichbar. Sprache, Design und die selteneren Ansichten
              liegen unten unter „Mehr". */}
          <button
            onClick={() => setShowBehoerdenCheck(true)}
            aria-label={t('a11y.behoerdenCheck')}
            title={t('a11y.behoerdenCheck')}
            className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
          >
            <QrCode className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
          {activeView === 'map' && (
            <div key="map" className="absolute inset-0 ansicht-blenden">
              <DroneMap location={location} onLocate={orten} isLocating={isLocating} weather={weather} flights={flights} locationFavorites={locationFavorites} onPlaner={() => setShowPlaner(true)} />
              {/* Kartenelemente bewusst nur z-20/z-30: genug, um ueber der Karte
                  (.leaflet-container z-index 1) zu liegen, aber unter allen Dialogen
                  (ab z-[60]). */}
              {/* Hinweise oben auf der Karte untereinander; die Lücken lassen
                  Tipps auf die Karte durch. */}
              <div className="absolute top-4 left-4 right-20 z-30 flex flex-col gap-2 pointer-events-none [&>*]:pointer-events-auto">
                {standortFreigabe === 'offen' && !standortBekannt && (
                  <StandortHinweis
                    onFreigeben={() => standortWaehlen('erlaubt')}
                    onVonHand={() => setShowManualLocation(true)}
                    onSchliessen={() => standortWaehlen('abgelehnt')}
                  />
                )}
                {gpsFehler && (
                  <div className="bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">
                      {gpsFehler === 'verweigert'
                        ? tx('Kein GPS-Zugriff. Erlaube den Standort in den Einstellungen oder setz ihn von Hand.', 'No GPS access. Allow location in your settings or set it by hand.')
                        : tx('GPS antwortet nicht. Standort konnte nicht ermittelt werden.', 'GPS is not responding. Location could not be determined.')}
                    </span>
                    <button
                      onClick={() => setShowManualLocation(true)}
                      className="shrink-0 bg-black/15 hover:bg-black/25 rounded-lg px-2 h-8 text-xs font-bold"
                    >
                      {tx('Von Hand', 'Set manually')}
                    </button>
                  </div>
                )}
                {lizenzTage !== null && lizenzTage <= 60 && (
                  <div className={`text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-lg flex items-center gap-2 ${lizenzTage <= 0 ? 'bg-brand-red' : 'bg-amber-700'}`}>
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    {lizenzTage <= 0
                      ? tx(`Kompetenznachweis abgelaufen (${profile?.licenseType})`, `Certificate expired (${profile?.licenseType})`)
                      : tx(`Kompetenznachweis läuft in ${lizenzTage} Tagen ab (${profile?.licenseType})`, `Certificate expires in ${lizenzTage} days (${profile?.licenseType})`)}
                  </div>
                )}
              </div>
              {/* Letzter Flug: Tipp öffnet das Logbuch */}
              {letzterFlug && (
                <button
                  type="button"
                  onClick={() => { setLogbuchMitFormular(false); setActiveView('logbook'); }}
                  className="absolute bottom-24 left-4 right-4 z-20 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200 px-4 py-3 flex items-center gap-3 text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {letzteDrohne?.photoUrl
                      ? <img src={letzteDrohne.photoUrl} alt="" className="w-full h-full object-cover" />
                      : <Plane className="w-4 h-4 text-brand-blue" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-500">{tx('Letzter Flug', 'Last flight')}</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{letzterFlug.locationName}</p>
                    <p className="text-xs text-slate-500 truncate">{new Date(letzterFlug.date).toLocaleDateString(sprache === 'en' ? 'en-GB' : 'de-DE')} · {letzterFlug.duration} min · {letzteDrohne?.model || '—'}</p>
                  </div>
                  <History className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              )}
              {/* Flug loggen: öffnet das Logbuch direkt mit dem Formular */}
              <button
                onClick={() => { setLogbuchMitFormular(true); setActiveView('logbook'); }}
                className={`absolute ${letzterFlug ? 'bottom-44' : 'bottom-24'} right-4 z-20 flex items-center gap-2 bg-brand-blue text-white font-bold text-sm px-4 h-11 rounded-2xl shadow-xl shadow-brand-blue/30 active:scale-95 transition-all hover:bg-brand-blue/90`}
              >
                <PlusCircle className="w-4 h-4" />
                {tx('Flug loggen', 'Log flight')}
              </button>
            </div>
          )}

          {activeView === 'garage' && (
            <div key="garage" className={ansichtKlasse} {...ansichtBereich}>
              <GarageView drones={drones} flights={flights} batteries={batteries} onUpdate={loadData} />
            </div>
          )}

          {activeView === 'logbook' && (
            <div key="logbook" className={ansichtKlasse} {...ansichtBereich}>
              <LogbookView flights={flights} drones={drones} batteries={batteries} profile={profile} locationFavorites={locationFavorites} onUpdate={loadData} currentLocation={location} onOpenFavorites={() => setShowLocationFavoritesDialog(true)} formularStart={logbuchMitFormular} />
            </div>
          )}

          {activeView === 'profile' && (
            <div key="profile" className={ansichtKlasse} {...ansichtBereich}>
              <ProfileView profile={profile} documents={documents} onUpdate={loadData} onOpenEid={() => setShowEidDialog(true)} />
            </div>
          )}

          {activeView === 'settings' && (
            <div key="settings" className={ansichtKlasse} {...ansichtBereich}>
              <EinstellungenView
                profile={profile}
                onUpdate={loadData}
                onOpenPinSetup={() => setShowPinSetup(true)}
                onOpenDatensicherung={() => setShowCloudBackup(true)}
                sprache={sprache}
                onSprache={spracheWechseln}
                theme={theme}
                onTheme={() => setTheme(toggleTheme(theme))}
              />
            </div>
          )}

          {activeView === 'knowledge' && (
            <div key="knowledge" className={ansichtKlasse} {...ansichtBereich}>
              <KnowledgeView />
            </div>
          )}

          {activeView === 'roadmap' && (
            <div key="roadmap" className={ansichtKlasse} {...ansichtBereich}>
              <RoadmapView />
            </div>
          )}

          {activeView === 'safety' && (
            <div key="safety" className={ansichtKlasse} {...ansichtBereich}>
              <SafetyView profile={profile} drones={drones} standort={standortBekannt ? location : undefined}
                ortet={standortFreigabe === 'erlaubt' && isLocating}
                onStandortFreigeben={standortFreigabe === 'erlaubt' ? undefined : () => standortWaehlen('erlaubt')}
                 onBehoerdenCheck={() => setShowBehoerdenCheck(true)} onOpenEid={() => setShowEidDialog(true)} />
            </div>
          )}

          {activeView === 'inventory' && (
            <div key="inventory" className={ansichtKlasse} {...ansichtBereich}>
              <InventoryView />
            </div>
          )}

          {activeView === 'pilots' && (
            <div key="pilots" className={ansichtKlasse} {...ansichtBereich}>
              <PilotsView />
            </div>
          )}
      </main>
      </div>

      {/* Navigation: unten als Leiste (Handy), links als Seitenleiste (Tablet/
          Desktop, lg+). Fünf feste Punkte; alles Weitere im Menü. */}
      <nav className="bg-white border-t border-slate-200 px-1 pt-2 grid grid-cols-5 pb-safe z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:order-first lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:grid-cols-1 lg:content-start lg:border-t-0 lg:border-r lg:pt-6 lg:px-3 lg:gap-1 lg:shadow-none">
        {/* Marke: nur in der Desktop-Seitenleiste, zur Orientierung. */}
        <div className="hidden lg:flex items-center gap-2.5 px-3 pb-4 mb-2 border-b border-slate-200">
          <div className="bg-brand-blue p-2 rounded-xl shrink-0">
            <Plane className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-black text-slate-900 leading-none truncate">SkyLog DE</p>
            <p className="text-xs text-slate-500 mt-1">{tx('Drohnen-Flugbuch', 'Drone logbook')}</p>
          </div>
        </div>
        <NavButton
          active={activeView === 'map'}
          onClick={() => setActiveView('map')}
          icon={MapIcon}
          label={t('nav.karte')}
        />
        <NavButton
          active={activeView === 'logbook'}
          onClick={() => { setLogbuchMitFormular(false); setActiveView('logbook'); }}
          icon={Book}
          label={t('nav.logbuch')}
          badge={highPrioCount || undefined}
        />
        <NavButton
          active={activeView === 'garage'}
          onClick={() => setActiveView('garage')}
          icon={Plane}
          label={t('nav.flotte')}
        />
        <NavButton
          active={activeView === 'safety'}
          onClick={() => setActiveView('safety')}
          icon={ShieldAlert}
          label={t('nav.safety')}
        />
        <NavButton
          active={MEHR_VIEWS.includes(activeView)}
          onClick={() => setShowMehr(true)}
          icon={LayoutGrid}
          label={t('nav.mehr')}
          className="lg:hidden"
        />
        {/* Laptop: genug Platz - das ganze Menü steht direkt hier. */}
        <SeitenleistenMenue
          gruppen={menue}
          activeView={activeView}
          onWaehle={waehle}
          theme={theme}
          sprache={sprache}
          onTheme={() => setTheme(toggleTheme(theme))}
          onSprache={spracheWechseln}
        />
      </nav>

      {showPlaner && (
        <FlightPlannerDialog
          startLat={location[0]}
          startLon={location[1]}
          locationFavorites={locationFavorites}
          onClose={() => setShowPlaner(false)}
        />
      )}

      {showManualLocation && (
        <ManualLocationDialog
          aktuell={location}
          onPick={(lat, lon) => {
            setzeVonHand(lat, lon);
            setShowManualLocation(false);
          }}
          onClose={() => setShowManualLocation(false)}
        />
      )}

      {showBehoerdenCheck && (
        <BehoerdenCheckDialog
          profile={profile}
          drohnen={drones}
          dokumente={documents}
          onClose={() => setShowBehoerdenCheck(false)}
        />
      )}

      {showEidDialog && (
        <EidDialog
          profile={profile}
          onSaveProfile={async (up) => {
            await dbService.saveProfile(up);
            setShowEidDialog(false);
            loadData();
          }}
          onClose={() => setShowEidDialog(false)}
        />
      )}

      {showLocationFavoritesDialog && (
        <LocationFavoritesDialog
          favorites={locationFavorites}
          onSaveFavorite={async (fav) => {
            await dbService.saveLocationFavorite(fav);
            loadData();
          }}
          onDeleteFavorite={async (id) => {
            await dbService.deleteLocationFavorite(id);
            loadData();
          }}
          onClose={() => setShowLocationFavoritesDialog(false)}
        />
      )}

      {isAppLocked && (
        <PinLockDialog
          mode="unlock"
          onUnlocked={() => setIsAppLocked(false)}
        />
      )}

      {showPinSetup && (
        <PinLockDialog
          mode={isPinEnabled() ? 'settings' : 'setup'}
          onClose={() => setShowPinSetup(false)}
        />
      )}

      {showCustomerManager && (
        <CustomerManagerDialog
          customers={customers}
          flights={flights}
          drones={drones}
          profile={profile}
          onSaveCustomer={async (cust) => {
            await dbService.saveCustomer(cust);
            loadData();
          }}
          onDeleteCustomer={async (id) => {
            await dbService.deleteCustomer(id);
            loadData();
          }}
          onClose={() => setShowCustomerManager(false)}
        />
      )}

      {showSoraWizard && (
        <SoraWizardDialog
          drones={drones}
          profile={profile}
          onClose={() => setShowSoraWizard(false)}
        />
      )}

      {showCloudBackup && (
        <DatensicherungDialog
          onClose={() => setShowCloudBackup(false)}
        />
      )}

      {showStaffelMatrix && (
        <StaffelMatrixDialog
          drones={drones}
          batteries={batteries}
          maintenance={[]}
          profile={profile}
          onClose={() => setShowStaffelMatrix(false)}
        />
      )}

      {showPreFlightSafety && (
        <PreFlightSafetyDialog
          weather={weather}
          drone={drones[0] || null}
          battery={batteries[0] || null}
          profile={profile}
          onClose={() => setShowPreFlightSafety(false)}
        />
      )}

      {showRisiko && (
        <RiskAssessmentDialog drohnen={drones} onClose={() => setShowRisiko(false)} />
      )}

      {showVorfall && (
        <IncidentReportDialog profile={profile} drohnen={drones} onClose={() => setShowVorfall(false)} />
      )}

      <DialogHost />
      <HinweisLeiste />

      {showEinrichtung && (
        <EinrichtungsAssistent
          onFertig={() => { setShowEinrichtung(false); loadData(); }}
          onAbbrechen={() => setShowEinrichtung(false)}
        />
      )}

      {showMehr && (
        <MehrSheet
          gruppen={menue}
          activeView={activeView}
          onWaehle={waehle}
          onClose={() => setShowMehr(false)}
          theme={theme}
          sprache={sprache}
          onTheme={() => setTheme(toggleTheme(theme))}
          onSprache={spracheWechseln}
        />
      )}
    </div>
    </SprachProvider>
  );
}
