import { Redis } from "ioredis";
import { config } from "./config.js";

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

const reserveScript = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local maximum = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local spacing_ms = tonumber(ARGV[3])

if current >= maximum then
  local notify = redis.call('SET', KEYS[3], '1', 'NX', 'PX', window_ms)
  return {0, window_ms, 1, notify and 1 or 0, current}
end

local spacing = redis.call('SET', KEYS[2], '1', 'NX', 'PX', spacing_ms)
if not spacing then
  local wait_ms = redis.call('PTTL', KEYS[2])
  return {0, wait_ms, 0, 0, current}
end

current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], window_ms)
end

return {1, 0, 0, 0, current}
`;

export type Reservation = {
  allowed: boolean;
  waitMs: number;
  hourlyLimitHit: boolean;
  shouldNotify: boolean;
  count: number;
};

export async function reserveSend(senderId: string): Promise<Reservation> {
  const now = Date.now();
  const hourStart = Math.floor(now / 3_600_000) * 3_600_000;
  const windowMs = hourStart + 3_600_000 - now;
  const keys = [
    `email-rate-hour-${senderId}-${hourStart}`,
    `email-spacing-${senderId}`,
    `email-rate-notified-${senderId}-${hourStart}`,
  ];

  const raw = (await redis.eval(
    reserveScript,
    3,
    ...keys,
    config.maxEmailsPerHourPerSender,
    windowMs,
    config.minSendDelayMs,
  )) as Array<number | string>;

  return {
    allowed: Number(raw[0]) === 1,
    waitMs: Math.max(250, Number(raw[1])),
    hourlyLimitHit: Number(raw[2]) === 1,
    shouldNotify: Number(raw[3]) === 1,
    count: Number(raw[4]),
  };
}

export async function closeRateLimiter(): Promise<void> {
  await redis.quit();
}