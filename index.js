require('dotenv').config();
const express = require('express');
const logger = require('./logger');
const authRoutes = require('./routes/auth');
const { authenticate } = require('./middleware/auth');
const { perUserOrIPLimiter, getRateLimitMetrics } = require('./middleware/rateLimiter');
const { sendJsonError } = require('./middleware/jsonError');

const PORT = process.env.PORT || 3000;

function createApp() {
  const app = express();

  app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info('HTTP request completed', {
      event: 'http.request',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: req.ip
    });
  });
  next();
});

  app.use(express.json());

  app.get('/metrics', (req, res) => {
    res.json({ rateLimit: getRateLimitMetrics() });
  });

// Apply rate limiter globally (per-user if authenticated, otherwise by IP)
  app.use(perUserOrIPLimiter({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
    storeType: process.env.RATE_LIMIT_STORE || 'memory'
  }));

// Public routes
  app.use('/auth', authRoutes);

// Protected example route
  app.get('/profile', authenticate, (req, res) => {
    res.json({ message: 'Protected profile', user: req.user });
  });

// 429 and general error handling
  app.use((err, req, res, next) => {
  if (!err) return next();
  logger.error('Unhandled request error', {
    event: 'http.error',
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path
  });
  if (err.status === 429) return sendJsonError(res, 429, 'RATE_LIMIT_EXCEEDED', 'Too many requests');
  return sendJsonError(res, err.status || 500, 'INTERNAL_ERROR', 'Internal server error');
  });

  return app;
}

if (require.main === module) {
  createApp().listen(PORT, () => {
    logger.info('Server listening', { event: 'server.started', port: PORT });
  });
}

module.exports = { createApp };
