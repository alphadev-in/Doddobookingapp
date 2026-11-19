// Team members: name, role, accent colour, active toggle, assigned services, per-day hours.
import { useEffect, useState, type FormEvent } from 'react';
import Drawer from './Drawer';
import { api } from './api';
import type { Service, Staff, WeekHours } from '../../lib/types';
import { defaultHours } from '../../lib/defaults';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#ec4899'];

export default function TeamManager() {
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [editing, setEditing] = useState<Partial<Staff> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [s, v] = await Promise.all([api<{ staff: Staff[] }>('/api/staff'), api<{ services: Service[] }>('/api/services')]);
      setStaff(s.staff);
      setServices(v.services);
    } catch (e: any) { setError(e.message); }
  };
  useEffect(() => { load(); }, []);

  async function toggleActive(m: Staff) {
    await api(`/api/staff/${m.id}`, { method: 'PATCH', body: { active: !m.active } }).catch((e) => setError(e.message));
    await load();
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const body = { name: editing.name, role: editing.role, color: editing.color, active: editing.active ?? true, serviceIds: editing.serviceIds ?? [], hours: editing.hours ?? defaultHours() };
      if (editing.id) await api(`/api/staff/${editing.id}`, { method: 'PATCH', body });
      else await api('/api/staff', { body });
      setEditing(null);
      await load();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-brand-500/30';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{staff?.filter((s) => s.active).length ?? 0} active</p>
        <button type="button" className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white"
          onClick={() => setEditing({ name: '', role: 'Stylist', color: COLORS[(staff?.length ?? 0) % COLORS.length], active: true, serviceIds: services.map((s) => s.id), hours: defaultHours() })}>+ Add team member</button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {staff === null && <div className="skeleton h-24" aria-busy="true" />}
      <ul className="grid gap-3 md:grid-cols-2">
        {staff?.map((m) => (
          <li key={m.id} className={`rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${m.active ? '' : 'opacity-60'}`} style={{ borderLeft: `6px solid ${m.color}` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{m.name}</p>
                <p className="text-sm text-slate-500">{m.role} · {m.serviceIds.length} services</p>
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <span className="text-slate-600">{m.active ? 'Active' : 'Inactive'}</span>
                <input type="checkbox" role="switch" className="h-6 w-11" checked={m.active} aria-label={`${m.name} active`} onChange={() => toggleActive(m)} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-1 text-xs">
              {DAYS.map((d, i) => m.hours[String(i)]?.open && <span key={d} className="rounded bg-slate-100 px-1.5 py-1">{d} {m.hours[String(i)].start}–{m.hours[String(i)].end}</span>)}
            </div>
            <button type="button" className="mt-3 min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium" onClick={() => setEditing(m)}>Edit</button>
          </li>
        ))}
      </ul>

      {editing && (
        <Drawer open onClose={() => setEditing(null)} title={editing.id ? 'Edit team member' : 'New team member'}
          footer={<button form="team-form" disabled={busy} className="w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>}>
          <form id="team-form" onSubmit={save} className="space-y-5">
            <label className="block text-sm font-medium">Name<input required minLength={2} className={input} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
            <label className="block text-sm font-medium">Role<input className={input} value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} /></label>
            <fieldset>
              <legend className="text-sm font-medium">Calendar colour</legend>
              <div className="mt-2 flex gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={editing.color === c} onClick={() => setEditing({ ...editing, color: c })}
                    className={`h-11 w-11 rounded-full ${editing.color === c ? 'ring-2 ring-offset-2 ring-slate-800' : ''}`} style={{ background: c }} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-medium">Services offered</legend>
              <div className="mt-2 grid gap-2">
                {services.map((s) => (
                  <label key={s.id} className="flex min-h-11 items-center gap-3 text-sm">
                    <input type="checkbox" className="h-5 w-5" checked={!!editing.serviceIds?.includes(s.id)}
                      onChange={(e) => setEditing({ ...editing, serviceIds: e.target.checked ? [...(editing.serviceIds ?? []), s.id] : (editing.serviceIds ?? []).filter((x) => x !== s.id) })} />
                    {s.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-medium">Working hours</legend>
              <div className="mt-2 space-y-2">
                {DAYS.map((d, i) => {
                  const hours = (editing.hours ?? defaultHours()) as WeekHours;
                  const h = hours[String(i)];
                  const set = (patch: Partial<typeof h>) => setEditing({ ...editing, hours: { ...hours, [String(i)]: { ...h, ...patch } } });
                  return (
                    <div key={d} className="grid grid-cols-[3.5rem_1fr] items-center gap-2 sm:grid-cols-[3.5rem_auto_1fr_1fr]">
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={h.open} onChange={(e) => set({ open: e.target.checked })} />{d}</label>
                      {h.open ? (<>
                        <input type="time" aria-label={`${d} start`} className="min-h-11 rounded-lg border border-slate-300 px-2" value={h.start} onChange={(e) => set({ start: e.target.value })} />
                        <input type="time" aria-label={`${d} end`} className="min-h-11 rounded-lg border border-slate-300 px-2" value={h.end} onChange={(e) => set({ end: e.target.value })} />
                      </>) : <span className="col-span-2 text-sm text-slate-400">Off</span>}
                    </div>
                  );
                })}
              </div>
            </fieldset>
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          </form>
        </Drawer>
      )}
    </div>
  );
}
