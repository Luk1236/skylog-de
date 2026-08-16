import React, { useState } from 'react';
import { X, Building2, UserPlus, FileText, Trash2, Phone, Mail, MapPin, Briefcase } from 'lucide-react';
import type { Customer, Flight, Drone, UserProfile } from '../services/db';
import { generateCustomerReportPdf, calculateCustomerStats } from '../services/crm';

interface Props {
  customers: Customer[];
  flights: Flight[];
  drones: Drone[];
  profile: UserProfile | null;
  onSaveCustomer: (cust: Customer) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onClose: () => void;
}

export function CustomerManagerDialog({
  customers,
  flights,
  drones,
  profile,
  onSaveCustomer,
  onDeleteCustomer,
  onClose,
}: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCust, setNewCust] = useState<Partial<Customer>>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCust.name) return;

    const customer: Customer = {
      id: crypto.randomUUID(),
      name: newCust.name.trim(),
      company: newCust.company?.trim(),
      email: newCust.email?.trim(),
      phone: newCust.phone?.trim(),
      address: newCust.address?.trim(),
      notes: newCust.notes?.trim(),
      createdAt: Date.now(),
    };

    await onSaveCustomer(customer);
    setNewCust({});
    setShowAddForm(false);
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-brand-blue/20 text-sky-400 border border-sky-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">CRM & Kundenverwaltung</h2>
              <p className="text-xs text-slate-400">Kundenstamm, Projektzuordnung & Kunden-PDF-Einsatzberichte</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Kundenverzeichnis ({customers.length})
            </h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg shadow-sky-600/20 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Neuen Kunden anlegen</span>
            </button>
          </div>

          {/* Add Customer Form */}
          {showAddForm && (
            <form onSubmit={handleCreate} className="p-5 bg-slate-800/80 border border-slate-700 rounded-2xl space-y-4">
              <h4 className="font-bold text-sm text-sky-400">Neuer Kunde / Auftraggeber</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Kundenname / Ansprechpartner *"
                  required
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
                  value={newCust.name || ''}
                  onChange={e => setNewCust({ ...newCust, name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Firmenname (optional)"
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
                  value={newCust.company || ''}
                  onChange={e => setNewCust({ ...newCust, company: e.target.value })}
                />
                <input
                  type="email"
                  placeholder="E-Mail-Adresse"
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
                  value={newCust.email || ''}
                  onChange={e => setNewCust({ ...newCust, email: e.target.value })}
                />
                <input
                  type="tel"
                  placeholder="Telefonnummer"
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
                  value={newCust.phone || ''}
                  onChange={e => setNewCust({ ...newCust, phone: e.target.value })}
                />
              </div>
              <input
                type="text"
                placeholder="Anschrift / Adresse"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
                value={newCust.address || ''}
                onChange={e => setNewCust({ ...newCust, address: e.target.value })}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold shadow-lg shadow-sky-600/20"
                >
                  Kunde Speichern
                </button>
              </div>
            </form>
          )}

          {/* Customer List */}
          {customers.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl text-slate-500">
              <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-bold">Noch keine Kunden erfasst</p>
              <p className="text-[10px] text-slate-600 mt-1">Lege oben deinen ersten Kunden an, um Flüge zuzuordnen.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {customers.map(c => {
                const stats = calculateCustomerStats(c.id, flights);
                const isSelected = selectedCustomerId === c.id;

                return (
                  <div
                    key={c.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-slate-800/90 border-sky-500/50 shadow-lg shadow-sky-500/10'
                        : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-100">{c.name}</h4>
                          {c.company && (
                            <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 text-[10px] font-bold">
                              {c.company}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                          {c.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5 text-slate-500" /> {c.email}
                            </span>
                          )}
                          {c.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-slate-500" /> {c.phone}
                            </span>
                          )}
                          {c.address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-500" /> {c.address}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => generateCustomerReportPdf(c, flights, drones, profile)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-bold text-xs border border-sky-500/20 transition-all"
                          title="PDF-Einsatzbericht herunterladen"
                        >
                          <FileText className="w-4 h-4" />
                          <span>PDF Report</span>
                        </button>

                        <button
                          onClick={() => onDeleteCustomer(c.id)}
                          className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Kunde löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Stats footer */}
                    <div className="mt-3 pt-3 border-t border-slate-700/40 flex items-center gap-4 text-[11px] text-slate-400">
                      <span>Zugeordnete Flüge: <strong className="text-sky-400">{stats.totalFlights}</strong></span>
                      <span>Flugstunden: <strong className="text-sky-400">{(stats.totalDurationMinutes / 60).toFixed(1)} h</strong></span>
                      <span>Gesamtdistanz: <strong className="text-sky-400">{stats.totalDistanceKm.toFixed(1)} km</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
