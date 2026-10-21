import { useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, Settings2, ShieldAlert, Trash2, Wrench, X } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import { cn, lokalesDatum } from '../../lib/utils';
import { dbService, type Drone, type MaintenanceRecord } from '../../services/db';
import { zeigeRueckgaengig } from '../../services/rueckgaengig';
import { Dialog, Feld, IconKnopf, Knopf, eingabe } from '../../components/ui';
import type { DrohnenStatistik, WartungsHinweis } from './wartungsHinweise';

type Zeitraum = 'All' | '30Days' | '3Months' | '1Year';
const TAG = 24 * 60 * 60 * 1000;

/** Wartungshistorie einer Drohne: Verschleiß, Empfehlungen, Einträge mit Filter. */
export function WartungsDialog({ drohne, stats, hinweise, onClose, onGeaendert }: {
  drohne: Drone;
  stats: DrohnenStatistik | undefined;
  hinweise: WartungsHinweis[];
  onClose: () => void;
  /** Ein Eintrag kam dazu oder fiel weg - Statistik und Hinweise neu berechnen. */
  onGeaendert: () => void;
}) {
  const { t, tx } = useSprache();
  const [eintraege, setEintraege] = useState<MaintenanceRecord[]>([]);
  const [formular, setFormular] = useState(false);
  const [neu, setNeu] = useState<Partial<MaintenanceRecord>>({ type: 'General' });
  const [typFilter, setTypFilter] = useState<MaintenanceRecord['type'] | 'All'>('All');
  const [zeitraum, setZeitraum] = useState<Zeitraum>('All');

  useEffect(() => {
    dbService.getMaintenance(drohne.id).then(setEintraege);
  }, [drohne.id]);

  const gefiltert = useMemo(() => {
    const jetzt = Date.now();
    const grenzen: Record<Exclude<Zeitraum, 'All'>, number> = {
      '30Days': jetzt - 30 * TAG,
      '3Months': jetzt - 90 * TAG,
      '1Year': jetzt - 365 * TAG,
    };
    return eintraege
      .filter(m => (typFilter === 'All' || m.type === typFilter) && (zeitraum === 'All' || m.createdAt >= grenzen[zeitraum]))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [eintraege, typFilter, zeitraum]);

  const neuLaden = async () => {
    setEintraege(await dbService.getMaintenance(drohne.id));
    onGeaendert();
  };

  const hinzufuegen = async () => {
    if (!neu.description) return;
    await dbService.saveMaintenance({
      id: crypto.randomUUID(),
      droneId: drohne.id,
      date: lokalesDatum(),
      type: neu.type ?? 'General',
      description: neu.description,
      hoursAtMaintenance: stats?.hours || 0,
      cost: neu.cost,
      createdAt: Date.now(),
    });
    await neuLaden();
    setNeu({ type: 'General' });
    setFormular(false);
  };

  // Sofort löschen, ein paar Sekunden „Rückgängig“ anbieten (früher ohne Rückfrage endgültig weg).
  const loeschen = async (eintrag: MaintenanceRecord) => {
    await dbService.deleteMaintenance(eintrag.id);
    await neuLaden();
    zeigeRueckgaengig(tx('Wartungseintrag gelöscht', 'Maintenance entry deleted'), async () => {
      await dbService.saveMaintenance(eintrag);
      await neuLaden();
    });
  };

  const teile = stats ? [
    { label: 'Propeller', limit: 50, seit: stats.flightsSinceMaint?.['Propeller'] ?? stats.flights },
    { label: 'Motor', limit: 100, seit: stats.flightsSinceMaint?.['Motor'] ?? stats.flights },
    { label: 'Sensor', limit: 200, seit: stats.flightsSinceMaint?.['Sensor'] ?? stats.flights },
  ] : [];

  return (
    <Dialog
      titel={tx('Wartungshistorie', 'Maintenance history')}
      untertitel={drohne.model}
      icon={Wrench}
      ton="bernstein"
      onClose={onClose}
      kopfAktionen={
        <Knopf variante="sekundaer" groesse="sm" icon={formular ? X : Plus} onClick={() => setFormular(!formular)}>
          {formular ? tx('Abbrechen', 'Cancel') : tx('Neu', 'New')}
        </Knopf>
      }
    >
      {/* Bauteil-Verschleiß Übersicht */}
      {teile.length > 0 && (
        <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
          <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{tx('Bauteil-Verschleiß', 'Component wear')}</p>
          {teile.map(teil => {
            const prozent = Math.min(100, Math.round((teil.seit / teil.limit) * 100));
            const farbe = prozent >= 100
              ? { text: 'text-brand-red', balken: 'bg-brand-red' }
              : prozent >= 75
                ? { text: 'text-brand-orange', balken: 'bg-brand-orange' }
                : { text: 'text-brand-green', balken: 'bg-brand-green' };
            return (
              <div key={teil.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-bold text-slate-700">{teil.label}</span>
                  <span className={cn('text-xs font-bold', farbe.text)}>{teil.seit}/{teil.limit} {tx('Flüge', 'Flights')}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                  <div className={cn('h-1.5 rounded-full transition-all', farbe.balken)} style={{ width: `${prozent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hinweise.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-amber-800" />
            <span className="text-xs font-bold text-amber-800">{tx('Empfohlene Wartung', 'Recommended maintenance')}</span>
          </div>
          <div className="space-y-1.5">
            {hinweise.map((hinweis, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-amber-800">{hinweis.type === 'General' ? tx('Allgemein', 'General') : hinweis.type}</span>
                <span className="text-xs text-slate-700 text-right">{hinweis.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {formular && (
        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="grid grid-cols-2 gap-3">
            <Feld label={tx('Typ', 'Type')} htmlFor="wt-typ">
              <select
                id="wt-typ"
                className={eingabe}
                value={neu.type}
                onChange={e => setNeu({ ...neu, type: e.target.value as MaintenanceRecord['type'] })}
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
                value={neu.cost ?? ''}
                onChange={e => setNeu({ ...neu, cost: e.target.value ? Number(e.target.value) : undefined })}
              />
            </Feld>
          </div>
          <Feld label={tx('Beschreibung', 'Description')} htmlFor="wt-text">
            <input
              id="wt-text"
              type="text"
              className={eingabe}
              placeholder={tx('Z.B. Propeller-Set A getauscht', 'E.g. replaced propeller set A')}
              value={neu.description || ''}
              onChange={e => setNeu({ ...neu, description: e.target.value })}
            />
          </Feld>
          <Knopf voll onClick={() => void hinzufuegen()}>{t('wartung.eintragHinzufuegen')}</Knopf>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(['All', 'Propeller', 'Firmware', 'Motor', 'Sensor', 'General'] as const).map(typ => (
            <button
              key={typ}
              onClick={() => setTypFilter(typ)}
              className={cn(
                'h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap transition-colors',
                typFilter === typ ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {typ === 'All' ? tx('Alle Typen', 'All types') : typ === 'General' ? tx('Allgemein', 'General') : typ}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {([
            { id: 'All', label: tx('Alle', 'All') },
            { id: '30Days', label: tx('Letzte 30 Tage', 'Last 30 days') },
            { id: '3Months', label: tx('Letzte 3 Monate', 'Last 3 months') },
            { id: '1Year', label: tx('Letztes Jahr', 'Last year') },
          ] as const).map(bereich => (
            <button
              key={bereich.id}
              onClick={() => setZeitraum(bereich.id)}
              className={cn(
                'h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5',
                zeitraum === bereich.id ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              <Calendar className="w-3 h-3" />
              {bereich.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {gefiltert.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Wrench className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-bold">{tx('Keine Einträge für diesen Filter', 'No entries for this filter')}</p>
          </div>
        ) : (
          gefiltert.map(eintrag => (
            <div key={eintrag.id} className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <Settings2 className="w-4 h-4 text-amber-800" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">{eintrag.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-2xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{eintrag.type === 'General' ? tx('Allgemein', 'General') : eintrag.type}</span>
                  <span className="text-xs text-slate-500">{eintrag.date}</span>
                </div>
              </div>
              <IconKnopf
                icon={Trash2}
                variante="gefahr"
                aria-label={tx('Eintrag löschen', 'Delete entry')}
                className="sm:opacity-0 sm:group-hover:opacity-100"
                onClick={() => void loeschen(eintrag)}
              />
            </div>
          ))
        )}
      </div>
    </Dialog>
  );
}
