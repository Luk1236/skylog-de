import { useState, useEffect, lazy, Suspense } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Info, Navigation, ShieldCheck, Wind, Thermometer, CloudRain, Route, DownloadCloud, Globe2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import L from 'leaflet';

import { cn } from '../lib/utils';
import { GRUNDKARTE_KLASSE, HOT_KACHELN, HOT_NAMENSNENNUNG } from '../lib/kacheln';
import { useSprache } from '../lib/sprache';
import { dbService, type Flight, type LocationFavorite, type GespeicherteKarte } from '../services/db';
import { wetterText, type WeatherData } from '../services/weather';
import { pruefeOfflineKarte, OFFLINE_KARTE_URL } from '../services/offlineBasemap';
import { EuZoneLayer } from './EuZoneLayer';
import { zonenInUmkreis, parseEd269, type Ed269Zone } from '../services/ed269';
import { laenderFuerKoordinate, quelleFuer, istErfundeneErsatzzone } from '../services/euZones';
import { regionenFuerStandort } from '../services/mapRegions';
import { karteFuerStandort } from '../services/mapDownload';
import { OfflineMapsDialog, EuZonesDialog, PreFlightSafetyDialog } from './lazyDialogs';

// Offline-Grundkarte erst laden, wenn eine da ist: protomaps-leaflet und
// pmtiles (~35 kB gzip) gehören nicht in den Erststart.
const OfflineBasemap = lazy(() => import('./OfflineBasemap').then(m => ({ default: m.OfflineBasemap })));

// Die Startkarte: Grundkarte (online oder offline), DIPUL-Geozonen, importierte
// EU-Zonen, eigene Flüge und Lieblingsorte. Aus App.tsx herausgelöst.

/** Marker mit großer, unsichtbarer Tippfläche um ein kleines Symbol: WCAG 2.2
 *  verlangt mindestens 24 × 24 px (Software-Check R3-12), am Handy sind 44 px
 *  angenehm. Bei vielen Flügen am selben Ort bleibt die Fläche kleiner, damit
 *  sich die Marker nicht gegenseitig verdecken. */
const markerMitFlaeche = (symbol: string, flaeche: number) => L.divIcon({
  html: `<div style="width:${flaeche}px;height:${flaeche}px;display:flex;align-items:center;justify-content:center">${symbol}</div>`,
  className: 'custom-div-icon',
  iconSize: [flaeche, flaeche],
  iconAnchor: [flaeche / 2, flaeche / 2],
});

// Eigener Standort
const droneIcon = markerMitFlaeche(
  `<div class="bg-brand-blue w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
     <div class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
   </div>`, 44);

const flightHistoryIcon = markerMitFlaeche(
  `<div style="background:#10b981;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`, 28);

const favoriteLocationIcon = markerMitFlaeche(
  `<div style="background:#f59e0b;width:18px;height:18px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;">★</div>`, 44);

