import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  CalendarDays, ChevronDown, DatabaseBackup, Download, ExternalLink, FlaskConical, HardDrive, Info,
  KeyRound, Languages, Lock, Moon, ShieldAlert, ShieldCheck, Sun, Upload,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { dbService, type UserProfile } from '../services/db';
import { melde, bestaetige } from '../services/dialog';
import { BeschaedigteSicherungFehler, exportBackup, importBackup, PasswortNoetigFehler } from '../services/backup';
import type { Theme } from '../services/theme';
import type { Sprache } from '../services/i18n';
import { APP_VERSION, plattform } from '../lib/appInfo';
import { dauerhaftAnfordern, formatiereBytes, leseSpeicherStatus, type SpeicherStatus } from '../services/speicherSchutz';
import { cn } from '../lib/utils';
import { useSprache } from '../lib/sprache';
import { Dialog, Feld, Knopf, SeitenKopf, eingabe, knopfKlassen } from '../components/ui';

/** Einstellungen: Darstellung, Sicherheit, Datensicherung, Daten und „Über die App“.
 *  Früher stand all das unten im Profil, gemischt mit den Pilotendaten. */
export function EinstellungenView({ profile, onUpdate, onOpenPinSetup, onOpenDatensicherung, sprache, onSprache, theme, onTheme }: {
  profile: UserProfile | null;
  onUpdate: () => void;
  onOpenPinSetup: () => void;
  onOpenDatensicherung: () => void;
  sprache: Sprache;
  onSprache: () => void;
  theme: Theme;
  onTheme: () => void;
}) {
  const { t, tx } = useSprache();
  const [backupDatei, setBackupDatei] = useState<File | null>(null);
  // Verschlüsselte Sicherung: erst nach dem Passwort fragen, dann erneut versuchen.
  const [passwortFuer, setPasswortFuer] = useState<{ datei: File; modus: 'merge' | 'replace' } | null>(null);
  const [importPasswort, setImportPasswort] = useState('');

  const handleExportBackup = async () => {
    try {
      await exportBackup();
    } catch (err) {
      console.error(err);
      melde(tx('Export fehlgeschlagen.', 'Export failed.'));
    }
  };

  // Die Datei wird nur gemerkt; welcher Modus gilt, entscheidet der Nutzer
  // danach im Auswahldialog. Ohne diese Trennung wäre „Ersetzen“ ein
  // Nebeneffekt eines simplen Dateidialogs - dafür ist es zu endgültig.
  const handleImportBackup = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupDatei(file);
    e.target.value = '';
  };

  const fuehreImportAus = async (modus: 'merge' | 'replace', passwort?: string, datei?: File) => {
    const file = datei ?? backupDatei;
    if (!file) return;
    const warnung = tx(
      'Alle aktuell gespeicherten Drohnen, Akkus, Flüge, Piloten, Wartungen und Dokumente werden gelöscht und durch den Inhalt der Datei ersetzt. Alles seit dieser Sicherung Erfasste geht verloren.',
      'All drones, batteries, flights, pilots, maintenance records and documents currently stored are deleted and replaced by the file. Everything recorded since that backup is lost.',
    );
    if (!passwort && modus === 'replace' && !await bestaetige(warnung, { titel: tx('Wirklich ersetzen?', 'Really replace?'), gefaehrlich: true })) return;
    setBackupDatei(null);
    try {
      const r = await importBackup(file, modus, passwort);
      setPasswortFuer(null);
      setImportPasswort('');
      melde(
        tx(
          `${r.drones} Drohnen\n${r.batteries} Akkus\n${r.flights} Flüge\n${r.pilots} Piloten\n${r.maintenance} Wartungen\n${r.documents} Dokumente\n` +
            (r.weitere ? `${r.weitere} Flugpläne, Favoriten, Kunden, Ersatzteile\n` : '') +
            (r.profile ? 'Profil übernommen' : 'Kein Profil in der Datei'),
          `${r.drones} drones\n${r.batteries} batteries\n${r.flights} flights\n${r.pilots} pilots\n${r.maintenance} maintenance records\n${r.documents} documents\n` +
            (r.weitere ? `${r.weitere} flight plans, favourites, customers, spare parts\n` : '') +
            (r.profile ? 'Profile restored' : 'No profile in the file'),
        ),
        tx('Sicherung geladen', 'Backup loaded'),
      );
      onUpdate();
    } catch (err) {
      if (err instanceof PasswortNoetigFehler) {
        setPasswortFuer({ datei: file, modus });
        return;
      }
      console.error(err);
      if (err instanceof BeschaedigteSicherungFehler) {
        melde(tx(err.message, err.textEn), tx('Sicherung nicht eingespielt', 'Backup not restored'));
        return;
      }
      melde((err instanceof Error && err.message) || tx('Import fehlgeschlagen.', 'Import failed.'));
    }
  };

  const zeile = 'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors';

  return (
    <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto pb-20 space-y-6">
      <SeitenKopf titel={t('view.einstellungen')} untertitel={tx('Darstellung, Sicherheit & Daten', 'Display, security & data')} />

      {/* Darstellung */}
      <Karte titel={tx('Darstellung', 'Display')}>
        <div className="divide-y divide-slate-200 -mx-5 -mb-5 border-t border-slate-200">
          <button type="button" onClick={onSprache} className={zeile}>
            <Languages className="w-5 h-5 shrink-0 text-slate-500" />
            <span className="flex-1 text-sm font-bold text-slate-700">{t('mehr.sprache')}</span>
            <span className="text-sm font-bold text-brand-blue">{sprache === 'en' ? 'English' : 'Deutsch'}</span>
          </button>
          <button type="button" onClick={onTheme} className={zeile}>
            {theme === 'dark' ? <Sun className="w-5 h-5 shrink-0 text-slate-500" /> : <Moon className="w-5 h-5 shrink-0 text-slate-500" />}
            <span className="flex-1 text-sm font-bold text-slate-700">{t('mehr.design')}</span>
            <span className="text-sm font-bold text-slate-500">{theme === 'dark' ? t('mehr.dunkel') : t('mehr.hell')}</span>
          </button>
        </div>
      </Karte>

      {/* Sicherheit */}
      <Karte titel={tx('Bildschirmsperre', 'Screen lock')} icon={Lock}>
        <p className="text-sm text-slate-600">
          {tx('Eine PIN schützt die App vor neugierigen Blicken. Sie verschlüsselt die Daten nicht.', 'A PIN protects the app from prying eyes. It does not encrypt the data.')}
        </p>
        <Knopf variante="sekundaer" voll icon={Lock} onClick={onOpenPinSetup}>{tx('PIN einrichten oder ändern', 'Set up or change PIN')}</Knopf>
      </Karte>

      {/* Datensicherung */}
      <Karte titel={tx('Datensicherung', 'Backup')} icon={DatabaseBackup}>
        <p className="text-sm text-slate-600">
          {tx('Sichere alle deine Daten in eine Datei und lade sie bei Handywechsel oder Datenverlust wieder ein.', 'Save all your data to one file and load it again after changing phones or losing data.')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Knopf icon={Download} onClick={handleExportBackup}>{tx('Exportieren', 'Export')}</Knopf>
          <label className={cn(knopfKlassen('sekundaer', 'md'), 'cursor-pointer')}>
            <Upload className="w-4 h-4" /> {tx('Laden', 'Load')}
            <input type="file" className="hidden" accept="application/json,.json" onChange={handleImportBackup} />
          </label>
        </div>
        <Knopf variante="geist" voll icon={KeyRound} onClick={onOpenDatensicherung}>{tx('Verschlüsselt sichern & Erinnerung einstellen', 'Encrypted backup & reminder')}</Knopf>
        <p className="text-xs text-slate-500">
          {tx('Aus Sicherheitsgründen enthält die Datei keine NOTAM-Zugangsdaten. Die musst du nach einer Wiederherstellung einmal neu eintragen.', 'For security reasons the file contains no NOTAM credentials. Enter them again once after a restore.')}
        </p>
      </Karte>

      <SpeicherKarte />
      <NotamKarte profile={profile} onUpdate={onUpdate} />
      <KalenderKarte profile={profile} />
      <BeispieldatenKarte onUpdate={onUpdate} />

      <div className="p-5 bg-amber-50 rounded-3xl border border-amber-100 flex gap-4">
        <ShieldAlert className="w-6 h-6 text-amber-800 shrink-0" />
        <p className="text-sm text-amber-800 leading-relaxed">
          {tx('Deine Daten liegen nur auf diesem Gerät. SkyLog DE sendet keine Flugdaten an einen Server. Auf Android kann zusätzlich die Systemsicherung deines Google-Kontos die App-Daten sichern – das steuerst du in den Android-Einstellungen.', 'Your data stays on this device. SkyLog DE sends no flight data to a server. On Android, your Google account system backup may also back up the app data – you control this in the Android settings.')}
        </p>
      </div>

      {/* Über die App */}
      <Karte titel={tx('Über die App', 'About the app')} icon={Info}>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Version</dt><dd className="font-bold text-slate-900 text-right">{APP_VERSION}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500">{tx('Plattform', 'Platform')}</dt><dd className="font-bold text-slate-900 text-right">{plattform(tx)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500">{tx('Speicher', 'Storage')}</dt><dd className="font-bold text-slate-900 text-right">{tx('Lokal (IndexedDB)', 'Local (IndexedDB)')}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500">{tx('Lizenz', 'Licence')}</dt><dd className="font-bold text-slate-900 text-right">{tx('Privat / nicht kommerziell', 'Private / non-commercial')}</dd></div>
        </dl>
        <a href="/datenschutz.html" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:underline">
          <ExternalLink className="w-4 h-4" /> {tx('Datenschutzerklärung', 'Privacy policy')}
        </a>
      </Karte>

      {/* Passwort für eine verschlüsselte Sicherung */}
      {passwortFuer && (
        <Dialog
          titel={tx('Verschlüsselte Sicherung', 'Encrypted backup')}
          icon={KeyRound}
          breite="sm"
          onClose={() => { setPasswortFuer(null); setImportPasswort(''); }}
          fuss={
            <>
              <Knopf variante="sekundaer" className="flex-1" onClick={() => { setPasswortFuer(null); setImportPasswort(''); }}>{t('aktion.abbrechen')}</Knopf>
              <Knopf className="flex-1" disabled={!importPasswort} onClick={() => void fuehreImportAus(passwortFuer.modus, importPasswort, passwortFuer.datei)}>
                {tx('Entschlüsseln & laden', 'Decrypt & load')}
              </Knopf>
            </>
          }
        >
          <Feld label={tx('Passwort der Sicherung', 'Backup password')} htmlFor="es-passwort">
            <input
              id="es-passwort"
              type="password"
              autoFocus
              autoComplete="current-password"
              className={eingabe}
              value={importPasswort}
              onChange={e => setImportPasswort(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && importPasswort) void fuehreImportAus(passwortFuer.modus, importPasswort, passwortFuer.datei); }}
            />
          </Feld>
        </Dialog>
      )}

      {/* Auswahl: Zusammenführen oder Ersetzen */}
      {backupDatei && (
        <Dialog titel={tx('Sicherung laden', 'Load backup')} untertitel={backupDatei.name} icon={Upload} breite="sm" onClose={() => setBackupDatei(null)}>
          <button
            type="button"
            onClick={() => void fuehreImportAus('merge')}
            className="w-full text-left p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 transition-colors"
          >
            <p className="text-sm font-bold text-slate-900">{tx('Zusammenführen', 'Merge')}</p>
            <p className="text-xs text-slate-600 leading-relaxed mt-1">
              {tx('Einträge aus der Datei kommen hinzu. Gleiche Einträge werden überschrieben, alles andere bleibt erhalten. Nichts wird gelöscht.', 'Entries from the file are added. Matching entries are overwritten, everything else stays. Nothing is deleted.')}
            </p>
          </button>
          <button
            type="button"
            onClick={() => void fuehreImportAus('replace')}
            className="w-full text-left p-4 bg-red-50 border border-red-100 rounded-2xl hover:bg-red-100 transition-colors"
          >
            <p className="text-sm font-bold text-brand-red">{tx('Ersetzen', 'Replace')}</p>
            <p className="text-xs text-slate-600 leading-relaxed mt-1">
              {tx('Der Datenbestand entspricht danach genau der Datei. Alles seit dieser Sicherung Erfasste geht verloren.', 'Afterwards your data matches the file exactly. Everything recorded since that backup is lost.')}
            </p>
          </button>
        </Dialog>
      )}
    </div>
  );
}

