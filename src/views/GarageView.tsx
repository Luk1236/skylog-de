import { useState, useEffect } from 'react';
import { BadgeAlert, Plus, XCircle } from 'lucide-react';
import {
  dbService, type Drone, type Battery, type MaintenanceRecord,
  type Flight, type UASClass,
} from '../services/db';
import { zeigeRueckgaengig } from '../services/rueckgaengig';
import { useSprache } from '../lib/sprache';
import { BatteryDetailDialog } from '../components/lazyDialogs';
import { Feld, Knopf, eingabe, SeitenKopf } from '../components/ui';
import { drohnenStatistik, wartungsHinweise, type DrohnenStatistik } from './flotte/wartungsHinweise';
import { DrohnenFormular } from './flotte/DrohnenFormular';
import { DrohnenKarte } from './flotte/DrohnenKarte';
import { WartungsDialog } from './flotte/WartungsDialog';
import { AkkuKarte } from './flotte/AkkuKarte';

// Die Ansicht hält Daten und Aktionen; Karten, Formular und Wartungsdialog liegen in ./flotte.
export function GarageView({ drones, flights, batteries, onUpdate }: { drones: Drone[], flights: Flight[], batteries: Battery[], onUpdate: () => void }) {
  const { t, tx } = useSprache();
  const [showAdd, setShowAdd] = useState(false);
  const [editingDroneId, setEditingDroneId] = useState<string | null>(null);
  const [newDrone, setNewDrone] = useState<Partial<Drone>>({});
  const [showAddBattery, setShowAddBattery] = useState(false);
  const [newBattery, setNewBattery] = useState<Partial<Battery>>({});
  const [detailBattery, setDetailBattery] = useState<Battery | null>(null);
  const [selectedDroneId, setSelectedDroneId] = useState<string | null>(null);

  // Statistik je Drohne für die Wartungshinweise; statsStand lädt sie nach
  // Änderungen im Wartungsdialog neu.
  const [droneStats, setDroneStats] = useState<Record<string, DrohnenStatistik>>({});
  const [alleWartungen, setAlleWartungen] = useState<MaintenanceRecord[]>([]);
  const [statsStand, setStatsStand] = useState(0);

  useEffect(() => {
    const loadStats = async () => {
      const allFlights = await dbService.getFlights();
      const stats: Record<string, DrohnenStatistik> = {};
      const gesammelt: MaintenanceRecord[] = [];
      for (const drone of drones) {
        const dMaint = await dbService.getMaintenance(drone.id);
        gesammelt.push(...dMaint);
        stats[drone.id] = drohnenStatistik(allFlights.filter(f => f.droneId === drone.id), dMaint);
      }
      setDroneStats(stats);
      setAlleWartungen(gesammelt);
    };
    loadStats();
  }, [drones, flights, statsStand]); // flights: Statistik aktualisieren, sobald ein Flug dazukommt

  const hinweiseFuer = (droneId: string) => wartungsHinweise(droneStats[droneId], tx);
  const drohnenMitHinweisen = drones.filter(d => hinweiseFuer(d.id).length > 0);

  const handleAdd = async () => {
    if (!newDrone.model) return;
    const felder = {
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
    };

    if (editingDroneId) {
      const droneToUpdate = drones.find(d => d.id === editingDroneId);
      if (droneToUpdate) await dbService.saveDrone({ ...droneToUpdate, ...felder });
    } else {
      await dbService.saveDrone({ id: crypto.randomUUID(), ...felder, createdAt: Date.now() });
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

  const handleMotorenGereinigt = async (drone: Drone) => {
    await dbService.saveMaintenance({
      id: crypto.randomUUID(),
      droneId: drone.id,
      date: new Date().toISOString().split('T')[0],
      type: 'Motor',
      description: 'Motoren gereinigt (Benutzer-Schnellaktion)',
      hoursAtMaintenance: droneStats[drone.id]?.hours || 0,
      createdAt: Date.now(),
    });
    onUpdate();
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

  const gewaehlteDrohne = drones.find(d => d.id === selectedDroneId);

  return (
    <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto pb-20">
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
      {drohnenMitHinweisen.length > 0 && (
        <div className="ansicht-blenden mb-6 p-4 bg-amber-50 border border-amber-200 rounded-3xl">
          <div className="flex items-center gap-2 mb-1">
            <BadgeAlert className="w-4 h-4 text-amber-800" />
            <h3 className="text-sm font-bold text-amber-800">{tx('Wartung erforderlich', 'Maintenance required')}</h3>
          </div>
          <p className="text-xs text-slate-700 mb-3">{tx('Mehrere Drohnen benötigen Aufmerksamkeit für sicheren Flugbetrieb.', 'Several drones need attention for safe operation.')}</p>
          <div className="flex flex-wrap gap-2">
            {drohnenMitHinweisen.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedDroneId(d.id)}
                className="h-10 px-3 rounded-xl bg-white border border-amber-200 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors"
              >
                {d.model} ({hinweiseFuer(d.id).length})
              </button>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <DrohnenFormular drohne={newDrone} setDrohne={setNewDrone} bearbeiten={!!editingDroneId} onSpeichern={() => void handleAdd()} />
      )}

      <div className="space-y-3 mb-10">
        {drones.map(drone => (
          <DrohnenKarte
            key={drone.id}
            drohne={drone}
            fluege={flights.filter(f => f.droneId === drone.id)}
            stats={droneStats[drone.id]}
            wartungen={alleWartungen}
            hinweise={hinweiseFuer(drone.id)}
            onBearbeiten={() => handleEditDrone(drone)}
            onWartung={() => setSelectedDroneId(drone.id)}
            onLoeschen={() => void handleDelete(drone.id)}
            onMotorenGereinigt={() => void handleMotorenGereinigt(drone)}
          />
        ))}
      </div>

      {/* Wartungshistorie einer Drohne */}
      {gewaehlteDrohne && (
        <WartungsDialog
          drohne={gewaehlteDrohne}
          stats={droneStats[gewaehlteDrohne.id]}
          hinweise={hinweiseFuer(gewaehlteDrohne.id)}
          onClose={() => setSelectedDroneId(null)}
          onGeaendert={() => setStatsStand(s => s + 1)}
        />
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
        <div className="ansicht-blenden overflow-hidden mb-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <Feld label={tx('Akku Nummer / Name', 'Battery number / name')} htmlFor="ak-name">
              <input
                id="ak-name"
                type="text"
                className={eingabe}
                placeholder={tx('z.B. Akku #1', 'e.g. Battery #1')}
                value={newBattery.number || ''}
                onChange={e => setNewBattery({ ...newBattery, number: e.target.value })}
              />
            </Feld>
            <Knopf voll onClick={() => void handleAddBattery()}>{tx('Akku registrieren', 'Register battery')}</Knopf>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {batteries.map(battery => (
          <AkkuKarte
            key={battery.id}
            akku={battery}
            onOeffnen={() => setDetailBattery(battery)}
            onLoeschen={() => void handleDeleteBattery(battery.id)}
          />
        ))}
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
