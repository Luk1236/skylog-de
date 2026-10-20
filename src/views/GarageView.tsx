import { useState, useEffect, useMemo } from 'react';
import {
  BadgeAlert, Calendar, Camera, Clock, Plane, Plus, Settings2,
  ShieldAlert, Sparkles, Trash2, Wrench, X, XCircle, Zap,
} from 'lucide-react';
import {
  dbService, type Drone, type Battery, type MaintenanceRecord,
  type Flight, type UASClass,
} from '../services/db';
import { zeigeRueckgaengig } from '../services/rueckgaengig';
import { wartungStatus, garantieStatus, gesamtKosten } from '../services/maintenance';
import { effektiveGesundheit } from '../services/batteryHealth';
import { cn } from '../lib/utils';
import { useSprache } from '../lib/sprache';
import { BatteryDetailDialog } from '../components/lazyDialogs';
import { Dialog, Knopf, IconKnopf, Feld, eingabe, SeitenKopf } from '../components/ui';

export function GarageView({ drones, flights, batteries, onUpdate }: { drones: Drone[], flights: Flight[], batteries: Battery[], onUpdate: () => void }) {
  const { t, tx } = useSprache();
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
      type: newMaint.type ?? 'General',
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

  // Sofort löschen, ein paar Sekunden „Rückgängig“ anbieten (statt vorher zu fragen).
  const handleDelete = async (id: string) => {
    const drohne = drones.find(d => d.id === id);
    await dbService.deleteDrone(id);
    onUpdate();
    if (drohne) zeigeRueckgaengig(tx(`${drohne.model} gelöscht`, `${drohne.model} deleted`), async () => {
      await dbService.saveDrone(drohne);
      onUpdate();
    });
  };

  const handleDeleteBattery = async (id: string) => {
    const akku = batteries.find(b => b.id === id);
    await dbService.deleteBattery(id);
    onUpdate();
    if (akku) zeigeRueckgaengig(tx(`Akku ${akku.number} gelöscht`, `Battery ${akku.number} deleted`), async () => {
      await dbService.saveBattery(akku);
      onUpdate();
    });
  };

  return (
    <div className="max-w-md lg:max-w-3xl mx-auto pb-20">
      <SeitenKopf
        titel={t('view.flotte')}
        untertitel={tx('Drohnen-Management', 'Drone management')}
        aktionen={
        <button 
          onClick={() => {
            if (showAdd && editingDroneId) {
              setEditingDroneId(null);
              setNewDrone({});
            } else {
              setShowAdd(!showAdd);
            }
          }}
          aria-label={showAdd ? tx('Abbrechen', 'Cancel') : tx('Drohne hinzufügen', 'Add drone')}
          className="bg-brand-blue text-white p-2.5 rounded-2xl shadow-lg shadow-brand-blue/20 transition-transform active:scale-95"
        >
          {showAdd ? <XCircle className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
        }
      />

      {/* Sammelhinweis: welche Drohnen Wartung brauchen */}
      {drones.some(d => getMaintenanceAlerts(d.id).length > 0) && (
        <div
          className="ansicht-blenden mb-6 p-4 bg-amber-50 border border-amber-200 rounded-3xl">
          <div className="flex items-center gap-2 mb-1">
            <BadgeAlert className="w-4 h-4 text-amber-800" />
            <h3 className="text-sm font-bold text-amber-800">{tx('Wartung erforderlich', 'Maintenance required')}</h3>
          </div>
          <p className="text-xs text-slate-700 mb-3">{tx('Mehrere Drohnen benötigen Aufmerksamkeit für sicheren Flugbetrieb.', 'Several drones need attention for safe operation.')}</p>
          <div className="flex flex-wrap gap-2">
            {drones.filter(d => getMaintenanceAlerts(d.id).length > 0).map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedDroneId(d.id)}
                className="h-10 px-3 rounded-xl bg-white border border-amber-200 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors"
              >
                {d.model} ({getMaintenanceAlerts(d.id).length})
              </button>
            ))}
          </div>
        </div>
      )}
        {showAdd && (
          <div
            className="ansicht-blenden overflow-hidden mb-6">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-black text-slate-900">
                {editingDroneId ? tx('Drohne bearbeiten', 'Edit drone') : tx('Neue Drohne registrieren', 'Register new drone')}
              </h3>
              <Feld label={tx('Modell / Name', 'Model / name')} htmlFor="dr-modell">
                <input
                  id="dr-modell"
                  type="text"
                  className={eingabe}
                  placeholder={tx('z.B. DJI Mini 4 Pro', 'e.g. DJI Mini 4 Pro')}
                  value={newDrone.model || ''}
                  onChange={e => setNewDrone({...newDrone, model: e.target.value})}
                />
              </Feld>
              <div className="grid grid-cols-2 gap-3">
                <Feld label={tx('Gewicht (g)', 'Weight (g)')} htmlFor="dr-gewicht">
                  <input id="dr-gewicht" type="number" className={eingabe} placeholder="249" value={newDrone.weight || ''} onChange={e => setNewDrone({...newDrone, weight: Number(e.target.value)})} />
                </Feld>
                <Feld label={tx('C-Klasse', 'C class')} htmlFor="dr-klasse">
                  <select id="dr-klasse" className={eingabe} value={newDrone.uasClass || 'Legacy'} onChange={e => setNewDrone({...newDrone, uasClass: e.target.value as UASClass})}>
                    <option value="C0">C0 (&lt; 250g)</option>
                    <option value="C1">C1 (&lt; 900g)</option>
                    <option value="C2">C2 (&lt; 4kg)</option>
                    <option value="C3">C3 (&lt; 25kg)</option>
                    <option value="C4">{tx('C4 (Flugmodelle)', 'C4 (model aircraft)')}</option>
                    <option value="Legacy">{tx('Bestandsdrohne', 'Legacy drone')}</option>
                    <option value="Self-built">{tx('Eigenbau', 'Self-built')}</option>
                  </select>
                </Feld>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Feld label={tx('Seriennummer', 'Serial number')} htmlFor="dr-sn">
                  <input id="dr-sn" type="text" className={eingabe} placeholder="SN123..." value={newDrone.serialNumber || ''} onChange={e => setNewDrone({...newDrone, serialNumber: e.target.value})} />
                </Feld>
                <Feld label={tx('Firmware Version', 'Firmware version')} htmlFor="dr-fw">
                  <input id="dr-fw" type="text" className={eingabe} placeholder="v01.00..." value={newDrone.firmwareVersion || ''} onChange={e => setNewDrone({...newDrone, firmwareVersion: e.target.value})} />
                </Feld>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Feld label={tx('LBA e-ID (Optional)', 'LBA e-ID (optional)')} htmlFor="dr-eid">
                  <input id="dr-eid" type="text" className={eingabe} placeholder="DEU..." value={newDrone.eId || ''} onChange={e => setNewDrone({...newDrone, eId: e.target.value})} />
                </Feld>
                <Feld label={tx('Spezielle Versicherung', 'Separate insurance')} htmlFor="dr-vers">
                  <input
                    id="dr-vers"
                    type="text"
                    className={eingabe}
                    placeholder={tx('Nur falls abweichend', 'Only if different')}
                    value={newDrone.insuranceNumber || ''}
                    onChange={e => setNewDrone({...newDrone, insuranceNumber: e.target.value})}
                  />
                </Feld>
              </div>
              <Feld label={tx('Max. Windgrenze (km/h)', 'Max. wind limit (km/h)')} htmlFor="dr-wind">
                <input
                  id="dr-wind"
                  type="number"
                  className={eingabe}
                  placeholder={tx('z.B. 28 (leer = Standard 28 km/h)', 'e.g. 28 (empty = default 28 km/h)')}
                  value={newDrone.maxWindSpeed || ''}
                  onChange={e => setNewDrone({...newDrone, maxWindSpeed: e.target.value ? Number(e.target.value) : undefined})}
                />
              </Feld>
              <div className="grid grid-cols-2 gap-3">
                <Feld label={tx('Garantie bis', 'Warranty until')} htmlFor="dr-garantie">
                  <input id="dr-garantie" type="date" className={eingabe}
                    value={newDrone.warrantyUntil?.slice(0,10) || ''}
                    onChange={e => setNewDrone({...newDrone, warrantyUntil: e.target.value || undefined})} />
                </Feld>
                <Feld label={tx('Kaufdatum', 'Purchase date')} htmlFor="dr-kauf">
                  <input id="dr-kauf" type="date" className={eingabe}
                    value={newDrone.purchaseDate?.slice(0,10) || ''}
                    onChange={e => setNewDrone({...newDrone, purchaseDate: e.target.value || undefined})} />
                </Feld>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Feld label={tx('Wartung alle (Tage)', 'Maintenance every (days)')} htmlFor="dr-tage">
                  <input id="dr-tage" type="number" className={eingabe} placeholder={tx('z.B. 180', 'e.g. 180')}
                    value={newDrone.maintenanceIntervalDays || ''}
                    onChange={e => setNewDrone({...newDrone, maintenanceIntervalDays: e.target.value ? Number(e.target.value) : undefined})} />
                </Feld>
                <Feld label={tx('Wartung alle (Std.)', 'Maintenance every (hours)')} htmlFor="dr-std">
                  <input id="dr-std" type="number" className={eingabe} placeholder={tx('z.B. 50', 'e.g. 50')}
                    value={newDrone.maintenanceIntervalHours || ''}
                    onChange={e => setNewDrone({...newDrone, maintenanceIntervalHours: e.target.value ? Number(e.target.value) : undefined})} />
                </Feld>
              </div>
              <Feld label={tx('Drohnen-Foto (optional)', 'Drone photo (optional)')}>
                {newDrone.photoUrl ? (
                  <div className="relative">
                    <img src={newDrone.photoUrl} alt={tx('Vorschau', 'Preview')} className="w-full h-28 object-cover rounded-xl border border-slate-200" />
                    <IconKnopf
                      icon={X}
                      variante="sekundaer"
                      aria-label={tx('Foto entfernen', 'Remove photo')}
                      onClick={() => setNewDrone({...newDrone, photoUrl: undefined})}
                      className="absolute top-2 right-2 shadow-sm"
                    />
                  </div>
                ) : (
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <Camera className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-500">{tx('Foto aufnehmen oder hochladen', 'Take or upload a photo')}</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => setNewDrone({...newDrone, photoUrl: ev.target?.result as string});
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                )}
              </Feld>
              <Knopf voll onClick={handleAdd}>
                {editingDroneId ? tx('Änderungen speichern', 'Save changes') : tx('Drohne registrieren', 'Register drone')}
              </Knopf>
            </div>
          </div>
        )}

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
          const hinweise = getMaintenanceAlerts(drone.id);

          return (
            <div key={drone.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
              {/* Kopf: Bild, Name, Aktionen */}
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-brand-blue/5 flex items-center justify-center border border-brand-blue/10 overflow-hidden shrink-0">
                  {drone.photoUrl
                    ? <img src={drone.photoUrl} alt={drone.model} className="w-full h-full object-cover" />
                    : <Plane className="w-5 h-5 text-brand-blue" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{drone.model}</h3>
                  <p className="text-xs text-slate-500 truncate">
                    {drone.uasClass || 'Legacy'} · {drone.weight} g{drone.serialNumber && ` · SN ${drone.serialNumber}`}
                  </p>
                </div>
                <div className="flex -mr-2 -mt-1">
                  <IconKnopf icon={Settings2} aria-label={tx('Bearbeiten', 'Edit')} onClick={() => handleEditDrone(drone)} />
                  <IconKnopf icon={Wrench} aria-label={tx('Wartung', 'Maintenance')} onClick={() => setSelectedDroneId(drone.id)} />
                  <IconKnopf icon={Trash2} variante="gefahr" aria-label={tx('Löschen', 'Delete')} onClick={() => handleDelete(drone.id)} />
                </div>
              </div>

              {/* Kennzahlen */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-slate-600">
                <span className="flex items-center gap-1 font-bold text-brand-blue">
                  <Clock className="w-3.5 h-3.5" /> {hours} h {mins} min
                </span>
                <span>{droneFlights.length} {tx('Flüge', 'Flights')}</span>
                {drone.firmwareVersion && <span>FW {drone.firmwareVersion}</span>}
              </div>

              {/* Wartung / Garantie / Kosten */}
              {(wStatus.level !== 'ok' || gStatus.status !== 'keine' || wartungsKosten > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {wStatus.level !== 'ok' && (
                    <span className={cn(
                      'text-2xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1',
                      wStatus.level === 'alert' ? 'bg-red-50 text-brand-red' : 'bg-amber-50 text-amber-800'
                    )} title={wStatus.gruende.join(' ')}>
                      <Wrench className="w-3 h-3" /> {tx('Wartung', 'Maintenance')} {wStatus.level === 'alert' ? tx('fällig', 'due') : tx('bald', 'soon')}
                    </span>
                  )}
                  {gStatus.status === 'aktiv' && (
                    <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-brand-green">
                      {tx('Garantie', 'Warranty')} {gStatus.tage} {tx('Tage', 'days')}
                    </span>
                  )}
                  {gStatus.status === 'bald' && (
                    <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">
                      {tx('Garantie endet in', 'Warranty ends in')} {gStatus.tage} {tx('Tagen', 'days')}
                    </span>
                  )}
                  {gStatus.status === 'abgelaufen' && (
                    <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {tx('Garantie abgelaufen', 'Warranty expired')}
                    </span>
                  )}
                  {wartungsKosten > 0 && (
                    <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {wartungsKosten.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Knopf
                  variante="sekundaer"
                  groesse="sm"
                  icon={Sparkles}
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
                >
                  {tx('Motoren reinigen', 'Clean motors')}
                </Knopf>
                {stats.lastMaint['Motor'] && (
                  <span className="text-xs text-slate-500">{tx('Zuletzt:', 'Last:')} {new Date(stats.lastMaint['Motor']).toLocaleDateString('de-DE')}</span>
                )}
              </div>

              {hinweise.length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <BadgeAlert className="w-4 h-4 text-amber-800" />
                    <span className="text-xs font-bold text-amber-800">{tx('Sicherheits-Check fällig', 'Safety check due')}</span>
                  </div>
                  {hinweise.map((alert, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">{alert.reason}</span>
                        <span className="text-2xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">{alert.type}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{alert.detail}</p>
                    </div>
                  ))}
                  <Knopf groesse="sm" voll onClick={() => setSelectedDroneId(drone.id)}>
                    {tx('Wartung protokollieren', 'Log maintenance')}
                  </Knopf>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Wartungshistorie einer Drohne */}
      {selectedDroneId && (
        <Dialog
          titel={tx('Wartungshistorie', 'Maintenance history')}
          untertitel={drones.find(d => d.id === selectedDroneId)?.model}
          icon={Wrench}
          ton="bernstein"
          onClose={() => setSelectedDroneId(null)}
          kopfAktionen={
            <Knopf variante="sekundaer" groesse="sm" icon={showMaintForm ? X : Plus} onClick={() => setShowMaintForm(!showMaintForm)}>
              {showMaintForm ? tx('Abbrechen', 'Cancel') : tx('Neu', 'New')}
            </Knopf>
          }
        >
          {/* Bauteil-Verschleiß Übersicht */}
          {droneStats[selectedDroneId] && (() => {
            const s = droneStats[selectedDroneId];
            const parts = [
              { label: 'Propeller', limit: 50, since: s.flightsSinceMaint?.['Propeller'] ?? s.flights },
              { label: 'Motor', limit: 100, since: s.flightsSinceMaint?.['Motor'] ?? s.flights },
              { label: 'Sensor', limit: 200, since: s.flightsSinceMaint?.['Sensor'] ?? s.flights },
            ];
            return (
              <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{tx('Bauteil-Verschleiß', 'Component wear')}</p>
                {parts.map(p => {
                  const pct = Math.min(100, Math.round((p.since / p.limit) * 100));
                  const farbe = pct >= 100
                    ? { text: 'text-brand-red', balken: 'bg-brand-red' }
                    : pct >= 75
                      ? { text: 'text-brand-orange', balken: 'bg-brand-orange' }
                      : { text: 'text-brand-green', balken: 'bg-brand-green' };
                  return (
                    <div key={p.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-bold text-slate-700">{p.label}</span>
                        <span className={cn('text-xs font-bold', farbe.text)}>{p.since}/{p.limit} {tx('Flüge', 'Flights')}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div className={cn('h-1.5 rounded-full transition-all', farbe.balken)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {getMaintenanceAlerts(selectedDroneId).length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-amber-800" />
                <span className="text-xs font-bold text-amber-800">{tx('Empfohlene Wartung', 'Recommended maintenance')}</span>
              </div>
              <div className="space-y-1.5">
                {getMaintenanceAlerts(selectedDroneId).map((alert, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-800">{alert.type}</span>
                    <span className="text-xs text-slate-700 text-right">{alert.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showMaintForm && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="grid grid-cols-2 gap-3">
                <Feld label={tx('Typ', 'Type')} htmlFor="wt-typ">
                  <select
                    id="wt-typ"
                    className={eingabe}
                    value={newMaint.type}
                    onChange={e => setNewMaint({...newMaint, type: e.target.value as MaintenanceRecord['type']})}
                  >
                    <option value="Propeller">Propeller</option>
                    <option value="Firmware">Firmware</option>
                    <option value="Motor">{tx('Motor', 'Motor')}</option>
                    <option value="Sensor">{tx('Sensoren', 'Sensors')}</option>
                    <option value="General">{tx('Allgemein', 'General')}</option>
                  </select>
                </Feld>
                <Feld label={tx('Kosten (€, optional)', 'Cost (€, optional)')} htmlFor="wt-kosten">
                  <input
                    id="wt-kosten"
                    type="number"
                    className={eingabe}
                    placeholder={tx('z.B. 49.90', 'e.g. 49.90')}
                    value={newMaint.cost ?? ''}
                    onChange={e => setNewMaint({...newMaint, cost: e.target.value ? Number(e.target.value) : undefined})}
                  />
                </Feld>
              </div>
              <Feld label={tx('Beschreibung', 'Description')} htmlFor="wt-text">
                <input
                  id="wt-text"
                  type="text"
                  className={eingabe}
                  placeholder={tx('Z.B. Propeller-Set A getauscht', 'E.g. replaced propeller set A')}
                  value={newMaint.description || ''}
                  onChange={e => setNewMaint({...newMaint, description: e.target.value})}
                />
              </Feld>
              <Knopf voll onClick={handleAddMaint}>{t('wartung.eintragHinzufuegen')}</Knopf>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {(['All', 'Propeller', 'Firmware', 'Motor', 'Sensor', 'General'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setMaintFilter(type)}
                  className={cn(
                    'h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap transition-colors',
                    maintFilter === type ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {type === 'All' ? tx('Alle Typen', 'All types') : type}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {([
                { id: 'All', label: tx('Alle', 'All') },
                { id: '30Days', label: tx('Letzte 30 Tage', 'Last 30 days') },
                { id: '3Months', label: tx('Letzte 3 Monate', 'Last 3 months') },
                { id: '1Year', label: tx('Letztes Jahr', 'Last year') },
              ] as const).map((range) => (
                <button
                  key={range.id}
                  onClick={() => setDateFilter(range.id)}
                  className={cn(
                    'h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5',
                    dateFilter === range.id ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  <Calendar className="w-3 h-3" />
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredMaintenance.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Wrench className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold">{tx('Keine Einträge für diesen Filter', 'No entries for this filter')}</p>
              </div>
            ) : (
              filteredMaintenance.map(item => (
                <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 group">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <Settings2 className="w-4 h-4 text-amber-800" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{item.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-2xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{item.type}</span>
                      <span className="text-xs text-slate-500">{item.date}</span>
                    </div>
                  </div>
                  <IconKnopf
                    icon={Trash2}
                    variante="gefahr"
                    aria-label={tx('Eintrag löschen', 'Delete entry')}
                    className="sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={async () => {
                      // Wartungseinträge wurden früher ohne Rückfrage endgültig gelöscht.
                      const drohnenId = selectedDroneId;
                      await dbService.deleteMaintenance(item.id);
                      setMaintenance(await dbService.getMaintenance(drohnenId));
                      zeigeRueckgaengig(tx('Wartungseintrag gelöscht', 'Maintenance entry deleted'), async () => {
                        await dbService.saveMaintenance(item);
                        setMaintenance(await dbService.getMaintenance(drohnenId));
                      });
                    }}
                  />
                </div>
              ))
            )}
          </div>
        </Dialog>
      )}

      <div className="pt-6 border-t border-slate-200">
        <SeitenKopf
          titel={t('view.akkus')}
          untertitel={tx('Inventar & Zyklen', 'Inventory & cycles')}
          aktionen={
            <button
              onClick={() => setShowAddBattery(!showAddBattery)}
              aria-label={showAddBattery ? tx('Abbrechen', 'Cancel') : tx('Akku hinzufügen', 'Add battery')}
              className="bg-brand-blue text-white p-2.5 rounded-2xl shadow-lg shadow-brand-blue/20 transition-transform active:scale-95"
            >
              {showAddBattery ? <XCircle className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            </button>
          }
        />
      </div>
        {showAddBattery && (
          <div
            className="ansicht-blenden overflow-hidden mb-6">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <Feld label={tx('Akku Nummer / Name', 'Battery number / name')} htmlFor="ak-name">
                <input
                  id="ak-name"
                  type="text"
                  className={eingabe}
                  placeholder={tx('z.B. Akku #1', 'e.g. Battery #1')}
                  value={newBattery.number || ''}
                  onChange={e => setNewBattery({...newBattery, number: e.target.value})}
                />
              </Feld>
              <Knopf voll onClick={handleAddBattery}>{tx('Akku registrieren', 'Register battery')}</Knopf>
            </div>
          </div>
        )}

      <div className="grid grid-cols-2 gap-3">
        {batteries.map(battery => {
          const cycles = battery.cycles || 0;
          // Erfasster SOH, sonst aus Zyklen geschätzt (0,15 %/Zyklus, Boden 60 %).
          const health = effektiveGesundheit(battery);

          return (
            <div key={battery.id}
              onClick={() => setDetailBattery(battery)}
              className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm relative group overflow-hidden cursor-pointer active:scale-[0.98] transition-transform">
              {/* Balken proportional zur Gesundheit */}
              <div
                className={cn(
                   "absolute bottom-0 left-0 h-1.5 transition-all duration-700",
                   health < 50 ? "bg-brand-red" : health < 80 ? "bg-amber-400" : "bg-brand-green"
                )}
                style={{ width: `${health}%` }}
              />

              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                    health < 50 ? "bg-red-50 text-brand-red" :
                    health < 80 ? "bg-amber-50 text-amber-800" :
                    "bg-emerald-50 text-brand-green"
                  )}>
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{battery.number}</h3>
                    <p className="text-xs text-slate-500">{cycles} {tx('Zyklen', 'Cycles')}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <div className="flex items-baseline gap-1">
                    <p className={cn(
                      "text-2xl font-black transition-colors",
                      health < 30 ? "text-brand-red" : "text-slate-900"
                    )}>{health}%</p>
                    <p className="text-2xs font-bold text-slate-500 uppercase">SOH</p>
                  </div>
                  <span className={cn(
                    "inline-block mt-1 text-2xs font-bold px-2 py-0.5 rounded-full",
                    health < 50 ? "bg-red-50 text-brand-red" :
                    health < 80 ? "bg-amber-50 text-amber-800" :
                    "bg-emerald-50 text-brand-green"
                  )}>
                    {health > 80 ? tx('Exzellent', 'Excellent') : health > 50 ? tx('Gut', 'Good') : tx('Verschlissen', 'Worn out')}
                  </span>
                </div>
                <IconKnopf
                  icon={Trash2}
                  variante="gefahr"
                  aria-label={tx('Akku löschen', 'Delete battery')}
                  className="-mr-2 -mb-1 sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); handleDeleteBattery(battery.id); }}
                />
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
