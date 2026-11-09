const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const IORedis = require('ioredis');
const logger = require('../logger');
const { sendJsonError } = require('./jsonError');

const metrics = { requests: 0, limited: 0, storeErrors: 0 };
let redisClient;

function getStoreType(configuredType) {
  const storeType = configuredType || process.env.RATE_LIMIT_STORE || 'memory';
  if (storeType !== 'memory' && storeType !== 'redis') {
    throw new Error(`Unsupported rate limit store: ${storeType}`);
  }
  return storeType;
}

function createStore(storeType) {
  if (storeType === 'memory') return undefined;
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is required when RATE_LIMIT_STORE=redis');
  }

  redisClient = new IORedis(process.env.REDIS_URL);
  redisClient.on('error', (err) => {
    metrics.storeErrors += 1;
    logger.error('Redis error', { event: 'redis.error', error: err.message });
  });
  return new RedisStore({ sendCommand: (...args) => redisClient.call(...args) });
}

function buildLimiter({ windowMs, max, store: configuredStore, storeType } = {}) {
  const store = configuredStore || createStore(getStoreType(storeType));

  const limiter = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    keyGenerator: (req) => req.user && req.user.sub ? `user:${req.user.sub}` : req.ip,
    handler: (req, res) => {
      metrics.limited += 1;
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

  return (req, res, next) => {
    metrics.requests += 1;
    return limiter(req, res, next);
  };
}

// Middleware that chooses key based on authenticated user id or IP
function perUserOrIPLimiter(options) {
  return buildLimiter(options);
}

function getRateLimitMetrics() {
  return {
    ...metrics,
    store: getStoreType(),
    uptimeSeconds: Math.floor(process.uptime())
  };
}

function resetRateLimitMetrics() {
  metrics.requests = 0;
  metrics.limited = 0;
  metrics.storeErrors = 0;
}

module.exports = { perUserOrIPLimiter, getRateLimitMetrics, resetRateLimitMetrics };
