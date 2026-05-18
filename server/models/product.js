import pool from './db.js';

const db = pool.firestore;

async function getSqliteDb() {
  const { getSqliteDb: getDb } = await import('./sqlite_helper.js');
  return getDb();
}

export async function createProduct({ name, price, image, userId, categoryId, description }) {
  try {
    const productRef = await db.collection('products').add({
      name,
      price,
      image,
      user_id: userId,
      category_id: categoryId,
      description: description || '',
      approved: 1,
      created_at: new Date()
    });
    return productRef.id;
  } catch (err) {
    console.warn('[FIRESTORE WARNING] Falling back to SQLite for createProduct:', err.message);
    const sqlite = await getSqliteDb();
    try {
      const res = await sqlite.run(
        'INSERT INTO products (name, price, image, user_id, category_id, description, approved) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [name, price, image, parseInt(userId, 10) || 2, parseInt(categoryId, 10) || 1, description || '']
      );
      return String(res.lastID);
    } finally {
      await sqlite.close();
    }
  }
}

export async function getApprovedProducts(limitNum = null, offsetNum = 0) {
  try {
    let query = db.collection('products').where('approved', '==', 1);
    const snapshot = await query.get();
    const sortedDocs = snapshot.docs.sort((a, b) => {
      const tA = a.data().created_at?.toDate ? a.data().created_at.toDate() : new Date(a.data().created_at);
      const tB = b.data().created_at?.toDate ? b.data().created_at.toDate() : new Date(b.data().created_at);
      return tB - tA;
    });
    const offsetDocs = sortedDocs.slice(offsetNum);
    const limitDocs = limitNum ? offsetDocs.slice(0, limitNum) : offsetDocs;
    return await enrichProducts(limitDocs);
  } catch (err) {
    console.warn('[FIRESTORE WARNING] Falling back to SQLite for getApprovedProducts:', err.message);
    const sqlite = await getSqliteDb();
    try {
      let sql = `
        SELECT p.*, u.username as seller_username, c.name as category_name
        FROM products p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.approved = 1
        ORDER BY p.created_at DESC
      `;
      if (limitNum) {
        sql += ` LIMIT ${parseInt(limitNum, 10)} OFFSET ${parseInt(offsetNum, 10)}`;
      }
      const rows = await sqlite.all(sql);
      return rows.map(row => ({
        id: String(row.id),
        name: row.name,
        price: row.price,
        image: row.image,
        user_id: String(row.user_id),
        category_id: String(row.category_id),
        description: row.description,
        approved: row.approved,
        created_at: row.created_at,
        seller_id: String(row.user_id),
        seller_username: row.seller_username || 'Unknown',
        category_name: row.category_name || 'Uncategorized'
      }));
    } finally {
      await sqlite.close();
    }
  }
}

async function enrichProducts(docs) {
  return Promise.all(docs.map(async (doc) => {
    const data = doc.data();
    const [userDoc, categoryDoc] = await Promise.all([
      db.collection('users').doc(data.user_id).get(),
      db.collection('categories').doc(data.category_id).get()
    ]);
    return {
      id: doc.id,
      ...data,
      seller_id: data.user_id,
      seller_username: userDoc.exists ? userDoc.data().username : 'Unknown',
      category_name: categoryDoc.exists ? categoryDoc.data().name : 'Uncategorized'
    };
  }));
}

export async function getApprovedProductsCount() {
  try {
    const snapshot = await db.collection('products').where('approved', '==', 1).count().get();
    return snapshot.data().count;
  } catch (err) {
    console.warn('[FIRESTORE WARNING] Falling back to SQLite for getApprovedProductsCount:', err.message);
    const sqlite = await getSqliteDb();
    try {
      const row = await sqlite.get('SELECT COUNT(*) as count FROM products WHERE approved = 1');
      return row.count;
    } finally {
      await sqlite.close();
    }
  }
}

