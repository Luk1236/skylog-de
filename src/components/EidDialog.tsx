import { useSprache } from '../lib/sprache';
import { useState } from 'react';
import { Shield, Check, AlertCircle, ExternalLink, Copy } from 'lucide-react';
import type { UserProfile } from '../services/db';
import { validateEID, getPublicEID, AUTHORITY_PORTALS } from '../services/eidManager';
import { Dialog, Knopf, Abschnitt, eingabe, beschriftung } from './ui';
import { cn } from '../lib/utils';

interface Props {
  profile: UserProfile | null;
  onSaveProfile: (updatedProfile: UserProfile) => Promise<void>;
  onClose: () => void;
}

export function EidDialog({ profile, onSaveProfile, onClose }: Props) {
  const { tx } = useSprache();
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
    <Dialog
      titel={tx('Betreiber-Registrierung (e-ID)', 'Operator registration (e-ID)')}
      untertitel={tx('EASA Registrierungs-ID & LBA Portal', 'EASA registration ID & LBA portal')}
      icon={Shield}
      ton="blau"
      breite="lg"
      onClose={onClose}
      fuss={
        <>
          <Knopf variante="geist" className="ml-auto" onClick={onClose}>
            {tx('Abbrechen', 'Cancel')}
          </Knopf>
          <Knopf onClick={handleSave} disabled={saving}>
            {saving ? tx('Speichere …', 'Saving…') : tx('Speichern', 'Save')}
          </Knopf>
        </>
      }
    >
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 text-brand-red text-sm font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3 text-brand-green text-sm font-medium">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* e-ID Input Section */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-1">
          <label htmlFor="eid-eingabe" className={cn(beschriftung, 'mb-0')}>
            {tx('Betreiber-ID (e-ID)', 'Operator ID (e-ID)')}
          </label>
          <span className="text-2xs text-slate-500">Format: DEU123456789012-xyz</span>
        </div>
        <input
          id="eid-eingabe"
          type="text"
          value={eidInput}
          onChange={e => setEidInput(e.target.value)}
          placeholder={tx('z.B. DEU87AST46RAC38A-XYZ', 'e.g. DEU87AST46RAC38A-XYZ')}
          className={cn(eingabe, 'font-mono')}
        />
        {eidInput.trim() !== '' && (
          <div className="pt-1.5 flex items-center justify-between text-xs">
            <span className={validation.isValid ? 'text-brand-green font-medium flex items-center gap-1' : 'text-amber-700 font-medium flex items-center gap-1'}>
              {validation.isValid ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {validation.isValid ? 'Gültiges EU e-ID Format' : validation.reason}
            </span>
          </div>
        )}
      </div>

      {/* Public e-ID Display for Label Marking */}
      {publicPart && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-500">{tx('Öffentliche e-ID für Plakette', 'Public e-ID for the label')}</span>
            <Knopf variante="sekundaer" groesse="sm" icon={copied ? Check : Copy} onClick={handleCopyPublicEID}>
              <span>{copied ? tx('Kopiert!', 'Copied!') : tx('Kopieren', 'Copy')}</span>
            </Knopf>
          </div>
          <p className="font-mono text-base font-bold text-brand-blue tracking-wider break-all">{publicPart}</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            {tx('Dies ist der sichtbare Teil deiner Betreiber-ID. Er muss gemäß EU-Verordnung 2019/947 gut sichtbar auf all deinen Drohnen angebracht sein.', 'This is the visible part of your operator ID. Under EU Regulation 2019/947 it must be clearly displayed on all your drones.')}
          </p>
        </div>
      )}

      {/* Direct Links to Authority Portals */}
      <div>
        <Abschnitt titel={tx('Luftfahrtbehörden & Portale', 'Aviation authorities & portals')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AUTHORITY_PORTALS.map(portal => (
            <a
              key={portal.countryCode}
              href={portal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 flex items-center justify-between gap-2 text-xs font-medium text-slate-700 transition-colors group"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-brand-blue">{portal.countryName}</span>
                <span className="text-2xs text-slate-500">{portal.portalName}</span>
              </div>
              <ExternalLink className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-brand-blue transition-colors" />
            </a>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
