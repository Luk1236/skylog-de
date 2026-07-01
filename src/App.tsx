import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { 
  Plane, 
  Map as MapIcon, 
  Book, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Info, 
  Navigation,
  Download,
  Settings,
  ShieldCheck,
  Wind,
  Thermometer,
  CloudRain,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  FileDigit,
  User,
  ExternalLink,
  ArrowRight,
  ShieldAlert,
  Library,
  Scale,
  BadgeAlert,
  CheckCircle,
  XCircle,
  Sparkles,
  BrainCircuit,
  ClipboardCheck,
  Zap,
  MapPin,
  Camera,
  Timer,
  Play,
  Square,
  History,
  Hourglass,
  Wrench,
  Clock,
  Settings2,
  TrendingUp,
  BarChart3,
  Calendar,
  Printer,
  Cpu,
  Upload,
  DatabaseBackup,
  Bell,
  ListChecks
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { cn } from './lib/utils';
import { dbService, type Drone, type Flight, type AppDocument, type Battery, type UserProfile, type UASClass, type MaintenanceRecord, type Pilot, type SparePart } from './services/db';
import { fetchWeather, fetchForecast, type WeatherData, type ForecastHour } from './services/weather';
import { fetchNotams, getGermanFir, formatNotamDate, summariseNotam, type Notam } from './services/notam';
import { exportBackup, importBackup } from './services/backup';
import { getReminders } from './services/reminders';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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

type View = 'map' | 'garage' | 'logbook' | 'profile' | 'knowledge' | 'roadmap' | 'safety' | 'inventory' | 'pilots';

const CHECKLIST_ITEMS = [
  {
    title: "Technik & Akku",
    icon: Zap,
    items: [
      { id: 'battery_drone', label: 'Flugakku voll geladen & fest arretiert' },
      { id: 'battery_rc', label: 'Fernsteuerung & Smartphone geladen' },
      { id: 'props', label: 'Propeller fest & ohne Risse/Schäden' },
      { id: 'sd_card', label: 'SD-Karte eingelegt & Speicher frei' },
      { id: 'gimbal', label: 'Gimbal-Schutz entfernt' }
    ]
  },
  {
    title: "Umgebung & Wetter",
    icon: Wind,
    items: [
      { id: 'weather', label: 'Wind & Sichtweiten innerhalb der Limits' },
      { id: 'kp_index', label: 'GPS-Empfang stabil (KP-Index niedrig)' },
      { id: 'objects', label: 'Keine Hindernisse (Bäume, Leitungen) im Startbereich' },
      { id: 'people', label: 'Keine unbeteiligten Personen im Gefahrenbereich' }
    ]
  },
  {
    title: "System & Software",
    icon: ShieldCheck,
    items: [
      { id: 'homepoint', label: 'Homepoint (RTH) aktualisiert' },
      { id: 'max_height', label: 'Flughöhen-Limit eingestellt (max 120m)' },
      { id: 'registration', label: 'e-ID sichtbar an der Drohne angebracht' },
      { id: 'map_check', label: 'DIPUL/Geo-Zonen Regelung geprüft' }
    ]
  }
];

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
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
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

  async function loadData() {
    const [d, f, doc, b, p] = await Promise.all([
      dbService.getDrones(),
      dbService.getFlights(),
      dbService.getDocuments(),
      dbService.getBatteries(),
      dbService.getProfile(),
    ]);
    setDrones(d);
    setFlights(f);
    setDocuments(doc);
    setBatteries(b);
    setProfile(p);
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
    <div className="flex flex-col app-shell overflow-hidden bg-slate-50 font-sans">
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
            <p className="text-[10px] text-blue-200 uppercase tracking-widest font-medium">LBA Info & Flight Log</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-xs font-medium border border-white/5">
            <ShieldCheck className="w-3 h-3 text-green-400" />
            <span>LBA Konform</span>
          </div>
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {activeView === 'map' && (
            <motion.div 
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <DroneMap location={location} onLocate={handleLocate} isLocating={isLocating} weather={weather} flights={flights} />
              {gpsError && (
                <div className="absolute top-4 left-4 right-4 z-[500] bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {gpsError}
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
            </motion.div>
          )}

          {activeView === 'garage' && (
            <motion.div 
              key="garage"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
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
              exit={{ x: -50, opacity: 0 }}
              className="absolute inset-0 overflow-y-auto p-4 bg-slate-50"
            >
              <LogbookView flights={flights} drones={drones} batteries={batteries} profile={profile} onUpdate={loadData} currentLocation={location} />
            </motion.div>
          )}

          {activeView === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              className="absolute inset-0 overflow-y-auto p-4 bg-slate-50"
            >
              <ProfileView profile={profile} documents={documents} onUpdate={loadData} />
            </motion.div>
          )}

          {activeView === 'knowledge' && (
            <motion.div 
              key="knowledge"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
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
              exit={{ x: -50, opacity: 0 }}
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
              exit={{ x: -50, opacity: 0 }}
              className="absolute inset-0 overflow-y-auto p-4 bg-slate-50"
            >
              <SafetyView />
            </motion.div>
          )}

          {activeView === 'inventory' && (
            <motion.div 
              key="inventory"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
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
              exit={{ x: -50, opacity: 0 }}
              className="absolute inset-0 overflow-y-auto p-4 bg-slate-50"
            >
              <PilotsView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-slate-200 px-2 pt-2 flex items-center justify-between pb-safe z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] overflow-x-auto no-scrollbar">
        <NavButton 
          active={activeView === 'map'} 
          onClick={() => setActiveView('map')}
          icon={MapIcon}
          label="Karte"
        />
        <NavButton 
          active={activeView === 'garage'} 
          onClick={() => setActiveView('garage')}
          icon={Plane}
          label="Garage"
        />
        <NavButton 
          active={activeView === 'logbook'} 
          onClick={() => setActiveView('logbook')}
          icon={Book}
          label="Logbuch"
        />
        <NavButton 
          active={activeView === 'inventory'} 
          onClick={() => setActiveView('inventory')}
          icon={Printer}
          label="Inventar"
        />
        <NavButton 
          active={activeView === 'pilots'} 
          onClick={() => setActiveView('pilots')}
          icon={User}
          label="Piloten"
        />
        <NavButton 
          active={activeView === 'knowledge'} 
          onClick={() => setActiveView('knowledge')}
          icon={Library}
          label="LBA Info"
        />
        <NavButton 
          active={activeView === 'profile'} 
          onClick={() => setActiveView('profile')}
          icon={Settings}
          label="Profil"
        />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 py-1 transition-all",
        active ? "text-brand-blue" : "text-slate-400 font-normal"
      )}
    >
      <div className={cn(
        "p-1.5 rounded-xl transition-all",
        active ? "bg-brand-blue/10 scale-110" : ""
      )}>
        <Icon className={cn("w-6 h-6", active ? "stroke-[2.5px]" : "stroke-[1.5px]")} />
      </div>
      <span className={cn("text-[10px] font-bold uppercase tracking-wider", active ? "opacity-100" : "opacity-80")}>{label}</span>
    </button>
  );
}

function DroneMap({ location, onLocate, isLocating, weather, flights }: { location: [number, number], onLocate: () => void, isLocating: boolean, weather: WeatherData | null, flights: Flight[] }) {
  const [infoPoint, setInfoPoint] = useState<[number, number] | null>(null);

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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
        />
        
        {/* DIPUL Geo-Zones WMS */}
        <WMSTileLayer
          url="https://uas-betrieb.de/geoserver/dipul/wms"
          layers="dipul:geozonen"
          format="image/png"
          transparent={true}
          version="1.3.0"
          opacity={0.6}
        />

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
        <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-white/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-green/20 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-brand-green" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Status: Flugbereit</p>
              <p className="text-[10px] text-slate-500 font-medium">UAS-Kategorie Open A1/A3</p>
            </div>
          </div>
          <button className="bg-brand-blue text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-brand-blue/20">
            Check OK
          </button>
        </div>
      </div>
    </div>
  );
}

