const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const IORedis = require('ioredis');
const logger = require('../logger');

let redisClient;
if (process.env.REDIS_URL) {
  redisClient = new IORedis(process.env.REDIS_URL);
  redisClient.on('error', (err) => logger.error('Redis error', { err: err.message }));
}

function buildLimiter({ windowMs, max }) {
  const store = redisClient
    ? new RedisStore({ sendCommand: (...args) => redisClient.call(...args) })
    : undefined;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    handler: (req, res) => {
      res.status(429).json({ error: 'Too many requests' });
    }
  });
}

// Middleware that chooses key based on authenticated user id or IP
function perUserOrIPLimiter(options) {
  const limiter = buildLimiter(options);

  return (req, res, next) => {
    // express-rate-limit uses req.ip by default; to rate limit per-user,
    // set req.ip to the user id when authenticated, then restore.
    const originalIp = req.ip;
    if (req.user && req.user.sub) {
      req.ip = `user:${req.user.sub}`;
    }
    limiter(req, res, (err) => {
      req.ip = originalIp;
      next(err);
    });
  };
}

module.exports = { perUserOrIPLimiter };
