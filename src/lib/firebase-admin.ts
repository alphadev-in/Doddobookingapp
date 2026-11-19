import 'dotenv/config'; // Astro dev exposes .env to import.meta.env only; load it into process.env for server code
// Server-only Firebase Admin (Firestore + Auth verification). Node runtime only.
// Credentials, in order: GOOGLE_APPLICATION_CREDENTIALS (path to a key file, recommended),
// FIREBASE_SERVICE_ACCOUNT_JSON (inline JSON), or Application Default Credentials.
import { cert, getApps, initializeApp, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'doddocouk';

/** dotenv turns \n inside a double-quoted value into real newlines, which JSON rejects. Re-escape them. */
function parseServiceAccount(raw: string) {
  return JSON.parse(raw.replace(/\r?\n/g, '\\n'));
}

function app(): App {
  if (getApps().length) return getApps()[0];
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return initializeApp({
    projectId: PROJECT_ID,
    credential: json ? cert(parseServiceAccount(json)) : applicationDefault(),
  });
}

export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());
