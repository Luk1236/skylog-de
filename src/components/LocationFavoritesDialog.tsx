import { useSprache } from '../lib/sprache';
import React, { useState, useMemo, FormEvent } from 'react';
import { MapPin, Plus, Search, Trash2, Check, AlertCircle } from 'lucide-react';
import type { LocationFavorite } from '../services/db';
import { createLocationFavorite, filterLocationFavorites, formatCoordinates } from '../services/locationFavorites';
import { Dialog, Knopf, Feld, eingabe } from './ui';
import { cn } from '../lib/utils';

interface Props {
  favorites: LocationFavorite[];
  onSaveFavorite: (fav: LocationFavorite) => Promise<void>;
  onDeleteFavorite: (id: string) => Promise<void>;
  onSelectFavorite?: (fav: LocationFavorite) => void;
  onClose: () => void;
}

// Eingabefelder im slate-50 hinterlegten Formular weiß absetzen.
const formFeld = cn(eingabe, 'bg-white');

export function LocationFavoritesDialog({
  favorites,
  onSaveFavorite,
  onDeleteFavorite,
  onSelectFavorite,
  onClose
}: Props) {
  const { tx } = useSprache();
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
    <Dialog
      titel={tx('Standort-Favoriten', 'Location favourites')}
      untertitel={tx('Gespeicherte Orte für Logbuch & Flugplaner', 'Saved places for logbook & flight planner')}
      icon={MapPin}
      ton="blau"
      breite="lg"
      onClose={onClose}
    >
      {/* Controls Bar */}
      {!isAdding && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tx('Standorte durchsuchen...', 'Search locations…')}
              className={cn(eingabe, 'pl-10')}
            />
          </div>
          <Knopf icon={Plus} className="shrink-0" onClick={() => setIsAdding(true)}>
            <span>{tx('Neuer Ort', 'New place')}</span>
          </Knopf>
        </div>
      )}

      {/* Form: Add New Favorite */}
      {isAdding && (
        <form onSubmit={handleAddSubmit} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-2xs font-bold uppercase tracking-wider text-brand-blue">{tx('Neuen Standort speichern', 'Save new location')}</h3>
            <Knopf variante="geist" groesse="sm" onClick={() => setIsAdding(false)}>
              {tx('Abbrechen', 'Cancel')}
            </Knopf>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-2 text-brand-red text-sm font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Feld label={tx('Name (z.B. Modellflugplatz)', 'Name (e.g. model airfield)')} htmlFor="favorit-name">
              <input
                id="favorit-name"
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={tx('Titel des Ortes', 'Place title')}
                className={formFeld}
              />
            </Feld>
            <Feld label={tx('Ort / Gemeinde', 'Town / municipality')} htmlFor="favorit-ort">
              <input
                id="favorit-ort"
                type="text"
                value={locationName}
                onChange={e => setLocationName(e.target.value)}
                placeholder={tx('z.B. Griesheim', 'e.g. Griesheim')}
                className={formFeld}
              />
            </Feld>
            <Feld label={tx('Breitengrad (Latitude)', 'Latitude')} htmlFor="favorit-lat">
              <input
                id="favorit-lat"
                type="number"
                step="any"
                required
                value={latStr}
                onChange={e => setLatStr(e.target.value)}
                placeholder="z.B. 49.8730"
                className={cn(formFeld, 'font-mono')}
              />
            </Feld>
            <Feld label={tx('Längengrad (Longitude)', 'Longitude')} htmlFor="favorit-lon">
              <input
                id="favorit-lon"
                type="number"
                step="any"
                required
                value={lonStr}
                onChange={e => setLonStr(e.target.value)}
                placeholder="z.B. 8.6520"
                className={cn(formFeld, 'font-mono')}
              />
            </Feld>
          </div>

          <Feld label={tx('Notizen / Hindernisse', 'Notes / obstacles')} htmlFor="favorit-notizen">
            <input
              id="favorit-notizen"
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={tx('z.B. Starker Seitenwind bei Nordost, Hochspannungsleitung in 400m', 'e.g. strong crosswind from the north-east, power line at 400 m')}
              className={formFeld}
            />
          </Feld>

          <div className="flex justify-end gap-2 pt-1">
            <Knopf variante="sekundaer" onClick={() => setIsAdding(false)}>
              {tx('Abbrechen', 'Cancel')}
            </Knopf>
            <Knopf type="submit" disabled={saving}>
              {saving ? 'Speichert...' : 'Favorit Hinzufügen'}
            </Knopf>
          </div>
        </form>
      )}

      {/* List of Favorites */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40 text-brand-blue" />
          <p>{tx('Keine Standort-Favoriten vorhanden.', 'No location favourites yet.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(fav => (
            <div
              key={fav.id}
              className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-start justify-between gap-4 transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">{fav.name}</span>
                  <span className="text-2xs px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-medium">
                    {fav.locationName}
                  </span>
                </div>
                <p className="text-xs font-mono text-brand-blue">{formatCoordinates(fav.coordinates)}</p>
                {fav.notes && <p className="text-xs text-slate-500 italic pt-0.5">{fav.notes}</p>}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onSelectFavorite && (
                  <Knopf
                    variante="sekundaer"
                    groesse="sm"
                    icon={Check}
                    onClick={() => {
                      onSelectFavorite(fav);
                      onClose();
                    }}
                  >
                    <span>{tx('Auswählen', 'Select')}</span>
                  </Knopf>
                )}
                <button
                  onClick={() => onDeleteFavorite(fav.id)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 text-brand-red transition-colors"
                  title={tx('Löschen', 'Delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