function Karte({ titel, icon: Icon, children }: { titel: string; icon?: typeof Lock; children: ReactNode }) {
  return (
    <section className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
        {Icon && <Icon className="w-4 h-4 text-brand-blue" />} {titel}
      </h3>
      {children}
    </section>
  );
}

/** Speicherplatz: Darf der Browser die Daten bei Speichermangel löschen? */
function SpeicherKarte() {
  const { tx, sprache } = useSprache();
  const nativ = Capacitor.isNativePlatform();
  const [status, setStatus] = useState<SpeicherStatus | null>(null);
  useEffect(() => { void leseSpeicherStatus().then(setStatus); }, []);

  const anfordern = async () => {
    const gewaehrt = await dauerhaftAnfordern();
    setStatus(await leseSpeicherStatus());
    if (!gewaehrt) {
      melde(tx(
        'Der Browser hat dauerhaften Speicher nicht gewährt. Chrome gewährt ihn meist, sobald die App installiert ist („Zum Startbildschirm hinzufügen“). Bis dahin schützt dich eine regelmäßige Sicherung.',
        'The browser did not grant persistent storage. Chrome usually grants it once the app is installed (“Add to home screen”). Until then, a regular backup protects you.',
      ));
    }
  };

  return (
    <Karte titel={tx('Speicherplatz', 'Storage')} icon={HardDrive}>
      {nativ ? (
        <p className="text-sm text-slate-600">
          {tx('Die App speichert im App-Speicher von Android. Gelöscht wird er nur, wenn du die App-Daten löschst oder die App entfernst.', 'The app stores its data in Android app storage. It is only deleted if you clear the app data or remove the app.')}
        </p>
      ) : status?.dauerhaft === true ? (
        <p className="flex items-start gap-2 text-sm font-bold text-brand-green">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          {tx('Dauerhaft gespeichert – der Browser löscht die Daten nicht von sich aus.', 'Stored persistently – the browser will not delete the data on its own.')}
        </p>
      ) : status?.dauerhaft === false ? (
        <>
          <p className="text-sm text-slate-600">
            {tx('Der Browser darf die Daten bei Speichermangel löschen. Fordere dauerhaften Speicher an – und exportiere trotzdem regelmäßig eine Sicherung.', 'The browser may delete the data when storage runs low. Request persistent storage – and still export a backup regularly.')}
          </p>
          <Knopf variante="sekundaer" voll icon={ShieldCheck} onClick={() => void anfordern()}>
            {tx('Dauerhaft speichern', 'Store persistently')}
          </Knopf>
        </>
      ) : status ? (
        <p className="text-sm text-slate-600">
          {tx('Dieser Browser meldet nicht, ob die Daten dauerhaft gespeichert sind. Exportiere regelmäßig eine Sicherung.', 'This browser does not report whether the data is stored persistently. Export a backup regularly.')}
        </p>
      ) : null}
      {!nativ && status?.belegt !== undefined && (
        <p className="text-xs text-slate-500">
          {tx('Belegt', 'Used')}: {formatiereBytes(status.belegt, sprache)}
          {status.gesamt ? ` ${tx('von', 'of')} ${formatiereBytes(status.gesamt, sprache)} ${tx('möglich', 'available')}` : ''}
        </p>
      )}
    </Karte>
  );
}

