import { useSprache } from '../lib/sprache';
import React, { useId, useState } from 'react';
import { Shield, CheckCircle2, FileText, ChevronRight, AlertTriangle, Info } from 'lucide-react';
import type { Drone, UserProfile } from '../services/db';
import { evaluateSora, generateSoraPdf, robustheitText, HINWEIS, HINWEIS_EN, type SoraInput } from '../services/sora25';
import { Dialog, Knopf, Feld, eingabe } from './ui';

interface Props {
  drones: Drone[];
  profile: UserProfile | null;
  onClose: () => void;
}

export function SoraWizardDialog({ drones, profile, onClose }: Props) {
  const { tx, sprache } = useSprache();
  const id = useId();
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [selectedDroneId, setSelectedDroneId] = useState<string>(drones[0]?.id || '');

  const selectedDrone = drones.find(d => d.id === selectedDroneId);

  const [input, setInput] = useState<SoraInput>({
    operationTitle: 'Gewerblicher Inspektions- / Fotoflug',
    environment: 'sparse',
    visibility: 'vlos',
    airspace: 'uncontrolled',
    maxAltitudeM: 100,
    droneMtomKg: selectedDrone?.weight ? (selectedDrone.weight > 50 ? selectedDrone.weight / 1000 : selectedDrone.weight) : 1.5,
    m1Mitigation: true,
    m2Mitigation: false,
  });

  const result = evaluateSora(input);

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
          <span>{tx('SORA 2.5 Risikobewertung Ausführen', 'Run SORA 2.5 risk assessment')}</span>
          <ChevronRight className="w-4 h-4" />
        </Knopf>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Knopf variante="sekundaer" className="flex-1" onClick={() => setStep('form')}>
            {tx('Parameter Ändern', 'Change parameters')}
          </Knopf>
          <Knopf className="flex-1" icon={FileText} onClick={handleGeneratePdf}>
            <span>{tx('SORA PDF Dossier Exportieren', 'Export SORA PDF dossier')}</span>
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
                  const d = drones.find(dr => dr.id === e.target.value);
                  if (d?.weight) {
                    const mtom = d.weight > 50 ? d.weight / 1000 : d.weight;
                    setInput(prev => ({ ...prev, droneMtomKg: mtom }));
                  }
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
                step="0.1"
                min="0.1"
                className={eingabe}
                value={input.droneMtomKg}
                onChange={e => setInput({ ...input, droneMtomKg: parseFloat(e.target.value) || 1.0 })}
              />
            </Feld>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Feld label={tx('Betriebsumgebung (Ground Environment)', 'Ground environment')} htmlFor={`${id}-umgebung`}>
              <select
                id={`${id}-umgebung`}
                className={`${eingabe} cursor-pointer`}
                value={input.environment}
                onChange={e => setInput({ ...input, environment: e.target.value as SoraInput['environment'] })}
              >
                <option value="controlled">{tx('Kontrollierter Bereich am Boden (Controlled Ground)', 'Controlled ground area')}</option>
                <option value="sparse">{tx('Dünn besiedeltes Gebiet (Sparsely Populated Area)', 'Sparsely populated area')}</option>
                <option value="populated">{tx('Besiedeltes Gebiet (Populated Area)', 'Populated area')}</option>
                <option value="assembly">{tx('Menschenansammlungen (Assemblies of People)', 'Assemblies of people')}</option>
              </select>
            </Feld>

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
          </div>

          <Feld label={tx('Max. Flughöhe (m AGL)', 'Max. altitude (m AGL)')} htmlFor={`${id}-hoehe`}>
            <input
              id={`${id}-hoehe`}
              type="number"
              className={eingabe}
              value={input.maxAltitudeM}
              onChange={e => setInput({ ...input, maxAltitudeM: parseInt(e.target.value) || 120 })}
            />
          </Feld>

          {/* Mitigations Checkboxes */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-sm text-slate-700">
            <h3 className="font-bold text-slate-500 uppercase text-2xs tracking-wider">{tx('Risikominderungsmaßnahmen (Mitigations)', 'Mitigations')}</h3>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 rounded accent-brand-blue cursor-pointer shrink-0"
                checked={input.m1Mitigation}
                onChange={e => setInput({ ...input, m1Mitigation: e.target.checked })}
              />
              <span><strong className="text-slate-900">M1 Mitigation:</strong> {tx('Strategische Bodenpufferzonen & zeitliche/räumliche Isolation (-1 GRC)', 'Strategic ground buffers & temporal/spatial isolation (-1 GRC)')}</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 rounded accent-brand-blue cursor-pointer shrink-0"
                checked={input.m2Mitigation}
                onChange={e => setInput({ ...input, m2Mitigation: e.target.checked })}
              />
              <span><strong className="text-slate-900">M2 Mitigation:</strong> {tx('Notfall-Fallschirm / Aufprallminderung am Boden (-1 GRC)', 'Emergency parachute / ground impact reduction (-1 GRC)')}</span>
            </label>

            {/* SORA 2.5 hat M3 gestrichen - der Notfallplan ist jetzt Teil von OSO #08. */}
            <p className="text-xs text-slate-500 leading-relaxed">
              {tx('Notfallplan (ERP): In SORA 2.5 keine eigene Minderung mehr, sondern Teil von OSO #08.', 'Emergency response plan (ERP): no longer a separate mitigation in SORA 2.5, but part of OSO #08.')}
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
              <p className="text-xl font-black text-slate-900 mt-1">{result.initialGrc}</p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
              <p className="text-xs font-bold text-slate-500">Final GRC</p>
              <p className="text-xl font-black text-brand-green mt-1">{result.finalGrc}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
              <p className="text-xs font-bold text-slate-500">Air Risk Class</p>
              <p className="text-xl font-black text-brand-blue mt-1">{result.finalArc}</p>
            </div>
            <div className="p-3 bg-brand-blue border border-brand-blue rounded-2xl text-center shadow-sm">
              <p className="text-xs font-bold text-white/80">{tx('Ergebnis SAIL', 'Resulting SAIL')}</p>
              <p className="text-xl font-black text-white mt-1">{result.sail}</p>
            </div>
          </div>

          {result.ausserhalbSora && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-brand-red">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-bold leading-relaxed">
                {tx('Finaler GRC über 7: Das liegt außerhalb von SORA. Solche Einsätze fallen in die zulassungspflichtige Kategorie (certified).', 'Final GRC above 7: this is outside the scope of SORA. Such operations fall under the certified category.')}
              </p>
            </div>
          )}

          {/* OSOs List */}
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

          <div className="flex items-start gap-2 px-1 text-xs text-slate-500 leading-relaxed">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{sprache === 'en' ? HINWEIS_EN : HINWEIS}</p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
