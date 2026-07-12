---
name: nixery
description: Inline nixery defs for knowledge writes and dedup
---

# nixery tool

Use the **`nixery`** tool for `/nixery(...)` in stage logic.

## Writes

| Call | Result |
|------|--------|
| `/nixery(upsert-knowledge-page, topic: …, key: …, value: …)` | `~/nixery/upsert-knowledge-page/result.json` |
| `/nixery(dedup-knowledge, topic: …, purpose: …)` | `~/nixery/dedup-knowledge/dedup-review.json` |

```json
{
  "defId": "upsert-knowledge-page",
  "args": {
    "topic": "hk-weather",
    "key": "facts",
    "value": { "items": [] }
  }
}
```

## Rules

- Never pass `source`, `file`, or `path` to upsert.
- Dedup is opt-in maintenance — not on every upsert.
- Append `{ path }` from upsert results to `knowledge_paths.persisted`.

## Reads

Knowledge reads still use orchestrator `nixeryRun` stages (`get-knowledge`, `list-knowledge-pages`, `search-knowledge`).
