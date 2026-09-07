# ReachInbox Email Scheduler

A persistent, restart-safe email scheduling backend built with **Node.js, Express, PostgreSQL, Redis, BullMQ, Nodemailer, and Slack OAuth**.

The system accepts scheduled email requests through an API, stores email state in PostgreSQL, schedules delivery through BullMQ delayed jobs, applies distributed rate limiting and send-spacing through Redis, and sends emails through Ethereal SMTP.

---

## Features

### Backend

* Email scheduling through REST API
* PostgreSQL persistence
* BullMQ delayed jobs
* Persistent Redis queue
* Restart-safe email recovery
* Idempotency keys to prevent duplicate scheduling
* Configurable worker concurrency
* Minimum delay between email sends
* Per-sender hourly rate limiting
* Redis-backed distributed rate limiting
* Automatic rescheduling when an hourly limit is reached
* Slack OAuth integration
* Slack rate-limit notifications
* Slack connect/disconnect/reconnect support
* BullMQ dashboard using Bull Board
* Ethereal Email SMTP integration
* Graceful worker/API shutdown

### Frontend

> **Frontend documentation will be added here.**

Planned/implemented frontend areas include:

* Login/authentication
* Dashboard
* Scheduled email table
* Sent email table
* Email compose/scheduling interface
* Sender management
* Slack connection UI
* Queue/status visibility

---

# Architecture

```text
                    ┌──────────────────┐
                    │     Frontend     │
                    └────────┬─────────┘
                             │ REST API
                             ▼
                    ┌──────────────────┐
                    │ Express Backend  │
                    └───────┬──────────┘
                            │
              ┌─────────────┼──────────────┐
              │             │              │
              ▼             ▼              ▼
        ┌──────────┐  ┌───────────┐  ┌────────────┐
        │PostgreSQL│  │   Redis   │  │ Slack OAuth│
        │  State   │  │ BullMQ    │  │ / API     │
        └──────────┘  └─────┬─────┘  └────────────┘
                            │
                     Delayed Jobs
                            │
                            ▼
                    ┌──────────────────┐
                    │   BullMQ Worker  │
                    └────────┬─────────┘
                             │
                    Rate limit + delay
                             │
                             ▼
                    ┌──────────────────┐
                    │ Ethereal SMTP    │
                    └──────────────────┘
```

---

# Tech Stack

| Component            | Technology              |
| -------------------- | ----------------------- |
| API                  | Node.js + Express       |
| Language             | TypeScript              |
| Database             | PostgreSQL              |
| Queue                | BullMQ                  |
| Queue Storage        | Redis                   |
| Email                | Nodemailer + Ethereal   |
| Queue Dashboard      | Bull Board              |
| Notifications        | Slack Web API           |
| Slack Authentication | Slack OAuth 2.0         |
| Development Tunnel   | Cloudflare Quick Tunnel |

---

# Prerequisites

Install:

* Node.js
* npm
* Docker
* Docker Compose
* `cloudflared` for the Slack OAuth development tunnel

---

# Backend Setup

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Create a `.env` file:

```env
PORT=3000

DATABASE_URL=postgres://scheduler:scheduler@localhost:5432/scheduler

REDIS_URL=redis://localhost:6379

FRONTEND_ORIGIN=http://localhost:5173

WORKER_CONCURRENCY=5

MIN_SEND_DELAY_MS=2000

MAX_EMAILS_PER_HOUR_PER_SENDER=200

SEND_LEASE_MS=60000

ADMIN_KEY=replace-with-a-long-random-value

ETHEREAL_USER=
ETHEREAL_PASS=

SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=
```

The important scheduler configuration is:

```env
WORKER_CONCURRENCY=5
MIN_SEND_DELAY_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
SEND_LEASE_MS=60000
```

These values are configurable and are not hardcoded into the worker.

---

# Start PostgreSQL and Redis

The project uses Docker Compose for PostgreSQL and Redis.

```bash
docker compose up -d
```

Check that both services are running:

```bash
docker compose ps
```

The current Compose configuration uses:

```text
PostgreSQL
Host: localhost
Port: 5432
Database: scheduler
User: scheduler
Password: scheduler

Redis
Host: localhost
Port: 6379
```

The PostgreSQL and Redis data directories are persisted using Docker volumes.

