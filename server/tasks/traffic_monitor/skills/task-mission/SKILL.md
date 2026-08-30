# task-mission

Monitor private-car driving `origin` → `destination` for about `monitor_minutes`. Explore/lock a multi-route ETA source, poll, append day-page sections, propose notifications, append a daily report under topic `traffic-monitor` (registry may merge the slug — that is OK).

Defaults when runInput blank: Kowloon Tong → HKIA, city Hong_Kong, timezone Asia/Hong_Kong.

Browser ops: `*get_or_create(~/data/scripts/{source_scripts_slug}/…)` from locked `traffic_source` — never hardcode a host in stage YAML.

## `source_instruction`

When `instruction_active`: apply free-text `source_instruction` over explore/monitor defaults. Do not phrase-match hardcoded strings. Do not blind trust-cache or skip known-failed sources unless the instruction clearly allows it. Pass raw `source_instruction` into `*research_need_for_explore` when active.

## Ops

`*read(source_ops_md)` before site use in explore. Strip PLACE OD examples via `*strip_od_bleed`. Novel ops via worth-persisting — never `upsert-knowledge-page`.
