require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const logger = require('./logger');
const authRoutes = require('./routes/auth');
const { authenticate } = require('./middleware/auth');
const { perUserOrIPLimiter } = require('./middleware/rateLimiter');

const app = express();

const PORT = process.env.PORT || 3000;

// Logging: morgan -> winston
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

app.use(express.json());

// Apply rate limiter globally (per-user if authenticated, otherwise by IP)
app.use(perUserOrIPLimiter({ windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000, max: Number(process.env.RATE_LIMIT_MAX) || 100 }));

// Public routes
app.use('/auth', authRoutes);

// Protected example route
app.get('/profile', authenticate, (req, res) => {
  res.json({ message: 'Protected profile', user: req.user });
});

// 429 and general error handling
app.use((err, req, res, next) => {
  if (!err) return next();
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  if (err.status === 429) return res.status(429).json({ error: 'Too many requests' });
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});
