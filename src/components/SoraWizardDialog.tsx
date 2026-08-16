import React, { useState } from 'react';
import { X, FileCheck, Shield, CheckCircle2, FileText, ChevronRight, HelpCircle } from 'lucide-react';
import type { Drone, UserProfile } from '../services/db';
import { evaluateSora, generateSoraPdf, type SoraInput } from '../services/sora25';

interface Props {
  drones: Drone[];
  profile: UserProfile | null;
  onClose: () => void;
}

export function SoraWizardDialog({ drones, profile, onClose }: Props) {
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
    m3Mitigation: true,
  });

  const result = evaluateSora(input);

  const handleGeneratePdf = () => {
    generateSoraPdf(input, result, selectedDrone || null, profile);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[160] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-base">EASA SORA 2.5 — ConOps & Behörden-Assistent</h2>
              <p className="text-xs text-slate-400">Erstellung behördengerechter Betriebsanträge (Spezifische Kategorie)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {step === 'form' ? (
            <div className="space-y-5">
              <div>
                <label className="font-bold text-slate-300 block mb-1.5">Bezeichnung des Flugvorhabens / ConOps Title</label>
                <input
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  value={input.operationTitle}
                  onChange={e => setInput({ ...input, operationTitle: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-300 block mb-1.5">Eingesetzte Drohne</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
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
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1.5">MTOM Abflugmasse (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    value={input.droneMtomKg}
                    onChange={e => setInput({ ...input, droneMtomKg: parseFloat(e.target.value) || 1.0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-300 block mb-1.5">Betriebsumgebung (Ground Environment)</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    value={input.environment}
                    onChange={e => setInput({ ...input, environment: e.target.value as any })}
                  >
                    <option value="controlled">Kontrollierter Bereich am Boden (Controlled Ground)</option>
                    <option value="sparse">Dünn besiedeltes Gebiet (Sparsely Populated Area)</option>
                    <option value="populated">Besiedeltes Gebiet (Populated Area)</option>
                    <option value="assembly">Menschenansammlungen (Assemblies of People)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1.5">Luftraumklasse (Airspace)</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    value={input.airspace}
                    onChange={e => setInput({ ...input, airspace: e.target.value as any })}
                  >
                    <option value="uncontrolled">Unkontrollierter Luftraum (G / E)</option>
                    <option value="controlled">Kontrollierter Luftraum (CTR / C / D)</option>
                    <option value="airport">Flughafennahbereich / CTR</option>
                    <option value="prohibited">Sperrgebiet / ED-R</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1.5">Max. Flughöhe (m AGL)</label>
                <input
                  type="number"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  value={input.maxAltitudeM}
                  onChange={e => setInput({ ...input, maxAltitudeM: parseInt(e.target.value) || 120 })}
                />
              </div>

              {/* Mitigations Checkboxes */}
              <div className="p-4 bg-slate-800/60 border border-slate-700/80 rounded-2xl space-y-3">
                <h4 className="font-bold text-indigo-400 uppercase text-[10px] tracking-wider">Risikominderungsmaßnahmen (Mitigations)</h4>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                    checked={input.m1Mitigation}
                    onChange={e => setInput({ ...input, m1Mitigation: e.target.checked })}
                  />
                  <span><strong>M1 Mitigation:</strong> Strategische Bodenpufferzonen & zeitliche/räumliche Isolation (-1 GRC)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                    checked={input.m2Mitigation}
                    onChange={e => setInput({ ...input, m2Mitigation: e.target.checked })}
                  />
                  <span><strong>M2 Mitigation:</strong> Notfall-Fallschirm / Aufprallminderung am Boden (-1 GRC)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                    checked={input.m3Mitigation}
                    onChange={e => setInput({ ...input, m3Mitigation: e.target.checked })}
                  />
                  <span><strong>M3 Mitigation:</strong> Validierter Notfallaktionsplan (Emergency Response Plan - ERP) (-1 GRC)</span>
                </label>
              </div>

              <button
                onClick={() => setStep('result')}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold text-sm text-white shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all"
              >
                <span>SORA 2.5 Risikobewertung Ausführen</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Result Step */
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-2xl text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Initial GRC</p>
                  <p className="text-xl font-black text-slate-200 mt-1">{result.initialGrc}</p>
                </div>
                <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-2xl text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Final GRC</p>
                  <p className="text-xl font-black text-emerald-400 mt-1">{result.finalGrc}</p>
                </div>
                <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-2xl text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Air Risk Class</p>
                  <p className="text-xl font-black text-sky-400 mt-1">{result.finalArc}</p>
                </div>
                <div className="p-3 bg-indigo-600 border border-indigo-500 rounded-2xl text-center shadow-lg shadow-indigo-600/20">
                  <p className="text-[10px] text-indigo-200 uppercase font-bold">Ergebnis SAIL</p>
                  <p className="text-xl font-black text-white mt-1">{result.sail}</p>
                </div>
              </div>

              {/* OSOs List */}
              <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-2xl space-y-3">
                <h4 className="font-bold text-sm text-indigo-400">Erforderliche Operational Safety Objectives (OSOs):</h4>
                <div className="space-y-2 text-slate-300">
                  {result.requiredOsos.map((oso, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{oso}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => setStep('form')}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-slate-300 text-xs"
                >
                  Parameter Ändern
                </button>
                <button
                  onClick={handleGeneratePdf}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-xs shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>SORA PDF Dossier Exportieren</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
