import pool from './db.js';

const db = pool.firestore;

export async function createProduct({ name, price, image, userId, categoryId, description }) {
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
}

export async function getApprovedProducts(limitNum = null, offsetNum = 0) {
  let query = db.collection('products').where('approved', '==', 1).orderBy('created_at', 'desc');
  
  if (limitNum) {
    // Note: Firestore offset is inefficient for large datasets but works for simple apps
    // A better way is using startAfter() with snapshots
    query = query.limit(limitNum);
  }

  const snapshot = await query.get();
  const products = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    // In SQL we joined with users and categories. In Firestore we fetch them or denormalize.
    // For now, let's fetch related info to keep the frontend working.
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
  
  return products;
}

export async function getApprovedProductsCount() {
  const snapshot = await db.collection('products').where('approved', '==', 1).count().get();
  return snapshot.data().count;
}

export async function getProductById(id) {
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
}

export async function searchProducts(q, categoryId, limitNum = null, offsetNum = 0) {
  let query = db.collection('products').where('approved', '==', 1);
  
  if (categoryId) {
    query = query.where('category_id', '==', categoryId);
  }
  
  // Firestore doesn't support native LIKE search. We'll filter in memory for now
  // or use a better search engine like Algolia if it were a production app.
  const snapshot = await query.orderBy('created_at', 'desc').get();
  let products = [];
  
  for (const doc of snapshot.docs) {
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
}

export async function searchProductsCount(q, categoryId) {
  const products = await searchProducts(q, categoryId);
  return products.length;
}

export async function getCategories() {
  const snapshot = await db.collection('categories').orderBy('name', 'asc').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
