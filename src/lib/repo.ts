// Data layer on Cloud Firestore (server-only, via firebase-admin).
// Collections: businesses, services, staff, clients, appointments. Each doc id is the record id;
// every tenant-scoped doc carries `businessId`. Timestamps are stored as ISO strings.
import type { Appointment, Business, Client, Service, Staff } from './types';
import { adminDb } from './firebase-admin';
import { uid } from './ids';

const db = () => adminDb();
const col = <T>(name: string) => db().collection(name) as FirebaseFirestore.CollectionReference<T>;
const snap = <T>(d: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): T => d.data() as T;

// ---------- Businesses ----------
export const getBusinessById = async (id: string) => {
  const d = await col<Business>('businesses').doc(id).get();
  return d.exists ? snap<Business>(d) : null;
};
export async function getBusinessBySlug(slug: string) {
  const q = await col<Business>('businesses').where('slug', '==', slug).limit(1).get();
  return q.empty ? null : snap<Business>(q.docs[0]);
}
export async function getBusinessByOwner(ownerUid: string) {
  const q = await col<Business>('businesses').where('ownerUid', '==', ownerUid).limit(1).get();
  return q.empty ? null : snap<Business>(q.docs[0]);
}
export const isSlugTaken = async (slug: string) => (await getBusinessBySlug(slug)) !== null;
export async function saveBusiness(b: Business): Promise<Business> {
  await col<Business>('businesses').doc(b.id).set(b);
  return b;
}

// ---------- Services ----------
export async function listServices(businessId: string) {
  const q = await col<Service>('services').where('businessId', '==', businessId).get();
  return q.docs.map((d) => snap<Service>(d));
}
export async function getServices(ids: string[]) {
  const docs = await Promise.all(ids.map((id) => col<Service>('services').doc(id).get()));
  return docs.filter((d) => d.exists).map((d) => snap<Service>(d));
}
export async function saveService(s: Omit<Service, 'id'> & { id?: string }): Promise<Service> {
  const id = s.id ?? `svc_${uid()}`;
  const row = { ...s, id } as Service;
  await col<Service>('services').doc(id).set(row, { merge: true });
  return row;
}
export async function deleteService(id: string) {
  await col<Service>('services').doc(id).delete();
}

// ---------- Staff ----------
export async function listStaff(businessId: string) {
  const q = await col<Staff>('staff').where('businessId', '==', businessId).get();
  return q.docs.map((d) => snap<Staff>(d));
}
export async function getStaff(id: string) {
  const d = await col<Staff>('staff').doc(id).get();
  return d.exists ? snap<Staff>(d) : null;
}
export async function saveStaff(s: Omit<Staff, 'id'> & { id?: string }): Promise<Staff> {
  const id = s.id ?? `stf_${uid()}`;
  const row = { ...s, id } as Staff;
  await col<Staff>('staff').doc(id).set(row, { merge: true });
  return row;
}
export async function deleteStaff(id: string) {
  await col<Staff>('staff').doc(id).delete();
}

// ---------- Clients ----------
export async function listClients(businessId: string) {
  const q = await col<Client>('clients').where('businessId', '==', businessId).get();
  return q.docs.map((d) => snap<Client>(d));
}
export async function getClient(id: string) {
  const d = await col<Client>('clients').doc(id).get();
  return d.exists ? snap<Client>(d) : null;
}
export async function saveClient(c: Client): Promise<Client> {
  await col<Client>('clients').doc(c.id).set(c, { merge: true });
  return c;
}
/** Find by email, then by phone, within one business. */
export async function findClient(businessId: string, email: string, phone: string): Promise<Client | null> {
  const e = email.trim().toLowerCase();
  const p = phone.replace(/\s+/g, '');
  if (e) {
    const q = await col<Client>('clients').where('businessId', '==', businessId).where('email', '==', e).limit(1).get();
    if (!q.empty) return snap<Client>(q.docs[0]);
  }
  if (p) {
    const q = await col<Client>('clients').where('businessId', '==', businessId).where('phone', '==', p).limit(1).get();
    if (!q.empty) return snap<Client>(q.docs[0]);
  }
  return null;
}

// ---------- Appointments ----------
export async function listAppointments(businessId: string) {
  const q = await col<Appointment>('appointments').where('businessId', '==', businessId).get();
  return q.docs.map((d) => snap<Appointment>(d));
}
export async function getAppointment(id: string) {
  const d = await col<Appointment>('appointments').doc(id).get();
  return d.exists ? snap<Appointment>(d) : null;
}
export async function findAppointmentByIntent(paymentIntentId: string) {
  const q = await col<Appointment>('appointments').where('paymentIntentId', '==', paymentIntentId).limit(1).get();
  return q.empty ? null : snap<Appointment>(q.docs[0]);
}
export async function updateAppointment(id: string, patch: Partial<Appointment>): Promise<Appointment | null> {
  const ref = col<Appointment>('appointments').doc(id);
  const d = await ref.get();
  if (!d.exists) return null;
  const next = { ...snap<Appointment>(d), ...patch, updatedAt: new Date().toISOString() };
  await ref.set(next);
  return next;
}
export async function deleteAppointment(id: string) {
  await col<Appointment>('appointments').doc(id).delete();
}

/** Recompute derived CRM stats from appointment history (consistent under status changes both ways). */
export async function recomputeClientStats(clientId: string) {
  const client = await getClient(clientId);
  if (!client) return;
  const q = await col<Appointment>('appointments').where('clientId', '==', clientId).get();
  const mine = q.docs.map((d) => snap<Appointment>(d)).filter((a) => a.kind !== 'block');
  const done = mine.filter((a) => a.status === 'completed');
  await col<Client>('clients').doc(clientId).set({
    totalVisits: done.length,
    totalSpentCents: done.reduce((sum, a) => sum + a.priceCents, 0),
    noShowCount: mine.filter((a) => a.status === 'no_show').length,
    lastVisitAt: done.map((a) => a.startAt).sort().at(-1) ?? null,
  }, { merge: true });
}

export { db as firestore, col };

/** Appointments starting in [fromIso, toIso). Used by the reminder job. */
export async function listAppointmentsStartingBetween(fromIso: string, toIso: string) {
  const q = await col<Appointment>('appointments').where('startAt', '>=', fromIso).where('startAt', '<', toIso).get();
  return q.docs.map((d) => snap<Appointment>(d));
}