---

# Run the Backend API

During development:

```bash
npm run dev:api
```

The API runs on:

```text
http://localhost:3000
```

Health check:

```bash
curl http://localhost:3000/api/health
```

---

# Run the BullMQ Worker

In another terminal:

```bash
npm run dev:worker
```

The worker reads delayed jobs from the `email-send` BullMQ queue.

The worker concurrency is controlled by:

```env
WORKER_CONCURRENCY=5
```

For example:

```env
WORKER_CONCURRENCY=10
```

will allow up to 10 jobs to be processed concurrently by that worker instance.

---

# Build and Run in Production Mode

Build the TypeScript project:

```bash
npm run build
```

Start the API:

```bash
npm run start:api
```

Start the worker separately:

```bash
npm run start:worker
```

The API and worker are intentionally separate processes so that they can be scaled independently.

---

# Ethereal Email Setup

Ethereal is used as the SMTP provider for development/testing.

It allows the application to behave like a real email system without sending test emails to real users.

The project supports two modes.

## Option 1: Use an existing Ethereal account

Set:

```env
ETHEREAL_USER=your-ethereal-user
ETHEREAL_PASS=your-ethereal-password
```

The application will use these credentials for SMTP.

## Option 2: Automatically create a test account

If `ETHEREAL_USER` and `ETHEREAL_PASS` are empty, the application creates a Nodemailer test account automatically.

The worker prints the generated Ethereal account and inbox URL in the terminal.

Example:

```text
Generated Ethereal account: ...
Ethereal inbox: ...
```

The preview URL returned by Ethereal is also stored with the email after sending.

---

# Creating a Sender

Before scheduling an email, create a sender.

Example:

```bash
curl -X POST http://localhost:3000/api/senders \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: demo" \
  -d '{
    "id":"sender-demo",
    "name":"Abraham Hackett",
    "email":"abraham.hackett@ethereal.email"
  }'
```

The sender ID is then used when creating scheduled emails:

```text
senderId: sender-demo
```

---

# Scheduling an Email

Example:

```bash
curl -X POST http://localhost:3000/api/emails \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: demo" \
  -H "Idempotency-Key: scheduling-demo-1" \
  -d '{
    "senderId":"sender-demo",
    "toEmail":"test@example.com",
    "subject":"Restart-safe demo",
    "textBody":"This email is stored durably.",
    "scheduledAt":"2026-12-01T10:00:00.000Z"
  }'
```

The API:

1. Validates the request.
2. Verifies that the sender belongs to the tenant.
3. Stores the email in PostgreSQL.
4. Creates a BullMQ delayed job.
5. Returns the persisted email record.

The delay is calculated from the requested `scheduledAt` timestamp.

---

# Scheduling Architecture

Email scheduling does **not** use cron.

There are no OS cron jobs or Node cron libraries.

Instead, BullMQ delayed jobs are used.

When an email is scheduled:

```text
scheduledAt
     ↓
Calculate delay
     ↓
PostgreSQL stores email
     ↓
BullMQ delayed job
     ↓
Job becomes available at scheduledAt
     ↓
Worker processes email
```

The BullMQ job uses the email ID as its job identifier:

```text
email-{emailId}
```

This allows the queue to identify the job associated with a particular email.

---

# Persistence and Restart Recovery

Email state is stored in PostgreSQL rather than only in memory.

Important email states include:

```text
scheduled
queued
processing
sending
rate_limited
sent
failed
uncertain
```

Redis is also configured with AOF persistence:

```text
appendonly yes
appendfsync everysec
```

On backend startup, the application looks for non-final email records:

```text
scheduled
queued
processing
sending
rate_limited
```

and re-enqueues them into BullMQ.

This means that a future email does not depend on the API process remaining alive continuously.

### Restart flow

```text
PostgreSQL
    │
    │ email still non-final
    ▼
Application starts
    │
    ▼
Recovery process
    │
    ▼
BullMQ delayed job recreated
    │
    ▼
Worker
    │
    ▼
Ethereal SMTP
```

---

# Idempotency

Every email scheduling request requires an:

```text
Idempotency-Key
```

PostgreSQL enforces uniqueness using:

```text
(tenant_id, idempotency_key)
```

This prevents the same tenant from creating multiple email records for the same idempotency key.

