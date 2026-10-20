// Präsentationsnahe Ansichten aus App.tsx ausgelagert, um die Hauptdatei zu
// entzerren: Wissen/LBA-Info, Ersatzteil-Inventar und Piloten-Verwaltung.
// Reine View-Komponenten ohne App-weiten Zustand — sie holen sich alles selbst.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Scale, BadgeAlert, XCircle, Landmark, FileText, Globe, ExternalLink,
  Plus, User, ShieldCheck, ShieldAlert, Info, Package, Trash2,
} from 'lucide-react';
import { useSprache } from '../lib/sprache';
import { dbService, type Pilot, type SparePart, type Drone } from '../services/db';
import { bestaetige } from '../services/dialog';
import { DEUTSCHLAND_QUELLEN, EU_QUELLEN, RECHTSGRUNDLAGEN, type Amtslink } from '../services/behoerden';
import { ZONEN_QUELLEN } from '../services/euZones';

export function KnowledgeView() {
  const { t, tx } = useSprache();
  const sections = [
    {
      title: "Die 'Offene' Kategorie",
      icon: Scale,
      content: [
        { label: "A1 (Unter 250g/900g)", text: "Kein Überflug von unbeteiligten Personen (bei <250g toleriert, aber zu vermeiden)." },
        { label: "A2 (Unter 4kg)", text: "Mindestabstand von 30m zu unbeteiligten Personen (Langsammodus 5m). Fernpiloten-Zeugnis erforderlich." },
        { label: "A3 (Unter 25kg)", text: "Fernhalten von Menschen. Mind. 150m Abstand zu Wohn-, Gewerbe- oder Industriegebieten." }
      ]
    },
    {
      title: "Grundregeln & Pflichten",
      icon: BadgeAlert,
      content: [
        { label: "Registrierung (e-ID)", text: "Nahezu JEDER Betreiber muss sich beim LBA registrieren. Die e-ID muss sichtbar auf der Drohne angebracht sein." },
        { label: "Versicherung", text: "Eine Haftpflichtversicherung ist in Deutschland gesetzlich vorgeschrieben – auch für kleinste Drohnen." },
        { label: "Sichtverbindung (VLOS)", text: "Der Betrieb ist nur in direkter Sichtweite des Fernpiloten zulässig." }
      ]
    },
    {
      title: "Verbote",
      icon: XCircle,
      content: [
        { label: "Flughäfen", text: "Strikte Verbotszonen rund um Flugplätze und Hubschrauberlandeplätze." },
        { label: "Einsatzorte", text: "Verbot über Wohngrundstücken (wenn Kamera vorhanden), Naturschutzgebieten und Menschenansammlungen." },
        { label: "Höhenlimit", text: "Die maximale Flughöhe beträgt in der Regel 120 Meter über Grund." }
      ]
    }
  ];

  return (
    <div className="max-w-md lg:max-w-3xl mx-auto pb-12">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('view.lbaWissen')}</h2>
        <p className="text-slate-500 text-sm font-medium">{tx('Offizielle Regeln & Informationen', 'Official rules & information')}</p>
      </div>

      <div className="space-y-8">
        {sections.map((section, idx) => (
          <div key={idx}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-brand-blue/10 rounded-xl">
                <section.icon className="w-5 h-5 text-brand-blue" />
              </div>
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">{section.title}</h3>
            </div>

            <div className="space-y-3">
              {section.content.map((item, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-2xs font-black text-brand-blue uppercase mb-1">{item.label}</p>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Behörden- und Rechts-Verzeichnis */}
      <div className="mt-12 space-y-8">
        <AmtslinkGruppe titel="Behörden in Deutschland" icon={Landmark} links={DEUTSCHLAND_QUELLEN} />
        <AmtslinkGruppe titel="EU-Ebene" icon={Scale} links={EU_QUELLEN} />
        <AmtslinkGruppe titel="Rechtsgrundlagen (EU-Verordnungen)" icon={FileText} links={RECHTSGRUNDLAGEN} />

        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-brand-blue/10 rounded-xl">
              <Globe className="w-5 h-5 text-brand-blue" />
            </div>
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">{tx('Amtliche Geozonen nach Land', 'Official geozones by country')}</h3>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {ZONEN_QUELLEN.map(q => (
              <a
                key={q.code}
                href={q.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <span className="text-xs font-bold text-slate-700">{q.land}</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              </a>
            ))}
          </div>
          <p className="text-2xs text-slate-400 mt-2 leading-relaxed">
            {tx('Links führen zu den amtlichen Geozonen-Quellen der jeweiligen Luftfahrtbehörde.', 'Links lead to the official geozone sources of each aviation authority.')}
          </p>
        </div>
      </div>

      <p className="mt-8 text-2xs text-slate-400 leading-relaxed text-center">
        {tx('Diese Sammlung ist eine Orientierungshilfe. Rechtlich bindend sind allein die amtlichen Quellen.', 'This collection is for orientation only. Only the official sources are legally binding.')}
      </p>
    </div>
  );
}

/** Eine Gruppe amtlicher Links als Karten-Liste in der Wissens-Ansicht. */
function AmtslinkGruppe({ titel, icon: Icon, links }: {
  titel: string;
  icon: typeof Scale;
  links: Amtslink[];
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-brand-blue/10 rounded-xl">
          <Icon className="w-5 h-5 text-brand-blue" />
        </div>
        <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">{titel}</h3>
      </div>
      <div className="space-y-3">
        {links.map((l, i) => (
          <a
            key={i}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-brand-blue/40"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-slate-900 leading-snug">{l.name}</p>
              <p className="text-2xs text-slate-500 leading-relaxed mt-1">{l.beschreibung}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
          </a>
        ))}
      </div>
    </div>
  );
}

export function InventoryView() {
  const { t, tx } = useSprache();
  const [teile, setTeile] = useState<SparePart[]>([]);
  const [drohnen, setDrohnen] = useState<Drone[]>([]);
  const [zeigeForm, setZeigeForm] = useState(false);
  const [neu, setNeu] = useState<Partial<SparePart>>({ anzahl: 1 });

  const laden = async () => {
    const [t1, d1] = await Promise.all([dbService.getSpareParts(), dbService.getDrones()]);
    setTeile(t1);
    setDrohnen(d1);
  };

  useEffect(() => {
    laden();
  }, []);

  const speichern = async () => {
    if (!neu.name?.trim()) return;
    const link = neu.link?.trim();
    await dbService.saveSparePart({
      id: crypto.randomUUID(),
      name: neu.name.trim(),
      beschreibung: neu.beschreibung?.trim() || undefined,
      anzahl: Math.max(0, Math.floor(neu.anzahl ?? 0)),
      mindestAnzahl: neu.mindestAnzahl ? Math.max(0, Math.floor(neu.mindestAnzahl)) : undefined,
      // Nur echte Web-Links zulassen (kein javascript: o.ae.)
      link: link && /^https?:\/\//i.test(link) ? link : undefined,
      droneId: neu.droneId || undefined,
      createdAt: Date.now(),
    });
    setNeu({ anzahl: 1 });
    setZeigeForm(false);
    laden();
  };

  const aendereAnzahl = async (teil: SparePart, delta: number) => {
    await dbService.saveSparePart({ ...teil, anzahl: Math.max(0, teil.anzahl + delta) });
    laden();
  };

  const loeschen = async (teil: SparePart) => {
    if (!await bestaetige(`„${teil.name}" aus dem Inventar löschen?`, { gefaehrlich: true })) return;
    await dbService.deleteSparePart(teil.id);
    laden();
  };

  const knapp = (teil: SparePart) => teil.mindestAnzahl !== undefined && teil.anzahl <= teil.mindestAnzahl;
  const drohnenName = (id?: string) => drohnen.find(d => d.id === id)?.name;

  return (
    <div className="max-w-md lg:max-w-3xl mx-auto pb-12">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-brand-blue">{t('view.ersatzteile')}</h2>
          <p className="text-slate-500 font-medium uppercase tracking-wider text-2xs">{tx('Ersatzteile, Bestand & Links', 'Spare parts, stock & links')}</p>
        </div>
        <button
          onClick={() => setZeigeForm(v => !v)}
          className="flex items-center gap-1.5 bg-brand-blue text-white text-xs font-bold px-3 py-2 rounded-xl shadow-lg shadow-brand-blue/20"
        >
          <Plus className="w-4 h-4" /> {tx('Teil', 'Part')}
        </button>
      </div>

      {zeigeForm && (
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-6 space-y-3">
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900"
            placeholder={tx('Name, z.B. Propeller-Satz Mini 4 Pro', 'Name, e.g. propeller set Mini 4 Pro')}
            value={neu.name ?? ''}
            onChange={e => setNeu({ ...neu, name: e.target.value })}
          />
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900"
            placeholder={tx('Beschreibung (optional)', 'Description (optional)')}
            value={neu.beschreibung ?? ''}
            onChange={e => setNeu({ ...neu, beschreibung: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-2xs font-bold text-slate-600">
              {tx('Anzahl', 'Quantity')}
              <input type="number" min={0}
                className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900"
                value={neu.anzahl ?? 0}
                onChange={e => setNeu({ ...neu, anzahl: Number(e.target.value) })}
              />
            </label>
            <label className="text-2xs font-bold text-slate-600">
              {tx('Warnen ab (optional)', 'Warn at (optional)')}
              <input type="number" min={0}
                className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900"
                value={neu.mindestAnzahl ?? ''}
                onChange={e => setNeu({ ...neu, mindestAnzahl: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </label>
          </div>
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900"
            placeholder={tx('Link zu STL-Datei oder Shop (https://…)', 'Link to STL file or shop (https://…)')}
            value={neu.link ?? ''}
            onChange={e => setNeu({ ...neu, link: e.target.value })}
          />
          <select
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900"
            value={neu.droneId ?? ''}
            onChange={e => setNeu({ ...neu, droneId: e.target.value })}
          >
            <option value="">{tx('Keiner Drohne zugeordnet', 'Not assigned to a drone')}</option>
            {drohnen.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setZeigeForm(false)} className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl">
              {t('aktion.abbrechen')}
            </button>
            <button onClick={speichern} disabled={!neu.name?.trim()}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-brand-blue rounded-xl disabled:opacity-50">
              {tx('Speichern', 'Save')}
            </button>
          </div>
        </div>
      )}

      {teile.length === 0 && !zeigeForm ? (
        <div className="p-10 bg-white border border-dashed border-slate-200 rounded-3xl text-center">
          <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-600">{tx('Noch keine Ersatzteile erfasst.', 'No spare parts recorded yet.')}</p>
          <p className="text-2xs text-slate-500 mt-1">{tx('Propeller, Akku-Ersatz, gedruckte Teile – mit Bestand und Link.', 'Propellers, spare batteries, printed parts – with stock and link.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teile.map(teil => (
            <div key={teil.id} className={`bg-white p-4 rounded-3xl border shadow-sm flex items-center gap-3 ${knapp(teil) ? 'border-amber-300' : 'border-slate-200'}`}>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-slate-900 text-sm truncate">{teil.name}</h4>
                {teil.beschreibung && <p className="text-2xs text-slate-500 truncate">{teil.beschreibung}</p>}
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {drohnenName(teil.droneId) && (
                    <span className="text-2xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{drohnenName(teil.droneId)}</span>
                  )}
                  {knapp(teil) && (
                    <span className="text-2xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">{tx('Bestand knapp', 'Low stock')}</span>
                  )}
                  {teil.link && (
                    <a href={teil.link} target="_blank" rel="noopener noreferrer"
                      className="text-2xs font-bold text-brand-blue inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Link
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => aendereAnzahl(teil, -1)} aria-label={tx('Eins weniger', 'One less')}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-black">−</button>
                <span className="w-8 text-center font-black text-slate-900 tabular-nums">{teil.anzahl}</span>
                <button onClick={() => aendereAnzahl(teil, 1)} aria-label={tx('Eins mehr', 'One more')}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-black">+</button>
                <button onClick={() => loeschen(teil)} aria-label={tx('Löschen', 'Delete')}
                  className="w-8 h-8 rounded-xl text-slate-500 hover:text-brand-red flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PilotsView() {
  const { t, tx } = useSprache();
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newPilot, setNewPilot] = useState<Partial<Pilot>>({ isGuest: true });

  const loadPilots = async () => {
    const list = await dbService.getPilots();
    setPilots(list);
  };

  useEffect(() => {
    loadPilots();
  }, []);

  const handleAddPilot = async () => {
    if (!newPilot.name || !newPilot.eid) return;
    await dbService.savePilot({
      id: crypto.randomUUID(),
      name: newPilot.name,
      eid: newPilot.eid,
      isGuest: !!newPilot.isGuest,
      createdAt: Date.now()
    } as Pilot);
    setNewPilot({ isGuest: true });
    setShowAdd(false);
    loadPilots();
  };

  const handleDelete = async (id: string) => {
    await dbService.deletePilot(id);
    loadPilots();
  };

  return (
    <div className="max-w-md lg:max-w-3xl mx-auto pb-12">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand-blue">{t('view.pilotenManagement')}</h2>
        <p className="text-slate-500 text-sm font-medium uppercase tracking-wider text-2xs">{tx('LBA Registrierungen & Gast-Zugänge', 'LBA registrations & guest access')}</p>
      </div>

      <div className="space-y-4">
        {pilots.length === 0 && !showAdd && (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{tx('Keine Gast-Piloten hinterlegt', 'No guest pilots added')}</p>
          </div>
        )}

        {pilots.map(pilot => (
          <div key={pilot.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
             {pilot.isGuest && (
               <div className="absolute top-0 right-0 px-3 py-1 bg-amber-700 text-white text-2xs font-black uppercase tracking-wider rounded-bl-xl">
                 {tx('Gast', 'Guest')}
               </div>
             )}
             <div className="flex items-center gap-4 mb-4">
               <div className="w-12 h-12 rounded-2xl bg-brand-blue/5 flex items-center justify-center border border-brand-blue/10">
                 <User className="w-6 h-6 text-brand-blue" />
               </div>
               <div>
                 <h4 className="font-bold text-slate-900">{pilot.name}</h4>
                 <p className="text-2xs font-black text-slate-400 uppercase tracking-wider font-mono">{pilot.eid}</p>
               </div>
             </div>

             <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-1.5">
                   <ShieldCheck className="w-3.5 h-3.5 text-brand-green" />
                   <span className="text-2xs font-bold text-slate-500 uppercase tracking-tight">{tx('Status: Aktiv', 'Status: active')}</span>
                </div>
                <button
                  onClick={() => handleDelete(pilot.id)}
                  className="text-2xs font-black text-slate-300 hover:text-brand-red uppercase tracking-wider transition-colors"
                >
                  {tx('Löschen', 'Delete')}
                </button>
             </div>
          </div>
        ))}

        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
               <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-4 shadow-xl">
                  <h4 className="font-bold text-sm uppercase tracking-wider text-slate-400">{tx('Gast hinzufügen', 'Add guest')}</h4>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder={tx('Name des Gastes', 'Guest name')}
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30"
                      value={newPilot.name || ''}
                      onChange={e => setNewPilot({...newPilot, name: e.target.value})}
                    />
                    <input
                      type="text"
                      placeholder={tx('LBA Betreiber-ID (e-ID)', 'LBA operator ID (e-ID)')}
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-white/30"
                      value={newPilot.eid || ''}
                      onChange={e => setNewPilot({...newPilot, eid: e.target.value})}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAdd(false)} className="flex-1 py-3 bg-white/5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-white/10 transition-colors">{t('aktion.abbrechen')}</button>
                    <button onClick={handleAddPilot} className="flex-1 py-3 bg-brand-blue rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-600 transition-colors">{tx('Speichern', 'Save')}</button>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full p-6 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 flex flex-col items-center gap-2 hover:bg-white hover:border-brand-blue/30 transition-all group"
          >
            <Plus className="w-8 h-8 group-hover:text-brand-blue transition-colors" />
            <span className="text-2xs font-black uppercase tracking-wider group-hover:text-slate-600 transition-colors">{tx('Gast-Piloten hinzufügen', 'Add guest pilots')}</span>
          </button>
        )}
      </div>

      <div className="mt-10 p-6 bg-amber-50 border border-amber-100 rounded-3xl relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 opacity-5">
           <ShieldAlert className="w-24 h-24 text-amber-900" />
        </div>
        <div className="flex gap-3 relative z-10">
          <Info className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="space-y-2">
            <h4 className="text-2xs font-black text-amber-700 uppercase tracking-wider">{tx('Versicherungs-Hinweis', 'Insurance note')}</h4>
            <p className="text-xs text-amber-800/80 leading-relaxed font-medium">
              {tx('Stelle sicher, dass Gast-Piloten durch deine Drohnen-Haftpflicht mitversichert sind. Die LBA e-ID des verantwortlichen Luftfahrzeugfernsteuerers muss am Gerät verbleiben.', 'Make sure guest pilots are covered by your drone liability insurance. The LBA e-ID of the responsible remote pilot must remain on the aircraft.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
