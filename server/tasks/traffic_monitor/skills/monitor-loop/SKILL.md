# monitor-loop

One poll of a configurable window (`monitor_minutes`, default 60). The orchestrator runs this skill at least twice (`whileSetup.doAtLeast: 2`), then re-checks the window via `whileSetup.condition` before further iterations.

## Clock / sleep

Never overwrite `started_at`. Times / `## HH:MM` use `timezone`. Verify retry after the window → emit `monitor` from real `fetches` only.

| When | `run_bash` |
|------|------------|
| After first success | `sleep 300` |
| Later, primary ETA ≤ 120% of previous | `sleep 180` |
| Later, primary ETA > 120% | `sleep 60` |

Single sleep per wait (`bashTimeoutMs: 360000`). No chunking / background / alternate waits without `consult-breaking-change` agree.

`adaptive_sleep_sec`: no prior → 180; ≤120% → 180; else → 60.

## Poll sequence

1. `*read(source_ops_md)`; fetch routes (route-analysis) for resolved OD.
2. Success: `extend_context` on `fetches` + update `prev_routes` / `prev_incident_note` **before** day-page append. Use `now_iso` and `timezone` for poll timestamps.
3. Append section via `append-raw-knowledge-page` (`raw/fetches-YYYY-MM-DD`) with Path lines when present.
4. Notify checks (below), then novel-only ops observations.
5. Sleep once; the orchestrator decides whether another poll runs.

## Miss / dead source

≤ 2 browser attempts. Then bump `miss_count`, miss section, sleep. Never invent ETAs. Sustained dead source → `goto_stage` explorer with reason.

## Notifications

`channel` / `to` from resolve-notification-target. Draft from `notifyPreference` / `notifyName`. Empty preference → neutral professional defaults.

For each route in bodies: `label` + ETA + **`path` when non-empty**. Prefer official Chinese road/tunnel names when preference is zh; keep EN for browser bind. **Do not notify tunnel-only when `path` was extractable.** Place titles use runInput `origin` / `destination` (not bound POI proxies).

| Kind | When | Body |
|------|------|------|
| A Initial summary | Successful fetches #1 and #2 | All routes + path + recommendation |
| B Heartbeat | Every 15 min when `*proactivity_allows_heartbeat` | Short pulse + primary/alts paths briefly |
| C Abnormal | `should_notify_abnormal` (fetch ≥ 2) | Spike / incident / cleared — never suppress for low proactivity |

Independent proposals; do not coalesce kinds.

## Per-poll ops

Draft 0–5 novel candidates from browser tool JSON → `*filter_novel_ops_notes` → submit when worth persisting. Empty novel → no submit. Never append into `howto_md`. PLACE evidence needs `claimed_place` + `bound_poi` when tagged PLACE.
