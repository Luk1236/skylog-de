import React, { useState } from 'react';
import { X, Cloud, Download, Check, ShieldCheck, RefreshCw } from 'lucide-react';
import {
  getAutoBackupConfig,
  saveAutoBackupConfig,
  performCloudBackupExport,
  type AutoBackupConfig,
} from '../services/cloudBackup';

interface Props {
  onClose: () => void;
}

export function CloudBackupDialog({ onClose }: Props) {
  const [config, setConfig] = useState<AutoBackupConfig>(() => getAutoBackupConfig());
  const [isExporting, setIsExporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleToggleAuto = (enabled: boolean) => {
    saveAutoBackupConfig(enabled, config.intervalDays);
    setConfig(getAutoBackupConfig());
  };

  const handleIntervalChange = (days: number) => {
    saveAutoBackupConfig(config.enabled, days);
    setConfig(getAutoBackupConfig());
  };

  const handleManualBackup = async () => {
    setIsExporting(true);
    try {
      await performCloudBackupExport();
      setSuccessMsg('Sicherung erfolgreich generiert & heruntergeladen!');
      setConfig(getAutoBackupConfig());
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[150] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-white p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Cloud className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h2 className="font-bold text-base">Auto Cloud-Backup & Sync</h2>
              <p className="text-xs text-slate-400">Automatische Datensicherungen & Cloud-Export</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-300 text-xs font-medium">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auto Backup Controls */}
        <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-slate-100">Automatisches Backup</p>
              <p className="text-[11px] text-slate-400">Erstellt regelmäßig Sicherungs-Snapshots</p>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 rounded text-cyan-500 cursor-pointer"
              checked={config.enabled}
              onChange={e => handleToggleAuto(e.target.checked)}
            />
          </div>

          {config.enabled && (
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Sicherungs-Intervall</label>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white cursor-pointer focus:outline-none"
                value={config.intervalDays}
                onChange={e => handleIntervalChange(parseInt(e.target.value, 10))}
              >
                <option value={1}>Täglich (jeden Tag)</option>
                <option value={3}>Alle 3 Tage</option>
                <option value={7}>Wöchentlich (alle 7 Tage)</option>
                <option value={14}>Alle 2 Wochen</option>
              </select>
            </div>
          )}

          {config.lastBackupTime && (
            <p className="text-[10px] text-slate-400 border-t border-slate-700/60 pt-2">
              Letzte erfolgreiche Sicherung: {new Date(config.lastBackupTime).toLocaleString('de-DE')}
            </p>
          )}
        </div>

        {/* Cloud-Export Action */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleManualBackup}
            disabled={isExporting}
            className="w-full py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 font-bold text-sm text-white shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isExporting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Jetzt Sicherung Generieren & Herunterladen</span>
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Daten sind lokal verschlüsselt und cloud-kompatibel (JSON)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
