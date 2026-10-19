import { useState } from 'react';
import { X, DatabaseBackup, Download, Check, Lock, RefreshCw, Bell } from 'lucide-react';
import { exportBackup, getLastBackupAt } from '../services/backup';
import {
  getSicherungsIntervall,
  setSicherungsIntervall,
  INTERVALL_OPTIONEN,
} from '../services/sicherungsErinnerung';
import { melde } from '../services/dialog';

interface Props {
  onClose: () => void;
}

/** Sicherung exportieren (optional verschlüsselt) und Erinnerungs-Intervall wählen.
 *  Ehrlich: Es gibt keinen Server, also auch keine heimliche Cloud-Sicherung. Die
 *  Datei geht im Browser in den Download-Ordner, in der Android-App über das
 *  Teilen-Menü - z.B. direkt nach Google Drive oder Nextcloud. */
export function DatensicherungDialog({ onClose }: Props) {
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-brand-blue/10 text-brand-blue">
              <DatabaseBackup className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-slate-900">Datensicherung</h2>
              <p className="text-xs text-slate-500">Export, Verschlüsselung und Erinnerung</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Schließen" className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Deine Daten liegen nur auf diesem Gerät. Eine Sicherung enthält Drohnen, Akkus, Flüge,
          Piloten, Wartungen, Dokumente, Flugpläne, Favoriten, Kunden und Ersatzteile.
          In der Android-App kannst du sie direkt in Google Drive, Nextcloud oder „Dateien“ ablegen.
        </p>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 rounded"
              checked={mitPasswort}
              onChange={e => setMitPasswort(e.target.checked)}
            />
            <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Lock className="w-4 h-4 text-brand-blue" /> Mit Passwort verschlüsseln
            </span>
          </label>
          {mitPasswort && (
            <div className="space-y-2">
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Passwort (mind. 8 Zeichen)"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900"
                value={passwort}
                onChange={e => setPasswort(e.target.value)}
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Passwort wiederholen"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900"
                value={passwort2}
                onChange={e => setPasswort2(e.target.value)}
              />
              <p className="text-[11px] text-slate-600 leading-relaxed">
                AES-256-verschlüsselt. Das Passwort wird nirgends gespeichert –
                ohne es lässt sich die Sicherung nicht wiederherstellen.
              </p>
              {passwortFehler && (passwort || passwort2) && (
                <p className="text-[11px] font-bold text-brand-red">{passwortFehler}</p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={exportieren}
          disabled={laeuft || !!passwortFehler}
          className="w-full py-3 rounded-2xl bg-brand-blue text-white font-bold text-sm shadow-lg shadow-brand-blue/20 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {laeuft ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span>Sicherung jetzt exportieren</span>
        </button>

        {erfolg && (
          <p className="flex items-center gap-2 text-xs font-bold text-emerald-700">
            <Check className="w-4 h-4" /> Sicherung erstellt.
          </p>
        )}

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
          <label className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Bell className="w-4 h-4 text-brand-blue" /> Erinnern, wenn die letzte Sicherung älter ist als
          </label>
          <select
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900"
            value={intervall}
            onChange={e => waehleIntervall(Number(e.target.value))}
          >
            {INTERVALL_OPTIONEN.map(t => <option key={t} value={t}>{t} Tage</option>)}
          </select>
          <p className="text-[11px] text-slate-600">
            {letzte
              ? `Letzte Sicherung: ${new Date(letzte).toLocaleString('de-DE')}`
              : 'Auf diesem Gerät wurde noch keine Sicherung erstellt.'}
          </p>
        </div>
      </div>
    </div>
  );
}