Example:

```bash
-H "Idempotency-Key: scheduling-demo-1"
```

If the same request is submitted again with the same key, the existing database record is reused rather than creating another email record.

---

# Worker Concurrency

Worker concurrency is configurable:

```env
WORKER_CONCURRENCY=5
```

BullMQ controls how many jobs a worker can process concurrently.

Multiple worker instances can also run against the same Redis queue.

Email state is protected using PostgreSQL transactions and row-level locking when a worker claims an email.

This prevents two workers from simultaneously claiming the same email.

---

# Minimum Delay Between Sends

The project uses a configurable minimum send delay:

```env
MIN_SEND_DELAY_MS=2000
```

The default is therefore:

```text
2 seconds between sends from the same sender
```

The spacing mechanism is Redis-backed rather than an in-memory timer.

This is important because multiple workers or worker instances need to coordinate with each other.

The reservation is performed atomically using a Redis Lua script.

---

# Hourly Rate Limiting

The scheduler implements a **per-sender hourly email limit**.

Default:

```env
MAX_EMAILS_PER_HOUR_PER_SENDER=200
```

The value can be changed through environment configuration.

Example:

```env
MAX_EMAILS_PER_HOUR_PER_SENDER=100
```

The rate-limit counter is stored in Redis using a key containing:

```text
sender ID + current hour window
```

This makes the rate limiter safe across multiple workers and worker instances.

The counter is incremented atomically using Redis.

---

# What Happens When the Rate Limit Is Reached?

Jobs are **not dropped**.

When a sender reaches the hourly limit:

```text
Worker
  ↓
Redis rate-limit reservation
  ↓
Limit reached
  ↓
Email status = rate_limited
  ↓
Calculate next available time
  ↓
BullMQ delayed job
  ↓
Next hour
  ↓
Worker retries the email
```

The email remains persisted in PostgreSQL throughout this process.

The worker also attempts to send a Slack notification when the sender first reaches the hourly limit.

---

# Slack Integration

Slack notifications are implemented using a real Slack OAuth flow.

The Slack integration is tenant-specific.

The basic flow is:

```text
Connect Slack
      ↓
Slack OAuth
      ↓
OAuth callback
      ↓
Access token stored in PostgreSQL
      ↓
Select Slack channel
      ↓
Rate limit reached
      ↓
Slack chat.postMessage()
```

---

## 1. Create a Slack App

For local development:

1. Create a Slack app.
2. Create it from scratch / as a blank app.
3. Select the Slack workspace where you want to test the integration.
4. Open the app's **OAuth & Permissions** section.
5. Add the OAuth redirect URL.

The redirect URL must exactly match the value configured in:

```env
SLACK_REDIRECT_URI=
```

For example, when using the Cloudflare Quick Tunnel:

```env
SLACK_REDIRECT_URI=https://YOUR-TUNNEL.trycloudflare.com/api/slack/callback
```

---

## 2. Get the Slack Client ID and Secret

From the Slack app configuration, copy:

```text
Client ID
Client Secret
```

and put them in:

```env
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
```

Restart the API after changing `.env`.

---

# Cloudflare Tunnel for Slack OAuth

Slack needs to be able to redirect the OAuth callback to the development server.

Because the Express server is running locally, a Cloudflare Quick Tunnel is used to expose port 3000 publicly.

Start:

```bash
cloudflared tunnel --url http://localhost:3000
```

Cloudflare will provide a temporary URL similar to:

```text
https://example-name.trycloudflare.com
```

The Slack callback URL becomes:

```text
https://example-name.trycloudflare.com/api/slack/callback
```

This exact URL must be configured both:

### In `.env`

```env
SLACK_REDIRECT_URI=https://example-name.trycloudflare.com/api/slack/callback
```

### In the Slack App

Under:

```text
OAuth & Permissions → Redirect URLs
```

The two values must match exactly.

> **Development note:** Cloudflare Quick Tunnel URLs are temporary. If the tunnel is restarted and a new URL is generated, the Slack redirect URL must be updated accordingly.

---

# Connect Slack Through the API

Once the API and tunnel are running, start the OAuth flow:

```bash
curl -i \
  -H "X-Tenant-Id: demo" \
  https://YOUR-TUNNEL.trycloudflare.com/api/slack/connect
```

