// Services list grouped by category (cards on mobile, table on desktop) + create/edit drawer.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Drawer from './Drawer';
import { api, money } from './api';
import type { Service } from '../../lib/types';

const blank = { name: '', category: 'General', durationMin: 45, bufferMin: 10, priceCents: 3500, depositType: 'none' as const, depositValue: 0, active: true };

export default function ServicesManager({ currency }: { currency: string }) {
  const [services, setServices] = useState<Service[] | null>(null);
  const [editing, setEditing] = useState<(Partial<Service> & typeof blank) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<{ services: Service[] }>('/api/services').then((d) => setServices(d.services)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const groups = useMemo(() => {
    const m = new Map<string, Service[]>();
    for (const s of services ?? []) m.set(s.category, [...(m.get(s.category) ?? []), s]);
    return [...m.entries()];
  }, [services]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const body = { ...editing, priceCents: Math.round(Number(editing.priceCents)), depositValue: Number(editing.depositValue) };
      if (editing.id) await api(`/api/services/${editing.id}`, { method: 'PATCH', body });
      else await api('/api/services', { body });
      setEditing(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Service) {
    if (!confirm(`Delete ${s.name}? Existing bookings keep their details.`)) return;
    await api(`/api/services/${s.id}`, { method: 'DELETE' }).catch((e) => setError(e.message));
    await load();
  }

  const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-brand-500/30';
  const depositLabel = (s: Service) => s.depositType === 'percent' ? `${s.depositValue}% deposit` : s.depositType === 'fixed' ? `${money(s.depositValue, currency)} deposit` : 'No deposit';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{services?.length ?? 0} services</p>
        <button type="button" onClick={() => setEditing({ ...blank, id: undefined } as any)} className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white">+ Add service</button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {services === null && <div className="space-y-3" aria-busy="true">{[0, 1].map((i) => <div key={i} className="skeleton h-20" />)}</div>}
      {services?.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="font-medium">No services yet</p><p className="mt-1 text-sm text-slate-500">Add what clients can book.</p></div>}

      {groups.map(([category, list]) => (
        <section key={category} aria-labelledby={`cat-${category}`}>
          <h2 id={`cat-${category}`} className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{category}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {list.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="min-w-0">
                  <p className="font-medium truncate">{s.name} {!s.active && <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-xs">Hidden</span>}</p>
                  <p className="text-sm text-slate-500">{s.durationMin} min{s.bufferMin ? ` + ${s.bufferMin} min buffer` : ''} · {depositLabel(s)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold">{money(s.priceCents, currency)}</span>
                  <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm" onClick={() => setEditing(s as any)}>Edit</button>
                  <button type="button" aria-label={`Delete ${s.name}`} className="min-h-11 rounded-lg px-2 text-sm text-rose-600" onClick={() => remove(s)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && (
        <Drawer open onClose={() => setEditing(null)} title={editing.id ? 'Edit service' : 'New service'}
          footer={<button form="svc-form" disabled={busy} className="w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save service'}</button>}>
          <form id="svc-form" onSubmit={save} className="space-y-4">
            <label className="block text-sm font-medium">Name<input required minLength={2} className={input} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
            <label className="block text-sm font-medium">Category<input className={input} value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></label>
            <div className="grid grid-cols-3 gap-3">
              <label className="block text-sm font-medium">Minutes<input type="number" min={5} max={480} className={input} value={editing.durationMin} onChange={(e) => setEditing({ ...editing, durationMin: Number(e.target.value) })} /></label>
              <label className="block text-sm font-medium">Buffer<input type="number" min={0} max={120} className={input} value={editing.bufferMin} onChange={(e) => setEditing({ ...editing, bufferMin: Number(e.target.value) })} /></label>
              <label className="block text-sm font-medium">Price<input type="number" min={0} step={0.01} className={input} value={(editing.priceCents ?? 0) / 100} onChange={(e) => setEditing({ ...editing, priceCents: Math.round(Number(e.target.value) * 100) })} /></label>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Deposit</legend>
              <select className={input} value={editing.depositType} onChange={(e) => setEditing({ ...editing, depositType: e.target.value as any, depositValue: 0 })}>
                <option value="none">No deposit</option>
                <option value="percent">Percentage of price</option>
                <option value="fixed">Fixed amount</option>
              </select>
              {editing.depositType !== 'none' && (
                <label className="block text-sm">{editing.depositType === 'percent' ? 'Percent (0–100)' : 'Amount'}
                  <input type="number" min={0} max={editing.depositType === 'percent' ? 100 : undefined} step={editing.depositType === 'percent' ? 1 : 0.01}
                    className={input} value={(editing.depositType as string) === 'percent' ? editing.depositValue : editing.depositValue / 100}
                    onChange={(e) => setEditing({ ...editing, depositValue: (editing.depositType as string) === 'percent' ? Number(e.target.value) : Math.round(Number(e.target.value) * 100) })} />
                </label>
              )}
            </fieldset>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />Visible for online booking</label>
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          </form>
        </Drawer>
      )}
    </div>
  );
}
