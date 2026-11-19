// Searchable CRM directory + detail drawer with full appointment history and private notes.
import { useEffect, useMemo, useState } from 'react';
import Drawer from './Drawer';
import { api, money } from './api';
import { dateKeyInTz, timeInTz } from '../../lib/time';
import type { Appointment, Client } from '../../lib/types';

interface Props { currency: string; timezone: string; }

export default function ClientsManager({ currency, timezone }: Props) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ clients: Client[] }>('/api/clients').then((d) => setClients(d.clients)).catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return clients ?? [];
    return (clients ?? []).filter((c) => [c.name, c.email, c.phone].some((v) => v.toLowerCase().includes(term)));
  }, [clients, q]);

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">Search clients</span>
        <input type="search" placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-brand-500/30" />
      </label>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {clients === null && <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16" />)}</div>}
      {clients && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          {clients.length === 0 ? 'No clients yet. They appear automatically after their first booking.' : 'No clients match your search.'}
        </div>
      )}

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {filtered.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => setOpenId(c.id)} className="flex w-full min-h-14 items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium truncate">
                  {c.name}
                  {c.noShowCount > 0 && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">{c.noShowCount} no-show{c.noShowCount > 1 ? 's' : ''}</span>}
                </p>
                <p className="text-sm text-slate-500 truncate">{c.phone || c.email}</p>
              </div>
              <div className="shrink-0 text-right text-sm">
                <p className="font-semibold">{money(c.totalSpentCents, currency)}</p>
                <p className="text-slate-500">{c.totalVisits} visit{c.totalVisits === 1 ? '' : 's'}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {openId && <ClientDrawer id={openId} currency={currency} timezone={timezone} onClose={() => setOpenId(null)}
        onSaved={(c) => setClients((list) => (list ?? []).map((x) => (x.id === c.id ? c : x)))} />}
    </div>
  );
}

function ClientDrawer({ id, currency, timezone, onClose, onSaved }: {
  id: string; currency: string; timezone: string; onClose: () => void; onSaved: (c: Client) => void;
}) {
  const [data, setData] = useState<{ client: Client; history: Appointment[] } | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ client: Client; history: Appointment[] }>(`/api/clients/${id}`).then((d) => { setData(d); setNotes(d.client.notes); }).catch((e) => setError(e.message));
  }, [id]);

  async function saveNotes() {
    setSaving(true);
    setSaved(false);
    try {
      const c = await api<Client>(`/api/clients/${id}`, { method: 'PATCH', body: { notes } });
      onSaved(c);
      setSaved(true);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  }

  const c = data?.client;
  return (
    <Drawer open onClose={onClose} title={c?.name ?? 'Client'}>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {!data && !error && <div className="skeleton h-40" aria-busy="true" />}
      {c && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Visits" value={String(c.totalVisits)} />
            <Stat label="Spent" value={money(c.totalSpentCents, currency)} />
            <Stat label="No-shows" value={String(c.noShowCount)} warn={c.noShowCount > 0} />
          </div>
          <div className="text-sm space-y-1">
            {c.phone && <p><a className="text-brand-700" href={`tel:${c.phone}`}>{c.phone}</a></p>}
            {c.email && <p className="truncate"><a className="text-brand-700" href={`mailto:${c.email}`}>{c.email}</a></p>}
            {c.lastVisitAt && <p className="text-slate-500">Last visit {dateKeyInTz(c.lastVisitAt, timezone)}</p>}
          </div>
          <div>
            <label htmlFor="client-notes" className="block text-sm font-semibold">Private staff notes</label>
            <p className="text-xs text-slate-500">Visible to your team only.</p>
            <textarea id="client-notes" rows={4} maxLength={2000} value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
              className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-base outline-none focus:ring-2 focus:ring-brand-500/30" />
            <div className="mt-2 flex items-center gap-3">
              <button type="button" disabled={saving || notes === c.notes} onClick={saveNotes} className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save notes'}</button>
              {saved && <span className="text-sm text-emerald-700" role="status">Saved</span>}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Appointment history</h3>
            {data.history.length === 0 && <p className="text-sm text-slate-500">No appointments yet.</p>}
            <ul className="space-y-2">
              {data.history.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{dateKeyInTz(a.startAt, timezone)} · {timeInTz(a.startAt, timezone)}</span>
                    <span className="capitalize text-xs rounded bg-slate-100 px-2 py-1">{a.status.replace('_', ' ')}</span>
                  </div>
                  <p className="text-slate-600">{a.title} · {money(a.priceCents, currency)}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className={`text-lg font-semibold ${warn ? 'text-rose-600' : ''}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
