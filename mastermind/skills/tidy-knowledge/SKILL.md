---
name: tidy-knowledge
description: Detect and merge duplicate knowledges topic folders; audit/migrate wiki layout per topic.
---

# tidy-knowledge

Use `/mastermind(tidy-knowledge)` or `/mastermind(tidy-knowledge, dryRun: false)` to scan `data/mastermind/knowledges/` for duplicate topic folders, merge into canonical slugs, and audit/migrate wiki pages per topic.

No LLM — file + GraphQL I/O only. Default `dryRun` follows `KNOWLEDGE_TIDY_DRY_RUN` (detect-only until operator sets env to `false`).

## Tool

```json
{
  "skill": "tidy-knowledge",
  "args": {
    "dryRun": true,
    "restoreFromArchive": false,
    "skipDuplicates": false,
    "skipWiki": false,
    "topic": "optional-single-slug"
  }
}
```

Returns `{ report: { applied, dryRun, groups, mergedKeys, archived, restoredKeys, topics } }`.

When `restoreFromArchive: true` and `topic` is set, replays legacy JSON/MD from `knowledges/_archive/*/{topic}/` (or active folder) into wiki via `upsertLegacyKnowledgeKey` before wiki audit.

`topics[]` entries include `canonical`, `issues[]`, `migratedKeys[]`, `deletedOrphans[]` for per-topic QA in `knowledge_tidy`.

## Env

| Variable | Default | Effect |
|----------|---------|--------|
| `KNOWLEDGE_TIDY_DRY_RUN` | `true` | When not `false`, wiki audit only (no migrate) |
| `KNOWLEDGE_TIDY_SKIP_WIKI` | — | Skip wiki audit/migrate entirely |
