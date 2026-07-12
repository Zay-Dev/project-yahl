---
name: nixery-upsert-knowledge-page
description: Deterministic wiki upsert via orchestrator nixery def
---

# nixery-upsert-knowledge-page

Use `/nixery(upsert-knowledge-page, topic: …, key: …, value: …)` in stage logic for every knowledge persist.

## Contract

- **No file paths** — `source`, `file`, and `path` are rejected.
- **Key + value** or **page + content** with optional `topic` / `topicText` / `seedUrls`.
- Writes via Wiki.js GraphQL; updates `topics.json` when the topic is new.
- **No on-write dedup** — use `dedup-knowledge` for repair passes.

## Tool call

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

## Result

Read `~/nixery/upsert-knowledge-page/result.json`:

```json
{
  "ok": true,
  "path": "en/topics/hk-weather/facts",
  "pagePath": "en/topics/hk-weather/facts",
  "wikiPath": "topics/hk-weather/facts",
  "canonicalTopic": "hk-weather"
}
```

Append `{ path }` to `knowledge_paths.persisted` after each successful upsert.
