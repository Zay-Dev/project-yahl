# study-source

Per-source study via filesystem handoff (dialogue loop or single fetch).

## Flow

1. Read mission: `cat ~/task-skills/task-mission/SKILL.md` — pass full text as `mission` on every helper call.
2. Read [`~/task-skills/assess-learning-stage/SKILL.md`](assess-learning-stage/SKILL.md) for smart-skip rules.
3. Read [`~/task-skills/context-paths/SKILL.md`](context-paths/SKILL.md) for path registry updates.

## Dialogue loop (preferred)

Follow [`dialogue-round/SKILL.md`](dialogue-round/SKILL.md):

- stagehand → `raw.md`
- nixery research → `round-N-research.md`
- agent analyze → `round-N-agent.md`
- merge → `final.md` → persist `study_{slug}`

## Facts stage

When extracting facts, cite `sources[]` URLs. Load `sources` via `get-knowledge` need `sources` if missing or corrupt:

- Each item: `title`, `url`, `fetchedAt`, `trustTier`, `studyKey`
- `sources` must be an **array**, not a single object
- `studyKey` values must be unique

## Persist

```text
/nixery(upsert-knowledge-page, topic: knowledge_topic, key: study_{slug}, value: { url, title, studyMd, studiedAt, trustTier })
```

Immediately append returned `data.path` to `knowledge_paths.persisted`.
