// Datei an den Nutzer übergeben - im Browser und in der Android-App.
//
// Im Browser genügt ein Download-Link. Im Android-WebView (Capacitor) tut ein
// <a download> nichts. Dort wird die Datei in den App-Cache geschrieben und
// über das Teilen-Menü angeboten: so landet sie direkt in Google Drive,
// Nextcloud, „Dateien" oder einer Mail - ganz ohne eigenen Server.
import { Capacitor } from '@capacitor/core';

export async function speichereDatei(dateiname: string, inhalt: string, mime = 'application/json'): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const { uri } = await Filesystem.writeFile({
      path: dateiname,
      data: inhalt,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: dateiname, files: [uri], dialogTitle: 'Sicherung speichern oder teilen' });
    return;
  }

  const blob = new Blob([inhalt], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
