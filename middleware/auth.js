const jwt = require('jsonwebtoken');
const logger = require('../logger');
const { sendJsonError } = require('./jsonError');

const JWT_ALGORITHM = 'HS256';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'change_me') {
    throw new Error('JWT_SECRET must be configured with a non-default value');
  }
  return secret;
}

function reject(req, res, reason, code, message) {
  logger.warn('Authentication rejected', {
    event: 'auth.failure',
    reason,
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  return sendJsonError(res, 401, code, message);
}

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    return reject(req, res, 'missing_credentials', 'AUTH_REQUIRED', 'Authentication required');
  }
  if (!/^Bearer\s+\S+$/.test(auth)) {
    return reject(req, res, 'invalid_authorization_scheme', 'AUTH_REQUIRED', 'Authentication required');
  }

  const token = auth.slice(7).trim();
  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return reject(req, res, 'TokenExpiredError', 'TOKEN_EXPIRED', 'Token expired');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return reject(req, res, err.name, 'TOKEN_INVALID', 'Invalid token');
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

  if (!payload || typeof payload !== 'object' || typeof payload.sub !== 'string' || !payload.sub.trim()) {
    return reject(req, res, 'invalid_claims', 'TOKEN_INVALID', 'Invalid token');
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

module.exports = { authenticate, getJwtSecret };
