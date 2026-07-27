# monitor-loop

Rules for the configurable-length traffic poll stage (`monitor_minutes`, default 60).

## Clock

- `started_at` is set once in a prior VM stage. Never overwrite it.
- Seed context uses `prev_routes: []` (never `null`) — produce-keys rejects null allowlisted keys.
- `day_page` / calendar day use **`timezone`** from context (default Asia/Hong_Kong). For Asia/Hong_Kong the VM clock stage uses UTC+8; otherwise prefer timezone-aware formatting in this stage.
- Display times and wiki sections `## HH:MM {tz_label}` must use `timezone` wall clock — never label a UTC clock as local.
- At loop head and after every sleep: if `Date.now() - Date.parse(started_at) >= monitor_minutes * 60 * 1000`, finish the stage and write `monitor`.
- On verify auto-retry after the window has elapsed, skip polling and emit `monitor` from existing `fetches` / notifications.

## Sleep via `run_bash`

Use a single bash sleep per wait (counts as one `run_bash` call). This stage has `agentOverrides.bashTimeoutMs: 360000` so `sleep 300` fits.

| When | Command |
|------|---------|
| After the first successful fetch | `sleep 300` |
| Later, primary route ETA ≤ 120% of previous primary ETA | `sleep 180` |
| Later, primary route ETA > 120% of previous primary ETA | `sleep 60` |

Forbidden without `/nixery(consult-breaking-change, …)` returning `agree: true`:

- Chunking sleep into sub-60s loops (`sleep 50` × N)
- Background sleeps (`sleep N &`, nohup)
- Alternate wait schemes (`timeout`, busy-wait, polling loops)

If `run_bash` returns a timeout error, fail loudly and surface it — do not invent a new wait protocol.

Check the monitor-minutes exit condition again after each sleep returns.

## Poll sequence

1. Fetch top 2–3 driving routes (see route-analysis) for `origin` → `destination`.
2. On **success**: update context **before** the day-page write:
   - `set_context` key `fetches` with `operation: extend` and `value` = the **one** new fetch object (do not rewrite the whole array).
   - `set_context` key `prev_routes` to that fetch’s `routes`.
   - Never update `prev_routes` alone after a successful poll — `fetches` must grow every success.
3. Only after those `set_context` calls succeed: append a markdown section to `day_page` via `/nixery(upsert-knowledge-page, page: day_page, mode: append, content: …)`. Do **not** write a success section unless `fetches` was already extended.
4. Do not re-read the whole wiki every minute. Never write `null` into `prev_routes` / `fetches` / `notifications` / `miss_count`.
5. After fetch #2: propose one WhatsApp summary notification to `notify_to`, then set `summary_notified = true`.
6. On later fetches: if analysis says abnormal, propose WhatsApp with the bad route(s) and recommended alternative(s).
7. Adaptive sleep as above until the window ends.

## Browser fetch failures

When route fetch via `browser` fails (timeout, blank page, `ok: false`):

- At most **2** browser attempts for that poll (initial + one retry). Do not burn turns on further `goto` / `agent` / `observe` retries.
- After 2 consecutive failures for the same poll: **skip the poll**. Keep prior `fetches` / `prev_routes` unchanged. Increment `miss_count` via `set_context` (`miss_count = (miss_count || 0) + 1`). Append a day-page note like `## HH:MM` / `- Fetch missed: browser timeout` / `- Using previous routes`. Then sleep with the adaptive schedule based on the last successful primary ETA (or `180` if none).
- Never invent route ETAs when the browser failed.
- Never write a success-shaped day-page section (route ETAs) for a missed poll.

## Adaptive sleep helper

`adaptive_sleep_sec(current, prev_primary_eta)`:

- If no previous primary ETA → `180`
- If `current.primary_eta_min <= prev_primary_eta * 1.2` → `180`
- Else → `60`

## Notifications

Always use `to: notify_to` from context (default `91234567`) — never substitute a different recipient.

```text
/mastermind(
  propose-notification,
  channel: whatsapp,
  direction: to_user,
  to: notify_to,
  body: <short status text>,
  taskRef: traffic_monitor,
)
```

Body should include time (in `timezone`), top routes with ETAs, and a one-line recommendation when routes diverge.
