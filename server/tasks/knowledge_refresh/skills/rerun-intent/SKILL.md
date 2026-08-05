# rerun-intent

Rerun gate for **knowledge_refresh** when persisted corpus already exists for the resolved topic.

Read after `get-knowledge` returns non-absent for `knowledge_topic`.

## runInput pre-seed (knowledge_refresh)

When `rerun_intent` is a **structured** object with `proceedMode` (and usually `isRerun` / `updateScope`) seeded from `runInput`, **skip all ask-user batches** in stage 1. Auto dispatch supplies defaults; manual runs may pre-answer via `POST /api/runs` `runInput`.

A **string** or other non-object value is **not** a valid pre-seed — treat as absent (ask-user or build from policy / `instruction_followup`).

### `*is_structured_rerun_intent(rerun_intent)`

Returns true only when `rerun_intent` is a non-null object with string `proceedMode` in `update_selected` | `full_refresh` | `summary_only`.

Never ask rerun intent during types preamble (stage 0). Stage 1 owns proceed-mode intake.

## Context types

Same shape as user-onboarding `TRerunIntent`; scope ids differ (see below).

## Batch 1 — rerun intent

| questionRef | kind | allowMultiple | Options |
|-------------|------|---------------|---------|
| `proceed_mode` | multipleChoice | false | `update_selected`, `full_refresh`, `summary_only` |
| `update_scope` | multipleChoice | **true** | Only options backed by existing corpus (see below) |
| `address_open_questions` | multipleChoice | false | `yes`, `no` — when pending open questions exist |

### update_scope options

| id | Include when | Stage |
|----|--------------|-------|
| `clarify` | `learning_contract` or `meta` in extract | Clarify |
| `studies` | any `study_*` in extract | Study loop |
| `facts` | `facts` or `key_facts_md` in extract | Facts |
| `synthesis` | `analysis` or `analysis_md` in extract | Synthesis |
| `summary` | `summary` in extract | Final brief |

### proceed_mode rules

- `full_refresh` — re-run clarify intake; bypass all smart-skip.
- `summary_only` — skip clarify/studies/facts/synthesis regeneration; run final brief only.
- `update_selected` — only scopes in `updateScope` force re-work.

## Pending open questions

Source order:

1. `analysis.openQuestions[]` from extract JSON
2. Fallback: parse "Open Questions" section from `analysis_md` in extract

Write to `pending_open_questions` context key.

## Batch 2 — open questions pick

Same as user-onboarding: checkbox `open_questions_pick`, then `design-questions` (prefer MC) + ask-user for answers.

Read `~/task-skills/answer-open-questions/SKILL.md` for answer persistence and synthesis handoff.

## Helper pseudo-ops

### `*should_update_scope(scopeKey, rerun_intent)`

| Condition | Returns |
|-----------|---------|
| `rerun_intent` absent or not rerun | false |
| `proceedMode === full_refresh` | true |
| `proceedMode === summary_only` | true only when `scopeKey === summary`; false for `clarify`, `studies`, `facts`, `synthesis` |
| `proceedMode === update_selected` | true when `scopeKey` in `updateScope` |

### `*build_learning_contract_partial(topicAnswers, guideline)`

Map minimal intake answers to `{ topic, seedUrls }` only.

### `*load_learning_contract_from_corpus(knowledgeExtractRef, guideline)`

Rebuild full `TLearningContract` from extracted `learning_contract` JSON when clarify is skipped on rerun.

### Other helpers

Reuse patterns from user-onboarding rerun-intent: `*build_rerun_intent_batch`, `*parse_rerun_intent`, `*extract_open_questions`, `*build_open_questions_pick_batch`, `*picked_open_questions`, `*merge_open_questions_qa`.

## Persist

`/nixery(upsert-knowledge-page, topic: knowledge_topic, key: open_questions_qa, value: { items: [...] })`.