function GarageView({ drones, flights, batteries, onUpdate }: { drones: Drone[], flights: Flight[], batteries: Battery[], onUpdate: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingDroneId, setEditingDroneId] = useState<string | null>(null);
  const [newDrone, setNewDrone] = useState<Partial<Drone>>({});
  const [showAddBattery, setShowAddBattery] = useState(false);
  const [newBattery, setNewBattery] = useState<Partial<Battery>>({});
  
  // Stats and Suggestions
  const [droneStats, setDroneStats] = useState<Record<string, { hours: number, flights: number, lastMaint: Record<string, number>, lastMaintHours: Record<string, number>, flightsSinceMaint: Record<string, number> }>>({});

  useEffect(() => {
    const loadStats = async () => {
      const allFlights = await dbService.getFlights();
      const stats: Record<string, { hours: number, flights: number, lastMaint: Record<string, number>, lastMaintHours: Record<string, number>, flightsSinceMaint: Record<string, number> }> = {};

      for (const drone of drones) {
        const dFlights = allFlights.filter(f => f.droneId === drone.id);
        const dMaint = await dbService.getMaintenance(drone.id);

        const lastMaint: Record<string, number> = {};
        const lastMaintHours: Record<string, number> = {};

        dMaint.forEach(m => {
          if (!lastMaint[m.type] || m.createdAt > lastMaint[m.type]) {
            lastMaint[m.type] = m.createdAt;
            lastMaintHours[m.type] = m.hoursAtMaintenance || 0;
          }
        });

        const flightsSinceMaint: Record<string, number> = {};
        for (const type of Object.keys(lastMaint)) {
          flightsSinceMaint[type] = dFlights.filter(f => f.createdAt > lastMaint[type]).length;
        }

        stats[drone.id] = {
          hours: dFlights.reduce((acc, f) => acc + (f.duration / 60), 0),
          flights: dFlights.length,
          lastMaint,
          lastMaintHours,
          flightsSinceMaint
        };
      }
      setDroneStats(stats);
    };
    loadStats();
  }, [drones, flights]); // Add flights to deps to update stats when a flight is added

  const getMaintenanceAlerts = (droneId: string) => {
    const stats = droneStats[droneId];
    if (!stats) return [];
    
    const alerts: { type: string, reason: string, detail: string }[] = [];
    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const oneYear = 365 * 24 * 60 * 60 * 1000;

    // Firmware check (90 days)
    if (!stats.lastMaint['Firmware'] || (now - stats.lastMaint['Firmware']) > ninetyDays) {
      alerts.push({ type: 'Firmware', reason: 'Update fällig', detail: 'Firmware-Update seit über 90 Tagen nicht durchgeführt.' });
    }

    // Propeller check (10 hours OR 50 flights since last check)
    const propFlights = stats.flightsSinceMaint?.['Propeller'] ?? stats.flights;
    if (stats.hours > 10 && (!stats.lastMaint['Propeller'] || (stats.hours - (stats.lastMaintHours['Propeller'] || 0)) > 10)) {
      alerts.push({ type: 'Propeller', reason: 'Sichtprüfung (10h)', detail: 'Propeller auf Haarrisse und Abnutzung prüfen.' });
    } else if (propFlights >= 50) {
      alerts.push({ type: 'Propeller', reason: `${propFlights} Flüge seit letztem Check`, detail: 'Empfehlung: Propeller nach 50 Flügen sorgfältig prüfen oder tauschen.' });
    }

    // Motor check (25 hours OR 100 flights)
    const motorFlights = stats.flightsSinceMaint?.['Motor'] ?? stats.flights;
    if (stats.hours > 25 && (!stats.lastMaint['Motor'] || (stats.hours - (stats.lastMaintHours['Motor'] || 0)) > 25)) {
      alerts.push({ type: 'Motor', reason: 'Motorreinigung (25h)', detail: 'Motoren auf Fremdkörper prüfen und mit Druckluft reinigen.' });
    } else if (motorFlights >= 100) {
      alerts.push({ type: 'Motor', reason: `${motorFlights} Flüge seit letzter Reinigung`, detail: 'Empfehlung: Motoren nach 100 Flügen reinigen und auf Lager prüfen.' });
    }

    // Sensor check (6 months)
    const sixMonths = 180 * 24 * 60 * 60 * 1000;
    if (!stats.lastMaint['Sensor'] || (now - stats.lastMaint['Sensor']) > sixMonths) {
      alerts.push({ type: 'Sensor', reason: 'Sensor-Kalibrierung', detail: 'IMU und Kompass-Kalibrierung für optimale Stabilität empfohlen.' });
    }

    // General check (1 year)
    if (!stats.lastMaint['General'] || (now - stats.lastMaint['General']) > oneYear) {
      alerts.push({ type: 'General', reason: 'Jahresservice', detail: 'Vollständiger Systemcheck nach einem Jahr Betrieb empfohlen.' });
    }

    return alerts;
  };

  const [selectedDroneId, setSelectedDroneId] = useState<string | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [showMaintForm, setShowMaintForm] = useState(false);
  const [newMaint, setNewMaint] = useState<Partial<MaintenanceRecord>>({ type: 'General' });
  const [maintFilter, setMaintFilter] = useState<MaintenanceRecord['type'] | 'All'>('All');
  const [dateFilter, setDateFilter] = useState<'All' | '30Days' | '3Months' | '1Year'>('All');

  useEffect(() => {
    if (selectedDroneId) {
      dbService.getMaintenance(selectedDroneId).then(setMaintenance);
      setMaintFilter('All');
      setDateFilter('All');
    }
  }, [selectedDroneId]);

  const filteredMaintenance = useMemo(() => {
    const now = Date.now();
    const thresholds = {
      '30Days': now - (30 * 24 * 60 * 60 * 1000),
      '3Months': now - (90 * 24 * 60 * 60 * 1000),
      '1Year': now - (365 * 24 * 60 * 60 * 1000)
    };

    return maintenance
      .filter(m => {
        const matchesType = maintFilter === 'All' ? true : m.type === maintFilter;
        if (!matchesType) return false;

        if (dateFilter === 'All') return true;
        return m.createdAt >= (thresholds[dateFilter] || 0);
      })
      .sort((a,b) => b.createdAt - a.createdAt);
  }, [maintenance, maintFilter, dateFilter]);

  const handleAddMaint = async () => {
    if (!selectedDroneId || !newMaint.description) return;
    const stats = droneStats[selectedDroneId];
    const record: MaintenanceRecord = {
      id: crypto.randomUUID(),
      droneId: selectedDroneId,
      date: new Date().toISOString().split('T')[0],
      type: newMaint.type as any,
      description: newMaint.description,
      hoursAtMaintenance: stats?.hours || 0,
      createdAt: Date.now()
    };
    await dbService.saveMaintenance(record);
    const updated = await dbService.getMaintenance(selectedDroneId);
    setMaintenance(updated);
    setNewMaint({ type: 'General' });
    setShowMaintForm(false);
  };

  const handleAdd = async () => {
    if (!newDrone.model) return;
    
    if (editingDroneId) {
      const droneToUpdate = drones.find(d => d.id === editingDroneId);
      if (droneToUpdate) {
        await dbService.saveDrone({
          ...droneToUpdate,
          model: newDrone.model,
          weight: newDrone.weight || 0,
          uasClass: (newDrone.uasClass as UASClass) || 'Legacy',
          eId: newDrone.eId || '',
          serialNumber: newDrone.serialNumber || '',
          firmwareVersion: newDrone.firmwareVersion || '',
          insuranceNumber: newDrone.insuranceNumber || '',
          maxWindSpeed: newDrone.maxWindSpeed,
          photoUrl: newDrone.photoUrl,
        });
      }
    } else {
      await dbService.saveDrone({
        id: crypto.randomUUID(),
        model: newDrone.model,
        weight: newDrone.weight || 0,
        uasClass: (newDrone.uasClass as UASClass) || 'Legacy',
        eId: newDrone.eId || '',
        serialNumber: newDrone.serialNumber || '',
        firmwareVersion: newDrone.firmwareVersion || '',
        insuranceNumber: newDrone.insuranceNumber || '',
        maxWindSpeed: newDrone.maxWindSpeed,
        photoUrl: newDrone.photoUrl,
        createdAt: Date.now()
      });
    }

    setNewDrone({});
    setEditingDroneId(null);
    setShowAdd(false);
    onUpdate();
  };

  const handleEditDrone = (drone: Drone) => {
    setNewDrone({
      model: drone.model,
      weight: drone.weight,
      uasClass: drone.uasClass,
      eId: drone.eId,
      serialNumber: drone.serialNumber,
      firmwareVersion: drone.firmwareVersion,
      insuranceNumber: drone.insuranceNumber,
      maxWindSpeed: drone.maxWindSpeed,
      photoUrl: drone.photoUrl,
    });
    setEditingDroneId(drone.id);
    setShowAdd(true);
  };

  const handleAddBattery = async () => {
    if (!newBattery.number) return;
    await dbService.saveBattery({
      id: crypto.randomUUID(),
      number: newBattery.number,
      cycles: 0,
      createdAt: Date.now()
    });
    setNewBattery({});
    setShowAddBattery(false);
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Drohne wirklich löschen?')) {
      await dbService.deleteDrone(id);
      onUpdate();
    }
  };

  const handleDeleteBattery = async (id: string) => {
    if (confirm('Akku wirklich löschen?')) {
      await dbService.deleteBattery(id);
      onUpdate();
    }
  };

  return (
    <div className="max-w-md mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand-blue">Flotte</h2>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">Drohnen Management</p>
        </div>
        <button 
          onClick={() => {
            if (showAdd && editingDroneId) {
              setEditingDroneId(null);
              setNewDrone({});
            } else {
              setShowAdd(!showAdd);
            }
          }}
          className="bg-brand-blue text-white p-2.5 rounded-2xl shadow-lg shadow-brand-blue/20 transition-transform active:scale-95"
        >
          {showAdd ? <XCircle className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {/* Prominent Maintenance Dashboard Summary */}
      {drones.some(d => getMaintenanceAlerts(d.id).length > 0) && (
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8 p-5 bg-gradient-to-br from-amber-500 to-brand-orange rounded-[32px] shadow-xl shadow-brand-orange/20 text-white overflow-hidden relative"
        >
          <div className="absolute top-[-20%] right-[-10%] opacity-10 rotate-12">
            <Wrench className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <BadgeAlert className="w-5 h-5 text-white animate-bounce" />
              <h3 className="font-black text-xs uppercase tracking-[0.2em]">Wartung erforderlich</h3>
            </div>
            <p className="text-sm font-medium opacity-90 mb-4">Mehrere Drohnen benötigen Aufmerksamkeit für sicheren Flugbetrieb.</p>
            <div className="flex flex-wrap gap-2">
              {drones.filter(d => getMaintenanceAlerts(d.id).length > 0).map(d => (
                <button 
                  key={d.id}
                  onClick={() => setSelectedDroneId(d.id)}
                  className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/30 transition-all border border-white/10"
                >
                  {d.model} ({getMaintenanceAlerts(d.id).length})
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">
                {editingDroneId ? 'Drohne bearbeiten' : 'Neue Drohne registrieren'}
              </h3>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Modell / Name</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                  placeholder="z.B. DJI Mini 4 Pro"
                  value={newDrone.model || ''}
                  onChange={e => setNewDrone({...newDrone, model: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Gewicht (g)</label>
                  <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" placeholder="249" value={newDrone.weight || ''} onChange={e => setNewDrone({...newDrone, weight: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">C-Klasse</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={newDrone.uasClass || 'Legacy'} onChange={e => setNewDrone({...newDrone, uasClass: e.target.value as UASClass})}>
                    <option value="C0">C0 (&lt; 250g)</option>
                    <option value="C1">C1 (&lt; 900g)</option>
                    <option value="C2">C2 (&lt; 4kg)</option>
                    <option value="C3">C3 (&lt; 25kg)</option>
                    <option value="C4">C4 (Flugmodelle)</option>
                    <option value="Legacy">Bestandsdrohne</option>
                    <option value="Self-built">Eigenbau</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Seriennummer</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" placeholder="SN123..." value={newDrone.serialNumber || ''} onChange={e => setNewDrone({...newDrone, serialNumber: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Firmware Version</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" placeholder="v01.00..." value={newDrone.firmwareVersion || ''} onChange={e => setNewDrone({...newDrone, firmwareVersion: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">LBA e-ID (Optional)</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" placeholder="DEU..." value={newDrone.eId || ''} onChange={e => setNewDrone({...newDrone, eId: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Spezielle Versicherung</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                    placeholder="Nur falls abweichend"
                    value={newDrone.insuranceNumber || ''}
                    onChange={e => setNewDrone({...newDrone, insuranceNumber: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Max. Windgrenze (km/h)</label>
                <input
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                  placeholder="z.B. 28 (leer = Standard 28 km/h)"
                  value={newDrone.maxWindSpeed || ''}
                  onChange={e => setNewDrone({...newDrone, maxWindSpeed: e.target.value ? Number(e.target.value) : undefined})}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Drohnen-Foto (optional)</label>
                {newDrone.photoUrl ? (
                  <div className="relative">
                    <img src={newDrone.photoUrl} alt="Vorschau" className="w-full h-28 object-cover rounded-xl border border-slate-200" />
                    <button onClick={() => setNewDrone({...newDrone, photoUrl: undefined})} className="absolute top-2 right-2 bg-brand-red text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">✕</button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <Camera className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400">Foto aufnehmen oder hochladen</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => setNewDrone({...newDrone, photoUrl: ev.target?.result as string});
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                )}
              </div>
              <button
                onClick={handleAdd}
                className="w-full bg-brand-blue text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-blue/20 active:scale-95 transition-all text-sm"
              >
                {editingDroneId ? 'Änderungen speichern' : 'Drohne registrieren'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3 mb-10">
        {drones.map(drone => {
          const droneFlights = flights.filter(f => f.droneId === drone.id);
          const stats = droneStats[drone.id] || { hours: 0, flights: 0, lastMaint: {} };
          const totalMinutes = droneFlights.reduce((acc, f) => acc + (f.duration || 0), 0);
          const hours = Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;

          return (
            <div key={drone.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-blue/5 flex items-center justify-center border border-brand-blue/10 overflow-hidden shrink-0">
                  {drone.photoUrl
                    ? <img src={drone.photoUrl} alt={drone.model} className="w-full h-full object-cover" />
                    : <Plane className="w-6 h-6 text-brand-blue" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{drone.model}</h3>
                  <div className="flex flex-wrap items-center gap-x-2 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>{drone.uasClass || 'Legacy'}</span>
                    <span>&bull; {drone.weight}g</span>
                    {drone.serialNumber && <span>&bull; SN: {drone.serialNumber}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-brand-blue font-black uppercase tracking-tighter flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {hours}h {mins}m Flugzeit
                    </p>
                    {drone.firmwareVersion && (
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        &bull; FW: {drone.firmwareVersion}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                      &bull; {droneFlights.length} Flüge
                    </p>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-2">
                    <button 
                      onClick={async () => {
                        const statsForDrone = droneStats[drone.id];
                        const record: MaintenanceRecord = {
                          id: crypto.randomUUID(),
                          droneId: drone.id,
                          date: new Date().toISOString().split('T')[0],
                          type: 'Motor',
                          description: 'Motoren gereinigt (Benutzer-Schnellaktion)',
                          hoursAtMaintenance: statsForDrone?.hours || 0,
                          createdAt: Date.now()
                        };
                        await dbService.saveMaintenance(record);
                        onUpdate();
                      }}
                      className="text-[8px] font-black uppercase tracking-widest text-brand-blue bg-brand-blue/5 px-2 py-1 rounded hover:bg-brand-blue hover:text-white transition-all flex items-center gap-1"
                    >
                      <Sparkles className="w-2 h-2" /> Motoren reinigen
                    </button>
                    {stats.lastMaint['Motor'] && (
                      <span className="text-[8px] text-slate-400 font-bold uppercase">Zuletzt: {new Date(stats.lastMaint['Motor']).toLocaleDateString('de-DE')}</span>
                    )}
                  </div>
                  
                  {getMaintenanceAlerts(drone.id).length > 0 && (
                    <div className="mt-4 space-y-3 p-4 bg-white border-2 border-amber-100 rounded-3xl shadow-sm relative overflow-hidden group/alert">
                       <div className="absolute top-0 right-0 p-3 opacity-5 group-hover/alert:opacity-10 transition-opacity">
                        <Wrench className="w-12 h-12" />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                          <BadgeAlert className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Sicherheits-Check fällig</span>
                      </div>
                      <div className="space-y-2">
                        {getMaintenanceAlerts(drone.id).map((alert: any, idx) => (
                          <div key={idx} className="flex flex-col gap-1 bg-amber-50/50 p-2 rounded-xl border border-amber-100/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                                <span className="text-[9px] font-black text-slate-800 uppercase tracking-tight">{alert.reason}</span>
                              </div>
                              <span className="text-[7px] font-black text-white bg-amber-500 px-2 py-0.5 rounded-full uppercase">{alert.type}</span>
                            </div>
                            <p className="text-[9px] text-slate-500 leading-tight font-medium pl-3.5">{alert.detail}</p>
                          </div>
                        ))}
                      </div>
                      <button 
                        onClick={() => setSelectedDroneId(drone.id)}
                        className="w-full mt-2 py-2 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-blue transition-colors shadow-lg shadow-slate-900/10 active:scale-[0.98]"
                      >
                        Wartung protokollieren
                      </button>
                    </div>
                  )}
                </div>
              </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => handleEditDrone(drone)}
                className="p-2 text-slate-300 hover:text-brand-blue active:scale-95 transition-all"
                title="Bearbeiten"
              >
                <Settings2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setSelectedDroneId(drone.id)}
                className="p-2 text-slate-300 hover:text-brand-orange active:scale-95 transition-all"
                title="Wartung"
              >
                <Wrench className="w-4 h-4" />
              </button>
              <button 
                onClick={() => handleDelete(drone.id)}
                className="p-2 text-slate-300 hover:text-brand-red active:scale-90 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
      </div>

      {/* Maintenance Sheet Overlay */}
      <AnimatePresence>
        {selectedDroneId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedDroneId(null)}
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] shadow-2xl p-6 relative flex flex-col max-h-[85vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-6 sm:hidden" />
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Wartungshistorie</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {drones.find(d => d.id === selectedDroneId)?.model}
                  </p>
                </div>
                <button 
                  onClick={() => setShowMaintForm(!showMaintForm)}
                  className="p-2 bg-brand-orange/10 text-brand-orange rounded-xl active:scale-90 transition-all font-bold text-xs flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Neu
                </button>
              </div>

              {/* Bauteil-Verschleiß Übersicht */}
              {selectedDroneId && droneStats[selectedDroneId] && (() => {
                const s = droneStats[selectedDroneId];
                const parts = [
                  { label: 'Propeller', limit: 50, since: s.flightsSinceMaint?.['Propeller'] ?? s.flights },
                  { label: 'Motor', limit: 100, since: s.flightsSinceMaint?.['Motor'] ?? s.flights },
                  { label: 'Sensor', limit: 200, since: s.flightsSinceMaint?.['Sensor'] ?? s.flights },
                ];
                return (
                  <div className="mb-6 p-4 bg-white border border-slate-100 rounded-2xl space-y-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bauteil-Verschleiß</p>
                    {parts.map(p => {
                      const pct = Math.min(100, Math.round((p.since / p.limit) * 100));
                      const color = pct >= 100 ? '#ef4444' : pct >= 75 ? '#f97316' : '#10b981';
                      return (
                        <div key={p.label}>
                          <div className="flex justify-between mb-1">
                            <span className="text-[10px] font-bold text-slate-700">{p.label}</span>
                            <span className="text-[10px] font-bold" style={{ color }}>{p.since}/{p.limit} Flüge</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {selectedDroneId && getMaintenanceAlerts(selectedDroneId).length > 0 && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Empfohlene Wartung</span>
                  </div>
                  <div className="space-y-1.5">
                    {getMaintenanceAlerts(selectedDroneId).map((alert, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-800">{alert.type}</span>
                        <span className="text-[9px] font-medium text-amber-600/80">{alert.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showMaintForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mb-6 space-y-4 bg-slate-50 p-4 rounded-3xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Typ</label>
                      <select 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                        value={newMaint.type}
                        onChange={e => setNewMaint({...newMaint, type: e.target.value as any})}
                      >
                        <option value="Propeller">Propeller</option>
                        <option value="Firmware">Firmware</option>
                        <option value="Motor">Motor</option>
                        <option value="Sensor">Sensoren</option>
                        <option value="General">Allgemein</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Beschreibung</label>
                      <input 
                        type="text" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" 
                        placeholder="Z.B. Propeller-Set A getauscht"
                        value={newMaint.description || ''}
                        onChange={e => setNewMaint({...newMaint, description: e.target.value})}
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleAddMaint}
                    className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all"
                  >
                    Eintrag Hinzufügen
                  </button>
                </motion.div>
              )}

              <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1 scrollbar-hide shrink-0">
                {['All', 'Propeller', 'Firmware', 'Motor', 'Sensor', 'General'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setMaintFilter(type as any)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight whitespace-nowrap transition-all",
                      maintFilter === type 
                        ? "bg-brand-orange text-white" 
                        : "bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-200/50"
                    )}
                  >
                    {type === 'All' ? 'Alle Typen' : type}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide shrink-0 border-b border-slate-50">
                {[
                  { id: 'All', label: 'Alle' },
                  { id: '30Days', label: 'Letzte 30 Tage' },
                  { id: '3Months', label: 'Letzte 3 Monate' },
                  { id: '1Year', label: 'Letztes Jahr' }
                ].map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setDateFilter(range.id as any)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-1.5",
                      dateFilter === range.id 
                        ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10" 
                        : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"
                    )}
                  >
                    <Calendar className="w-3 h-3 translate-y-[-0.5px]" />
                    {range.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                {filteredMaintenance.length === 0 ? (
                  <div className="text-center py-10 opacity-30">
                    <Wrench className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-xs font-bold">Keine Einträge für diesen Filter</p>
                  </div>
                ) : (
                  filteredMaintenance.map(item => (
                    <div key={item.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-orange/5 flex items-center justify-center border border-brand-orange/10">
                          <Settings2 className="w-4 h-4 text-brand-orange" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-[11px]">{item.description}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black text-slate-400 uppercase border border-slate-100 px-1 rounded">{item.type}</span>
                            <span className="text-[8px] text-slate-300 font-mono">{item.date}</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={async () => {
                          await dbService.deleteMaintenance(item.id);
                          const updated = await dbService.getMaintenance(selectedDroneId);
                          setMaintenance(updated);
                        }}
                        className="p-1 text-slate-100 hover:text-brand-red opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button 
                onClick={() => setSelectedDroneId(null)}
                className="w-full bg-slate-50 text-slate-600 font-bold py-3 rounded-2xl mt-6 text-xs active:scale-95 transition-all border border-slate-200"
              >
                Schließen
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-6 pt-4 border-t border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand-orange">Akkus</h2>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">Inventar & Zyklen</p>
        </div>
        <button 
          onClick={() => setShowAddBattery(!showAddBattery)}
          className="bg-brand-orange text-white p-2.5 rounded-2xl shadow-lg shadow-brand-orange/20 transition-transform active:scale-95"
        >
          {showAddBattery ? <XCircle className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {showAddBattery && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Akku Nummer / Name</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                  placeholder="z.B. Akku #1"
                  value={newBattery.number || ''}
                  onChange={e => setNewBattery({...newBattery, number: e.target.value})}
                />
              </div>
              <button 
                onClick={handleAddBattery}
                className="w-full bg-brand-orange text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-orange/20 active:scale-95 transition-all text-sm"
              >
                Akku Registrieren
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-3">
        {batteries.map(battery => {
          const cycles = battery.cycles || 0;
          // LiPo batteries degrade ~0.15% per cycle, floor at 60% (replace threshold)
          const health = Math.max(60, Math.round(100 - cycles * 0.15));
          
          return (
            <div key={battery.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm relative group overflow-hidden">
              {/* Proportional Health Bar */}
              <div 
                className={cn(
                   "absolute bottom-0 left-0 h-1.5 transition-all duration-700",
                   health < 50 ? "bg-brand-red" : health < 80 ? "bg-amber-400" : "bg-brand-green"
                )} 
                style={{ width: `${health}%` }}
              />
              
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center border",
                    health < 50 ? "bg-red-50 border-red-100 text-brand-red" : 
                    health < 80 ? "bg-amber-50 border-amber-100 text-amber-500" : 
                    "bg-emerald-50 border-emerald-100 text-brand-green"
                  )}>
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs">{battery.number}</h3>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{cycles} Zyklen</p>
                  </div>
                </div>
                <span className={cn(
                  "text-[8px] font-black uppercase px-2 py-1 rounded-lg border",
                  health < 50 ? "bg-brand-red/5 border-brand-red/10 text-brand-red" : 
                  health < 80 ? "bg-amber-500/5 border-amber-500/10 text-amber-600" : 
                  "bg-brand-green/5 border-brand-green/10 text-brand-green"
                )}>
                  {health > 80 ? 'Exzellent' : health > 50 ? 'Gut' : 'Verschlissen'}
                </span>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <div className="flex items-baseline gap-1">
                    <p className={cn(
                      "text-2xl font-black transition-colors",
                      health < 30 ? "text-brand-red" : "text-slate-900"
                    )}>{health}%</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">SOH</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteBattery(battery.id)}
                  className="p-1.5 text-slate-200 hover:text-brand-red active:scale-90 opacity-0 group-hover:opacity-100 transition-all mb-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SafetyView() {
  const emergencySteps = [
    { title: "Sicherheit zuerst", desc: "Motoren sofort stoppen (falls sicher möglich). Gefahrenbereich absichern." },
    { title: "Erste Hilfe", desc: "Bei Personenschaden sofort 112 rufen. Erste Hilfe leisten." },
    { title: "Dokumentation", desc: "Fotos vom Unfallort, der Drohne und Schäden machen. Zeugen notieren." },
    { title: "LBA Meldung", desc: "Schwere Ereignisse müssen binnen 72h beim LBA gemeldet werden." }
  ];

  return (
    <div className="max-w-md mx-auto pb-20">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand-red">Safety Hub</h2>
        <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">Notfall-Leitfaden & LBA Meldung</p>
      </div>

      <div className="bg-brand-red text-white p-6 rounded-3xl shadow-xl shadow-brand-red/20 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-white/20 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-bold text-lg">NOTFALL-GUIDE</h3>
        </div>
        <div className="space-y-4">
          {emergencySteps.map((step, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-[10px] font-black">
                {idx + 1}
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider opacity-80">{step.title}</p>
                <p className="text-xs font-medium">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <a 
          href="https://www.lba.de/DE/Betrieb/Drohnen/Meldung_Ereignisse/Meldung_Ereignisse_node.html" 
          target="_blank" 
          rel="noopener noreferrer"
          className="block w-full bg-white p-5 rounded-3xl border border-slate-200 shadow-sm group active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-slate-50 rounded-xl">
              <ExternalLink className="w-5 h-5 text-brand-blue" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="font-bold text-slate-900 mb-1">LBA Ereignismeldung</h4>
          <p className="text-[10px] text-slate-500 leading-relaxed">Offizielles Meldeportal für Unfälle und schwere Störungen (ECCAIRS 2).</p>
        </a>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">Flugverbotszonen</h4>
          <div className="space-y-3">
            {[
              { l: "Flughäfen", v: "1.5km Abstand" },
              { l: "Menschenmengen", v: "Überflug verboten" },
              { l: "Wohngebiete", v: "Datenschutz beachten" },
              { l: "Naturgebiete", v: "Oft Pauschalverbot" }
            ].map((i, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <span className="text-xs font-bold text-slate-600">{i.l}</span>
                <span className="text-[10px] font-black text-brand-red bg-brand-red/5 px-2 py-1 rounded-lg uppercase">{i.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoadmapView() {
  const steps = [
    {
      title: "KI-Flug-Check (Gemini Integration)",
      desc: "KI analysiert automatisch den Zielort auf potenzielle Hindernisse wie Strommasten oder private Grundstücke.",
      status: "Geplant",
      icon: Rocket
    },
    {
      title: "Automatische PDF-Logbuch-Exporte",
      desc: "Generieren Sie amtlich anerkannte Flugberichte mit einem Klick für die Versicherung oder das LBA.",
      status: "In Entwicklung",
      icon: Download
    },
    {
      title: "Checkliste vor dem Start",
      desc: "Interaktive Sicherheitsprüfung (Akku, Propeller, GPS, SD-Karte) vor jedem Flug.",
      status: "Geplant",
      icon: CheckCircle2
    },
    {
      title: "Live NOTAM Feed",
      desc: "Echtzeit-NOTAMs aus dem FAA-Datenbankportal für deutschen Luftraum (EDWW/EDGG/EDMM) — sichtbar vor jedem Flugstart.",
      status: "Live",
      icon: AlertTriangle
    }
  ];

  return (
    <div className="max-w-md mx-auto pb-8">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Roadmap</h2>
        <p className="text-slate-500 text-sm font-medium">Unsere Vision für SkyLog DE</p>
      </div>

      <div className="space-y-6">
        {steps.map((step, idx) => (
          <div key={idx} className="relative pl-8 border-l-2 border-slate-100 last:border-l-0">
            <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-brand-blue border-2 border-white shadow-sm" />
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-slate-50 rounded-xl">
                  <step.icon className="w-5 h-5 text-brand-blue" />
                </div>
                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest">{step.status}</span>
              </div>
              <h3 className="font-bold text-slate-900 mb-1">{step.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-6 bg-brand-blue/5 rounded-3xl text-center border border-brand-blue/10">
        <Rocket className="w-8 h-8 text-brand-blue mx-auto mb-3" />
        <h4 className="font-bold text-slate-900 mb-1">Feedback erwünscht!</h4>
        <p className="text-xs text-slate-500">Welche Funktion fehlt Ihnen am meisten? Lassen Sie es uns wissen.</p>
      </div>
    </div>
  );
}

function ProfileView({ profile, documents, onUpdate }: { profile: UserProfile | null, documents: AppDocument[], onUpdate: () => void }) {
  const [isEditing, setIsEditing] = useState(!profile);
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>(profile || { id: 'main_profile' });

  const handleSaveProfile = async () => {
    if (!editedProfile.name || !editedProfile.eid) return;
    await dbService.saveProfile({
      id: 'main_profile',
      name: editedProfile.name,
      eid: editedProfile.eid,
      licenseType: editedProfile.licenseType || 'None',
      licenseExpiry: editedProfile.licenseExpiry || '',
      insuranceNumber: editedProfile.insuranceNumber || '',
      isBOS: !!editedProfile.isBOS,
      notamClientId: editedProfile.notamClientId || '',
      notamClientSecret: editedProfile.notamClientSecret || '',
    } as UserProfile);
    setIsEditing(false);
    onUpdate();
  };

  const getExpiryStatus = (date?: string) => {
    if (!date) return { color: 'text-slate-400', label: 'Kein Datum' };
    const expiry = new Date(date);
    const left = expiry.getTime() - Date.now();
    const days = Math.ceil(left / (1000 * 60 * 60 * 24));
    
    if (days < 0) return { color: 'text-brand-red', label: 'Abgelaufen!' };
    if (days < 30) return { color: 'text-amber-500', label: `Läuft in ${days} Tagen ab` };
    return { color: 'text-brand-green', label: `Gültig (${days} Tage)` };
  };

  const expiry = getExpiryStatus(profile?.licenseExpiry);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Bitte laden Sie nur PDF-Dateien hoch (z.B. den Fernpilotennachweis).');
      return;
    }

    try {
      await dbService.saveDocument({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        data: file,
        createdAt: Date.now()
      });
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Fehler beim Speichern des Dokuments.');
    }
  };

  const exportPilotBadge = () => {
    if (!profile) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [148, 105] });
    doc.setFillColor(0, 56, 123);
    doc.rect(0, 0, 148, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SkyLog DE — Piloten-Ausweis', 10, 13);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Unmanned Aircraft System Operator', 10, 21);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(profile.name, 10, 45);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`LBA e-ID:`, 10, 57);
    doc.setTextColor(0, 56, 123);
    doc.setFont('helvetica', 'bold');
    doc.text(profile.eid, 35, 57);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.text(`Lizenztyp:`, 10, 65);
    doc.text(profile.licenseType, 35, 65);
    if (profile.licenseExpiry) {
      doc.text(`Gültig bis:`, 10, 73);
      doc.text(profile.licenseExpiry, 35, 73);
    }
    if (profile.insuranceNumber) {
      doc.text(`Versicherung:`, 10, 81);
      doc.text(profile.insuranceNumber, 40, 81);
    }
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generiert: ${new Date().toLocaleDateString('de-DE')} · SkyLog DE`, 10, 100);
    doc.setDrawColor(200, 200, 200);
    doc.rect(5, 35, 138, 60);
    doc.save(`skylog_ausweis_${profile.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handlePreview = (doc: AppDocument) => {
    const url = URL.createObjectURL(doc.data);
    window.open(url, '_blank');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Dokument wirklich löschen?')) {
      await dbService.deleteDocument(id);
      onUpdate();
    }
  };

  const handleExportBackup = async () => {
    try {
      await exportBackup();
    } catch (err) {
      console.error(err);
      alert('Export fehlgeschlagen.');
    }
  };

  const handleImportBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Sicherung laden? Vorhandene Einträge mit gleicher ID werden überschrieben, der Rest bleibt erhalten.')) {
      e.target.value = '';
      return;
    }
    try {
      const r = await importBackup(file);
      alert(
        `Sicherung geladen ✓\n\n` +
        `${r.drones} Drohnen\n${r.batteries} Akkus\n${r.flights} Flüge\n` +
        `${r.pilots} Piloten\n${r.maintenance} Wartungen\n${r.documents} Dokumente\n` +
        `${r.profile ? 'Profil übernommen' : 'Kein Profil in der Datei'}`
      );
      onUpdate();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Import fehlgeschlagen.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-md mx-auto pb-20">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand-blue">Piloten Profil</h2>
            <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">Stammdaten & Lizenzen</p>
          </div>
          <div className="flex items-center gap-2">
            {profile?.isBOS && (
              <div className="bg-brand-red text-white text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">BOS Pilot</div>
            )}
            {profile && (
              <button
                onClick={exportPilotBadge}
                className="p-2.5 text-slate-400 hover:text-brand-blue bg-white border border-slate-200 rounded-2xl shadow-sm transition-all"
                title="Piloten-Ausweis als PDF"
              >
                <FileDigit className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-8 relative">
        {!isEditing ? (
          <>
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-brand-blue transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                <User className="w-8 h-8 text-brand-blue" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg leading-tight">{profile?.name || 'Vollständiger Name'}</h3>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{profile?.licenseType || 'Keine Lizenz'}</p>
                  <span className={cn("text-[10px] font-bold", expiry.color)}>&bull; {expiry.label}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">LBA e-ID</p>
                  <p className="text-xs font-bold text-slate-800">{profile?.eid || 'Nicht hinterlegt'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Versicherung</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{profile?.insuranceNumber || 'Nicht hinterlegt'}</p>
                </div>
              </div>
              {profile?.eid && (
                <div className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">LBA e-ID QR-Code</p>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(profile.eid)}&bgcolor=ffffff&color=0a0a0a&margin=8`}
                    alt="LBA e-ID QR Code"
                    className="w-32 h-32 rounded-xl"
                  />
                  <p className="text-[10px] text-slate-500 text-center">Für Bodeninspektion scannen</p>
                </div>
              )}
              {profile && (
                <div className="p-4 bg-brand-green/5 border border-brand-green/10 rounded-2xl flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-brand-green" />
                  <div>
                    <p className="text-xs font-bold text-brand-green">Status: Aktiv & Bereit</p>
                    <p className="text-[10px] text-slate-500">Ihre Daten sind für das Logbuch bereit.</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm mb-2">Profil Bearbeiten</h3>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Vollständiger Name</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={editedProfile.name || ''} onChange={e => setEditedProfile({...editedProfile, name: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">LBA e-ID (Registrierungsnummer)</label>
              <input type="text" placeholder="DEU..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={editedProfile.eid || ''} onChange={e => setEditedProfile({...editedProfile, eid: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Lizenz Typ</label>
                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={editedProfile.licenseType || ''} onChange={e => setEditedProfile({...editedProfile, licenseType: e.target.value as any})}>
                  <option value="None">Keine</option>
                  <option value="A1/A3">A1/A3</option>
                  <option value="A2">A2 (Fernpiloten-Zeugnis)</option>
                  <option value="STS">STS (Spezielle Kat.)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Gültig bis</label>
                <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={editedProfile.licenseExpiry || ''} onChange={e => setEditedProfile({...editedProfile, licenseExpiry: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Versicherungs-Nr.</label>
                <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={editedProfile.insuranceNumber || ''} onChange={e => setEditedProfile({...editedProfile, insuranceNumber: e.target.value})} />
              </div>
              <div className="flex flex-col justify-end">
                <button 
                  onClick={() => setEditedProfile({...editedProfile, isBOS: !editedProfile.isBOS})}
                  className={cn(
                    "w-full py-2.5 rounded-xl border text-[10px] font-bold transition-all",
                    editedProfile.isBOS ? "bg-brand-red text-white border-brand-red" : "bg-slate-50 text-slate-400 border-slate-200"
                  )}
                >
                  {editedProfile.isBOS ? "BOS STATUS: AN" : "BOS STATUS: AUS"}
                </button>
              </div>
            </div>
            {/* NOTAM API-Zugangsdaten */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">NOTAM API (Optional)</p>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Kostenloser API-Key von <span className="font-bold text-brand-blue">developer.faa.gov</span> · Zeigt aktuelle Luftraumsperrungen (NOTAMs) vor dem Flug an.
              </p>
              <input
                type="text"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                placeholder="client_id"
                value={editedProfile.notamClientId || ''}
                onChange={e => setEditedProfile({...editedProfile, notamClientId: e.target.value})}
              />
              <input
                type="password"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                placeholder="client_secret"
                value={editedProfile.notamClientSecret || ''}
                onChange={e => setEditedProfile({...editedProfile, notamClientSecret: e.target.value})}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveProfile}
                className="flex-1 bg-brand-blue text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-blue/20 text-xs active:scale-95 transition-all"
              >
                Profil Speichern
              </button>
              {profile && (
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-3 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs"
                >
                  Abbrechen
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-sm">PDF Dokumente</h3>
          <label className="bg-brand-blue text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-brand-blue/20">
            <Plus className="w-4 h-4 inline-block mr-1" /> Neu
            <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
          </label>
      </div>

      <div className="space-y-3">
        {documents.map(doc => (
          <div key={doc.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                <FileDigit className="w-5 h-5 text-blue-500" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-800 truncate">{doc.name}</p>
                <p className="text-[10px] text-slate-400 font-medium">Hochgeladen am {new Date(doc.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handlePreview(doc)} className="p-2 text-brand-blue active:scale-90"><ExternalLink className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(doc.id)} className="p-2 text-slate-200 hover:text-brand-red active:scale-90"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}

        {documents.length === 0 && (
          <div className="text-center py-8 bg-white rounded-3xl border-2 border-dashed border-slate-100">
            <FileDigit className="w-8 h-8 text-slate-100 mx-auto mb-2" />
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Keine PDF-Dokumente</p>
          </div>
        )}
      </div>

      {/* Datensicherung */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-3">
          <DatabaseBackup className="w-4 h-4 text-brand-blue" />
          <h3 className="font-bold text-slate-900 text-sm">Datensicherung</h3>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed mb-3">
          Sichere alle deine Drohnen, Akkus, Flüge, Piloten und Dokumente in eine Datei — und lade sie bei Handywechsel oder Datenverlust wieder ein.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleExportBackup}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-blue text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-blue/20 text-xs active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" /> Sicherung exportieren
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-xs cursor-pointer active:scale-95 transition-all">
            <Upload className="w-4 h-4" /> Laden
            <input type="file" className="hidden" accept="application/json,.json" onChange={handleImportBackup} />
          </label>
        </div>
      </div>

      <div className="mt-6 p-5 bg-amber-50 rounded-3xl border border-amber-100 flex gap-4">
        <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0" />
        <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
          Ihre Daten werden sicher und lokal in Ihrem Browser gespeichert. SkyLog DE sendet keine Informationen an Cloud-Server.
        </p>
      </div>

      {/* Version & Impressum */}
      <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">App-Info</p>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-500">Version</span>
          <span className="text-[10px] font-bold text-slate-900">1.0.0</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-500">Plattform</span>
          <span className="text-[10px] font-bold text-slate-900">PWA · IndexedDB</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-500">Lizenz</span>
          <span className="text-[10px] font-bold text-slate-900">Privat / Nicht-kommerziell</span>
        </div>
        <div className="pt-2 flex gap-3">
          <a
            href="/datenschutz.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-bold text-brand-blue"
          >
            <ExternalLink className="w-3 h-3" /> Datenschutzerklärung
          </a>
        </div>
      </div>
    </div>
  );
}

const PREFLIGHT_ITEMS = [
  'Akkus voll geladen & Zustand geprüft',
  'Propeller fest & unbeschädigt',
  'Firmware & App aktuell',
  'Wetter im Limit (Wind, Sicht, kein Regen)',
  'Flugzone geprüft (dipul / NOTAM)',
  'e-ID an der Drohne angebracht',
  'Speicherkarte & Speicherplatz ok',
  'Umgebung frei von Menschen & Hindernissen',
];

function PreFlightChecklist() {
  const [checked, setChecked] = useState<boolean[]>(() => PREFLIGHT_ITEMS.map(() => false));
  const done = checked.filter(Boolean).length;
  const allDone = done === PREFLIGHT_ITEMS.length;
  const toggle = (i: number) => setChecked(prev => prev.map((v, idx) => (idx === i ? !v : v)));

  return (
    <div className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-brand-blue" />
          <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Pre-Flight Check</h3>
        </div>
        <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full", allDone ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500")}>
          {done}/{PREFLIGHT_ITEMS.length}
        </span>
      </div>
      <div className="space-y-1">
        {PREFLIGHT_ITEMS.map((item, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className="w-full flex items-center gap-3 py-2 text-left active:scale-[0.99] transition-transform"
          >
            {checked[i]
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              : <div className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />}
            <span className={cn("text-xs font-medium", checked[i] ? "text-slate-400 line-through" : "text-slate-700")}>{item}</span>
          </button>
        ))}
      </div>
      {allDone && (
        <div className="mt-3 flex items-center gap-2 p-2.5 bg-emerald-50 rounded-xl">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          <p className="text-[10px] font-bold text-emerald-700">Alles geprüft — startklar!</p>
        </div>
      )}
    </div>
  );
}

function LogbookView({ flights, drones, batteries, profile, onUpdate, currentLocation }: { flights: Flight[], drones: Drone[], batteries: Battery[], profile: UserProfile | null, onUpdate: () => void, currentLocation: [number, number] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [newFlight, setNewFlight] = useState<Partial<Flight>>({});
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const touchStartX = { current: 0 };

  const todayStr = new Date().toISOString().split('T')[0];
  const validFlights = flights
    .filter(f => f.date <= todayStr)
    .sort((a,b) => b.createdAt - a.createdAt);

  const handleManualAdd = async () => {
    if (!newFlight.droneId || !newFlight.date) return;
    if (!newFlight.duration || newFlight.duration <= 0) { alert('Bitte eine Flugdauer > 0 Minuten eingeben.'); return; }
    await dbService.saveFlight({
      id: crypto.randomUUID(),
      droneId: newFlight.droneId,
      batteryId: newFlight.batteryId,
      date: newFlight.date,
      startTime: newFlight.startTime || '',
      endTime: newFlight.endTime || '',
      duration: newFlight.duration || 0,
      location: '',
      locationName: newFlight.locationName || 'Unbekannter Ort',
      coordinates: currentLocation,
      purpose: newFlight.purpose || 'Hobby',
      notes: newFlight.notes || '',
      createdAt: Date.now()
    });
    // Battery cycles are incremented by dbService.saveFlight
    setNewFlight({});
    setShowAdd(false);
    onUpdate();
  };

  const handleAssistantSave = async (flightData: Flight) => {
    await dbService.saveFlight(flightData);
    // Battery cycles are incremented by dbService.saveFlight
    setShowAssistant(false);
    onUpdate();
  };

  const exportToJSON = async () => {
    const [allFlights, allDrones, allBatteries, allPilots, savedProfile] = await Promise.all([
      dbService.getFlights(),
      dbService.getDrones(),
      dbService.getBatteries(),
      dbService.getPilots(),
      dbService.getProfile(),
    ]);
    const data = { version: 1, exportedAt: new Date().toISOString(), profile: savedProfile, drones: allDrones, batteries: allBatteries, flights: allFlights, pilots: allPilots };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `skylog_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const importFromJSON = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.version || !data.flights) { alert('Ungültige Backup-Datei.'); return; }
      if (!confirm(`Backup vom ${new Date(data.exportedAt).toLocaleDateString('de-DE')} importieren?\n\nDies fügt ${data.flights?.length ?? 0} Flüge, ${data.drones?.length ?? 0} Drohnen und ${data.batteries?.length ?? 0} Akkus hinzu.`)) return;
      const saves: Promise<void>[] = [];
      (data.drones || []).forEach((d: Drone) => saves.push(dbService.saveDrone(d)));
      (data.batteries || []).forEach((b: Battery) => saves.push(dbService.saveBattery(b)));
      (data.flights || []).forEach((f: Flight) => saves.push(dbService.saveFlight(f)));
      (data.pilots || []).forEach((p: Pilot) => saves.push(dbService.savePilot(p)));
      if (data.profile) saves.push(dbService.saveProfile(data.profile));
      await Promise.all(saves);
      onUpdate();
      alert('Import erfolgreich!');
    } catch { alert('Fehler beim Import — Datei beschädigt?'); }
    e.target.value = '';
  };

  const exportToCSV = () => {
    const headers = ['Datum', 'Drohne', 'Pilot', 'Start', 'Ende', 'Dauer (Min)', 'Ort', 'Zweck', 'Wetter', 'Notizen', 'Vorkommnisse'];
    const rows = validFlights.map(f => {
      const drone = drones.find(d => d.id === f.droneId);
      return [
        f.date,
        drone?.model || 'Unbekannt',
        f.pilotName || profile?.name || 'Hauptpilot',
        f.startTime,
        f.endTime,
        f.duration,
        f.locationName,
        f.purpose || 'Hobby',
        f.weather ? `${f.weather.temp}°C, ${f.weather.windSpeed}km/h` : '',
        f.notes.replace(/,/g, ';'),
        f.incidents?.replace(/,/g, ';') || ''
      ].join(',');
    });

    const csvContent = '﻿' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `skylog_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };
  
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(0, 56, 123); // Brand Blue
    doc.text('Fluglogbuch & Dokumentation', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generiert am: ${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE')}`, 14, 30);
    
    // Pilot Section
    doc.setFontSize(14);
    doc.setTextColor(50);
    doc.text('Piloten-Informationen', 14, 45);
    
    doc.setFontSize(10);
    doc.text(`Name: ${profile?.name || 'Nicht angegeben'}`, 14, 52);
    doc.text(`LBA e-ID: ${profile?.eid || 'Nicht angegeben'}`, 14, 57);
    doc.text(`Lizenz: ${profile?.licenseType || 'Keine'}`, 80, 52);
    doc.text(`Versicherung: ${profile?.insuranceNumber || 'Nicht angegeben'}`, 80, 57);
    
    // Table
    const tableData = validFlights.map(f => {
      const drone = drones.find(d => d.id === f.droneId);
      return [
        f.date,
        drone?.model || 'Unbekannt',
        `${f.startTime} - ${f.endTime}`,
        `${f.duration} Min`,
        f.locationName,
        f.purpose || 'Hobby',
        `${f.notes}${f.incidents ? `\nVORFALL: ${f.incidents}` : ''}`
      ];
    });
    
    autoTable(doc, {
      startY: 65,
      head: [['Datum', 'Drohne', 'Zeitraum', 'Dauer', 'Ort', 'Zweck', 'Bemerkungen']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 56, 123], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        6: { cellWidth: 50 } // Remarks column width
      }
    });
    
    doc.save(`skylog_de_logbuch_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportToKML = () => {
    const placemarks = validFlights
      .filter(f => f.coordinates)
      .map(f => `  <Placemark>
    <name>${f.locationName || 'Flug'}</name>
    <description>${f.date} · ${f.duration} min · ${f.purpose || 'Hobby'}</description>
    <Point><coordinates>${f.coordinates[1]},${f.coordinates[0]},0</coordinates></Point>
  </Placemark>`).join('\n');
    const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n  <name>SkyLog DE Fluggebiete</name>\n${placemarks}\n</Document>\n</kml>`;
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `skylog_fluggebiete_${new Date().toISOString().split('T')[0]}.kml`;
    link.click();
  };

  const totalDuration = validFlights.reduce((acc, f) => acc + (f.duration || 0), 0);
  const totalFlights = validFlights.length;
  const avgDuration = totalFlights > 0 ? Math.round(totalDuration / totalFlights) : 0;
  const hours = Math.floor(totalDuration / 60);
  const mins = totalDuration % 60;

  const thisMonthStr = new Date().toISOString().slice(0, 7);
  const thisMonthFlights = validFlights.filter(f => f.date.startsWith(thisMonthStr)).length;

  const droneCounts = drones.map(d => ({
    model: d.model,
    count: validFlights.filter(f => f.droneId === d.id).length
  })).sort((a, b) => b.count - a.count);
  const topDrone = droneCounts[0];

  const purposeCounts: Record<string, number> = {};
  validFlights.forEach(f => {
    const p = f.purpose || 'Hobby';
    purposeCounts[p] = (purposeCounts[p] || 0) + 1;
  });
  const purposeData = Object.entries(purposeCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Process data for chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const chartData = last7Days.map(date => ({
    date: date.split('-').slice(1).reverse().join('.'),
    flights: validFlights.filter(f => f.date === date).length
  }));

  const currentYear = new Date().getFullYear();
  const monthNames = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const yearlyData = monthNames.map((label, i) => {
    const prefix = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
    const mFlights = validFlights.filter(f => f.date.startsWith(prefix));
    return {
      label,
      flights: mFlights.length,
      minutes: mFlights.reduce((a, f) => a + (f.duration || 0), 0),
    };
  });
  const yearTotalMins = yearlyData.reduce((a, m) => a + m.minutes, 0);
  const maxMins = Math.max(...yearlyData.map(m => m.minutes), 1);

  return (
    <div className="max-w-md mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand-blue">Logbuch</h2>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">Statistik & Dokumentation</p>
        </div>
        <div className="flex gap-2">
          <button
             onClick={exportToPDF}
             className="p-2.5 text-slate-400 hover:text-brand-orange bg-white border border-slate-200 rounded-2xl shadow-sm transition-all"
             title="Export PDF"
          >
             <FileDigit className="w-5 h-5" />
          </button>
          <button
             onClick={exportToCSV}
             className="p-2.5 text-slate-400 hover:text-brand-blue bg-white border border-slate-200 rounded-2xl shadow-sm transition-all"
             title="Export CSV"
          >
             <Download className="w-5 h-5" />
          </button>
          <button
             onClick={exportToKML}
             className="p-2.5 text-slate-400 hover:text-brand-green bg-white border border-slate-200 rounded-2xl shadow-sm transition-all"
             title="Export KML (Google Earth)"
          >
             <MapPin className="w-5 h-5" />
          </button>
          <button
             onClick={exportToJSON}
             className="p-2.5 text-slate-400 hover:text-brand-blue bg-white border border-slate-200 rounded-2xl shadow-sm transition-all"
             title="Backup als JSON"
          >
             <Cpu className="w-5 h-5" />
          </button>
          <label
             className="p-2.5 text-slate-400 hover:text-brand-green bg-white border border-slate-200 rounded-2xl shadow-sm transition-all cursor-pointer flex items-center"
             title="Backup importieren"
          >
             <ArrowRight className="w-5 h-5 rotate-180" />
             <input type="file" accept=".json" className="hidden" onChange={importFromJSON} />
          </label>
          <button
            onClick={() => setShowAssistant(true)}
            className="bg-brand-green text-white p-2.5 rounded-2xl shadow-lg shadow-brand-green/20 transition-transform active:scale-95 flex items-center gap-2"
          >
            <Timer className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setShowAdd(!showAdd)}
            className="bg-brand-blue text-white p-2.5 rounded-2xl shadow-lg shadow-brand-blue/20 transition-transform active:scale-95"
          >
            {showAdd ? <XCircle className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Erinnerungen */}
      {getReminders(profile, drones, batteries).length > 0 && (
        <div className="mb-6 space-y-2">
          {getReminders(profile, drones, batteries).map((r, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 p-3 rounded-2xl border",
                r.level === 'alert' ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"
              )}
            >
              <Bell className={cn("w-4 h-4 shrink-0 mt-0.5", r.level === 'alert' ? "text-brand-red" : "text-amber-500")} />
              <p className={cn("text-[11px] font-medium leading-relaxed", r.level === 'alert' ? "text-red-700" : "text-amber-700")}>
                {r.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Stats Dashboard */}
      <div className="space-y-4 mb-8">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-900 text-white p-3 rounded-[24px] shadow-lg relative overflow-hidden group">
            <History className="absolute -right-2 -bottom-2 w-12 h-12 text-white/5 rotate-12" />
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Clock className="w-2 h-2" /> Gesamt
            </p>
            <p className="text-sm font-black whitespace-nowrap">{hours}h {mins}m</p>
          </div>
          <div className="bg-brand-blue text-white p-3 rounded-[24px] shadow-lg relative overflow-hidden group">
            <Plane className="absolute -right-2 -bottom-2 w-12 h-12 text-white/5 -rotate-12" />
            <p className="text-[8px] font-bold text-blue-200 uppercase tracking-widest mb-1 flex items-center gap-1">
              <TrendingUp className="w-2 h-2" /> Flüge
            </p>
            <p className="text-sm font-black">{totalFlights}</p>
          </div>
          <div className="bg-brand-orange text-white p-3 rounded-[24px] shadow-lg relative overflow-hidden group">
            <Timer className="absolute -right-2 -bottom-2 w-12 h-12 text-white/5 rotate-12" />
            <p className="text-[8px] font-bold text-orange-200 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Clock className="w-2 h-2" /> Schnitt
            </p>
            <p className="text-sm font-black">{avgDuration}m</p>
          </div>
        </div>

        {/* Mini Chart */}
        <div className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-blue" />
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Letzte 7 Tage</h3>
            </div>
            <div className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded text-right">
              Aktivität
            </div>
          </div>
          <div className="h-24 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 600 }} 
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }} 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded shadow-xl">
                          {payload[0].value} {payload[0].value === 1 ? 'Flug' : 'Flüge'}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="flights" 
                  radius={[4, 4, 0, 0]} 
                  barSize={16}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.flights > 0 ? '#00387B' : '#f1f5f9'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Erweiterte Statistiken */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white p-4 rounded-[24px] border border-slate-200 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Diesen Monat</p>
          <p className="text-lg font-black text-slate-900">{thisMonthFlights} <span className="text-sm font-bold text-slate-400">Flüge</span></p>
        </div>
        <div className="bg-white p-4 rounded-[24px] border border-slate-200 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Top Drohne</p>
          <p className="text-sm font-black text-slate-900 truncate">{topDrone?.model || '—'}</p>
          {topDrone && <p className="text-[9px] text-slate-400">{topDrone.count} Flüge</p>}
        </div>
      </div>
      {purposeData.length > 0 && (
        <div className="bg-white p-4 rounded-[24px] border border-slate-200 shadow-sm mb-6">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">Flüge nach Zweck</p>
          <div className="space-y-2">
            {purposeData.map(({ name, value }) => (
              <div key={name} className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-600 w-24 shrink-0">{name}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                  <div className="bg-brand-blue h-1.5 rounded-full" style={{ width: `${Math.round((value / totalFlights) * 100)}%` }} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 w-6 text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jahresübersicht */}
      <div className="bg-white p-4 rounded-[24px] border border-slate-200 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-blue" />
            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Jahresübersicht {currentYear}</p>
          </div>
          <span className="text-[9px] font-bold text-brand-blue">{Math.floor(yearTotalMins / 60)}h {yearTotalMins % 60}m gesamt</span>
        </div>
        <div className="flex items-end gap-1 h-16">
          {yearlyData.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${Math.max(2, Math.round((m.minutes / maxMins) * 48))}px`,
                  background: m.minutes > 0 ? '#00387B' : '#f1f5f9'
                }}
              />
              <span className="text-[7px] font-bold text-slate-400">{m.label}</span>
              {m.flights > 0 && <span className="text-[7px] font-black text-brand-blue">{m.flights}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900 text-xs uppercase tracking-widest">Alle Einträge</h3>
        <span className="text-[10px] font-bold text-slate-400">{validFlights.length} Einträge</span>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">Manueller Eintrag</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Drohne wählen</label>
                  <select 
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                     value={newFlight.droneId || ''}
                     onChange={e => setNewFlight({...newFlight, droneId: e.target.value})}
                  >
                    <option value="">Wähle...</option>
                    {drones.map(d => <option key={d.id} value={d.id}>{d.model}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Akku wählen</label>
                  <select 
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                     value={newFlight.batteryId || ''}
                     onChange={e => setNewFlight({...newFlight, batteryId: e.target.value})}
                  >
                    <option value="">Wähle...</option>
                    {batteries.map(b => <option key={b.id} value={b.id}>{b.number}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Datum</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" 
                    value={newFlight.date || ''} 
                    max={todayStr}
                    onChange={e => setNewFlight({...newFlight, date: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Dauer (Min)</label>
                  <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" placeholder="15" value={newFlight.duration || ''} onChange={e => setNewFlight({...newFlight, duration: Number(e.target.value)})} />
                </div>
              </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Einsatzort</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" placeholder="Berlin Tiergarten" value={newFlight.locationName || ''} onChange={e => setNewFlight({...newFlight, locationName: e.target.value})} />
                </div>
              <button 
                onClick={handleManualAdd}
                className="w-full bg-brand-blue text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-blue/20 active:scale-95 transition-all text-sm"
              >
                Flug Protokollieren
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showAssistant && (
        <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto">
          <FlightAssistant 
            drones={drones} 
            batteries={batteries}
            profile={profile}
            onClose={() => setShowAssistant(false)} 
            onSave={handleAssistantSave} 
            currentLocation={currentLocation}
          />
        </div>
      )}

      <div className="space-y-4">
        {validFlights.map(flight => {
          const drone = drones.find(d => d.id === flight.droneId);
          const isSwiped = swipedId === flight.id;
          return (
            <div key={flight.id} className="relative overflow-hidden rounded-3xl">
              {/* Delete button revealed on swipe */}
              <button
                onClick={async () => {
                  if (confirm(`Flug vom ${new Date(flight.date).toLocaleDateString('de-DE')} wirklich löschen?`)) {
                    await dbService.deleteFlight(flight.id);
                    setSwipedId(null);
                    onUpdate();
                  }
                }}
                className="absolute right-0 top-0 bottom-0 w-20 bg-brand-red flex flex-col items-center justify-center gap-1 z-10"
              >
                <Trash2 className="w-5 h-5 text-white" />
                <span className="text-[9px] font-black text-white uppercase">Löschen</span>
              </button>
              <div
                className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm transition-transform duration-200 relative z-20"
                style={{ transform: isSwiped ? 'translateX(-80px)' : 'translateX(0)' }}
                onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                onTouchEnd={e => {
                  const delta = e.changedTouches[0].clientX - touchStartX.current;
                  if (delta < -60) setSwipedId(flight.id);
                  else if (delta > 30) setSwipedId(null);
                }}
                onClick={() => { if (isSwiped) setSwipedId(null); }}
              >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-slate-100 p-1.5 rounded-lg">
                    <MapIcon className="w-4 h-4 text-slate-500" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">{flight.locationName}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(flight.date).toLocaleDateString('de-DE')}</span>
                  {flight.legs && flight.legs.length > 0 && (
                    <span className="text-[9px] font-bold text-brand-green uppercase">{flight.legs.length} Flüge (Legs)</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">{drone?.model || 'Gelöschte Drohne'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] text-slate-500 font-medium">{flight.duration} Minuten</p>
                    <div className="flex gap-1">
                      {flight.weather && (flight.weather.windSpeed > 15 || flight.weather.temp > 30) && (
                        <div className="flex items-center gap-0.5 px-1 bg-amber-50 rounded border border-amber-100">
                          <Wind className="w-2.5 h-2.5 text-amber-500" />
                          <span className="text-[8px] font-black text-amber-500 uppercase">Wetter-Warnung</span>
                        </div>
                      )}
                      {flight.batteryStatus && flight.batteryStatus.endPercent < 15 && (
                        <div className="flex items-center gap-0.5 px-1 bg-brand-red/5 rounded border border-brand-red/10">
                          <ShieldAlert className="w-2.5 h-2.5 text-brand-red" />
                          <span className="text-[8px] font-black text-brand-red uppercase">Tiefentladungs-Risiko</span>
                        </div>
                      )}
                      {flight.incidents && (
                        <div className="flex items-center gap-0.5 px-1 bg-brand-red/5 rounded border border-brand-red/10">
                          <AlertTriangle className="w-2.5 h-2.5 text-brand-red" />
                          <span className="text-[8px] font-black text-brand-red uppercase">Vorkommnis</span>
                        </div>
                      )}
                    </div>
                    {flight.incidents && (
                      <p className="text-[10px] text-brand-red mt-1 leading-tight">{flight.incidents}</p>
                    )}
                    {flight.incidentPhoto && (
                      <img src={flight.incidentPhoto} alt="Vorkommnis" className="mt-2 w-24 h-16 object-cover rounded-lg border border-brand-red/20" />
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
              </div>
            </div>
          )
        })}

        {validFlights.length === 0 && !showAdd && (
          <div className="text-center py-12 px-6">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Book className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-600 font-bold">Logbuch ist leer</p>
            <p className="text-slate-400 text-xs mt-1">Starten Sie Ihren ersten Flug und dokumentieren Sie ihn hier.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FlightAssistant({ drones, batteries, profile, onClose, onSave, currentLocation }: { drones: Drone[], batteries: Battery[], profile: UserProfile | null, onClose: () => void, onSave: (f: Flight) => void, currentLocation: [number, number] }) {
  const [selectedDroneId, setSelectedDroneId] = useState('');
  const [selectedBatteryId, setSelectedBatteryId] = useState('');
  const [selectedPilotId, setSelectedPilotId] = useState('main');
  const [pilots, setPilots] = useState<Pilot[]>([]);

  useEffect(() => {
    dbService.getPilots().then(setPilots);
  }, []);

  const selectedDrone = drones.find(d => d.id === selectedDroneId);
  const [step, setStep] = useState<'setup' | 'checklist' | 'timer' | 'summary'>('setup');
  const [locationName, setLocationName] = useState('Standort wird ermittelt...');
  const [purpose, setPurpose] = useState<Flight['purpose']>('Hobby');
  const [weatherData, setWeatherData] = useState({ temp: 20, windSpeed: 5, visibility: 'Gut', kIndex: 1, condition: 'Clear' });
  const [batteryStart, setBatteryStart] = useState(100);
  const [batteryEnd, setBatteryEnd] = useState(20);
  const [incidents, setIncidents] = useState('');
  const [incidentPhoto, setIncidentPhoto] = useState<string | undefined>(undefined);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [timerState, setTimerState] = useState<'idle' | 'running'>('idle');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [legs, setLegs] = useState<{ startTime: number, endTime: number, duration: number }[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);

  const [forecast, setForecast] = useState<ForecastHour[]>([]);
  const [notams, setNotams] = useState<Notam[]>([]);
  const [notamLoading, setNotamLoading] = useState(false);
  const [notamFir, setNotamFir] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [safetyError, setSafetyError] = useState<string | null>(null);
  const [safetyAnalysis, setSafetyAnalysis] = useState<{
    obstacles: { type: string, severity: 'Low' | 'Medium' | 'High', description: string, action: string }[],
    overall_safety_score: number,
    summary: string
  } | null>(null);

  const runSafetyAnalysis = async () => {
    if (!currentLocation[0] || !currentLocation[1]) return;
    setIsAnalyzing(true);
    setSafetyError(null);
    try {
      const response = await fetch('/api/safety-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: currentLocation[0],
          longitude: currentLocation[1],
          locationName: locationName
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setSafetyAnalysis(data);
      } else if (response.status === 404) {
        setSafetyError('Die KI-Analyse ist in dieser Version nicht verfügbar (kein Server). Nutze die Online-Version von SkyLog DE.');
      } else {
        setSafetyError('Die KI-Analyse hat gerade nicht geklappt. Bitte später erneut versuchen.');
      }
    } catch (e) {
      console.error("Safety analysis failed:", e);
      setSafetyError('Keine Verbindung zur KI. Prüfe deine Internetverbindung und versuche es erneut.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchLiveWeather = async () => {
    try {
      const w = await fetchWeather(currentLocation[0], currentLocation[1]);
      if (w) {
        setWeatherData({
          ...weatherData,
          temp: Math.round(w.temp),
          windSpeed: Math.round(w.windSpeed),
          condition: w.condition,
          visibility: w.visibility,
        });
      }
      setLocationName(`${currentLocation[0].toFixed(4)}, ${currentLocation[1].toFixed(4)}`);
    } catch (e) {}
  };

  useEffect(() => {
    if (step === 'setup') {
      fetchLiveWeather();
      fetchForecast(currentLocation[0], currentLocation[1]).then(setForecast);

      const cid = profile?.notamClientId;
      const csec = profile?.notamClientSecret;
      if (cid && csec) {
        setNotamFir(getGermanFir(currentLocation[0]));
        setNotamLoading(true);
        fetchNotams(currentLocation[0], currentLocation[1], cid, csec)
          .then(setNotams)
          .finally(() => setNotamLoading(false));
      }
    }
  }, [step]);

  useEffect(() => {
    let interval: any;
    if (timerState === 'running') {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerState]);

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const allChecked = CHECKLIST_ITEMS.every(section => 
    section.items.every(item => checkedItems[item.id])
  );

  const startLeg = () => {
    setStartTime(Date.now());
    setTimerState('running');
    setElapsedTime(0);
  };

  const stopLeg = () => {
    if (startTime) {
      const endTime = Date.now();
      const duration = Math.floor((endTime - startTime) / 1000);
      setLegs(prev => [...prev, { startTime, endTime, duration }]);
    }
    setTimerState('idle');
    setStartTime(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFinish = () => {
    const totalSeconds = legs.reduce((acc, leg) => acc + leg.duration, 0);
    const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));
    
    const finalLegs = timerState === 'running' && startTime 
      ? [...legs, { startTime, endTime: Date.now(), duration: Math.floor((Date.now() - startTime) / 1000) }]
      : legs;

    const firstStartTime = finalLegs.length > 0 
      ? new Date(finalLegs[0].startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : '';
    const lastEndTime = finalLegs.length > 0 
      ? new Date(finalLegs[finalLegs.length - 1].endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : '';

    const currentPilot = pilots.find(p => p.id === selectedPilotId) || (selectedPilotId === 'main' ? { name: profile?.name || 'Hauptpilot', id: 'main' } : null);

    onSave({
      id: crypto.randomUUID(),
      droneId: selectedDroneId,
      batteryId: selectedBatteryId,
      pilotId: selectedPilotId,
      pilotName: currentPilot?.name || 'Unbekannt',
      isGuest: selectedPilotId !== 'main',
      date: new Date().toISOString().split('T')[0],
      startTime: firstStartTime,
      endTime: lastEndTime,
      duration: totalMinutes,
      legs: finalLegs,
      location: '',
      locationName: locationName || 'Live Flug',
      coordinates: currentLocation,
      purpose: purpose,
      weather: {
        temp: weatherData.temp,
        windSpeed: weatherData.windSpeed,
        condition: weatherData.condition,
        visibility: weatherData.visibility,
        kIndex: weatherData.kIndex
      },
      batteryStatus: {
        startPercent: batteryStart,
        endPercent: batteryEnd
      },
      incidents: incidents,
      incidentPhoto: incidentPhoto,
      notes: '',
      createdAt: Date.now()
    });
  };

  const filteredBatteries = useMemo(() => {
    if (!selectedDroneId) return batteries;
    const droneSpecific = batteries.filter(b => b.droneId === selectedDroneId);
    if (droneSpecific.length > 0) return droneSpecific;
    return batteries; // Fallback to all if none assigned to this drone
  }, [batteries, selectedDroneId]);

  const steps = [
    { id: 'setup', label: 'Setup', icon: Plane },
    { id: 'checklist', label: 'Check', icon: ClipboardCheck },
    { id: 'timer', label: 'Live', icon: Timer },
    { id: 'summary', label: 'Review', icon: History }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col h-screen overflow-hidden">
      {/* Assistant Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-400"><XCircle className="w-6 h-6" /></button>
          <div className="text-center">
            <h2 className="font-black text-slate-900 uppercase tracking-tighter text-sm">Flug Assistent</h2>
            <p className="text-[9px] font-bold text-brand-blue uppercase tracking-widest">{locationName}</p>
          </div>
          <div className="w-10"></div>
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-between gap-1 relative px-2">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -translate-y-1/2 z-0 mx-8" />
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = idx <= currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div key={s.id} className="relative z-10 flex flex-col items-center gap-1.5">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500",
                  isCurrent ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/20 scale-110" : 
                  isActive ? "bg-brand-blue/10 text-brand-blue" : "bg-slate-100 text-slate-300"
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-tighter transition-colors",
                  isCurrent ? "text-slate-900" : "text-slate-400"
                )}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md mx-auto h-full flex flex-col">
          {step === 'setup' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-24">
              <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-widest">
                  <Plane className="w-5 h-5 text-brand-blue" /> Fluggerät & Mission
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Fluggerät</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                      value={selectedDroneId}
                      onChange={e => setSelectedDroneId(e.target.value)}
                    >
                      <option value="">Wähle Drohne...</option>
                      {drones.map(d => <option key={d.id} value={d.id}>{d.model}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Akku</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                      value={selectedBatteryId}
                      onChange={e => setSelectedBatteryId(e.target.value)}
                    >
                      <option value="">Wähle Akku...</option>
                      {filteredBatteries.map(b => <option key={b.id} value={b.id}>{b.number} ({b.cycles} Zyklen)</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Zweck</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                        value={purpose}
                        onChange={e => setPurpose(e.target.value as any)}
                      >
                        <option value="Hobby">Hobby</option>
                        <option value="Gewerblich">Gewerblich</option>
                        <option value="Inspektion">Inspektion</option>
                        <option value="Kamerafahrt">Kamerafahrt</option>
                        <option value="Training">Training</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Pilot</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                        value={selectedPilotId}
                        onChange={e => setSelectedPilotId(e.target.value)}
                      >
                        <option value="main">Ich (Hauptpilot)</option>
                        {pilots.map(p => (
                          <option key={p.id} value={p.id}>{p.name} {p.isGuest ? '(Gast)' : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Akku Start %</label>
                      <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" value={batteryStart} onChange={e => setBatteryStart(Number(e.target.value))} />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Einsatzort Name</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm"
                          placeholder="z.B. Schlosspark"
                          value={locationName}
                          onChange={e => setLocationName(e.target.value)}
                        />
                      </div>
                      <button 
                        onClick={runSafetyAnalysis}
                        disabled={isAnalyzing}
                        className={cn(
                          "p-3 rounded-xl transition-all disabled:opacity-50",
                          !safetyAnalysis ? "bg-brand-blue text-white animate-pulse shadow-lg shadow-brand-blue/30" : "bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20"
                        )}
                        title="KI-Sicherheitsanalyse starten"
                      >
                        {isAnalyzing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <PreFlightChecklist />

                  {!safetyAnalysis && !isAnalyzing && !safetyError && (
                    <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                      <BrainCircuit className="w-5 h-5 text-brand-blue shrink-0" />
                      <div>
                        <p className="text-[10px] font-black text-brand-blue uppercase tracking-widest">KI-Empfehlung</p>
                        <p className="text-[10px] text-slate-500 font-medium">Lasse den Ort auf versteckte Hindernisse analysieren, bevor du startest.</p>
                      </div>
                    </div>
                  )}

                  {safetyError && !isAnalyzing && (
                    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                      <p className="text-[10px] text-amber-700 font-medium leading-relaxed">{safetyError}</p>
                    </div>
                  )}

                  {/* Gemini Safety Analysis Display */}
                  {safetyAnalysis && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-5 bg-slate-900 text-white rounded-[32px] shadow-xl overflow-hidden border border-slate-800"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <BrainCircuit className="w-5 h-5 text-brand-blue" />
                          <h4 className="text-[11px] font-black uppercase tracking-widest">KI-Sicherheitsanalyse</h4>
                        </div>
                        <div className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black",
                          safetyAnalysis.overall_safety_score > 80 ? "bg-emerald-500" :
                          safetyAnalysis.overall_safety_score > 50 ? "bg-amber-500" : "bg-brand-red"
                        )}>
                          SCORE: {safetyAnalysis.overall_safety_score}/100
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-300 italic mb-4 leading-relaxed">
                        "{safetyAnalysis.summary}"
                      </p>

                      <div className="space-y-3">
                        {safetyAnalysis.obstacles.map((obs, i) => (
                          <div key={i} className="p-3 bg-white/5 rounded-2xl border border-white/10">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-black text-brand-blue uppercase">{obs.type}</span>
                              <span className={cn(
                                "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                                obs.severity === 'High' ? "bg-brand-red/20 text-brand-red" :
                                obs.severity === 'Medium' ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-500"
                              )}>
                                {obs.severity}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mb-2 leading-tight">{obs.description}</p>
                            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/5">
                              <Info className="w-3 h-3 text-brand-blue" />
                              <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tight">{obs.action}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 text-center">Wetter Bedingungen</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] text-slate-400 block mb-1">Temp / Wind</span>
                        <div className="flex items-center gap-1">
                          <input type="number" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" value={weatherData.temp} onChange={e => setWeatherData({...weatherData, temp: Number(e.target.value)})} />
                          <input type="number" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" value={weatherData.windSpeed} onChange={e => setWeatherData({...weatherData, windSpeed: Number(e.target.value)})} />
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block mb-1">Visibility / K-Index</span>
                        <div className="flex items-center gap-1">
                           <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" value={weatherData.visibility} onChange={e => setWeatherData({...weatherData, visibility: e.target.value})} />
                           <input type="number" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" value={weatherData.kIndex} onChange={e => setWeatherData({...weatherData, kIndex: Number(e.target.value)})} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Drohnen-spezifische Windgrenze */}
                  {selectedDrone && (() => {
                    const limit = selectedDrone.maxWindSpeed ?? 28;
                    const over = weatherData.windSpeed > limit;
                    return over ? (
                      <div className="flex items-center gap-3 p-4 bg-brand-red/5 border border-brand-red/20 rounded-2xl">
                        <Wind className="w-5 h-5 text-brand-red shrink-0" />
                        <div>
                          <p className="text-xs font-black text-brand-red">Wind über Limit für {selectedDrone.model}!</p>
                          <p className="text-[10px] text-slate-500">Aktuell {weatherData.windSpeed} km/h · Max {limit} km/h laut Spezifikation</p>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* 6h Wettervorhersage */}
                  {forecast.length > 0 && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 text-center tracking-widest">6h Vorhersage</p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {forecast.map((h, i) => (
                          <div key={i} className="flex flex-col items-center gap-1 min-w-[52px] bg-white rounded-xl p-2 border border-slate-100 shrink-0">
                            <span className="text-[9px] font-black text-brand-blue">{h.time}</span>
                            <span className="text-xs font-bold text-slate-800">{h.temp}°</span>
                            <span className={cn("text-[9px] font-bold", h.windSpeed > 15 ? "text-brand-red" : "text-slate-500")}>{h.windSpeed}km/h</span>
                            <span className="text-[8px] text-slate-400 leading-tight text-center">{h.condition}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live NOTAMs */}
                  {(profile?.notamClientId && profile?.notamClientSecret) ? (
                    <div className="p-4 bg-white border border-slate-200 rounded-2xl">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                            Live NOTAMs · {notamFir}
                          </p>
                        </div>
                        {notamLoading && (
                          <span className="text-[9px] text-slate-400 animate-pulse">Laden…</span>
                        )}
                      </div>
                      {!notamLoading && notams.length === 0 && (
                        <p className="text-[10px] text-brand-green font-bold text-center py-2">
                          Keine aktiven NOTAMs für {notamFir}
                        </p>
                      )}
                      {notams.length > 0 && (
                        <div className="space-y-2">
                          {notams.map(n => (
                            <div key={n.id} className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-black text-amber-700 uppercase">{n.location} · {n.type}</span>
                                <span className="text-[8px] text-slate-400">{formatNotamDate(n.startDate)}</span>
                              </div>
                              <p className="text-[10px] text-slate-700 leading-snug font-mono">{summariseNotam(n.text)}</p>
                              {n.endDate && (
                                <p className="text-[8px] text-slate-400 mt-1">bis {formatNotamDate(n.endDate)}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                      <AlertTriangle className="w-4 h-4 text-slate-300 shrink-0" />
                      <p className="text-[10px] text-slate-400 leading-tight">
                        <span className="font-bold">NOTAM-Feed nicht aktiviert.</span> API-Key unter Profil eingeben (developer.faa.gov · kostenlos).
                      </p>
                    </div>
                  )}

                  {/* Smart Legal Check */}
                  {selectedDrone && (
                    <div className="p-5 bg-white border border-slate-200 rounded-[32px] shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-brand-blue" />
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">LBA Regulierungs-Check</p>
                        </div>
                        {(() => {
                          const uasClass = selectedDrone.uasClass || 'Legacy';
                          const weight = selectedDrone.weight;
                          const license = profile?.licenseType;
                          let category = 'A3';
                          if (uasClass === 'C0' || uasClass === 'C1' || weight < 500) category = 'A1';
                          else if (uasClass === 'C2' && license === 'A2') category = 'A2';
                          return (
                            <span className="px-2 py-0.5 bg-brand-blue text-white rounded-full text-[9px] font-black">
                              KATEGORIE {category}
                            </span>
                          );
                        })()}
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                            <MapPin className="w-4 h-4 text-brand-orange" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Vorgeschriebener Abstand</p>
                            <p className="text-xs font-black text-slate-900">
                              {(() => {
                                const uasClass = selectedDrone.uasClass || 'Legacy';
                                const weight = selectedDrone.weight;
                                if (uasClass === 'C0' || weight < 250) return 'Kein Mindestabstand zu Personen';
                                if (uasClass === 'C1' || (uasClass === 'Legacy' && weight < 500)) return 'Kein Überflug von Personen';
                                if (uasClass === 'C2' && profile?.licenseType === 'A2') return '30m (5m im Langsamflugmodus)';
                                return '150m zu Wohn/Gewerbe/Menschen';
                              })()}
                            </p>
                          </div>
                        </div>

                        {profile?.licenseType === 'A1/A3' && selectedDrone.uasClass === 'C2' && (
                          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-2xl">
                            <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] font-medium text-amber-700 leading-relaxed">
                              Mit deinem <span className="font-bold">A1/A3 Schein</span> darfst du diese Drohne (C2) nur in <span className="font-bold text-slate-900">Kategorie A3</span> (weit weg von Menschen) fliegen. Für A2 ist ein Zusatzzeugnis nötig.
                            </p>
                          </div>
                        )}

                        {!profile?.licenseType && (
                          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-2xl">
                            <AlertTriangle className="w-3.5 h-3.5 text-brand-red shrink-0 mt-0.5" />
                            <p className="text-[10px] font-black text-brand-red uppercase leading-tight">
                              Kein Pilotenschein hinterlegt! Bitte Profil aktualisieren.
                            </p>
                          </div>
                        )}

                        {profile?.isBOS && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-brand-red text-white rounded-xl shadow-lg shadow-brand-red/20">
                            <Rocket className="w-3.5 h-3.5 animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest">BOS-Sonderrechte aktiv</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-center">
              <button 
                disabled={!selectedDroneId || !selectedBatteryId}
                onClick={() => setStep('checklist')}
                className="w-full max-w-md bg-brand-blue text-white font-black py-4 rounded-[32px] shadow-xl shadow-brand-blue/20 disabled:opacity-50 transition-all active:scale-95 text-xs uppercase tracking-widest"
              >
                Weiter zur Checkliste
              </button>
            </div>
          </motion.div>
        )}

        {step === 'checklist' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-brand-blue" /> Pre-Flight Check
              </h3>
              <p className="text-xs font-bold text-brand-blue">Wichtig!</p>
            </div>
            
            <div className="space-y-6 pb-20">
              {safetyAnalysis && (
                <div className={cn(
                  "p-4 rounded-3xl border flex items-center gap-4 transition-all",
                  safetyAnalysis.overall_safety_score > 70 ? "bg-emerald-50 border-emerald-100" :
                  safetyAnalysis.overall_safety_score > 40 ? "bg-amber-50 border-amber-100" : "bg-red-50 border-red-100"
                )}>
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
                    safetyAnalysis.overall_safety_score > 70 ? "bg-emerald-500 text-white" :
                    safetyAnalysis.overall_safety_score > 40 ? "bg-amber-500 text-white" : "bg-brand-red text-white"
                  )}>
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">KI-Sicherheits-Check</h4>
                    <p className="text-[10px] text-slate-600 font-medium line-clamp-2 leading-tight">
                      {safetyAnalysis.summary}
                    </p>
                  </div>
                </div>
              )}

              {CHECKLIST_ITEMS.map((section, idx) => (
                <div key={idx}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1">{section.title}</p>
                  <div className="space-y-2">
                    {section.items.map(item => (
                      <button 
                        key={item.id}
                        onClick={() => toggleCheck(item.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all",
                          checkedItems[item.id] ? "bg-brand-green/10 border-brand-green/20" : "bg-white border-slate-200"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0",
                          checkedItems[item.id] ? "bg-brand-green border-brand-green" : "border-slate-300"
                        )}>
                          {checkedItems[item.id] && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <span className={cn("text-xs font-semibold", checkedItems[item.id] ? "text-brand-green" : "text-slate-600")}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-slate-50/80 backdrop-blur-md">
              <button 
                disabled={!allChecked}
                onClick={() => setStep('timer')}
                className="w-full max-w-md mx-auto block bg-brand-green text-white font-bold py-4 rounded-2xl shadow-xl shadow-brand-green/20 disabled:opacity-30 transition-all active:scale-95"
              >
                Ready to Fly - Starten
              </button>
            </div>
          </motion.div>
        )}

        {step === 'timer' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center">
            {/* Main Timer Display */}
            <div className="bg-white p-8 rounded-[48px] border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col items-center mb-8 w-full">
              <div className="w-48 h-48 rounded-full border-8 border-slate-50 flex items-center justify-center relative mb-8">
                 <div className="text-center">
                    <p className="text-5xl font-black text-slate-900 font-mono tracking-tighter leading-none">{formatTime(elapsedTime)}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{timerState === 'running' ? 'In der Luft' : 'Flugbereit'}</p>
                 </div>
                 {timerState === 'running' && (
                   <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-red text-white text-[9px] px-3 py-1 rounded-full font-black tracking-widest animate-pulse"
                    >
                      LIVE FLUG
                    </motion.div>
                 )}
              </div>

              <div className="flex items-center justify-center gap-6">
                {timerState === 'idle' ? (
                  <button 
                    onClick={startLeg}
                    className="bg-brand-blue text-white w-20 h-20 rounded-[28px] flex items-center justify-center shadow-xl shadow-brand-blue/30 active:scale-90 transition-all group"
                  >
                    <Play className="w-8 h-8 fill-current group-hover:scale-110 transition-transform" />
                  </button>
                ) : (
                  <button 
                    onClick={stopLeg}
                    className="bg-brand-red text-white w-20 h-20 rounded-[28px] flex items-center justify-center shadow-xl shadow-brand-red/30 active:scale-90 transition-all group"
                  >
                    <Square className="w-8 h-8 fill-current group-hover:scale-110 transition-transform" />
                  </button>
                )}
              </div>
            </div>

            <div className="w-full bg-white rounded-[32px] border border-slate-200 p-6 flex-1 overflow-hidden flex flex-col mb-24">
               <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-4">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-400" />
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Flug-Abschnitte (Legs)</h4>
                  </div>
                  <span className="text-[9px] font-bold text-brand-blue bg-brand-blue/5 px-2 py-1 rounded-full">Leg {legs.length + (timerState === 'running' ? 1 : 0)}</span>
               </div>
               <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                 {legs.map((leg, i) => (
                   <div key={i} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100/50">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Log entry {i + 1}</span>
                        <span className="text-[10px] font-bold text-slate-600">{new Date(leg.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <span className="text-sm font-black text-slate-900 font-mono tracking-tight">{formatTime(leg.duration)}</span>
                   </div>
                 ))}
                 {legs.length === 0 && timerState === 'idle' && (
                   <div className="text-center py-12">
                     <p className="text-slate-300 font-bold text-xs uppercase tracking-widest">Warten auf Take-off</p>
                   </div>
                 )}
               </div>
               <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Gesamtflugzeit</span>
                  <span className="text-xl font-black text-brand-blue font-mono tracking-tighter">
                     {formatTime(legs.reduce((acc, l) => acc + l.duration, 0) + elapsedTime)}
                  </span>
               </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-center">
              <button 
                 disabled={legs.length === 0 && timerState === 'idle'}
                 onClick={() => setStep('summary')}
                 className="w-full max-w-md bg-slate-900 text-white font-black py-4 rounded-[32px] shadow-xl active:scale-95 transition-all text-xs uppercase tracking-widest disabled:opacity-50"
               >
                 Session Abschliessen
               </button>
            </div>
          </motion.div>
        )}

        {step === 'summary' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 flex flex-col h-full">
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex-1 overflow-y-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-brand-blue/5 flex items-center justify-center border border-brand-blue/10">
                  <CheckCircle2 className="w-6 h-6 text-brand-blue" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">Flugbericht</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Abschluss & Review</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Dauer</p>
                    <p className="text-sm font-black text-slate-900">{Math.max(1, Math.round(legs.reduce((acc, l) => acc + l.duration, 0) / 60))} Min</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Verbrauch</p>
                    <p className="text-sm font-black text-slate-900">{batteryStart - batteryEnd}%</p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Akku Ende %</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="0" 
                      max={batteryStart} 
                      className="flex-1 h-1.5 bg-slate-100 rounded-full appearance-none accent-brand-blue"
                      value={batteryEnd} 
                      onChange={e => setBatteryEnd(Number(e.target.value))} 
                    />
                    <span className="text-sm font-black text-slate-900 w-12 text-right">{batteryEnd}%</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Wetter (Review)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                      <Thermometer className="w-4 h-4 text-slate-400" />
                      <input type="number" className="w-full bg-transparent text-xs font-bold font-mono outline-none" value={weatherData.temp} onChange={e => setWeatherData({...weatherData, temp: Number(e.target.value)})} />
                      <span className="text-[10px] font-bold text-slate-400">°C</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                      <Wind className="w-4 h-4 text-slate-400" />
                      <input type="number" className="w-full bg-transparent text-xs font-bold font-mono outline-none" value={weatherData.windSpeed} onChange={e => setWeatherData({...weatherData, windSpeed: Number(e.target.value)})} />
                      <span className="text-[10px] font-bold text-slate-400">km/h</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Vorkommnisse / Anomalien</label>
                  <textarea
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm min-h-[100px] outline-none"
                    placeholder="Waren Vögel, Passanten oder techn. Probleme präsent?"
                    value={incidents}
                    onChange={e => setIncidents(e.target.value)}
                  />
                  <div className="mt-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Foto (optional)</label>
                    {incidentPhoto ? (
                      <div className="relative">
                        <img src={incidentPhoto} alt="Vorkommnisfoto" className="w-full max-h-40 object-cover rounded-xl border border-slate-200" />
                        <button
                          onClick={() => setIncidentPhoto(undefined)}
                          className="absolute top-2 right-2 bg-brand-red text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
                        >✕</button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                        <Camera className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-400">Foto aufnehmen oder hochladen</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = ev => setIncidentPhoto(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Zusammenfassung Legs</p>
                  <div className="space-y-1">
                    {legs.map((leg, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50/50 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-500">LEG {i + 1}</span>
                        <div className="flex items-center gap-3">
                           <span className="text-[9px] text-slate-400">{new Date(leg.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                           <span className="text-[10px] font-black text-slate-900 font-mono">{formatTime(leg.duration)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="pb-10 pt-4">
              <button 
                onClick={handleFinish}
                className="w-full bg-brand-blue text-white font-black py-4 rounded-[32px] shadow-xl shadow-brand-blue/20 active:scale-95 transition-all text-xs uppercase tracking-widest"
              >
                Flug im Logbuch versiegeln
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  </div>
  );
}

function ChecklistView() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const totalItems = CHECKLIST_ITEMS.reduce((acc, s) => acc + s.items.length, 0);
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const progress = (checkedCount / totalItems) * 100;

  return (
    <div className="max-w-md mx-auto pb-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pre-Flight Check</h2>
          <p className="text-slate-500 text-sm font-medium">Sicherheit geht vor jedem Start vor</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-brand-blue">{Math.round(progress)}%</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Fertig</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-200 rounded-full mb-8 overflow-hidden">
        <motion.div 
          className="h-full bg-brand-green"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-8">
        {CHECKLIST_ITEMS.map((section, idx) => (
          <div key={idx}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-brand-blue/10 rounded-xl">
                <section.icon className="w-5 h-5 text-brand-blue" />
              </div>
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">{section.title}</h3>
            </div>
            
            <div className="space-y-2">
              {section.items.map((item) => (
                <button 
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left",
                    checked[item.id] 
                      ? "bg-brand-green/5 border-brand-green/20" 
                      : "bg-white border-slate-200 shadow-sm"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all",
                    checked[item.id] 
                      ? "bg-brand-green border-brand-green" 
                      : "border-slate-300"
                  )}>
                    {checked[item.id] && <CheckCircle className="w-4 h-4 text-white" />}
                  </div>
                  <span className={cn(
                    "text-xs font-semibold",
                    checked[item.id] ? "text-brand-green" : "text-slate-700"
                  )}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {progress === 100 && (
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mt-10 p-6 bg-brand-green text-white rounded-3xl text-center shadow-xl shadow-brand-green/20"
        >
          <ShieldCheck className="w-12 h-12 mx-auto mb-3" />
          <h3 className="text-xl font-bold mb-1">Bereit zum Abheben!</h3>
          <p className="text-sm text-green-50 opacity-90">Alle Checks erfolgreich abgeschlossen. Guten Flug!</p>
        </motion.div>
      )}

      <button 
        onClick={() => setChecked({})}
        className="w-full mt-8 py-4 text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-brand-red transition-colors"
      >
        Checkliste zurücksetzen
      </button>
    </div>
  );
}

function KnowledgeView() {
  const sections = [
    {
      title: "Die 'Offene' Kategorie",
      icon: Scale,
      content: [
        { label: "A1 (Unter 250g/900g)", text: "Kein Überflug von unbeteiligten Personen (bei <250g toleriert, aber zu vermeiden)." },
        { label: "A2 (Unter 4kg)", text: "Mindestabstand von 30m zu unbeteiligten Personen (Langsammodus 5m). Fernpiloten-Zeugnis erforderlich." },
        { label: "A3 (Unter 25kg)", text: "Fernhalten von Menschen. Mind. 150m Abstand zu Wohn-, Gewerbe- oder Industriegebieten." }
      ]
    },
    {
      title: "Grundregeln & Pflichten",
      icon: BadgeAlert,
      content: [
        { label: "Registrierung (e-ID)", text: "Nahezu JEDER Betreiber muss sich beim LBA registrieren. Die e-ID muss sichtbar auf der Drohne angebracht sein." },
        { label: "Versicherung", text: "Eine Haftpflichtversicherung ist in Deutschland gesetzlich vorgeschrieben – auch für kleinste Drohnen." },
        { label: "Sichtverbindung (VLOS)", text: "Der Betrieb ist nur in direkter Sichtweite des Fernpiloten zulässig." }
      ]
    },
    {
      title: "Verbote",
      icon: XCircle,
      content: [
        { label: "Flughäfen", text: "Strikte Verbotszonen rund um Flugplätze und Hubschrauberlandeplätze." },
        { label: "Einsatzorte", text: "Verbot über Wohngrundstücken (wenn Kamera vorhanden), Naturschutzgebieten und Menschenansammlungen." },
        { label: "Höhenlimit", text: "Die maximale Flughöhe beträgt in der Regel 120 Meter über Grund." }
      ]
    }
  ];

  return (
    <div className="max-w-md mx-auto pb-12">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">LBA Wissen</h2>
        <p className="text-slate-500 text-sm font-medium">Offizielle Regeln & Informationen</p>
      </div>

      <div className="space-y-8">
        {sections.map((section, idx) => (
          <div key={idx}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-brand-blue/10 rounded-xl">
                <section.icon className="w-5 h-5 text-brand-blue" />
              </div>
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">{section.title}</h3>
            </div>
            
            <div className="space-y-3">
              {section.content.map((item, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-black text-brand-blue uppercase mb-1">{item.label}</p>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 p-6 bg-slate-900 rounded-3xl text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-white/20 rounded-xl">
            <ExternalLink className="w-5 h-5" />
          </div>
          <h4 className="font-bold">Mehr Details</h4>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Dies ist eine Zusammenfassung. Detaillierte und rechtlich bindende Informationen finden Sie auf der Webseite des Luftfahrt-Bundesamtes.
        </p>
        <a 
          href="https://www.lba.de/DE/Drohnen/Drohnen_node.html" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-white text-slate-900 px-5 py-2.5 rounded-xl text-xs font-bold font-sans"
        >
          LBA Webseite öffnen <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

function InventoryView() {
  const [parts] = useState<SparePart[]>([
    { id: '1', name: 'Landegestell DJI Mini 3', description: '3D-gedrucktes Landegestell für hohe Gräser.', stlUrl: '#', printable: true },
    { id: '2', name: 'Kameraschutz Sonnenblende', description: 'Reduziert Lens-Flare bei tiefstehender Sonne.', stlUrl: '#', printable: true },
    { id: '3', name: 'e-ID Halterung', description: 'Clip-on Halterung für die LBA Plakette.', stlUrl: '#', printable: true }
  ]);

  const [bambuStatus] = useState({ state: 'Idle', progress: 0, model: '-' });

  return (
    <div className="max-w-md mx-auto pb-12">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand-blue">Ersatzteil-Katalog</h2>
        <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">3D-Druck & Hardware Verwaltung</p>
      </div>

      <div className="bg-slate-900 text-white p-6 rounded-[32px] mb-8 shadow-xl shadow-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <Printer className="w-6 h-6 text-brand-green" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Bambu Lab A1</p>
              <h4 className="font-bold">Heim-Werkstatt</h4>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest">Nicht verbunden</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight text-slate-400">
            <span>Status</span>
            <span className="text-slate-500 font-mono">Offline</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
             <div className="h-full bg-slate-600 transition-all" style={{ width: `0%` }} />
          </div>
          <p className="text-[10px] text-slate-500 italic">Bambu API-Token in den Einstellungen hinterlegen, um den Drucker zu verbinden.</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Verfügbare STL-Dateien</h3>
        {parts.map(part => (
          <div key={part.id} className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-brand-blue/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-brand-blue/5 transition-colors">
                <Cpu className="w-6 h-6 text-slate-400 group-hover:text-brand-blue transition-colors" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{part.name}</h4>
                <p className="text-[10px] text-slate-500 font-medium">{part.description}</p>
              </div>
            </div>
            <button className="p-3 bg-brand-blue/5 text-brand-blue rounded-2xl hover:bg-brand-blue hover:text-white transition-all shadow-sm">
              <Download className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-10 p-10 bg-white border border-slate-200 rounded-[32px] text-center border-dashed group hover:bg-slate-50 transition-colors cursor-pointer">
         <Plus className="w-8 h-8 text-slate-300 mx-auto mb-2 group-hover:text-brand-blue transition-colors" />
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed group-hover:text-slate-600 transition-colors">Eigene CAD-Daten verknüpfen</p>
      </div>
    </div>
  );
}

function PilotsView() {
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newPilot, setNewPilot] = useState<Partial<Pilot>>({ isGuest: true });

  const loadPilots = async () => {
    const list = await dbService.getPilots();
    setPilots(list);
  };

  useEffect(() => {
    loadPilots();
  }, []);

  const handleAddPilot = async () => {
    if (!newPilot.name || !newPilot.eid) return;
    await dbService.savePilot({
      id: crypto.randomUUID(),
      name: newPilot.name,
      eid: newPilot.eid,
      isGuest: !!newPilot.isGuest,
      createdAt: Date.now()
    } as Pilot);
    setNewPilot({ isGuest: true });
    setShowAdd(false);
    loadPilots();
  };

  const handleDelete = async (id: string) => {
    await dbService.deletePilot(id);
    loadPilots();
  };

  return (
    <div className="max-w-md mx-auto pb-12">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand-blue">Piloten-Management</h2>
        <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">LBA Registrierungen & Gast-Zugänge</p>
      </div>

      <div className="space-y-4">
        {pilots.length === 0 && !showAdd && (
          <div className="bg-white p-8 rounded-[32px] border border-slate-200 text-center">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Keine Gast-Piloten hinterlegt</p>
          </div>
        )}

        {pilots.map(pilot => (
          <div key={pilot.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
             {pilot.isGuest && (
               <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-xl">
                 Gast
               </div>
             )}
             <div className="flex items-center gap-4 mb-4">
               <div className="w-12 h-12 rounded-2xl bg-brand-blue/5 flex items-center justify-center border border-brand-blue/10">
                 <User className="w-6 h-6 text-brand-blue" />
               </div>
               <div>
                 <h4 className="font-bold text-slate-900">{pilot.name}</h4>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">{pilot.eid}</p>
               </div>
             </div>
             
             <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-1.5">
                   <ShieldCheck className="w-3.5 h-3.5 text-brand-green" />
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Status: Aktiv</span>
                </div>
                <button 
                  onClick={() => handleDelete(pilot.id)}
                  className="text-[10px] font-black text-slate-300 hover:text-brand-red uppercase tracking-widest transition-colors"
                >
                  Löschen
                </button>
             </div>
          </div>
        ))}

        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
               <div className="bg-slate-900 text-white p-6 rounded-[32px] space-y-4 shadow-xl">
                  <h4 className="font-bold text-sm uppercase tracking-widest text-slate-400">Gast hinzufügen</h4>
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Name des Gastes" 
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30"
                      value={newPilot.name || ''}
                      onChange={e => setNewPilot({...newPilot, name: e.target.value})}
                    />
                    <input 
                      type="text" 
                      placeholder="LBA Betreiber-ID (e-ID)" 
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-white/30"
                      value={newPilot.eid || ''}
                      onChange={e => setNewPilot({...newPilot, eid: e.target.value})}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAdd(false)} className="flex-1 py-3 bg-white/5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-colors">Abbrechen</button>
                    <button onClick={handleAddPilot} className="flex-1 py-3 bg-brand-blue rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-colors">Speichern</button>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!showAdd && (
          <button 
            onClick={() => setShowAdd(true)}
            className="w-full p-6 border-2 border-dashed border-slate-200 rounded-[32px] text-slate-400 flex flex-col items-center gap-2 hover:bg-white hover:border-brand-blue/30 transition-all group"
          >
            <Plus className="w-8 h-8 group-hover:text-brand-blue transition-colors" />
            <span className="text-[10px] font-black uppercase tracking-widest group-hover:text-slate-600 transition-colors">Gast-Piloten hinzufügen</span>
          </button>
        )}
      </div>

      <div className="mt-10 p-6 bg-amber-50 border border-amber-100 rounded-[32px] relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 opacity-5">
           <ShieldAlert className="w-24 h-24 text-amber-900" />
        </div>
        <div className="flex gap-3 relative z-10">
          <Info className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Versicherungs-Hinweis</h4>
            <p className="text-xs text-amber-800/80 leading-relaxed font-medium">
              Stelle sicher, dass Gast-Piloten durch deine Drohnen-Haftpflicht mitversichert sind. Die LBA e-ID des verantwortlichen Luftfahrzeugfernsteuerers muss am Gerät verbleiben.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}



