# Rate-Limited REST API (Express)

Features:
- User registration & login (JWT)
- Rate limiting per user or IP
- 429 handling
- Structured JSON logging with winston, including authentication outcomes and rate-limit events
- Configurable memory or Redis-backed rate limiter
- JSON rate-limit metrics at `/metrics`

Quick start

1. Install dependencies

```bash
npm install
```

2. Copy `.env.example` to `.env` and adjust values.

3. Run

```bash
npm start
```

Run tests

```bash
npm test
```

Endpoints
- POST `/auth/register` { username, password }
- POST `/auth/login` { username, password } -> { token }
- GET `/profile` (Authorization: Bearer <token>) protected

Notes
- This project uses an in-memory user store for demo purposes. Replace with a database for production.
- The rate limiter uses memory by default. Set `RATE_LIMIT_STORE=redis` and `REDIS_URL` to enable Redis-backed rate limiting.
- `/metrics` exposes rate-limit request, rejection, and store-error counters.
- Set `LOG_LEVEL` to configure the minimum log level (defaults to `info`). Authentication failures and rate limits are logged as warnings; unexpected middleware and Redis errors are logged as errors. Credentials and tokens are not included in logs.
