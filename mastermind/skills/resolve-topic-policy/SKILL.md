---
name: resolve-topic-policy
description: Deterministic refresh policy lookup for a single topic slug — no LLM.
---

# resolve-topic-policy

`/mastermind(resolve-topic-policy, topic: <slug>)` returns:

```json
{
  "row": { "canonical": "...", "refresh": { "enabled": true, ... }, ... },
  "refresh_skipped": false
}
```

`refresh_skipped` is `true` only when `row.refresh.enabled !== true`. Null `interval` does **not** skip explicit `knowledge_refresh` runs.
