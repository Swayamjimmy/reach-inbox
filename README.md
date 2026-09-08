```markdown
# ReachInbox Email Scheduler

A full-stack, distributed email scheduling and automation platform. Built to handle delayed sending, rate limiting, and reliable delivery using Express.js, PostgreSQL, Redis (BullMQ), Elasticsearch, and React.

---

## 🏗 Architecture Overview

The system is designed around a decoupled architecture where the API handles ingestion and the background worker handles execution, ensuring the API remains fast and responsive.

*   **How Scheduling Works:** 
    1. A user schedules an email via the React frontend.
    2. The Express API saves the email to **PostgreSQL** with a `scheduled` status.
    3. The API calculates the time difference between now and the target send time, and enqueues a job in **BullMQ (Redis)** with that exact `delay`.
    4. Once the delay expires, the BullMQ worker picks up the job, locks the row in PostgreSQL, checks rate limits, dispatches the email via SMTP, updates the status to `sent`, and pushes the document to Elasticsearch for fast searching.
*   **How Persistence on Restart is Handled:**
    PostgreSQL is the strict source of truth; Redis queues are treated as ephemeral. When the backend starts up, a recovery script (`recoverNonFinalEmails`) runs. It queries PostgreSQL for any emails in `processing`, `queued`, or `sending` states (indicating the server crashed or restarted mid-job). It forcefully re-enqueues these orphaned emails back into BullMQ, ensuring zero dropped emails.
*   **How Rate Limiting & Concurrency are Implemented:**
    *   *Concurrency:* Controlled dynamically via a configuration flag in the BullMQ worker, allowing the system to process `N` emails simultaneously based on server resources.
    *   *Rate Limiting:* Before sending an email, the worker checks a Redis-backed sliding window counter specific to the sender's email address. If the sender exceeds their limit (e.g., 200 emails/hour), the worker calculates exactly when the rate limit window will open again, throws a `DelayedError`, and BullMQ automatically sleeps the job until that exact timestamp.

---

## ✨ Features Implemented

### Backend
*   **Scheduler:** Precision time-based task execution using BullMQ's delayed jobs.
*   **Persistence:** Rock-solid crash recovery and transactional database locks via PostgreSQL.
*   **Rate Limiting:** Provider-safe sending logic using Redis sliding windows to prevent IP bans.
*   **Concurrency:** Scalable, multi-threaded background job processing.
*   **Search Engine:** Elasticsearch integration for fast, full-text search across millions of emails.
*   **Slack Alerts:** Automated Slack notifications when rate limits are hit.

### Frontend
*   **Login:** Secure Google OAuth 2.0 single sign-on interface.
*   **Dashboard & Tables:** Real-time data tables displaying sent, scheduled, and failed emails.
*   **Compose:** A rich-text email composer supporting multiple sender aliases, dynamic delays between emails, and bulk recipient uploads via CSV/TXT.
*   **Global Search:** Instant, full-text search bar that queries the Elasticsearch index.

---

## 🚀 Detailed Setup Guide

### 1. Prerequisites
Make sure you have installed:
*   [Node.js](https://nodejs.org/) (v20 or newer)
*   [Docker Desktop](https://www.docker.com/) (to run the backing databases)
*   Git

### 2. Start the Infrastructure
The application relies on PostgreSQL, Redis, and Elasticsearch. Start them using the provided Docker Compose file:
```bash
docker compose up -d postgres redis elasticsearch

```

*(Wait a few moments for Elasticsearch to fully boot up).*

### 3. Set Up Ethereal Email (Fake SMTP)

To test sending emails without getting blocked by real providers like Gmail or AWS SES, we use Ethereal Email.

1. Go to [ethereal.email](https://ethereal.email/).
2. Click **"Create Ethereal Account"**.
3. Copy the generated **Username**, **Password**, **SMTP Host**, and **SMTP Port**.

### 4. Configure Environment Variables

Create a file named `.env` in the root of the backend directory. Copy the template below and fill in your Ethereal details and OAuth credentials:

```env
# Server Config
FRONTEND_ORIGIN=http://localhost:5173
SESSION_SECRET=your_super_secret_session_key

# Databases
DATABASE_URL=postgres://scheduler:scheduler@localhost:5432/scheduler
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200

# Ethereal SMTP Config (Paste your details here)
ETHEREAL_USER=
ETHEREAL_PASS=

# Authentication (Google Cloud Console & Slack API)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=http://localhost:3000/api/slack/callback

# BullMQ Dashboard Authentication
ADMIN_KEY=admin_password

```

### 5. Run the Backend

The backend is split into two processes: the API server (handling web requests) and the Worker (handling the email queue). You must run both.

Open a terminal and run the API:

```bash
npm install
npm run dev:api

```

Open a **second terminal** and run the Worker:

```bash
npm run dev:worker

```

### 6. Run the Frontend

Open a **third terminal**, navigate to the frontend folder, and start Vite:

```bash
cd frontend
npm install
npm run dev

```

Open your browser and navigate to `http://localhost:5173`.

---

## 📌 Assumptions & Trade-offs

* **Elasticsearch is Best-Effort:** Elasticsearch consumes heavy RAM. If it crashes or the index fails to create, the API will log the error but gracefully continue scheduling and sending emails using PostgreSQL. Elasticsearch is treated purely as a secondary search index.
* **Vercel Reverse Proxy in Production:** The frontend code explicitly relies on relative `/api` paths. It is assumed that in production, the frontend is hosted on Vercel with a `vercel.json` rewrite routing API traffic securely to the DuckDNS/VPS backend to prevent cross-origin cookie blocking.
* **Queue Dashboard Security:** The BullMQ administration dashboard (`/admin/queues`) is integrated into the Express app but protected by basic HTTP Auth (`ADMIN_KEY`) rather than standard user auth, keeping admin tooling cleanly separated from user sessions.
* **Ethereal Email for Dev:** The SMTP module is currently configured for Ethereal. For production, the `mailer.ts` file is designed to easily swap in standard SMTP credentials (like SendGrid or AWS SES) via the `.env` file.
