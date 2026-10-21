import { useSprache } from '../lib/sprache';
import { useState, useEffect, useMemo, useId, useRef } from 'react';
import { ClipboardCheck, History, Plane, Timer, XCircle } from 'lucide-react';
import { dbService, type Flight, type Drone, type Battery, type UserProfile, type Pilot } from '../services/db';
import { fetchWeather, fetchForecast, type ForecastHour } from '../services/weather';
import { fetchNotams, getGermanFir, type Notam } from '../services/notam';
import { cn } from '../lib/utils';
import { apiUrl } from '../lib/apiBase';
import { Capacitor } from '@capacitor/core';
import { ortsnameFuer } from '../services/geocode';
import { bestaetige } from '../services/dialog';
import { useEbene } from '../lib/useEbene';
import { fokusFalle, useDialogFokus } from '../lib/useDialogFokus';
import { useCheckliste } from './flugAssistent/checkliste';
import { SchrittVorbereitung } from './flugAssistent/SchrittVorbereitung';
import { SchrittCheckliste } from './flugAssistent/SchrittCheckliste';
import { SchrittFlug } from './flugAssistent/SchrittFlug';
import { SchrittAbschluss } from './flugAssistent/SchrittAbschluss';
import { summeSekunden, type Abschnitt, type AssistentWetter, type KiAnalyse } from './flugAssistent/typen';

