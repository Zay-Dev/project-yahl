# plan-study

Build `study_plan` and `wiki_structure` via orchestrator `nixeryRun: plan-study`, then read `~/nixery/plan-study/plan.json`.

See `server/tasks/knowledge_capture/skills/plan-study/SKILL.md` for full contract.

## Refresh-specific rule 0

When `todo_pickup` includes items with `kind: plan_study`, fold their summaries into `researchQuestions` and `successCriteria` before emitting `study_plan`.

## After plan-study

- When `refresh_skipped`, skip reading plan.json; use empty `study_plan` and minimal `wiki_structure`.
- Otherwise read `~/nixery/plan-study/plan.json`, parse, and persist upsert keys `study_plan` + `wiki_structure` when studies scope updates (keys, not `pages[].path`).
- `pages[].path` stays kebab-case content-model pages only — never put `study_plan` / `study_raw_facts` in `pages[]`.
