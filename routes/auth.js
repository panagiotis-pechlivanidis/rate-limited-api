const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../middleware/auth');
const { sendJsonError } = require('../middleware/jsonError');
const router = express.Router();

// Simple in-memory user store for demo purposes
const users = new Map();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return sendJsonError(res, 400, 'VALIDATION_ERROR', 'username and password required');
  if (users.has(username)) return sendJsonError(res, 409, 'USER_EXISTS', 'User exists');
  const hash = await bcrypt.hash(password, 10);
  const user = { id: String(users.size + 1), username, password: hash };
  users.set(username, user);
  res.status(201).json({ id: user.id, username: user.username });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return sendJsonError(res, 400, 'VALIDATION_ERROR', 'username and password required');
  const user = users.get(username);
  if (!user) return sendJsonError(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return sendJsonError(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  let secret;
  try {
    secret = getJwtSecret();
  } catch (err) {
    return sendJsonError(res, 500, 'AUTH_CONFIGURATION_ERROR', 'Authentication is not configured');
  }
  const token = jwt.sign({ sub: user.id, username: user.username }, secret, { algorithm: 'HS256', expiresIn: '1h' });
  res.json({ token });
});

module.exports = router;
