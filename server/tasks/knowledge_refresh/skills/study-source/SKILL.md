# study-source

Per-source study via filesystem handoff (dialogue loop or single fetch).

## Flow

1. Read mission: `cat ~/task-skills/task-mission/SKILL.md` — pass full text as `mission` on every Mastermind call.
2. Read [`~/task-skills/assess-learning-stage/SKILL.md`](assess-learning-stage/SKILL.md) for smart-skip rules.
3. Read [`~/task-skills/context-paths/SKILL.md`](context-paths/SKILL.md) for path registry updates.

## Dialogue loop (preferred)

Follow [`dialogue-round/SKILL.md`](dialogue-round/SKILL.md):

- stagehand → `raw.md`
- mastermind research → `round-N-mastermind.md`
- agent analyze → `round-N-agent.md`
- merge → `final.md` → persist `study_{slug}`

## Facts stage

When extracting facts, cite `sources[]` URLs. Rebuild `sources` index from persisted `study_*.json` if array is missing or corrupt:

- Each item: `title`, `url`, `fetchedAt`, `trustTier`, `studyKey`
- `sources` must be an **array**, not a single object
- `studyKey` values must be unique

## Persist

```text
/mastermind(upsert-knowledge-page, topic: knowledge_topic, key: study_{slug}, value: { url, title, studyMd, studiedAt, trustTier })
```

Mastermind writes `studyMd` to wiki page `studies/{slug}` and metadata to `raw/study_{slug}`.

Immediately append returned `{ path }` to `knowledge_paths.persisted`.
