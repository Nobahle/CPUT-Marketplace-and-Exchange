import express from 'express';
import bcrypt from 'bcryptjs';
import { createUser, findUserByUsername } from '../models/user.js';

const router = express.Router();

// Render login page
router.get('/login', (req, res) => {
  res.sendFile(process.cwd() + '/login/login.html');
});

// Render sign up page
router.get('/signup', (req, res) => {
  res.sendFile(process.cwd() + '/sign-in/signIn.html');
});

// Handle login
router.post('/login', async (req, res) => {
  const start = Date.now();
  const { username, password } = req.body;
  
  console.log(`[AUTH] Login attempt for user: ${username}`);
  
  const userStart = Date.now();
  const user = await findUserByUsername(username);
  console.log(`[AUTH] DB lookup took: ${Date.now() - userStart}ms`);
  
  if (!user) return res.send('Invalid username or password');
  
  const bcryptStart = Date.now();
  const match = await bcrypt.compare(password, user.password);
  console.log(`[AUTH] Bcrypt comparison took: ${Date.now() - bcryptStart}ms`);
  
  if (!match) return res.send('Invalid username or password');
  
  req.session.user = { id: user.id, username: user.username };
  console.log(`[AUTH] Total login process took: ${Date.now() - start}ms`);
  
  res.redirect('/home/home.html');
});

// Handle sign up
router.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.send('All fields required');
  const existing = await findUserByUsername(username);
  if (existing) return res.send('Username already taken');
  const hash = await bcrypt.hash(password, 10);
  // Only allow user role
  await createUser({ username, password: hash });
  // Auto-login after signup
  const user = await findUserByUsername(username);
  req.session.user = { id: user.id, username: user.username };
  res.redirect('/home/home.html');
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
  const snapshot = await (await import('../models/db.js')).default.firestore.collection('users').get();
  const rows = snapshot.docs.map(doc => ({ id: doc.id, username: doc.data().username }));
  res.json(rows);
});

export default router;
