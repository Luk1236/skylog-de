import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Polygon, Marker, Rectangle, useMapEvents } from 'react-leaflet';
import { Route, Trash2, ChevronUp, ChevronDown, Save, FolderOpen, AlertTriangle, MapPin, Download, Grid3x3 } from 'lucide-react';
import L from 'leaflet';
import { cn } from '../lib/utils';
import { GRUNDKARTE_KLASSE, OSM_KACHELN, OSM_NAMENSNENNUNG } from '../lib/kacheln';
import { dbService, type FlightPlan, type Wegpunkt, type WegpunktAktion, type LocationFavorite } from '../services/db';
import {
  bewertePlan, formatStrecke, formatZeit,
  wegpunktHinzufuegen, wegpunktEntfernen, wegpunktVerschieben,
  STANDARD_SPEED_KMH,
} from '../services/flightPlan';
import { erzeugeVieleckRaster, bahnabstandAusKamera } from '../services/gridPlan';
import { alsGpx, alsKml, alsLitchiCsv, dateiname } from '../services/flightPlanExport';
import { bestaetige } from '../services/dialog';
import { useSprache } from '../lib/sprache';
import { Dialog, Knopf, Abschnitt, eingabe } from './ui';

interface Props {
  startLat: number;
  startLon: number;
  locationFavorites?: LocationFavorite[];
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

/** Kleiner grüner Punkt für die beiden Flächen-Ecken. */
function eckIcon() {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background:#059669;width:14px;height:14px;border-radius:50%;border:2px solid white;
      box-shadow:0 0 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  });
}

