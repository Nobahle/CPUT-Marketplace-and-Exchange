import pool from './db.js';

const db = pool.firestore;

export async function createMessage({ fromUserId, toUserId, content }) {
  const messageRef = await db.collection('messages').add({
    from_user_id: fromUserId,
    to_user_id: toUserId,
    content,
    created_at: new Date()
  });
  return messageRef.id;
}

export async function getMessagesBetweenUsers(userA, userB) {
  // Firestore doesn't support complex OR queries across fields easily with orderBy.
  // We'll fetch messages where either is from/to and filter/sort in memory.
  
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
}
