// Server-only Firebase Admin (Firestore + Auth verification). Node runtime only.
// Credentials: set FIREBASE_SERVICE_ACCOUNT_JSON (full JSON of a service-account key), or
// rely on Application Default Credentials (gcloud auth application-default login).
import { cert, getApps, initializeApp, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'doddocouk';

function app(): App {
  if (getApps().length) return getApps()[0];
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return initializeApp({
    projectId: PROJECT_ID,
    credential: json ? cert(JSON.parse(json)) : applicationDefault(),
  });
}

export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());
