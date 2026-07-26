# nixery-tidy-knowledge

Audit wiki/export pages per topic via `/nixery(tidy-knowledge)` or `/nixery(tidy-knowledge, dryRun: false, topic: …)`.

Audit-only — no migrate/merge writes.

## Tool call

```json
{
  "defId": "tidy-knowledge",
  "args": {
    "dryRun": true,
    "topic": "hk-weather"
  }
}
```

## Result

Inline tool returns `{ ok, data: { ok, report } }` where `report` has `applied`, `dryRun`, `topicCount`, `topics[{ canonical, issues[] }]`.
