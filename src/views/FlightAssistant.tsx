import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, BrainCircuit, Camera, CheckCircle, CheckCircle2, ClipboardCheck,
  Clock, History, Info, ListChecks, MapPin, Plane, Play, Rocket, Settings2,
  ShieldCheck, Sparkles, Square, Thermometer, Timer, Wind, XCircle, Zap,
} from 'lucide-react';
import { dbService, type Flight, type Drone, type Battery, type UserProfile, type Pilot } from '../services/db';
import { fetchWeather, fetchForecast, minutesUntilSunset, type WeatherData, type ForecastHour } from '../services/weather';
import { bewerteFlugfenster, besteStunde, sonnenuntergangStunde, type FensterBewertung } from '../services/flightWindow';
import { fetchNotams, getGermanFir, formatNotamDate, summariseNotam, type Notam } from '../services/notam';
import { ladeChecklist, type ChecklistArt, type ChecklistPunkt } from '../services/checklists';
import { cn } from '../lib/utils';
import { useSprache } from '../lib/sprache';
import { AirspaceCheckPanel } from '../components/AirspaceCheckPanel';
import { AviationWeatherPanel } from '../components/AviationWeatherPanel';
import { ChecklistEditorDialog } from '../components/lazyDialogs';

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

function PreFlightChecklist({ art = 'preflight', titel = 'Pre-Flight Check' }: { art?: ChecklistArt, titel?: string }) {
  const [items, setItems] = useState<ChecklistPunkt[]>(() => ladeChecklist(art));
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [editor, setEditor] = useState(false);

  const done = items.filter(i => checked[i.id]).length;
  const allDone = items.length > 0 && done === items.length;
  const toggle = (id: string) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-brand-blue" />
          <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{titel}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full", allDone ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500")}>
            {done}/{items.length}
          </span>
          <button onClick={() => setEditor(true)} aria-label="Checkliste bearbeiten" className="p-1 text-slate-300 hover:text-brand-blue">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            className="w-full flex items-center gap-3 py-2 text-left active:scale-[0.99] transition-transform"
          >
            {checked[item.id]
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              : <div className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />}
            <span className={cn("text-xs font-medium", checked[item.id] ? "text-slate-400 line-through" : "text-slate-700")}>{item.text}</span>
          </button>
        ))}
      </div>
      {allDone && (
        <div className="mt-3 flex items-center gap-2 p-2.5 bg-emerald-50 rounded-xl">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          <p className="text-[10px] font-bold text-emerald-700">Alles geprüft — startklar!</p>
        </div>
      )}

      {editor && (
        <ChecklistEditorDialog
          art={art}
          titel={titel}
          onClose={() => { setEditor(false); setItems(ladeChecklist(art)); }}
        />
      )}
    </div>
  );
}

