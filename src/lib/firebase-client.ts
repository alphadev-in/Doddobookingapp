// Browser-side Firebase (Auth only). Web config values are public identifiers, not secrets;
// access is enforced by Firestore security rules and server-side session verification.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: 'AIzaSyDpR84a26nowhJ4t9ZBmUEBMCddFsqXlE4',
  authDomain: 'doddocouk.firebaseapp.com',
  projectId: 'doddocouk',
  storageBucket: 'doddocouk.firebasestorage.app',
  messagingSenderId: '109768671828',
  appId: '1:109768671828:web:efd1711ec0a311ef5b63c1',
  measurementId: 'G-HQWFKXX7MG',
};

export function clientAuth() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}