/** Fängt Klicks auf die Karte ab und meldet die Koordinate. */
function KlickFaenger({ onKlick }: { onKlick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onKlick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export function FlightPlannerDialog({ startLat, startLon, locationFavorites = [], onClose }: Props) {
  const { t, tx } = useSprache();
  const [wegpunkte, setWegpunkte] = useState<Wegpunkt[]>([]);
  const [name, setName] = useState('');
  const [plaene, setPlaene] = useState<FlightPlan[]>([]);
  const [zeigePlaene, setZeigePlaene] = useState(false);

  // Flächen-Modus: zwei Ecken tippen, daraus eine Mäander-Route erzeugen.
  const [modus, setModus] = useState<'route' | 'flaeche'>('route');
  const [ecken, setEcken] = useState<Wegpunkt[]>([]);
  const [bahnabstand, setBahnabstand] = useState(30);
  const [richtungGrad, setRichtungGrad] = useState(90);
  const [hoehe, setHoehe] = useState(60);
  const [ausKamera, setAusKamera] = useState(false);
  const [bildwinkel, setBildwinkel] = useState(70);
  const [ueberlappung, setUeberlappung] = useState(70);
  const effektiverAbstand = ausKamera ? bahnabstandAusKamera(hoehe, bildwinkel, ueberlappung) : bahnabstand;
  const [rasterBegrenzt, setRasterBegrenzt] = useState(false);

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

  /** Aktuelle Route als GPX oder KML herunterladen.
   *  Nutzt den eingegebenen Namen, fällt sonst auf "Flugplan" zurück —
   *  Exportieren soll nicht am fehlenden Namen scheitern. */
  const exportieren = (endung: 'gpx' | 'kml' | 'csv') => {
    const plan: FlightPlan = {
      id: 'export',
      name: name.trim() || 'Flugplan',
      wegpunkte,
      createdAt: Date.now(),
    };
    const inhalt = endung === 'gpx' ? alsGpx(plan) : endung === 'kml' ? alsKml(plan) : alsLitchiCsv(plan);
    const typ = endung === 'gpx'
      ? 'application/gpx+xml'
      : endung === 'kml'
        ? 'application/vnd.google-earth.kml+xml'
        : 'text/csv';
    const url = URL.createObjectURL(new Blob([inhalt], { type: typ }));
    const a = document.createElement('a');
    a.href = url;
    a.download = dateiname(plan, endung);
    a.click();
    URL.revokeObjectURL(url);
  };

  /** Einen Wegpunkt teilweise aktualisieren (Höhe/Tempo/Aktion). */
  const aktualisiereWegpunkt = (i: number, patch: Partial<Wegpunkt>) => {
    setWegpunkte(w => w.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  const laden = (plan: FlightPlan) => {
    setWegpunkte(plan.wegpunkte);
    setZeigePlaene(false);
  };

  const loeschen = async (id: string) => {
    if (!await bestaetige(t('planer.loeschenFrage'), { gefaehrlich: true })) return;
    await dbService.deleteFlightPlan(id);
    setPlaene(await dbService.getFlightPlans());
  };

  /** Ein Kartentipp: im Route-Modus ein Wegpunkt, im Flächen-Modus die
   *  nächste Ecke der Fläche (2 = Rechteck, ab 3 = Vieleck, max. 30). */
  const kartenTipp = (lat: number, lon: number) => {
    if (modus === 'route') {
      setWegpunkte(w => wegpunktHinzufuegen(w, { lat, lon }));
    } else {
      setEcken(e => (e.length >= 30 ? e : [...e, { lat, lon }]));
      setRasterBegrenzt(false);
    }
  };

  /** Aus den Ecken die Mäander-Route bauen und in die Wegpunkte übernehmen.
   *  Danach in den Route-Modus, damit man sie prüfen, speichern und
   *  exportieren kann. */
  const rasterErzeugen = () => {
    if (ecken.length < 2) return;
    const r = erzeugeVieleckRaster(ecken, { bahnabstandM: effektiverAbstand, richtungGrad, hoeheM: hoehe });
    setWegpunkte(r.wegpunkte);
    setRasterBegrenzt(r.begrenzt);
    setEcken([]);
    setModus('route');
  };

  const kleinesFeld =
    'flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 ' +
    'focus-within:ring-2 focus-within:ring-brand-blue/30 focus-within:border-brand-blue';

  return (
    <Dialog
      titel={t('planer.titel')}
      icon={Route}
      breite="xxl"
      onClose={onClose}
      schliesstBeiKlickDaneben={false}
      kopfAktionen={
        <button onClick={() => setZeigePlaene(o => !o)} aria-label={t('a11y.gespeichertePlaene')}
          className={cn('p-2 rounded-xl shrink-0', zeigePlaene ? 'bg-brand-blue/10 text-brand-blue' : 'text-slate-500 hover:bg-slate-100')}>
          <FolderOpen className="w-5 h-5" />
        </button>
      }
      fuss={!zeigePlaene ? (
        <>
          <input
            className={cn(eingabe, 'flex-1 min-w-0')}
            placeholder={t('planer.benennen')}
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <Knopf icon={Save} onClick={speichern} disabled={!name.trim() || wegpunkte.length < 2} className="shrink-0">
            {t('aktion.speichern')}
          </Knopf>
        </>
      ) : undefined}
    >
      {zeigePlaene ? (
        <div className="space-y-2">
          <Abschnitt titel={t('planer.gespeicherte')} />
          {plaene.length === 0 && (
            <p className="text-xs text-slate-500 py-4 text-center">{t('planer.keinePlaene')}</p>
          )}
          {plaene.map(p => (
            <div key={p.id} className="flex items-center gap-2 bg-white rounded-2xl border border-slate-200 p-3">
              <button onClick={() => laden(p)} className="flex-1 text-left">
                <p className="text-sm font-bold text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-500">
                  {p.wegpunkte.length} {t('planer.wegpunkte')} · {formatStrecke(bewertePlan(p.wegpunkte).streckeM)}
                </p>
              </button>
              <button onClick={() => loeschen(p.id)} aria-label={t('a11y.planLoeschen')}
                className="p-2.5 rounded-xl text-slate-400 hover:text-brand-red hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        // Am Laptop zweispaltig: Karte links, Einstellungen und Wegpunkte rechts
        <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
          <div className="space-y-4">
            {locationFavorites && locationFavorites.length > 0 && (
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-blue pointer-events-none" />
                <select
                  aria-label={tx('Startpunkt aus Favoriten wählen', 'Choose take-off point from favourites')}
                  className={cn(eingabe, 'pl-9 font-bold cursor-pointer')}
                  onChange={e => {
                    const fav = locationFavorites.find(f => f.id === e.target.value);
                    if (fav) {
                      setWegpunkte(w => wegpunktHinzufuegen(w, { lat: fav.coordinates[0], lon: fav.coordinates[1] }));
                      setName(fav.name);
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>{tx('★ Startpunkt aus Favoriten wählen...', '★ Choose take-off point from favourites…')}</option>
                  {locationFavorites.map(fav => (
                    <option key={fav.id} value={fav.id}>
                      {fav.name} ({fav.locationName})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Modus: Route von Hand vs. Fläche kartieren */}
            <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-xl p-1">
              <button onClick={() => setModus('route')}
                className={cn('flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors',
                  modus === 'route' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-600')}>
                <Route className="w-3.5 h-3.5" /> {t('planer.modusRoute')}
              </button>
              <button onClick={() => setModus('flaeche')}
                className={cn('flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors',
                  modus === 'flaeche' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-600')}>
                <Grid3x3 className="w-3.5 h-3.5" /> {t('planer.modusFlaeche')}
              </button>
            </div>

            <p className="text-xs text-slate-500">
              {modus === 'route' ? t('planer.hinweisKarte') : t('planer.hinweisFlaeche')}
            </p>

            {/* isolate: Leaflets eigene z-Werte bleiben innerhalb des Kartenrahmens */}
            <div className="h-56 lg:h-[26rem] rounded-2xl overflow-hidden border border-slate-200 isolate">
              <MapContainer center={[startLat, startLon]} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                <TileLayer url={OSM_KACHELN} attribution={OSM_NAMENSNENNUNG} className={GRUNDKARTE_KLASSE} />
                <KlickFaenger onKlick={kartenTipp} />
                {linie.length > 1 && <Polyline positions={linie} pathOptions={{ color: '#1e3a8a', weight: 3, dashArray: '6 4' }} />}
                {wegpunkte.map((w, i) => (
                  <Marker key={i} position={[w.lat, w.lon]} icon={punktIcon(i + 1, i === wegpunkte.length - 1 && wegpunkte.length > 1)} />
                ))}
                {modus === 'flaeche' && ecken.map((e, i) => (
                  <Marker key={`ecke-${i}`} position={[e.lat, e.lon]} icon={eckIcon()} />
                ))}
                {modus === 'flaeche' && ecken.length === 2 && (
                  <Rectangle bounds={[[ecken[0].lat, ecken[0].lon], [ecken[1].lat, ecken[1].lon]]}
                    pathOptions={{ color: '#059669', weight: 2, fillOpacity: 0.08 }} />
                )}
                {modus === 'flaeche' && ecken.length >= 3 && (
                  <Polygon positions={ecken.map(e => [e.lat, e.lon] as [number, number])}
                    pathOptions={{ color: '#059669', weight: 2, fillOpacity: 0.08 }} />
                )}
              </MapContainer>
            </div>
          </div>

          <div className="space-y-4">
            {modus === 'flaeche' && (
              <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
                <Regler label={t('planer.hoehe')} wert={hoehe} einheit="m" min={10} max={120} schritt={5} onChange={setHoehe} />
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <input type="checkbox" className="w-4 h-4 accent-brand-blue" checked={ausKamera} onChange={e => setAusKamera(e.target.checked)} />
                  {t('planer.ausKamera')}
                </label>
                {ausKamera ? (
                  <>
                    <Regler label={t('planer.bildwinkel')} wert={bildwinkel} einheit="°" min={30} max={120} schritt={1} onChange={setBildwinkel} />
                    <Regler label={t('planer.ueberlappung')} wert={ueberlappung} einheit="%" min={0} max={90} schritt={5} onChange={setUeberlappung} />
                    <p className="text-xs text-slate-600 text-right">{t('planer.bahnabstand')}: <span className="font-mono font-bold text-slate-900">{effektiverAbstand} m</span></p>
                  </>
                ) : (
                  <Regler label={t('planer.bahnabstand')} wert={bahnabstand} einheit="m" min={5} max={100} schritt={5} onChange={setBahnabstand} />
                )}
                <Regler label={t('planer.flugrichtung')} wert={richtungGrad} einheit="°" min={0} max={175} schritt={5} onChange={setRichtungGrad} />
                <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-xl p-1">
                  <button onClick={() => setRichtungGrad(90)}
                    className={cn('py-2 rounded-lg text-xs font-bold transition-colors',
                      richtungGrad === 90 ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-600')}>
                    {t('planer.richtungOstWest')}
                  </button>
                  <button onClick={() => setRichtungGrad(0)}
                    className={cn('py-2 rounded-lg text-xs font-bold transition-colors',
                      richtungGrad === 0 ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-600')}>
                    {t('planer.richtungNordSued')}
                  </button>
                </div>
                <Knopf voll icon={Grid3x3} onClick={rasterErzeugen} disabled={ecken.length < 2}>
                  {t('planer.rasterErzeugen')}
                </Knopf>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{ecken.length} {t('planer.eckenGesetzt')}</span>
                  <span className="flex gap-1">
                    <button onClick={() => setEcken(e => e.slice(0, -1))} disabled={ecken.length === 0}
                      className="px-2 py-1.5 rounded-xl font-bold hover:bg-slate-100 disabled:opacity-40">{t('planer.eckeZurueck')}</button>
                    <button onClick={() => setEcken([])} disabled={ecken.length === 0}
                      className="px-2 py-1.5 rounded-xl font-bold text-brand-red hover:bg-red-50 disabled:opacity-40">{t('planer.eckenLoeschen')}</button>
                  </span>
                </div>
              </div>
            )}

            {rasterBegrenzt && (
              <p className="text-xs text-amber-800 flex items-start gap-1.5 leading-relaxed">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {t('planer.rasterBegrenzt')}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Kachel label={t('planer.strecke')} wert={formatStrecke(bewertung.streckeM)} />
              <Kachel label={t('planer.flugzeit')} wert={formatZeit(bewertung.flugzeitS)} />
              <Kachel label={t('planer.maxEntfernung')} wert={formatStrecke(bewertung.maxEntfernungM)} />
            </div>

            {bewertung.hinweise.length > 0 && (
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3 space-y-1">
                {bewertung.hinweise.map((h, i) => (
                  <p key={i} className="text-xs text-amber-800 flex items-start gap-1.5 leading-relaxed">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {h}
                  </p>
                ))}
              </div>
            )}

            {wegpunkte.length > 0 && (
              <div className="space-y-1.5">
                <Abschnitt
                  titel={t('planer.wegpunkte')}
                  className="mb-0"
                  aktion={
                    <button onClick={() => setWegpunkte([])} className="text-2xs font-bold text-slate-500 hover:text-brand-red">
                      {t('planer.alleLoeschen')}
                    </button>
                  }
                />
                {wegpunkte.map((w, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200 px-3 py-2 space-y-2">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-brand-blue shrink-0" />
                      <span className="text-xs font-mono text-slate-600 flex-1 ml-1">
                        {i + 1}. {w.lat.toFixed(5)}, {w.lon.toFixed(5)}
                      </span>
                      <button onClick={() => setWegpunkte(v => wegpunktVerschieben(v, i, -1))} disabled={i === 0}
                        aria-label={t('a11y.nachOben')} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => setWegpunkte(v => wegpunktVerschieben(v, i, 1))} disabled={i === wegpunkte.length - 1}
                        aria-label={t('a11y.nachUnten')} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button onClick={() => setWegpunkte(v => wegpunktEntfernen(v, i))}
                        aria-label={t('a11y.wegpunktEntfernen')} className="p-1.5 rounded-xl text-slate-400 hover:text-brand-red hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Missions-Parameter je Wegpunkt */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <label className={kleinesFeld}>
                        <span className="text-2xs font-bold text-slate-500">H</span>
                        <input type="number" inputMode="numeric" placeholder="m" aria-label={`Höhe Wegpunkt ${i + 1}`}
                          value={w.alt ?? ''} onChange={e => aktualisiereWegpunkt(i, { alt: e.target.value ? Number(e.target.value) : undefined })}
                          className="w-full min-w-0 bg-transparent text-xs font-mono text-slate-900 focus:outline-none" />
                      </label>
                      <label className={kleinesFeld}>
                        <span className="text-2xs font-bold text-slate-500">km/h</span>
                        <input type="number" inputMode="numeric" placeholder={tx('Tempo', 'Speed')} aria-label={tx(`Tempo Wegpunkt ${i + 1}`, `Speed waypoint ${i + 1}`)}
                          value={w.speed ?? ''} onChange={e => aktualisiereWegpunkt(i, { speed: e.target.value ? Number(e.target.value) : undefined })}
                          className="w-full min-w-0 bg-transparent text-xs font-mono text-slate-900 focus:outline-none" />
                      </label>
                      <select aria-label={tx(`Aktion Wegpunkt ${i + 1}`, `Action waypoint ${i + 1}`)}
                        value={w.aktion ?? ''} onChange={e => aktualisiereWegpunkt(i, { aktion: (e.target.value || undefined) as WegpunktAktion | undefined })}
                        className={cn(eingabe, 'px-2 py-1.5 text-xs font-bold text-slate-700')}>
                        <option value="">—</option>
                        <option value="foto">{tx('Foto', 'Photo')}</option>
                        <option value="video-start">{tx('Video an', 'Video on')}</option>
                        <option value="video-stop">{tx('Video aus', 'Video off')}</option>
                        <option value="hover">{tx('Schweben', 'Hover')}</option>
                      </select>
                    </div>
                    {w.aktion === 'hover' && (
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        {tx('Schwebedauer', 'Hover time')}
                        <input type="number" inputMode="numeric" value={w.hoverSek ?? ''} placeholder={tx('Sek.', 'sec')}
                          onChange={e => aktualisiereWegpunkt(i, { hoverSek: e.target.value ? Number(e.target.value) : undefined })}
                          className={cn(eingabe, 'w-20 px-2 py-1 text-xs font-mono')} />
                        {tx('Sek.', 'sec')}
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )}

            {wegpunkte.length >= 2 && (
              <div className="space-y-2">
                <Abschnitt titel={t('planer.exportieren')} className="mb-0" />
                {/* Fliegbare Mission: Litchi kann diese Datei importieren und abfliegen. */}
                <Knopf voll icon={Download} onClick={() => exportieren('csv')}>
                  {tx('Mission für Litchi (fliegbar)', 'Mission for Litchi (flyable)')}
                </Knopf>
                <div className="grid grid-cols-2 gap-2">
                  <Knopf variante="sekundaer" icon={Download} onClick={() => exportieren('gpx')}>
                    GPX
                  </Knopf>
                  <Knopf variante="sekundaer" icon={Download} onClick={() => exportieren('kml')}>
                    KML
                  </Knopf>
                </div>
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2 flex items-start gap-1.5 leading-relaxed">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{tx('Litchi-Datei in Litchi importieren,', 'Import the Litchi file into Litchi,')} <b>{tx('vor dem Start prüfen', 'check before take-off')}</b> {tx('(Höhen, Hindernisse, Luftraum) und nur in Sichtweite fliegen. SkyLog plant nur — es steuert die Drohne nicht.', '(altitudes, obstacles, airspace) and only fly within line of sight. SkyLog only plans — it does not control the drone.')}</span>
                </p>
              </div>
            )}

            <p className="text-2xs text-slate-500 leading-relaxed">
              {t('planer.fussnote')}
            </p>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Kachel({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
      <p className="text-sm font-black text-slate-900">{wert}</p>
      <p className="text-xs font-bold text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function Regler({ label, wert, einheit, min, max, schritt, onChange }: {
  label: string; wert: number; einheit: string; min: number; max: number; schritt: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs font-bold text-slate-600 shrink-0">{label}</label>
      <div className="flex items-center gap-2 flex-1 justify-end">
        <input type="range" min={min} max={max} step={schritt} value={wert} aria-label={label}
          onChange={e => onChange(Number(e.target.value))} className="flex-1 max-w-36 accent-brand-blue" />
        <span className="text-xs font-mono font-bold text-slate-900 w-12 text-right">{wert} {einheit}</span>
      </div>
    </div>
  );
}
