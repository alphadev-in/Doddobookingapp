import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { clientAuth } from '../../lib/firebase-client';
import { api } from './api';

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api('/api/auth/session', { method: 'DELETE' }).catch(() => {});
        await signOut(clientAuth()).catch(() => {});
        window.location.href = '/login';
      }}
      className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
