# monitor-loop

Rules for the configurable-length traffic poll stage (`monitor_minutes`, default 60).

## Clock

- `started_at` is set once in a prior VM stage. Never overwrite it.
- Seed context uses `prev_routes: []`, `last_heartbeat_at: ''`, `last_source_notes_at: ''`, `prev_incident_note: ''` (never `null`) — produce-keys rejects null allowlisted keys.
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

1. Fetch top 2–3 driving routes (see route-analysis) for `origin` → `destination` using core `traffic_source.howto_md` **plus** `source_ops_md`. Rebuild the goto URL from placeholders + context OD with deterministic encoding every poll.
2. On **success**: update context **before** the day-page write:
   - `set_context` key `fetches` with `operation: extend` and `value` = the **one** new fetch object (do not rewrite the whole array).
   - `set_context` key `prev_routes` to that fetch’s `routes`.
   - `set_context` key `prev_incident_note` to the current analysis incident note (or `''` if none) **after** analysis used the prior value.
   - Never update `prev_routes` alone after a successful poll — `fetches` must grow every success.
3. Only after those `set_context` calls succeed: append a markdown section to `day_page` via `/nixery(upsert-knowledge-page, page: day_page, mode: append, content: …)`. Do **not** write a success section unless `fetches` was already extended.
4. Do not re-read the whole wiki every minute. Never write `null` into `prev_routes` / `fetches` / `notifications` / `miss_count` / heartbeat or notes timestamps.
5. Run the three notification checks **independently** (see below), then the 20-min source-ops tick.
6. Adaptive sleep as above until the window ends.

## Browser fetch failures

When route fetch via `browser` fails (timeout, blank page, `ok: false`):

- At most **2** browser attempts for that poll (initial + one retry), including OD-mismatch as failure. Do not burn turns on further `goto` / `agent` / `observe` retries.
- After 2 consecutive failures for the same poll: **skip the poll**. Keep prior `fetches` / `prev_routes` / `prev_incident_note` unchanged. Increment `miss_count` via `set_context` (`miss_count = (miss_count || 0) + 1`). Append a day-page note like `## HH:MM` / `- Fetch missed: browser timeout` / `- Using previous routes`. Then run the 20-min source-ops tick if due (miss reasons may be novel ops notes). Then sleep with the adaptive schedule based on the last successful primary ETA (or `180` if none).
- Never invent route ETAs when the browser failed.
- Never write a success-shaped day-page section (route ETAs) for a missed poll.

## Adaptive sleep helper

`adaptive_sleep_sec(current, prev_primary_eta)`:

- If no previous primary ETA → `180`
- If `current.primary_eta_min <= prev_primary_eta * 1.2` → `180`
- Else → `60`

## Notifications

Always use `to: notify_to` from context (default `91234567`) — never substitute a different recipient.

Draft every body with `userProfile` (language, tone, detailLevel, boundaries/avoid). Heartbeats also require `*proactivity_allows_heartbeat(userProfile)`.

```text
/mastermind(
  propose-notification,
  channel: whatsapp,
  direction: to_user,
  to: notify_to,
  body: <prefs-shaped status text>,
  taskRef: traffic_monitor,
)
```

### Kind A — Initial summary

After successful fetch #2 when `!summary_notified`: full early picture of that day’s traffic (all iconic routes + ETAs + recommendation). Set `summary_notified = true`.

### Kind B — Heartbeat (15 min)

When `*proactivity_allows_heartbeat(userProfile)` and `(now - last_heartbeat_at || started_at) >= 15m`: short still-running pulse — task alive, primary/alts briefly, **minor** drift only. Set `last_heartbeat_at` to now ISO. Low/minimal proactivity skips this kind only.

### Kind C — Abnormal / incident

When `fetches.length >= 2` and `analysis.should_notify_abnormal`: urgent ETA spike, new incident, or **cleared** incident. Never suppress for low proactivity. Do not spam the same active incident/ETA-abnormal if unchanged since last poll; **do** notify when an incident clears.

If A and B, or B and C, are due on the same poll, send separate proposals (do not coalesce).

## Source ops (20 min)

When `(now - last_source_notes_at || started_at) >= 20m`:

1. Draft 0–5 short candidate bullets from this window (tricks, brittle selectors, timeouts, URL quirks).
2. `novel = *filter_novel_ops_notes(candidates, against: source_ops_md)` — skip fuzzy/semantic duplicates already in knowledge.
3. If `novel` non-empty: `/nixery(upsert-knowledge-page, topic: knowledge_topic, key: source-ops-{city_slug}, mode: append, content: novel)` and merge into in-context `source_ops_md`.
4. Do **not** append into `traffic_source.howto_md` or save the local traffic_source file for ops.
5. Always set `last_source_notes_at` to now ISO (even when nothing novel — no empty upsert spam).
