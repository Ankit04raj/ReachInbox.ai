# ReachInbox — email job scheduler

Full-stack internship assignment, based on the original uploaded repository. Express + TypeScript, PostgreSQL/Prisma, BullMQ/Redis, React/Vite, Ethereal, Elasticsearch and Slack incoming webhooks. This revision has been statically reviewed, not live-verified; see `VALIDATION.md` before submitting.

## Local setup (Ubuntu, Node 22, Docker Compose v2)

From the repository root:

```bash
npm ci
cp apps/backend/.env.example apps/backend/.env
openssl rand -hex 32
# Paste the generated value as JWT_SECRET and configure the remaining settings.
docker compose up -d
# Wait until PostgreSQL, Redis and Elasticsearch are healthy.
npm --workspace apps/backend exec -- prisma generate
npm --workspace apps/backend exec -- prisma db push
npm run dev
```

Open http://localhost:3000. API: http://localhost:4000/api. Bull Board: http://localhost:4000/admin/queues (sign in first; ADMIN_EMAIL must match your Google email). Vite proxies both API and board. Use the same hostname, not a mixture of localhost and 127.0.0.1. Do not commit `.env`. `prisma db push` is intended for the local demo, not a managed production migration process; back up existing data before schema changes.

### Google OAuth

Create a Google Cloud OAuth web application, configure consent screen and add your test account if needed. Set the authorized redirect URI to `http://localhost:4000/api/auth/google/callback`. Fill GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, FRONTEND_URL and ADMIN_EMAIL. The server uses Passport and a short-lived OAuth state cookie, then an HTTP-only JWT cookie. The profile endpoint retrieves the real database user. Logout clears the cookie.

### Ethereal

Create two test accounts at https://ethereal.email/create. Copy their SMTP usernames/passwords into `ETHEREAL_ACCOUNTS_JSON` in `.env`, replacing all placeholders. SMTP is restricted by application configuration to Ethereal for this demo. Select a sender in Compose. Each signed-in user is provisioned with the configured demo accounts; these are test-only accounts, not a production multi-tenant credential vault. The sent table shows Ethereal preview links when provided by Nodemailer.

### Slack

Create a Slack app at https://api.slack.com/apps, enable incoming webhooks, and add `http://localhost:4000/api/slack/callback` under OAuth & Permissions redirect URLs. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET. Click Connect Slack after Google login; authorize the incoming-webhook scope and select a channel. The callback exchanges a real authorization code, checks a one-use Redis state bound to the logged-in user, and stores the channel webhook per user. Slack notification uses an HTTPS POST to the actual incoming webhook. Disconnect removes the local integration; it does not revoke the workspace's app installation. Reconnect via the dashboard without deploying. Use workspace permissions to revoke the old webhook if required. Webhook URLs and SMTP passwords are secrets; production needs encryption at rest/secret manager.

## Architecture

```text
React dashboard -> Express API -> PostgreSQL (durable email records)
                              -> BullMQ delayed queue (Redis AOF)
                                 -> concurrent worker -> Ethereal SMTP
                                 -> Redis Lua admission control
                                 -> Slack webhook on capacity hit
                              -> Elasticsearch search index
Admin -> authenticated Bull Board -> BullMQ queue
```

