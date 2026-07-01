# context-paths

Cross-stage path registry for knowledge_capture.

## Context keys

| Key | Role |
|-----|------|
| `knowledge_paths` | Topic roots + `persisted[]` index of every persist-knowledge write |
| `study_dialogue` | Per-source workspace dirs and round artifact paths |
| `missionText` | Loaded once from task-mission; pass as `mission` on every mastermind call |

## `knowledge_paths` shape

```json
{
  "topic": "slug",
  "topicWorkspace": "~/knowledge/slug",
  "studyWorkspace": "~/knowledge/slug/study",
  "knowledgesPersistDir": "~/knowledges/slug",
  "missionPath": "~/task-skills/task-mission/SKILL.md",
  "taskSkillsDir": "~/task-skills",
  "persisted": [
    { "key": "study_plan", "relativePath": "slug/study_plan.json", "absolutePath": "~/knowledges/slug/study_plan.json" }
  ]
}
```

## After every `persist-knowledge`

1. Parse tool result `{ path: "slug/file.json" }`.
2. `set_context` append to `knowledge_paths.persisted`:
   - `key` = persist key argument
   - `relativePath` = returned path
   - `absolutePath` = `~/knowledges/{relativePath}`

### `*append_persisted_path(knowledge_paths, persistResult, key: <key>)`

YAHL stages use this virtual function after `/mastermind(persist-knowledge, ...)`. Implement it by merging a **structured object** into `knowledge_paths.persisted` — never push the raw path string.

```json
{
  "key": "study_plan",
  "relativePath": "slug/study_plan.json",
  "absolutePath": "~/knowledges/slug/study_plan.json"
}
```

- `persistResult` is the persist-knowledge return (`{ path }`) or the path string.
- Replace any existing entry with the same `key`.
- Do **not** append bare strings like `"slug/file.json"` to `persisted`.

## Final `result.knowledgePaths`

Derive from `knowledge_paths.persisted.map(p => p.relativePath)` — never guess with `find` or `ls`.

## Dialogue updates

Use `updateContextKeys` on loop stages so `study_dialogue`, `sources`, and `source_studies` accumulate across iterations.
