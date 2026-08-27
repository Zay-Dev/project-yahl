# task-mission

Monitor private-car driving from `origin` → `destination` for about `monitor_minutes` (default 60). Resolve notify target, load city source-ops from durable files when fresh, explore/lock a live multi-route ETA source, poll top 2–3 routes, append day-page sections, propose notifications, submit novel+evidenced observations per `/opt/skills/worth-persisting-knowledge/SKILL.md`, then append a daily report raw page under topic `traffic-monitor`. The knowledge registry may canonicalize `traffic-monitor` to a merged slug (e.g. `traffic-notify`); that redirect is expected — not a validation failure. Defaults: Kowloon Tong → HKIA, city Hong_Kong, timezone Asia/Hong_Kong. Wall clocks use `timezone`.

## `source_instruction` override

When Input `instruction_active` is true, **read and apply** free-text `source_instruction` over explore/monitor defaults (trust-skip, known-fail decline, extract richness, notify wording). Do **not** phrase-match hardcoded strings.

- Default under active instruction: **do not** take blind `trusted durable cache; no re-probe` unless the instruction clearly allows trusting cache / skipping probe — live-probe the durable candidate (same as re-entry), then follow the rest of the instruction text.
- Do not blind-skip known-failed sources unless the instruction clearly forbids probing them.
- `*research_need_for_explore` must include raw `source_instruction` when active.

## Ops

Attend via `*read(source_ops_md)` before site use; do not paste ops into `howto_md`. Submit novel source-ops / PLACE notes when worth persisting — never `upsert-knowledge-page`.

Notify kinds / poll loop / path extract → `~/task-skills/monitor-loop/SKILL.md` + `~/task-skills/route-analysis/SKILL.md`.
