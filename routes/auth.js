const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Simple in-memory user store for demo purposes
const users = new Map();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (users.has(username)) return res.status(409).json({ error: 'User exists' });
  const hash = await bcrypt.hash(password, 10);
  const user = { id: String(users.size + 1), username, password: hash };
  users.set(username, user);
  res.status(201).json({ id: user.id, username: user.username });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const user = users.get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ sub: user.id, username: user.username }, process.env.JWT_SECRET || 'change_me', { expiresIn: '1h' });
  res.json({ token });
});

module.exports = router;
