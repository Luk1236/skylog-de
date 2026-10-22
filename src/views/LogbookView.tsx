import { useState, useMemo } from 'react';
import { Book, MoreHorizontal, Plus, Search, Timer, X } from 'lucide-react';
import { dbService, type Flight, type Drone, type Battery, type UserProfile, type LocationFavorite } from '../services/db';
import { melde } from '../services/dialog';
import { zeigeRueckgaengig } from '../services/rueckgaengig';
import { blendeAus, sichtbareHinweise } from '../services/ausgeblendeteHinweise';
import { getLastBackupAt } from '../services/sicherungsStand';
import { getSicherungsIntervall } from '../services/sicherungsErinnerung';
import { getReminders } from '../services/reminders';
import { cn, lokalesDatum } from '../lib/utils';
import { useSprache } from '../lib/sprache';
import {
  FlightImportDialog, FlightMediaDialog, FlightTrackDialog, StatisticsDialog,
} from '../components/lazyDialogs';
import { Abschnitt, Knopf, SeitenKopf, eingabe } from '../components/ui';
import { FlightAssistant } from './FlightAssistant';
import { FlugFormular } from './logbuch/FlugFormular';
import { HinweisKarte } from './logbuch/HinweisKarte';
import { LogbuchKennzahlen } from './logbuch/LogbuchKennzahlen';
import { FlugKarte } from './logbuch/FlugKarte';
import { WerkzeugDialog } from './logbuch/WerkzeugDialog';
import { flugAusFormular, zwecke } from './logbuch/neuerFlug';
import { exportiereCsv, exportiereKml, exportierePdf } from './logbuch/exporte';

