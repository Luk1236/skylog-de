import { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, User, Award, ShieldCheck, Plane, ClipboardCheck } from 'lucide-react';
import { dbService, type UserProfile, type Drone, type UASClass } from '../services/db';
import { validateEID } from '../services/eidManager';
import { baueBehoerdenCheck } from '../services/authorityCheck';
import { useSprache } from '../lib/sprache';
import { cn } from '../lib/utils';
import { Dialog, Knopf, Feld, eingabe } from './ui';

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

  const Symbol = schritte[schritt].icon;

  return (
    <Dialog
      titel={schritte[schritt].titel}
      untertitel={<>{tx('Schritt', 'Step')} {schritt + 1} / {schritte.length}</>}
      icon={Symbol}
      breite="md"
      onClose={onAbbrechen}
      schliesstBeiKlickDaneben={false}
      fuss={
        <>
          {schritt > 0 && (
            <Knopf variante="sekundaer" icon={ChevronLeft} onClick={() => setSchritt(s => s - 1)}>
              {tx('Zurück', 'Back')}
            </Knopf>
          )}
          {!letzter ? (
            <Knopf className="flex-1" onClick={() => setSchritt(s => s + 1)} disabled={!weiterMoeglich}>
              {schritt === 0 || schritt === 4 ? tx('Weiter', 'Next') : tx('Weiter (oder überspringen)', 'Next (or skip)')} <ChevronRight className="w-4 h-4" />
            </Knopf>
          ) : (
            <Knopf className="flex-1" icon={Check} onClick={speichern} disabled={speichert}>
              {tx('Fertig – speichern', 'Done – save')}
            </Knopf>
          )}
        </>
      }
    >
      <div className="flex gap-1.5" aria-hidden>
        {schritte.map((_, i) => (
          <div key={i} className={cn('h-1.5 flex-1 rounded-full', i <= schritt ? 'bg-brand-blue' : 'bg-slate-200')} />
        ))}
      </div>

      {schritt === 0 && (
        <div className="space-y-4">
          <Feld label={tx('Name', 'Name')} htmlFor="ea-name">
            <input id="ea-name" className={eingabe} value={name} onChange={e => setName(e.target.value)} placeholder={tx('Vor- und Nachname', 'First and last name')} autoFocus />
          </Feld>
          <Feld
            label={tx('Betreiber-ID (e-ID) vom LBA', 'Operator ID (e-ID) from the LBA')}
            htmlFor="ea-eid"
            fehler={eidPruefung && !eidPruefung.isValid
              ? tx('Format passt nicht zum EU-Schema (z. B. DEU123456789012).', 'Format does not match the EU scheme (e.g. DEU123456789012).')
              : undefined}
            hinweis={tx('Pflicht für fast alle Drohnen mit Kamera. Registrierung im LBA-Portal.', 'Required for almost all drones with a camera. Register in the LBA portal.')}
          >
            <input id="ea-eid" className={eingabe} value={eid} onChange={e => setEid(e.target.value)} placeholder="DEU123456789012" />
          </Feld>
        </div>
      )}

      {schritt === 1 && (
        <div className="space-y-4">
          <Feld label={tx('Nachweis', 'Certificate')} htmlFor="ea-lizenz">
            <select id="ea-lizenz" className={eingabe} value={lizenz} onChange={e => setLizenz(e.target.value as UserProfile['licenseType'])}>
              <option value="A1/A3">{tx('EU-Kompetenznachweis A1/A3', 'EU proof of competency A1/A3')}</option>
              <option value="A2">{tx('EU-Fernpilotenzeugnis A2', 'EU remote pilot certificate A2')}</option>
              <option value="STS">{tx('STS (Standardszenario)', 'STS (standard scenario)')}</option>
              <option value="None">{tx('Noch keiner', 'None yet')}</option>
            </select>
          </Feld>
          {lizenz !== 'None' && (
            <Feld
              label={tx('Gültig bis', 'Valid until')}
              htmlFor="ea-bis"
              hinweis={tx('SkyLog erinnert dich rechtzeitig vor dem Ablauf.', 'SkyLog reminds you before it expires.')}
            >
              <input id="ea-bis" type="date" className={eingabe} value={lizenzBis} onChange={e => setLizenzBis(e.target.value)} />
            </Feld>
          )}
        </div>
      )}

      {schritt === 2 && (
        <Feld
          label={tx('Versicherungsnummer (Drohnen-Haftpflicht)', 'Insurance number (drone liability)')}
          htmlFor="ea-vers"
          hinweis={tx('In Deutschland ist eine Haftpflichtversicherung für jede Drohne Pflicht.', 'In Germany, liability insurance is mandatory for every drone.')}
        >
          <input id="ea-vers" className={eingabe} value={versicherung} onChange={e => setVersicherung(e.target.value)} placeholder={tx('z. B. HV-123456', 'e.g. HV-123456')} />
        </Feld>
      )}

      {schritt === 3 && (
        <div className="space-y-4">
          <Feld label={tx('Modell', 'Model')} htmlFor="ea-modell">
            <input id="ea-modell" className={eingabe} value={drohneModell} onChange={e => setDrohneModell(e.target.value)} placeholder={tx('z. B. DJI Mini 4 Pro', 'e.g. DJI Mini 4 Pro')} />
          </Feld>
          <div className="grid grid-cols-2 gap-3">
            <Feld label={tx('Gewicht (g)', 'Weight (g)')} htmlFor="ea-gewicht">
              <input id="ea-gewicht" type="number" min={0} className={eingabe} value={drohneGewicht} onChange={e => setDrohneGewicht(e.target.value)} placeholder="249" />
            </Feld>
            <Feld label={tx('C-Klasse', 'C class')} htmlFor="ea-klasse">
              <select id="ea-klasse" className={eingabe} value={drohneKlasse} onChange={e => setDrohneKlasse(e.target.value as UASClass)}>
                {(['C0', 'C1', 'C2', 'C3', 'C4', 'Legacy', 'Self-built'] as UASClass[]).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </Feld>
          </div>
          <p className="text-xs text-slate-500">{tx('Optional – weitere Drohnen legst du später unter „Flotte“ an.', 'Optional – add more drones later under “Fleet”.')}</p>
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
                <li key={w} className="text-xs text-amber-800 bg-amber-50 rounded-2xl px-3 py-2">{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Dialog>
  );
}
