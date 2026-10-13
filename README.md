# Rate-Limited REST API (Express)

Features:
- User registration & login (JWT)
- Rate limiting per user or IP
- 429 handling
- Logging with winston + morgan
- Optional Redis-backed rate limiter (set `REDIS_URL`)

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
- To enable Redis-backed rate limiting, set `REDIS_URL` in `.env`.