export function DroneMap({ location, onLocate, isLocating, weather, flights, locationFavorites = [], onPlaner }: { location: [number, number], onLocate: () => void, isLocating: boolean, weather: WeatherData | null, flights: Flight[], locationFavorites?: LocationFavorite[], onPlaner: () => void }) {
  const { t, tx, sprache } = useSprache();
  const [infoPoint, setInfoPoint] = useState<[number, number] | null>(null);
  // Grundkarte waehlen. Reihenfolge: heruntergeladene Region (beste, weil
  // offline und vom Nutzer bewusst geholt) > mitgelieferte Datei > online.
  const [offlineKarte, setOfflineKarte] = useState(false);
  const [geladeneKarte, setGeladeneKarte] = useState<GespeicherteKarte | null>(null);
  const [zeigeKarten, setZeigeKarten] = useState(false);

  const pruefeKarten = async () => {
    const codes = regionenFuerStandort(location[0], location[1]).map(r => r.code);
    const karte = await karteFuerStandort(codes);
    setGeladeneKarte(karte);
  };

  // Importierte Zonen fremder Laender. Nur die im Umkreis werden gezeichnet —
  // ein ganzes Land waeren mehrere hundert Polygone.
  const [euZonen, setEuZonen] = useState<Ed269Zone[]>([]);
  const [zeigeEuZonen, setZeigeEuZonen] = useState(false);
  const [zeigePreFlightSafety, setZeigePreFlightSafety] = useState(false);

  const ladeEuZonen = async () => {
    // Frueher erfundene Ersatzzonen entfernen (blockieren sonst den echten Import).
    for (const e of await dbService.getEuZonen()) {
      if (istErfundeneErsatzzone(e)) await dbService.deleteEuZonen(e.land);
    }
    const laender = laenderFuerKoordinate(location[0], location[1]);
    for (const code of laender) {
      const quelle = quelleFuer(code);
      if (quelle?.direktUrl) {
        try {
          const vorhanden = await dbService.getEuZonen();
          if (!vorhanden.some(v => v.land === code)) {
            // Nativ direkt (CapacitorHttp, kein CORS); im Browser ueber den Proxy.
            const url = Capacitor.isNativePlatform() ? quelle.direktUrl : `/api/zonen/${code}`;
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
  // Bewusst nur bei Positionswechsel: pruefeKarten/ladeEuZonen sind pro Render neu
  // erzeugte Funktionen und wuerden sonst bei jedem Render erneut laden.
  const [lat, lon] = location;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { pruefeKarten(); }, [lat, lon]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { ladeEuZonen(); }, [lat, lon]);

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
    }, [map, center]);
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
        {geladeneKarte || offlineKarte
          ? (
            <Suspense fallback={null}>
              <OfflineBasemap quelle={geladeneKarte ?? OFFLINE_KARTE_URL} />
            </Suspense>
          )
          : (
              <TileLayer attribution={HOT_NAMENSNENNUNG} url={HOT_KACHELN} className={GRUNDKARTE_KLASSE} />
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

        <Marker position={location} icon={droneIcon} title={tx('Dein Standort', 'Your location')} alt={tx('Dein Standort', 'Your location')}>
          <Popup>{tx('Dein Standort', 'Your location')}</Popup>
        </Marker>

        {/* Past flight locations */}
        {flights.filter(f => f.coordinates).slice(0, 30).map(f => (
          <Marker key={f.id} position={f.coordinates} icon={flightHistoryIcon} title={`${tx('Flug', 'Flight')}: ${f.locationName || tx('Unbekannter Ort', 'Unknown place')}`} alt={f.locationName || tx('Flugort', 'Flight location')}>
            <Popup>
              <div className="p-1 text-xs min-w-[140px]">
                <p className="font-bold text-slate-800 mb-1">{f.locationName || tx('Unbekannter Ort', 'Unknown place')}</p>
                <p className="text-slate-500">{new Date(f.date).toLocaleDateString(sprache === 'en' ? 'en-GB' : 'de-DE')} · {f.duration} min</p>
                {f.pilotName && <p className="text-slate-500 text-xs mt-0.5">{f.pilotName}</p>}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Saved Favorite Locations */}
        {locationFavorites.map(fav => (
          <Marker key={fav.id} position={fav.coordinates} icon={favoriteLocationIcon} title={`${tx('Lieblingsort', 'Favourite')}: ${fav.name}`} alt={fav.name}>
            <Popup>
              <div className="p-1 text-xs min-w-[150px]">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-amber-500 font-bold">★</span>
                  <p className="font-bold text-slate-900">{fav.name}</p>
                </div>
                <p className="text-slate-500 font-medium">{fav.locationName}</p>
                {fav.notes && <p className="text-slate-500 italic text-xs mt-1">{fav.notes}</p>}
              </div>
            </Popup>
          </Marker>
        ))}

        <MapEvents />
        <Recenter center={location} />

        {infoPoint && (
          <Popup position={infoPoint} eventHandlers={{ remove: () => setInfoPoint(null) }}>
            <div className="p-1 min-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-brand-blue" />
                <h3 className="font-bold text-sm">{tx('Zonen an diesem Punkt', 'Zones at this point')}</h3>
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <p>{tx('Genaue Verbote für', 'Exact restrictions for')} {infoPoint[0].toFixed(4)}, {infoPoint[1].toFixed(4)} {tx('zeigt die amtliche Karte auf', 'are shown on the official map at')} <a className="font-semibold text-brand-blue" href="https://maptool-dipul.dfs.de/" target="_blank" rel="noopener noreferrer">dipul</a>.</p>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-red" />
                    <span className="font-medium">{tx('Flugbeschränkung möglich', 'Flight restriction possible')}</span>
                  </div>
                </div>
              </div>
            </div>
          </Popup>
        )}
      </MapContainer>

      {/* Map UI Overlays */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
        <button 
          onClick={onLocate}
          aria-label={tx('Auf meinen Standort zentrieren', 'Centre on my location')}
          title={tx('Auf meinen Standort zentrieren', 'Centre on my location')}
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
          title={t('a11y.planer')}
          className="bg-white p-3 rounded-2xl shadow-lg border border-slate-200 transition-all active:scale-95 flex items-center justify-center"
        >
          <Route className="w-6 h-6 text-brand-blue" />
        </button>

        {/* Offline-Karten verwalten. Gruen, sobald fuer den Standort eine
            Karte auf dem Geraet liegt — das ist die Information, die vor dem
            Losfahren ins Funkloch zaehlt. */}
        <button
          onClick={() => setZeigeKarten(true)}
          aria-label={tx('Offline-Karten verwalten', 'Manage offline maps')}
          title={tx('Offline-Karten verwalten', 'Manage offline maps')}
          className="bg-white p-3 rounded-2xl shadow-lg border border-slate-200 transition-all active:scale-95 flex items-center justify-center"
        >
          <DownloadCloud className={cn('w-6 h-6', geladeneKarte ? 'text-brand-green' : 'text-slate-400')} />
        </button>

        {/* Zonen fremder Laender. Gruen, sobald welche importiert sind. */}
        <button
          onClick={() => setZeigeEuZonen(true)}
          aria-label={tx('Zonen anderer Länder', 'Zones of other countries')}
          title={tx('Zonen anderer Länder', 'Zones of other countries')}
          className="bg-white p-3 rounded-2xl shadow-lg border border-slate-200 transition-all active:scale-95 flex items-center justify-center"
        >
          <Globe2 className={cn('w-6 h-6', euZonen.length > 0 ? 'text-brand-green' : 'text-slate-400')} />
        </button>

        {weather && (
          <div className="bg-white p-3 rounded-2xl shadow-lg border border-slate-200 flex flex-col gap-4 items-center">
            <div className="flex flex-col items-center gap-1">
              <Wind className={cn("w-5 h-5", weather.windSpeed > 15 ? "text-brand-red" : "text-brand-green")} />
              <span className="text-2xs font-bold text-slate-600">{weather.windSpeed} km/h</span>
            </div>
            <div className="flex flex-col items-center gap-1 border-t border-slate-100 pt-3">
              <Thermometer className="w-5 h-5 text-slate-400" />
              <span className="text-2xs font-bold text-slate-600">{weather.temp}°C</span>
            </div>
            <div className="flex flex-col items-center gap-1 border-t border-slate-100 pt-3">
              <CloudRain className="w-5 h-5 text-blue-400" />
              <span className="text-2xs font-bold text-slate-500 leading-tight text-center">{wetterText(weather.condition, sprache)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 left-4 right-4 z-20">
        <button 
          onClick={() => setZeigePreFlightSafety(true)}
          className="w-full bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-white/50 flex items-center justify-between hover:bg-white active:scale-[0.98] transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-brand-green" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                {tx('Vorflug-Sicherheitsanalyse & Kp-Index', 'Pre-flight safety analysis & Kp index')}
              </p>
              <p className="text-xs text-slate-500">{tx('Wetter, Wind und Kp-Index als Sicherheitswert 0–100 %', 'Weather, wind and Kp index as a 0–100 % safety score')}</p>
            </div>
          </div>
          <span className="bg-brand-green text-white px-3 py-1.5 rounded-xl text-xs font-bold shrink-0">
            {tx('Prüfen', 'Check')}
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

