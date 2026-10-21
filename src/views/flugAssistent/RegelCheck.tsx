import { AlertTriangle, Info, MapPin, Rocket, ShieldCheck } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import type { Drone, UserProfile } from '../../services/db';

/** Kurzer Regel-Check der offenen Kategorie für die gewählte Drohne. */
export function RegelCheck({ drohne, profil }: { drohne: Drone; profil: UserProfile | null }) {
  const { tx } = useSprache();
  const uasClass = drohne.uasClass || 'Legacy';
  const weight = drohne.weight;
  const license = profil?.licenseType;

  let category = 'A3';
  if (uasClass === 'C0' || uasClass === 'C1' || weight < 500) category = 'A1';
  else if (uasClass === 'C2' && license === 'A2') category = 'A2';

  const abstand = (() => {
    if (uasClass === 'C0' || weight < 250) return 'Kein Mindestabstand zu Personen';
    if (uasClass === 'C1' || (uasClass === 'Legacy' && weight < 500)) return 'Kein Überflug von Personen';
    if (uasClass === 'C2' && license === 'A2') return '30m (5m im Langsamflugmodus)';
    return '150m zu Wohn/Gewerbe/Menschen';
  })();

  return (
    <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brand-blue" />
          <p className="text-sm font-bold text-slate-900">{tx('LBA Regulierungs-Check', 'LBA regulation check')}</p>
        </div>
        <span className="px-2 py-0.5 bg-brand-blue text-white rounded-full text-2xs font-bold">
          {tx('Kategorie', 'Category')} {category}
        </span>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
            <MapPin className="w-4 h-4 text-brand-orange" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">{tx('Vorgeschriebener Abstand', 'Required distance')}</p>
            <p className="text-sm font-bold text-slate-900">{abstand}</p>
          </div>
        </div>

        {license === 'A1/A3' && drohne.uasClass === 'C2' && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-2xl">
            <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-2xs font-medium text-amber-700 leading-relaxed">
              {tx('Mit deinem', 'With your')} <span className="font-bold">{tx('A1/A3 Schein', 'A1/A3 certificate')}</span> {tx('darfst du diese Drohne (C2) nur in', 'you may only fly this drone (C2) in')} <span className="font-bold text-slate-900">{tx('Kategorie A3', 'category A3')}</span> {tx('(weit weg von Menschen) fliegen. Für A2 ist ein Zusatzzeugnis nötig.', '(far away from people). A2 requires an additional certificate.')}
            </p>
          </div>
        )}

        {!license && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-2xl">
            <AlertTriangle className="w-3.5 h-3.5 text-brand-red shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-brand-red leading-tight">
              {tx('Kein Pilotenschein hinterlegt! Bitte Profil aktualisieren.', 'No pilot certificate on file! Please update your profile.')}
            </p>
          </div>
        )}

        {profil?.isBOS && (
          <div className="flex items-center gap-2 px-3 py-2 bg-brand-red text-white rounded-xl shadow-lg shadow-brand-red/20">
            <Rocket className="w-3.5 h-3.5 animate-pulse" />
            <span className="text-2xs font-bold uppercase tracking-wider">{tx('BOS-Sonderrechte aktiv', 'Emergency-service privileges active')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
