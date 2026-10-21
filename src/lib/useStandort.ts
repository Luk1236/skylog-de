import { useEffect, useRef, useState } from 'react';
import { fetchWeather, type WeatherData } from '../services/weather';
import { distanzMeter } from '../services/geo';
import {
  ladeStandortFreigabe, speichereStandortFreigabe, standortSchonFreigegeben, type StandortFreigabe,
} from '../services/standortFreigabe';

const STANDARD_ORT: [number, number] = [52.52, 13.40];

/**
 * Standort, Freigabe und Wetter am Standort.
 *
 * Verfolgt wird nur, solange `gebraucht` (Karte oder Sicherheitsansicht im
 * Vordergrund) und der Nutzer nach der Erklärung zugestimmt hat. Vorher fragte
 * die App gleich beim Start, alle 10 s, in jeder Ansicht und auch im
 * Hintergrund (Akku).
 */
export function useStandort(gebraucht: boolean) {
  const [location, setLocation] = useState<[number, number]>(STANDARD_ORT);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsFehler, setGpsFehler] = useState<'verweigert' | 'timeout' | null>(null);
  // Von Hand gesetzt: Dann nervt die wiederkehrende GPS-Abfrage nicht mehr mit
  // dem Fehler-Banner. Ref statt State, weil die Tracking-Schleife den
  // aktuellen Wert lesen muss.
  const manuellerStandort = useRef(false);
  // Echtes GPS hat Vorrang vor dem Startort aus den eigenen Flügen.
  const gpsFix = useRef(false);
  // Ist der Standort echt (GPS oder von Hand)? Nur dann zeigt die
  // Sicherheitsansicht Notfall-Koordinaten - nicht den Startort aus alten
  // Flügen oder den Standardort Berlin.
  const [standortBekannt, setStandortBekannt] = useState(false);
  // Standort erst nach Erklärung abfragen (services/standortFreigabe.ts).
  const [standortFreigabe, setStandortFreigabe] = useState<StandortFreigabe>(ladeStandortFreigabe);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  // Wann und wo zuletzt Wetter geholt wurde
  const wetterStand = useRef<{ zeit: number; lat: number; lon: number } | null>(null);

  const holeWetter = (lat: number, lon: number) => {
    wetterStand.current = { zeit: Date.now(), lat, lon };
    fetchWeather(lat, lon).then(setWeather);
  };

  const standortWaehlen = (wert: 'erlaubt' | 'abgelehnt') => {
    speichereStandortFreigabe(wert);
    setStandortFreigabe(wert);
  };

  // Hat der Browser den Standort schon freigegeben (Nutzer von früher), entfällt
  // der Hinweis auf der Karte.
  useEffect(() => {
    void standortSchonFreigegeben().then(ja => {
      if (!ja) return;
      speichereStandortFreigabe('erlaubt');
      setStandortFreigabe('erlaubt');
    });
  }, []);

  const verfolgen = gebraucht && standortFreigabe === 'erlaubt';
  useEffect(() => {
    if (!verfolgen || !('geolocation' in navigator)) return;
    setIsLocating(true);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        // Echtes GPS ist verfügbar — es hat Vorrang, der Handbetrieb endet.
        manuellerStandort.current = false;
        const ersterFix = !gpsFix.current;
        gpsFix.current = true;
        setStandortBekannt(true);
        setGpsFehler(null);
        setIsLocating(false);
        const neu: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        // Kleine Schwankungen ignorieren, sonst springt die Karte ständig.
        setLocation(alt => (!ersterFix && distanzMeter(alt[0], alt[1], neu[0], neu[1]) < 15 ? alt : neu));
        // Wetter nur neu holen, wenn noch keins da ist, es älter als 10 min ist
        // oder man sich mehr als 2 km bewegt hat.
        const w = wetterStand.current;
        if (!w || Date.now() - w.zeit > 10 * 60_000 || distanzMeter(w.lat, w.lon, neu[0], neu[1]) > 2000) {
          wetterStand.current = { zeit: Date.now(), lat: neu[0], lon: neu[1] };
          fetchWeather(neu[0], neu[1]).then(setWeather);
        }
      },
      (err) => {
        setIsLocating(false);
        // Nach manuell gesetztem Standort nicht weiter mit dem Banner nerven.
        if (manuellerStandort.current) return;
        if (err.code === 1) setGpsFehler('verweigert');
        else if (err.code === 3) setGpsFehler('timeout');
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [verfolgen]);

  /** Orten-Knopf: einmal abfragen - wer selbst tippt, will den Standort, ab jetzt mitverfolgen. */
  const orten = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const neu: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        gpsFix.current = true;
        setStandortBekannt(true);
        standortWaehlen('erlaubt');
        setLocation(neu);
        holeWetter(neu[0], neu[1]);
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  /** Standort von Hand gesetzt (ohne GPS). */
  const setzeVonHand = (lat: number, lon: number) => {
    manuellerStandort.current = true;
    setStandortBekannt(true);
    setLocation([lat, lon]);
    setGpsFehler(null);
    holeWetter(lat, lon);
  };

  /** Ohne GPS nicht in Berlin starten, sondern dort, wo geflogen wird - nur,
   *  solange weder GPS noch eine Handeingabe da ist. */
  const setzeStartOrt = (ort: [number, number] | null) => {
    if (!ort || gpsFix.current || manuellerStandort.current) return;
    setLocation(ort);
    holeWetter(ort[0], ort[1]);
  };

  return {
    location, weather, isLocating, gpsFehler, standortBekannt, standortFreigabe,
    standortWaehlen, orten, setzeVonHand, setzeStartOrt,
  };
}
