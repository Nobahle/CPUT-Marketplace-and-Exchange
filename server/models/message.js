import pool from './db.js';

const db = pool.firestore;

async function getSqliteDb() {
  const { getSqliteDb: getDb } = await import('./sqlite_helper.js');
  return getDb();
}

export async function createMessage({ fromUserId, toUserId, content }) {
  try {
    const messageRef = await db.collection('messages').add({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      content,
      created_at: new Date()
    });
    return messageRef.id;
  } catch (err) {
    console.warn('[FIRESTORE WARNING] Falling back to SQLite for createMessage:', err.message);
    const sqlite = await getSqliteDb();
    try {
      const res = await sqlite.run(
        'INSERT INTO messages (from_user_id, to_user_id, content) VALUES (?, ?, ?)',
        [parseInt(fromUserId, 10) || 0, parseInt(toUserId, 10) || 0, content]
      );
      return String(res.lastID);
    } finally {
      await sqlite.close();
    }
  }
}

export async function getMessagesBetweenUsers(userA, userB) {
  try {
    const q1 = await db.collection('messages')
      .where('from_user_id', '==', userA)
      .where('to_user_id', '==', userB)
      .get();
      
    const q2 = await db.collection('messages')
      .where('from_user_id', '==', userB)
      .where('to_user_id', '==', userA)
      .get();
      
    const messages = [];
    const userCache = {};

    const processDocs = async (docs) => {
      for (const doc of docs) {
        const data = doc.data();
        
        if (!userCache[data.from_user_id]) {
          const u = await db.collection('users').doc(data.from_user_id).get();
          userCache[data.from_user_id] = u.exists ? u.data().username : 'Unknown';
        }
        if (!userCache[data.to_user_id]) {
          const u = await db.collection('users').doc(data.to_user_id).get();
          userCache[data.to_user_id] = u.exists ? u.data().username : 'Unknown';
        }

        messages.push({
          id: doc.id,
          ...data,
          from_username: userCache[data.from_user_id],
          to_username: userCache[data.to_user_id]
        });
      }
    };

    await processDocs(q1.docs);
    await processDocs(q2.docs);

    return messages.sort((a, b) => a.created_at - b.created_at);
  } catch (err) {
    console.warn('[FIRESTORE WARNING] Falling back to SQLite for getMessagesBetweenUsers:', err.message);
    const sqlite = await getSqliteDb();
    try {
      const rows = await sqlite.all(`
        SELECT m.*, u1.username as from_username, u2.username as to_username
        FROM messages m
        LEFT JOIN users u1 ON m.from_user_id = u1.id
        LEFT JOIN users u2 ON m.to_user_id = u2.id
        WHERE (m.from_user_id = ? AND m.to_user_id = ?)
           OR (m.from_user_id = ? AND m.to_user_id = ?)
        ORDER BY m.created_at ASC
      `, [parseInt(userA, 10) || 0, parseInt(userB, 10) || 0, parseInt(userB, 10) || 0, parseInt(userA, 10) || 0]);
      
      return rows.map(row => ({
        id: String(row.id),
        from_user_id: String(row.from_user_id),
        to_user_id: String(row.to_user_id),
        content: row.content,
        created_at: row.created_at,
        from_username: row.from_username || 'Unknown',
        to_username: row.to_username || 'Unknown'
      }));
    } finally {
      await sqlite.close();
    }
  }
}
