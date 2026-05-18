import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/product.js';
import chatRoutes from './routes/chat.js';
import ratingRoutes from './routes/rating.js';
import reportRoutes from './routes/report.js';
import pool from './models/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Accept CORS from common Live Server origins and Vercel
const allowedOrigins = [
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:5501',
  'http://localhost:5501',
  'http://localhost:3000'
];

const io = new SocketIO(server, { 
  cors: { 
    origin: '*', 
    methods: ['GET','POST'] 
  } 
});

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
  cookie: { secure: false } // Set to true if using HTTPS
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
seedCategories();

// Seed SQLite dynamically in offline/local environments (avoiding loading sqlite3 module on Vercel)
if (!process.env.VERCEL) {
  import('./models/sqlite_helper.js').then(({ seedSqliteDbIfEmpty }) => {
    seedSqliteDbIfEmpty();
  }).catch(err => {
    console.warn('[SQLITE WARNING] Could not run offline seeding:', err.message);
  });
}

// Auth and feature routes
app.use('/', authRoutes);
app.use('/', productRoutes);
app.use('/', chatRoutes);
app.use('/', ratingRoutes);
app.use('/', reportRoutes);

// Placeholder routes
app.get('/', (req, res) => {
  res.redirect('/login/login.html');
});

// Product submission page
app.get('/submit-product', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'product.html'));
});

// Notifications page
app.get('/notifications', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'notifications.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Socket.IO for real-time chat
io.on('connection', (socket) => {
  socket.on('joinRoom', ({ userA, userB }) => {
    const room = [userA, userB].sort().join('-');
    socket.join(room);
  });
  socket.on('chatMessage', ({ fromUserId, toUserId, content }) => {
    const room = [fromUserId, toUserId].sort().join('-');
    io.to(room).emit('chatMessage', { fromUserId, toUserId, content });
  });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
