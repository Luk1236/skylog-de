import { useState } from 'react';
import { ShieldCheck, Scale, AlertTriangle, ClipboardCheck, ArrowRight, ExternalLink } from 'lucide-react';
import type { UserProfile, Drone } from '../services/db';
import { useSprache } from '../lib/sprache';
import { IncidentReportDialog, RiskAssessmentDialog } from '../components/lazyDialogs';

export function SafetyView({ profile, drones, onBehoerdenCheck, onOpenEid }: { profile: UserProfile | null, drones: Drone[], onBehoerdenCheck: () => void, onOpenEid?: () => void }) {
  const { t } = useSprache();
  const [showVorfall, setShowVorfall] = useState(false);
  const [showRisiko, setShowRisiko] = useState(false);
  const emergencySteps = [
    { title: "Sicherheit zuerst", desc: "Motoren sofort stoppen (falls sicher möglich). Gefahrenbereich absichern." },
    { title: "Erste Hilfe", desc: "Bei Personenschaden sofort 112 rufen. Erste Hilfe leisten." },
    { title: "Dokumentation", desc: "Fotos vom Unfallort, der Drohne und Schäden machen. Zeugen notieren." },
    { title: "LBA Meldung", desc: "Schwere Ereignisse müssen binnen 72h beim LBA gemeldet werden." }
  ];

  return (
    <div className="max-w-md lg:max-w-3xl mx-auto pb-20">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand-red">{t('view.safetyHub')}</h2>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">Notfall-Leitfaden & LBA Meldung</p>
        </div>
        {onOpenEid && (
          <button
            onClick={onOpenEid}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 shadow-sm hover:border-slate-300 active:scale-95 transition-all"
          >
            <ShieldCheck className="w-4 h-4 text-sky-500" />
            <span>e-ID Verwalten</span>
          </button>
        )}
      </div>

      {/* Behörden-Check: schneller Zugriff für eine Kontrolle unterwegs. */}
      <button
        onClick={onBehoerdenCheck}
        className="w-full mb-8 bg-brand-blue text-white p-5 rounded-3xl shadow-xl shadow-brand-blue/20 flex items-center gap-4 active:scale-[0.98] transition-transform text-left"
      >
        <div className="p-2 bg-white/20 rounded-xl shrink-0">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-sm">Behörden-Check</h3>
          <p className="text-[11px] text-white/70 leading-relaxed">Betreiber-ID, Nachweise & QR-Code zum Vorzeigen bei einer Kontrolle.</p>
        </div>
      </button>
      {(!profile?.eid || drones.length === 0) && (
        <p className="-mt-6 mb-8 text-[10px] text-slate-400 px-1">
          Tipp: Betreiber-ID im Profil und mindestens eine Drohne hinterlegen, damit der Check vollständig ist.
        </p>
      )}

      {/* Risiko-Check: welche Betriebskategorie gilt für den geplanten Flug? */}
      <button
        onClick={() => setShowRisiko(true)}
        className="w-full mb-8 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform text-left"
      >
        <div className="p-2 bg-brand-blue/5 rounded-xl shrink-0">
          <Scale className="w-6 h-6 text-brand-blue" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-slate-900">Risiko-Check (Betriebskategorie)</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">Open A1/A2/A3 oder Specific? Nach EU 2019/947 einordnen.</p>
        </div>
      </button>

      <div className="bg-brand-red text-white p-6 rounded-3xl shadow-xl shadow-brand-red/20 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-white/20 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-bold text-lg">NOTFALL-GUIDE</h3>
        </div>
        <div className="space-y-4">
          {emergencySteps.map((step, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-[10px] font-black">
                {idx + 1}
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider opacity-80">{step.title}</p>
                <p className="text-xs font-medium">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
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
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="font-bold text-slate-900 mb-1">Vorfall-Bericht erstellen</h4>
          <p className="text-[10px] text-slate-500 leading-relaxed">Ereignis dokumentieren und als fertigen Meldetext für das LBA kopieren.</p>
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
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="font-bold text-slate-900 mb-1">LBA Ereignismeldung</h4>
          <p className="text-[10px] text-slate-500 leading-relaxed">Offizielles Meldeportal für Unfälle und schwere Störungen (ECCAIRS 2).</p>
        </a>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">Flugverbotszonen</h4>
          <div className="space-y-3">
            {[
              { l: "Flughäfen", v: "1.5km Abstand" },
              { l: "Menschenmengen", v: "Überflug verboten" },
              { l: "Wohngebiete", v: "Datenschutz beachten" },
              { l: "Naturgebiete", v: "Oft Pauschalverbot" }
            ].map((i, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <span className="text-xs font-bold text-slate-600">{i.l}</span>
                <span className="text-[10px] font-black text-brand-red bg-brand-red/5 px-2 py-1 rounded-lg uppercase">{i.v}</span>
              </div>
            ))}
          </div>
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
