// Notifications: tap a row to mark it read and go to the related page.
import { useState } from 'react';
import { api } from './api';

export interface NotificationRow { id: string; title: string; body: string; href: string; read: boolean; createdAt: string; }

export default function NotificationList({ initial }: { initial: NotificationRow[] }) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function open(n: NotificationRow) {
    setRows((rs) => rs.map((r) => (r.id === n.id ? { ...r, read: true } : r)));
    await api('/api/notifications/read', { body: { id: n.id } }).catch(() => setError('Could not mark as read, but opening anyway.'));
    window.location.href = n.href;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="font-semibold">You're all caught up</p>
        <p className="mt-1 text-sm text-slate-500">New bookings, changes and cancellations appear here.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {error && <p role="alert" className="text-sm text-amber-700">{error}</p>}
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {rows.map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => open(n)} className="flex w-full min-h-16 items-start gap-3 px-4 py-4 text-left hover:bg-slate-50">
              <span aria-hidden="true" className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-brand-600'}`} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate ${n.read ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{n.title}</span>
                <span className="block truncate text-sm text-slate-500">{n.body}</span>
                <span className="mt-1 block text-xs text-slate-400">{new Date(n.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </span>
              <span aria-hidden="true" className="mt-2 text-slate-400">›</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
