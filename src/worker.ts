import { DelayedError, Worker } from "bullmq";
import { Redis } from "ioredis";
import { config } from "./config.js";
import { initializeDatabase, pool } from "./db.js";
import { sendEmail } from "./mailer.js";
import { closeRateLimiter, reserveSend } from "./rate-limit.js";
import { sendRateLimitAlert } from "./slack.js";
import { indexEmail, removeEmailFromIndex } from "./elasticsearch.js";

type EmailRow = {
  id: string;
  tenant_id: string;
  sender_id: string;
  sender_name: string;
  sender_email: string;
  to_email: string;
  subject: string;
  text_body: string;
  status: string;
  processing_started_at: Date | null;
};

type Claim =
  | { kind: "work"; email: EmailRow }
  | { kind: "delay"; waitMs: number }
  | { kind: "skip" };

async function claimEmail(emailId: string): Promise<Claim> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<EmailRow>(
      `SELECT e.*, s.name AS sender_name, s.email AS sender_email
       FROM emails e
       JOIN senders s ON s.id = e.sender_id
       WHERE e.id = $1
       FOR UPDATE OF e`,
      [emailId]
    );

    const email = result.rows[0];

    if (!email || ["sent", "failed", "uncertain"].includes(email.status)) {
      await client.query("COMMIT");
      return { kind: "skip" };
    }

    if (["processing", "sending"].includes(email.status)) {
      const started = email.processing_started_at?.getTime() ?? 0;
      const age = Date.now() - started;

      if (age < config.sendLeaseMs) {
        await client.query("COMMIT");
        return { kind: "delay", waitMs: config.sendLeaseMs - age };
      }

      if (email.status === "sending") {
        await client.query(
          `UPDATE emails
           SET status = 'uncertain',
               last_error = 'SMTP outcome unknown after worker interruption',
               updated_at = now()
           WHERE id = $1`,
          [emailId]
        );
        await client.query("COMMIT");
        return { kind: "skip" };
      }
    }

    const claimed = await client.query<EmailRow>(
      `UPDATE emails
       SET status = 'processing',
           processing_started_at = now(),
           attempts = attempts + 1,
           updated_at = now()
       WHERE id = $1
       RETURNING *, $2::text AS sender_name, $3::text AS sender_email`,
      [emailId, email.sender_name, email.sender_email]
    );

    await client.query("COMMIT");
    return { kind: "work", email: claimed.rows[0]! };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

await initializeDatabase();

const workerRedis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker(
  "email-send",
  async (job, token) => {
    const emailId = String(job.data.emailId);
    const claim = await claimEmail(emailId);

    if (claim.kind === "skip") return { skipped: true };

    if (claim.kind === "delay") {
      await job.moveToDelayed(Date.now() + claim.waitMs, token);
      throw new DelayedError();
    }

    const email = claim.email;
    const reservation = await reserveSend(email.sender_id);

    if (!reservation.allowed) {
      const retryAt = new Date(Date.now() + reservation.waitMs);

      const rateLimitedResult = await pool.query(
        `UPDATE emails
         SET status = 'rate_limited',
             rate_limited_until = $2,
             processing_started_at = NULL,
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [email.id, retryAt]
      );

      if (rateLimitedResult.rows[0]) {
        try {
          await indexEmail(rateLimitedResult.rows[0]);
        } catch (error) {
          console.error("Elasticsearch indexing failed for rate-limited email:", error);
        }
      }

      if (reservation.hourlyLimitHit && reservation.shouldNotify) {
        try {
          await sendRateLimitAlert({
            tenantId: email.tenant_id,
            senderEmail: email.sender_email,
            maximum: config.maxEmailsPerHourPerSender,
          });
        } catch (error) {
          console.error("Slack alert failed without failing the email job", error);
        }
      }

      await job.moveToDelayed(retryAt.getTime(), token);
      throw new DelayedError();
    }

    const sendingResult = await pool.query(
      `UPDATE emails SET status = 'sending', updated_at = now() WHERE id = $1 RETURNING *`,
      [email.id]
    );

    if (sendingResult.rows[0]) {
      try {
        await indexEmail(sendingResult.rows[0]);
      } catch (error) {
        console.error("Elasticsearch indexing failed for sending email:", error);
      }
    }

    try {
      const sent = await sendEmail({
        senderName: email.sender_name,
        senderEmail: email.sender_email,
        toEmail: email.to_email,
        subject: email.subject,
        textBody: email.text_body,
      });

      const sentResult = await pool.query(
        `UPDATE emails
         SET status = 'sent', provider_message_id = $2, preview_url = $3,
             sent_at = now(), last_error = NULL, updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [email.id, sent.messageId, sent.previewUrl]
      );

      if (sentResult.rows[0]) {
        try {
          await indexEmail(sentResult.rows[0]);
        } catch (error) {
          console.error("Elasticsearch indexing failed for sent email:", error);
        }
      }

      return sent;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await pool.query(
        `UPDATE emails SET status = 'uncertain', last_error = $2, updated_at = now() WHERE id = $1`,
        [email.id, message]
      );

      try {
        await removeEmailFromIndex(email.id);
      } catch (indexError) {
        console.error("Elasticsearch removal failed for uncertain email:", indexError);
      }

      return { uncertain: true, reason: message };
    }
  },
  {
    connection: workerRedis,
    concurrency: config.workerConcurrency,
    maxStartedAttempts: 1000,
  }
);

worker.on("completed", (job) => console.log(`Completed job ${job.id}`));
worker.on("failed", (job, error) => console.error(`Failed job ${job?.id ?? "unknown"}`, error));
worker.on("error", (error) => console.error("Worker error", error));

async function shutdown() {
  await worker.close();
  await closeRateLimiter();
  await pool.end();
  await workerRedis.quit();
}

process.on("SIGINT", () => shutdown().then(() => process.exit(0)));
process.on("SIGTERM", () => shutdown().then(() => process.exit(0)));

console.log(`Email worker started with concurrency ${config.workerConcurrency}`);