export function FlightAssistant({ drones, batteries, profile, onClose, onSave, currentLocation }: { drones: Drone[], batteries: Battery[], profile: UserProfile | null, onClose: () => void, onSave: (f: Flight) => void, currentLocation: [number, number] }) {
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
  const [weatherData, setWeatherData] = useState({ temp: 20, windSpeed: 5, windSpeed120: 0, windGusts: 0, visibility: 'Gut', kIndex: 1, condition: 'Clear' });
  const [sunset, setSunset] = useState<string | null>(null);
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
        setWeatherData(prev => ({
          ...prev,
          temp: Math.round(w.temp),
          windSpeed: Math.round(w.windSpeed),
          windSpeed120: Math.round(w.windSpeed120),
          windGusts: Math.round(w.windGusts),
          condition: w.condition,
          visibility: w.visibility,
        }));
        setSunset(w.sunset);
      }
      setLocationName(`${currentLocation[0].toFixed(4)}, ${currentLocation[1].toFixed(4)}`);
    } catch { /* Reverse-Geocoding optional — Koordinaten reichen als Anzeige */ }
  };

  useEffect(() => {
    if (step === 'setup') {
      fetchLiveWeather();
      fetchForecast(currentLocation[0], currentLocation[1]).then(setForecast);

      const cid = profile?.notamClientId;
      const csec = profile?.notamClientSecret;
      if (cid && csec) {
        setNotamFir(getGermanFir(currentLocation[0], currentLocation[1]));
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

                  {/* Drohnen-spezifische Windgrenze.
                      Geprüft wird nicht nur der Bodenwind: auf Flughöhe (120 m) weht es
                      meist stärker, und Böen sind für die Drohne kritischer als der
                      Mittelwind. Es zählt der ungünstigste der drei Werte. */}
                  {selectedDrone && (() => {
                    const limit = selectedDrone.maxWindSpeed ?? 28;
                    const kandidaten = [
                      { wert: weatherData.windSpeed, quelle: 'am Boden' },
                      { wert: weatherData.windSpeed120, quelle: 'auf 120 m Flughöhe' },
                      { wert: weatherData.windGusts, quelle: 'in Böen' },
                    ].filter(k => k.wert > 0);

                    const schlimmster = kandidaten.reduce(
                      (max, k) => (k.wert > max.wert ? k : max),
                      { wert: 0, quelle: '' }
                    );
                    if (schlimmster.wert <= limit) return null;

                    return (
                      <div className="flex items-center gap-3 p-4 bg-brand-red/5 border border-brand-red/20 rounded-2xl">
                        <Wind className="w-5 h-5 text-brand-red shrink-0" />
                        <div>
                          <p className="text-xs font-black text-brand-red">Wind über Limit für {selectedDrone.model}!</p>
                          <p className="text-[10px] text-slate-500">
                            {schlimmster.wert} km/h {schlimmster.quelle} · Max {limit} km/h laut Spezifikation
                          </p>
                          {weatherData.windSpeed120 > weatherData.windSpeed && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Am Boden nur {weatherData.windSpeed} km/h — oben ist es deutlich windiger.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sonnenuntergang: ab da braucht die Drohne Kennzeichnung/Blinklicht. */}
                  {(() => {
                    const minuten = minutesUntilSunset(sunset);
                    if (minuten === null || minuten > 90) return null;
                    return (
                      <div className="flex items-center gap-3 p-4 bg-brand-yellow/5 border border-brand-yellow/30 rounded-2xl">
                        <Clock className="w-5 h-5 text-brand-yellow shrink-0" />
                        <div>
                          <p className="text-xs font-black text-slate-800">
                            Sonnenuntergang in {minuten < 60 ? `${minuten} Min` : `${Math.floor(minuten / 60)} Std ${minuten % 60} Min`}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Danach ist Nachtflug — die Drohne braucht ein blinkendes grünes Positionslicht.
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Amtliche Geo-Zonen am Standort (dipul/DFS) */}
                  <AirspaceCheckPanel lat={currentLocation[0]} lon={currentLocation[1]} />

                  {/* Luftfahrtwetter der nächsten Flugplatz-Station (METAR/TAF) */}
                  <AviationWeatherPanel lat={currentLocation[0]} lon={currentLocation[1]} />

                  {/* 6h Wettervorhersage mit Flugfenster-Bewertung */}
                  {forecast.length > 0 && (() => {
                    const fenster = bewerteFlugfenster(
                      forecast,
                      selectedDrone?.maxWindSpeed ?? 28,
                      sonnenuntergangStunde(sunset),
                    );
                    const beste = besteStunde(fenster);
                    const rahmen: Record<FensterBewertung, string> = {
                      gut: 'border-brand-green/50 bg-brand-green/5',
                      grenzwertig: 'border-amber-400/60 bg-amber-50',
                      schlecht: 'border-brand-red/40 bg-brand-red/5',
                      nacht: 'border-slate-300 bg-slate-100',
                    };
                    return (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 text-center tracking-widest">6h Flugfenster</p>
                      <p className="text-[9px] text-slate-400 mb-2 text-center">
                        {beste
                          ? <>Beste Zeit: <span className="font-black text-brand-green">{beste.time}</span> ({beste.maxWindKmh} km/h)</>
                          : <span className="font-black text-brand-red">Keine geeignete Stunde in den nächsten 6 h</span>}
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {forecast.map((h, i) => (
                          <div key={i} className={cn('flex flex-col items-center gap-1 min-w-[64px] rounded-xl p-2 border shrink-0', rahmen[fenster[i].bewertung])}>
                            <span className="text-[9px] font-black text-brand-blue">{h.time}</span>
                            <span className="text-xs font-bold text-slate-800">{h.temp}°</span>
                            {/* Bodenwind / Wind auf Flughöhe — der obere Wert ist der relevante. */}
                            <span className={cn("text-[9px] font-bold", h.windSpeed > 15 ? "text-brand-red" : "text-slate-500")}>{h.windSpeed}km/h</span>
                            {h.windSpeed120 > 0 && (
                              <span className={cn("text-[9px] font-bold", h.windSpeed120 > 20 ? "text-brand-red" : "text-slate-400")}>
                                ↑{h.windSpeed120}
                              </span>
                            )}
                            {h.windGusts > 0 && (
                              <span className={cn("text-[8px] font-bold", h.windGusts > 25 ? "text-brand-red" : "text-slate-400")}>
                                ⇡{h.windGusts}
                              </span>
                            )}
                            <span className="text-[8px] text-slate-400 leading-tight text-center">{h.condition}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    );
                  })()}

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

                <PreFlightChecklist art="postflight" titel="Nach-Flug-Check" />

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
