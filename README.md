# ReachInbox Email Scheduler

A production-grade email scheduler service with dashboard built as part of the ReachInbox Software Development Intern Assignment.

## 🚀 Project Overview

This application provides a complete email scheduling and automation platform with:
- **Backend**: Express.js, BullMQ (Redis), PostgreSQL, Elasticsearch, Slack OAuth
- **Frontend**: React, Tailwind CSS, Google OAuth
- **Infrastructure**: Docker Compose for Redis, PostgreSQL, Elasticsearch

## 📋 Features Implemented

### Backend Features
- ✅ Email scheduling via API (`POST /api/emails/schedule`)
- ✅ BullMQ delayed jobs for scheduling (no cron jobs)
- ✅ Redis-backed queue persistence
- ✅ PostgreSQL for email storage
- ✅ Elasticsearch for email search
- ✅ Worker with configurable concurrency
- ✅ Rate limiting per sender (hourly quota)
- ✅ Slack notification on rate limit hit
- ✅ Google OAuth 2.0 authentication
- ✅ Ethereal Email SMTP integration
- ✅ Bull Board for queue monitoring
- ✅ Graceful worker shutdown
- ✅ Idempotency (no duplicate sends)

### Frontend Features
- ✅ Google OAuth login
- ✅ User avatar/name display
- ✅ Dashboard with stats
- ✅ Scheduled emails table
- ✅ Sent emails table
- ✅ Compose email modal
- ✅ CSV/TXT file upload
- ✅ Email validation
- ✅ Status badges

## 🏗 Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend       │────▶│   Database      │
│   (React)       │     │   (Express)     │     │   (PostgreSQL)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │   Redis         │
                        │   (BullMQ)      │
                        └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │   Elasticsearch │
                        │   (Search)      │
                        └─────────────────┘
```

### Scheduling Flow

1. Client POSTs to `/api/emails/schedule` with email data
2. Backend creates Email records in PostgreSQL
3. Backend schedules BullMQ delayed jobs for each email
4. Worker picks up jobs when scheduled time arrives
5. Worker checks rate limits before sending
6. Worker sends via Ethereal SMTP
7. Worker updates database with status

### Rate Limiting

- Uses Redis counters per sender/hour
- Configurable via `MAX_EMAILS_PER_HOUR_PER_SENDER` environment variable
- When limit reached, jobs are DEFERRED and rescheduled for next hour
- Slack notification sent on rate limit hit

### Persistence

- BullMQ queue persists to Redis - survives restarts
- Email data persists to PostgreSQL
- Elasticsearch indexed for search capabilities
- On restart, worker resumes processing from where it left off

## 🛠 Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm

## 🚀 Quick Start

### 1. Start Infrastructure

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Elasticsearch (port 9200)

### 2. Set Environment Variables

```bash
# Copy example file
cp .env.example .env

# Edit .env with your credentials
# Required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET
# Optional: SLACK_CLIENT_ID, SLACK_CLIENT_SECRET
```

### 3. Run Backend

```bash
cd apps/backend
npm install
npm run dev
```

The backend runs on `http://localhost:4000`

### 4. Run Frontend

```bash
cd apps/frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000`

### 5. Access Dashboard

Open `http://localhost:3000` and sign in with Google.

## 📦 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/auth/google | Google OAuth login |
| GET | /api/auth/google/callback | OAuth callback |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/logout | Logout |
| POST | /api/emails/schedule | Schedule emails |
| GET | /api/emails/scheduled | Get scheduled emails |
| GET | /api/emails/sent | Get sent emails |
| GET | /api/emails/:id | Get email by ID |
| GET | /api/emails/search?q=term | Search emails |
| DELETE | /api/emails/:id | Delete email |
| GET | /admin/queues | Bull Board dashboard |

## 🔧 Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/reachinbox

# Redis
REDIS_URL=redis://localhost:6379

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# Google OAuth
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret

# Rate Limiting
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=100

# JWT
JWT_SECRET=your_jwt_secret
```

### Docker Services

```yaml
# docker-compose.yml services
postgres: port 5432
redis: port 6379
elasticsearch: port 9200
```

## 📊 BullMQ Persistence

Jobs are stored in Redis with:
- `email-queue:delayed` - Pending delayed jobs
- `email-queue:wait` - Ready-to-process jobs
- `email-queue:active` - Currently processing jobs
- `email-queue:completed` - Successfully processed
- `email-queue:failed` - Failed jobs

On server restart, the queue automatically resumes processing.

## ⚙️ Worker Configuration

```env
WORKER_CONCURRENCY=5          # Parallel job processing
MIN_EMAIL_DELAY_MS=2000       # Minimum 2 seconds between sends
MAX_EMAILS_PER_HOUR=100       # Rate limit per sender
```

## 🧪 Testing

```bash
# Run backend tests
cd apps/backend
npm run test

# Build frontend
cd apps/frontend
npm run build
```

## 📝 Known Limitations & Trade-offs

1. **Ethereal Email**: Credentials are ephemeral - recreate after restart
2. **Database**: PostgreSQL required (no SQLite option)
3. **Rate Limiting**: Simple hourly window (not sliding)
4. **Slack**: Requires manual OAuth setup
5. **Multi-tenancy**: Single tenant (future: per-user senders)

## 🎬 Demo Video Instructions

1. Show Google login flow
2. Compose email with multiple recipients
3. Verify scheduled emails appear in table
4. Stop backend → Verify emails still scheduled
5. Start backend → Verify pending emails process
6. Show Bull Board monitoring
7. Demonstrate rate limiting behavior

## 📁 Project Structure

```
reachinbox-scheduler/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/       # Configuration files
│   │   │   ├── controllers/  # API controllers
│   │   │   ├── routes/       # API routes
│   │   │   ├── services/     # Business logic
│   │   │   ├── queues/       # BullMQ queue setup
│   │   │   ├── workers/      # BullMQ workers
│   │   │   ├── integrations/ # Third-party integrations
│   │   │   ├── middleware/   # Express middleware
│   │   │   ├── utils/        # Utilities
│   │   │   └── server.ts     # Main entry
│   │   ├── prisma/
│   │   └── package.json
│   └── frontend/
│       ├── src/
│       │   ├── components/   # Reusable components
│       │   ├── pages/        # Page components
│       │   ├── hooks/        # Custom hooks
│       │   ├── services/     # API services
│       │   ├── types/        # TypeScript types
│       │   └── App.tsx       # Main app
│       └── package.json
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```

## 🤝 Contributing

This is a demo project for the ReachInbox internship assignment.

## 📄 License

Internal use only - ReachInbox Labs