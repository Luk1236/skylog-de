import { useState, useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis,
} from 'recharts';
import {
  AlertTriangle, BarChart3, Bell, BellOff, Book, Calendar, ChevronDown, Download, FileDigit,
  Image as ImageIcon, MapPin, Moon, MoreHorizontal, Plus, Route, Search,
  ShieldAlert, Timer, Trash2, TrendingUp, Upload, User, Wind, X,
} from 'lucide-react';
import {
  dbService, type Flight, type Drone, type Battery, type UserProfile, type LocationFavorite,
} from '../services/db';
import { fluegeImZeitraum, betriebsnachweis, pdfTabellenzeilen, baueCsv, baueKml } from '../services/reportExport';
import { melde } from '../services/dialog';
import { zeigeRueckgaengig } from '../services/rueckgaengig';
import { blendeAus, sichtbareHinweise } from '../services/ausgeblendeteHinweise';
import { getLastBackupAt } from '../services/backup';
import { getSicherungsIntervall } from '../services/sicherungsErinnerung';
import { getReminders } from '../services/reminders';
import { cn } from '../lib/utils';
import { useSprache } from '../lib/sprache';
import {
  FlightImportDialog, FlightMediaDialog, FlightTrackDialog, StatisticsDialog,
} from '../components/lazyDialogs';
import { Abschnitt, Dialog, Feld, IconKnopf, Knopf, SeitenKopf, eingabe } from '../components/ui';
import { FlightAssistant } from './FlightAssistant';

