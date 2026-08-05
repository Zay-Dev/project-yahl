# assess-refresh-gaps

Refresh defaults for `knowledge_refresh` stage 1.

## Unattended topic (background dispatch)

This task runs with `background: true` and `runInput` from `dispatch-task-run`.

- **Never** call `ask_user` to clarify the topic slug.
- If `knowledge_topic` is missing from context at stage 1, treat as infrastructure failure: set `refresh_skipped: true` and do not invent a capture-style topic question.
- Auto dispatch pre-seeds `runInput.rerun_intent` — stage 1 keeps it and does **not** ask `proceed_mode`.
- Todo-driven `expand_questions` (stage 3) is the only other permitted ask-user path for gap-filling.

## Stage 1 — topic canonicalize then rerun intent

1. **Canonicalize** — `/nixery(resolve-topic, topicText, slug)`. If `matchedBy === 'new'` and `suggestMerge` is non-empty, `*pick_canonical_topic` (see `~/task-skills/pick-canonical-topic/SKILL.md`) using intake hints. Mastermind does **not** fuzzy-match.
2. **Exact policy** — `/mastermind(resolve-topic-policy, topic: knowledge_topic)`. Unknown slug → skill `ok: false` → set `refresh_skipped: true` (soft skip). Do not invent a synthetic policy row.
3. **runInput pre-seed** — if `rerun_intent` is a **structured** object with `proceedMode`, keep it (string NL does **not** count).
4. **Actionable `instruction_followup`** — build via `*build_refresh_rerun_intent`, then apply `scopeHints` when present (`proceedMode: update_selected`). Skip ask-user.
5. **Manual + corpus** — if neither above and corpus exists, stage 1 asks via `/ask-user-batch` (see `rerun-intent/SKILL.md`).
6. **No corpus** — `*build_refresh_rerun_intent(refresh_policy)` below.

When policy succeeds, set `knowledge_topic = refresh_policy.canonical`.

When `instruction_followup.actionable`, append `missionAddon` to `missionText` and union `seedUrls` into `learning_contract.seedUrls`.

```text
const topicRef = /nixery(resolve-topic, topicText: knowledge_topic, slug: knowledge_topic);
// … pick canonical if needed …
const policyRef = /mastermind(resolve-topic-policy, topic: knowledge_topic);
IF: policyRef.ok === false || !policyRef.row;
  refresh_skipped = true;
ELSE;
  refresh_policy = policyRef.row;
  refresh_skipped = policyRef.refresh_skipped;
END:
```

`refresh_skipped` from a **found** row is true only when `refresh_policy.refresh.enabled !== true`. A null `interval` does **not** skip an explicit `knowledge_refresh` run.

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
