import { useSprache } from '../lib/sprache';
import React, { useId, useState } from 'react';
import { Shield, CheckCircle2, FileText, ChevronRight, AlertTriangle, Info } from 'lucide-react';
import type { Drone, UserProfile } from '../services/db';
import {
  evaluateSora, generateSoraPdf, robustheitText, bevoelkerungText, igrcQuelle, warnungText,
  BEVOELKERUNG_STUFEN, KEINE_MINDERUNG, HINWEIS, HINWEIS_EN,
  type SoraInput, type GrcMinderungen, type Bevoelkerung,
} from '../services/sora25';
import { Dialog, Knopf, Feld, eingabe } from './ui';

interface Props {
  drones: Drone[];
  profile: UserProfile | null;
  onClose: () => void;
}

/** Gewicht der Drohne in kg (gespeichert meist in g). */
function mtomAusDrohne(d: Drone | undefined): number | null {
  if (!d?.weight) return null;
  return d.weight > 50 ? d.weight / 1000 : d.weight;
}

// Auswahl je Minderung - nur die Robustheiten, für die SORA 2.5 (Table 5) einen Abzug kennt.
const MINDERUNGEN: { schluessel: keyof GrcMinderungen; name: string; de: string; en: string; stufen: { r: 'L' | 'M' | 'H'; abzug: number }[] }[] = [
  { schluessel: 'm1a', name: 'M1(A)', de: 'Abschirmung: Menschen meist in Gebäuden', en: 'Sheltering: people mostly inside buildings', stufen: [{ r: 'L', abzug: 1 }, { r: 'M', abzug: 2 }] },
  { schluessel: 'm1b', name: 'M1(B)', de: 'Betriebliche Einschränkungen (Ort, Zeit)', en: 'Operational restrictions (place, time)', stufen: [{ r: 'M', abzug: 1 }, { r: 'H', abzug: 2 }] },
  { schluessel: 'm1c', name: 'M1(C)', de: 'Bodenbeobachtung während des Flugs', en: 'Ground observation during the flight', stufen: [{ r: 'L', abzug: 1 }] },
  { schluessel: 'm2', name: 'M2', de: 'Aufprallwirkung verringert, z. B. Fallschirm', en: 'Impact dynamics reduced, e.g. parachute', stufen: [{ r: 'M', abzug: 1 }, { r: 'H', abzug: 2 }] },
];