// Der Assistent hält Zustand und Ablauf; die vier Schritte liegen in ./flugAssistent.
export function FlightAssistant({ drones, batteries, profile, letzterFlug, onClose, onSave, currentLocation }: {
  drones: Drone[], batteries: Battery[], profile: UserProfile | null,
  /** Zum Vorbelegen: zuletzt genutzte Drohne und Zweck. */
  letzterFlug?: Flight,
  onClose: () => void, onSave: (f: Flight) => void, currentLocation: [number, number],
}) {
  const { tx } = useSprache();
  // Vorauswahl statt leerer Felder: zuletzt geflogene Drohne, sonst die einzige.
  const [selectedDroneId, setSelectedDroneId] = useState(() =>
    (letzterFlug && drones.some(d => d.id === letzterFlug.droneId) ? letzterFlug.droneId : undefined)
      ?? (drones.length === 1 ? drones[0].id : ''));
  const [selectedBatteryId, setSelectedBatteryId] = useState(() => (batteries.length === 1 ? batteries[0].id : ''));
  const [selectedPilotId, setSelectedPilotId] = useState('main');
  const [pilots, setPilots] = useState<Pilot[]>([]);

  useEffect(() => {
    dbService.getPilots().then(setPilots);
  }, []);

  const [step, setStep] = useState<'setup' | 'checklist' | 'timer' | 'summary'>('setup');
  const [locationName, setLocationName] = useState(`${currentLocation[0].toFixed(4)}, ${currentLocation[1].toFixed(4)}`);
  const [purpose, setPurpose] = useState<Flight['purpose']>(letzterFlug?.purpose ?? 'Hobby');
  const [weatherData, setWeatherData] = useState<AssistentWetter>({ temp: 20, windSpeed: 5, windSpeed120: 0, windGusts: 0, visibility: 'Gut', kIndex: 1, condition: 'Clear' });
  const [sunset, setSunset] = useState<string | null>(null);
  const [batteryStart, setBatteryStart] = useState(100);
  const [batteryEnd, setBatteryEnd] = useState(20);
  const [incidents, setIncidents] = useState('');
  const [incidentPhoto, setIncidentPhoto] = useState<string | undefined>(undefined);
  // Eine Checkliste: die anpassbare Vorflug-Liste gibt den Start frei.
  const vorflug = useCheckliste('preflight');
  const nachflug = useCheckliste('postflight');
  const [timerState, setTimerState] = useState<'idle' | 'running'>('idle');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [legs, setLegs] = useState<Abschnitt[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);

  const [forecast, setForecast] = useState<ForecastHour[]>([]);
  const [notams, setNotams] = useState<Notam[]>([]);
  const [notamLoading, setNotamLoading] = useState(false);
  const [notamFir, setNotamFir] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [safetyError, setSafetyError] = useState<string | null>(null);
  const [safetyAnalysis, setSafetyAnalysis] = useState<KiAnalyse | null>(null);

  const runSafetyAnalysis = async () => {
    if (!currentLocation[0] || !currentLocation[1]) return;
    const url = apiUrl('/api/safety-check', import.meta.env.VITE_API_BASE, Capacitor.isNativePlatform());
    if (!url) {
      setSafetyError(tx('Die KI-Analyse ist in dieser Version nicht verfügbar (kein Server). Nutze die Online-Version von SkyLog DE.', 'The AI analysis is not available in this version (no server). Use the online version of SkyLog DE.'));
      return;
    }
    setIsAnalyzing(true);
    setSafetyError(null);
    try {
      const response = await fetch(url, {
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
        setSafetyError(tx('Die KI-Analyse ist in dieser Version nicht verfügbar (kein Server). Nutze die Online-Version von SkyLog DE.', 'The AI analysis is not available in this version (no server). Use the online version of SkyLog DE.'));
      } else if (response.status === 503) {
        setSafetyError(tx('Die KI-Analyse ist auf diesem Server nicht eingerichtet (kein API-Schlüssel hinterlegt).', 'The AI analysis is not set up on this server (no API key).'));
      } else if (response.status === 429) {
        setSafetyError(tx('Zu viele KI-Analysen in kurzer Zeit. Bitte in einer Weile erneut versuchen.', 'Too many AI analyses in a short time. Please try again later.'));
      } else {
        setSafetyError(tx('Die KI-Analyse hat gerade nicht geklappt. Bitte später erneut versuchen.', 'The AI analysis did not work just now. Please try again later.'));
      }
    } catch (e) {
      console.error("Safety analysis failed:", e);
      setSafetyError(tx('Keine Verbindung zur KI. Prüfe deine Internetverbindung und versuche es erneut.', 'No connection to the AI. Check your internet connection and try again.'));
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
    } catch { /* Wetter optional */ }
    // Ortsname statt Koordinaten - die Koordinaten bleiben, wenn nichts kommt
    // oder der Nutzer schon selbst einen Namen eingetragen hat.
    const name = await ortsnameFuer(currentLocation[0], currentLocation[1]);
    if (name) setLocationName(alt => (/^-?\d+\.\d+, -?\d+\.\d+$/.test(alt) ? name : alt));
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
    // Bewusst nur beim Wechsel in den Setup-Schritt laden, nicht bei jeder
    // Positions- oder Profilaenderung (sonst NOTAM-/Wetter-Abrufe am laufenden Band).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (timerState === 'running') {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerState]);

  const startLeg = () => {
    setStartTime(Date.now());
    setTimerState('running');
    setElapsedTime(0);
  };

  /** Laufenden Abschnitt abschließen (falls einer läuft). */
  const laufenderAbschnitt = (): Abschnitt | null => {
    if (timerState !== 'running' || !startTime) return null;
    const endTime = Date.now();
    return { startTime, endTime, duration: Math.floor((endTime - startTime) / 1000) };
  };

  const stopLeg = () => {
    const abschnitt = laufenderAbschnitt();
    if (abschnitt) setLegs(prev => [...prev, abschnitt]);
    setTimerState('idle');
    setStartTime(null);
  };

  // „Flug abschließen“ beendet einen noch laufenden Abschnitt - vorher fehlte
  // er in Dauer und Bericht, wenn man direkt aus dem laufenden Flug abschloss.
  const flugAbschliessen = () => {
    stopLeg();
    setStep('summary');
  };

  const handleFinish = () => {
    const laufend = laufenderAbschnitt();
    const finalLegs = laufend ? [...legs, laufend] : legs;
    const totalMinutes = Math.max(1, Math.round(summeSekunden(finalLegs) / 60));

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
      locationName: locationName || tx('Unbekannter Ort', 'Unknown place'),
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

  // Schließen (X, Android-Zurück, Escape): Ist schon ein Flug aufgezeichnet,
  // erst nachfragen - vorher ging er ohne Warnung verloren.
  const schliessen = async () => {
    const hatFlug = timerState === 'running' || legs.length > 0;
    if (hatFlug && !await bestaetige(
      tx('Den Flug-Assistenten schließen? Der aufgezeichnete Flug wird nicht gespeichert.', 'Close the flight assistant? The recorded flight will not be saved.'),
      { titel: tx('Flug verwerfen?', 'Discard flight?'), gefaehrlich: true },
    )) return;
    onClose();
  };
  useEbene(true, () => { void schliessen(); });
  // Vollbild-Ebene: Fokus hinein und drin halten, damit Tab nicht in die
  // verdeckte Navigation springt.
  const ebene = useRef<HTMLDivElement>(null);
  const titelId = useId();
  useDialogFokus(ebene);

  const steps = [
    { id: 'setup', label: tx('Vorbereitung', 'Setup'), icon: Plane },
    { id: 'checklist', label: tx('Checkliste', 'Checklist'), icon: ClipboardCheck },
    { id: 'timer', label: tx('Flug', 'Flight'), icon: Timer },
    { id: 'summary', label: tx('Abschluss', 'Summary'), icon: History }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  return (
    <div ref={ebene} role="dialog" aria-modal="true" aria-labelledby={titelId} tabIndex={-1} onKeyDown={fokusFalle} className="fixed inset-0 z-[60] bg-slate-50 flex flex-col h-screen overflow-hidden focus:outline-none">
      {/* Assistant Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => void schliessen()} aria-label={tx('Assistent schließen', 'Close assistant')} className="w-10 h-10 -ml-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><XCircle className="w-6 h-6" /></button>
          <div className="text-center min-w-0">
            <h2 id={titelId} className="font-black text-slate-900 text-base">{tx('Flug-Assistent', 'Flight assistant')}</h2>
            <p className="text-xs font-bold text-brand-blue truncate">{locationName}</p>
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
                  isActive ? "bg-brand-blue/10 text-brand-blue" : "bg-slate-100 text-slate-400"
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={cn(
                  "text-2xs font-bold transition-colors",
                  isCurrent ? "text-slate-900" : "text-slate-500"
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
            <SchrittVorbereitung
              drones={drones}
              akkus={filteredBatteries}
              piloten={pilots}
              profile={profile}
              standort={currentLocation}
              drohneId={selectedDroneId} setDrohneId={setSelectedDroneId}
              akkuId={selectedBatteryId} setAkkuId={setSelectedBatteryId}
              zweck={purpose} setZweck={setPurpose}
              pilotId={selectedPilotId} setPilotId={setSelectedPilotId}
              akkuStart={batteryStart} setAkkuStart={setBatteryStart}
              ortName={locationName} setOrtName={setLocationName}
              ki={{ analyse: safetyAnalysis, laeuft: isAnalyzing, fehler: safetyError, starten: () => void runSafetyAnalysis() }}
              wetter={weatherData} setWetter={setWeatherData}
              sonnenuntergang={sunset}
              vorhersage={forecast}
              notams={{ liste: notams, laedt: notamLoading, fir: notamFir }}
              onWeiter={() => setStep('checklist')}
            />
          )}

          {step === 'checklist' && (
            <SchrittCheckliste analyse={safetyAnalysis} vorflug={vorflug} onStart={() => setStep('timer')} />
          )}

          {step === 'timer' && (
            <SchrittFlug
              laeuft={timerState === 'running'}
              sekunden={elapsedTime}
              abschnitte={legs}
              onStart={startLeg}
              onStop={stopLeg}
              onAbschliessen={flugAbschliessen}
            />
          )}

          {step === 'summary' && (
            <SchrittAbschluss
              abschnitte={legs}
              akkuStart={batteryStart}
              akkuEnde={batteryEnd} setAkkuEnde={setBatteryEnd}
              wetter={weatherData} setWetter={setWeatherData}
              vorkommnisse={incidents} setVorkommnisse={setIncidents}
              foto={incidentPhoto} setFoto={setIncidentPhoto}
              nachflug={nachflug}
              onSpeichern={handleFinish}
            />
          )}
        </div>
      </div>
    </div>
  );
}
