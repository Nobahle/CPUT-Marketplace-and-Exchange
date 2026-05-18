import express from 'express';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createUser, findUserByUsername } from '../models/user.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Render login page
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'login', 'login.html'));
});

// Render sign up page
router.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'sign-in', 'signIn.html'));
});

// Handle login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await findUserByUsername(username);
    if (!user) return res.send('Invalid username or password');
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send('Invalid username or password');
    req.session.user = { id: user.id, username: user.username };
    res.redirect('/home/home.html');
  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    res.status(500).send('Service temporarily unavailable. Please try again in a moment.');
  }
});

// Handle sign up
router.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.send('All fields required');
  try {
    const existing = await findUserByUsername(username);
    if (existing) return res.send('Username already taken');
    const hash = await bcrypt.hash(password, 10);
    await createUser({ username, password: hash });
    const user = await findUserByUsername(username);
    req.session.user = { id: user.id, username: user.username };
    res.redirect('/home/home.html');
  } catch (err) {
    console.error('[AUTH] Signup error:', err.message);
    res.status(500).send('Service temporarily unavailable. Please try again in a moment.');
  }
});

// Handle logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// API: return current logged-in user (used by chat frontend)
router.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json(null);
  res.json(req.session.user);
});

router.get('/api/users', async (req, res) => {
  try {
    const snapshot = await (await import('../models/db.js')).default.firestore.collection('users').get();
    const rows = snapshot.docs.map(doc => ({ id: doc.id, username: doc.data().username }));
    res.json(rows);
  } catch (err) {
    console.warn('[FIRESTORE WARNING] Falling back to SQLite for /api/users:', err.message);
    try {
      const { getSqliteDb } = await import('../models/sqlite_helper.js');
      const sqlite = await getSqliteDb();
      const rows = await sqlite.all('SELECT id, username FROM users');
      await sqlite.close();
      res.json(rows.map(row => ({ id: String(row.id), username: row.username })));
    } catch (sqliteErr) {
      console.error('[SQLITE ERROR] /api/users fallback failed:', sqliteErr.message);
      res.status(500).json([]);
    }
  }
});

export default router;
