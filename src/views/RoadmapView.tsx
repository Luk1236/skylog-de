import { Download, CheckCircle2, AlertTriangle, Rocket } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSprache } from '../lib/sprache';

export function RoadmapView() {
  const { t, tx } = useSprache();
  // Ehrlicher Stand: Was fertig ist, steht auf „Live". Nur was wirklich noch
  // fehlt, ist „Geplant". Vorher standen gebaute Funktionen hier als „geplant"
  // — das las sich, als wäre nichts fertig.
  const steps = [
    {
      title: "PDF-Logbuch-Export",
      desc: "Flugberichte als PDF mit einem Klick — für Versicherung oder LBA.",
      status: "Live",
      icon: Download
    },
    {
      title: "Vor- und Nach-Flug-Checkliste",
      desc: "Interaktive Sicherheitsprüfung (Akku, Propeller, GPS, SD-Karte) vor und nach jedem Flug.",
      status: "Live",
      icon: CheckCircle2
    },
    {
      title: "Live NOTAM Feed",
      desc: "Echtzeit-NOTAMs für deutschen Luftraum (EDWW/EDGG/EDMM) — sichtbar vor jedem Flugstart.",
      status: "Live",
      icon: AlertTriangle
    },
    {
      title: "Flächen- und Grid-Planung",
      desc: "Mäander-Raster für Mapping-Flüge über beliebige Flächen: freie Flugrichtung, Bahnabstand aus Höhe, Bildwinkel und Überlappung.",
      status: "Live",
      icon: Rocket
    }
  ];

  return (
    <div className="max-w-md lg:max-w-3xl mx-auto pb-8">
      <div className="mb-8">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">{t('view.roadmap')}</h2>
        <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 mt-0.5">{tx('Unsere Vision für SkyLog DE', 'Our vision for SkyLog DE')}</p>
      </div>

      <div className="space-y-6">
        {steps.map((step, idx) => (
          <div key={idx} className="relative pl-8 border-l-2 border-slate-100 last:border-l-0">
            <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-brand-blue border-2 border-white shadow-sm" />
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-slate-50 rounded-xl">
                  <step.icon className="w-5 h-5 text-brand-blue" />
                </div>
                <span className={cn(
                  "text-2xs font-black uppercase tracking-wider",
                  step.status === 'Live' ? "text-brand-green" : "text-slate-400"
                )}>{step.status}</span>
              </div>
              <h3 className="font-bold text-slate-900 mb-1">{step.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-6 bg-brand-blue/5 rounded-3xl text-center border border-brand-blue/10">
        <Rocket className="w-8 h-8 text-brand-blue mx-auto mb-3" />
        <h4 className="font-bold text-slate-900 mb-1">{tx('Feedback erwünscht!', 'Feedback welcome!')}</h4>
        <p className="text-xs text-slate-500">{tx('Welche Funktion fehlt Ihnen am meisten? Lassen Sie es uns wissen.', 'Which feature do you miss most? Let us know.')}</p>
      </div>
    </div>
  );
}
