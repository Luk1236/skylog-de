import { useEffect, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle, DatabaseBackup, Download, ExternalLink, FileDigit, Lock,
  Plus, Settings, ShieldAlert, ShieldCheck, Trash2, Upload, User,
} from 'lucide-react';
import { dbService, type UserProfile, type AppDocument } from '../services/db';
import { melde, bestaetige } from '../services/dialog';
import { exportBackup, importBackup, PasswortNoetigFehler } from '../services/backup';
import { cn } from '../lib/utils';
import { useSprache } from '../lib/sprache';

export function ProfileView({ profile, documents, onUpdate, onOpenEid, onOpenPinSetup }: { profile: UserProfile | null, documents: AppDocument[], onUpdate: () => void, onOpenEid?: () => void, onOpenPinSetup?: () => void }) {
  const { t, tx } = useSprache();
  const [isEditing, setIsEditing] = useState(!profile);
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>(profile || { id: 'main_profile' });

  const handleSaveProfile = async () => {
    if (!editedProfile.name || !editedProfile.eid) return;
    await dbService.saveProfile({
      id: 'main_profile',
      name: editedProfile.name,
      eid: editedProfile.eid,
      licenseType: editedProfile.licenseType || 'None',
      licenseExpiry: editedProfile.licenseExpiry || '',
      insuranceNumber: editedProfile.insuranceNumber || '',
      isBOS: !!editedProfile.isBOS,
      notamClientId: editedProfile.notamClientId || '',
      notamClientSecret: editedProfile.notamClientSecret || '',
    } as UserProfile);
    setIsEditing(false);
    onUpdate();
  };

  const getExpiryStatus = (date?: string) => {
    if (!date) return { color: 'text-slate-400', label: 'Kein Datum' };
    const expiry = new Date(date);
    const left = expiry.getTime() - Date.now();
    const days = Math.ceil(left / (1000 * 60 * 60 * 24));
    
    if (days < 0) return { color: 'text-brand-red', label: 'Abgelaufen!' };
    if (days < 30) return { color: 'text-amber-500', label: `Läuft in ${days} Tagen ab` };
    return { color: 'text-brand-green', label: `Gültig (${days} Tage)` };
  };

  const expiry = getExpiryStatus(profile?.licenseExpiry);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      melde('Bitte laden Sie nur PDF-Dateien hoch (z.B. den Fernpilotennachweis).');
      return;
    }

    try {
      await dbService.saveDocument({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        data: file,
        createdAt: Date.now()
      });
      onUpdate();
    } catch (err) {
      console.error(err);
      melde('Fehler beim Speichern des Dokuments.');
    }
  };

  const exportPilotBadge = async () => {
    if (!profile) return;
    // jsPDF wiegt zusammen mit html2canvas rund 400 kB und wird nur hier
    // gebraucht — deshalb erst beim Klick laden, nicht beim App-Start.
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [148, 105] });
    doc.setFillColor(0, 56, 123);
    doc.rect(0, 0, 148, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SkyLog DE — Piloten-Ausweis', 10, 13);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Unmanned Aircraft System Operator', 10, 21);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(profile.name, 10, 45);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`LBA e-ID:`, 10, 57);
    doc.setTextColor(0, 56, 123);
    doc.setFont('helvetica', 'bold');
    doc.text(profile.eid, 35, 57);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.text(`Lizenztyp:`, 10, 65);
    doc.text(profile.licenseType, 35, 65);
    if (profile.licenseExpiry) {
      doc.text(`Gültig bis:`, 10, 73);
      doc.text(profile.licenseExpiry, 35, 73);
    }
    if (profile.insuranceNumber) {
      doc.text(`Versicherung:`, 10, 81);
      doc.text(profile.insuranceNumber, 40, 81);
    }
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generiert: ${new Date().toLocaleDateString('de-DE')} · SkyLog DE`, 10, 100);
    doc.setDrawColor(200, 200, 200);
    doc.rect(5, 35, 138, 60);
    doc.save(`skylog_ausweis_${profile.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handlePreview = (doc: AppDocument) => {
    const url = URL.createObjectURL(doc.data);
    window.open(url, '_blank');
  };

  const handleDelete = async (id: string) => {
    if (await bestaetige('Dokument wirklich löschen?', { gefaehrlich: true })) {
      await dbService.deleteDocument(id);
      onUpdate();
    }
  };

  const [backupDatei, setBackupDatei] = useState<File | null>(null);
  // Verschluesselte Sicherung: erst nach dem Passwort fragen, dann erneut versuchen.
  const [passwortFuer, setPasswortFuer] = useState<{ datei: File; modus: 'merge' | 'replace' } | null>(null);
  const [importPasswort, setImportPasswort] = useState('');

  const handleExportBackup = async () => {
    try {
      await exportBackup();
    } catch (err) {
      console.error(err);
      melde('Export fehlgeschlagen.');
    }
  };

  // Die Datei wird nur gemerkt; welcher Modus gilt, entscheidet der Nutzer
  // danach im Auswahldialog. Ohne diese Trennung waere "Ersetzen" ein
  // Nebeneffekt eines simplen Dateidialogs - dafuer ist es zu endgueltig.
  const handleImportBackup = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupDatei(file);
    e.target.value = '';
  };

  const fuehreImportAus = async (modus: 'merge' | 'replace', passwort?: string, datei?: File) => {
    const file = datei ?? backupDatei;
    if (!file) return;
    const warnung = [
      'Alle aktuell gespeicherten Drohnen, Akkus, Flüge, Piloten, Wartungen',
      'und Dokumente werden gelöscht und durch den Inhalt der Datei ersetzt.',
      'Alles seit dieser Sicherung Erfasste geht verloren.',
    ].join(String.fromCharCode(10));
    if (!passwort && modus === 'replace' && !await bestaetige(warnung, { titel: 'Wirklich ersetzen?', gefaehrlich: true })) return;
    setBackupDatei(null);
    try {
      const r = await importBackup(file, modus, passwort);
      setPasswortFuer(null);
      setImportPasswort('');
      melde(
        `${r.drones} Drohnen\n${r.batteries} Akkus\n${r.flights} Flüge\n` +
        `${r.pilots} Piloten\n${r.maintenance} Wartungen\n${r.documents} Dokumente\n` +
        (r.weitere ? `${r.weitere} Flugpläne, Favoriten, Kunden, Ersatzteile\n` : '') +
        `${r.profile ? 'Profil übernommen' : 'Kein Profil in der Datei'}`,
        'Sicherung geladen ✓'
      );
      onUpdate();
    } catch (err) {
      if (err instanceof PasswortNoetigFehler) {
        setPasswortFuer({ datei: file, modus });
        return;
      }
      console.error(err);
      melde((err instanceof Error && err.message) || 'Import fehlgeschlagen.');
    }
  };

  return (
    <div className="max-w-md lg:max-w-3xl mx-auto pb-20">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand-blue">{t('view.profil')}</h2>
            <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">{tx('Stammdaten & Lizenzen', 'Personal data & licences')}</p>
          </div>
          <div className="flex items-center gap-2">
            {profile?.isBOS && (
              <div className="bg-brand-red text-white text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">BOS Pilot</div>
            )}
            {onOpenPinSetup && (
              <button
                onClick={onOpenPinSetup}
                className="p-2.5 text-slate-400 hover:text-sky-600 bg-white border border-slate-200 rounded-2xl shadow-sm transition-all"
                title={tx('Bildschirmsperre (PIN) verwalten', 'Manage screen lock (PIN)')}
              >
                <Lock className="w-5 h-5" />
              </button>
            )}
            {profile && (
              <button
                onClick={exportPilotBadge}
                className="p-2.5 text-slate-400 hover:text-brand-blue bg-white border border-slate-200 rounded-2xl shadow-sm transition-all"
                title={tx('Piloten-Ausweis als PDF', 'Pilot ID card as PDF')}
              >
                <FileDigit className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-8 relative">
        {!isEditing ? (
          <>
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-brand-blue transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                <User className="w-8 h-8 text-brand-blue" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg leading-tight">{profile?.name || 'Vollständiger Name'}</h3>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{profile?.licenseType || 'Keine Lizenz'}</p>
                  <span className={cn("text-[10px] font-bold", expiry.color)}>&bull; {expiry.label}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-2xl relative">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">LBA e-ID</p>
                    {onOpenEid && (
                      <button onClick={onOpenEid} className="text-[10px] font-bold text-sky-600 hover:underline">{tx('Verwalten', 'Manage')}</button>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-800 font-mono">{profile?.eid || 'Nicht hinterlegt'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{tx('Versicherung', 'Insurance')}</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{profile?.insuranceNumber || 'Nicht hinterlegt'}</p>
                </div>
              </div>
              {profile?.eid && (
                <div className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{tx('LBA e-ID QR-Code', 'LBA e-ID QR code')}</p>
                  <EidQrCode eid={profile.eid} />
                  <p className="text-[10px] text-slate-500 text-center">{tx('Für Bodeninspektion scannen', 'Scan for ground inspection')}</p>
                </div>
              )}
              {profile && (
                <div className="p-4 bg-brand-green/5 border border-brand-green/10 rounded-2xl flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-brand-green" />
                  <div>
                    <p className="text-xs font-bold text-brand-green">{tx('Status: Aktiv & Bereit', 'Status: active & ready')}</p>
                    <p className="text-[10px] text-slate-500">{tx('Ihre Daten sind für das Logbuch bereit.', 'Your data is ready for the logbook.')}</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm mb-2">{tx('Profil Bearbeiten', 'Edit profile')}</h3>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">{tx('Vollständiger Name', 'Full name')}</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={editedProfile.name || ''} onChange={e => setEditedProfile({...editedProfile, name: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">{tx('LBA e-ID (Registrierungsnummer)', 'LBA e-ID (registration number)')}</label>
              <input type="text" placeholder="DEU..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={editedProfile.eid || ''} onChange={e => setEditedProfile({...editedProfile, eid: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">{tx('Lizenz Typ', 'Licence type')}</label>
                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={editedProfile.licenseType || ''} onChange={e => setEditedProfile({...editedProfile, licenseType: e.target.value as UserProfile['licenseType']})}>
                  <option value="None">{tx('Keine', 'None')}</option>
                  <option value="A1/A3">A1/A3</option>
                  <option value="A2">{tx('A2 (Fernpiloten-Zeugnis)', 'A2 (remote pilot certificate)')}</option>
                  <option value="STS">{tx('STS (Spezielle Kat.)', 'STS (specific cat.)')}</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">{tx('Gültig bis', 'Valid until')}</label>
                <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={editedProfile.licenseExpiry || ''} onChange={e => setEditedProfile({...editedProfile, licenseExpiry: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">{tx('Versicherungs-Nr.', 'Insurance no.')}</label>
                <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={editedProfile.insuranceNumber || ''} onChange={e => setEditedProfile({...editedProfile, insuranceNumber: e.target.value})} />
              </div>
              <div className="flex flex-col justify-end">
                <button 
                  onClick={() => setEditedProfile({...editedProfile, isBOS: !editedProfile.isBOS})}
                  className={cn(
                    "w-full py-2.5 rounded-xl border text-[10px] font-bold transition-all",
                    editedProfile.isBOS ? "bg-brand-red text-white border-brand-red" : "bg-slate-50 text-slate-400 border-slate-200"
                  )}
                >
                  {editedProfile.isBOS ? "BOS STATUS: AN" : "BOS STATUS: AUS"}
                </button>
              </div>
            </div>
            {/* NOTAM API-Zugangsdaten */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{tx('NOTAM API (Optional)', 'NOTAM API (optional)')}</p>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {tx('Kostenloser API-Key von', 'Free API key from')} <span className="font-bold text-brand-blue">developer.faa.gov</span> {tx('· Zeigt aktuelle Luftraumsperrungen (NOTAMs) vor dem Flug an.', '· Shows current airspace closures (NOTAMs) before the flight.')}
              </p>
              <input
                type="text"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                placeholder="client_id"
                value={editedProfile.notamClientId || ''}
                onChange={e => setEditedProfile({...editedProfile, notamClientId: e.target.value})}
              />
              <input
                type="password"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                placeholder="client_secret"
                value={editedProfile.notamClientSecret || ''}
                onChange={e => setEditedProfile({...editedProfile, notamClientSecret: e.target.value})}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveProfile}
                className="flex-1 bg-brand-blue text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-blue/20 text-xs active:scale-95 transition-all"
              >
                {tx('Profil Speichern', 'Save profile')}
              </button>
              {profile && (
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-3 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs"
                >
                  {t('aktion.abbrechen')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-sm">{tx('PDF Dokumente', 'PDF documents')}</h3>
          <label className="bg-brand-blue text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-brand-blue/20">
            <Plus className="w-4 h-4 inline-block mr-1" /> {tx('Neu', 'New')}
            <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
          </label>
      </div>

      <div className="space-y-3">
        {documents.map(doc => (
          <div key={doc.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                <FileDigit className="w-5 h-5 text-blue-500" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-800 truncate">{doc.name}</p>
                <p className="text-[10px] text-slate-400 font-medium">{tx('Hochgeladen am', 'Uploaded on')} {new Date(doc.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handlePreview(doc)} className="p-2 text-brand-blue active:scale-90"><ExternalLink className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(doc.id)} className="p-2 text-slate-200 hover:text-brand-red active:scale-90"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}

        {documents.length === 0 && (
          <div className="text-center py-8 bg-white rounded-3xl border-2 border-dashed border-slate-100">
            <FileDigit className="w-8 h-8 text-slate-100 mx-auto mb-2" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tx('Keine PDF-Dokumente', 'No PDF documents')}</p>
          </div>
        )}
      </div>

      <KalenderKarte profile={profile} />
      <BeispieldatenKarte onUpdate={onUpdate} />

      {/* Datensicherung */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-3">
          <DatabaseBackup className="w-4 h-4 text-brand-blue" />
          <h3 className="font-bold text-slate-900 text-sm">{tx('Datensicherung', 'Backup')}</h3>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed mb-3">
          {tx('Sichere alle deine Daten in eine Datei — und lade sie bei Handywechsel oder Datenverlust wieder ein. Mit Passwort verschlüsselt: „Mehr → Datensicherung“.', 'Save all your data to one file — and load it again after changing phones or losing data. Password-encrypted: “More → Backup”.')}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleExportBackup}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-blue text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-blue/20 text-xs active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" /> {tx('Sicherung exportieren', 'Export backup')}
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-xs cursor-pointer active:scale-95 transition-all">
            <Upload className="w-4 h-4" /> {tx('Laden', 'Load')}
            <input type="file" className="hidden" accept="application/json,.json" onChange={handleImportBackup} />
          </label>
        </div>
        <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
          {tx('Aus Sicherheitsgruenden enthaelt die Datei keine NOTAM-Zugangsdaten. Die musst du nach einer Wiederherstellung einmal neu eintragen.', 'For security reasons the file contains no NOTAM credentials. Enter them again once after a restore.')}
        </p>
      </div>

      {/* Passwort fuer eine verschluesselte Sicherung */}
      {passwortFuer && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 space-y-3"
            onSubmit={e => { e.preventDefault(); void fuehreImportAus(passwortFuer.modus, importPasswort, passwortFuer.datei); }}
          >
            <h3 className="font-black text-slate-900">{tx('Verschlüsselte Sicherung', 'Encrypted backup')}</h3>
            <p className="text-xs text-slate-600">{tx('Gib das Passwort ein, mit dem die Sicherung erstellt wurde.', 'Enter the password the backup was created with.')}</p>
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900"
              value={importPasswort}
              onChange={e => setImportPasswort(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setPasswortFuer(null); setImportPasswort(''); }}
                className="flex-1 py-3 text-xs font-bold text-slate-600 bg-slate-100 rounded-2xl">
                {t('aktion.abbrechen')}
              </button>
              <button type="submit" disabled={!importPasswort}
                className="flex-1 py-3 text-xs font-bold text-white bg-brand-blue rounded-2xl disabled:opacity-50">
                {tx('Entschlüsseln & laden', 'Decrypt & load')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Auswahl: Zusammenfuehren oder Ersetzen */}
      {backupDatei && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6">
            <h3 className="font-black text-slate-900 mb-1">{tx('Sicherung laden', 'Load backup')}</h3>
            <p className="text-[10px] text-slate-400 mb-5 truncate">{backupDatei.name}</p>

            <button
              onClick={() => fuehreImportAus('merge')}
              className="w-full text-left p-4 mb-3 bg-slate-50 border border-slate-200 rounded-2xl active:scale-[0.98] transition-transform"
            >
              <p className="text-xs font-black text-slate-900">{tx('Zusammenfuehren', 'Merge')}</p>
              <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                {tx('Eintraege aus der Datei kommen hinzu. Gleiche IDs werden ueberschrieben, alles andere bleibt erhalten. Nichts wird geloescht.', 'Entries from the file are added. Matching IDs are overwritten, everything else stays. Nothing is deleted.')}
              </p>
            </button>

            <button
              onClick={() => fuehreImportAus('replace')}
              className="w-full text-left p-4 mb-4 bg-brand-red/5 border border-brand-red/20 rounded-2xl active:scale-[0.98] transition-transform"
            >
              <p className="text-xs font-black text-brand-red">{tx('Ersetzen', 'Replace')}</p>
              <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                {tx('Der Datenbestand entspricht danach exakt der Datei. Alles seit dieser Sicherung Erfasste geht verloren.', 'Afterwards your data matches the file exactly. Everything recorded since that backup is lost.')}
              </p>
            </button>

            <button
              onClick={() => setBackupDatei(null)}
              className="w-full py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-2xl"
            >
              {t('aktion.abbrechen')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 p-5 bg-amber-50 rounded-3xl border border-amber-100 flex gap-4">
        <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0" />
        <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
          {tx('Ihre Daten werden nur lokal auf diesem Gerät gespeichert. SkyLog DE sendet keine Flugdaten an Cloud-Server.', 'Your data is stored only on this device. SkyLog DE sends no flight data to cloud servers.')}
        </p>
      </div>

      {/* Version & Impressum */}
      <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{tx('App-Info', 'App info')}</p>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-500">Version</span>
          <span className="text-[10px] font-bold text-slate-900">1.0.0</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-500">{tx('Plattform', 'Platform')}</span>
          <span className="text-[10px] font-bold text-slate-900">PWA · IndexedDB</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-500">{tx('Lizenz', 'Licence')}</span>
          <span className="text-[10px] font-bold text-slate-900">{tx('Privat / Nicht-kommerziell', 'Private / non-commercial')}</span>
        </div>
        <div className="pt-2 flex gap-3">
          <a
            href="/datenschutz.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-bold text-brand-blue"
          >
            <ExternalLink className="w-3 h-3" /> {tx('Datenschutzerklärung', 'Privacy policy')}
          </a>
        </div>
      </div>
    </div>
  );
}

/** QR-Code der e-ID - lokal erzeugt. Frueher kam das Bild von api.qrserver.com,
 *  d.h. die e-ID ging bei jedem Oeffnen des Profils an einen fremden Dienst. */
function EidQrCode({ eid }: { eid: string }) {
  const [bild, setBild] = useState<string | null>(null);
  useEffect(() => {
    let aktiv = true;
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(eid, { margin: 1, width: 256, errorCorrectionLevel: 'M' }))
      .then(url => { if (aktiv) setBild(url); })
      .catch(() => { if (aktiv) setBild(null); });
    return () => { aktiv = false; };
  }, [eid]);
  if (!bild) return <div className="w-32 h-32 rounded-xl bg-white" aria-hidden />;
  return <img src={bild} alt="LBA e-ID QR-Code" className="w-32 h-32 rounded-xl bg-white p-1" />;
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
    <div className="mt-10 p-5 bg-white rounded-3xl border border-slate-200">
      <h3 className="font-bold text-slate-900 text-sm mb-1">{tx('Beispieldaten', 'Sample data')}</h3>
      <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
        {vorhanden
          ? tx('Beispieldaten sind geladen (2 Drohnen, 4 Akkus, 14 Flüge …). Entfernen löscht nur diese – deine eigenen Einträge bleiben.', 'Sample data is loaded (2 drones, 4 batteries, 14 flights …). Removing deletes only these – your own entries stay.')
          : tx('Zum Ausprobieren: lädt Beispiel-Drohnen, Akkus, Flüge, Wartung und Ersatzteile. Lässt sich jederzeit wieder entfernen.', 'For trying things out: loads sample drones, batteries, flights, maintenance and spare parts. Can be removed at any time.')}
      </p>
      <button
        onClick={umschalten}
        disabled={laeuft || vorhanden === null}
        className={cn('w-full py-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50',
          vorhanden ? 'bg-slate-100 text-slate-700' : 'bg-brand-blue text-white')}
      >
        {laeuft ? tx('Lädt …', 'Loading …') : vorhanden ? tx('Beispieldaten entfernen', 'Remove sample data') : tx('Beispieldaten laden', 'Load sample data')}
      </button>
    </div>
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
    <div className="mt-10 p-5 bg-white rounded-3xl border border-slate-200">
      <h3 className="font-bold text-slate-900 text-sm mb-1">{tx('Fristen im Kalender', 'Deadlines in your calendar')}</h3>
      <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
        {tx('Lizenzablauf, Garantie-Ende, Wartung und fällige Sicherung als Kalenderdatei (.ics) für Outlook, Google oder Apple. Erneut importieren aktualisiert die Termine.', 'Licence expiry, warranty end, maintenance and backup due as a calendar file (.ics) for Outlook, Google or Apple. Importing again updates the entries.')}
      </p>
      <button onClick={exportieren} disabled={laeuft}
        className="w-full py-3 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 disabled:opacity-50">
        {laeuft ? tx('Erstellt …', 'Creating …') : tx('Kalenderdatei herunterladen', 'Download calendar file')}
      </button>
    </div>
  );
}
