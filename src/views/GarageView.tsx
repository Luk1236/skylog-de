import { useState, useEffect, useMemo, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BadgeAlert, Calendar, Camera, Clock, Plane, Plus, Settings2,
  ShieldAlert, Sparkles, Trash2, Wrench, XCircle, Zap,
} from 'lucide-react';
import {
  dbService, type Drone, type Battery, type MaintenanceRecord,
  type Flight, type UASClass,
} from '../services/db';
import { bestaetige } from '../services/dialog';
import { wartungStatus, garantieStatus, gesamtKosten } from '../services/maintenance';
import { effektiveGesundheit } from '../services/batteryHealth';
import { cn } from '../lib/utils';
import { useSprache } from '../lib/sprache';
import { BatteryDetailDialog } from '../components/lazyDialogs';

export function GarageView({ drones, flights, batteries, onUpdate }: { drones: Drone[], flights: Flight[], batteries: Battery[], onUpdate: () => void }) {
  const { t } = useSprache();
  const [showAdd, setShowAdd] = useState(false);
  const [editingDroneId, setEditingDroneId] = useState<string | null>(null);
  const [newDrone, setNewDrone] = useState<Partial<Drone>>({});
  const [showAddBattery, setShowAddBattery] = useState(false);
  const [newBattery, setNewBattery] = useState<Partial<Battery>>({});
  const [detailBattery, setDetailBattery] = useState<Battery | null>(null);

  // Stats and Suggestions
  const [droneStats, setDroneStats] = useState<Record<string, { hours: number, flights: number, lastMaint: Record<string, number>, lastMaintHours: Record<string, number>, flightsSinceMaint: Record<string, number> }>>({});
  const [alleWartungen, setAlleWartungen] = useState<MaintenanceRecord[]>([]);

  useEffect(() => {
    const loadStats = async () => {
      const allFlights = await dbService.getFlights();
      const stats: Record<string, { hours: number, flights: number, lastMaint: Record<string, number>, lastMaintHours: Record<string, number>, flightsSinceMaint: Record<string, number> }> = {};
      const gesammelt: MaintenanceRecord[] = [];

      for (const drone of drones) {
        const dFlights = allFlights.filter(f => f.droneId === drone.id);
        const dMaint = await dbService.getMaintenance(drone.id);
        gesammelt.push(...dMaint);

        const lastMaint: Record<string, number> = {};
        const lastMaintHours: Record<string, number> = {};

        dMaint.forEach(m => {
          if (!lastMaint[m.type] || m.createdAt > lastMaint[m.type]) {
            lastMaint[m.type] = m.createdAt;
            lastMaintHours[m.type] = m.hoursAtMaintenance || 0;
          }
        });

        const flightsSinceMaint: Record<string, number> = {};
        for (const type of Object.keys(lastMaint)) {
          flightsSinceMaint[type] = dFlights.filter(f => f.createdAt > lastMaint[type]).length;
        }

        stats[drone.id] = {
          hours: dFlights.reduce((acc, f) => acc + (f.duration / 60), 0),
          flights: dFlights.length,
          lastMaint,
          lastMaintHours,
          flightsSinceMaint
        };
      }
      setDroneStats(stats);
      setAlleWartungen(gesammelt);
    };
    loadStats();
  }, [drones, flights]); // Add flights to deps to update stats when a flight is added

  const getMaintenanceAlerts = (droneId: string) => {
    const stats = droneStats[droneId];
    if (!stats) return [];
    
    const alerts: { type: string, reason: string, detail: string }[] = [];
    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const oneYear = 365 * 24 * 60 * 60 * 1000;

    // Firmware check (90 days)
    if (!stats.lastMaint['Firmware'] || (now - stats.lastMaint['Firmware']) > ninetyDays) {
      alerts.push({ type: 'Firmware', reason: 'Update fällig', detail: 'Firmware-Update seit über 90 Tagen nicht durchgeführt.' });
    }

    // Propeller check (10 hours OR 50 flights since last check)
    const propFlights = stats.flightsSinceMaint?.['Propeller'] ?? stats.flights;
    if (stats.hours > 10 && (!stats.lastMaint['Propeller'] || (stats.hours - (stats.lastMaintHours['Propeller'] || 0)) > 10)) {
      alerts.push({ type: 'Propeller', reason: 'Sichtprüfung (10h)', detail: 'Propeller auf Haarrisse und Abnutzung prüfen.' });
    } else if (propFlights >= 50) {
      alerts.push({ type: 'Propeller', reason: `${propFlights} Flüge seit letztem Check`, detail: 'Empfehlung: Propeller nach 50 Flügen sorgfältig prüfen oder tauschen.' });
    }

    // Motor check (25 hours OR 100 flights)
    const motorFlights = stats.flightsSinceMaint?.['Motor'] ?? stats.flights;
    if (stats.hours > 25 && (!stats.lastMaint['Motor'] || (stats.hours - (stats.lastMaintHours['Motor'] || 0)) > 25)) {
      alerts.push({ type: 'Motor', reason: 'Motorreinigung (25h)', detail: 'Motoren auf Fremdkörper prüfen und mit Druckluft reinigen.' });
    } else if (motorFlights >= 100) {
      alerts.push({ type: 'Motor', reason: `${motorFlights} Flüge seit letzter Reinigung`, detail: 'Empfehlung: Motoren nach 100 Flügen reinigen und auf Lager prüfen.' });
    }

    // Sensor check (6 months)
    const sixMonths = 180 * 24 * 60 * 60 * 1000;
    if (!stats.lastMaint['Sensor'] || (now - stats.lastMaint['Sensor']) > sixMonths) {
      alerts.push({ type: 'Sensor', reason: 'Sensor-Kalibrierung', detail: 'IMU und Kompass-Kalibrierung für optimale Stabilität empfohlen.' });
    }

    // General check (1 year)
    if (!stats.lastMaint['General'] || (now - stats.lastMaint['General']) > oneYear) {
      alerts.push({ type: 'General', reason: 'Jahresservice', detail: 'Vollständiger Systemcheck nach einem Jahr Betrieb empfohlen.' });
    }

    return alerts;
  };

  const [selectedDroneId, setSelectedDroneId] = useState<string | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [showMaintForm, setShowMaintForm] = useState(false);
  const [newMaint, setNewMaint] = useState<Partial<MaintenanceRecord>>({ type: 'General' });
  const [maintFilter, setMaintFilter] = useState<MaintenanceRecord['type'] | 'All'>('All');
  const [dateFilter, setDateFilter] = useState<'All' | '30Days' | '3Months' | '1Year'>('All');

  useEffect(() => {
    if (selectedDroneId) {
      dbService.getMaintenance(selectedDroneId).then(setMaintenance);
      setMaintFilter('All');
      setDateFilter('All');
    }
  }, [selectedDroneId]);

  const filteredMaintenance = useMemo(() => {
    const now = Date.now();
    const thresholds = {
      '30Days': now - (30 * 24 * 60 * 60 * 1000),
      '3Months': now - (90 * 24 * 60 * 60 * 1000),
      '1Year': now - (365 * 24 * 60 * 60 * 1000)
    };

    return maintenance
      .filter(m => {
        const matchesType = maintFilter === 'All' ? true : m.type === maintFilter;
        if (!matchesType) return false;

        if (dateFilter === 'All') return true;
        return m.createdAt >= (thresholds[dateFilter] || 0);
      })
      .sort((a,b) => b.createdAt - a.createdAt);
  }, [maintenance, maintFilter, dateFilter]);

  const handleAddMaint = async () => {
    if (!selectedDroneId || !newMaint.description) return;
    const stats = droneStats[selectedDroneId];
    const record: MaintenanceRecord = {
      id: crypto.randomUUID(),
      droneId: selectedDroneId,
      date: new Date().toISOString().split('T')[0],
      type: newMaint.type as any,
      description: newMaint.description,
      hoursAtMaintenance: stats?.hours || 0,
      cost: newMaint.cost,
      createdAt: Date.now()
    };
    await dbService.saveMaintenance(record);
    const updated = await dbService.getMaintenance(selectedDroneId);
    setMaintenance(updated);
    setNewMaint({ type: 'General' });
    setShowMaintForm(false);
  };

  const handleAdd = async () => {
    if (!newDrone.model) return;
    
    if (editingDroneId) {
      const droneToUpdate = drones.find(d => d.id === editingDroneId);
      if (droneToUpdate) {
        await dbService.saveDrone({
          ...droneToUpdate,
          model: newDrone.model,
          weight: newDrone.weight || 0,
          uasClass: (newDrone.uasClass as UASClass) || 'Legacy',
          eId: newDrone.eId || '',
          serialNumber: newDrone.serialNumber || '',
          firmwareVersion: newDrone.firmwareVersion || '',
          insuranceNumber: newDrone.insuranceNumber || '',
          maxWindSpeed: newDrone.maxWindSpeed,
          photoUrl: newDrone.photoUrl,
          purchaseDate: newDrone.purchaseDate,
          warrantyUntil: newDrone.warrantyUntil,
          maintenanceIntervalDays: newDrone.maintenanceIntervalDays,
          maintenanceIntervalHours: newDrone.maintenanceIntervalHours,
        });
      }
    } else {
      await dbService.saveDrone({
        id: crypto.randomUUID(),
        model: newDrone.model,
        weight: newDrone.weight || 0,
        uasClass: (newDrone.uasClass as UASClass) || 'Legacy',
        eId: newDrone.eId || '',
        serialNumber: newDrone.serialNumber || '',
        firmwareVersion: newDrone.firmwareVersion || '',
        insuranceNumber: newDrone.insuranceNumber || '',
        maxWindSpeed: newDrone.maxWindSpeed,
        photoUrl: newDrone.photoUrl,
        purchaseDate: newDrone.purchaseDate,
        warrantyUntil: newDrone.warrantyUntil,
        maintenanceIntervalDays: newDrone.maintenanceIntervalDays,
        maintenanceIntervalHours: newDrone.maintenanceIntervalHours,
        createdAt: Date.now()
      });
    }

    setNewDrone({});
    setEditingDroneId(null);
    setShowAdd(false);
    onUpdate();
  };

  const handleEditDrone = (drone: Drone) => {
    setNewDrone({
      model: drone.model,
      weight: drone.weight,
      uasClass: drone.uasClass,
      eId: drone.eId,
      serialNumber: drone.serialNumber,
      firmwareVersion: drone.firmwareVersion,
      insuranceNumber: drone.insuranceNumber,
      maxWindSpeed: drone.maxWindSpeed,
      photoUrl: drone.photoUrl,
      purchaseDate: drone.purchaseDate,
      warrantyUntil: drone.warrantyUntil,
      maintenanceIntervalDays: drone.maintenanceIntervalDays,
      maintenanceIntervalHours: drone.maintenanceIntervalHours,
    });
    setEditingDroneId(drone.id);
    setShowAdd(true);
  };

  const handleAddBattery = async () => {
    if (!newBattery.number) return;
    await dbService.saveBattery({
      id: crypto.randomUUID(),
      number: newBattery.number,
      cycles: 0,
      createdAt: Date.now()
    });
    setNewBattery({});
    setShowAddBattery(false);
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (await bestaetige('Drohne wirklich löschen?', { gefaehrlich: true })) {
      await dbService.deleteDrone(id);
      onUpdate();
    }
  };

  const handleDeleteBattery = async (id: string) => {
    if (await bestaetige('Akku wirklich löschen?', { gefaehrlich: true })) {
      await dbService.deleteBattery(id);
      onUpdate();
    }
  };

  return (
    <div className="max-w-md lg:max-w-3xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand-blue">{t('view.flotte')}</h2>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">Drohnen Management</p>
        </div>
        <button 
          onClick={() => {
            if (showAdd && editingDroneId) {
              setEditingDroneId(null);
              setNewDrone({});
            } else {
              setShowAdd(!showAdd);
            }
          }}
          className="bg-brand-blue text-white p-2.5 rounded-2xl shadow-lg shadow-brand-blue/20 transition-transform active:scale-95"
        >
          {showAdd ? <XCircle className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {/* Prominent Maintenance Dashboard Summary */}
      {drones.some(d => getMaintenanceAlerts(d.id).length > 0) && (
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8 p-5 bg-gradient-to-br from-amber-500 to-brand-orange rounded-[32px] shadow-xl shadow-brand-orange/20 text-white overflow-hidden relative"
        >
          <div className="absolute top-[-20%] right-[-10%] opacity-10 rotate-12">
            <Wrench className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <BadgeAlert className="w-5 h-5 text-white animate-bounce" />
              <h3 className="font-black text-xs uppercase tracking-[0.2em]">Wartung erforderlich</h3>
            </div>
            <p className="text-sm font-medium opacity-90 mb-4">Mehrere Drohnen benötigen Aufmerksamkeit für sicheren Flugbetrieb.</p>
            <div className="flex flex-wrap gap-2">
              {drones.filter(d => getMaintenanceAlerts(d.id).length > 0).map(d => (
                <button 
                  key={d.id}
                  onClick={() => setSelectedDroneId(d.id)}
                  className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/30 transition-all border border-white/10"
                >
                  {d.model} ({getMaintenanceAlerts(d.id).length})
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">
                {editingDroneId ? 'Drohne bearbeiten' : 'Neue Drohne registrieren'}
              </h3>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Modell / Name</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                  placeholder="z.B. DJI Mini 4 Pro"
                  value={newDrone.model || ''}
                  onChange={e => setNewDrone({...newDrone, model: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Gewicht (g)</label>
                  <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" placeholder="249" value={newDrone.weight || ''} onChange={e => setNewDrone({...newDrone, weight: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">C-Klasse</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={newDrone.uasClass || 'Legacy'} onChange={e => setNewDrone({...newDrone, uasClass: e.target.value as UASClass})}>
                    <option value="C0">C0 (&lt; 250g)</option>
                    <option value="C1">C1 (&lt; 900g)</option>
                    <option value="C2">C2 (&lt; 4kg)</option>
                    <option value="C3">C3 (&lt; 25kg)</option>
                    <option value="C4">C4 (Flugmodelle)</option>
                    <option value="Legacy">Bestandsdrohne</option>
                    <option value="Self-built">Eigenbau</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Seriennummer</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" placeholder="SN123..." value={newDrone.serialNumber || ''} onChange={e => setNewDrone({...newDrone, serialNumber: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Firmware Version</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" placeholder="v01.00..." value={newDrone.firmwareVersion || ''} onChange={e => setNewDrone({...newDrone, firmwareVersion: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">LBA e-ID (Optional)</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" placeholder="DEU..." value={newDrone.eId || ''} onChange={e => setNewDrone({...newDrone, eId: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Spezielle Versicherung</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                    placeholder="Nur falls abweichend"
                    value={newDrone.insuranceNumber || ''}
                    onChange={e => setNewDrone({...newDrone, insuranceNumber: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Max. Windgrenze (km/h)</label>
                <input
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                  placeholder="z.B. 28 (leer = Standard 28 km/h)"
                  value={newDrone.maxWindSpeed || ''}
                  onChange={e => setNewDrone({...newDrone, maxWindSpeed: e.target.value ? Number(e.target.value) : undefined})}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Garantie bis</label>
                  <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                    value={newDrone.warrantyUntil?.slice(0,10) || ''}
                    onChange={e => setNewDrone({...newDrone, warrantyUntil: e.target.value || undefined})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Kaufdatum</label>
                  <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                    value={newDrone.purchaseDate?.slice(0,10) || ''}
                    onChange={e => setNewDrone({...newDrone, purchaseDate: e.target.value || undefined})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Wartung alle (Tage)</label>
                  <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" placeholder="z.B. 180"
                    value={newDrone.maintenanceIntervalDays || ''}
                    onChange={e => setNewDrone({...newDrone, maintenanceIntervalDays: e.target.value ? Number(e.target.value) : undefined})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Wartung alle (Std.)</label>
                  <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" placeholder="z.B. 50"
                    value={newDrone.maintenanceIntervalHours || ''}
                    onChange={e => setNewDrone({...newDrone, maintenanceIntervalHours: e.target.value ? Number(e.target.value) : undefined})} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Drohnen-Foto (optional)</label>
                {newDrone.photoUrl ? (
                  <div className="relative">
                    <img src={newDrone.photoUrl} alt="Vorschau" className="w-full h-28 object-cover rounded-xl border border-slate-200" />
                    <button onClick={() => setNewDrone({...newDrone, photoUrl: undefined})} className="absolute top-2 right-2 bg-brand-red text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">✕</button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <Camera className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400">Foto aufnehmen oder hochladen</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => setNewDrone({...newDrone, photoUrl: ev.target?.result as string});
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                )}
              </div>
              <button
                onClick={handleAdd}
                className="w-full bg-brand-blue text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-blue/20 active:scale-95 transition-all text-sm"
              >
                {editingDroneId ? 'Änderungen speichern' : 'Drohne registrieren'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3 mb-10">
        {drones.map(drone => {
          const droneFlights = flights.filter(f => f.droneId === drone.id);
          const stats = droneStats[drone.id] || { hours: 0, flights: 0, lastMaint: {} };
          const totalMinutes = droneFlights.reduce((acc, f) => acc + (f.duration || 0), 0);
          const hours = Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;
          const wStatus = wartungStatus(drone, droneFlights, alleWartungen);
          const gStatus = garantieStatus(drone);
          const wartungsKosten = gesamtKosten(alleWartungen, drone.id);

          return (
            <div key={drone.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-blue/5 flex items-center justify-center border border-brand-blue/10 overflow-hidden shrink-0">
                  {drone.photoUrl
                    ? <img src={drone.photoUrl} alt={drone.model} className="w-full h-full object-cover" />
                    : <Plane className="w-6 h-6 text-brand-blue" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{drone.model}</h3>
                  <div className="flex flex-wrap items-center gap-x-2 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>{drone.uasClass || 'Legacy'}</span>
                    <span>&bull; {drone.weight}g</span>
                    {drone.serialNumber && <span>&bull; SN: {drone.serialNumber}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-brand-blue font-black uppercase tracking-tighter flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {hours}h {mins}m Flugzeit
                    </p>
                    {drone.firmwareVersion && (
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        &bull; FW: {drone.firmwareVersion}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                      &bull; {droneFlights.length} Flüge
                    </p>
                  </div>

                  {/* Wartung / Garantie / Kosten */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {wStatus.level !== 'ok' && (
                      <span className={cn(
                        'text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1',
                        wStatus.level === 'alert' ? 'bg-brand-red/10 text-brand-red' : 'bg-amber-50 text-amber-600'
                      )} title={wStatus.gruende.join(' ')}>
                        <Wrench className="w-2.5 h-2.5" /> Wartung {wStatus.level === 'alert' ? 'fällig' : 'bald'}
                      </span>
                    )}
                    {gStatus.status === 'aktiv' && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-green/10 text-brand-green">
                        Garantie {gStatus.tage}d
                      </span>
                    )}
                    {gStatus.status === 'bald' && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                        Garantie endet in {gStatus.tage}d
                      </span>
                    )}
                    {gStatus.status === 'abgelaufen' && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                        Garantie abgelaufen
                      </span>
                    )}
                    {wartungsKosten > 0 && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex items-center gap-1">
                        <span className="text-brand-blue">€</span> {wartungsKosten.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <button 
                      onClick={async () => {
                        const statsForDrone = droneStats[drone.id];
                        const record: MaintenanceRecord = {
                          id: crypto.randomUUID(),
                          droneId: drone.id,
                          date: new Date().toISOString().split('T')[0],
                          type: 'Motor',
                          description: 'Motoren gereinigt (Benutzer-Schnellaktion)',
                          hoursAtMaintenance: statsForDrone?.hours || 0,
                          createdAt: Date.now()
                        };
                        await dbService.saveMaintenance(record);
                        onUpdate();
                      }}
                      className="text-[8px] font-black uppercase tracking-widest text-brand-blue bg-brand-blue/5 px-2 py-1 rounded hover:bg-brand-blue hover:text-white transition-all flex items-center gap-1"
                    >
                      <Sparkles className="w-2 h-2" /> Motoren reinigen
                    </button>
                    {stats.lastMaint['Motor'] && (
                      <span className="text-[8px] text-slate-400 font-bold uppercase">Zuletzt: {new Date(stats.lastMaint['Motor']).toLocaleDateString('de-DE')}</span>
                    )}
                  </div>
                  
                  {getMaintenanceAlerts(drone.id).length > 0 && (
                    <div className="mt-4 space-y-3 p-4 bg-white border-2 border-amber-100 rounded-3xl shadow-sm relative overflow-hidden group/alert">
                       <div className="absolute top-0 right-0 p-3 opacity-5 group-hover/alert:opacity-10 transition-opacity">
                        <Wrench className="w-12 h-12" />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                          <BadgeAlert className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Sicherheits-Check fällig</span>
                      </div>
                      <div className="space-y-2">
                        {getMaintenanceAlerts(drone.id).map((alert: any, idx) => (
                          <div key={idx} className="flex flex-col gap-1 bg-amber-50/50 p-2 rounded-xl border border-amber-100/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                                <span className="text-[9px] font-black text-slate-800 uppercase tracking-tight">{alert.reason}</span>
                              </div>
                              <span className="text-[7px] font-black text-white bg-amber-500 px-2 py-0.5 rounded-full uppercase">{alert.type}</span>
                            </div>
                            <p className="text-[9px] text-slate-500 leading-tight font-medium pl-3.5">{alert.detail}</p>
                          </div>
                        ))}
                      </div>
                      <button 
                        onClick={() => setSelectedDroneId(drone.id)}
                        className="w-full mt-2 py-2 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-blue transition-colors shadow-lg shadow-slate-900/10 active:scale-[0.98]"
                      >
                        Wartung protokollieren
                      </button>
                    </div>
                  )}
                </div>
              </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => handleEditDrone(drone)}
                className="p-2 text-slate-300 hover:text-brand-blue active:scale-95 transition-all"
                title="Bearbeiten"
              >
                <Settings2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setSelectedDroneId(drone.id)}
                className="p-2 text-slate-300 hover:text-brand-orange active:scale-95 transition-all"
                title="Wartung"
              >
                <Wrench className="w-4 h-4" />
              </button>
              <button 
                onClick={() => handleDelete(drone.id)}
                className="p-2 text-slate-300 hover:text-brand-red active:scale-90 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
      </div>

      {/* Maintenance Sheet Overlay */}
      <AnimatePresence>
        {selectedDroneId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedDroneId(null)}
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] shadow-2xl p-6 relative flex flex-col max-h-[85vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-6 sm:hidden" />
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Wartungshistorie</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {drones.find(d => d.id === selectedDroneId)?.model}
                  </p>
                </div>
                <button 
                  onClick={() => setShowMaintForm(!showMaintForm)}
                  className="p-2 bg-brand-orange/10 text-brand-orange rounded-xl active:scale-90 transition-all font-bold text-xs flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Neu
                </button>
              </div>

              {/* Bauteil-Verschleiß Übersicht */}
              {selectedDroneId && droneStats[selectedDroneId] && (() => {
                const s = droneStats[selectedDroneId];
                const parts = [
                  { label: 'Propeller', limit: 50, since: s.flightsSinceMaint?.['Propeller'] ?? s.flights },
                  { label: 'Motor', limit: 100, since: s.flightsSinceMaint?.['Motor'] ?? s.flights },
                  { label: 'Sensor', limit: 200, since: s.flightsSinceMaint?.['Sensor'] ?? s.flights },
                ];
                return (
                  <div className="mb-6 p-4 bg-white border border-slate-100 rounded-2xl space-y-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bauteil-Verschleiß</p>
                    {parts.map(p => {
                      const pct = Math.min(100, Math.round((p.since / p.limit) * 100));
                      const color = pct >= 100 ? '#ef4444' : pct >= 75 ? '#f97316' : '#10b981';
                      return (
                        <div key={p.label}>
                          <div className="flex justify-between mb-1">
                            <span className="text-[10px] font-bold text-slate-700">{p.label}</span>
                            <span className="text-[10px] font-bold" style={{ color }}>{p.since}/{p.limit} Flüge</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {selectedDroneId && getMaintenanceAlerts(selectedDroneId).length > 0 && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Empfohlene Wartung</span>
                  </div>
                  <div className="space-y-1.5">
                    {getMaintenanceAlerts(selectedDroneId).map((alert, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-800">{alert.type}</span>
                        <span className="text-[9px] font-medium text-amber-600/80">{alert.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showMaintForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mb-6 space-y-4 bg-slate-50 p-4 rounded-3xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Typ</label>
                      <select 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                        value={newMaint.type}
                        onChange={e => setNewMaint({...newMaint, type: e.target.value as any})}
                      >
                        <option value="Propeller">Propeller</option>
                        <option value="Firmware">Firmware</option>
                        <option value="Motor">Motor</option>
                        <option value="Sensor">Sensoren</option>
                        <option value="General">Allgemein</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Beschreibung</label>
                      <input
                        type="text"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                        placeholder="Z.B. Propeller-Set A getauscht"
                        value={newMaint.description || ''}
                        onChange={e => setNewMaint({...newMaint, description: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Kosten (€, optional)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                        placeholder="z.B. 49.90"
                        value={newMaint.cost ?? ''}
                        onChange={e => setNewMaint({...newMaint, cost: e.target.value ? Number(e.target.value) : undefined})}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddMaint}
                    className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all"
                  >
                    {t('wartung.eintragHinzufuegen')}
                  </button>
                </motion.div>
              )}

              <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1 scrollbar-hide shrink-0">
                {['All', 'Propeller', 'Firmware', 'Motor', 'Sensor', 'General'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setMaintFilter(type as any)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight whitespace-nowrap transition-all",
                      maintFilter === type 
                        ? "bg-brand-orange text-white" 
                        : "bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-200/50"
                    )}
                  >
                    {type === 'All' ? 'Alle Typen' : type}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide shrink-0 border-b border-slate-50">
                {[
                  { id: 'All', label: 'Alle' },
                  { id: '30Days', label: 'Letzte 30 Tage' },
                  { id: '3Months', label: 'Letzte 3 Monate' },
                  { id: '1Year', label: 'Letztes Jahr' }
                ].map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setDateFilter(range.id as any)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-1.5",
                      dateFilter === range.id 
                        ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10" 
                        : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"
                    )}
                  >
                    <Calendar className="w-3 h-3 translate-y-[-0.5px]" />
                    {range.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                {filteredMaintenance.length === 0 ? (
                  <div className="text-center py-10 opacity-30">
                    <Wrench className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-xs font-bold">Keine Einträge für diesen Filter</p>
                  </div>
                ) : (
                  filteredMaintenance.map(item => (
                    <div key={item.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-orange/5 flex items-center justify-center border border-brand-orange/10">
                          <Settings2 className="w-4 h-4 text-brand-orange" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-[11px]">{item.description}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black text-slate-400 uppercase border border-slate-100 px-1 rounded">{item.type}</span>
                            <span className="text-[8px] text-slate-300 font-mono">{item.date}</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={async () => {
                          await dbService.deleteMaintenance(item.id);
                          const updated = await dbService.getMaintenance(selectedDroneId);
                          setMaintenance(updated);
                        }}
                        className="p-1 text-slate-100 hover:text-brand-red opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button 
                onClick={() => setSelectedDroneId(null)}
                className="w-full bg-slate-50 text-slate-600 font-bold py-3 rounded-2xl mt-6 text-xs active:scale-95 transition-all border border-slate-200"
              >
                Schließen
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-6 pt-4 border-t border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand-blue">{t('view.akkus')}</h2>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">Inventar & Zyklen</p>
        </div>
        <button 
          onClick={() => setShowAddBattery(!showAddBattery)}
          className="bg-brand-blue text-white p-2.5 rounded-2xl shadow-lg shadow-brand-blue/20 transition-transform active:scale-95"
        >
          {showAddBattery ? <XCircle className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {showAddBattery && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Akku Nummer / Name</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                  placeholder="z.B. Akku #1"
                  value={newBattery.number || ''}
                  onChange={e => setNewBattery({...newBattery, number: e.target.value})}
                />
              </div>
              <button 
                onClick={handleAddBattery}
                className="w-full bg-brand-blue text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-blue/20 active:scale-95 transition-all text-sm"
              >
                Akku Registrieren
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-3">
        {batteries.map(battery => {
          const cycles = battery.cycles || 0;
          // Erfasster SOH, sonst aus Zyklen geschätzt (0,15 %/Zyklus, Boden 60 %).
          const health = effektiveGesundheit(battery);

          return (
            <div key={battery.id}
              onClick={() => setDetailBattery(battery)}
              className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm relative group overflow-hidden cursor-pointer active:scale-[0.98] transition-transform">
              {/* Proportional Health Bar */}
              <div 
                className={cn(
                   "absolute bottom-0 left-0 h-1.5 transition-all duration-700",
                   health < 50 ? "bg-brand-red" : health < 80 ? "bg-amber-400" : "bg-brand-green"
                )} 
                style={{ width: `${health}%` }}
              />
              
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center border",
                    health < 50 ? "bg-red-50 border-red-100 text-brand-red" : 
                    health < 80 ? "bg-amber-50 border-amber-100 text-amber-500" : 
                    "bg-emerald-50 border-emerald-100 text-brand-green"
                  )}>
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs">{battery.number}</h3>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{cycles} Zyklen</p>
                  </div>
                </div>
                <span className={cn(
                  "text-[8px] font-black uppercase px-2 py-1 rounded-lg border",
                  health < 50 ? "bg-brand-red/5 border-brand-red/10 text-brand-red" : 
                  health < 80 ? "bg-amber-500/5 border-amber-500/10 text-amber-600" : 
                  "bg-brand-green/5 border-brand-green/10 text-brand-green"
                )}>
                  {health > 80 ? 'Exzellent' : health > 50 ? 'Gut' : 'Verschlissen'}
                </span>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <div className="flex items-baseline gap-1">
                    <p className={cn(
                      "text-2xl font-black transition-colors",
                      health < 30 ? "text-brand-red" : "text-slate-900"
                    )}>{health}%</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">SOH</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteBattery(battery.id); }}
                  className="p-1.5 text-slate-200 hover:text-brand-red active:scale-90 opacity-0 group-hover:opacity-100 transition-all mb-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {detailBattery && (
        <BatteryDetailDialog
          battery={detailBattery}
          onClose={() => setDetailBattery(null)}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}
