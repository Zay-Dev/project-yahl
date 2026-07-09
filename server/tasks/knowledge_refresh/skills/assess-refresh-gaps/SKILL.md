# assess-refresh-gaps

Refresh defaults for `knowledge_refresh` stage 1.

## Unattended topic (background dispatch)

This task runs with `background: true` and `runInput` from `auto_knowledge_refresh` or `dispatch-task-run`.

- **Never** call `ask_user` to clarify the topic slug.
- If `knowledge_topic` is missing from context at stage 1, treat as infrastructure failure: set `refresh_skipped: true` and do not invent a capture-style topic question.
- Auto dispatch pre-seeds `runInput.rerun_intent` — stage 1 keeps it and does **not** ask `proceed_mode`.
- Todo-driven `expand_questions` (stage 3) is the only other permitted ask-user path for gap-filling.

## Stage 1 — rerun intent resolution

1. **runInput pre-seed** — if `rerun_intent` is already in context, keep it.
2. **Manual + corpus** — if absent and corpus exists, stage 1 asks via `/ask-user-batch` (see `rerun-intent/SKILL.md`).
3. **No corpus** — `*build_refresh_rerun_intent(refresh_policy)` below.

Use mastermind transport only — do **not** infer policy from empty corpus:

```text
const policyRef = /mastermind(resolve-topic-policy, topic: knowledge_topic);
const refresh_policy = policyRef.row;
const refresh_skipped = policyRef.refresh_skipped;
```

`refresh_skipped` is true only when `refresh_policy.refresh.enabled !== true`. A null `interval` does **not** skip an explicit `knowledge_refresh` run.

## Inputs

- `refresh_policy` row from `resolve-topic-policy`
- Extracted corpus from `get-knowledge`

## `*build_refresh_rerun_intent` (fallback)

```typescript
{
  isRerun: true,
  proceedMode: 'update_selected',
  updateScope: refresh_policy.refresh?.scopes ?? ['studies', 'facts', 'synthesis', 'summary'],
  addressOpenQuestions: false,
}
```

## Profile / no-seed topics

When `seedUrlCount === 0`, drop `studies` from `updateScope` unless corpus has `study_*` keys.

## `*default_learning_contract(knowledge_topic)`

Minimal contract when corpus absent: `{ intent: 'preserve_for_future_tasks', topic: knowledge_topic, seedUrls: [], depth: 'overview' }`.

## Todo pickup

When `todo_pickup.items` includes `plan_study`, seed `researchQuestions` from those summaries before generic gap detection.
