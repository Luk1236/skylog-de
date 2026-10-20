// Präsentationsnahe Ansichten aus App.tsx ausgelagert, um die Hauptdatei zu
// entzerren: Recht & Wissen, Ersatzteil-Inventar und Piloten-Verwaltung.
// Reine View-Komponenten ohne App-weiten Zustand — sie holen sich alles selbst.

import { useState, useEffect } from 'react';
import {
  Scale, BadgeAlert, XCircle, Landmark, FileText, Globe, ExternalLink,
  Plus, User, ShieldCheck, Info, Package, Trash2, Minus,
} from 'lucide-react';
import { useSprache } from '../lib/sprache';
import { dbService, type Pilot, type SparePart, type Drone } from '../services/db';
import { zeigeRueckgaengig } from '../services/rueckgaengig';
import { DEUTSCHLAND_QUELLEN, EU_QUELLEN, RECHTSGRUNDLAGEN, type Amtslink } from '../services/behoerden';
import { ZONEN_QUELLEN } from '../services/euZones';
import { Feld, IconKnopf, Knopf, SeitenKopf, eingabe } from '../components/ui';
import { cn } from '../lib/utils';

export function KnowledgeView() {
  const { t, tx, sprache } = useSprache();
  const sections = [
    {
      title: tx('Die offene Kategorie', 'The open category'),
      icon: Scale,
      content: [
        { label: tx('A1 (unter 250 g / 900 g)', 'A1 (under 250 g / 900 g)'), text: tx('Kein Überflug unbeteiligter Personen (unter 250 g geduldet, aber zu vermeiden).', 'No flying over uninvolved people (tolerated under 250 g, but avoid it).') },
        { label: tx('A2 (unter 4 kg)', 'A2 (under 4 kg)'), text: tx('Mindestens 30 m Abstand zu unbeteiligten Personen (im Langsammodus 5 m). Fernpiloten-Zeugnis erforderlich.', 'At least 30 m from uninvolved people (5 m in low-speed mode). Remote pilot certificate required.') },
        { label: tx('A3 (unter 25 kg)', 'A3 (under 25 kg)'), text: tx('Fern von Menschen. Mindestens 150 m Abstand zu Wohn-, Gewerbe- und Industriegebieten.', 'Away from people. At least 150 m from residential, commercial and industrial areas.') },
      ],
    },
    {
      title: tx('Grundregeln & Pflichten', 'Basic rules & duties'),
      icon: BadgeAlert,
      content: [
        { label: tx('Registrierung (e-ID)', 'Registration (e-ID)'), text: tx('Fast jeder Betreiber muss sich beim LBA registrieren. Die e-ID muss sichtbar an der Drohne angebracht sein.', 'Almost every operator must register with the LBA. The e-ID must be visible on the drone.') },
        { label: tx('Versicherung', 'Insurance'), text: tx('Eine Haftpflichtversicherung ist in Deutschland vorgeschrieben – auch für die kleinsten Drohnen.', 'Liability insurance is mandatory in Germany – even for the smallest drones.') },
        { label: tx('Sichtverbindung (VLOS)', 'Visual line of sight (VLOS)'), text: tx('Geflogen werden darf nur in direkter Sichtweite des Fernpiloten.', 'Flying is only allowed within the remote pilot’s direct line of sight.') },
      ],
    },
    {
      title: tx('Verbote', 'Prohibitions'),
      icon: XCircle,
      content: [
        { label: tx('Flugplätze', 'Airfields'), text: tx('Verbotszonen rund um Flugplätze und Hubschrauberlandeplätze.', 'No-fly zones around airfields and helipads.') },
        { label: tx('Einsatzorte', 'Locations'), text: tx('Kein Überflug von Wohngrundstücken (Drohne über 250 g oder mit Kamera), Naturschutzgebieten und Menschenansammlungen.', 'No flying over residential property (drone over 250 g or with a camera), nature reserves and crowds.') },
        { label: tx('Höhengrenze', 'Height limit'), text: tx('Die maximale Flughöhe beträgt in der Regel 120 m über Grund.', 'The maximum height is usually 120 m above ground.') },
      ],
    },
  ];

  return (
    <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto pb-12">
      <SeitenKopf titel={t('view.lbaWissen')} untertitel={tx('Regeln, Behörden & Rechtsquellen', 'Rules, authorities & legal sources')} />

      <div className="space-y-8">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-brand-blue/10 rounded-xl">
                <section.icon className="w-5 h-5 text-brand-blue" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">{section.title}</h3>
            </div>

            <div className="space-y-3">
              {section.content.map((item) => (
                <div key={item.label} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-sm font-bold text-brand-blue mb-1">{item.label}</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Behörden- und Rechts-Verzeichnis */}
      <div className="mt-12 space-y-8">
        <AmtslinkGruppe titel={tx('Behörden in Deutschland', 'Authorities in Germany')} icon={Landmark} links={DEUTSCHLAND_QUELLEN} />
        <AmtslinkGruppe titel={tx('EU-Ebene', 'EU level')} icon={Scale} links={EU_QUELLEN} />
        <AmtslinkGruppe titel={tx('Rechtsgrundlagen (EU-Verordnungen)', 'Legal basis (EU regulations)')} icon={FileText} links={RECHTSGRUNDLAGEN} />

        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-brand-blue/10 rounded-xl">
              <Globe className="w-5 h-5 text-brand-blue" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">{tx('Amtliche Geozonen nach Land', 'Official geozones by country')}</h3>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-200">
            {ZONEN_QUELLEN.map(q => (
              <a
                key={q.code}
                href={q.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-4 h-12 hover:bg-slate-50"
              >
                <span className="text-sm font-bold text-slate-700">{sprache === 'en' ? q.landEn : q.land}</span>
                <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
              </a>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            {tx('Die Links führen zu den amtlichen Geozonen-Quellen der jeweiligen Luftfahrtbehörde.', 'The links lead to the official geozone sources of each aviation authority.')}
          </p>
        </div>
      </div>

      <p className="mt-8 text-xs text-slate-500 leading-relaxed text-center">
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
  const { sprache } = useSprache();
  const en = sprache === 'en';
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-brand-blue/10 rounded-xl">
          <Icon className="w-5 h-5 text-brand-blue" />
        </div>
        <h3 className="font-bold text-slate-900 text-sm">{titel}</h3>
      </div>
      <div className="space-y-3">
        {links.map((l) => (
          <a
            key={l.url}
            href={en ? l.urlEn ?? l.url : l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-brand-blue/40"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 leading-snug">{en ? l.nameEn ?? l.name : l.name}</p>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">{en ? l.beschreibungEn : l.beschreibung}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
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
    await dbService.deleteSparePart(teil.id);
    laden();
    zeigeRueckgaengig(tx(`„${teil.name}“ gelöscht`, `“${teil.name}” deleted`), async () => {
      await dbService.saveSparePart(teil);
      laden();
    });
  };

  const knapp = (teil: SparePart) => teil.mindestAnzahl !== undefined && teil.anzahl <= teil.mindestAnzahl;
  const drohnenName = (id?: string) => drohnen.find(d => d.id === id)?.name;

  return (
    <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto pb-12">
      <SeitenKopf
        titel={t('view.ersatzteile')}
        untertitel={tx('Ersatzteile, Bestand & Links', 'Spare parts, stock & links')}
        aktionen={
          <Knopf icon={zeigeForm ? XCircle : Plus} onClick={() => setZeigeForm(v => !v)}>
            {zeigeForm ? tx('Schließen', 'Close') : tx('Teil hinzufügen', 'Add part')}
          </Knopf>
        }
      />

      {zeigeForm && (
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-6 space-y-3">
          <Feld label={tx('Name', 'Name')} htmlFor="et-name">
            <input id="et-name" className={eingabe} placeholder={tx('z. B. Propeller-Satz Mini 4 Pro', 'e.g. propeller set Mini 4 Pro')} value={neu.name ?? ''} onChange={e => setNeu({ ...neu, name: e.target.value })} />
          </Feld>
          <Feld label={tx('Beschreibung (optional)', 'Description (optional)')} htmlFor="et-text">
            <input id="et-text" className={eingabe} value={neu.beschreibung ?? ''} onChange={e => setNeu({ ...neu, beschreibung: e.target.value })} />
          </Feld>
          <div className="grid grid-cols-2 gap-3">
            <Feld label={tx('Anzahl', 'Quantity')} htmlFor="et-anzahl">
              <input id="et-anzahl" type="number" min={0} className={eingabe} value={neu.anzahl ?? 0} onChange={e => setNeu({ ...neu, anzahl: Number(e.target.value) })} />
            </Feld>
            <Feld label={tx('Warnen ab (optional)', 'Warn at (optional)')} htmlFor="et-min">
              <input id="et-min" type="number" min={0} className={eingabe} value={neu.mindestAnzahl ?? ''} onChange={e => setNeu({ ...neu, mindestAnzahl: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </Feld>
          </div>
          <Feld label={tx('Link zu STL-Datei oder Shop', 'Link to STL file or shop')} htmlFor="et-link">
            <input id="et-link" className={eingabe} placeholder="https://…" value={neu.link ?? ''} onChange={e => setNeu({ ...neu, link: e.target.value })} />
          </Feld>
          <Feld label={tx('Drohne', 'Drone')} htmlFor="et-drohne">
            <select id="et-drohne" className={eingabe} value={neu.droneId ?? ''} onChange={e => setNeu({ ...neu, droneId: e.target.value })}>
              <option value="">{tx('Keiner Drohne zugeordnet', 'Not assigned to a drone')}</option>
              {drohnen.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Feld>
          <div className="flex gap-2">
            <Knopf variante="sekundaer" onClick={() => setZeigeForm(false)}>{t('aktion.abbrechen')}</Knopf>
            <Knopf className="flex-1" onClick={speichern} disabled={!neu.name?.trim()}>{tx('Speichern', 'Save')}</Knopf>
          </div>
        </div>
      )}

      {teile.length === 0 && !zeigeForm ? (
        <div className="p-10 bg-white border border-dashed border-slate-200 rounded-3xl text-center">
          <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-600">{tx('Noch keine Ersatzteile erfasst.', 'No spare parts recorded yet.')}</p>
          <p className="text-xs text-slate-500 mt-1">{tx('Propeller, Akku-Ersatz, gedruckte Teile – mit Bestand und Link.', 'Propellers, spare batteries, printed parts – with stock and link.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teile.map(teil => (
            <div key={teil.id} className={cn('bg-white p-4 rounded-3xl border shadow-sm flex items-center gap-3', knapp(teil) ? 'border-amber-300' : 'border-slate-200')}>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-900 text-sm truncate">{teil.name}</h3>
                {teil.beschreibung && <p className="text-xs text-slate-500 truncate">{teil.beschreibung}</p>}
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {drohnenName(teil.droneId) && (
                    <span className="text-2xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{drohnenName(teil.droneId)}</span>
                  )}
                  {knapp(teil) && (
                    <span className="text-2xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">{tx('Bestand knapp', 'Low stock')}</span>
                  )}
                  {teil.link && (
                    <a href={teil.link} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-blue inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Link
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center shrink-0">
                <IconKnopf icon={Minus} variante="sekundaer" aria-label={tx('Eins weniger', 'One less')} onClick={() => aendereAnzahl(teil, -1)} />
                <span className="w-8 text-center font-black text-slate-900 tabular-nums">{teil.anzahl}</span>
                <IconKnopf icon={Plus} variante="sekundaer" aria-label={tx('Eins mehr', 'One more')} onClick={() => aendereAnzahl(teil, 1)} />
                <IconKnopf icon={Trash2} variante="gefahr" aria-label={tx('Löschen', 'Delete')} onClick={() => loeschen(teil)} className="ml-1" />
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

  const handleDelete = async (pilot: Pilot) => {
    await dbService.deletePilot(pilot.id);
    loadPilots();
    zeigeRueckgaengig(tx(`${pilot.name} entfernt`, `${pilot.name} removed`), async () => {
      await dbService.savePilot(pilot);
      loadPilots();
    });
  };

  return (
    <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto pb-12">
      <SeitenKopf
        titel={t('view.pilotenManagement')}
        untertitel={tx('Weitere Piloten & Gäste', 'Additional pilots & guests')}
        aktionen={!showAdd && <Knopf icon={Plus} onClick={() => setShowAdd(true)}>{tx('Pilot hinzufügen', 'Add pilot')}</Knopf>}
      />

      <div className="space-y-3">
        {showAdd && (
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-base font-black text-slate-900">{tx('Gast-Piloten hinzufügen', 'Add guest pilot')}</h3>
            <Feld label={tx('Name', 'Name')} htmlFor="pi-name">
              <input id="pi-name" type="text" className={eingabe} value={newPilot.name || ''} onChange={e => setNewPilot({ ...newPilot, name: e.target.value })} />
            </Feld>
            <Feld label={tx('Betreiber-ID (e-ID)', 'Operator ID (e-ID)')} htmlFor="pi-eid">
              <input id="pi-eid" type="text" placeholder="DEU…" className={cn(eingabe, 'font-mono')} value={newPilot.eid || ''} onChange={e => setNewPilot({ ...newPilot, eid: e.target.value })} />
            </Feld>
            <div className="flex gap-2">
              <Knopf variante="sekundaer" onClick={() => setShowAdd(false)}>{t('aktion.abbrechen')}</Knopf>
              <Knopf className="flex-1" onClick={handleAddPilot} disabled={!newPilot.name || !newPilot.eid}>{tx('Speichern', 'Save')}</Knopf>
            </div>
          </div>
        )}

        {pilots.length === 0 && !showAdd && (
          <div className="bg-white p-8 rounded-3xl border border-dashed border-slate-200 text-center">
            <User className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">{tx('Noch keine weiteren Piloten', 'No additional pilots yet')}</p>
            <p className="text-xs text-slate-500 mt-1">{tx('Gäste erscheinen danach im Flug-Assistenten zur Auswahl.', 'Guests then appear for selection in the flight assistant.')}</p>
          </div>
        )}

        {pilots.map(pilot => (
          <div key={pilot.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-blue/5 flex items-center justify-center border border-brand-blue/10 shrink-0">
              <User className="w-5 h-5 text-brand-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm truncate">{pilot.name}</h3>
                {pilot.isGuest && <span className="text-2xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">{tx('Gast', 'Guest')}</span>}
              </div>
              <p className="text-xs text-slate-500 font-mono truncate flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-brand-green shrink-0" /> {pilot.eid}
              </p>
            </div>
            <IconKnopf icon={Trash2} variante="gefahr" aria-label={tx(`${pilot.name} entfernen`, `Remove ${pilot.name}`)} onClick={() => handleDelete(pilot)} />
          </div>
        ))}
      </div>

      <div className="mt-8 p-5 bg-amber-50 border border-amber-100 rounded-3xl flex gap-3">
        <Info className="w-5 h-5 text-amber-800 shrink-0" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-amber-800">{tx('Versicherungs-Hinweis', 'Insurance note')}</h3>
          <p className="text-sm text-amber-800 leading-relaxed">
            {tx('Stelle sicher, dass Gast-Piloten durch deine Drohnen-Haftpflicht mitversichert sind. Die e-ID des verantwortlichen Betreibers muss am Gerät bleiben.', 'Make sure guest pilots are covered by your drone liability insurance. The e-ID of the responsible operator must remain on the aircraft.')}
          </p>
        </div>
      </div>
    </div>
  );
}
