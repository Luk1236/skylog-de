import { useEffect, useState, type ChangeEvent } from 'react';
import { ExternalLink, FileDigit, Pencil, Plus, ShieldCheck, Trash2, User } from 'lucide-react';
import { dbService, type UserProfile, type AppDocument } from '../services/db';
import { melde } from '../services/dialog';
import { zeigeRueckgaengig } from '../services/rueckgaengig';
import { cn } from '../lib/utils';
import { useSprache } from '../lib/sprache';
import { Abschnitt, Feld, IconKnopf, Knopf, SeitenKopf, eingabe, knopfKlassen } from '../components/ui';

export function ProfileView({ profile, documents, onUpdate, onOpenEid }: { profile: UserProfile | null, documents: AppDocument[], onUpdate: () => void, onOpenEid?: () => void }) {
  const { t, tx } = useSprache();
  const [isEditing, setIsEditing] = useState(!profile);
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>(profile || { id: 'main_profile' });

  const handleSaveProfile = async () => {
    if (!editedProfile.name || !editedProfile.eid) return;
    await dbService.saveProfile({
      // NOTAM-Zugang (unter Einstellungen gepflegt) nicht verlieren
      ...(profile ?? {}),
      id: 'main_profile',
      name: editedProfile.name,
      eid: editedProfile.eid,
      licenseType: editedProfile.licenseType || 'None',
      licenseExpiry: editedProfile.licenseExpiry || '',
      insuranceNumber: editedProfile.insuranceNumber || '',
      isBOS: !!editedProfile.isBOS,
    } as UserProfile);
    setIsEditing(false);
    onUpdate();
  };

  const getExpiryStatus = (date?: string) => {
    if (!date) return { color: 'text-slate-500', label: tx('kein Ablaufdatum', 'no expiry date') };
    const expiry = new Date(date);
    const left = expiry.getTime() - Date.now();
    const days = Math.ceil(left / (1000 * 60 * 60 * 24));
    
    if (days < 0) return { color: 'text-brand-red', label: tx('abgelaufen', 'expired') };
    if (days < 30) return { color: 'text-amber-800', label: tx(`läuft in ${days} Tagen ab`, `expires in ${days} days`) };
    return { color: 'text-brand-green', label: tx(`gültig, noch ${days} Tage`, `valid, ${days} days left`) };
  };

  const expiry = getExpiryStatus(profile?.licenseExpiry);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      melde(tx('Bitte nur PDF-Dateien hinzufügen (z. B. den Kompetenznachweis).', 'Please add PDF files only (e.g. your certificate).'));
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
      melde(tx('Das Dokument konnte nicht gespeichert werden.', 'The document could not be saved.'));
    }
  };

  const exportPilotBadge = async () => {
    if (!profile) return;
    // jsPDF wiegt zusammen mit html2canvas rund 400 kB und wird nur hier
    // gebraucht — deshalb erst beim Klick laden, nicht beim App-Start.
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [148, 105] });
    doc.setFillColor(30, 58, 138);
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
    doc.setTextColor(30, 58, 138);
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

  const handleDelete = async (doc: AppDocument) => {
    await dbService.deleteDocument(doc.id);
    onUpdate();
    zeigeRueckgaengig(tx('Dokument gelöscht', 'Document deleted'), async () => {
      await dbService.saveDocument(doc);
      onUpdate();
    });
  };

  return (
    <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto pb-20">
      <SeitenKopf
        titel={t('view.profil')}
        untertitel={tx('Stammdaten, Nachweise & Dokumente', 'Personal data, certificates & documents')}
        aktionen={
          <>
            {profile?.isBOS && (
              <span className="bg-red-50 text-brand-red text-xs font-bold px-2.5 py-1 rounded-full">BOS</span>
            )}
            {profile && (
              <Knopf variante="sekundaer" groesse="sm" icon={FileDigit} onClick={() => void exportPilotBadge()}>{tx('Ausweis-PDF', 'ID card PDF')}</Knopf>
            )}
          </>
        }
      />

      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-8">
        {!isEditing ? (
          <>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 shrink-0">
                <User className="w-7 h-7 text-brand-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 text-lg leading-tight truncate">{profile?.name || tx('Noch kein Name', 'No name yet')}</h3>
                <p className="text-sm text-slate-600">
                  {profile?.licenseType && profile.licenseType !== 'None' ? profile.licenseType : tx('Kein Kompetenznachweis', 'No certificate')}
                  {' · '}<span className={cn('font-bold', expiry.color)}>{expiry.label}</span>
                </p>
              </div>
              <IconKnopf icon={Pencil} aria-label={tx('Profil bearbeiten', 'Edit profile')} onClick={() => setIsEditing(true)} className="-mr-2 -mt-1" />
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-500 mb-0.5">LBA e-ID</p>
                    {onOpenEid && (
                      <button onClick={onOpenEid} className="text-xs font-bold text-brand-blue hover:underline">{tx('Verwalten', 'Manage')}</button>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-800 font-mono truncate">{profile?.eid || tx('Nicht hinterlegt', 'Not set')}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <p className="text-xs font-bold text-slate-500 mb-0.5">{tx('Versicherung', 'Insurance')}</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{profile?.insuranceNumber || tx('Nicht hinterlegt', 'Not set')}</p>
                </div>
              </div>
              {profile?.eid && (
                <div className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-500">{tx('LBA e-ID als QR-Code', 'LBA e-ID QR code')}</p>
                  <EidQrCode eid={profile.eid} />
                  <p className="text-xs text-slate-500 text-center">{tx('Zum Scannen bei einer Kontrolle', 'For scanning during an inspection')}</p>
                </div>
              )}
              {profile && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-brand-green shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-brand-green">{tx('Profil vollständig', 'Profile complete')}</p>
                    <p className="text-xs text-slate-600">{tx('Deine Daten stehen im Logbuch und im Behörden-Check bereit.', 'Your data is ready for the logbook and the authority check.')}</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <h3 className="text-base font-black text-slate-900">{tx('Profil bearbeiten', 'Edit profile')}</h3>
            <Feld label={tx('Vollständiger Name', 'Full name')} htmlFor="pr-name">
              <input id="pr-name" type="text" className={eingabe} value={editedProfile.name || ''} onChange={e => setEditedProfile({ ...editedProfile, name: e.target.value })} />
            </Feld>
            <Feld label={tx('LBA e-ID (Registrierungsnummer)', 'LBA e-ID (registration number)')} htmlFor="pr-eid">
              <input id="pr-eid" type="text" placeholder="DEU…" className={eingabe} value={editedProfile.eid || ''} onChange={e => setEditedProfile({ ...editedProfile, eid: e.target.value })} />
            </Feld>
            <div className="grid grid-cols-2 gap-3">
              <Feld label={tx('Kompetenznachweis', 'Certificate')} htmlFor="pr-lizenz">
                <select id="pr-lizenz" className={eingabe} value={editedProfile.licenseType || 'None'} onChange={e => setEditedProfile({ ...editedProfile, licenseType: e.target.value as UserProfile['licenseType'] })}>
                  <option value="None">{tx('Keiner', 'None')}</option>
                  <option value="A1/A3">A1/A3</option>
                  <option value="A2">{tx('A2 (Fernpiloten-Zeugnis)', 'A2 (remote pilot certificate)')}</option>
                  <option value="STS">{tx('STS (Standardszenario)', 'STS (standard scenario)')}</option>
                </select>
              </Feld>
              <Feld label={tx('Gültig bis', 'Valid until')} htmlFor="pr-bis">
                <input id="pr-bis" type="date" className={eingabe} value={editedProfile.licenseExpiry || ''} onChange={e => setEditedProfile({ ...editedProfile, licenseExpiry: e.target.value })} />
              </Feld>
            </div>
            <Feld label={tx('Versicherungsnummer', 'Insurance number')} htmlFor="pr-vers">
              <input id="pr-vers" type="text" className={eingabe} value={editedProfile.insuranceNumber || ''} onChange={e => setEditedProfile({ ...editedProfile, insuranceNumber: e.target.value })} />
            </Feld>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={!!editedProfile.isBOS} onChange={e => setEditedProfile({ ...editedProfile, isBOS: e.target.checked })} className="rounded text-brand-blue" />
              <span className="text-sm font-medium text-slate-700">{tx('Ich fliege für eine BOS (Feuerwehr, Polizei, THW …)', 'I fly for an emergency service (fire, police …)')}</span>
            </label>
            <div className="flex gap-2 pt-1">
              {profile && (
                <Knopf variante="sekundaer" onClick={() => setIsEditing(false)}>{t('aktion.abbrechen')}</Knopf>
              )}
              <Knopf className="flex-1" onClick={handleSaveProfile} disabled={!editedProfile.name || !editedProfile.eid}>{tx('Profil speichern', 'Save profile')}</Knopf>
            </div>
            <p className="text-xs text-slate-500">{tx('NOTAM-Zugang, PIN und Datensicherung findest du unter „Einstellungen“.', 'NOTAM access, PIN and backup are under “Settings”.')}</p>
          </div>
        )}
      </div>

      <Abschnitt
        titel={tx('PDF-Dokumente', 'PDF documents')}
        aktion={
          <label className={cn(knopfKlassen('primaer', 'sm'), 'cursor-pointer')}>
            <Plus className="w-4 h-4" /> {tx('Hinzufügen', 'Add')}
            <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
          </label>
        }
      />
      <p className="text-xs text-slate-500 mb-3">{tx('Z. B. Versicherungsschein oder Kompetenznachweis – liegen offline auf dem Gerät und lassen sich im Behörden-Check öffnen.', 'E.g. insurance certificate or proof of competency – stored offline and available in the authority check.')}</p>

      <div className="space-y-3">
        {documents.map(doc => (
          <div key={doc.id} className="bg-white p-3 pl-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-2 bg-brand-blue/5 rounded-xl shrink-0">
              <FileDigit className="w-5 h-5 text-brand-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{doc.name}</p>
              <p className="text-xs text-slate-500">{tx('Hinzugefügt am', 'Added on')} {new Date(doc.createdAt).toLocaleDateString()}</p>
            </div>
            <IconKnopf icon={ExternalLink} aria-label={tx('Dokument öffnen', 'Open document')} onClick={() => handlePreview(doc)} />
            <IconKnopf icon={Trash2} variante="gefahr" aria-label={tx('Dokument löschen', 'Delete document')} onClick={() => void handleDelete(doc)} />
          </div>
        ))}

        {documents.length === 0 && (
          <div className="text-center py-8 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <FileDigit className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-500">{tx('Noch keine Dokumente', 'No documents yet')}</p>
          </div>
        )}
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

