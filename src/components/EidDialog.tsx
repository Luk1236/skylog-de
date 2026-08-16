import { useState } from 'react';
import { X, Shield, Check, AlertCircle, ExternalLink, Copy } from 'lucide-react';
import type { UserProfile } from '../services/db';
import { validateEID, getPublicEID, AUTHORITY_PORTALS } from '../services/eidManager';

interface Props {
  profile: UserProfile | null;
  onSaveProfile: (updatedProfile: UserProfile) => Promise<void>;
  onClose: () => void;
}

export function EidDialog({ profile, onSaveProfile, onClose }: Props) {
  const [eidInput, setEidInput] = useState(profile?.eid ?? '');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const validation = validateEID(eidInput);
  const publicPart = eidInput ? getPublicEID(eidInput) : '';

  const handleCopyPublicEID = () => {
    if (!publicPart) return;
    navigator.clipboard.writeText(publicPart);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!validation.isValid && eidInput.trim() !== '') {
      setErrorMsg(validation.reason || 'Ungültiges e-ID Format');
      return;
    }

    setSaving(true);
    try {
      const baseProfile: UserProfile = profile ?? {
        id: 'main_profile',
        name: '',
        eid: '',
        licenseType: 'A1/A3',
        insuranceNumber: ''
      };

      const updated: UserProfile = {
        ...baseProfile,
        eid: eidInput.trim().toUpperCase()
      };

      await onSaveProfile(updated);
      setSuccessMsg('Betreiber-ID erfolgreich gespeichert!');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">Betreiber-Registrierung (e-ID)</h2>
              <p className="text-xs text-slate-400">EASA Registrierungs-ID & LBA Portal</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-300 text-xs">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* e-ID Input Section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Betreiber-ID (e-ID)</span>
              <span className="text-[11px] text-slate-400 font-normal">Format: DEU123456789012-xyz</span>
            </label>
            <input
              type="text"
              value={eidInput}
              onChange={e => setEidInput(e.target.value)}
              placeholder="z.B. DEU87AST46RAC38A-XYZ"
              className="w-full px-4 py-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
            />
            {eidInput.trim() !== '' && (
              <div className="pt-1 flex items-center justify-between text-xs">
                <span className={validation.isValid ? 'text-emerald-400 font-medium flex items-center gap-1' : 'text-amber-400 flex items-center gap-1'}>
                  {validation.isValid ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {validation.isValid ? 'Gültiges EU e-ID Format' : validation.reason}
                </span>
              </div>
            )}
          </div>

          {/* Public e-ID Display for Label Marking */}
          {publicPart && (
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Öffentliche e-ID für Plakette</span>
                <button
                  onClick={handleCopyPublicEID}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-semibold transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Kopiert!' : 'Kopieren'}</span>
                </button>
              </div>
              <p className="font-mono text-base font-bold text-sky-300 tracking-wider break-all">{publicPart}</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Dies ist der sichtbare Teil deiner Betreiber-ID. Er muss gemäß EU-Verordnung 2019/947 gut sichtbar auf all deinen Drohnen angebracht sein.
              </p>
            </div>
          )}

          {/* Direct Links to Authority Portals */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Luftfahrtbehörden & Portale</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AUTHORITY_PORTALS.map(portal => (
                <a
                  key={portal.countryCode}
                  href={portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-2xl bg-slate-800/40 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 flex items-center justify-between text-xs font-medium text-slate-200 transition-all group"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-sky-400">{portal.countryName}</span>
                    <span className="text-[11px] text-slate-400">{portal.portalName}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-800/50 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 text-xs font-semibold"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
          >
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
