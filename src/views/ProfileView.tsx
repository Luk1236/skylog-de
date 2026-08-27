import { useState, type ChangeEvent } from 'react';
import {
  AlertTriangle, DatabaseBackup, Download, ExternalLink, FileDigit, Lock,
  Plus, Settings, ShieldAlert, ShieldCheck, Trash2, Upload, User,
} from 'lucide-react';
import { dbService, type UserProfile, type AppDocument } from '../services/db';
import { melde, bestaetige } from '../services/dialog';
import { exportBackup, importBackup } from '../services/backup';
import { cn } from '../lib/utils';
import { useSprache } from '../lib/sprache';

export function ProfileView({ profile, documents, onUpdate, onOpenEid, onOpenPinSetup }: { profile: UserProfile | null, documents: AppDocument[], onUpdate: () => void, onOpenEid?: () => void, onOpenPinSetup?: () => void }) {
  const { t } = useSprache();
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

  const fuehreImportAus = async (modus: 'merge' | 'replace') => {
    const file = backupDatei;
    if (!file) return;
    const warnung = [
      'Alle aktuell gespeicherten Drohnen, Akkus, Flüge, Piloten, Wartungen',
      'und Dokumente werden gelöscht und durch den Inhalt der Datei ersetzt.',
      'Alles seit dieser Sicherung Erfasste geht verloren.',
    ].join(String.fromCharCode(10));
    if (modus === 'replace' && !await bestaetige(warnung, { titel: 'Wirklich ersetzen?', gefaehrlich: true })) return;
    setBackupDatei(null);
    try {
      const r = await importBackup(file, modus);
      melde(
        `${r.drones} Drohnen\n${r.batteries} Akkus\n${r.flights} Flüge\n` +
        `${r.pilots} Piloten\n${r.maintenance} Wartungen\n${r.documents} Dokumente\n` +
        `${r.profile ? 'Profil übernommen' : 'Kein Profil in der Datei'}`,
        'Sicherung geladen ✓'
      );
      onUpdate();
    } catch (err: any) {
      console.error(err);
      melde(err?.message || 'Import fehlgeschlagen.');
    }
  };

  return (
    <div className="max-w-md lg:max-w-3xl mx-auto pb-20">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand-blue">{t('view.profil')}</h2>
            <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">Stammdaten & Lizenzen</p>
          </div>
          <div className="flex items-center gap-2">
            {profile?.isBOS && (
              <div className="bg-brand-red text-white text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">BOS Pilot</div>
            )}
            {onOpenPinSetup && (
              <button
                onClick={onOpenPinSetup}
                className="p-2.5 text-slate-400 hover:text-sky-600 bg-white border border-slate-200 rounded-2xl shadow-sm transition-all"
                title="PIN-Sperre verwalten"
              >
                <Lock className="w-5 h-5" />
              </button>
            )}
            {profile && (
              <button
                onClick={exportPilotBadge}
                className="p-2.5 text-slate-400 hover:text-brand-blue bg-white border border-slate-200 rounded-2xl shadow-sm transition-all"
                title="Piloten-Ausweis als PDF"
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
                      <button onClick={onOpenEid} className="text-[10px] font-bold text-sky-600 hover:underline">Verwalten</button>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-800 font-mono">{profile?.eid || 'Nicht hinterlegt'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Versicherung</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{profile?.insuranceNumber || 'Nicht hinterlegt'}</p>
                </div>
              </div>
              {profile?.eid && (
                <div className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">LBA e-ID QR-Code</p>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(profile.eid)}&bgcolor=ffffff&color=0a0a0a&margin=8`}
                    alt="LBA e-ID QR Code"
                    className="w-32 h-32 rounded-xl"
                  />
                  <p className="text-[10px] text-slate-500 text-center">Für Bodeninspektion scannen</p>
                </div>
              )}
              {profile && (
                <div className="p-4 bg-brand-green/5 border border-brand-green/10 rounded-2xl flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-brand-green" />
                  <div>
                    <p className="text-xs font-bold text-brand-green">Status: Aktiv & Bereit</p>
                    <p className="text-[10px] text-slate-500">Ihre Daten sind für das Logbuch bereit.</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm mb-2">Profil Bearbeiten</h3>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Vollständiger Name</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={editedProfile.name || ''} onChange={e => setEditedProfile({...editedProfile, name: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">LBA e-ID (Registrierungsnummer)</label>
              <input type="text" placeholder="DEU..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={editedProfile.eid || ''} onChange={e => setEditedProfile({...editedProfile, eid: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Lizenz Typ</label>
                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={editedProfile.licenseType || ''} onChange={e => setEditedProfile({...editedProfile, licenseType: e.target.value as any})}>
                  <option value="None">Keine</option>
                  <option value="A1/A3">A1/A3</option>
                  <option value="A2">A2 (Fernpiloten-Zeugnis)</option>
                  <option value="STS">STS (Spezielle Kat.)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Gültig bis</label>
                <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" value={editedProfile.licenseExpiry || ''} onChange={e => setEditedProfile({...editedProfile, licenseExpiry: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Versicherungs-Nr.</label>
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
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">NOTAM API (Optional)</p>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Kostenloser API-Key von <span className="font-bold text-brand-blue">developer.faa.gov</span> · Zeigt aktuelle Luftraumsperrungen (NOTAMs) vor dem Flug an.
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
                Profil Speichern
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
          <h3 className="font-bold text-slate-900 text-sm">PDF Dokumente</h3>
          <label className="bg-brand-blue text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-brand-blue/20">
            <Plus className="w-4 h-4 inline-block mr-1" /> Neu
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
                <p className="text-[10px] text-slate-400 font-medium">Hochgeladen am {new Date(doc.createdAt).toLocaleDateString()}</p>
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
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Keine PDF-Dokumente</p>
          </div>
        )}
      </div>

      {/* Datensicherung */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-3">
          <DatabaseBackup className="w-4 h-4 text-brand-blue" />
          <h3 className="font-bold text-slate-900 text-sm">Datensicherung</h3>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed mb-3">
          Sichere alle deine Drohnen, Akkus, Flüge, Piloten und Dokumente in eine Datei — und lade sie bei Handywechsel oder Datenverlust wieder ein.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleExportBackup}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-blue text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-blue/20 text-xs active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" /> Sicherung exportieren
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-xs cursor-pointer active:scale-95 transition-all">
            <Upload className="w-4 h-4" /> Laden
            <input type="file" className="hidden" accept="application/json,.json" onChange={handleImportBackup} />
          </label>
        </div>
        <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
          Aus Sicherheitsgruenden enthaelt die Datei keine NOTAM-Zugangsdaten.
          Die musst du nach einer Wiederherstellung einmal neu eintragen.
        </p>
      </div>

      {/* Auswahl: Zusammenfuehren oder Ersetzen */}
      {backupDatei && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6">
            <h3 className="font-black text-slate-900 mb-1">Sicherung laden</h3>
            <p className="text-[10px] text-slate-400 mb-5 truncate">{backupDatei.name}</p>

            <button
              onClick={() => fuehreImportAus('merge')}
              className="w-full text-left p-4 mb-3 bg-slate-50 border border-slate-200 rounded-2xl active:scale-[0.98] transition-transform"
            >
              <p className="text-xs font-black text-slate-900">Zusammenfuehren</p>
              <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                Eintraege aus der Datei kommen hinzu. Gleiche IDs werden ueberschrieben,
                alles andere bleibt erhalten. Nichts wird geloescht.
              </p>
            </button>

            <button
              onClick={() => fuehreImportAus('replace')}
              className="w-full text-left p-4 mb-4 bg-brand-red/5 border border-brand-red/20 rounded-2xl active:scale-[0.98] transition-transform"
            >
              <p className="text-xs font-black text-brand-red">Ersetzen</p>
              <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                Der Datenbestand entspricht danach exakt der Datei. Alles seit dieser
                Sicherung Erfasste geht verloren.
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
          Ihre Daten werden sicher und lokal in Ihrem Browser gespeichert. SkyLog DE sendet keine Informationen an Cloud-Server.
        </p>
      </div>

      {/* Version & Impressum */}
      <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">App-Info</p>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-500">Version</span>
          <span className="text-[10px] font-bold text-slate-900">1.0.0</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-500">Plattform</span>
          <span className="text-[10px] font-bold text-slate-900">PWA · IndexedDB</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-500">Lizenz</span>
          <span className="text-[10px] font-bold text-slate-900">Privat / Nicht-kommerziell</span>
        </div>
        <div className="pt-2 flex gap-3">
          <a
            href="/datenschutz.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-bold text-brand-blue"
          >
            <ExternalLink className="w-3 h-3" /> Datenschutzerklärung
          </a>
        </div>
      </div>
    </div>
  );
}
