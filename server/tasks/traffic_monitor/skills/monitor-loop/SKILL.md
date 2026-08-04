# monitor-loop

Rules for the configurable-length traffic poll stage (`monitor_minutes`, default 60).

## Clock

- `started_at` is set once in a prior VM stage. Never overwrite it. After a `/stage(explorer)` transfer, the clock-seed stage is **idempotent** — it keeps existing `started_at` / counters when already set.
- Seed context uses `prev_routes: []`, `last_heartbeat_at: ''`, `prev_incident_note: ''` (never `null`) — produce-keys rejects null allowlisted keys.
- `day_page` / calendar day use **`timezone`** from context (default Asia/Hong_Kong). For Asia/Hong_Kong the VM clock stage uses UTC+8; otherwise prefer timezone-aware formatting in this stage.
- Display times and wiki sections `## HH:MM {tz_label}` must use `timezone` wall clock — never label a UTC clock as local.
- At loop head and after every sleep: if `Date.now() - Date.parse(started_at) >= monitor_minutes * 60 * 1000`, finish the stage and write `monitor`.
- On verify auto-retry after the window has elapsed, skip polling and emit `monitor` from existing **real** `fetches` / notifications. Never invent fetches or round-second timestamps to pad `fetch_count`.
- `monitor.fetches` must be the same array as context `fetches` (same length as `fetch_count`). Under-poll when the window allowed ≥2 polls fails verify unless miss sections cover the gap.

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

1. `*read(source_ops_md)` every poll (attend only — do **not** `const`/`let`-assign or `set_context` a copy of the full blob; Input already has `source_ops_md`). Fetch top 2–3 driving routes (see route-analysis) for `origin_resolved`/`destination_resolved` (fallback to `origin`/`destination`) using core OD-generic `traffic_source.howto_md` **plus** Input `source_ops_md` (including durable `## HOWTO`). Rebuild the goto URL from placeholders + resolved OD with deterministic encoding every poll. Never rewrite `howto_md` with this poll’s POI strings.
2. On **success**: update context **before** the day-page write:
   - `set_context` key `fetches` with `operation: extend` and `value` = the **one** new fetch object from the real poll (do not rewrite the whole array; do not invent polls).
   - `set_context` key `prev_routes` to that fetch’s `routes`.
   - `set_context` key `prev_incident_note` to the current analysis incident note (or `''` if none) **after** analysis used the prior value.
   - Never update `prev_routes` alone after a successful poll — `fetches` must grow every success.
3. Only after those `set_context` calls succeed: append a markdown section to `day_page` via `/nixery(append-raw-knowledge-page, topic: knowledge_topic, page: day_page, mode: append, content: …)` (`day_page` must be `raw/fetches-YYYY-MM-DD`). Section must include `## HH:MM {tz_label}`, `- Origin: …`, `- Destination: …`, then corridor ETAs (see route-analysis). Pass `origin` / `destination` into `*format_fetch_section`. Do **not** write a success section unless `fetches` was already extended. Never call `upsert-knowledge-page`.
4. Do not re-read the whole wiki every minute. Never write `null` into `prev_routes` / `fetches` / `notifications` / `miss_count` / heartbeat timestamps.
5. Run the three notification checks **independently** (see below), then the per-poll source-ops **observation** submit (novel-only).
6. Adaptive sleep as above until the window ends.

## Browser fetch failures

`browser` / Stagehand is **CU-only** (clicks, observe, extract). It cannot `set_context`, `nixery`, or `mastermind`. YAHL owns knowledge: after every browser poll (**success or miss**), draft novel ops candidates from the **browser tool result JSON** (not “the agent said…” narration), then run `*filter_novel_ops_notes` → section upsert when novel. Put OD/howto tips the CU loop needs into the stage Input / instruction — the runtime injects a short browse brief only (no full stage chat history).

When route fetch via `browser` fails (timeout, blank page, `ok: false`):

