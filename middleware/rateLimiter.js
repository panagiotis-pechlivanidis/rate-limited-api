const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const IORedis = require('ioredis');
const logger = require('../logger');
const { sendJsonError } = require('./jsonError');

let redisClient;
if (process.env.REDIS_URL) {
  redisClient = new IORedis(process.env.REDIS_URL);
  redisClient.on('error', (err) => logger.error('Redis error', {
    event: 'redis.error',
    error: err.message
  }));
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
    keyGenerator: (req) => req.user && req.user.sub ? `user:${req.user.sub}` : req.ip,
    handler: (req, res) => {
      logger.warn('Request rate limit exceeded', {
        event: 'rate_limit.exceeded',
        method: req.method,
        path: req.path,
        userId: req.user && req.user.sub,
        ip: req.user && req.user.sub ? undefined : req.ip
      });
      sendJsonError(res, 429, 'RATE_LIMIT_EXCEEDED', 'Too many requests');
    }
  });
}

// Middleware that chooses key based on authenticated user id or IP
function perUserOrIPLimiter(options) {
  const limiter = buildLimiter(options);

  return limiter;
}

module.exports = { perUserOrIPLimiter };