The API returns a redirect response containing a:

```text
Location:
```

header.

Open the URL from the `Location` header in a browser.

Slack will ask for authorization.

After authorization, Slack redirects to:

```text
/api/slack/callback
```

The backend validates the OAuth state, exchanges the authorization code for a Slack access token, and stores the installation in PostgreSQL.

---

# Check Slack Connection

```bash
curl http://localhost:3000/api/slack/status \
  -H "X-Tenant-Id: demo"
```

Example:

```json
{
  "connected": true,
  "installation": {
    "team_id": "...",
    "team_name": "...",
    "channel_id": null,
    "connected_at": "..."
  }
}
```

---

# Select a Slack Channel

After Slack is connected, select the channel where rate-limit notifications should be sent.

First obtain the Slack channel ID.

Then:

```bash
curl -X PUT http://localhost:3000/api/slack/channel \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: demo" \
  -d '{"channelId":"your Slack channel ID"}'
```

Example:

```bash
curl -X PUT http://localhost:3000/api/slack/channel \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: demo" \
  -d '{"channelId":"C0BVCUZFFDZ"}'
```

After this, the backend knows which Slack channel should receive rate-limit alerts.

---

# Slack Rate-Limit Notification

When the sender reaches the configured hourly limit, the worker calls Slack's API:

```text
chat.postMessage
```

The message contains information about the sender and the configured limit.

Example:

```text
Email rate limit reached for sender@example.com:
200 emails per hour. Remaining jobs were delayed.
```

If Slack has not been connected, the email scheduler continues working normally and simply does not send the notification.

Slack notification failures are also prevented from permanently failing the email job.

---

# Disconnect Slack

```bash
curl -X DELETE http://localhost:3000/api/slack/disconnect \
  -H "X-Tenant-Id: demo"
```

The stored Slack installation is removed after the Slack token is revoked.

Slack can subsequently be connected again without redeploying the application.

---

# BullMQ Dashboard

The project exposes a live BullMQ dashboard using Bull Board.

Start the API and open:

```text
http://localhost:3000/admin/queues
```

The dashboard is protected with HTTP Basic Authentication.

The credentials are:

```text
Username: admin
Password: value of ADMIN_KEY
```

For example:

```env
ADMIN_KEY=my-development-key
```

Then use:

```text
Username: admin
Password: my-development-key
```

The dashboard can be used to inspect queued, delayed, active, completed, and failed BullMQ jobs.

---

# API Endpoints

## Health

```http
GET /api/health
```

## Create Sender

```http
POST /api/senders
```

## Schedule Email

```http
POST /api/emails
```

Required header:

```text
X-Tenant-Id
Idempotency-Key
```

## List Emails

```http
GET /api/emails
```

Optional:

```text
?status=sent
?status=scheduled
```

## Slack

```http
GET    /api/slack/connect
GET    /api/slack/callback
GET    /api/slack/status
PUT    /api/slack/channel
DELETE /api/slack/disconnect
```

## BullMQ Dashboard

```text
GET /admin/queues
```

---

# Handling Large Volumes

The system is designed so that scheduling 1000+ emails for approximately the same time does not require 1000 concurrent SMTP connections.

For example:

```text
1000 scheduled emails
        ↓
1000 PostgreSQL records
        ↓
1000 BullMQ delayed jobs
        ↓
Workers process jobs with configured concurrency
        ↓
Redis coordinates:
  - hourly limits
  - minimum send spacing
        ↓
Emails are progressively sent
```

If the hourly limit is reached, remaining emails are delayed until the next available hourly window rather than being dropped.

The same architecture can be scaled by running additional BullMQ worker instances against the shared Redis queue.

---

# Demo Flow

The short demo video should demonstrate the following.

### 1. Start infrastructure

```bash
docker compose up -d
```

### 2. Start API

```bash
npm run dev:api
```

### 3. Start worker

```bash
npm run dev:worker
```

### 4. Create/schedule emails

Use the frontend or API/Postman.

Show the returned email records and their scheduled status.

### 5. BullMQ Dashboard

Open:

```text
http://localhost:3000/admin/queues
```

Show the delayed/scheduled jobs.

### 6. Show sent emails

After the scheduled time, show the email changing to:

