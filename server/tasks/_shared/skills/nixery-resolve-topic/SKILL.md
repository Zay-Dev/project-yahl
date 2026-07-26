# nixery-resolve-topic

Resolve a canonical topic slug via `/nixery(resolve-topic, topicText: …, slug: …, seedUrls: …)` before the first upsert in a knowledge capture run.

## Tool call

```json
{
  "defId": "resolve-topic",
  "args": {
    "topicText": "Hong Kong weather",
    "slug": "hk-weather",
    "seedUrls": ["https://example.com"]
  }
}
```

## Result

Inline tool returns `{ ok, data: { ok, canonical, matchedBy, aliases?, suggestMerge? } }`. Use `data.canonical` as `knowledge_topic`.
