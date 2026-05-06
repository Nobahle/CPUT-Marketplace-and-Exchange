import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import dotenv from 'dotenv';
import authRoutes from '../server/routes/auth.js';
import productRoutes from '../server/routes/product.js';
import chatRoutes from '../server/routes/chat.js';
import ratingRoutes from '../server/routes/rating.js';
import reportRoutes from '../server/routes/report.js';
import pool from '../server/models/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

app.locals.db = pool;

// Enable CORS
app.use(cors({ origin: true, credentials: true }));
app.use(express.static(path.join(__dirname, '../')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ 
  secret: 'cput-secret', 
  resave: false, 
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Seed Categories if empty
let categoriesSeeded = false;
async function seedCategories() {
  if (categoriesSeeded) return;
  const db = pool.firestore;
  try {
    const snapshot = await db.collection('categories').limit(1).get();
    if (snapshot.empty) {
      console.log('[SYSTEM] Seeding default categories to Firestore...');
      const categories = ['Electronics', 'Books', 'Clothing', 'Furniture', 'Stationery', 'Other'];
      const batch = db.batch();
      for (const name of categories) {
        const docRef = db.collection('categories').doc();
        batch.set(docRef, { name });
      }
      await batch.commit();
      console.log('[SYSTEM] Seeding completed.');
    }
    categoriesSeeded = true;
  } catch (err) {
    console.error('[ERROR] Failed to seed categories:', err.message);
  }
}
// seedCategories(); // REMOVED FROM AUTO-START

app.get('/health', async (req, res) => {
  await seedCategories();
  res.json({ status: 'ok', time: new Date().toISOString(), env: !!process.env.FIREBASE_SERVICE_ACCOUNT });
});

// Routes
app.use('/', authRoutes);
app.use('/', productRoutes);
app.use('/', chatRoutes);
app.use('/', ratingRoutes);
app.use('/', reportRoutes);

app.get('/', (req, res) => {
  res.redirect('/login/login.html');
});

// For Vercel, we export the app
export default app;
