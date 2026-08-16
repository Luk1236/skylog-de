import React, { useState, useMemo, FormEvent } from 'react';
import { X, MapPin, Plus, Search, Trash2, Check, AlertCircle } from 'lucide-react';
import type { LocationFavorite } from '../services/db';
import { createLocationFavorite, filterLocationFavorites, formatCoordinates } from '../services/locationFavorites';

interface Props {
  favorites: LocationFavorite[];
  onSaveFavorite: (fav: LocationFavorite) => Promise<void>;
  onDeleteFavorite: (id: string) => Promise<void>;
  onSelectFavorite?: (fav: LocationFavorite) => void;
  onClose: () => void;
}

export function LocationFavoritesDialog({
  favorites,
  onSaveFavorite,
  onDeleteFavorite,
  onSelectFavorite,
  onClose
}: Props) {
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latStr, setLatStr] = useState('');
  const [lonStr, setLonStr] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => filterLocationFavorites(favorites, search), [favorites, search]);

  const handleAddSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    try {
      const fav = createLocationFavorite({
        name,
        locationName: locationName || name,
        lat,
        lon,
        notes
      });

      setSaving(true);
      await onSaveFavorite(fav);
      setIsAdding(false);
      setName('');
      setLocationName('');
      setLatStr('');
      setLonStr('');
      setNotes('');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">Standort-Favoriten</h2>
              <p className="text-xs text-slate-400">Gespeicherte Orte für Logbuch & Flugplaner</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Controls Bar */}
          {!isAdding && (
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Standorte durchsuchen..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Neuer Ort</span>
              </button>
            </div>
          )}

          {/* Form: Add New Favorite */}
          {isAdding && (
            <form onSubmit={handleAddSubmit} className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Neuen Standort speichern</h3>
                <button type="button" onClick={() => setIsAdding(false)} className="text-xs text-slate-400 hover:text-white">
                  Abbrechen
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block mb-1 font-medium text-slate-300">Name (z.B. Modellflugplatz)</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Titel des Ortes"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium text-slate-300">Ort / Gemeinde</label>
                  <input
                    type="text"
                    value={locationName}
                    onChange={e => setLocationName(e.target.value)}
                    placeholder="z.B. Griesheim"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium text-slate-300">Breitengrad (Latitude)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={latStr}
                    onChange={e => setLatStr(e.target.value)}
                    placeholder="z.B. 49.8730"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium text-slate-300">Längengrad (Longitude)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={lonStr}
                    onChange={e => setLonStr(e.target.value)}
                    placeholder="z.B. 8.6520"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-xs font-medium text-slate-300">Notizen / Hindernisse</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="z.B. Starker Seitenwind bei Nordost, Hochspannungsleitung in 400m"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md"
                >
                  {saving ? 'Speichert...' : 'Favorit Hinzufügen'}
                </button>
              </div>
            </form>
          )}

          {/* List of Favorites */}
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
              <p>Keine Standort-Favoriten vorhanden.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(fav => (
                <div
                  key={fav.id}
                  className="p-4 rounded-2xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800 flex items-start justify-between gap-4 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">{fav.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 font-medium">
                        {fav.locationName}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-amber-400/90">{formatCoordinates(fav.coordinates)}</p>
                    {fav.notes && <p className="text-xs text-slate-400 italic pt-0.5">{fav.notes}</p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {onSelectFavorite && (
                      <button
                        onClick={() => {
                          onSelectFavorite(fav);
                          onClose();
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Auswählen</span>
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteFavorite(fav.id)}
                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
