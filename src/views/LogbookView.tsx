import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis,
} from 'recharts';
import {
  AlertTriangle, BarChart3, Bell, Book, Calendar, Clock, Download, FileDigit,
  History, Image as ImageIcon, Map as MapIcon, MapPin, Moon, Plane, Plus, Route,
  ShieldAlert, Timer, Trash2, TrendingUp, Upload, User, Wind, XCircle,
} from 'lucide-react';
import {
  dbService, type Flight, type Drone, type Battery, type UserProfile, type LocationFavorite,
} from '../services/db';
import { fluegeImZeitraum, betriebsnachweis, pdfTabellenzeilen, baueCsv, baueKml } from '../services/reportExport';
import { bestaetige, melde } from '../services/dialog';
import { getLastBackupAt } from '../services/backup';
import { getReminders } from '../services/reminders';
import { cn } from '../lib/utils';
import { useSprache } from '../lib/sprache';
import {
  FlightImportDialog, FlightMediaDialog, FlightTrackDialog, StatisticsDialog,
} from '../components/lazyDialogs';
import { FlightAssistant } from './FlightAssistant';

export function LogbookView({ flights, drones, batteries, profile, locationFavorites = [], onUpdate, currentLocation, onOpenFavorites }: { flights: Flight[], drones: Drone[], batteries: Battery[], profile: UserProfile | null, locationFavorites?: LocationFavorite[], onUpdate: () => void, currentLocation: [number, number], onOpenFavorites?: () => void }) {
  const { t } = useSprache();
  const [showAdd, setShowAdd] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newFlight, setNewFlight] = useState<Partial<Flight>>({});
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [trackFlight, setTrackFlight] = useState<Flight | null>(null);
  const [mediaFlight, setMediaFlight] = useState<Flight | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [exportJahr, setExportJahr] = useState<string>('alle');
  const touchStartX = { current: 0 };

  const todayStr = new Date().toISOString().split('T')[0];
  const validFlights = flights
    .filter(f => f.date <= todayStr)
    .sort((a,b) => b.createdAt - a.createdAt);

  // Jahre, aus denen Flüge vorliegen — für den Jahr-Filter beim PDF-Export.
  const verfuegbareJahre = Array.from(
    new Set(validFlights.map(f => (f.date || '').slice(0, 4)).filter(Boolean))
  ).sort().reverse();

  // Einmal berechnen statt zweimal pro Render (Bedingung + Liste).
  // getLastBackupAt() liest localStorage, ist also nicht gratis.
  const reminders = useMemo(
    () => getReminders(profile, drones, batteries, getLastBackupAt()),
    [profile, drones, batteries, flights]
  );

  const handleManualAdd = async () => {
    if (!newFlight.droneId || !newFlight.date) return;
    if (!newFlight.duration || newFlight.duration <= 0) { melde('Bitte eine Flugdauer > 0 Minuten eingeben.'); return; }
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
    doc.setTextColor(0, 56, 123); // Brand Blue
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
      headStyles: { fillColor: [0, 56, 123], textColor: [255, 255, 255], fontStyle: 'bold' },
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
    <div className="max-w-md lg:max-w-3xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand-blue">{t('view.logbuch')}</h2>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">Statistik & Dokumentation</p>
        </div>
        <div className="flex gap-2">
          {verfuegbareJahre.length > 0 && (
            <select
              value={exportJahr}
              onChange={e => setExportJahr(e.target.value)}
              title="Zeitraum für den PDF-Export"
              className="bg-white border border-slate-200 rounded-2xl shadow-sm text-xs font-bold text-slate-600 px-2"
            >
              <option value="alle">Alle</option>
              {verfuegbareJahre.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          )}
          <button
             onClick={exportToPDF}
             className="p-2.5 text-slate-400 hover:text-brand-orange bg-white border border-slate-200 rounded-2xl shadow-sm transition-all"
             title="Export PDF (Betriebsnachweis)"
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
             onClick={() => setShowImport(true)}
             className="p-2.5 text-slate-400 hover:text-brand-blue bg-white border border-slate-200 rounded-2xl shadow-sm transition-all"
             title="Flüge aus Flugaufzeichnung importieren (CSV)"
          >
             <Upload className="w-5 h-5" />
          </button>
          <button
             onClick={() => setShowStats(true)}
             className="p-2.5 text-slate-400 hover:text-brand-blue bg-white border border-slate-200 rounded-2xl shadow-sm transition-all"
             title="Statistik"
          >
             <TrendingUp className="w-5 h-5" />
          </button>
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
      {reminders.length > 0 && (
        <div className="mb-6 space-y-2">
          {reminders.map((r, i) => (
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Einsatzort</label>
                    {onOpenFavorites && (
                      <button
                        type="button"
                        onClick={onOpenFavorites}
                        className="text-[10px] font-bold text-amber-500 hover:underline flex items-center gap-1"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>Favoriten</span>
                      </button>
                    )}
                  </div>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" placeholder="z.B. Griesheim, Flugplatz" value={newFlight.locationName || ''} onChange={e => setNewFlight({...newFlight, locationName: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Zweiter Fernpilot / Co-Pilot</label>
                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" placeholder="Name Co-Pilot / Beobachter" value={newFlight.coPilotName || ''} onChange={e => setNewFlight({...newFlight, coPilotName: e.target.value})} />
                  </div>
                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={!!newFlight.isNightFlight}
                        onChange={e => setNewFlight({...newFlight, isNightFlight: e.target.checked})}
                        className="rounded text-brand-blue"
                      />
                      <Moon className="w-4 h-4 text-indigo-500" />
                      <span>Nachtflug</span>
                    </label>
                  </div>
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

      {showImport && (
        <FlightImportDialog
          drohnen={drones}
          vorhandeneFluege={flights}
          onClose={() => setShowImport(false)}
          onImported={(anzahl) => {
            setShowImport(false);
            onUpdate();
            melde(anzahl === 0
              ? 'Es wurde kein Flug importiert.'
              : `${anzahl} Flug/Flüge ins Logbuch übernommen.`);
          }}
        />
      )}

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
                  if (await bestaetige(`Flug vom ${new Date(flight.date).toLocaleDateString('de-DE')} wirklich löschen?`, { gefaehrlich: true })) {
                    await dbService.deleteFlight(flight.id);
                    setSwipedId(null);
                    onUpdate();
                  }
                }}
                className="absolute right-0 top-0 bottom-0 w-20 bg-brand-red flex flex-col items-center justify-center gap-1 z-10"
              >
                <Trash2 className="w-5 h-5 text-white" />
                <span className="text-[9px] font-black text-white uppercase">{t('aktion.loeschen')}</span>
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
                      {flight.isNightFlight && (
                        <div className="flex items-center gap-0.5 px-1 bg-indigo-50 rounded border border-indigo-100">
                          <Moon className="w-2.5 h-2.5 text-indigo-600" />
                          <span className="text-[8px] font-black text-indigo-600 uppercase">Nachtflug</span>
                        </div>
                      )}
                      {flight.coPilotName && (
                        <div className="flex items-center gap-0.5 px-1 bg-sky-50 rounded border border-sky-100">
                          <User className="w-2.5 h-2.5 text-sky-600" />
                          <span className="text-[8px] font-black text-sky-600 uppercase">Co: {flight.coPilotName}</span>
                        </div>
                      )}
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
                {/* Bilder zum Flug. Gefüllt, wenn welche hängen. */}
                <button
                  onClick={(e) => { e.stopPropagation(); setMediaFlight(flight); }}
                  aria-label="Bilder zum Flug"
                  className={cn(
                    'p-2 rounded-xl transition-colors shrink-0',
                    flight.media && flight.media.length > 0
                      ? 'bg-brand-blue/10 text-brand-blue'
                      : 'text-slate-300 hover:bg-slate-100'
                  )}
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                {/* Track ansehen / hinzufügen. Gefüllt, wenn eine Aufzeichnung da ist. */}
                <button
                  onClick={(e) => { e.stopPropagation(); setTrackFlight(flight); }}
                  aria-label="Flug-Track"
                  className={cn(
                    'p-2 rounded-xl transition-colors shrink-0',
                    flight.track && flight.track.length > 0
                      ? 'bg-brand-blue/10 text-brand-blue'
                      : 'text-slate-300 hover:bg-slate-100'
                  )}
                >
                  <Route className="w-5 h-5" />
                </button>
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
