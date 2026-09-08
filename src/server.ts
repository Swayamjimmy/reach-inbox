import { randomUUID } from "node:crypto";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";

import { config } from "./config.js";
import { completeGoogleLogin, createGoogleAuthorizeUrl, loadUser, logout, requireUser } from "./auth.js";
import { indexEmail, searchEmails, syncEmailSearchIndex } from "./elasticsearch.js";
import { initializeDatabase, pool } from "./db.js";
import { emailQueue, enqueueEmail, producerRedis, recoverNonFinalEmails } from "./queue.js";
import { completeSlackOAuth, createSlackAuthorizeUrl, disconnectSlack, getSlackStatus, getSlackChannels, setSlackChannel } from "./slack.js";

await initializeDatabase();

void syncEmailSearchIndex(async () => {
  const result = await pool.query(`SELECT * FROM emails`);
  return result.rows;
}).catch((error) => console.error("Elasticsearch startup sync failed:", error));

const recovered = await recoverNonFinalEmails();

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(loadUser);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", config.frontendOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Idempotency-Key,X-Tenant-Id,Authorization");

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

function tenantId(req: Request): string {
  if (!req.user) throw new Error("Authentication required");
  return req.user.tenantId;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

app.get("/api/auth/google", (req, res) => {
  res.redirect(createGoogleAuthorizeUrl(res));
});

app.get("/api/auth/google/callback", async (req, res) => {
  try {
    const code = requiredString(req.query.code, "code");
    const state = requiredString(req.query.state, "state");

    await completeGoogleLogin(code, state, req.cookies?.reachinbox_oauth_state, res);
    res.redirect(`${config.frontendOrigin}/settings/slack`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google login failed";
    res.redirect(`${config.frontendOrigin}/login?error=${encodeURIComponent(message)}`);
  }
});

app.get("/api/auth/me", (req, res) => {
  if (!req.user) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, user: req.user });
});

app.post("/api/auth/logout", async (req, res) => {
  await logout(req, res);
});

app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  await producerRedis.ping();
  res.json({ ok: true, recovered });
});

