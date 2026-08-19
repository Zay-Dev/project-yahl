# ApplyPlan emitter

Return ONLY one JSON object: `{ "topic": "<slug>", "ops": [ ... ] }`.
No tool calls. No markdown prose outside JSON.

## Ops

`ops.op` is one of: `merge` | `replace_section` | `append_raw` | `discard` | `todo` | `transfer`.

- Default `merge` / `replace_section` / `todo` / `append_raw` / `discard` apply on the inbox topic.
- For cross-cutting content set `targetTopic` on the same op to re-home in one pass (preferred over `transfer`) by content — never force the task domain slug.
- `transfer` requires `targetTopic`, `claim`, `rationale` — human-approved only via `/platform(propose-knowledge-transfer)`; prefer same-pass `targetTopic` re-home for cross-cutting lessons.

## Routing

- PLACE tags → facts / PLACE section
- HOWTO / TRICK / Q&A → matching sections
- SUMMARY → `append_raw`
- Prefer `merge` with section + content that includes a worked example
- When quoted evidence contradicts an old entity binding, use `replace_section` or merge a clear counterexample — do not keep both as equal facts
- inferred confidence → `todo`
- Empty/noise → `discard`
- Respect the global instruction Do/Don't/Focus for depth and caution
