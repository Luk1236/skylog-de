import { useSprache } from '../lib/sprache';
import { useState } from 'react';
import { DatabaseBackup, Download, Check, Lock, RefreshCw, Bell } from 'lucide-react';
import { exportBackup, getLastBackupAt } from '../services/backup';
import {
  getSicherungsIntervall,
  setSicherungsIntervall,
  INTERVALL_OPTIONEN,
} from '../services/sicherungsErinnerung';
import { melde } from '../services/dialog';
import { Dialog, Knopf, eingabe } from './ui';
import { cn } from '../lib/utils';

interface Props {
  onClose: () => void;
}

/** Sicherung exportieren (optional verschlüsselt) und Erinnerungs-Intervall wählen.
 *  Ehrlich: Es gibt keinen Server, also auch keine heimliche Cloud-Sicherung. Die
 *  Datei geht im Browser in den Download-Ordner, in der Android-App über das
 *  Teilen-Menü - z.B. direkt nach Google Drive oder Nextcloud. */
export function DatensicherungDialog({ onClose }: Props) {
  const { tx } = useSprache();
  const [intervall, setIntervall] = useState(getSicherungsIntervall);
  const [letzte, setLetzte] = useState(getLastBackupAt);
  const [mitPasswort, setMitPasswort] = useState(false);
  const [passwort, setPasswort] = useState('');
  const [passwort2, setPasswort2] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [erfolg, setErfolg] = useState(false);

  const passwortFehler = !mitPasswort
    ? null
    : passwort.length < 8
      ? 'Mindestens 8 Zeichen.'
      : passwort !== passwort2
        ? 'Die Passwörter stimmen nicht überein.'
        : null;

  const exportieren = async () => {
    if (passwortFehler) return;
    setLaeuft(true);
    setErfolg(false);
    try {
      await exportBackup(mitPasswort ? passwort : undefined);
      setLetzte(getLastBackupAt());
      setErfolg(true);
      setPasswort('');
      setPasswort2('');
    } catch (err) {
      console.error(err);
      melde((err instanceof Error && err.message) || 'Export fehlgeschlagen.');
    } finally {
      setLaeuft(false);
    }
  };

  const waehleIntervall = (tage: number) => {
    setSicherungsIntervall(tage);
    setIntervall(getSicherungsIntervall());
  };

  return (
    <Dialog
      titel={tx('Datensicherung', 'Backup')}
      untertitel={tx('Export, Verschlüsselung und Erinnerung', 'Export, encryption and reminder')}
      icon={DatabaseBackup}
      breite="md"
      onClose={onClose}
      fuss={
        <div className="w-full space-y-2">
          <Knopf voll onClick={exportieren} disabled={laeuft || !!passwortFehler}>
            {laeuft ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{tx('Sicherung jetzt exportieren', 'Export backup now')}</span>
          </Knopf>
          {erfolg && (
            <p className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-700">
              <Check className="w-4 h-4" /> {tx('Sicherung erstellt.', 'Backup created.')}
            </p>
          )}
        </div>
      }
    >
      <p className="text-xs text-slate-600 leading-relaxed">
        {tx('Deine Daten liegen nur auf diesem Gerät. Eine Sicherung enthält Drohnen, Akkus, Flüge, Piloten, Wartungen, Dokumente, Flugpläne, Favoriten, Kunden und Ersatzteile. In der Android-App kannst du sie direkt in Google Drive, Nextcloud oder „Dateien“ ablegen.', 'Your data only lives on this device. A backup contains drones, batteries, flights, pilots, maintenance, documents, flight plans, favourites, customers and spare parts. In the Android app you can save it straight to Google Drive, Nextcloud or “Files”.')}
      </p>

      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="w-5 h-5 rounded accent-brand-blue"
            checked={mitPasswort}
            onChange={e => setMitPasswort(e.target.checked)}
          />
          <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Lock className="w-4 h-4 text-brand-blue" /> {tx('Mit Passwort verschlüsseln', 'Encrypt with password')}
          </span>
        </label>
        {mitPasswort && (
          <div className="space-y-2">
            <input
              type="password"
              autoComplete="new-password"
              placeholder={tx('Passwort (mind. 8 Zeichen)', 'Password (min. 8 characters)')}
              className={cn(eingabe, 'bg-white')}
              value={passwort}
              onChange={e => setPasswort(e.target.value)}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder={tx('Passwort wiederholen', 'Repeat password')}
              className={cn(eingabe, 'bg-white')}
              value={passwort2}
              onChange={e => setPasswort2(e.target.value)}
            />
            <p className="text-2xs text-slate-600 leading-relaxed">
              {tx('AES-256-verschlüsselt. Das Passwort wird nirgends gespeichert – ohne es lässt sich die Sicherung nicht wiederherstellen.', 'AES-256 encrypted. The password is not stored anywhere – without it the backup cannot be restored.')}
            </p>
            {passwortFehler && (passwort || passwort2) && (
              <p className="text-2xs font-bold text-brand-red">{passwortFehler}</p>
            )}
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
        <label htmlFor="sicherung-intervall" className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <Bell className="w-4 h-4 text-brand-blue" /> {tx('Erinnern, wenn die letzte Sicherung älter ist als', 'Remind me when the last backup is older than')}
        </label>
        <select
          id="sicherung-intervall"
          className={cn(eingabe, 'bg-white')}
          value={intervall}
          onChange={e => waehleIntervall(Number(e.target.value))}
        >
          {INTERVALL_OPTIONEN.map(t => <option key={t} value={t}>{t} {tx('Tage', 'days')}</option>)}
        </select>
        <p className="text-2xs text-slate-600">
          {letzte
            ? `Letzte Sicherung: ${new Date(letzte).toLocaleString('de-DE')}`
            : 'Auf diesem Gerät wurde noch keine Sicherung erstellt.'}
        </p>
      </div>
    </Dialog>
  );
}
