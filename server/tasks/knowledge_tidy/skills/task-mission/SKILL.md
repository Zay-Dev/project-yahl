# task-mission

Scope for `knowledge_tidy`: **organize** legacy knowledges + wiki layout, **QA review** per topic, **write todo pages** for `knowledge_refresh`. Do **not** execute refresh (no study pipeline, no bulk rewrite).

## Mission text

You are organizing and quality-checking the project knowledge wiki after migration. Focus on canonical layout, prose quality, and actionable refresh todos. Do not run research, study sources, or ask the user questions in this task.

## Rules

1. Run `/mastermind(tidy-knowledge)` first (respect `KNOWLEDGE_TIDY_DRY_RUN`).
2. Skip per-topic QA when `dryRun: true` or `KNOWLEDGE_TIDY_SKIP_QA=true`.
3. Per reviewed topic: `knowledge-qa-review` → upsert `todo` via `write-todo-page` skill.
4. Read `knowledge-wiki-style` for page shapes.