export async function getProductById(id) {
  try {
    const doc = await db.collection('products').doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data();
    
    const userDoc = await db.collection('users').doc(data.user_id).get();
    const categoryDoc = await db.collection('categories').doc(data.category_id).get();
    
    return {
      id: doc.id,
      ...data,
      seller_id: data.user_id,
      seller_username: userDoc.exists ? userDoc.data().username : 'Unknown',
      category_name: categoryDoc.exists ? categoryDoc.data().name : 'Uncategorized'
    };
  } catch (err) {
    console.warn('[FIRESTORE WARNING] Falling back to SQLite for getProductById:', err.message);
    const sqlite = await getSqliteDb();
    try {
      const row = await sqlite.get(`
        SELECT p.*, u.username as seller_username, c.name as category_name
        FROM products p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
      `, [parseInt(id, 10) || 0]);
      if (!row) return null;
      return {
        id: String(row.id),
        name: row.name,
        price: row.price,
        image: row.image,
        user_id: String(row.user_id),
        category_id: String(row.category_id),
        description: row.description,
        approved: row.approved,
        created_at: row.created_at,
        seller_id: String(row.user_id),
        seller_username: row.seller_username || 'Unknown',
        category_name: row.category_name || 'Uncategorized'
      };
    } finally {
      await sqlite.close();
    }
  }
}

export async function searchProducts(q, categoryId, limitNum = null, offsetNum = 0) {
  try {
    let query = db.collection('products').where('approved', '==', 1);
    if (categoryId) {
      query = query.where('category_id', '==', categoryId);
    }
    const snapshot = await query.get();
    const sortedDocs = snapshot.docs.sort((a, b) => {
      const tA = a.data().created_at?.toDate ? a.data().created_at.toDate() : new Date(a.data().created_at);
      const tB = b.data().created_at?.toDate ? b.data().created_at.toDate() : new Date(b.data().created_at);
      return tB - tA;
    });
    let products = [];
    for (const doc of sortedDocs) {
      const data = doc.data();
      if (q && !data.name.toLowerCase().includes(q.toLowerCase())) continue;
      const userDoc = await db.collection('users').doc(data.user_id).get();
      const categoryDoc = await db.collection('categories').doc(data.category_id).get();
      products.push({
        id: doc.id,
        ...data,
        seller_id: data.user_id,
        seller_username: userDoc.exists ? userDoc.data().username : 'Unknown',
        category_name: categoryDoc.exists ? categoryDoc.data().name : 'Uncategorized'
      });
    }
    if (limitNum) {
      products = products.slice(offsetNum, offsetNum + limitNum);
    }
    return products;
  } catch (err) {
    console.warn('[FIRESTORE WARNING] Falling back to SQLite for searchProducts:', err.message);
    const sqlite = await getSqliteDb();
    try {
      let sql = `
        SELECT p.*, u.username as seller_username, c.name as category_name
        FROM products p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.approved = 1
      `;
      const params = [];
      if (categoryId) {
        sql += ` AND p.category_id = ?`;
        params.push(parseInt(categoryId, 10));
      }
      if (q) {
        sql += ` AND p.name LIKE ?`;
        params.push(`%${q}%`);
      }
      sql += ` ORDER BY p.created_at DESC`;
      if (limitNum) {
        sql += ` LIMIT ${parseInt(limitNum, 10)} OFFSET ${parseInt(offsetNum, 10)}`;
      }
      const rows = await sqlite.all(sql, params);
      return rows.map(row => ({
        id: String(row.id),
        name: row.name,
        price: row.price,
        image: row.image,
        user_id: String(row.user_id),
        category_id: String(row.category_id),
        description: row.description,
        approved: row.approved,
        created_at: row.created_at,
        seller_id: String(row.user_id),
        seller_username: row.seller_username || 'Unknown',
        category_name: row.category_name || 'Uncategorized'
      }));
    } finally {
      await sqlite.close();
    }
  }
}

export async function searchProductsCount(q, categoryId) {
  try {
    const products = await searchProducts(q, categoryId);
    return products.length;
  } catch (err) {
    console.warn('[FIRESTORE WARNING] Falling back to SQLite for searchProductsCount:', err.message);
    const sqlite = await getSqliteDb();
    try {
      let sql = `SELECT COUNT(*) as count FROM products WHERE approved = 1`;
      const params = [];
      if (categoryId) {
        sql += ` AND category_id = ?`;
        params.push(parseInt(categoryId, 10));
      }
      if (q) {
        sql += ` AND name LIKE ?`;
        params.push(`%${q}%`);
      }
      const row = await sqlite.get(sql, params);
      return row.count;
    } finally {
      await sqlite.close();
    }
  }
}

export async function getCategories() {
  try {
    const snapshot = await db.collection('categories').orderBy('name', 'asc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn('[FIRESTORE WARNING] Falling back to SQLite for getCategories:', err.message);
    const sqlite = await getSqliteDb();
    try {
      const rows = await sqlite.all('SELECT * FROM categories ORDER BY name ASC');
      return rows.map(row => ({ id: String(row.id), name: row.name }));
    } finally {
      await sqlite.close();
    }
  }
}
