import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { config } from "./config.js";
import { pool } from "./db.js";

export const producerRedis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1,
});

export const emailQueue = new Queue("email-send", {
  connection: producerRedis,
});

export async function enqueueEmail(
  emailId: string,
  scheduledAt: Date,
): Promise<void> {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  await emailQueue.add(
    "send-email",
    { emailId },
    {
      delay,
      jobId: `email-${emailId}`,
    },
  );
}

export async function recoverNonFinalEmails(): Promise<number> {
  const result = await pool.query<{
    id: string;
    scheduled_at: Date;
  }>(`
    SELECT id, scheduled_at
    FROM emails
    WHERE status IN (
      'scheduled', 'queued', 'processing', 'sending', 'rate_limited'
    )
    ORDER BY scheduled_at ASC
  `);

  for (const email of result.rows) {
    await enqueueEmail(email.id, new Date(email.scheduled_at));
    await pool.query(
      `UPDATE emails
       SET status = CASE
         WHEN status = 'scheduled' THEN 'queued'
         ELSE status
       END,
       updated_at = now()
       WHERE id = $1`,
      [email.id],
    );
  }

  return result.rowCount ?? 0;
}