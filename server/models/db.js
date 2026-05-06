import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbStart = Date.now();
dotenv.config({ path: path.join(__dirname, '../../.env') });

const serviceAccountPath = path.join(__dirname, '../firebase-key.json');
let db;

if (admin.apps.length > 0) {
  db = admin.firestore();
  console.log('[SYSTEM] Using existing Firebase instance');
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    let saText = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
    if (saText.startsWith('"') && saText.endsWith('"')) {
      saText = saText.substring(1, saText.length - 1);
    }
    const serviceAccount = JSON.parse(saText);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log(`[SYSTEM] Firebase initialized in ${Date.now() - dbStart}ms`);
  } catch (err) {
    console.error('[ERROR] Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', err.message);
  }
} else if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log('[SYSTEM] Firebase initialized from local key file');
} else {
  console.error('[CRITICAL] No Firebase credentials found!');
}

db = admin.firestore();

const pool = {
  // We keep this shim for now but will refactor models to use Firestore directly
  query: async (sql, params = []) => {
    console.warn('[DB WARNING] SQL query called on Firebase DB. This is a shim and may not support complex queries:', sql);
    // This is just a placeholder to prevent crashes until refactor is done
    return [[], {}];
  },
  firestore: db
};

export default pool;
