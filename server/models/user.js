import pool from './db.js';

const db = pool.firestore;

export async function createUser({ username, password }) {
  const userRef = await db.collection('users').add({
    username,
    password,
    role: 'user',
    created_at: new Date()
  });
  return userRef.id;
}

export async function findUserByUsername(username) {
  try {
    const snapshot = await db.collection('users').where('username', '==', username).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (err) {
    console.error(`[DB ERROR] Failed to find user '${username}':`, err.message);
    if (err.message.includes('NOT_FOUND')) {
      console.warn('[DB WARNING] It seems the Firestore database or collection is missing. Please check your Firebase Console.');
    }
    throw err; // Re-throw to let the caller handle it
  }
}
