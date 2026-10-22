const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const logger = require('../logger');
const { authenticate } = require('../middleware/auth');

function createRequest(authorization) {
  return {
    headers: authorization ? { authorization } : {},
    method: 'GET',
    path: '/profile',
    ip: '203.0.113.10'
  };
}

function createResponse() {
  return {
    statusCode: 200,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function captureLogs(t) {
  const logs = [];
  const originalMethods = {
    info: logger.info,
    warn: logger.warn,
    error: logger.error
  };

  for (const level of Object.keys(originalMethods)) {
    logger[level] = (message, fields) => logs.push({ level, message, ...fields });
  }

  t.after(() => {
    Object.assign(logger, originalMethods);
  });

  return logs;
}

test('logs missing credentials as an authentication warning', (t) => {
  const logs = captureLogs(t);
  const res = createResponse();
  let nextCalled = false;

  authenticate(createRequest(), res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
  assert.deepEqual(logs, [{
    level: 'warn',
    message: 'Authentication rejected',
    event: 'auth.failure',
    reason: 'missing_credentials',
    method: 'GET',
    path: '/profile',
    ip: '203.0.113.10'
  }]);
});

test('logs invalid tokens without including the credential', (t) => {
  const logs = captureLogs(t);
  const token = 'not-a-valid-token';
  const res = createResponse();

  authenticate(createRequest(`Bearer ${token}`), res, () => {
    assert.fail('invalid token must not authenticate');
  });

  assert.equal(res.statusCode, 401);
  assert.equal(logs[0].level, 'warn');
  assert.equal(logs[0].event, 'auth.failure');
  assert.equal(logs[0].reason, 'JsonWebTokenError');
  assert.equal(JSON.stringify(logs).includes(token), false);
});

test('logs successful authentication with the user identifier', (t) => {
  const logs = captureLogs(t);
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'auth-test-secret';
  t.after(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  const token = jwt.sign({ sub: 'user-42' }, 'auth-test-secret');
  let nextCalled = false;

  authenticate(createRequest(`Bearer ${token}`), createResponse(), () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(logs, [{
    level: 'info',
    message: 'Authentication succeeded',
    event: 'auth.success',
    userId: 'user-42',
    method: 'GET',
    path: '/profile',
    ip: '203.0.113.10'
  }]);
});

test('logs unexpected middleware failures as errors and forwards them', (t) => {
  const logs = captureLogs(t);
  const originalVerify = jwt.verify;
  const error = new Error('verification subsystem failed');
  jwt.verify = () => {
    throw error;
  };

  t.after(() => {
    jwt.verify = originalVerify;
  });

  let forwardedError;
  authenticate(createRequest('Bearer token'), createResponse(), (err) => {
    forwardedError = err;
  });

  assert.equal(forwardedError, error);
  assert.equal(logs[0].level, 'error');
  assert.equal(logs[0].event, 'auth.error');
  assert.equal(logs[0].error, error.message);
});
