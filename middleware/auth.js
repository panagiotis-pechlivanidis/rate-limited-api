const jwt = require('jsonwebtoken');
const logger = require('../logger');

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    logger.warn('Authentication rejected', {
      event: 'auth.failure',
      reason: auth ? 'invalid_authorization_scheme' : 'missing_credentials',
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = auth.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || 'change_me');
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      logger.warn('Authentication rejected', {
        event: 'auth.failure',
        reason: err.name,
        method: req.method,
        path: req.path,
        ip: req.ip
      });
      return res.status(401).json({ error: 'Invalid token' });
    }

    logger.error('Authentication middleware failed', {
      event: 'auth.error',
      error: err.message,
      stack: err.stack,
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    return next(err);
  }

  req.user = payload;
  logger.info('Authentication succeeded', {
    event: 'auth.success',
    userId: payload && payload.sub,
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  next();
}

module.exports = { authenticate };