/** NOTAM-Zugang (FAA). Eingeklappt, weil die wenigsten ihn brauchen. */
function NotamKarte({ profile, onUpdate }: { profile: UserProfile | null; onUpdate: () => void }) {
  const { tx } = useSprache();
  const [offen, setOffen] = useState(!!profile?.notamClientId);
  const [id, setId] = useState(profile?.notamClientId ?? '');
  const [geheim, setGeheim] = useState(profile?.notamClientSecret ?? '');
  const [gespeichert, setGespeichert] = useState(false);

  const speichern = async () => {
    if (!profile) return;
    await dbService.saveProfile({ ...profile, notamClientId: id.trim(), notamClientSecret: geheim.trim() });
    setGespeichert(true);
    onUpdate();
  };

  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <button type="button" onClick={() => setOffen(o => !o)} aria-expanded={offen} className="w-full flex items-center gap-3 p-5 text-left">
        <KeyRound className="w-4 h-4 text-brand-blue shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-slate-900">{tx('NOTAM-Zugang (optional, für Fortgeschrittene)', 'NOTAM access (optional, advanced)')}</span>
          <span className="block text-xs text-slate-500">{profile?.notamClientId ? tx('Eingerichtet', 'Set up') : tx('Nicht eingerichtet – die App funktioniert auch ohne', 'Not set up – the app works without it')}</span>
        </span>
        <ChevronDown className={cn('w-4 h-4 text-slate-500 transition-transform', offen && 'rotate-180')} />
      </button>
      {offen && (
        <div className="px-5 pb-5 space-y-3 border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {tx('NOTAMs sind kurzfristige Luftraumsperrungen. Die App liest sie über die Schnittstelle der US-Luftfahrtbehörde FAA, die auch deutsche Flughäfen abdeckt. Dafür brauchst du einen kostenlosen Zugang von developer.faa.gov. Ohne Zugang findest du NOTAMs für Drohnen auch auf ', 'NOTAMs are short-term airspace restrictions. The app reads them via the US FAA interface, which also covers German airports. You need a free account from developer.faa.gov. Without it, you can find NOTAMs for drones on ')}
            <a className="font-bold text-brand-blue hover:underline" href="https://maptool-dipul.dfs.de/" target="_blank" rel="noopener noreferrer">dipul</a>.
          </p>
          {!profile ? (
            <p className="text-sm font-bold text-amber-800 bg-amber-50 rounded-2xl p-3">{tx('Lege zuerst dein Pilotenprofil an.', 'Create your pilot profile first.')}</p>
          ) : (
            <>
              <Feld label="client_id" htmlFor="notam-id">
                <input id="notam-id" type="text" className={eingabe} value={id} onChange={e => { setId(e.target.value); setGespeichert(false); }} autoComplete="off" />
              </Feld>
              <Feld label="client_secret" htmlFor="notam-geheim">
                <input id="notam-geheim" type="password" className={eingabe} value={geheim} onChange={e => { setGeheim(e.target.value); setGespeichert(false); }} autoComplete="off" />
              </Feld>
              <Knopf variante="sekundaer" voll onClick={() => void speichern()}>{gespeichert ? tx('Gespeichert', 'Saved') : tx('Zugang speichern', 'Save access')}</Knopf>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** Beispieldaten zum Ausprobieren laden oder wieder entfernen (nur demo-Einträge). */
function BeispieldatenKarte({ onUpdate }: { onUpdate: () => void }) {
  const { tx } = useSprache();
  const [vorhanden, setVorhanden] = useState<boolean | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    import('../services/demoDaten').then(m => m.hatBeispieldaten()).then(setVorhanden).catch(() => setVorhanden(false));
  }, []);

  const umschalten = async () => {
    setLaeuft(true);
    const m = await import('../services/demoDaten');
    if (vorhanden) await m.entferneBeispieldaten(); else await m.ladeBeispieldaten();
    setVorhanden(!vorhanden);
    setLaeuft(false);
    onUpdate();
  };

  return (
    <Karte titel={tx('Beispieldaten', 'Sample data')} icon={FlaskConical}>
      <p className="text-sm text-slate-600 leading-relaxed">
        {vorhanden
          ? tx('Beispieldaten sind geladen (2 Drohnen, 4 Akkus, 14 Flüge …). Entfernen löscht nur diese – deine eigenen Einträge bleiben.', 'Sample data is loaded (2 drones, 4 batteries, 14 flights …). Removing deletes only these – your own entries stay.')
          : tx('Zum Ausprobieren: lädt Beispiel-Drohnen, Akkus, Flüge, Wartung und Ersatzteile. Lässt sich jederzeit wieder entfernen.', 'For trying things out: loads sample drones, batteries, flights, maintenance and spare parts. Can be removed at any time.')}
      </p>
      <Knopf variante={vorhanden ? 'sekundaer' : 'primaer'} voll onClick={() => void umschalten()} disabled={laeuft || vorhanden === null}>
        {laeuft ? tx('Lädt …', 'Loading …') : vorhanden ? tx('Beispieldaten entfernen', 'Remove sample data') : tx('Beispieldaten laden', 'Load sample data')}
      </Knopf>
    </Karte>
  );
}

/** Fristen (Lizenz, Garantie, Wartung, Sicherung) als .ics für Outlook/Google/Apple. */
function KalenderKarte({ profile }: { profile: UserProfile | null }) {
  const { tx } = useSprache();
  const [laeuft, setLaeuft] = useState(false);

  const exportieren = async () => {
    setLaeuft(true);
    try {
      const [{ planeBenachrichtigungen }, { alsIcs }, { getLastBackupAt }, { getSicherungsIntervall }, { speichereDatei }] = await Promise.all([
        import('../services/benachrichtigungen'), import('../services/kalender'), import('../services/backup'),
        import('../services/sicherungsErinnerung'), import('../lib/dateiAusgabe'),
      ]);
      const [drohnen, akkus] = await Promise.all([dbService.getDrones(), dbService.getBatteries()]);
      const termine = planeBenachrichtigungen(profile, drohnen, akkus, getLastBackupAt(), getSicherungsIntervall());
      if (termine.length === 0) {
        melde(tx('Aktuell stehen keine Fristen an. Trage Lizenzablauf, Garantie oder Wartung ein, dann gibt es Termine.', 'No deadlines coming up. Add licence expiry, warranty or maintenance to get calendar entries.'));
        return;
      }
      await speichereDatei('skylog_fristen.ics', alsIcs(termine), 'text/calendar');
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <Karte titel={tx('Fristen im Kalender', 'Deadlines in your calendar')} icon={CalendarDays}>
      <p className="text-sm text-slate-600 leading-relaxed">
        {tx('Lizenzablauf, Garantie-Ende, Wartung und fällige Sicherung als Kalenderdatei (.ics) für Outlook, Google oder Apple. Erneut importieren aktualisiert die Termine.', 'Licence expiry, warranty end, maintenance and backup due as a calendar file (.ics) for Outlook, Google or Apple. Importing again updates the entries.')}
      </p>
      <Knopf variante="sekundaer" voll onClick={() => void exportieren()} disabled={laeuft}>
        {laeuft ? tx('Wird erstellt …', 'Creating …') : tx('Kalenderdatei herunterladen', 'Download calendar file')}
      </Knopf>
    </Karte>
  );
}