- At most **2** browser attempts for that poll (initial + one retry), including OD-mismatch as failure. Do not burn turns on further `goto` / `agent` / `observe` retries.
- After 2 consecutive failures for the same poll: **skip the poll**. Keep prior `fetches` / `prev_routes` / `prev_incident_note` unchanged. Increment `miss_count` via `set_context` (`miss_count = (miss_count || 0) + 1`). Append a day-page note with `## HH:MM {tz_label}`, `- Origin: …`, `- Destination: …`, `- Fetch missed: …`, `- Using previous routes` via `*format_miss_section(…, origin, destination, timezone)`. Then run the per-poll source-ops upsert (miss reasons may be novel ops notes). Then sleep with the adaptive schedule based on the last successful primary ETA (or `180` if none).
- Never invent route ETAs when the browser failed.
- Never write a success-shaped day-page section (route ETAs) for a missed poll.
- When the locked source is **no longer usable** (site permanently broken, howto invalid, sustained misses that show the source itself is dead — not a one-off flake): call **`goto_stage`** with `stageId: "explorer"` and a concrete `reason` (do not keep sleeping forever on a dead source). Orchestrator ends this monitor stage without verify and jump-and-continues at explorer; clock-seed later preserves `started_at`.

## Adaptive sleep helper

`adaptive_sleep_sec(current, prev_primary_eta)`:

- If no previous primary ETA → `180`
- If `current.primary_eta_min <= prev_primary_eta * 1.2` → `180`
- Else → `60`

## Notifications

Use `channel: notifyChannel` and `to: notifyTo` from `/nixery(resolve-notification-target)` — never invent a different recipient.

Draft every body with `notifyPreference` (and `notifyName` when useful). Empty preference → neutral professional defaults. Heartbeats also require `*proactivity_allows_heartbeat(notifyPreference)`.

```text
/mastermind(
  propose-notification,
  channel: notifyChannel,
  direction: to_user,
  to: notifyTo,
  body: <prefs-shaped status text>,
  taskRef: traffic_monitor,
)
```

### Kind A — Initial summary

After successful fetch #2 when `!summary_notified`: full early picture of that day’s traffic (all iconic routes + ETAs + recommendation). Set `summary_notified = true`.

### Kind B — Heartbeat (15 min)

When `*proactivity_allows_heartbeat(notifyPreference)` and `(now - last_heartbeat_at || started_at) >= 15m`: short still-running pulse — task alive, primary/alts briefly, **minor** drift only. Set `last_heartbeat_at` to now ISO. Low/minimal proactivity skips this kind only.

### Kind C — Abnormal / incident

When `fetches.length >= 2` and `analysis.should_notify_abnormal`: urgent ETA spike, new incident, or **cleared** incident. Never suppress for low proactivity. Do not spam the same active incident/ETA-abnormal if unchanged since last poll; **do** notify when an incident clears.

If A and B, or B and C, are due on the same poll, send separate proposals (do not coalesce).

## Source ops (per poll, novel-only)

After every poll (**success or miss**), persist notes worth keeping for future runs — no time throttle:

1. Draft 0–5 short candidate notes from this poll (tricks, brittle selectors, timeouts, URL quirks, miss/fail reasons, and recoverable **Q&A** problem→fix pairs). Fail notes are equal priority to success tips.
2. `*read(source_ops_md)` then `novel = *filter_novel_ops_notes(candidates, against: source_ops_md)`.
3. If `novel` non-empty: for each note call `/nixery(submit-knowledge-observation, topic_hint: knowledge_topic, cue: …, claim: …, example: …, evidence: { poll, tool }, confidence: observed, tags: [HOWTO|PLACE|Q&A|TRICK])`. Do **not** call `upsert-knowledge-page`.
4. If `novel` is empty: do **not** submit (no empty write spam).
5. Do **not** append into `traffic_source.howto_md` or save the local traffic_source file for ops.