- Schedule API validates recipient addresses and sender ownership. It persists email rows transactionally, with a request-key/recipient unique hash. Repeated identical requests with the same key reuse the existing rows; changed payloads receive HTTP 409. Cancelled rows are retained to prevent replay. The frontend supplies the key. Send the same payload when retrying. Each email gets its own stable BullMQ job ID and initial delayed timestamp.
- Worker reads the database record, checks due time, acquires an atomic Redis admission slot, and uses a conditional database update to claim the row. Terminal statuses and in-flight claims are not sent again. On capacity denial it updates the next scheduled timestamp and moves the same BullMQ job to delayed state (no replacement job or cron).
- Redis server time defines fixed UTC hour windows. A single Lua script enforces per-SMTP-account attempt count (shared across tenants using the same account) and dispatch gap. Default concurrency is 5, gap 2,000 ms and hourly ceiling 100; env settings are upper/lower bounds. Compose supplies campaign limits; the worker uses the smaller campaign/sender/system cap and larger delay. Campaigns with different limits share a sender counter, so a higher-limit campaign can continue after a lower-limit one defers. Failed SMTP attempts consume capacity. The gap controls admission, not a guarantee of precise network arrival times. Fixed-hour limits can allow bursts across hour boundaries; the minimum gap still applies.
- The Redis volume stores delayed jobs; PostgreSQL is the recovery source. Startup reconciliation and a 30-second recovery loop restore missing queue entries and retry terminal queue entries for still-pending database records. This loop repairs enqueue failures, not email timing; BullMQ delayed jobs determine send times. Keep both Docker volumes on restart. Do not use `docker compose down -v` unless intentionally deleting demo data.
- SMTP cannot guarantee exactly-once delivery. If the process dies after claiming a row but before recording the SMTP result, that row is deliberately not automatically resent. A stale claim is marked UNCERTAIN after ten minutes; inspect Ethereal manually. This is a conservative duplicate-prevention policy and can sacrifice delivery in ambiguous crashes.
- Slack sends at capacity and deduplicates by tenant sender/hour using PostgreSQL; if not connected it skips the call. Notifications are recorded in PostgreSQL with a unique sender/hour ID and retry deadlines; failed webhook calls are retried by recovery. Slack has no exactly-once webhook guarantee. Search is tenant-filtered, with a database fallback when Elasticsearch errors; failed indexing is retried from PostgreSQL using the indexedAt marker. Search is eventually consistent.
- With 1,000+ jobs, workers admit only eligible attempts, defer excess jobs, and retain their database rows. Strict FIFO fairness is not guaranteed under concurrency. The demo uses bounded table/search result counts; production should add cursor pagination, batched outbox processing, distributed recovery leadership and metrics.

## API

All email, sender and Slack routes require authentication. Google OAuth is public. `POST /api/emails/schedule` requires `Idempotency-Key` and JSON `{subject, body, recipients, senderId, startTime, delayBetweenEmails, hourlyLimit}`. Use an ISO UTC start time; delay is milliseconds. `GET /api/senders`, `/api/emails/scheduled`, `/api/emails/sent`, `/api/emails/search?q=...`, `/api/emails/:id`; `DELETE /api/emails/:id` cancels only pending emails. `GET /api/slack/status`, `/api/slack/connect`, `/api/slack/callback`, `POST /api/slack/disconnect`; `GET /api/auth/me`, `POST /api/auth/logout`. `/health` reports process liveness; `/ready` checks PostgreSQL, Redis and Elasticsearch with a five-second deadline.

## Build and tests

```bash
npm run build
npm test  # Redis must be running
```

The backend serves the built frontend if present. For a single-origin local build set FRONTEND_URL=http://localhost:4000 in `.env`, then `npm run start:backend`. For a real HTTPS deployment, configure NODE_ENV=production, HTTPS callback URLs and origin, external Redis/Postgres/Elasticsearch URLs, and secure network/secret configuration. Dockerfile builds the monorepo; schema setup remains a separate step. Do not publish Redis, Postgres or unsecured Elasticsearch to the internet.

## Submission demo (max 5 minutes)

See `VALIDATION.md` for verification steps, including live Google/Slack, two senders, restart, idempotency, queue board, search and throttling. Record real evidence rather than simulated success. Figma URL was not included in the assignment text supplied with this revision; the frontend uses original project elements with a custom responsive stylesheet. Do not claim exact Figma fidelity until checked against the design.

## Release update
Railway now builds both applications using the root Dockerfile. Configure managed dependencies and apply the Prisma schema before deploying. The `/ready` endpoint is the deployment health check. Use HTTPS and matching public OAuth redirect URLs. The local demo remains at port 3000.

## Submission release: credential security and search recovery

Before starting, generate a separate persistent encryption key with `openssl rand -hex 32` and set `CREDENTIAL_ENCRYPTION_KEY` in `apps/backend/.env` (or the deployment environment). Do not commit it. Keep the same key across restarts and instances; losing it makes existing stored credentials unusable. Startup migrates legacy plaintext SMTP passwords and Slack webhooks to AES-256-GCM. Back up the database first; existing database backups may still contain plaintext. Rotate any credentials previously exposed. Do not run older versions against migrated credentials.

Run `node --test scripts/check-credentials.cjs` after `npm ci` to validate authenticated encryption. The Railway pre-deploy command applies the Prisma schema with `db push`; back up any existing database before deploying. This demo uses schema synchronization rather than a production migration history. Search includes partially matched recipient addresses and pending-index records; missing Elasticsearch indexes are recreated and queued for rebuilding. Search remains eventually consistent.
