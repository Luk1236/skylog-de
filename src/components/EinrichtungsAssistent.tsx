import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Check, User, Award, ShieldCheck, Plane, ClipboardCheck } from 'lucide-react';
import { dbService, type UserProfile, type Drone, type UASClass } from '../services/db';
import { validateEID } from '../services/eidManager';
import { baueBehoerdenCheck } from '../services/authorityCheck';
import { useSprache } from '../lib/sprache';
import { cn } from '../lib/utils';

interface Props {
  onFertig: () => void;
  onAbbrechen: () => void;
}

/** Geführte Ersteinrichtung: Betreiber-ID, Kompetenznachweis, Versicherung und
 *  erste Drohne - genau das, was ein Behörden-Check sehen will. Jeder Schritt
 *  ausser dem Namen ist überspringbar; nichts wird ohne „Fertig" gespeichert. */
export function EinrichtungsAssistent({ onFertig, onAbbrechen }: Props) {
  const { tx } = useSprache();
  const [schritt, setSchritt] = useState(0);
  const [name, setName] = useState('');
  const [eid, setEid] = useState('');
  const [lizenz, setLizenz] = useState<UserProfile['licenseType']>('A1/A3');
  const [lizenzBis, setLizenzBis] = useState('');
  const [versicherung, setVersicherung] = useState('');
  const [drohneModell, setDrohneModell] = useState('');
  const [drohneGewicht, setDrohneGewicht] = useState('');
  const [drohneKlasse, setDrohneKlasse] = useState<UASClass>('C0');
  const [speichert, setSpeichert] = useState(false);

  const eidPruefung = eid.trim() ? validateEID(eid) : null;

  const profil: UserProfile = {
    id: 'main_profile',
    name: name.trim(),
    eid: eidPruefung?.isValid ? eidPruefung.formatted : eid.trim().toUpperCase(),
    licenseType: lizenz,
    licenseExpiry: lizenzBis || undefined,
    insuranceNumber: versicherung.trim(),
  };
  const drohne: Drone | null = drohneModell.trim()
    ? {
        id: crypto.randomUUID(),
        name: drohneModell.trim(),
        model: drohneModell.trim(),
        weight: Number(drohneGewicht) || 0,
        uasClass: drohneKlasse,
        eId: '',
        createdAt: Date.now(),
      }
    : null;
  const check = baueBehoerdenCheck(profil, drohne);

  const schritte = [
    { icon: User, titel: tx('Du als Betreiber', 'You as operator') },
    { icon: Award, titel: tx('Kompetenznachweis', 'Competency certificate') },
    { icon: ShieldCheck, titel: tx('Versicherung', 'Insurance') },
    { icon: Plane, titel: tx('Deine erste Drohne', 'Your first drone') },
    { icon: ClipboardCheck, titel: tx('Fertig', 'Done') },
  ];
  const letzter = schritt === schritte.length - 1;
  const weiterMoeglich = schritt !== 0 || name.trim().length > 0;

  const speichern = async () => {
    setSpeichert(true);
    const vorhanden = await dbService.getProfile();
    // Bestehende Zugangsdaten (NOTAM) und BOS-Status nicht verlieren
    await dbService.saveProfile({ ...(vorhanden ?? {}), ...profil });
    if (drohne) await dbService.saveDrone(drohne);
    setSpeichert(false);
    onFertig();
  };

  const feld = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900';
  const label = 'block text-2xs font-bold text-slate-600 uppercase tracking-wider mb-1';
  const Symbol = schritte[schritt].icon;

  return (
    <div className="fixed inset-0 bg-black/50 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-brand-blue/10 text-brand-blue">
              <Symbol className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider">
                {tx('Schritt', 'Step')} {schritt + 1} / {schritte.length}
              </p>
              <h2 className="font-black text-slate-900">{schritte[schritt].titel}</h2>
            </div>
          </div>
          <button onClick={onAbbrechen} aria-label={tx('Schließen', 'Close')} className="p-2 rounded-xl bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1.5" aria-hidden>
          {schritte.map((_, i) => (
            <div key={i} className={cn('h-1.5 flex-1 rounded-full', i <= schritt ? 'bg-brand-blue' : 'bg-slate-200')} />
          ))}
        </div>

        {schritt === 0 && (
          <div className="space-y-4">
            <div>
              <label className={label} htmlFor="ea-name">{tx('Name', 'Name')}</label>
              <input id="ea-name" className={feld} value={name} onChange={e => setName(e.target.value)} placeholder={tx('Vor- und Nachname', 'First and last name')} autoFocus />
            </div>
            <div>
              <label className={label} htmlFor="ea-eid">{tx('Betreiber-ID (e-ID) vom LBA', 'Operator ID (e-ID) from the LBA')}</label>
              <input id="ea-eid" className={feld} value={eid} onChange={e => setEid(e.target.value)} placeholder="DEU123456789012" />
              <p className={cn('text-2xs mt-1', eidPruefung && !eidPruefung.isValid ? 'text-brand-red font-bold' : 'text-slate-600')}>
                {eidPruefung && !eidPruefung.isValid
                  ? tx('Format passt nicht zum EU-Schema (z. B. DEU123456789012).', 'Format does not match the EU scheme (e.g. DEU123456789012).')
                  : tx('Pflicht für fast alle Drohnen mit Kamera. Registrierung im LBA-Portal.', 'Required for almost all drones with a camera. Register in the LBA portal.')}
              </p>
            </div>
          </div>
        )}

        {schritt === 1 && (
          <div className="space-y-4">
            <div>
              <label className={label} htmlFor="ea-lizenz">{tx('Nachweis', 'Certificate')}</label>
              <select id="ea-lizenz" className={feld} value={lizenz} onChange={e => setLizenz(e.target.value as UserProfile['licenseType'])}>
                <option value="A1/A3">{tx('EU-Kompetenznachweis A1/A3', 'EU proof of competency A1/A3')}</option>
                <option value="A2">{tx('EU-Fernpilotenzeugnis A2', 'EU remote pilot certificate A2')}</option>
                <option value="STS">{tx('STS (Standardszenario)', 'STS (standard scenario)')}</option>
                <option value="None">{tx('Noch keiner', 'None yet')}</option>
              </select>
            </div>
            {lizenz !== 'None' && (
              <div>
                <label className={label} htmlFor="ea-bis">{tx('Gültig bis', 'Valid until')}</label>
                <input id="ea-bis" type="date" className={feld} value={lizenzBis} onChange={e => setLizenzBis(e.target.value)} />
                <p className="text-2xs text-slate-600 mt-1">{tx('SkyLog erinnert dich rechtzeitig vor dem Ablauf.', 'SkyLog reminds you before it expires.')}</p>
              </div>
            )}
          </div>
        )}

        {schritt === 2 && (
          <div>
            <label className={label} htmlFor="ea-vers">{tx('Versicherungsnummer (Drohnen-Haftpflicht)', 'Insurance number (drone liability)')}</label>
            <input id="ea-vers" className={feld} value={versicherung} onChange={e => setVersicherung(e.target.value)} placeholder={tx('z. B. HV-123456', 'e.g. HV-123456')} />
            <p className="text-2xs text-slate-600 mt-1">{tx('In Deutschland ist eine Haftpflichtversicherung für jede Drohne Pflicht.', 'In Germany, liability insurance is mandatory for every drone.')}</p>
          </div>
        )}

        {schritt === 3 && (
          <div className="space-y-4">
            <div>
              <label className={label} htmlFor="ea-modell">{tx('Modell', 'Model')}</label>
              <input id="ea-modell" className={feld} value={drohneModell} onChange={e => setDrohneModell(e.target.value)} placeholder={tx('z. B. DJI Mini 4 Pro', 'e.g. DJI Mini 4 Pro')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="ea-gewicht">{tx('Gewicht (g)', 'Weight (g)')}</label>
                <input id="ea-gewicht" type="number" min={0} className={feld} value={drohneGewicht} onChange={e => setDrohneGewicht(e.target.value)} placeholder="249" />
              </div>
              <div>
                <label className={label} htmlFor="ea-klasse">{tx('C-Klasse', 'C class')}</label>
                <select id="ea-klasse" className={feld} value={drohneKlasse} onChange={e => setDrohneKlasse(e.target.value as UASClass)}>
                  {(['C0', 'C1', 'C2', 'C3', 'C4', 'Legacy', 'Self-built'] as UASClass[]).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </div>
            <p className="text-2xs text-slate-600">{tx('Optional – weitere Drohnen legst du später unter „Flotte“ an.', 'Optional – add more drones later under “Fleet”.')}</p>
          </div>
        )}

        {letzter && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              {check.warnungen.length === 0
                ? tx('Alles da, was eine Kontrolle sehen will. Den QR-Behördencheck findest du oben rechts.', 'Everything an inspection wants to see is there. The QR authority check is at the top right.')
                : tx('Das fehlt noch für einen vollständigen Behördencheck – du kannst es jederzeit im Profil ergänzen:', 'Still missing for a complete authority check – you can add it in your profile at any time:')}
            </p>
            {check.warnungen.length > 0 && (
              <ul className="space-y-1">
                {check.warnungen.map(w => (
                  <li key={w} className="text-xs text-amber-800 bg-amber-50 rounded-xl px-3 py-2">{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {schritt > 0 && (
            <button onClick={() => setSchritt(s => s - 1)} className="flex items-center gap-1 px-4 py-3 text-xs font-bold text-slate-600 bg-slate-100 rounded-2xl">
              <ChevronLeft className="w-4 h-4" /> {tx('Zurück', 'Back')}
            </button>
          )}
          {!letzter ? (
            <button onClick={() => setSchritt(s => s + 1)} disabled={!weiterMoeglich}
              className="flex-1 flex items-center justify-center gap-1 py-3 text-xs font-bold text-white bg-brand-blue rounded-2xl disabled:opacity-50">
              {schritt === 0 || schritt === 4 ? tx('Weiter', 'Next') : tx('Weiter (oder überspringen)', 'Next (or skip)')} <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={speichern} disabled={speichert}
              className="flex-1 flex items-center justify-center gap-1 py-3 text-xs font-bold text-white bg-brand-blue rounded-2xl disabled:opacity-50">
              <Check className="w-4 h-4" /> {tx('Fertig – speichern', 'Done – save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
