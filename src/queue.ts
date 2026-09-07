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