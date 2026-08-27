import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Plane, Map as MapIcon, Book, ChevronRight, Info, Navigation, Settings, ShieldCheck, Wind, Thermometer, CloudRain, AlertTriangle, User, ShieldAlert, Library, History, TrendingUp, Printer, QrCode, Moon, Sun, Route, LayoutGrid, Languages, Building2, Shield, Cloud, Layers, DownloadCloud, Globe2, X, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { cn } from './lib/utils';
import { dbService, type Drone, type Flight, type AppDocument, type Battery, type UserProfile } from './services/db';
import { fetchWeather, type WeatherData } from './services/weather';

import { getLastBackupAt } from './services/backup';
import { getReminders } from './services/reminders';

import { ladeTheme, toggleTheme, type Theme } from './services/theme';
import { uebersetze, ladeSprache, setzeSprache, andereSprache, type Sprache } from './services/i18n';
import { SprachProvider, useSprache } from './lib/sprache';
import { DialogHost } from './components/DialogHost';

import { OfflineBasemap } from './components/OfflineBasemap';
import { pruefeOfflineKarte, OFFLINE_KARTE_URL } from './services/offlineBasemap';
import { EuZoneLayer } from './components/EuZoneLayer';
import { zonenInUmkreis, parseEd269, type Ed269Zone } from './services/ed269';
import { laenderFuerKoordinate, quelleFuer } from './services/euZones';
import { regionenFuerStandort } from './services/mapRegions';
import { karteFuerStandort, alsPmtiles } from './services/mapDownload';
import type { PMTiles } from 'pmtiles';

import { PinLockDialog } from './components/PinLockDialog';
// Modale Dialoge: lazy geladen, um das Haupt-Bundle klein zu halten (s. lazyDialogs.tsx).
import { OfflineMapsDialog, EuZonesDialog, FlightPlannerDialog, BehoerdenCheckDialog, EidDialog, LocationFavoritesDialog, CustomerManagerDialog, SoraWizardDialog, CloudBackupDialog, StaffelMatrixDialog, PreFlightSafetyDialog, ManualLocationDialog } from './components/lazyDialogs';
import { KnowledgeView, InventoryView, PilotsView } from './views/InfoViews';
import { RoadmapView } from './views/RoadmapView';
import { SafetyView } from './views/SafetyView';
import { ProfileView } from './views/ProfileView';
import { GarageView } from './views/GarageView';

import { LogbookView } from './views/LogbookView';
import { isPinEnabled } from './services/pinProtection';
import type { LocationFavorite, Customer } from './services/db';
import L from 'leaflet';

