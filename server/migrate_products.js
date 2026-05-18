import pool from './models/db.js';
import bcrypt from 'bcryptjs';

const db = pool.firestore;

export async function runMigration() {
  if (!db) {
    throw new Error('Firestore database is not initialized. Please check your credentials key file.');
  }

  console.log('[MIGRATION] Starting product restore & assignment migration...');

  // 1. Find or create the user 'Nobahle'
  let nobahleId = null;
  const userSnapshot = await db.collection('users').where('username', '==', 'Nobahle').limit(1).get();
  
  if (userSnapshot.empty) {
    console.log('[MIGRATION] User "Nobahle" not found. Creating user...');
    // Create Nobahle with a secure hash of a default password
    const hash = await bcrypt.hash('Nobahle@CPUT', 10);
    const userRef = await db.collection('users').add({
      username: 'Nobahle',
      password: hash,
      role: 'user',
      created_at: new Date()
    });
    nobahleId = userRef.id;
    console.log(`[MIGRATION] User "Nobahle" successfully created with ID: ${nobahleId}`);
  } else {
    nobahleId = userSnapshot.docs[0].id;
    console.log(`[MIGRATION] Found existing user "Nobahle" with ID: ${nobahleId}`);
  }

  // 2. Fetch or seed Categories to map product categories
  let categoryMap = {};
  const categoriesSnapshot = await db.collection('categories').get();
  
  if (categoriesSnapshot.empty) {
    console.log('[MIGRATION] Categories are empty. Seeding default categories first...');
    const defaultCategories = ['Electronics', 'Books', 'Clothing', 'Furniture', 'Stationery', 'Other'];
    const batch = db.batch();
    
    for (const name of defaultCategories) {
      const docRef = db.collection('categories').doc();
      batch.set(docRef, { name });
    }
    await batch.commit();
    console.log('[MIGRATION] Default categories seeded.');
    
    // Fetch them again to map them
    const freshSnapshot = await db.collection('categories').get();
    freshSnapshot.forEach(doc => {
      categoryMap[doc.data().name] = doc.id;
    });
  } else {
    categoriesSnapshot.forEach(doc => {
      categoryMap[doc.data().name] = doc.id;
    });
  }

  // 3. Fetch all products to restore and assign to Nobahle
  const productsSnapshot = await db.collection('products').get();
  
  if (productsSnapshot.empty) {
    console.log('[MIGRATION] No existing products found in Firestore. Seeding premium student marketplace products assigned to Nobahle...');
    
    const seedProducts = [
      {
        name: 'Asus Vivobook Laptop',
        price: 4500,
        description: 'Asus Vivobook Intel Core i5, 8GB RAM, 256GB SSD. Perfect for coding, assignments, and online classes. Battery life is excellent (around 5 hours). Selling because I upgraded.',
        image: '/img/AsusLaptop.jpg',
        categoryName: 'Electronics'
      },
      {
        name: 'iPhone XR (Black, 64GB)',
        price: 3200,
        description: 'iPhone XR 64GB Black in excellent condition. 85% battery health. No scratches on screen or back (always kept in case). Comes with charging cable.',
        image: '/img/IphoneXR.jpg',
        categoryName: 'Electronics'
      },
      {
        name: 'University Law Textbooks Bundle',
        price: 650,
        description: 'A bundle of essential first and second-year Law textbooks for CPUT students. Includes Introduction to Law, Family Law, and Law of Persons. In neat condition, no highlights.',
        image: '/img/LawBooks.jpg',
        categoryName: 'Books'
      },
      {
        name: 'Samsung 24-inch Curved Monitor',
        price: 1500,
        description: 'Samsung 24" Curved LED Monitor. Full HD (1080p), 75Hz refresh rate. Great for dual-screen productivity or study setup. Has HDMI and VGA ports.',
        image: '/img/SamsungMonitor.jpg',
        categoryName: 'Electronics'
      },
      {
        name: 'Universal Laptop Charger',
        price: 250,
        description: 'Universal laptop charger with multiple interchangeable connector tips. Works with HP, Dell, Lenovo, Asus, and Acer laptops. Output 19.5V, 65W.',
        image: '/img/LaptopChargers.jpg',
        categoryName: 'Electronics'
      }
    ];

    const batch = db.batch();
    for (const prod of seedProducts) {
      const docRef = db.collection('products').doc();
      const categoryId = categoryMap[prod.categoryName] || categoryMap['Other'] || 'other_id';
      
      batch.set(docRef, {
        name: prod.name,
        price: prod.price,
        image: prod.image,
        user_id: nobahleId,
        category_id: categoryId,
        description: prod.description,
        approved: 1,
        created_at: new Date()
      });
    }
    await batch.commit();
    console.log(`[MIGRATION] Successfully seeded ${seedProducts.length} default products assigned to Nobahle!`);
  } else {
    console.log(`[MIGRATION] Found ${productsSnapshot.size} existing products. Restoring and assigning all to Nobahle...`);
    
    const batch = db.batch();
    productsSnapshot.forEach(doc => {
      const docRef = db.collection('products').doc(doc.id);
      batch.update(docRef, {
        user_id: nobahleId,
        approved: 1
      });
    });
    
    await batch.commit();
    console.log(`[MIGRATION] Successfully updated and restored all ${productsSnapshot.size} products!`);
  }

  console.log('[MIGRATION] Migration successfully completed.');
  return { success: true, nobahleId };
}

// Support running directly from command line
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/')) {
  runMigration()
    .then(() => {
      console.log('[MIGRATION] Completed successfully.');
      process.exit(0);
    })
    .catch(err => {
      console.error('[MIGRATION ERROR] Direct run failed:', err);
      process.exit(1);
    });
}