export function SoraWizardDialog({ drones, profile, onClose }: Props) {
  const { tx, sprache } = useSprache();
  const id = useId();
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [selectedDroneId, setSelectedDroneId] = useState<string>(drones[0]?.id || '');

  const selectedDrone = drones.find(d => d.id === selectedDroneId);

  const [input, setInput] = useState<SoraInput>({
    operationTitle: 'Gewerblicher Inspektions- / Fotoflug',
    visibility: 'vlos',
    airspace: 'uncontrolled',
    maxAltitudeM: 100,
    droneMtomKg: mtomAusDrohne(selectedDrone) ?? 1.5,
    abmessungM: 1,
    geschwindigkeitMs: 25,
    bevoelkerung: 'unter500',
    ueberStadt: false,
    minderungen: KEINE_MINDERUNG,
  });

  const result = evaluateSora(input);
  const ansammlung = input.bevoelkerung === 'ueber50000';

  const setzeMinderung = (schluessel: keyof GrcMinderungen, wert: string) => {
    setInput(prev => {
      const minderungen = { ...prev.minderungen, [schluessel]: wert || null } as GrcMinderungen;
      // M1(A) mittel und M1(B) schließen sich aus (Annex B).
      if (schluessel === 'm1a' && wert === 'M') minderungen.m1b = null;
      return { ...prev, minderungen };
    });
  };

  const handleGeneratePdf = () => {
    generateSoraPdf(input, result, selectedDrone || null, profile);
  };

  return (
    <Dialog
      titel={tx('EASA SORA 2.5 — ConOps & Behörden-Assistent', 'EASA SORA 2.5 — ConOps & authority assistant')}
      untertitel={tx('Erstellung behördengerechter Betriebsanträge (Spezifische Kategorie)', 'Preparing operation applications for the authority (Specific category)')}
      icon={Shield}
      ton="blau"
      breite="xl"
      onClose={onClose}
      fuss={step === 'form' ? (
        <Knopf voll onClick={() => setStep('result')}>
          <span>{tx('SORA-2.5-Risikobewertung ausführen', 'Run SORA 2.5 risk assessment')}</span>
          <ChevronRight className="w-4 h-4" />
        </Knopf>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Knopf variante="sekundaer" className="flex-1" onClick={() => setStep('form')}>
            {tx('Parameter ändern', 'Change parameters')}
          </Knopf>
          <Knopf className="flex-1" icon={FileText} onClick={handleGeneratePdf}>
            <span>{tx('SORA-Dossier als PDF exportieren', 'Export SORA dossier as PDF')}</span>
          </Knopf>
        </div>
      )}
    >
      {step === 'form' ? (
        <div className="space-y-4">
          <Feld label={tx('Bezeichnung des Flugvorhabens / ConOps Title', 'Operation name / ConOps title')} htmlFor={`${id}-titel`}>
            <input
              id={`${id}-titel`}
              type="text"
              className={eingabe}
              value={input.operationTitle}
              onChange={e => setInput({ ...input, operationTitle: e.target.value })}
            />
          </Feld>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Feld label={tx('Eingesetzte Drohne', 'Drone used')} htmlFor={`${id}-drohne`}>
              <select
                id={`${id}-drohne`}
                className={`${eingabe} cursor-pointer`}
                value={selectedDroneId}
                onChange={e => {
                  setSelectedDroneId(e.target.value);
                  const mtom = mtomAusDrohne(drones.find(dr => dr.id === e.target.value));
                  if (mtom !== null) setInput(prev => ({ ...prev, droneMtomKg: mtom }));
                }}
              >
                {drones.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.model} ({d.weight ? `${d.weight}g` : 'MTOM k.A.'})
                  </option>
                ))}
              </select>
            </Feld>

            <Feld label={tx('MTOM Abflugmasse (kg)', 'MTOM take-off mass (kg)')} htmlFor={`${id}-mtom`}>
              <input
                id={`${id}-mtom`}
                type="number"
                step="0.01"
                min="0.01"
                className={eingabe}
                value={input.droneMtomKg}
                onChange={e => setInput({ ...input, droneMtomKg: parseFloat(e.target.value) || 1.0 })}
              />
            </Feld>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Feld
              label={tx('Größte charakteristische Abmessung (m)', 'Max. characteristic dimension (m)')}
              htmlFor={`${id}-abmessung`}
              hinweis={tx('Multikopter: Diagonale von Blattspitze zu Blattspitze; Flächenflugzeug: Spannweite', 'Multirotor: diagonal from blade tip to blade tip; fixed-wing: wingspan')}
            >
              <input
                id={`${id}-abmessung`}
                type="number"
                step="0.01"
                min="0.01"
                className={eingabe}
                value={input.abmessungM}
                onChange={e => setInput({ ...input, abmessungM: parseFloat(e.target.value) || 1 })}
              />
            </Feld>

            <Feld
              label={tx('Höchstgeschwindigkeit (m/s)', 'Maximum speed (m/s)')}
              htmlFor={`${id}-geschwindigkeit`}
              hinweis={tx('Höchste mögliche Geschwindigkeit laut Hersteller, nicht die geplante', 'Highest possible speed per manufacturer, not the planned one')}
            >
              <input
                id={`${id}-geschwindigkeit`}
                type="number"
                step="0.5"
                min="0.5"
                className={eingabe}
                value={input.geschwindigkeitMs}
                onChange={e => setInput({ ...input, geschwindigkeitMs: parseFloat(e.target.value) || 25 })}
              />
            </Feld>
          </div>

          <Feld
            label={tx('Höchste Bevölkerungsdichte im Einsatzgebiet inkl. Puffer', 'Highest population density in the operational area incl. buffer')}
            htmlFor={`${id}-bevoelkerung`}
          >
            <select
              id={`${id}-bevoelkerung`}
              className={`${eingabe} cursor-pointer`}
              value={input.bevoelkerung}
              onChange={e => setInput({ ...input, bevoelkerung: e.target.value as Bevoelkerung })}
            >
              {BEVOELKERUNG_STUFEN.map(b => (
                <option key={b} value={b}>{bevoelkerungText(b, sprache)}</option>
              ))}
            </select>
          </Feld>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700" aria-live="polite">
            <p>
              <strong className="text-slate-900">{tx('Boden-Risikowert (iGRC)', 'Ground risk class (iGRC)')}: </strong>
              {result.initialGrc ?? tx('nicht bestimmbar', 'not determinable')}
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{tx('Quelle', 'Source')}: {igrcQuelle(result.igrc, sprache)}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Feld label={tx('Luftraumklasse (Airspace)', 'Airspace class')} htmlFor={`${id}-luftraum`}>
              <select
                id={`${id}-luftraum`}
                className={`${eingabe} cursor-pointer`}
                value={input.airspace}
                onChange={e => setInput({ ...input, airspace: e.target.value as SoraInput['airspace'] })}
              >
                <option value="uncontrolled">{tx('Unkontrollierter Luftraum (G / E)', 'Uncontrolled airspace (G / E)')}</option>
                <option value="controlled">{tx('Kontrollierter Luftraum (CTR / C / D)', 'Controlled airspace (CTR / C / D)')}</option>
                <option value="airport">{tx('Flughafennahbereich / CTR', 'Airport vicinity / CTR')}</option>
                <option value="prohibited">{tx('Sperrgebiet / ED-R', 'Restricted area / ED-R')}</option>
              </select>
            </Feld>

            <Feld label={tx('Max. Flughöhe (m AGL)', 'Max. altitude (m AGL)')} htmlFor={`${id}-hoehe`}>
              <input
                id={`${id}-hoehe`}
                type="number"
                className={eingabe}
                value={input.maxAltitudeM}
                onChange={e => setInput({ ...input, maxAltitudeM: parseInt(e.target.value) || 120 })}
              />
            </Feld>
          </div>

          <label className="flex items-center gap-3 cursor-pointer text-sm text-slate-700">
            <input
              type="checkbox"
              className="w-5 h-5 rounded accent-brand-blue cursor-pointer shrink-0"
              checked={input.ueberStadt}
              onChange={e => setInput({ ...input, ueberStadt: e.target.checked })}
            />
            <span>{tx('Flug über städtischem Gebiet (für das Luftrisiko)', 'Flight over an urban area (for the air risk)')}</span>
          </label>

          {/* Minderungen nach SORA 2.5, Step #3 */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-sm text-slate-700">
            <h3 className="font-bold text-slate-500 uppercase text-2xs tracking-wider">{tx('Risikominderungsmaßnahmen (Mitigations)', 'Mitigations')}</h3>

            {MINDERUNGEN.map(m => {
              const gesperrt = (m.schluessel === 'm1a' && ansammlung) || (m.schluessel === 'm1b' && input.minderungen.m1a === 'M');
              return (
                <Feld
                  key={m.schluessel}
                  label={`${m.name}: ${tx(m.de, m.en)}`}
                  htmlFor={`${id}-${m.schluessel}`}
                  hinweis={gesperrt ? (m.schluessel === 'm1a'
                    ? tx('Nicht über Menschenansammlungen anrechenbar.', 'Cannot be claimed over assemblies of people.')
                    : tx('Nicht mit M1(A) mittel kombinierbar.', 'Cannot be combined with M1(A) medium.')) : undefined}
                >
                  <select
                    id={`${id}-${m.schluessel}`}
                    className={`${eingabe} cursor-pointer`}
                    value={gesperrt ? '' : input.minderungen[m.schluessel] ?? ''}
                    disabled={gesperrt}
                    onChange={e => setzeMinderung(m.schluessel, e.target.value)}
                  >
                    <option value="">{tx('keine', 'none')}</option>
                    {m.stufen.map(s => (
                      <option key={s.r} value={s.r}>
                        {tx('Robustheit', 'robustness')} {robustheitText(s.r, sprache)} (-{s.abzug} GRC)
                      </option>
                    ))}
                  </select>
                </Feld>
              );
            })}

            <p className="text-xs text-slate-500 leading-relaxed">
              {tx('Anrechnung nur mit Nachweis nach Annex B. Der GRC sinkt nicht unter den Wert für einen kontrollierten Bodenbereich. Notfallplan (ERP): in SORA 2.5 Teil von OSO #08.', 'Credit only with evidence according to Annex B. The GRC cannot go below the controlled ground area value. Emergency response plan (ERP): part of OSO #08 in SORA 2.5.')}
            </p>
          </div>
        </div>
      ) : (
        /* Result Step */
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
              <p className="text-xs font-bold text-slate-500">Initial GRC</p>
              <p className="text-xl font-black text-slate-900 mt-1">{result.initialGrc ?? '–'}</p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
              <p className="text-xs font-bold text-slate-500">Final GRC</p>
              <p className="text-xl font-black text-brand-green mt-1">{result.finalGrc ?? '–'}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
              <p className="text-xs font-bold text-slate-500">Air Risk Class</p>
              <p className="text-xl font-black text-brand-blue mt-1">{result.finalArc}</p>
            </div>
            <div className="p-3 bg-brand-blue border border-brand-blue rounded-2xl text-center shadow-sm">
              <p className="text-xs font-bold text-white/80">{tx('Ergebnis SAIL', 'Resulting SAIL')}</p>
              <p className="text-xl font-black text-white mt-1">{result.ausserhalbSora ? tx('außerhalb', 'outside') : result.sail ?? '–'}</p>
            </div>
          </div>

          <p className="px-1 text-xs text-slate-500 leading-relaxed">
            <strong className="text-slate-700">{tx('iGRC-Quelle', 'iGRC source')}:</strong> {igrcQuelle(result.igrc, sprache)}
            {result.grcAbzug > 0 && <> · {tx('Minderungen', 'Mitigations')}: -{result.grcAbzug} GRC</>}
          </p>

          {result.warnungen.map(w => (
            <div key={w} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-slate-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{warnungText(w, sprache)}</p>
            </div>
          ))}

          {result.ausserhalbSora && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-brand-red">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-bold leading-relaxed">
                {result.igrc.quelle === 'graue-zelle'
                  ? tx('Diese Kombination ist in der SORA-Tabelle grau („Not part of SORA“). Solche Einsätze fallen in die zulassungspflichtige Kategorie (certified).', 'This combination is a grey cell in the SORA table (“Not part of SORA”). Such operations fall under the certified category.')
                  : tx('Finaler GRC über 7: Das liegt außerhalb von SORA. Solche Einsätze fallen in die zulassungspflichtige Kategorie (certified).', 'Final GRC above 7: this is outside the scope of SORA. Such operations fall under the certified category.')}
              </p>
            </div>
          )}

          {!result.ausserhalbSora && !result.sail && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-slate-800">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {tx('Abmessung über 40 m oder Geschwindigkeit über 200 m/s: Die SORA-Tabelle deckt das nicht ab. Den iGRC nach Annex F bzw. mit der Behörde bestimmen.', 'Dimension above 40 m or speed above 200 m/s: the SORA table does not cover this. Determine the iGRC according to Annex F or with the authority.')}
              </p>
            </div>
          )}

          {/* OSOs List */}
          {result.requiredOsos.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <h3 className="font-bold text-sm text-slate-900">{tx('Erforderliche Operational Safety Objectives (OSOs):', 'Required operational safety objectives (OSOs):')}</h3>
              <div className="space-y-2 text-sm text-slate-700">
                {result.requiredOsos.map(oso => (
                  <div key={oso.nummer} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-green shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-900">{oso.nummer}</strong>{' '}
                      <span className="text-xs font-bold text-brand-blue">({tx('Robustheit', 'robustness')} {robustheitText(oso.robustheit, sprache)})</span>{' '}
                      {sprache === 'en' ? oso.titelEn : oso.titel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 px-1 text-xs text-slate-500 leading-relaxed">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{sprache === 'en' ? HINWEIS_EN : HINWEIS}</p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