```text
sent
```

and show the Ethereal preview/inbox.

### 7. Restart scenario

Schedule an email for a future time.

Stop the API/worker.

Start them again:

```bash
npm run dev:api
npm run dev:worker
```

The startup recovery process should rediscover non-final email records and re-enqueue them.

Show that the future email is still sent at the scheduled time.

### 8. Optional rate-limit demonstration

Temporarily configure a small limit:

```env
MAX_EMAILS_PER_HOUR_PER_SENDER=2
```

and a short send delay:

```env
MIN_SEND_DELAY_MS=2000
```

Schedule several emails for the same sender.

Show:

* emails being processed according to concurrency
* minimum spacing between sends
* rate-limited emails being delayed
* Slack notification being sent when the hourly limit is reached

After the demonstration, restore the normal configuration.

---

# Assumptions, Shortcuts & Trade-offs

## Ethereal instead of a production provider

Ethereal is used because this project is a scheduling-system demonstration.

It provides a realistic SMTP integration and preview URLs without sending actual production emails.

A production implementation would replace Ethereal with a production email provider.

## Cloudflare Quick Tunnel

A Cloudflare Quick Tunnel is used to expose the local Express server for Slack OAuth during development.

This avoids deploying the backend solely to obtain a publicly reachable OAuth callback.

Quick Tunnel URLs are temporary, so the Slack redirect URL must be updated if the tunnel URL changes.

A production deployment should use a stable HTTPS hostname or a named Cloudflare Tunnel.

## Redis-backed rate limiting

Rate limiting is implemented using Redis rather than process-local memory.

This allows multiple worker instances to coordinate on the same sender's hourly limit and send-spacing rules.

The rate-limit reservation uses an atomic Redis Lua script to avoid race conditions between workers.

## Per-sender limits

The current implementation uses a per-sender hourly limit:

```env
MAX_EMAILS_PER_HOUR_PER_SENDER=200
```

This provides better isolation between senders than a single global counter.

## Restart recovery

PostgreSQL is treated as the durable source of email state, while BullMQ/Redis is responsible for scheduling execution.

On startup, non-final email records are recovered and re-enqueued.

## SMTP uncertainty

There is an unavoidable distributed-systems edge case when an SMTP provider accepts a message but the worker crashes before PostgreSQL is updated.

To avoid blindly resending an email that may already have been delivered, the implementation uses an:

```text
uncertain
```

state for emails whose SMTP outcome cannot be determined after a worker interruption.

This trades guaranteed retry for protection against accidental duplicate sends.

## No cron

No cron-based scheduling is used.

All scheduling is handled through BullMQ delayed jobs and startup recovery.

---

# Project Structure

```text
.
├── compose.yaml
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── src/
    ├── config.ts
    ├── db.ts
    ├── mailer.ts
    ├── queue.ts
    ├── rate-limit.ts
    ├── server.ts
    ├── slack.ts
    └── worker.ts
```

---

# Current Backend Implementation Status

| Requirement                        | Status                  |
| ---------------------------------- | ----------------------- |
| REST email scheduling              | ✅                       |
| PostgreSQL persistence             | ✅                       |
| BullMQ delayed scheduling          | ✅                       |
| No cron                            | ✅                       |
| Ethereal SMTP                      | ✅                       |
| Multiple senders                   | ✅                       |
| Restart recovery                   | ✅                       |
| Idempotency                        | ✅                       |
| Configurable worker concurrency    | ✅                       |
| Minimum send delay                 | ✅                       |
| Redis-backed hourly rate limiting  | ✅                       |
| Rate-limit rescheduling            | ✅                       |
| Slack OAuth                        | ✅                       |
| Slack channel selection            | ✅                       |
| Live Slack rate-limit notification | ✅                       |
| Slack disconnect/reconnect         | ✅                       |
| BullMQ dashboard                   | ✅                       |
| Elasticsearch indexing/search      | **Not yet implemented** |
| Frontend documentation             | **To be added**         |

---

# Future Improvements

* Elasticsearch indexing and full-text email search
* Production authentication/authorization
* Stable production Slack OAuth callback
* Production email provider
* Metrics and observability
* More granular retry policies
* Dead-letter queue handling
* Automated integration/load tests
* Frontend documentation and deployment instructions
