import { useState } from 'react';
import { ShieldCheck, Scale, AlertTriangle, ClipboardCheck, ArrowRight, ExternalLink, Phone, Copy, Check, LocateFixed } from 'lucide-react';
import type { UserProfile, Drone } from '../services/db';
import { useSprache } from '../lib/sprache';
import { IncidentReportDialog, RiskAssessmentDialog } from '../components/lazyDialogs';
import { Knopf, SeitenKopf } from '../components/ui';

export function SafetyView({ profile, drones, standort, ortet, onStandortFreigeben, onBehoerdenCheck, onOpenEid }: {
  profile: UserProfile | null, drones: Drone[],
  /** Echter Standort (GPS oder von Hand) - im Notfall zum Durchgeben an die
   *  Leitstelle. Fehlt er, stehen hier keine geratenen Koordinaten. */
  standort?: [number, number],
  /** GPS sucht gerade. */
  ortet?: boolean,
  /** Standort noch nicht freigegeben: Knopf zum Freigeben anbieten. */
  onStandortFreigeben?: () => void,
  onBehoerdenCheck: () => void, onOpenEid?: () => void,
}) {
  const { t, tx } = useSprache();
  const [showVorfall, setShowVorfall] = useState(false);
  const [showRisiko, setShowRisiko] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const koordinaten = standort ? `${standort[0].toFixed(5)}, ${standort[1].toFixed(5)}` : null;

  const notfallSchritte = [
    { titel: tx('Sicherheit zuerst', 'Safety first'), text: tx('Motoren sofort stoppen (falls sicher möglich). Gefahrenbereich absichern.', 'Stop the motors immediately (if safe). Secure the danger zone.') },
    { titel: tx('Erste Hilfe', 'First aid'), text: tx('Bei Personenschaden sofort 112 rufen und Erste Hilfe leisten.', 'If anyone is hurt, call 112 immediately and give first aid.') },
    { titel: tx('Dokumentation', 'Documentation'), text: tx('Fotos vom Unfallort, der Drohne und den Schäden machen. Zeugen notieren.', 'Take photos of the scene, the drone and the damage. Note witnesses.') },
    { titel: tx('LBA-Meldung', 'LBA report'), text: tx('Schwere Ereignisse müssen binnen 72 Stunden beim LBA gemeldet werden.', 'Serious occurrences must be reported to the LBA within 72 hours.') },
  ];

  // Kurzfassung von § 21h LuftVO - bewusst vorsichtig formuliert, mit Quelle.
  const verbotszonen = [
    { ort: tx('Flugplätze', 'Airfields'), regel: tx('1,5 km Abstand zum Gelände', '1.5 km from the airfield boundary') },
    { ort: tx('Menschenansammlungen', 'Crowds'), regel: tx('Überflug verboten', 'Overflight prohibited') },
    { ort: tx('Wohngrundstücke', 'Residential property'), regel: tx('Überflug nur mit Zustimmung, wenn die Drohne über 250 g wiegt oder eine Kamera hat', 'Overflight only with consent if the drone weighs over 250 g or has a camera') },
    { ort: tx('Bahnanlagen, Bundesstraßen und -wasserstraßen', 'Railways, federal roads and waterways'), regel: tx('100 m seitlicher Abstand', '100 m lateral distance') },
    { ort: tx('Krankenhäuser, Industrieanlagen, Justizvollzug', 'Hospitals, industrial sites, prisons'), regel: tx('100 m Abstand', '100 m distance') },
    { ort: tx('Naturschutzgebiete, Nationalparks', 'Nature reserves, national parks'), regel: tx('Meist verboten – Landesrecht prüfen', 'Usually prohibited – check state law') },
  ];

  const kopiereKoordinaten = async () => {
    if (!koordinaten) return;
    try {
      await navigator.clipboard.writeText(koordinaten);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch { /* Zwischenablage gesperrt - die Zahlen stehen ja sichtbar da */ }
  };

  return (
    <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto pb-20">
      <SeitenKopf
        titel={t('view.safetyHub')}
        untertitel={tx('Notfall, Behördenkontrolle & LBA-Meldung', 'Emergency, inspections & LBA reporting')}
        aktionen={onOpenEid && (
          <Knopf variante="sekundaer" groesse="sm" icon={ShieldCheck} onClick={onOpenEid}>{tx('e-ID verwalten', 'Manage e-ID')}</Knopf>
        )}
      />

      {/* Behörden-Check: schneller Zugriff für eine Kontrolle unterwegs. */}
      <button
        onClick={onBehoerdenCheck}
        className="w-full mb-2 bg-brand-blue text-white p-5 rounded-3xl shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform text-left"
      >
        <div className="p-2 bg-white/20 rounded-xl shrink-0">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-sm">{tx('Behörden-Check', 'Authority check')}</h3>
          <p className="text-xs text-white/80 leading-relaxed">{tx('Betreiber-ID, Nachweise & QR-Code zum Vorzeigen bei einer Kontrolle.', 'Operator ID, certificates & QR code to show during an inspection.')}</p>
        </div>
      </button>
      {(!profile?.eid || drones.length === 0) && (
        <p className="mb-2 text-xs text-slate-500 px-1">
          {tx('Tipp: Betreiber-ID im Profil und mindestens eine Drohne hinterlegen, damit der Check vollständig ist.', 'Tip: add your operator ID in the profile and at least one drone so the check is complete.')}
        </p>
      )}

      {/* Risiko-Check: welche Betriebskategorie gilt für den geplanten Flug? */}
      <button
        onClick={() => setShowRisiko(true)}
        className="w-full mt-4 mb-6 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform text-left"
      >
        <div className="p-2 bg-brand-blue/5 rounded-xl shrink-0">
          <Scale className="w-6 h-6 text-brand-blue" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-slate-900">{tx('Risiko-Check (Betriebskategorie)', 'Risk check (operating category)')}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{tx('Open A1/A2/A3 oder Specific? Nach EU 2019/947 einordnen.', 'Open A1/A2/A3 or Specific? Classify according to EU 2019/947.')}</p>
        </div>
      </button>

      {/* Notfall: bewusst die eine laute Fläche der App */}
      <div className="bg-brand-red text-white p-5 rounded-3xl shadow-sm mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-white/20 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-bold text-lg">{tx('Notfall-Leitfaden', 'Emergency guide')}</h3>
        </div>
        <a
          href="tel:112"
          className="flex items-center justify-center gap-2 h-12 mb-3 rounded-2xl bg-white text-brand-red font-black text-base active:scale-[0.98] transition-transform"
        >
          <Phone className="w-5 h-5" /> {tx('112 anrufen', 'Call 112')}
        </a>
        {!koordinaten && (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-2xl bg-black/15">
            <p className="flex-1 text-xs font-medium leading-snug">
              {ortet
                ? tx('Standort wird ermittelt …', 'Determining location …')
                : tx('Standort nicht bekannt. Beschreibe der Leitstelle den Ort und markante Punkte.', 'Location unknown. Describe the place and landmarks to the dispatcher.')}
            </p>
            {onStandortFreigeben && (
              <button
                type="button"
                onClick={onStandortFreigeben}
                className="shrink-0 flex items-center gap-1.5 h-10 px-3 rounded-xl bg-black/15 text-sm font-bold"
              >
                <LocateFixed className="w-4 h-4" /> {tx('Orten', 'Locate')}
              </button>
            )}
          </div>
        )}
        {koordinaten && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-2xl bg-black/15">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold opacity-80">{tx('Dein Standort zum Durchgeben', 'Your location to pass on')}</p>
              <p className="text-base font-black tabular-nums select-all">{koordinaten}</p>
            </div>
            <button
              type="button"
              onClick={() => void kopiereKoordinaten()}
              aria-label={tx('Koordinaten kopieren', 'Copy coordinates')}
              className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0"
            >
              {kopiert ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}
        <ol className="space-y-3">
          {notfallSchritte.map((schritt, idx) => (
            <li key={schritt.titel} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-black/15 flex items-center justify-center shrink-0 text-2xs font-bold">
                {idx + 1}
              </div>
              <div>
                <p className="text-sm font-bold">{schritt.titel}</p>
                <p className="text-xs font-medium opacity-90">{schritt.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-4">
        {/* Vorfall-Bericht erstellen: füllt aus Profil/Drohne einen kopierbaren
            LBA-Meldetext, den der Pilot ins Portal einfügt. */}
        <button
          onClick={() => setShowVorfall(true)}
          className="block w-full text-left bg-white p-5 rounded-3xl border border-slate-200 shadow-sm group active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-brand-red/5 rounded-xl">
              <ClipboardCheck className="w-5 h-5 text-brand-red" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="font-bold text-slate-900 mb-1">{tx('Vorfall-Bericht erstellen', 'Create incident report')}</h4>
          <p className="text-xs text-slate-500 leading-relaxed">{tx('Ereignis dokumentieren und als fertigen Meldetext für das LBA kopieren.', 'Document the occurrence and copy a ready-made report text for the LBA.')}</p>
        </button>

        <a
          href="https://www.lba.de/DE/Betrieb/Drohnen/Meldung_Ereignisse/Meldung_Ereignisse_node.html"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-white p-5 rounded-3xl border border-slate-200 shadow-sm group active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-slate-50 rounded-xl">
              <ExternalLink className="w-5 h-5 text-brand-blue" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="font-bold text-slate-900 mb-1">{tx('LBA-Ereignismeldung', 'LBA occurrence report')}</h4>
          <p className="text-xs text-slate-500 leading-relaxed">{tx('Offizielles Meldeportal für Unfälle und schwere Störungen (ECCAIRS 2).', 'Official reporting portal for accidents and serious incidents (ECCAIRS 2).')}</p>
        </a>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-900 mb-3 text-sm">{tx('Flugverbotszonen (Kurzfassung)', 'No-fly zones (summary)')}</h4>
          <div className="divide-y divide-slate-200">
            {verbotszonen.map(z => (
              <div key={z.ort} className="flex flex-wrap justify-between items-start gap-x-3 gap-y-1 py-2.5">
                <span className="text-sm font-bold text-slate-700">{z.ort}</span>
                <span className="text-xs font-bold text-brand-red bg-red-50 px-2 py-1 rounded-lg">{z.regel}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            {tx('Vereinfacht und ohne Gewähr. Maßgeblich sind ', 'Simplified, without guarantee. Binding are ')}
            <a className="font-bold text-brand-blue hover:underline" href="https://www.gesetze-im-internet.de/luftvo_2015/__21h.html" target="_blank" rel="noopener noreferrer">§ 21h LuftVO</a>
            {tx(' und die Karte auf ', ' and the map on ')}
            <a className="font-bold text-brand-blue hover:underline" href="https://maptool-dipul.dfs.de/" target="_blank" rel="noopener noreferrer">dipul</a>.
          </p>
        </div>
      </div>

      {showVorfall && (
        <IncidentReportDialog
          profile={profile}
          drohnen={drones}
          onClose={() => setShowVorfall(false)}
        />
      )}

      {showRisiko && (
        <RiskAssessmentDialog drohnen={drones} onClose={() => setShowRisiko(false)} />
      )}
    </div>
  );
}
