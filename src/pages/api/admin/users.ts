import type { APIRoute } from 'astro';
import { adminAuth } from '../../../lib/firebase-admin';
import { listAllBusinesses, listUsers } from '../../../lib/repo';
import { json, withErrors } from '../../../lib/http';
import { requireAdmin } from '../../../lib/session';

export const prerender = false;

/** Admin overview: auth users (with disabled state), roles, and businesses with subscription. */
export const GET: APIRoute = withErrors(async ({ request }) => {
  await requireAdmin(request);
  const [authList, roles, businesses] = await Promise.all([adminAuth().listUsers(1000), listUsers(), listAllBusinesses()]);
  const roleBy = new Map(roles.map((r) => [r.uid, r.role]));
  const bizBy = new Map(businesses.map((b) => [b.ownerUid, b]));
  const users = authList.users.map((u) => ({
    uid: u.uid,
    email: u.email ?? '',
    created: u.metadata.creationTime,
    lastSignIn: u.metadata.lastSignInTime,
    disabled: u.disabled,
    role: roleBy.get(u.uid) ?? (bizBy.has(u.uid) ? 'business' : 'unknown'),
    business: bizBy.get(u.uid) ? { id: bizBy.get(u.uid)!.id, name: bizBy.get(u.uid)!.name, slug: bizBy.get(u.uid)!.slug, subscription: bizBy.get(u.uid)!.subscription } : null,
  }));
  return json({ users, totals: { users: users.length, businesses: businesses.length, customers: users.filter((u) => u.role === 'customer').length } });
});
