const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');

const redisUrl = process.env.REDIS_URL;
delete process.env.REDIS_URL;
const { perUserOrIPLimiter } = require('../middleware/rateLimiter');
if (redisUrl !== undefined) {
  process.env.REDIS_URL = redisUrl;
}

async function createServer(t) {
  const app = express();
  app.set('trust proxy', true);
  app.use((req, res, next) => {
    if (req.get('x-test-user')) {
      req.user = { sub: req.get('x-test-user') };
    }
    next();
  });
  app.use(perUserOrIPLimiter({ windowMs: 60_000, max: 1 }));
  app.get('/', (req, res) => res.status(200).json({ ip: req.ip }));

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  return server.address().port;
}

function request(port, { ip, user } = {}) {
  const headers = { 'x-forwarded-for': ip || '203.0.113.1' };
  if (user) {
    headers['x-test-user'] = user;
  }

  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: '/', headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        body: body ? JSON.parse(body) : undefined
      }));
    });
    req.on('error', reject);
  });
}

test('limits authenticated requests by user across IP addresses', async (t) => {
  const port = await createServer(t);

  assert.deepEqual(await request(port, { ip: '203.0.113.1', user: 'user-1' }), {
    statusCode: 200,
    body: { ip: '203.0.113.1' }
  });
  assert.deepEqual(await request(port, { ip: '203.0.113.2', user: 'user-1' }), {
    statusCode: 429,
    body: { error: 'Too many requests' }
  });
  assert.equal((await request(port, { ip: '203.0.113.1', user: 'user-2' })).statusCode, 200);
});

test('limits unauthenticated requests by IP', async (t) => {
  const port = await createServer(t);

  assert.equal((await request(port, { ip: '203.0.113.1' })).statusCode, 200);
  assert.deepEqual(await request(port, { ip: '203.0.113.1' }), {
    statusCode: 429,
    body: { error: 'Too many requests' }
  });
  assert.equal((await request(port, { ip: '203.0.113.2' })).statusCode, 200);
});
