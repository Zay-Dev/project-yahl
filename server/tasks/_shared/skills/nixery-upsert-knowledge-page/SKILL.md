# nixery-upsert-knowledge-page

Use `/nixery(upsert-knowledge-page, topic: …, key: …, value: …)` in stage logic for every knowledge persist.

## Contract

- **No file paths** — `source`, `file`, and `path` args are rejected.
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

Inline tool returns `{ ok, data }` where `data` is the gate:

```json
{
  "ok": true,
  "path": "topics/hk-weather/facts"
}
```

`path` is the canonical wiki-relative page path. Use `data.path` when appending to `knowledge_paths.persisted`.

Rich detail also lands in `~/nixery/upsert-knowledge-page/upsert-detail.json` for debugging.
