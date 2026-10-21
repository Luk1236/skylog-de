import { useSprache } from '../lib/sprache';
import React, { useState } from 'react';
import { Building2, UserPlus, FileText, Trash2, Phone, Mail, MapPin, Briefcase } from 'lucide-react';
import type { Customer, Flight, Drone, UserProfile } from '../services/db';
import { generateCustomerReportPdf, calculateCustomerStats } from '../services/crm';
import { Dialog, Knopf, Abschnitt, eingabe } from './ui';
import { cn } from '../lib/utils';

interface Props {
  customers: Customer[];
  flights: Flight[];
  drones: Drone[];
  profile: UserProfile | null;
  onSaveCustomer: (cust: Customer) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onClose: () => void;
}

// Eingabefelder im slate-50 hinterlegten Formular weiß absetzen.
const formFeld = cn(eingabe, 'bg-white');

export function CustomerManagerDialog({
  customers,
  flights,
  drones,
  profile,
  onSaveCustomer,
  onDeleteCustomer,
  onClose,
}: Props) {
  const { tx } = useSprache();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCust, setNewCust] = useState<Partial<Customer>>({});

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

  return (
    <Dialog
      titel={tx('CRM & Kundenverwaltung', 'Customers (CRM)')}
      untertitel={tx('Kundenstamm, Projektzuordnung & Kunden-PDF-Einsatzberichte', 'Customer base, project assignment & customer PDF reports')}
      icon={Building2}
      ton="blau"
      breite="xl"
      onClose={onClose}
    >
      {/* Action Bar */}
      <Abschnitt
        className="mb-0"
        titel={<>{tx('Kundenverzeichnis (', 'Customer list (')}{customers.length})</>}
        aktion={
          <Knopf groesse="sm" icon={UserPlus} onClick={() => setShowAddForm(!showAddForm)}>
            <span>{tx('Neuen Kunden anlegen', 'Add new customer')}</span>
          </Knopf>
        }
      />

      {/* Add Customer Form */}
      {showAddForm && (
        <form onSubmit={handleCreate} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <h4 className="font-bold text-sm text-slate-900">{tx('Neuer Kunde / Auftraggeber', 'New customer / client')}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder={tx('Kundenname / Ansprechpartner *', 'Customer name / contact *')}
              required
              className={formFeld}
              value={newCust.name || ''}
              onChange={e => setNewCust({ ...newCust, name: e.target.value })}
            />
            <input
              type="text"
              placeholder={tx('Firmenname (optional)', 'Company name (optional)')}
              className={formFeld}
              value={newCust.company || ''}
              onChange={e => setNewCust({ ...newCust, company: e.target.value })}
            />
            <input
              type="email"
              placeholder={tx('E-Mail-Adresse', 'Email address')}
              className={formFeld}
              value={newCust.email || ''}
              onChange={e => setNewCust({ ...newCust, email: e.target.value })}
            />
            <input
              type="tel"
              placeholder={tx('Telefonnummer', 'Phone number')}
              className={formFeld}
              value={newCust.phone || ''}
              onChange={e => setNewCust({ ...newCust, phone: e.target.value })}
            />
          </div>
          <input
            type="text"
            placeholder={tx('Anschrift / Adresse', 'Address')}
            className={formFeld}
            value={newCust.address || ''}
            onChange={e => setNewCust({ ...newCust, address: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Knopf variante="sekundaer" onClick={() => setShowAddForm(false)}>
              {tx('Abbrechen', 'Cancel')}
            </Knopf>
            <Knopf type="submit">
              {tx('Kunde speichern', 'Save customer')}
            </Knopf>
          </div>
        </form>
      )}

      {/* Customer List */}
      {customers.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl text-slate-500">
          <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-bold text-slate-700">{tx('Noch keine Kunden erfasst', 'No customers yet')}</p>
          <p className="text-xs text-slate-500 mt-1">{tx('Lege oben deinen ersten Kunden an, um Flüge zuzuordnen.', 'Add your first customer above to assign flights.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {customers.map(c => {
            const stats = calculateCustomerStats(c.id, flights);

            return (
              <div
                key={c.id}
                className="p-4 rounded-2xl border transition-colors bg-slate-50 border-slate-200 hover:bg-slate-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">{c.name}</h4>
                      {c.company && (
                        <span className="px-2 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue text-2xs font-bold">
                          {c.company}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-2">
                      {c.email && (
                        <span className="flex items-center gap-1 break-all">
                          <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" /> {c.email}
                        </span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" /> {c.phone}
                        </span>
                      )}
                      {c.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" /> {c.address}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Knopf
                      variante="sekundaer"
                      groesse="sm"
                      icon={FileText}
                      onClick={() => generateCustomerReportPdf(c, flights, drones, profile)}
                      title={tx('PDF-Einsatzbericht herunterladen', 'Download PDF mission report')}
                    >
                      <span>{tx('PDF Report', 'PDF report')}</span>
                    </Knopf>

                    <button
                      onClick={() => onDeleteCustomer(c.id)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:text-brand-red hover:bg-red-50 transition-colors"
                      title={tx('Kunde löschen', 'Delete customer')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stats footer */}
                <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-slate-500">
                  <span>{tx('Zugeordnete Flüge:', 'Assigned flights:')} <strong className="text-brand-blue">{stats.totalFlights}</strong></span>
                  <span>{tx('Flugstunden:', 'Flight hours:')} <strong className="text-brand-blue">{(stats.totalDurationMinutes / 60).toFixed(1)} h</strong></span>
                  <span>{tx('Gesamtdistanz:', 'Total distance:')} <strong className="text-brand-blue">{stats.totalDistanceKm.toFixed(1)} km</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}
