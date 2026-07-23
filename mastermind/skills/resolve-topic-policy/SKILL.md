---
name: resolve-topic-policy
description: Deterministic refresh policy lookup for an exact topic slug — no LLM, no fuzzy match.
---

# resolve-topic-policy

`/mastermind(resolve-topic-policy, topic: <slug>)` looks up a **known** policy row by sanitized slug or declared registry **alias**. Ambiguous free text is not resolved here — use nixery `resolve-topic` + agent pick first.

On success:

```json
{
  "row": { "canonical": "...", "refresh": { "enabled": true, ... }, ... },
  "refresh_skipped": false
}
```

`refresh_skipped` is `true` only when `row.refresh.enabled !== true`. Null `interval` does **not** skip explicit `knowledge_refresh` runs.

On miss (unknown slug): skill returns `{ ok: false, error: "Topic policy not found: …" }` — not a synthetic disabled row.
