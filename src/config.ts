import "dotenv/config";

function integer(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export const config = {
  port: integer("PORT", 3000),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://scheduler:scheduler@localhost:5432/scheduler",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  workerConcurrency: integer("WORKER_CONCURRENCY", 5),
  minSendDelayMs: integer("MIN_SEND_DELAY_MS", 2000),
  maxEmailsPerHourPerSender: integer(
    "MAX_EMAILS_PER_HOUR_PER_SENDER",
    200,
  ),
  sendLeaseMs: integer("SEND_LEASE_MS", 60000),
  adminKey: process.env.ADMIN_KEY ?? "replace-with-a-long-random-value",
  etherealUser: process.env.ETHEREAL_USER,
  etherealPass: process.env.ETHEREAL_PASS,
  slackClientId: process.env.SLACK_CLIENT_ID,
  slackClientSecret: process.env.SLACK_CLIENT_SECRET,
  slackRedirectUri: process.env.SLACK_REDIRECT_URI,
};