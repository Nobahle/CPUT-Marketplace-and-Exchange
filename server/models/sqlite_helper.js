import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../db/cput.db');

export async function getSqliteDb() {
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

export async function seedSqliteDbIfEmpty() {
  const db = await getSqliteDb();
  try {
    // Check if categories are empty
    const catCount = await db.get('SELECT COUNT(*) as count FROM categories');
    if (catCount.count === 0) {
      console.log('[SQLITE SEED] Seeding categories...');
      const defaultCategories = ['Electronics', 'Books', 'Clothing', 'Furniture', 'Stationery', 'Other'];
      for (const name of defaultCategories) {
        await db.run('INSERT OR IGNORE INTO categories (name) VALUES (?)', [name]);
      }
    }

    // Check if products are empty
    const prodCount = await db.get('SELECT COUNT(*) as count FROM products');
    if (prodCount.count === 0) {
      console.log('[SQLITE SEED] Seeding premium products assigned to Nobahle...');
      
      // Ensure Nobahle exists in SQLite
      let nobahle = await db.get('SELECT id FROM users WHERE username = ?', ['Nobahle']);
      let nobahleId;
      if (!nobahle) {
        // Create Nobahle if missing
        import('bcryptjs').then(async (bcrypt) => {
          const hash = await bcrypt.default.hash('Nobahle123', 10);
          const res = await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['Nobahle', hash, 'user']);
          nobahleId = res.lastID;
        });
      } else {
        nobahleId = nobahle.id;
      }

      // We resolve category IDs
      const categories = await db.all('SELECT * FROM categories');
      const catMap = {};
      categories.forEach(c => catMap[c.name] = c.id);

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

      for (const prod of seedProducts) {
        const catId = catMap[prod.categoryName] || catMap['Other'] || 1;
        await db.run(
          'INSERT INTO products (name, price, image, user_id, category_id, approved) VALUES (?, ?, ?, ?, ?, ?)',
          [prod.name, prod.price, prod.image, nobahleId || 2, catId, 1]
        );
      }
      console.log('[SQLITE SEED] Seed completed successfully!');
    }
  } catch (err) {
    console.error('[SQLITE SEED ERROR]', err);
  } finally {
    await db.close();
  }
}