// Die Ansicht hält Daten, Filter und Aktionen; Formular, Kennzahlen, Karten und
// Werkzeuge liegen in ./logbuch.
export function LogbookView({ flights, drones, batteries, profile, onUpdate, currentLocation, onOpenFavorites, formularStart }: {
  flights: Flight[], drones: Drone[], batteries: Battery[], profile: UserProfile | null, locationFavorites?: LocationFavorite[],
  onUpdate: () => void, currentLocation: [number, number], onOpenFavorites?: () => void,
  /** Mit offenem Eintrags-Formular starten (z. B. vom Knopf „Flug loggen“ auf der Karte). */
  formularStart?: boolean,
}) {
  const { t, tx, sprache } = useSprache();
  const todayStr = lokalesDatum();
  const validFlights = flights
    .filter(f => f.date <= todayStr)
    .sort((a, b) => b.createdAt - a.createdAt);
  // Vorbelegung: heute, zuletzt genutzte Drohne und Zweck.
  const vorbelegung = (): Partial<Flight> => ({
    date: todayStr,
    droneId: validFlights[0]?.droneId ?? (drones.length === 1 ? drones[0].id : undefined),
    purpose: validFlights[0]?.purpose ?? 'Hobby',
  });

  const [showAdd, setShowAdd] = useState(!!formularStart);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showWerkzeuge, setShowWerkzeuge] = useState(false);
  const [newFlight, setNewFlight] = useState<Partial<Flight>>(() => (formularStart ? vorbelegung() : {}));
  const [trackFlight, setTrackFlight] = useState<Flight | null>(null);
  const [mediaFlight, setMediaFlight] = useState<Flight | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [exportJahr, setExportJahr] = useState<string>('alle');
  const [suche, setSuche] = useState('');
  const [filterDrohne, setFilterDrohne] = useState('alle');
  const [filterZweck, setFilterZweck] = useState('alle');
  const [hinweisStand, setHinweisStand] = useState(0);

  const oeffneFormular = () => {
    setNewFlight(vorbelegung());
    setShowAdd(true);
  };

  // Jahre, aus denen Flüge vorliegen — für den Jahr-Filter beim PDF-Export.
  const verfuegbareJahre = Array.from(
    new Set(validFlights.map(f => (f.date || '').slice(0, 4)).filter(Boolean))
  ).sort().reverse();

  // Einmal berechnen statt zweimal pro Render (Bedingung + Liste).
  // getLastBackupAt() liest localStorage, ist also nicht gratis.
  const reminders = useMemo(
    () => getReminders(profile, drones, batteries, getLastBackupAt(), Date.now(), getSicherungsIntervall()),
    // flights absichtlich dabei: nach Import/Aenderung (onUpdate) auch den
    // Sicherungs-Zeitstempel aus localStorage neu lesen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, drones, batteries, flights]
  );
  // Ausgeblendete („in 7 Tagen erinnern“) weglassen, dringende zuerst.
  const hinweise = useMemo(
    () => sichtbareHinweise(reminders).sort((a, b) => (a.level === b.level ? 0 : a.level === 'alert' ? -1 : 1)),
    // hinweisStand: nach dem Ausblenden neu lesen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reminders, hinweisStand]
  );

  const handleManualAdd = async () => {
    const ergebnis = flugAusFormular(newFlight, currentLocation, tx('Unbekannter Ort', 'Unknown place'));
    if ('fehler' in ergebnis) {
      if (ergebnis.fehler === 'dauer') melde(tx('Bitte eine Flugdauer von mindestens 1 Minute eingeben.', 'Please enter a flight duration of at least 1 minute.'));
      return;
    }
    // Akku-Zyklen zählt dbService.saveFlight hoch.
    await dbService.saveFlight(ergebnis.flug);
    setNewFlight({});
    setShowAdd(false);
    onUpdate();
  };

  // Sofort löschen, ein paar Sekunden „Rückgängig“ anbieten.
  const loescheFlug = async (flight: Flight) => {
    await dbService.deleteFlight(flight.id);
    onUpdate();
    zeigeRueckgaengig(tx('Flug gelöscht', 'Flight deleted'), async () => {
      await dbService.restoreFlight(flight);
      onUpdate();
    });
  };

  const handleAssistantSave = async (flightData: Flight) => {
    // Akku-Zyklen zählt dbService.saveFlight hoch.
    await dbService.saveFlight(flightData);
    setShowAssistant(false);
    onUpdate();
  };

  const ZWECKE = zwecke(tx);
  const zweckLabel = (p?: Flight['purpose']) => ZWECKE.find(z => z.wert === (p || 'Hobby'))?.label ?? p ?? 'Hobby';
  const datumText = (d: string) => new Date(d).toLocaleDateString(sprache === 'en' ? 'en-GB' : 'de-DE');

  // Suche und Filter wirken nur auf die Liste; die Kennzahlen zeigen immer alles.
  const q = suche.trim().toLowerCase();
  const gefiltert = validFlights.filter(f => {
    if (filterDrohne !== 'alle' && f.droneId !== filterDrohne) return false;
    if (filterZweck !== 'alle' && (f.purpose || 'Hobby') !== filterZweck) return false;
    if (!q) return true;
    const drohne = drones.find(d => d.id === f.droneId)?.model ?? '';
    return [f.locationName, drohne, zweckLabel(f.purpose), f.notes, f.coPilotName, f.incidents, datumText(f.date)]
      .filter(Boolean).join(' ').toLowerCase().includes(q);
  });
  const filterAktiv = q !== '' || filterDrohne !== 'alle' || filterZweck !== 'alle';

  return (
    <div className="max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-6xl mx-auto pb-20">
      <SeitenKopf
        titel={t('view.logbuch')}
        untertitel={tx('Statistik & Dokumentation', 'Statistics & documentation')}
        aktionen={
          <>
            <Knopf variante="sekundaer" icon={MoreHorizontal} onClick={() => setShowWerkzeuge(true)} aria-label={tx('Export, Import und Statistik', 'Export, import and statistics')} />
            <Knopf variante="sekundaer" icon={Timer} onClick={() => setShowAssistant(true)}>{tx('Assistent', 'Assistant')}</Knopf>
            <Knopf icon={showAdd ? X : Plus} onClick={() => (showAdd ? setShowAdd(false) : oeffneFormular())}>
              {showAdd ? tx('Schließen', 'Close') : tx('Neuer Flug', 'New flight')}
            </Knopf>
          </>
        }
      />

      {showAdd && (
        <FlugFormular
          flug={newFlight}
          setFlug={setNewFlight}
          drones={drones}
          batteries={batteries}
          heute={todayStr}
          onFavoriten={onOpenFavorites}
          onAssistent={() => { setShowAdd(false); setShowAssistant(true); }}
          onSpeichern={() => void handleManualAdd()}
        />
      )}

      {/* Breiter Bildschirm (xl): links Kennzahlen und Diagramme, rechts die Flugliste */}
      <div className="xl:grid xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-8 xl:items-start">
        <div className="xl:sticky xl:top-0">
          <HinweisKarte hinweise={hinweise} onAusblenden={schluessel => { blendeAus(schluessel); setHinweisStand(s => s + 1); }} />
          <LogbuchKennzahlen fluege={validFlights} drones={drones} zweckLabel={zweckLabel} />
        </div>

        {/* Rechte Spalte: Flugliste */}
        <div>
          <Abschnitt
            titel={tx('Alle Einträge', 'All entries')}
            aktion={<span className="text-xs font-bold text-slate-500">{filterAktiv ? `${gefiltert.length} / ${validFlights.length}` : validFlights.length} {tx('Einträge', 'entries')}</span>}
          />

          {validFlights.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="relative flex-1 min-w-[10rem]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={suche}
                  onChange={e => setSuche(e.target.value)}
                  placeholder={tx('Ort, Drohne, Notiz …', 'Place, drone, note…')}
                  aria-label={tx('Flüge durchsuchen', 'Search flights')}
                  className={cn(eingabe, 'pl-9')}
                />
              </div>
              {drones.length > 1 && (
                <select value={filterDrohne} onChange={e => setFilterDrohne(e.target.value)} aria-label={tx('Nach Drohne filtern', 'Filter by drone')} className={cn(eingabe, 'w-auto')}>
                  <option value="alle">{tx('Alle Drohnen', 'All drones')}</option>
                  {drones.map(d => <option key={d.id} value={d.id}>{d.model}</option>)}
                </select>
              )}
              <select value={filterZweck} onChange={e => setFilterZweck(e.target.value)} aria-label={tx('Nach Zweck filtern', 'Filter by purpose')} className={cn(eingabe, 'w-auto')}>
                <option value="alle">{tx('Jeder Zweck', 'Any purpose')}</option>
                {ZWECKE.map(z => <option key={z.wert} value={z.wert}>{z.label}</option>)}
              </select>
            </div>
          )}

          <div className="space-y-3">
            {gefiltert.map(flight => (
              <FlugKarte
                key={flight.id}
                flug={flight}
                drohne={drones.find(d => d.id === flight.droneId)}
                datumText={datumText}
                onMedien={() => setMediaFlight(flight)}
                onTrack={() => setTrackFlight(flight)}
                onLoeschen={() => void loescheFlug(flight)}
              />
            ))}

            {validFlights.length > 0 && gefiltert.length === 0 && (
              <div className="text-center py-10 px-6">
                <p className="text-sm font-bold text-slate-700">{tx('Kein Flug passt zur Suche.', 'No flight matches your search.')}</p>
                <button type="button" onClick={() => { setSuche(''); setFilterDrohne('alle'); setFilterZweck('alle'); }} className="text-sm font-bold text-brand-blue hover:underline mt-2">
                  {tx('Filter zurücksetzen', 'Reset filters')}
                </button>
              </div>
            )}

            {validFlights.length === 0 && !showAdd && (
              <div className="text-center py-12 px-6">
                <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Book className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-700 font-bold">{tx('Das Logbuch ist leer', 'The logbook is empty')}</p>
                <p className="text-slate-500 text-sm mt-1 mb-4">{tx('Trag deinen ersten Flug ein oder starte den Flug-Assistenten.', 'Log your first flight or start the flight assistant.')}</p>
                <Knopf icon={Plus} onClick={oeffneFormular}>{tx('Ersten Flug eintragen', 'Log first flight')}</Knopf>
              </div>
            )}
          </div>
        </div>
      </div>

      {showImport && (
        <FlightImportDialog
          drohnen={drones}
          vorhandeneFluege={flights}
          onClose={() => setShowImport(false)}
          onImported={(anzahl) => {
            setShowImport(false);
            onUpdate();
            melde(anzahl === 0
              ? tx('Es wurde kein Flug importiert.', 'No flight was imported.')
              : anzahl === 1
                ? tx('1 Flug ins Logbuch übernommen.', '1 flight added to the logbook.')
                : tx(`${anzahl} Flüge ins Logbuch übernommen.`, `${anzahl} flights added to the logbook.`));
          }}
        />
      )}

      {showAssistant && (
        <div className="fixed inset-0 z-[60] bg-slate-50 overflow-y-auto">
          <FlightAssistant
            drones={drones}
            batteries={batteries}
            profile={profile}
            letzterFlug={validFlights[0]}
            onClose={() => setShowAssistant(false)}
            onSave={handleAssistantSave}
            currentLocation={currentLocation}
          />
        </div>
      )}

      {showWerkzeuge && (
        <WerkzeugDialog
          jahre={verfuegbareJahre}
          exportJahr={exportJahr}
          setExportJahr={setExportJahr}
          onStatistik={() => { setShowWerkzeuge(false); setShowStats(true); }}
          onPdf={() => void exportierePdf(validFlights, drones, profile, exportJahr)}
          onCsv={() => exportiereCsv(validFlights, drones, profile?.name)}
          onKml={() => exportiereKml(validFlights)}
          onImport={() => { setShowWerkzeuge(false); setShowImport(true); }}
          onClose={() => setShowWerkzeuge(false)}
        />
      )}

      {trackFlight && (
        <FlightTrackDialog
          flight={trackFlight}
          onClose={() => setTrackFlight(null)}
          onUpdate={onUpdate}
        />
      )}

      {mediaFlight && (
        <FlightMediaDialog
          flight={mediaFlight}
          onClose={() => setMediaFlight(null)}
          onUpdate={onUpdate}
        />
      )}

      {showStats && (
        <StatisticsDialog flights={validFlights} drones={drones} onClose={() => setShowStats(false)} />
      )}
    </div>
  );
}