// Custom Svg Icon for the user location
const droneIcon = L.divIcon({
  html: `<div class="bg-brand-blue w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
          <div class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
         </div>`,
  className: 'custom-div-icon',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const flightHistoryIcon = L.divIcon({
  html: `<div style="background:#10b981;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
  className: 'custom-div-icon',
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const favoriteLocationIcon = L.divIcon({
  html: `<div style="background:#f59e0b;width:18px;height:18px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;">★</div>`,
  className: 'custom-div-icon',
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

type View = 'map' | 'garage' | 'logbook' | 'profile' | 'knowledge' | 'roadmap' | 'safety' | 'inventory' | 'pilots';

export default function App() {
  const [activeView, setActiveView] = useState<View>('map');
  const [drones, setDrones] = useState<Drone[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [location, setLocation] = useState<[number, number]>([52.52, 13.40]);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [showManualLocation, setShowManualLocation] = useState(false);
  // Merkt sich, ob der Standort von Hand gesetzt wurde. Dann nervt die
  // wiederkehrende GPS-Abfrage nicht mehr mit dem Fehler-Banner und
  // überschreibt den gewählten Ort nicht. Ref statt State, weil die
  // Tracking-Schleife (useEffect mit []) den aktuellen Wert lesen muss.
  const manuellerStandort = useRef(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
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
  const [showMehr, setShowMehr] = useState(false);
  const [showPlaner, setShowPlaner] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => ladeTheme());
  const [sprache, setSprache] = useState<Sprache>(() => ladeSprache());
  // Kurzform fuer die Uebersetzung in dieser Komponente.
  const t = (key: string) => uebersetze(key, sprache);
  const spracheWechseln = () => {
    const neu = andereSprache(sprache);
    setzeSprache(neu);
    setSprache(neu);
  };
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  useEffect(() => {
    loadData();

    let weatherTickCounter = 0;

    const locateAndUpdate = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Echtes GPS ist verfügbar — es hat Vorrang, der Handbetrieb endet.
          manuellerStandort.current = false;
          const newLoc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setLocation(newLoc);
          setGpsError(null);
          setIsLocating(false);
          // Update weather on first call, then every 6th tick (= every 60 seconds)
          if (weatherTickCounter === 0) {
            fetchWeather(newLoc[0], newLoc[1]).then(setWeather);
          }
          weatherTickCounter = (weatherTickCounter + 1) % 6;
        },
        (err) => {
          setIsLocating(false);
          // Nach manuell gesetztem Standort nicht weiter mit dem Banner nerven.
          if (manuellerStandort.current) return;
          if (err.code === 1) setGpsError('GPS-Zugriff verweigert. Bitte Standort in den Browser-Einstellungen erlauben.');
          else if (err.code === 3) setGpsError('GPS-Timeout. Standort konnte nicht ermittelt werden.');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };

    setIsLocating(true);
    locateAndUpdate();
    const trackingInterval = setInterval(locateAndUpdate, 10000);
    return () => clearInterval(trackingInterval);
  }, []);

  // Escape schließt offene Overlays — auf Desktop (Windows/Mac) die erwartete
  // Geste. Die App-Sperre (isAppLocked) bleibt bewusst außen vor, damit Esc den
  // PIN-Schutz nicht umgeht. Setter sind stabil, daher leere Abhängigkeiten.
  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setShowManualLocation(false);
      setShowBehoerdenCheck(false);
      setShowEidDialog(false);
      setShowLocationFavoritesDialog(false);
      setShowPinSetup(false);
      setShowCustomerManager(false);
      setShowSoraWizard(false);
      setShowCloudBackup(false);
      setShowStaffelMatrix(false);
      setShowPreFlightSafety(false);
      setShowMehr(false);
      setShowPlaner(false);
    };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
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
  }

  const handleLocate = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLoc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setLocation(newLoc);
        fetchWeather(newLoc[0], newLoc[1]).then(setWeather);
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Reminders in Root-Scope: wird für NavBar-Badges benötigt
  const appReminders = useMemo(
    () => getReminders(profile, drones, batteries, getLastBackupAt()),
    [profile, drones, batteries]
  );
  const highPrioCount = appReminders.filter(r => r.priority === 'high').length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center app-shell bg-brand-blue gap-4">
        <div className="bg-white/20 p-5 rounded-3xl">
          <Plane className="w-14 h-14 text-white animate-pulse" />
        </div>
        <h1 className="text-white font-black text-2xl tracking-tight">SkyLog DE</h1>
        <p className="text-blue-200 text-xs font-bold uppercase tracking-widest">Wird geladen…</p>
      </div>
    );
  }

  return (
    <SprachProvider sprache={sprache}>
    <div className="flex flex-col lg:flex-row app-shell overflow-hidden bg-slate-50 font-sans">
      {/* Inhalts-Spalte: auf Desktop rechts neben der Seitenleiste, auf dem
          Handy der übliche Stapel Header → Inhalt über der unteren Leiste. */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-xs font-bold px-4 py-2 flex items-center gap-2 z-50">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Kein Internet — Wetter &amp; NOTAM nicht verfügbar. Logbuch funktioniert offline.
        </div>
      )}

      {/* Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[200] bg-brand-blue/95 flex flex-col items-center justify-center p-8 text-center">
          <div className="bg-white/20 p-5 rounded-3xl mb-6">
            <Plane className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-white font-black text-3xl tracking-tight mb-2">Willkommen bei<br/>SkyLog DE</h1>
          <p className="text-blue-200 text-sm leading-relaxed mb-8 max-w-xs">Dein digitales Flugbuch für Drohnen. Starte mit deinem Piloten-Profil.</p>
          <div className="space-y-3 w-full max-w-xs">
            <button
              onClick={() => { setShowOnboarding(false); setActiveView('profile'); }}
              className="w-full bg-white text-brand-blue font-black py-4 rounded-2xl shadow-xl text-sm uppercase tracking-widest active:scale-95 transition-all"
            >
              Profil einrichten
            </button>
            <button
              onClick={() => setShowOnboarding(false)}
              className="w-full text-blue-200 font-bold py-2 text-xs uppercase tracking-widest"
            >
              Später
            </button>
          </div>
          <p className="text-blue-300 text-[10px] mt-8">Alle Daten bleiben lokal auf deinem Gerät</p>
        </div>
      )}

      {/* Header */}
      <header className="bg-brand-blue text-white px-4 pb-3 pt-safe flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-2 rounded-lg">
            <Plane className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none tracking-tight">SkyLog DE</h1>
            <p className="text-[10px] text-blue-200 uppercase tracking-widest font-medium">{t('app.untertitel')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-xs font-medium border border-white/5">
            <ShieldCheck className="w-3 h-3 text-green-400" />
            <span>{t('app.konform')}</span>
          </div>
          {/* Behörden-Check: einziger Kopf-Knopf, für eine Kontrolle unterwegs
              schnell erreichbar. Sprache, Design und die selteneren Ansichten
              liegen unten unter „Mehr". */}
          <button
            onClick={() => setShowBehoerdenCheck(true)}
            aria-label={t('a11y.behoerdenCheck')}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <QrCode className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      {/* Kein mode="wait": bei einer Tab-Leiste soll der Wechsel sofort
          passieren, nicht erst nach der Ausblend-Animation der alten View.
          Mit mode="wait" blieb der Wechsel hängen, wenn die Exit-Animation
          der (schweren) Karten-View nicht sauber abschloss. */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence>
          {activeView === 'map' && (
            <motion.div 
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0"
            >
              <DroneMap location={location} onLocate={handleLocate} isLocating={isLocating} weather={weather} flights={flights} locationFavorites={locationFavorites} onPlaner={() => setShowPlaner(true)} />
              {gpsError && (
                <div className="absolute top-4 left-4 right-4 z-[500] bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{gpsError}</span>
                  <button
                    onClick={() => setShowManualLocation(true)}
                    className="shrink-0 bg-white/25 hover:bg-white/35 rounded-lg px-2 py-1 text-[11px] font-bold"
                  >
                    Manuell setzen
                  </button>
                </div>
              )}
              {(() => {
                if (!profile?.licenseExpiry) return null;
                const daysLeft = Math.ceil((new Date(profile.licenseExpiry).getTime() - Date.now()) / 86400000);
                if (daysLeft > 60) return null;
                return (
                  <div className={`absolute ${gpsError ? 'top-16' : 'top-4'} left-4 right-4 z-[500] text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-lg flex items-center gap-2 ${daysLeft <= 0 ? 'bg-brand-red' : 'bg-amber-500'}`}>
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    {daysLeft <= 0
                      ? `Fernpiloten-Lizenz abgelaufen! (${profile.licenseType})`
                      : `Lizenz läuft in ${daysLeft} Tagen ab — ${profile.licenseType}`}
                  </div>
                );
              })()}
              {/* Letzter Flug Karte */}
              {(() => {
                const last = [...flights].sort((a, b) => b.createdAt - a.createdAt)[0];
                if (!last) return null;
                const drone = drones.find(d => d.id === last.droneId);
                return (
                  <div className="absolute bottom-20 left-4 right-4 z-[400] bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-100 px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
                      {drone?.photoUrl
                        ? <img src={drone.photoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                        : <Plane className="w-4 h-4 text-brand-blue" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Letzter Flug</p>
                      <p className="text-xs font-bold text-slate-900 truncate">{last.locationName}</p>
                      <p className="text-[10px] text-slate-400">{new Date(last.date).toLocaleDateString('de-DE')} · {last.duration} min · {drone?.model || '—'}</p>
                    </div>
                    <History className="w-4 h-4 text-slate-300 shrink-0" />
                  </div>
                );
              })()}
              {/* Schnell-Log FAB */}
              <button
                onClick={() => { setActiveView('logbook'); }}
                className="absolute bottom-36 right-4 z-[400] flex items-center gap-2 bg-brand-blue text-white font-black text-xs px-4 py-3 rounded-2xl shadow-xl shadow-brand-blue/40 active:scale-95 transition-all hover:bg-brand-blue/90"
                aria-label="Schnell-Log: Flug hinzufügen"
              >
                <PlusCircle className="w-4 h-4" />
                Flug loggen
              </button>
            </motion.div>
          )}

          {activeView === 'garage' && (
            <motion.div 
              key="garage"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="absolute inset-0 overflow-y-auto p-4 bg-slate-50"
            >
              <GarageView drones={drones} flights={flights} batteries={batteries} onUpdate={loadData} />
            </motion.div>
          )}

          {activeView === 'logbook' && (
            <motion.div 
              key="logbook"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="absolute inset-0 overflow-y-auto p-4 bg-slate-50"
            >
              <LogbookView flights={flights} drones={drones} batteries={batteries} profile={profile} locationFavorites={locationFavorites} onUpdate={loadData} currentLocation={location} onOpenFavorites={() => setShowLocationFavoritesDialog(true)} />
            </motion.div>
          )}

          {activeView === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="absolute inset-0 overflow-y-auto p-4 bg-slate-50"
            >
              <ProfileView profile={profile} documents={documents} onUpdate={loadData} onOpenEid={() => setShowEidDialog(true)} onOpenPinSetup={() => setShowPinSetup(true)} />
            </motion.div>
          )}

          {activeView === 'knowledge' && (
            <motion.div 
              key="knowledge"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="absolute inset-0 overflow-y-auto p-4 bg-slate-50"
            >
              <KnowledgeView />
            </motion.div>
          )}

          {activeView === 'roadmap' && (
            <motion.div 
              key="roadmap"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="absolute inset-0 overflow-y-auto p-4 bg-slate-50"
            >
              <RoadmapView />
            </motion.div>
          )}

          {activeView === 'safety' && (
            <motion.div 
              key="safety"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="absolute inset-0 overflow-y-auto p-4 bg-slate-50"
            >
              <SafetyView profile={profile} drones={drones} onBehoerdenCheck={() => setShowBehoerdenCheck(true)} onOpenEid={() => setShowEidDialog(true)} />
            </motion.div>
          )}

          {activeView === 'inventory' && (
            <motion.div 
              key="inventory"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="absolute inset-0 overflow-y-auto p-4 bg-slate-50"
            >
              <InventoryView />
            </motion.div>
          )}

          {activeView === 'pilots' && (
            <motion.div 
              key="pilots"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="absolute inset-0 overflow-y-auto p-4 bg-slate-50"
            >
              <PilotsView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      </div>

      {/* Navigation: unten als Leiste (Handy), links als Seitenleiste (Tablet/
          Desktop, lg+). Fünf feste Punkte; seltenere Ansichten hinter „Mehr". */}
      <nav className="bg-white border-t border-slate-200 px-2 pt-2 grid grid-cols-5 pb-safe z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:order-first lg:w-60 lg:shrink-0 lg:grid-cols-1 lg:content-start lg:border-t-0 lg:border-r lg:pt-6 lg:px-3 lg:gap-1 lg:shadow-none">
        {/* Marke: nur in der Desktop-Seitenleiste, zur Orientierung. */}
        <div className="hidden lg:flex items-center gap-2.5 px-3 pb-4 mb-2 border-b border-slate-100">
          <div className="bg-brand-blue p-2 rounded-xl shrink-0">
            <Plane className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-black text-slate-900 leading-none truncate">SkyLog DE</p>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-1">Flugbuch</p>
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
          onClick={() => setActiveView('logbook')}
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
          badge={highPrioCount || undefined}
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
            manuellerStandort.current = true;
            setLocation([lat, lon]);
            setGpsError(null);
            fetchWeather(lat, lon).then(setWeather);
            setShowManualLocation(false);
          }}
          onClose={() => setShowManualLocation(false)}
        />
      )}

      {showBehoerdenCheck && (
        <BehoerdenCheckDialog
          profile={profile}
          drohnen={drones}
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
        <CloudBackupDialog
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

      <DialogHost />

      {showMehr && (
        <MehrSheet
          activeView={activeView}
          theme={theme}
          sprache={sprache}
          onWaehle={(v) => { setActiveView(v); setShowMehr(false); }}
          onTheme={() => setTheme(toggleTheme(theme))}
          onSprache={spracheWechseln}
          onOpenCrm={() => { setShowMehr(false); setShowCustomerManager(true); }}
          onOpenSora={() => { setShowMehr(false); setShowSoraWizard(true); }}
          onOpenCloudBackup={() => { setShowMehr(false); setShowCloudBackup(true); }}
          onOpenStaffelMatrix={() => { setShowMehr(false); setShowStaffelMatrix(true); }}
          onOpenPreFlightSafety={() => { setShowMehr(false); setShowPreFlightSafety(true); }}
          onClose={() => setShowMehr(false)}
        />
      )}
    </div>
    </SprachProvider>
  );
}

// Ansichten, die nicht mehr fest unten stehen, sondern hinter „Mehr" liegen.
// Eigene Konstante, damit der „Mehr"-Knopf zuverlässig aktiv wird, sobald eine
// davon offen ist — ohne die Liste an zwei Stellen pflegen zu müssen.
const MEHR_VIEWS: View[] = ['inventory', 'pilots', 'knowledge', 'roadmap', 'profile'];

/** Das „Mehr"-Blatt: die selteneren Ansichten plus die zwei Schnell-
 *  einstellungen (Sprache, Design), die vorher oben im Kopf klebten. */
function MehrSheet({
  activeView,
  theme,
  sprache,
  onWaehle,
  onTheme,
  onSprache,
  onOpenCrm,
  onOpenSora,
  onOpenCloudBackup,
  onOpenStaffelMatrix,
  onOpenPreFlightSafety,
  onClose,
}: {
  activeView: View;
  theme: Theme;
  sprache: Sprache;
  onWaehle: (v: View) => void;
  onTheme: () => void;
  onSprache: () => void;
  onOpenCrm: () => void;
  onOpenSora: () => void;
  onOpenCloudBackup: () => void;
  onOpenStaffelMatrix: () => void;
  onOpenPreFlightSafety: () => void;
  onClose: () => void;
}) {
  const { t } = useSprache();
  const eintraege: { view: View; icon: any; label: string }[] = [
    { view: 'inventory', icon: Printer, label: t('nav.inventar') },
    { view: 'pilots', icon: User, label: t('nav.piloten') },
    { view: 'knowledge', icon: Library, label: t('nav.lbaInfo') },
    { view: 'roadmap', icon: TrendingUp, label: t('nav.roadmap') },
    { view: 'profile', icon: Settings, label: t('nav.profil') },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-slate-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0 bg-white sm:rounded-t-3xl">
          <h3 className="font-black text-slate-900">{t('nav.mehr')}</h3>
          <button onClick={onClose} aria-label={t('aktion.schliessen')} className="p-2 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 space-y-4">
          {/* Pro Werkzeuge */}
          <div>
            <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider px-1 mb-1.5">Pro Werkzeuge</p>
            <div className="space-y-1.5">
              <button
                onClick={onOpenPreFlightSafety}
                className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" />
                <span className="text-sm font-bold flex-1 text-slate-800">Pre-Flight Safety Score & Kp-Index</span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>

              <button
                onClick={onOpenCrm}
                className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <Building2 className="w-5 h-5 shrink-0 text-blue-600" />
                <span className="text-sm font-bold flex-1 text-slate-800">CRM & Kundenverwaltung</span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>

              <button
                onClick={onOpenSora}
                className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <Shield className="w-5 h-5 shrink-0 text-indigo-600" />
                <span className="text-sm font-bold flex-1 text-slate-800">EASA SORA 2.5 PDF Assistent</span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>

              <button
                onClick={onOpenCloudBackup}
                className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <Cloud className="w-5 h-5 shrink-0 text-cyan-600" />
                <span className="text-sm font-bold flex-1 text-slate-800">Auto Cloud-Backup & Sync</span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>

              <button
                onClick={onOpenStaffelMatrix}
                className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <Layers className="w-5 h-5 shrink-0 text-amber-600" />
                <span className="text-sm font-bold flex-1 text-slate-800">Staffel- & Flottenmatrix</span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          </div>

          {/* Ansichten */}
          <div className="space-y-1.5">
            {eintraege.map(({ view, icon: Icon, label }) => (
              <button
                key={view}
                onClick={() => onWaehle(view)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                  activeView === view
                    ? 'bg-brand-blue/10 border-brand-blue/30'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                )}
              >
                <Icon className={cn('w-5 h-5 shrink-0', activeView === view ? 'text-brand-blue' : 'text-slate-400')} />
                <span className={cn('text-sm font-bold flex-1', activeView === view ? 'text-brand-blue' : 'text-slate-700')}>{label}</span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            ))}
          </div>

          {/* Schnelleinstellungen */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1.5">{t('mehr.einstellungen')}</p>
            <div className="space-y-1.5">
              <button
                onClick={onSprache}
                className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <Languages className="w-5 h-5 shrink-0 text-slate-400" />
                <span className="text-sm font-bold flex-1 text-slate-700">{t('mehr.sprache')}</span>
                <span className="text-xs font-black text-brand-blue tracking-wider">{sprache.toUpperCase()}</span>
              </button>
              <button
                onClick={onTheme}
                className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5 shrink-0 text-slate-400" /> : <Moon className="w-5 h-5 shrink-0 text-slate-400" />}
                <span className="text-sm font-bold flex-1 text-slate-700">{t('mehr.design')}</span>
                <span className="text-xs font-bold text-slate-400">
                  {theme === 'dark' ? t('mehr.dunkel') : t('mehr.hell')}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon: Icon, label, badge }: { active: boolean, onClick: () => void, icon: any, label: string, badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-2xl transition-all duration-200 touch-shrink relative",
        "lg:flex-row lg:justify-start lg:gap-3 lg:w-full lg:px-4 lg:py-2.5 lg:rounded-xl",
        active ? "text-brand-blue lg:bg-brand-blue/10" : "text-slate-400 hover:text-slate-600 lg:hover:bg-slate-50"
      )}
    >
      {active && (
        <span className="absolute -top-1 w-6 h-1 bg-brand-blue rounded-full shadow-sm shadow-brand-blue/50 lg:top-1/2 lg:-translate-y-1/2 lg:left-0 lg:w-1 lg:h-7" />
      )}
      <div className={cn(
        "p-1.5 rounded-xl transition-all duration-200 relative",
        active ? "bg-brand-blue/12 scale-110 shadow-sm" : "bg-transparent"
      )}>
        <Icon className={cn("w-5 h-5 transition-transform", active ? "stroke-[2.5px]" : "stroke-[1.75px]")} />
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-[3px] leading-none shadow-md border border-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className={cn("text-[10px] lg:text-[13px] font-bold uppercase tracking-wider transition-opacity", active ? "opacity-100 font-extrabold" : "opacity-70")}>{label}</span>
    </button>
  );
}

function DroneMap({ location, onLocate, isLocating, weather, flights, locationFavorites = [], onPlaner }: { location: [number, number], onLocate: () => void, isLocating: boolean, weather: WeatherData | null, flights: Flight[], locationFavorites?: LocationFavorite[], onPlaner: () => void }) {
  const { t } = useSprache();
  const [infoPoint, setInfoPoint] = useState<[number, number] | null>(null);
  // Grundkarte waehlen. Reihenfolge: heruntergeladene Region (beste, weil
  // offline und vom Nutzer bewusst geholt) > mitgelieferte Datei > online.
  const [offlineKarte, setOfflineKarte] = useState(false);
  const [geladeneKarte, setGeladeneKarte] = useState<PMTiles | null>(null);
  const [zeigeKarten, setZeigeKarten] = useState(false);

  const pruefeKarten = async () => {
    const codes = regionenFuerStandort(location[0], location[1]).map(r => r.code);
    const karte = await karteFuerStandort(codes);
    setGeladeneKarte(karte ? alsPmtiles(karte) : null);
  };

  // Importierte Zonen fremder Laender. Nur die im Umkreis werden gezeichnet —
  // ein ganzes Land waeren mehrere hundert Polygone.
  const [euZonen, setEuZonen] = useState<Ed269Zone[]>([]);
  const [zeigeEuZonen, setZeigeEuZonen] = useState(false);
  const [zeigePreFlightSafety, setZeigePreFlightSafety] = useState(false);

  const ladeEuZonen = async () => {
    const laender = laenderFuerKoordinate(location[0], location[1]);
    for (const code of laender) {
      const quelle = quelleFuer(code);
      if (quelle?.direktUrl) {
        try {
          const vorhanden = await dbService.getEuZonen();
          if (!vorhanden.some(v => v.land === code)) {
            const url = `/api/zonen/${code}`;
            const res = await fetch(url);
            if (res.ok) {
              const text = await res.text();
              const zonen = parseEd269(text);
              await dbService.saveEuZonen({ land: code, zonen, anzahl: zonen.length, importiertAm: Date.now() });
            }
          }
        } catch (err) {
          console.warn(`Auto-Fetch für Geozonen ${code} fehlgeschlagen:`, err);
        }
      }
    }
    const eintraege = await dbService.getEuZonen();
    const alle = eintraege.flatMap(e => e.zonen as Ed269Zone[]);
    setEuZonen(zonenInUmkreis(alle, location[0], location[1]));
  };

  useEffect(() => { pruefeOfflineKarte().then(setOfflineKarte); }, []);
  useEffect(() => { pruefeKarten(); }, [location[0], location[1]]);
  useEffect(() => { ladeEuZonen(); }, [location[0], location[1]]);

  function MapEvents() {
    useMapEvents({
      click(e) {
        setInfoPoint([e.latlng.lat, e.latlng.lng]);
      }
    });
    return null;
  }

  function Recenter({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
      map.setView(center, 13);
    }, [center]);
    return null;
  }

  return (
    <div className="w-full h-full relative">
      <MapContainer 
        center={location} 
        zoom={13} 
        className="w-full h-full"
        zoomControl={false}
      >
        {/* Grundkarte: Liegt die mitgelieferte Offline-Karte vor (wird beim Bau
            erzeugt, siehe scripts/karte-extrahieren.mjs), wird sie benutzt —
            sonst wie bisher die Online-Kacheln. Kein Bruch, wenn die Datei
            fehlt; beim Entwickeln ist das der Normalfall. */}
        {geladeneKarte
          ? <OfflineBasemap url={geladeneKarte} />
          : offlineKarte
            ? <OfflineBasemap url={OFFLINE_KARTE_URL} />
            : (
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
              />
            )}
        
        {/* DIPUL Geo-Zonen (DFS/dipul).
            Zwei Fallstricke, beide am 2026-07-23 gegen den Live-Dienst geprüft:
            1) Der Pfad heißt /geoservices/ — das frühere /geoserver/ liefert
               seit einer Umstellung 404 (HTML-Startseite).
            2) Einen Sammel-Layer "dipul:geozonen" gibt es nicht mehr; der
               Dienst gibt die Zonen einzeln aus. Beides zusammen führte dazu,
               dass das Overlay still leer blieb.
            WMS akzeptiert eine kommagetrennte Layerliste. */}
        <WMSTileLayer
          url="https://uas-betrieb.de/geoservices/dipul/wms"
          layers={[
            'dipul:flugbeschraenkungsgebiete',
            'dipul:kontrollzonen',
            'dipul:flughaefen',
            'dipul:flugplaetze',
            'dipul:naturschutzgebiete',
            'dipul:nationalparks',
            'dipul:militaerische_anlagen',
            'dipul:krankenhaeuser',
            'dipul:industrieanlagen',
            'dipul:kraftwerke',
            'dipul:justizvollzugsanstalten',
            'dipul:freibaeder',
            'dipul:bahnanlagen',
            'dipul:stromleitungen',
          ].join(',')}
          format="image/png"
          transparent={true}
          version="1.3.0"
          opacity={0.6}
        />

        {/* Zonen fremder Laender (importiert). Liegen ueber der Grundkarte,
            genau wie das deutsche Overlay. */}
        <EuZoneLayer zonen={euZonen} />

        <Marker position={location} icon={droneIcon}>
          <Popup>Ihr Standort</Popup>
        </Marker>

        {/* Past flight locations */}
        {flights.filter(f => f.coordinates).slice(0, 30).map(f => (
          <Marker key={f.id} position={f.coordinates} icon={flightHistoryIcon}>
            <Popup>
              <div className="p-1 text-xs min-w-[140px]">
                <p className="font-bold text-slate-800 mb-1">{f.locationName || 'Unbekannter Ort'}</p>
                <p className="text-slate-500">{f.date} · {f.duration} min</p>
                {f.pilotName && <p className="text-slate-400 text-[10px] mt-0.5">{f.pilotName}</p>}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Saved Favorite Locations */}
        {locationFavorites.map(fav => (
          <Marker key={fav.id} position={fav.coordinates} icon={favoriteLocationIcon}>
            <Popup>
              <div className="p-1 text-xs min-w-[150px]">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-amber-500 font-bold">★</span>
                  <p className="font-bold text-slate-900">{fav.name}</p>
                </div>
                <p className="text-slate-500 font-medium">{fav.locationName}</p>
                {fav.notes && <p className="text-slate-400 italic text-[10px] mt-1">{fav.notes}</p>}
              </div>
            </Popup>
          </Marker>
        ))}

        <MapEvents />
        <Recenter center={location} />

        {infoPoint && (
          <Popup position={infoPoint} onClose={() => setInfoPoint(null)}>
            <div className="p-1 min-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-brand-blue" />
                <h3 className="font-bold text-sm">Zone Information</h3>
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <p>Besuchen Sie <span className="font-semibold text-brand-blue">dipul.de</span> für detaillierte Verbote am Standort [{infoPoint[0].toFixed(4)}, {infoPoint[1].toFixed(4)}].</p>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-red" />
                    <span className="font-medium">Flugbeschränkung möglich</span>
                  </div>
                </div>
              </div>
            </div>
          </Popup>
        )}
      </MapContainer>

      {/* Map UI Overlays */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-[400]">
        <button 
          onClick={onLocate}
          className={cn(
            "bg-white p-3 rounded-2xl shadow-lg border border-slate-200 transition-all active:scale-95 flex items-center justify-center",
            isLocating ? "animate-pulse brightness-95" : ""
          )}
        >
          <Navigation className={cn("w-6 h-6", isLocating ? "text-slate-400" : "text-brand-blue")} />
        </button>

        {/* Flugplaner: Route vorab auf der Karte anlegen */}
        <button
          onClick={onPlaner}
          aria-label={t('a11y.planer')}
          className="bg-white p-3 rounded-2xl shadow-lg border border-slate-200 transition-all active:scale-95 flex items-center justify-center"
        >
          <Route className="w-6 h-6 text-brand-blue" />
        </button>

        {/* Offline-Karten verwalten. Gruen, sobald fuer den Standort eine
            Karte auf dem Geraet liegt — das ist die Information, die vor dem
            Losfahren ins Funkloch zaehlt. */}
        <button
          onClick={() => setZeigeKarten(true)}
          aria-label="Offline-Karten verwalten"
          className="bg-white p-3 rounded-2xl shadow-lg border border-slate-200 transition-all active:scale-95 flex items-center justify-center"
        >
          <DownloadCloud className={cn('w-6 h-6', geladeneKarte ? 'text-brand-green' : 'text-slate-400')} />
        </button>

        {/* Zonen fremder Laender. Gruen, sobald welche importiert sind. */}
        <button
          onClick={() => setZeigeEuZonen(true)}
          aria-label="Zonen anderer Länder"
          className="bg-white p-3 rounded-2xl shadow-lg border border-slate-200 transition-all active:scale-95 flex items-center justify-center"
        >
          <Globe2 className={cn('w-6 h-6', euZonen.length > 0 ? 'text-brand-green' : 'text-slate-400')} />
        </button>

        {weather && (
          <div className="bg-white p-3 rounded-2xl shadow-lg border border-slate-200 flex flex-col gap-4 items-center">
            <div className="flex flex-col items-center gap-1">
              <Wind className={cn("w-5 h-5", weather.windSpeed > 15 ? "text-brand-red" : "text-brand-green")} />
              <span className="text-[10px] font-bold text-slate-600">{weather.windSpeed} km/h</span>
            </div>
            <div className="flex flex-col items-center gap-1 border-t border-slate-100 pt-3">
              <Thermometer className="w-5 h-5 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-600">{weather.temp}°C</span>
            </div>
            <div className="flex flex-col items-center gap-1 border-t border-slate-100 pt-3">
              <CloudRain className="w-5 h-5 text-blue-400" />
              <span className="text-[10px] font-bold text-slate-500 leading-tight text-center">{weather.condition}</span>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 left-4 right-4 z-[400]">
        <button 
          onClick={() => setZeigePreFlightSafety(true)}
          className="w-full bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-white/50 flex items-center justify-between hover:bg-white active:scale-[0.98] transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                Vorflug-Sicherheitsanalyse & Kp-Index
              </p>
              <p className="text-[10px] text-slate-500 font-medium">Klick für 0-100% Sicherheits-Check</p>
            </div>
          </div>
          <span className="bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 group-hover:bg-emerald-600 transition-colors">
            Score
          </span>
        </button>
      </div>

      {zeigeKarten && (
        <OfflineMapsDialog
          lat={location[0]}
          lon={location[1]}
          onClose={() => setZeigeKarten(false)}
          onGeaendert={pruefeKarten}
        />
      )}

      {zeigeEuZonen && (
        <EuZonesDialog
          onClose={() => setZeigeEuZonen(false)}
          onGeaendert={ladeEuZonen}
        />
      )}

      {zeigePreFlightSafety && (
        <PreFlightSafetyDialog
          weather={weather}
          drone={null}
          battery={null}
          profile={null}
          onClose={() => setZeigePreFlightSafety(false)}
        />
      )}
    </div>
  );
}

