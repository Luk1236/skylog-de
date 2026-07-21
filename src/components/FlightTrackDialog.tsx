import { useState, useMemo, type ChangeEvent } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { X, Upload, Route, Mountain, Gauge, BatteryMedium, AlertTriangle } from 'lucide-react';
import L from 'leaflet';
import { cn } from '../lib/utils';
import { dbService, type Flight, type TrackPoint } from '../services/db';
import { parseTrackCsv, berechneTrackStats } from '../services/flightTrack';

interface Props {
  flight: Flight;
  onClose: () => void;
  onUpdate: () => void;
}

const startIcon = L.divIcon({
  className: 'custom-div-icon',
  html: '<div style="background:#059669;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>',
  iconSize: [14, 14], iconAnchor: [7, 7],
});
const endIcon = L.divIcon({
  className: 'custom-div-icon',
  html: '<div style="background:#b91c1c;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>',
  iconSize: [14, 14], iconAnchor: [7, 7],
});

// Passt die Karte an die Ausdehnung des Tracks an.
function FitBounds({ punkte }: { punkte: [number, number][] }) {
  const map = useMap();
  useMemo(() => {
    if (punkte.length > 0) map.fitBounds(L.latLngBounds(punkte), { padding: [24, 24] });
  }, [punkte, map]);
  return null;
}

// Bei sehr langen Tracks für die Diagramme ausdünnen — sonst wird recharts träge.
function ausduennen<T>(arr: T[], max = 400): T[] {
  if (arr.length <= max) return arr;
  const schritt = Math.ceil(arr.length / max);
  return arr.filter((_, i) => i % schritt === 0);
}

function Stat({ icon: Icon, label, wert }: { icon: any, label: string, wert: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col items-center gap-1">
      <Icon className="w-4 h-4 text-brand-blue" />
      <span className="text-sm font-black text-slate-900">{wert}</span>
      <span className="text-[9px] text-slate-400 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export function FlightTrackDialog({ flight, onClose, onUpdate }: Props) {
  const [track, setTrack] = useState<TrackPoint[]>(flight.track ?? []);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const stats = useMemo(() => berechneTrackStats(track), [track]);
  const linie = useMemo(() => track.map(p => [p.lat, p.lon] as [number, number]), [track]);
  const chartDaten = useMemo(
    () => ausduennen<TrackPoint>(track).map(p => ({ t: p.t, alt: p.alt, speed: p.speed, battery: p.battery })),
    [track]
  );
  const hatHoehe = track.some(p => typeof p.alt === 'number');
  const hatSpeed = track.some(p => typeof p.speed === 'number');
  const hatAkku = track.some(p => typeof p.battery === 'number');

  const importieren = async (e: ChangeEvent<HTMLInputElement>) => {
    const datei = e.target.files?.[0];
    e.target.value = '';
    if (!datei) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const { track: neu, fehler: f } = parseTrackCsv(await datei.text());
      if (neu.length === 0) { setFehler(f[0] ?? 'Keine Punkte gefunden.'); return; }
      await dbService.saveFlight({ ...flight, track: neu });
      setTrack(neu);
      onUpdate();
    } catch {
      setFehler('Datei konnte nicht gelesen werden.');
    } finally {
      setLaeuft(false);
    }
  };

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0 bg-white sm:rounded-t-3xl">
          <div className="flex items-center gap-2">
            <Route className="w-5 h-5 text-brand-blue" />
            <h3 className="font-black text-slate-900">Flug-Track</h3>
          </div>
          <button onClick={onClose} aria-label="Schließen" className="p-2 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {track.length === 0 ? (
            <div className="text-center py-8">
              <Route className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-1 font-medium">Für diesen Flug ist noch kein Track gespeichert.</p>
              <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
                Detaillierte Telemetrie-CSV (z.B. Airdata-Export mit Zeit, Position,
                Höhe, Speed, Akku) laden — daraus werden Flugpfad und Diagramme erzeugt.
              </p>
              <label className={cn('inline-flex items-center gap-2 bg-brand-blue text-white font-bold py-3 px-5 rounded-xl text-sm cursor-pointer active:scale-95 transition-all', laeuft && 'opacity-60')}>
                <Upload className="w-4 h-4" /> {laeuft ? 'Lese…' : 'Track-CSV laden'}
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={importieren} disabled={laeuft} />
              </label>
              {fehler && (
                <p className="mt-4 text-[11px] text-brand-red flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {fehler}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                <Stat icon={Mountain} label="Max. Höhe" wert={stats.maxHoeheM !== null ? `${Math.round(stats.maxHoeheM)} m` : '—'} />
                <Stat icon={Gauge} label="Max. Speed" wert={stats.maxSpeedKmh !== null ? `${Math.round(stats.maxSpeedKmh)} km/h` : '—'} />
                <Stat icon={Route} label="Max. Dist." wert={`${stats.maxDistanzM} m`} />
                <Stat icon={BatteryMedium} label="Dauer" wert={mmss(stats.dauerS)} />
              </div>

              <div className="h-56 rounded-2xl overflow-hidden border border-slate-200">
                <MapContainer center={linie[0]} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Polyline positions={linie} pathOptions={{ color: '#1e3a8a', weight: 3 }} />
                  <Marker position={linie[0]} icon={startIcon} />
                  <Marker position={linie[linie.length - 1]} icon={endIcon} />
                  <FitBounds punkte={linie} />
                </MapContainer>
              </div>

              {hatHoehe && <Diagramm titel="Höhe (m)" farbe="#1e3a8a" daten={chartDaten} feld="alt" />}
              {hatSpeed && <Diagramm titel="Geschwindigkeit (km/h)" farbe="#059669" daten={chartDaten} feld="speed" />}
              {hatAkku && <Diagramm titel="Akku (%)" farbe="#b91c1c" daten={chartDaten} feld="battery" />}

              <p className="text-[10px] text-slate-400 text-center">{stats.punkte} Messpunkte</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Diagramm({ titel, farbe, daten, feld }: { titel: string, farbe: string, daten: any[], feld: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{titel}</p>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={daten} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <XAxis dataKey="t" tick={{ fontSize: 9 }} tickFormatter={(s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`} />
            <YAxis tick={{ fontSize: 9 }} width={40} />
            <Tooltip labelFormatter={(s) => `${Math.floor(Number(s) / 60)}:${String(Math.round(Number(s) % 60)).padStart(2, '0')} min`} />
            <Line type="monotone" dataKey={feld} stroke={farbe} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
