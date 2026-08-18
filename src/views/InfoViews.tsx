// Präsentationsnahe Ansichten aus App.tsx ausgelagert, um die Hauptdatei zu
// entzerren: Wissen/LBA-Info, Inventar (3D-Druck) und Piloten-Verwaltung.
// Reine View-Komponenten ohne App-weiten Zustand — sie holen sich alles selbst.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale, BadgeAlert, XCircle, Landmark, FileText, Globe, ExternalLink,
  Printer, Cpu, Download, Plus, User, ShieldCheck, ShieldAlert, Info,
} from 'lucide-react';
import { useSprache } from '../lib/sprache';
import { dbService, type Pilot, type SparePart } from '../services/db';
import { DEUTSCHLAND_QUELLEN, EU_QUELLEN, RECHTSGRUNDLAGEN, type Amtslink } from '../services/behoerden';
import { ZONEN_QUELLEN } from '../services/euZones';

export function KnowledgeView() {
  const { t } = useSprache();
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
        <p className="text-slate-500 text-sm font-medium">Offizielle Regeln & Informationen</p>
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
                  <p className="text-[10px] font-black text-brand-blue uppercase mb-1">{item.label}</p>
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
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">Amtliche Geozonen nach Land</h3>
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
          <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
            Links führen zu den amtlichen Geozonen-Quellen der jeweiligen Luftfahrtbehörde.
          </p>
        </div>
      </div>

      <p className="mt-8 text-[10px] text-slate-400 leading-relaxed text-center">
        Diese Sammlung ist eine Orientierungshilfe. Rechtlich bindend sind allein die amtlichen Quellen.
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
              <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{l.beschreibung}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
          </a>
        ))}
      </div>
    </div>
  );
}

export function InventoryView() {
  const { t } = useSprache();
  const [parts] = useState<SparePart[]>([
    { id: '1', name: 'Landegestell DJI Mini 3', description: '3D-gedrucktes Landegestell für hohe Gräser.', stlUrl: '#', printable: true },
    { id: '2', name: 'Kameraschutz Sonnenblende', description: 'Reduziert Lens-Flare bei tiefstehender Sonne.', stlUrl: '#', printable: true },
    { id: '3', name: 'e-ID Halterung', description: 'Clip-on Halterung für die LBA Plakette.', stlUrl: '#', printable: true }
  ]);

  const [bambuStatus] = useState({ state: 'Idle', progress: 0, model: '-' });

  return (
    <div className="max-w-md lg:max-w-3xl mx-auto pb-12">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand-blue">{t('view.ersatzteile')}</h2>
        <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">3D-Druck & Hardware Verwaltung</p>
      </div>

      <div className="bg-slate-900 text-white p-6 rounded-[32px] mb-8 shadow-xl shadow-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <Printer className="w-6 h-6 text-brand-green" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Bambu Lab A1</p>
              <h4 className="font-bold">Heim-Werkstatt</h4>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest">Nicht verbunden</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight text-slate-400">
            <span>Status</span>
            <span className="text-slate-500 font-mono">Offline</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
             <div className="h-full bg-slate-600 transition-all" style={{ width: `0%` }} />
          </div>
          <p className="text-[10px] text-slate-500 italic">Bambu API-Token in den Einstellungen hinterlegen, um den Drucker zu verbinden.</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Verfügbare STL-Dateien</h3>
        {parts.map(part => (
          <div key={part.id} className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-brand-blue/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-brand-blue/5 transition-colors">
                <Cpu className="w-6 h-6 text-slate-400 group-hover:text-brand-blue transition-colors" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{part.name}</h4>
                <p className="text-[10px] text-slate-500 font-medium">{part.description}</p>
              </div>
            </div>
            <button className="p-3 bg-brand-blue/5 text-brand-blue rounded-2xl hover:bg-brand-blue hover:text-white transition-all shadow-sm">
              <Download className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-10 p-10 bg-white border border-slate-200 rounded-[32px] text-center border-dashed group hover:bg-slate-50 transition-colors cursor-pointer">
         <Plus className="w-8 h-8 text-slate-300 mx-auto mb-2 group-hover:text-brand-blue transition-colors" />
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed group-hover:text-slate-600 transition-colors">Eigene CAD-Daten verknüpfen</p>
      </div>
    </div>
  );
}

export function PilotsView() {
  const { t } = useSprache();
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
        <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">LBA Registrierungen & Gast-Zugänge</p>
      </div>

      <div className="space-y-4">
        {pilots.length === 0 && !showAdd && (
          <div className="bg-white p-8 rounded-[32px] border border-slate-200 text-center">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Keine Gast-Piloten hinterlegt</p>
          </div>
        )}

        {pilots.map(pilot => (
          <div key={pilot.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
             {pilot.isGuest && (
               <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-xl">
                 Gast
               </div>
             )}
             <div className="flex items-center gap-4 mb-4">
               <div className="w-12 h-12 rounded-2xl bg-brand-blue/5 flex items-center justify-center border border-brand-blue/10">
                 <User className="w-6 h-6 text-brand-blue" />
               </div>
               <div>
                 <h4 className="font-bold text-slate-900">{pilot.name}</h4>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">{pilot.eid}</p>
               </div>
             </div>

             <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-1.5">
                   <ShieldCheck className="w-3.5 h-3.5 text-brand-green" />
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Status: Aktiv</span>
                </div>
                <button
                  onClick={() => handleDelete(pilot.id)}
                  className="text-[10px] font-black text-slate-300 hover:text-brand-red uppercase tracking-widest transition-colors"
                >
                  Löschen
                </button>
             </div>
          </div>
        ))}

        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
               <div className="bg-slate-900 text-white p-6 rounded-[32px] space-y-4 shadow-xl">
                  <h4 className="font-bold text-sm uppercase tracking-widest text-slate-400">Gast hinzufügen</h4>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Name des Gastes"
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30"
                      value={newPilot.name || ''}
                      onChange={e => setNewPilot({...newPilot, name: e.target.value})}
                    />
                    <input
                      type="text"
                      placeholder="LBA Betreiber-ID (e-ID)"
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-white/30"
                      value={newPilot.eid || ''}
                      onChange={e => setNewPilot({...newPilot, eid: e.target.value})}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAdd(false)} className="flex-1 py-3 bg-white/5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-colors">{t('aktion.abbrechen')}</button>
                    <button onClick={handleAddPilot} className="flex-1 py-3 bg-brand-blue rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-colors">Speichern</button>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full p-6 border-2 border-dashed border-slate-200 rounded-[32px] text-slate-400 flex flex-col items-center gap-2 hover:bg-white hover:border-brand-blue/30 transition-all group"
          >
            <Plus className="w-8 h-8 group-hover:text-brand-blue transition-colors" />
            <span className="text-[10px] font-black uppercase tracking-widest group-hover:text-slate-600 transition-colors">Gast-Piloten hinzufügen</span>
          </button>
        )}
      </div>

      <div className="mt-10 p-6 bg-amber-50 border border-amber-100 rounded-[32px] relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 opacity-5">
           <ShieldAlert className="w-24 h-24 text-amber-900" />
        </div>
        <div className="flex gap-3 relative z-10">
          <Info className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Versicherungs-Hinweis</h4>
            <p className="text-xs text-amber-800/80 leading-relaxed font-medium">
              Stelle sicher, dass Gast-Piloten durch deine Drohnen-Haftpflicht mitversichert sind. Die LBA e-ID des verantwortlichen Luftfahrzeugfernsteuerers muss am Gerät verbleiben.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
