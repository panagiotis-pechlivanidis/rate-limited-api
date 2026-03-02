const jwt = require('jsonwebtoken');
const logger = require('../logger');

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'change_me');
    req.user = payload;
    next();
  } catch (err) {
    logger.warn('Invalid token', { err: err.message });
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authenticate };
