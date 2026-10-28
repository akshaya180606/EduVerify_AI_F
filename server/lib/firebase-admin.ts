import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'eduverify-ai-local';

try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.projectId) {
      projectId = parsed.projectId;
    }
  }
} catch {
  // Graceful fallback when config is absent or unreadable
}

if (!getApps().length) {
  try {
    initializeApp({
      projectId,
    });
  } catch (err) {
    console.warn('[FirebaseAdmin] initializeApp warning:', err);
  }
}

let _authInstance: any = null;
try {
  _authInstance = getAuth();
} catch (err) {
  console.warn('[FirebaseAdmin] getAuth fallback active');
  _authInstance = {
    verifyIdToken: async () => {
      throw new Error('Firebase Auth is not configured');
    },
  };
}

export const adminAuth = _authInstance;
