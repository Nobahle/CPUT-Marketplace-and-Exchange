import pool from './db.js';

const db = pool.firestore;

async function getSqliteDb() {
  const { getSqliteDb: getDb } = await import('./sqlite_helper.js');
  return getDb();
}

export async function createUser({ username, password }) {
  try {
    const userRef = await db.collection('users').add({
      username,
      password,
      role: 'user',
      created_at: new Date()
    });
    return userRef.id;
  } catch (err) {
    console.warn('[FIRESTORE WARNING] Falling back to SQLite for createUser:', err.message);
    const sqlite = await getSqliteDb();
    try {
      const res = await sqlite.run(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [username, password, 'user']
      );
      return String(res.lastID);
    } finally {
      await sqlite.close();
    }
  }
}

export async function findUserByUsername(username) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Database timeout after 10s')), 10000)
  );
  try {
    const query = db.collection('users').where('username', '==', username).limit(1).get();
    const snapshot = await Promise.race([query, timeout]);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (err) {
    console.warn(`[FIRESTORE WARNING] findUserByUsername('${username}') failed, checking SQLite fallback:`, err.message);
    const sqlite = await getSqliteDb();
    try {
      const row = await sqlite.get('SELECT * FROM users WHERE username = ?', [username]);
      if (!row) return null;
      return {
        id: String(row.id),
        username: row.username,
        password: row.password,
        role: row.role,
        created_at: row.created_at
      };
    } finally {
      await sqlite.close();
    }
  }
}
