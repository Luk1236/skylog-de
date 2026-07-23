import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMapEvents } from 'react-leaflet';
import { X, Route, Trash2, ChevronUp, ChevronDown, Save, FolderOpen, AlertTriangle, MapPin } from 'lucide-react';
import L from 'leaflet';
import { cn } from '../lib/utils';
import { dbService, type FlightPlan, type Wegpunkt } from '../services/db';
import {
  bewertePlan, formatStrecke, formatZeit,
  wegpunktHinzufuegen, wegpunktEntfernen, wegpunktVerschieben,
  STANDARD_SPEED_KMH,
} from '../services/flightPlan';

interface Props {
  startLat: number;
  startLon: number;
  onClose: () => void;
}

function punktIcon(nummer: number, letzter: boolean) {
  const farbe = nummer === 1 ? '#059669' : letzter ? '#b91c1c' : '#1e3a8a';
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background:${farbe};color:#fff;width:20px;height:20px;border-radius:50%;border:2px solid white;
      display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;
      box-shadow:0 0 4px rgba(0,0,0,.4)">${nummer}</div>`,
    iconSize: [20, 20], iconAnchor: [10, 10],
  });
}

/** Fängt Klicks auf die Karte ab und meldet die Koordinate. */
function KlickFaenger({ onKlick }: { onKlick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onKlick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export function FlightPlannerDialog({ startLat, startLon, onClose }: Props) {
  const [wegpunkte, setWegpunkte] = useState<Wegpunkt[]>([]);
  const [name, setName] = useState('');
  const [plaene, setPlaene] = useState<FlightPlan[]>([]);
  const [zeigePlaene, setZeigePlaene] = useState(false);

  useEffect(() => { dbService.getFlightPlans().then(setPlaene); }, []);

  const bewertung = useMemo(() => bewertePlan(wegpunkte, STANDARD_SPEED_KMH), [wegpunkte]);
  const linie = wegpunkte.map(w => [w.lat, w.lon] as [number, number]);

  const speichern = async () => {
    const sauber = name.trim();
    if (!sauber || wegpunkte.length < 2) return;
    const plan: FlightPlan = {
      id: crypto.randomUUID(),
      name: sauber,
      wegpunkte,
      createdAt: Date.now(),
    };
    await dbService.saveFlightPlan(plan);
    setPlaene(await dbService.getFlightPlans());
    setName('');
  };

  const laden = (plan: FlightPlan) => {
    setWegpunkte(plan.wegpunkte);
    setZeigePlaene(false);
  };

  const loeschen = async (id: string) => {
    if (!confirm('Diesen Flugplan löschen?')) return;
    await dbService.deleteFlightPlan(id);
    setPlaene(await dbService.getFlightPlans());
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0 bg-white sm:rounded-t-3xl">
          <div className="flex items-center gap-2">
            <Route className="w-5 h-5 text-brand-blue" />
            <h3 className="font-black text-slate-900">Flugplaner</h3>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setZeigePlaene(o => !o)} aria-label="Gespeicherte Pläne"
              className={cn('p-2 rounded-xl', zeigePlaene ? 'bg-brand-blue/10 text-brand-blue' : 'hover:bg-slate-100 text-slate-400')}>
              <FolderOpen className="w-5 h-5" />
            </button>
            <button onClick={onClose} aria-label="Schließen" className="p-2 rounded-xl hover:bg-slate-100">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {zeigePlaene ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gespeicherte Pläne</p>
              {plaene.length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">Noch keine Pläne gespeichert.</p>
              )}
              {plaene.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-3">
                  <button onClick={() => laden(p)} className="flex-1 text-left">
                    <p className="text-xs font-bold text-slate-900">{p.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {p.wegpunkte.length} Wegpunkte · {formatStrecke(bewertePlan(p.wegpunkte).streckeM)}
                    </p>
                  </button>
                  <button onClick={() => loeschen(p.id)} aria-label="Plan löschen"
                    className="p-1.5 text-slate-300 hover:text-brand-red">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="text-[11px] text-slate-500">
                Auf die Karte tippen, um Wegpunkte zu setzen.
              </p>

              <div className="h-56 rounded-2xl overflow-hidden border border-slate-200">
                <MapContainer center={[startLat, startLon]} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <KlickFaenger onKlick={(lat, lon) => setWegpunkte(w => wegpunktHinzufuegen(w, { lat, lon }))} />
                  {linie.length > 1 && <Polyline positions={linie} pathOptions={{ color: '#1e3a8a', weight: 3, dashArray: '6 4' }} />}
                  {wegpunkte.map((w, i) => (
                    <Marker key={i} position={[w.lat, w.lon]} icon={punktIcon(i + 1, i === wegpunkte.length - 1 && wegpunkte.length > 1)} />
                  ))}
                </MapContainer>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Kachel label="Strecke" wert={formatStrecke(bewertung.streckeM)} />
                <Kachel label="ca. Flugzeit" wert={formatZeit(bewertung.flugzeitS)} />
                <Kachel label="max. Entfernung" wert={formatStrecke(bewertung.maxEntfernungM)} />
              </div>

              {bewertung.hinweise.length > 0 && (
                <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3 space-y-1">
                  {bewertung.hinweise.map((h, i) => (
                    <p key={i} className="text-[11px] text-amber-700 flex items-start gap-1.5 leading-relaxed">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {h}
                    </p>
                  ))}
                </div>
              )}

              {wegpunkte.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wegpunkte</p>
                    <button onClick={() => setWegpunkte([])} className="text-[10px] font-bold text-slate-400 hover:text-brand-red">
                      Alle löschen
                    </button>
                  </div>
                  {wegpunkte.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2">
                      <MapPin className="w-3.5 h-3.5 text-brand-blue shrink-0" />
                      <span className="text-[11px] font-mono text-slate-600 flex-1">
                        {i + 1}. {w.lat.toFixed(5)}, {w.lon.toFixed(5)}
                      </span>
                      <button onClick={() => setWegpunkte(v => wegpunktVerschieben(v, i, -1))} disabled={i === 0}
                        aria-label="Nach oben" className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-30">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setWegpunkte(v => wegpunktVerschieben(v, i, 1))} disabled={i === wegpunkte.length - 1}
                        aria-label="Nach unten" className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-30">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setWegpunkte(v => wegpunktEntfernen(v, i))}
                        aria-label="Wegpunkt entfernen" className="p-1 text-slate-300 hover:text-brand-red">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[9px] text-slate-400 leading-relaxed">
                Planungshilfe. Die Route lässt sich nicht an die Drohne senden — dafür
                wären DJIs Waypoint-Format und das native SDK nötig.
              </p>
            </>
          )}
        </div>

        {!zeigePlaene && (
          <div className="px-5 py-4 border-t border-slate-100 shrink-0 bg-white sm:rounded-b-3xl flex gap-2">
            <input
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
              placeholder="Plan benennen…"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <button onClick={speichern} disabled={!name.trim() || wegpunkte.length < 2}
              className="bg-brand-blue text-white font-bold px-4 rounded-xl text-sm active:scale-95 disabled:opacity-40 flex items-center gap-1.5">
              <Save className="w-4 h-4" /> Speichern
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Kachel({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
      <p className="text-sm font-black text-slate-900">{wert}</p>
      <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
