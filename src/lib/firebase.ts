import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';

let firebaseConfig: Record<string, string> = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-placeholder-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'eduverify-ai.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'eduverify-ai-local',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'eduverify-ai.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef',
};

const configs = import.meta.glob('/firebase-applet-config.json', { eager: true });
if (configs['/firebase-applet-config.json']) {
  const loaded = configs['/firebase-applet-config.json'] as any;
  firebaseConfig = loaded.default || loaded;
}

let app: FirebaseApp;
try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
} catch {
  app = {} as FirebaseApp;
}

let _authInstance: Auth | null = null;
export function getFirebaseAuth(): Auth {
  if (!_authInstance) {
    try {
      _authInstance = getAuth(app);
    } catch {
      _authInstance = {} as Auth;
    }
  }
  return _authInstance;
}

// Proxy auth to prevent premature top-level module initialization race conditions
export const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    const instance = getFirebaseAuth();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export const googleAuthProvider = new GoogleAuthProvider();
