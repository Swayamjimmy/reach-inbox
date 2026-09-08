# Rate-limit verification

The worker is the source of truth for sending policy. The browser cannot choose the hourly limit or minimum delay.

1. Set a small value in `.env`, for example:

```env
MAX_EMAILS_PER_HOUR_PER_SENDER=3
MIN_SEND_DELAY_MS=1000
WORKER_CONCURRENCY=5
```

2. Stop any old API/worker processes so there is only one worker using the new code.
3. Restart the API and worker.
4. Check the worker startup log. It must print the effective values, e.g.:

```text
Email worker started: concurrency=5, minDelayMs=1000, hourlyLimitPerSender=3
```

5. Schedule/send 5+ recipients from the same sender.
6. The first 3 send attempts can proceed. The remaining jobs must become `rate_limited` and be delayed until the next fixed clock-hour window.
7. The worker sends one Slack notification per sender per hour if Slack is connected and a channel is selected.

Important: the limit is **per sender**, not per browser tab or campaign. Multiple workers share the same Redis counter, so increasing worker concurrency cannot bypass the limit.
