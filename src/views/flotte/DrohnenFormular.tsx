import { Camera, X } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import type { Drone, UASClass } from '../../services/db';
import { Feld, IconKnopf, Knopf, eingabe } from '../../components/ui';

/** Drohne anlegen oder bearbeiten. */
export function DrohnenFormular({ drohne, setDrohne, bearbeiten, onSpeichern }: {
  drohne: Partial<Drone>;
  setDrohne: (d: Partial<Drone>) => void;
  bearbeiten: boolean;
  onSpeichern: () => void;
}) {
  const { tx } = useSprache();
  const zahlOderLeer = (wert: string) => (wert ? Number(wert) : undefined);

  return (
    <div className="ansicht-blenden overflow-hidden mb-6">
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-black text-slate-900">
          {bearbeiten ? tx('Drohne bearbeiten', 'Edit drone') : tx('Neue Drohne registrieren', 'Register new drone')}
        </h3>
        <Feld label={tx('Modell / Name', 'Model / name')} htmlFor="dr-modell">
          <input
            id="dr-modell"
            type="text"
            className={eingabe}
            placeholder={tx('z.B. DJI Mini 4 Pro', 'e.g. DJI Mini 4 Pro')}
            value={drohne.model || ''}
            onChange={e => setDrohne({ ...drohne, model: e.target.value })}
          />
        </Feld>
        <div className="grid grid-cols-2 gap-3">
          <Feld label={tx('Gewicht (g)', 'Weight (g)')} htmlFor="dr-gewicht">
            <input id="dr-gewicht" type="number" className={eingabe} placeholder="249" value={drohne.weight || ''} onChange={e => setDrohne({ ...drohne, weight: Number(e.target.value) })} />
          </Feld>
          <Feld label={tx('C-Klasse', 'C class')} htmlFor="dr-klasse">
            <select id="dr-klasse" className={eingabe} value={drohne.uasClass || 'Legacy'} onChange={e => setDrohne({ ...drohne, uasClass: e.target.value as UASClass })}>
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
            <input id="dr-sn" type="text" className={eingabe} placeholder="SN123..." value={drohne.serialNumber || ''} onChange={e => setDrohne({ ...drohne, serialNumber: e.target.value })} />
          </Feld>
          <Feld label={tx('Firmware Version', 'Firmware version')} htmlFor="dr-fw">
            <input id="dr-fw" type="text" className={eingabe} placeholder="v01.00..." value={drohne.firmwareVersion || ''} onChange={e => setDrohne({ ...drohne, firmwareVersion: e.target.value })} />
          </Feld>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Feld label={tx('LBA e-ID (Optional)', 'LBA e-ID (optional)')} htmlFor="dr-eid">
            <input id="dr-eid" type="text" className={eingabe} placeholder="DEU..." value={drohne.eId || ''} onChange={e => setDrohne({ ...drohne, eId: e.target.value })} />
          </Feld>
          <Feld label={tx('Spezielle Versicherung', 'Separate insurance')} htmlFor="dr-vers">
            <input
              id="dr-vers"
              type="text"
              className={eingabe}
              placeholder={tx('Nur falls abweichend', 'Only if different')}
              value={drohne.insuranceNumber || ''}
              onChange={e => setDrohne({ ...drohne, insuranceNumber: e.target.value })}
            />
          </Feld>
        </div>
        <Feld label={tx('Max. Windgrenze (km/h)', 'Max. wind limit (km/h)')} htmlFor="dr-wind">
          <input
            id="dr-wind"
            type="number"
            className={eingabe}
            placeholder={tx('z.B. 28 (leer = Standard 28 km/h)', 'e.g. 28 (empty = default 28 km/h)')}
            value={drohne.maxWindSpeed || ''}
            onChange={e => setDrohne({ ...drohne, maxWindSpeed: zahlOderLeer(e.target.value) })}
          />
        </Feld>
        <div className="grid grid-cols-2 gap-3">
          <Feld label={tx('Garantie bis', 'Warranty until')} htmlFor="dr-garantie">
            <input id="dr-garantie" type="date" className={eingabe}
              value={drohne.warrantyUntil?.slice(0, 10) || ''}
              onChange={e => setDrohne({ ...drohne, warrantyUntil: e.target.value || undefined })} />
          </Feld>
          <Feld label={tx('Kaufdatum', 'Purchase date')} htmlFor="dr-kauf">
            <input id="dr-kauf" type="date" className={eingabe}
              value={drohne.purchaseDate?.slice(0, 10) || ''}
              onChange={e => setDrohne({ ...drohne, purchaseDate: e.target.value || undefined })} />
          </Feld>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Feld label={tx('Wartung alle (Tage)', 'Maintenance every (days)')} htmlFor="dr-tage">
            <input id="dr-tage" type="number" className={eingabe} placeholder={tx('z.B. 180', 'e.g. 180')}
              value={drohne.maintenanceIntervalDays || ''}
              onChange={e => setDrohne({ ...drohne, maintenanceIntervalDays: zahlOderLeer(e.target.value) })} />
          </Feld>
          <Feld label={tx('Wartung alle (Std.)', 'Maintenance every (hours)')} htmlFor="dr-std">
            <input id="dr-std" type="number" className={eingabe} placeholder={tx('z.B. 50', 'e.g. 50')}
              value={drohne.maintenanceIntervalHours || ''}
              onChange={e => setDrohne({ ...drohne, maintenanceIntervalHours: zahlOderLeer(e.target.value) })} />
          </Feld>
        </div>
        <Feld label={tx('Drohnen-Foto (optional)', 'Drone photo (optional)')}>
          {drohne.photoUrl ? (
            <div className="relative">
              <img src={drohne.photoUrl} alt={tx('Vorschau', 'Preview')} className="w-full h-28 object-cover rounded-xl border border-slate-200" />
              <IconKnopf
                icon={X}
                variante="sekundaer"
                aria-label={tx('Foto entfernen', 'Remove photo')}
                onClick={() => setDrohne({ ...drohne, photoUrl: undefined })}
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
                reader.onload = ev => setDrohne({ ...drohne, photoUrl: ev.target?.result as string });
                reader.readAsDataURL(file);
              }} />
            </label>
          )}
        </Feld>
        <Knopf voll onClick={onSpeichern}>
          {bearbeiten ? tx('Änderungen speichern', 'Save changes') : tx('Drohne registrieren', 'Register drone')}
        </Knopf>
      </div>
    </div>
  );
}
