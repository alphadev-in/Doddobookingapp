// Email/password sign-in and sign-up via Firebase Auth. On success the ID token is exchanged for an
// httpOnly session cookie (see /api/auth/session), so server pages and APIs can verify the user.
import { useState, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { clientAuth } from '../../lib/firebase-client';
import { api } from './api';

interface Props { mode: 'login' | 'signup'; next: string; }
type Role = 'business' | 'customer';

const friendly: Record<string, string> = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/email-already-in-use': 'An account already exists for this email. Try signing in.',
  'auth/weak-password': 'Use at least 6 characters for your password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection.',
};

export default function AuthForm({ mode, next }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<Role>('business');
  const [name, setName] = useState('');
  const isSignup = mode === 'signup';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Use at least 6 characters for your password.');
    setBusy(true);
    try {
      const auth = clientAuth();
      const cred = isSignup
        ? await createUserWithEmailAndPassword(auth, email.trim(), password)
        : await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await cred.user.getIdToken();
      await api('/api/auth/session', { body: { idToken } });
      if (isSignup) await api('/api/me', { body: { role, name } });
      const me = await api<{ role: string | null; isAdmin: boolean; hasBusiness: boolean }>('/api/me');
      if (me.role === 'customer') window.location.href = next && next.startsWith('/account') ? next : '/account';
      else if (me.isAdmin && !isSignup && (!next || next === '/dashboard')) window.location.href = '/admin';
      else window.location.href = isSignup || !me.hasBusiness ? '/onboarding' : next || '/dashboard';
    } catch (err: any) {
      setError(friendly[err?.code] ?? err?.message ?? 'Something went wrong.');
      setBusy(false);
    }
  }

  async function onReset() {
    setError(null);
    if (!email) return setError('Enter your email above first.');
    try {
      await sendPasswordResetEmail(clientAuth(), email.trim());
      setInfo('If an account exists, a reset email is on its way.');
    } catch (err: any) {
      setError(friendly[err?.code] ?? 'Could not send reset email.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-slate-700">Email</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-slate-700">Password</label>
        <input id="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15" />
      </div>
      {isSignup && (
        <>
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-slate-700">Your name</label>
            <input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">I want to</legend>
            <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup">
              {([['business', 'Run a business', 'Take bookings & manage my team'], ['customer', 'Book appointments', 'See and manage my bookings']] as const).map(([r, t, d]) => (
                <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)}
                  className={`rounded-xl border p-3 text-left ${role === r ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-300 hover:bg-slate-50'}`}>
                  <span className="block text-sm font-semibold">{t}</span>
                  <span className="block text-xs text-slate-500">{d}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {info && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</p>}
      <button type="submit" disabled={busy}
        className="w-full rounded-xl bg-brand-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:-translate-y-0.5 hover:bg-brand-700 disabled:opacity-60 disabled:hover:translate-y-0">
        {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
      </button>
      {!isSignup && (
        <button type="button" onClick={onReset} className="w-full text-sm text-brand-700 hover:underline">Forgot password?</button>
      )}
    </form>
  );
}