export function LogbookView({ flights, drones, batteries, profile, onUpdate, currentLocation, onOpenFavorites, formularStart }: {
  flights: Flight[], drones: Drone[], batteries: Battery[], profile: UserProfile | null, locationFavorites?: LocationFavorite[],
  onUpdate: () => void, currentLocation: [number, number], onOpenFavorites?: () => void,
  /** Mit offenem Eintrags-Formular starten (z. B. vom Knopf „Flug loggen“ auf der Karte). */
  formularStart?: boolean,
}) {
  const { t, tx, sprache } = useSprache();
  const todayStr = new Date().toISOString().split('T')[0];
  const validFlights = flights
    .filter(f => f.date <= todayStr)
    .sort((a,b) => b.createdAt - a.createdAt);
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
  const [hinweiseOffen, setHinweiseOffen] = useState(false);
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
    if (!newFlight.droneId || !newFlight.date) return;
    if (!newFlight.duration || newFlight.duration <= 0) { melde(tx('Bitte eine Flugdauer von mindestens 1 Minute eingeben.', 'Please enter a flight duration of at least 1 minute.')); return; }
    await dbService.saveFlight({
      id: crypto.randomUUID(),
      droneId: newFlight.droneId,
      batteryId: newFlight.batteryId,
      date: newFlight.date,
      startTime: newFlight.startTime || '',
      endTime: newFlight.endTime || '',
      duration: newFlight.duration || 0,
      location: '',
      locationName: newFlight.locationName || tx('Unbekannter Ort', 'Unknown place'),
      coordinates: currentLocation,
      purpose: newFlight.purpose || 'Hobby',
      coPilotName: newFlight.coPilotName || undefined,
      isNightFlight: !!newFlight.isNightFlight,
      notes: newFlight.notes || '',
      createdAt: Date.now()
    });
    // Battery cycles are incremented by dbService.saveFlight
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
    await dbService.saveFlight(flightData);
    // Battery cycles are incremented by dbService.saveFlight
    setShowAssistant(false);
    onUpdate();
  };

  // Voll-Backup (JSON) liegt bewusst nur in „Profil": dort läuft der Export
  // über backup.ts, das die NOTAM-Zugangsdaten herausfiltert. Ein zweiter,
  // ungefilterter Weg hier hätte die Geheimnisse doch in die Datei geschrieben.
  // Im Logbuch bleiben nur die flug-spezifischen Exporte (PDF, CSV, KML).

  const exportToCSV = () => {
    const blob = new Blob([baueCsv(validFlights, drones, profile?.name)], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `skylog_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };
  
  const exportToPDF = async () => {
    // Siehe exportPilotBadge: PDF-Bibliotheken erst bei Bedarf nachladen.
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();

    // Auf das gewählte Jahr eingrenzen (oder alle).
    const fluege = fluegeImZeitraum(validFlights, exportJahr);
    const zeitraum = exportJahr === 'alle' ? 'Gesamt' : exportJahr;
    const b = betriebsnachweis(fluege);

    // Header
    doc.setFontSize(22);
    doc.setTextColor(30, 58, 138); // Brand Blue
    doc.text(`Fluglogbuch & Betriebsnachweis ${exportJahr === 'alle' ? '' : exportJahr}`.trim(), 14, 22);

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

    // Betriebsnachweis: Summen über den gewählten Zeitraum (aus dem Service).
    doc.setFontSize(14);
    doc.setTextColor(50);
    doc.text(`Betriebsnachweis (${zeitraum})`, 14, 70);
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Flüge: ${b.anzahl}`, 14, 77);
    doc.text(`Flugzeit: ${b.stunden} h ${b.restMin} min`, 60, 77);
    doc.text(`Aktive Tage: ${b.aktiveTage}`, 120, 77);
    doc.text(`Genutzte Drohnen: ${b.genutzteDrohnen}`, 14, 83);
    doc.text(`Vorfälle: ${b.vorfaelle}`, 60, 83);
    doc.text(`Flüge mit Auffälligkeiten: ${b.fluegeMitAuffaelligkeiten}`, 120, 83);

    const tableData = pdfTabellenzeilen(fluege, drones);

    autoTable(doc, {
      startY: 90,
      head: [['Datum', 'Drohne', 'Zeitraum', 'Dauer', 'Ort', 'Zweck', 'Bemerkungen']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        6: { cellWidth: 50 } // Remarks column width
      }
    });
    
    doc.save(`skylog_de_logbuch_${exportJahr === 'alle' ? 'gesamt' : exportJahr}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportToKML = () => {
    const blob = new Blob([baueKml(validFlights)], { type: 'application/vnd.google-earth.kml+xml' });
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
  // Monatskuerzel in der eingestellten Sprache (de: Mär, Okt … / en: Mar, Oct …)
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString(sprache === 'en' ? 'en-GB' : 'de-DE', { month: 'short' }).replace('.', ''));
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

  const ZWECKE: { wert: NonNullable<Flight['purpose']>; label: string }[] = [
    { wert: 'Hobby', label: 'Hobby' },
    { wert: 'Gewerblich', label: tx('Gewerblich', 'Commercial') },
    { wert: 'Inspektion', label: tx('Inspektion', 'Inspection') },
    { wert: 'Kamerafahrt', label: tx('Kamerafahrt', 'Camera shot') },
    { wert: 'Training', label: 'Training' },
  ];
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

  const hatAlarm = hinweise.some(h => h.level === 'alert');
  const werkzeugZeile = (Icon: typeof FileDigit, titel: string, text: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors text-left"
    >
      <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-slate-200">
        <Icon className="w-4 h-4 text-brand-blue" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-900">{titel}</span>
        <span className="block text-xs text-slate-500">{text}</span>
      </span>
    </button>
  );

  return (
    <div className="max-w-md lg:max-w-3xl xl:max-w-6xl mx-auto pb-20">
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
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4 mb-6" id="flug-formular">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-black text-slate-900">{tx('Flug eintragen', 'Log a flight')}</h3>
            <button type="button" onClick={() => { setShowAdd(false); setShowAssistant(true); }} className="text-xs font-bold text-brand-blue hover:underline flex items-center gap-1 shrink-0">
              <Timer className="w-3.5 h-3.5" /> {tx('Lieber mit Assistent', 'Use the assistant')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Feld label={tx('Drohne', 'Drone')} htmlFor="lb-drohne">
              <select id="lb-drohne" className={eingabe} value={newFlight.droneId || ''} onChange={e => setNewFlight({ ...newFlight, droneId: e.target.value })}>
                <option value="">{tx('Wählen …', 'Choose…')}</option>
                {drones.map(d => <option key={d.id} value={d.id}>{d.model}</option>)}
              </select>
            </Feld>
            <Feld label={tx('Akku', 'Battery')} htmlFor="lb-akku">
              <select id="lb-akku" className={eingabe} value={newFlight.batteryId || ''} onChange={e => setNewFlight({ ...newFlight, batteryId: e.target.value })}>
                <option value="">{tx('Keiner', 'None')}</option>
                {batteries.map(b => <option key={b.id} value={b.id}>{b.number}</option>)}
              </select>
            </Feld>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Feld label={tx('Datum', 'Date')} htmlFor="lb-datum">
              <input id="lb-datum" type="date" className={eingabe} value={newFlight.date || ''} max={todayStr} onChange={e => setNewFlight({ ...newFlight, date: e.target.value })} />
            </Feld>
            <Feld label={tx('Dauer (Minuten)', 'Duration (minutes)')} htmlFor="lb-dauer">
              <input id="lb-dauer" type="number" min={1} inputMode="numeric" className={eingabe} placeholder="15" value={newFlight.duration || ''} onChange={e => setNewFlight({ ...newFlight, duration: Number(e.target.value) })} />
            </Feld>
          </div>
          <Feld
            label={
              <span className="flex items-center justify-between">
                <span>{tx('Einsatzort', 'Location')}</span>
                {onOpenFavorites && (
                  <button type="button" onClick={onOpenFavorites} className="normal-case tracking-normal text-xs font-bold text-brand-blue hover:underline flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {tx('Favoriten', 'Favourites')}
                  </button>
                )}
              </span>
            }
            htmlFor="lb-ort"
          >
            <input id="lb-ort" type="text" className={eingabe} placeholder={tx('z. B. Griesheim, Flugplatz', 'e.g. Griesheim, airfield')} value={newFlight.locationName || ''} onChange={e => setNewFlight({ ...newFlight, locationName: e.target.value })} />
          </Feld>
          <div className="grid grid-cols-2 gap-3">
            <Feld label={tx('Zweck', 'Purpose')} htmlFor="lb-zweck">
              <select id="lb-zweck" className={eingabe} value={newFlight.purpose || 'Hobby'} onChange={e => setNewFlight({ ...newFlight, purpose: e.target.value as Flight['purpose'] })}>
                {ZWECKE.map(z => <option key={z.wert} value={z.wert}>{z.label}</option>)}
              </select>
            </Feld>
            <Feld label={tx('Co-Pilot / Beobachter', 'Co-pilot / observer')} htmlFor="lb-copilot">
              <input id="lb-copilot" type="text" className={eingabe} placeholder={tx('Name (optional)', 'Name (optional)')} value={newFlight.coPilotName || ''} onChange={e => setNewFlight({ ...newFlight, coPilotName: e.target.value })} />
            </Feld>
          </div>
          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer text-sm font-medium text-slate-700">
            <input type="checkbox" checked={!!newFlight.isNightFlight} onChange={e => setNewFlight({ ...newFlight, isNightFlight: e.target.checked })} className="rounded text-brand-blue" />
            <Moon className="w-4 h-4 text-brand-blue" />
            {tx('Nachtflug', 'Night flight')}
          </label>
          <Knopf voll onClick={handleManualAdd} disabled={!newFlight.droneId || !newFlight.date}>{tx('Flug speichern', 'Save flight')}</Knopf>
        </div>
      )}

      {/* Breiter Bildschirm (xl): links Kennzahlen und Diagramme, rechts die Flugliste */}
      <div className="xl:grid xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-8 xl:items-start">
      <div className="xl:sticky xl:top-0">
      {/* Erinnerungen: eine zusammengefasste Karte statt eines Banner-Stapels */}
      {hinweise.length > 0 && (
        <div className="mb-6 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setHinweiseOffen(o => !o)}
            aria-expanded={hinweiseOffen}
            className="w-full flex items-center gap-3 p-4 text-left"
          >
            <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', hatAlarm ? 'bg-red-50 text-brand-red' : 'bg-amber-50 text-amber-800')}>
              <Bell className="w-4 h-4" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-slate-900">
                {hinweise.length === 1 ? tx('1 Hinweis', '1 reminder') : `${hinweise.length} ${tx('Hinweise', 'reminders')}`}
              </span>
              <span className={cn('block text-xs text-slate-600', !hinweiseOffen && 'truncate')}>{hinweise[0].text}</span>
            </span>
            <ChevronDown className={cn('w-4 h-4 text-slate-500 shrink-0 transition-transform', hinweiseOffen && 'rotate-180')} />
          </button>
          {hinweiseOffen && (
            <ul className="border-t border-slate-200 divide-y divide-slate-200">
              {hinweise.map(h => (
                <li key={h.schluessel} className="flex items-start gap-3 px-4 py-3">
                  <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', h.level === 'alert' ? 'bg-brand-red' : 'bg-amber-500')} />
                  <p className="flex-1 text-sm text-slate-700">{h.text}</p>
                  <Knopf variante="geist" groesse="sm" icon={BellOff} className="shrink-0 -my-1" onClick={() => { blendeAus(h.schluessel); setHinweisStand(s => s + 1); }}>
                    {tx('In 7 Tagen', 'In 7 days')}
                  </Knopf>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Kennzahlen */}
      <div className="space-y-4 mb-8">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: tx('Gesamt', 'Total'), wert: `${hours} h ${mins} min`, akzent: true },
            { label: tx('Flüge', 'Flights'), wert: String(totalFlights), akzent: false },
            { label: tx('Schnitt', 'Average'), wert: `${avgDuration} min`, akzent: false },
          ].map(k => (
            <div key={k.label} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1">{k.label}</p>
              <p className={cn('text-base font-black whitespace-nowrap', k.akzent ? 'text-brand-blue' : 'text-slate-900')}>{k.wert}</p>
            </div>
          ))}
        </div>

        {/* Letzte 7 Tage */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-brand-blue" />
            <h3 className="text-sm font-bold text-slate-900">{tx('Letzte 7 Tage', 'Last 7 days')}</h3>
          </div>
          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-slate-200)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-slate-500)', fontWeight: 600 }} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const n = Number(payload[0].value);
                      return (
                        <div className="bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-xl">
                          {n} {n === 1 ? tx('Flug', 'flight') : tx('Flüge', 'flights')}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="flights" radius={[4, 4, 0, 0]} barSize={16}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.flights > 0 ? 'var(--color-brand-blue)' : 'var(--color-slate-100)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Erweiterte Statistiken */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1">{tx('Diesen Monat', 'This month')}</p>
          <p className="text-lg font-black text-slate-900">{thisMonthFlights} <span className="text-sm font-bold text-slate-500">{tx('Flüge', 'Flights')}</span></p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1">{tx('Top-Drohne', 'Top drone')}</p>
          <p className="text-sm font-black text-slate-900 truncate">{topDrone?.model || '—'}</p>
          {topDrone && <p className="text-xs text-slate-500">{topDrone.count} {tx('Flüge', 'Flights')}</p>}
        </div>
      </div>
      {purposeData.length > 0 && (
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm mb-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3">{tx('Flüge nach Zweck', 'Flights by purpose')}</h3>
          <div className="space-y-2">
            {purposeData.map(({ name, value }) => (
              <div key={name} className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 w-24 shrink-0">{zweckLabel(name as Flight['purpose'])}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                  <div className="bg-brand-blue h-1.5 rounded-full" style={{ width: `${Math.round((value / totalFlights) * 100)}%` }} />
                </div>
                <span className="text-xs font-bold text-slate-500 w-6 text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jahresübersicht */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-blue" />
            <h3 className="text-sm font-bold text-slate-900">{tx('Jahresübersicht', 'Year overview')} {currentYear}</h3>
          </div>
          <span className="text-xs font-bold text-brand-blue whitespace-nowrap">{Math.floor(yearTotalMins / 60)} h {yearTotalMins % 60} min</span>
        </div>
        <div className="flex items-end gap-1 h-16">
          {yearlyData.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className={cn('w-full rounded-t-sm transition-all', m.minutes > 0 ? 'bg-brand-blue' : 'bg-slate-100')}
                style={{ height: `${Math.max(2, Math.round((m.minutes / maxMins) * 48))}px` }}
              />
              <span className="text-2xs font-bold text-slate-500">{m.label}</span>
              {m.flights > 0 && <span className="text-2xs font-black text-brand-blue">{m.flights}</span>}
            </div>
          ))}
        </div>
      </div>

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

      <div className="space-y-3">
        {gefiltert.map(flight => {
          const drone = drones.find(d => d.id === flight.droneId);
          const hatMedien = !!flight.media && flight.media.length > 0;
          const hatTrack = !!flight.track && flight.track.length > 0;
          return (
            <div key={flight.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{flight.locationName}</p>
                  <p className="text-xs text-slate-500">
                    {datumText(flight.date)} · {drone?.model || tx('Gelöschte Drohne', 'Deleted drone')} · {flight.duration} min
                    {flight.legs && flight.legs.length > 0 && <> · {flight.legs.length} {tx('Legs', 'legs')}</>}
                  </p>
                </div>
                <div className="flex shrink-0 -mr-2 -mt-1">
                  <IconKnopf
                    icon={ImageIcon}
                    aria-label={hatMedien ? tx('Bilder zum Flug ansehen', 'View flight photos') : tx('Bilder hinzufügen', 'Add photos')}
                    onClick={() => setMediaFlight(flight)}
                    className={cn(hatMedien && 'text-brand-blue bg-brand-blue/10')}
                  />
                  <IconKnopf
                    icon={Route}
                    aria-label={hatTrack ? tx('Flug-Track ansehen', 'View flight track') : tx('Flug-Track hinzufügen', 'Add flight track')}
                    onClick={() => setTrackFlight(flight)}
                    className={cn(hatTrack && 'text-brand-blue bg-brand-blue/10')}
                  />
                  <IconKnopf icon={Trash2} variante="gefahr" aria-label={tx('Flug löschen', 'Delete flight')} onClick={() => void loescheFlug(flight)} />
                </div>
              </div>
              {(flight.isNightFlight || flight.coPilotName || (flight.weather && (flight.weather.windSpeed > 15 || flight.weather.temp > 30)) || (flight.batteryStatus?.endPercent != null && flight.batteryStatus.endPercent < 15) || flight.incidents) && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {flight.isNightFlight && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-full text-2xs font-bold text-slate-700">
                      <Moon className="w-3 h-3" /> {tx('Nachtflug', 'Night flight')}
                    </span>
                  )}
                  {flight.coPilotName && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-blue/10 rounded-full text-2xs font-bold text-brand-blue">
                      <User className="w-3 h-3" /> Co: {flight.coPilotName}
                    </span>
                  )}
                  {flight.weather && (flight.weather.windSpeed > 15 || flight.weather.temp > 30) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 rounded-full text-2xs font-bold text-amber-800">
                      <Wind className="w-3 h-3" /> {tx('Wetter-Warnung', 'Weather warning')}
                    </span>
                  )}
                  {flight.batteryStatus?.endPercent != null && flight.batteryStatus.endPercent < 15 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 rounded-full text-2xs font-bold text-brand-red">
                      <ShieldAlert className="w-3 h-3" /> {tx('Tiefentladungs-Risiko', 'Deep discharge risk')}
                    </span>
                  )}
                  {flight.incidents && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 rounded-full text-2xs font-bold text-brand-red">
                      <AlertTriangle className="w-3 h-3" /> {tx('Vorkommnis', 'Occurrence')}
                    </span>
                  )}
                </div>
              )}
              {flight.incidents && <p className="text-xs text-brand-red mt-2">{flight.incidents}</p>}
              {flight.incidentPhoto && (
                <img src={flight.incidentPhoto} alt={tx('Vorkommnis', 'Occurrence')} className="mt-2 w-24 h-16 object-cover rounded-lg border border-brand-red/20" />
              )}
            </div>
          );
        })}

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

      {showWerkzeuge && (
        <Dialog titel={tx('Export, Import & Statistik', 'Export, import & statistics')} icon={FileDigit} onClose={() => setShowWerkzeuge(false)}>
          <div className="space-y-2">
            <Abschnitt titel={tx('Auswerten', 'Analyse')} />
            {werkzeugZeile(TrendingUp, tx('Statistik', 'Statistics'), tx('Flugzeit je Monat, Drohne und Zweck', 'Flight time per month, drone and purpose'), () => { setShowWerkzeuge(false); setShowStats(true); })}
          </div>
          <div className="space-y-2">
            <Abschnitt titel={tx('Exportieren', 'Export')} />
            {verfuegbareJahre.length > 0 && (
              <Feld label={tx('Zeitraum für den PDF-Nachweis', 'Period for the PDF record')} htmlFor="lb-jahr">
                <select id="lb-jahr" value={exportJahr} onChange={e => setExportJahr(e.target.value)} className={eingabe}>
                  <option value="alle">{tx('Alle Jahre', 'All years')}</option>
                  {verfuegbareJahre.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </Feld>
            )}
            {werkzeugZeile(FileDigit, tx('PDF-Betriebsnachweis', 'PDF operations record'), tx('Flugbuch mit Summen zum Vorzeigen', 'Logbook with totals to show'), () => void exportToPDF())}
            {werkzeugZeile(Download, tx('CSV-Tabelle', 'CSV table'), tx('Für Excel oder Numbers', 'For Excel or Numbers'), exportToCSV)}
            {werkzeugZeile(MapPin, tx('KML für Google Earth', 'KML for Google Earth'), tx('Alle Flugorte auf der Karte', 'All flight locations on a map'), exportToKML)}
          </div>
          <div className="space-y-2">
            <Abschnitt titel={tx('Importieren', 'Import')} />
            {werkzeugZeile(Upload, tx('Flüge importieren', 'Import flights'), tx('Airdata-CSV oder DJI-SRT', 'Airdata CSV or DJI SRT'), () => { setShowWerkzeuge(false); setShowImport(true); })}
          </div>
        </Dialog>
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
