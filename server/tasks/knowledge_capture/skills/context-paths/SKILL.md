# context-paths

Cross-stage path registry for knowledge_capture.

## Context keys

| Key | Role |
|-----|------|
| `knowledge_paths` | Topic roots + `persisted[]` index of every upsert-knowledge-page write |
| `study_dialogue` | Per-source workspace dirs and round artifact paths |
| `missionText` | Loaded once from task-mission; pass as `mission` on every helper call |

## `knowledge_paths` shape

```json
{
  "topic": "slug",
  "topicWorkspace": "~/nixery/study/slug",
  "studyWorkspace": "~/nixery/study/slug",
  "missionPath": "~/task-skills/task-mission/SKILL.md",
  "taskSkillsDir": "~/task-skills",
  "persisted": [
    { "key": "study_plan", "relativePath": "topics/slug/study_plan", "absolutePath": "topics/slug/study_plan" }
  ]
}
```

## After every `upsert-knowledge-page`

1. Read tool result `data.path` (canonical wiki-relative string).
2. `set_context` append to `knowledge_paths.persisted`:
   - `key` = persist key argument
   - `relativePath` = `data.path`
   - `absolutePath` = same string (wiki reference, not session scratch)

### `*append_persisted_path(knowledge_paths, persistResult, key: <key>)`

YAHL stages use this **agent-implemented** virtual (`*`) after `/nixery(upsert-knowledge-page, ...)`. It is **not** a runtime API — implement by merging a structured object into `knowledge_paths.persisted` via `set_context`, never push a bare path string.

```json
{
  "key": "study_plan",
  "relativePath": "topics/slug/study_plan",
  "absolutePath": "topics/slug/study_plan"
}
```

- `persistResult` is upsert `data.path` (string) or `{ path }` / the tool envelope's `data`.
- Replace any existing entry with the same `key`.
- Do **not** append bare strings without `key` / `relativePath` / `absolutePath`.

## Final `result.knowledgePaths`

Derive from `knowledge_paths.persisted.map(p => p.relativePath)` — never guess with `find` or `ls`.

## Dialogue updates

Use `updateContextKeys` on loop stages so `study_dialogue`, `sources`, and `source_studies` accumulate across iterations.
