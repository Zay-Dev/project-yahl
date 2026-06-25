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

## Final `result.knowledgePaths`

Derive from `knowledge_paths.persisted.map(p => p.relativePath)` — never guess with `find` or `ls`.

## Dialogue updates

Use `updateContextKeys` on loop stages so `study_dialogue`, `sources`, and `source_studies` accumulate across iterations.