app.get("/api/senders", requireUser, async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM senders WHERE tenant_id = $1 ORDER BY created_at ASC`,
    [tenantId(req)]
  );
  res.json(result.rows);
});

app.post("/api/senders", requireUser, async (req, res) => {
  const tenant = tenantId(req);
  const id = requiredString(req.body.id, "id");
  const name = requiredString(req.body.name, "name");
  const email = requiredString(req.body.email, "email");

  if (!email.includes("@")) throw new Error("email must contain @");

  const result = await pool.query(
    `INSERT INTO senders (id, tenant_id, name, email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email
     RETURNING *`,
    [id, tenant, name, email]
  );

  res.status(201).json(result.rows[0]);
});

app.post("/api/emails", requireUser, async (req, res) => {
  const tenant = tenantId(req);
  const idempotencyKey = req.header("Idempotency-Key");

  if (!idempotencyKey) throw new Error("Idempotency-Key header is required");

  const senderId = requiredString(req.body.senderId, "senderId");
  const toEmail = requiredString(req.body.toEmail, "toEmail");
  const subject = requiredString(req.body.subject, "subject");
  const textBody = requiredString(req.body.textBody, "textBody");
  const scheduledAt = new Date(requiredString(req.body.scheduledAt, "scheduledAt"));

  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("scheduledAt must be an ISO date-time");
  }

  const sender = await pool.query(`SELECT id FROM senders WHERE id = $1 AND tenant_id = $2`, [senderId, tenant]);
  if (sender.rowCount !== 1) return res.status(404).json({ error: "Sender not found" });

  const id = randomUUID();

  const result = await pool.query<{ id: string; scheduled_at: Date; status: string }>(
    `INSERT INTO emails (id, tenant_id, sender_id, idempotency_key, to_email, subject, text_body, scheduled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (tenant_id, idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
     RETURNING id, scheduled_at, status`,
    [id, tenant, senderId, idempotencyKey, toEmail, subject, textBody, scheduledAt]
  );

  const email = result.rows[0]!;

  try {
    await enqueueEmail(email.id, new Date(email.scheduled_at));
    await pool.query(
      `UPDATE emails
       SET status = CASE WHEN status = 'scheduled' THEN 'queued' ELSE status END, updated_at = now()
       WHERE id = $1`,
      [email.id]
    );
  } catch (error) {
    return res.status(503).json({
      error: "Email was saved but Redis enqueue failed; startup recovery will retry",
      emailId: email.id,
    });
  }

  const saved = await pool.query(`SELECT * FROM emails WHERE id = $1`, [email.id]);

  if (saved.rows[0]) {
    try {
      await indexEmail(saved.rows[0]);
    } catch (error) {
      console.error("Elasticsearch indexing failed after scheduling:", error);
    }
  }

  res.status(202).json(saved.rows[0]);
});

app.get("/api/emails", requireUser, async (req, res) => {
  const tenant = tenantId(req);
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const values: unknown[] = [tenant];

  let sql = `SELECT * FROM emails WHERE tenant_id = $1`;
  if (status) {
    sql += ` AND status = $2`;
    values.push(status);
  }
  sql += ` ORDER BY scheduled_at DESC LIMIT 200`;

  const result = await pool.query(sql, values);
  res.json(result.rows);
});

app.get("/api/emails/search", requireUser, async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const rawStatus = typeof req.query.status === "string" ? req.query.status : undefined;
  const status = rawStatus === "sent" || rawStatus === "scheduled" ? rawStatus : undefined;

  const results = await searchEmails({ tenantId: tenantId(req), query, status, limit: 200 });
  res.json(results);
});

app.get("/api/slack/connect", requireUser, async (req, res) => {
  res.redirect(await createSlackAuthorizeUrl(tenantId(req)));
});

app.get("/api/slack/callback", async (req, res) => {
  const code = requiredString(req.query.code, "code");
  const state = requiredString(req.query.state, "state");
  const installation = await completeSlackOAuth(code, state);

  res.type("html").send(`<h1>Slack connected</h1><p>${installation.teamName} is connected for tenant ${installation.tenantId}.</p>`);
});

app.get("/api/slack/status", requireUser, async (req, res) => {
  res.json(await getSlackStatus(tenantId(req)));
});

app.get("/api/slack/channels", requireUser, async (req, res) => {
  res.json(await getSlackChannels(tenantId(req)));
});

app.put("/api/slack/channel", requireUser, async (req, res) => {
  const channelId = requiredString(req.body.channelId, "channelId");
  await setSlackChannel(tenantId(req), channelId);
  res.json({ ok: true, channelId });
});

app.delete("/api/slack/disconnect", requireUser, async (req, res) => {
  await disconnectSlack(tenantId(req));
  res.status(204).end();
});

const boardAdapter = new ExpressAdapter();
boardAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter: boardAdapter,
});

function protectBoard(req: Request, res: Response, next: NextFunction): void {
  const expected = `Basic ${Buffer.from(`admin:${config.adminKey}`).toString("base64")}`;

  if (req.header("Authorization") !== expected) {
    res.setHeader("WWW-Authenticate", 'Basic realm="queues"');
    res.status(401).send("Authentication required");
    return;
  }
  next();
}

app.use("/admin/queues", protectBoard, boardAdapter.getRouter());

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(400).json({ error: message });
});

const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
  console.log(`Recovered ${recovered} non-final email records`);
});

async function shutdown(): Promise<void> {
  server.close();
  await emailQueue.close();
  await producerRedis.quit();
  await pool.end();
}

process.on("SIGINT", () => shutdown().then(() => process.exit(0)));
process.on("SIGTERM", () => shutdown().then(() => process.exit(0)));