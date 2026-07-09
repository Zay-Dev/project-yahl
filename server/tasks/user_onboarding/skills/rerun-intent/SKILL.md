# rerun-intent

Rerun gate for user-onboarding when persisted knowledge already exists.

Read before emitting ask-user batches on a rerun (when `get-knowledge` for topic `user-onboarding` is not absent).

## Context types

```json
{
  "isRerun": true,
  "proceedMode": "update_selected | full_refresh | summary_only",
  "updateScope": ["identity", "goals", "preferences", "communication", "profile_summary"],
  "addressOpenQuestions": true
}
```

## Batch 1 — rerun intent

Emit `ask_user` with `version: "askUserBatch.v1"`:

| questionRef | kind | allowMultiple | Options |
|-------------|------|---------------|---------|
| `proceed_mode` | multipleChoice | false | `update_selected` — Update selected areas only; `full_refresh` — Full refresh (re-ask all stages); `summary_only` — Refresh profile summary only |
| `update_scope` | multipleChoice | **true** | Only include options backed by existing corpus keys (see below) |
| `address_open_questions` | multipleChoice | false | `yes`, `no` — only when `pending_open_questions.length > 0` |

### update_scope options (include when corpus has data)

| id | Include when |
|----|--------------|
| `identity` | `identity` or `background_summary` in extract |
| `goals` | `goals` or `priorities` in extract |
| `preferences` | `preferences` or `constraints` in extract |
| `communication` | `communication_style` in extract |
| `profile_summary` | `user_profile_summary` in extract |

When no corpus keys match, offer only `full_refresh`.

### proceed_mode rules

- `full_refresh` — ignore `update_scope`; force all stages 1–4 through ask-user path when gaps exist.
- `summary_only` — stages 1–4 rebuild from knowledge only (no ask-user); stage 5 always runs.
- `update_selected` — only stages in `update_scope` bypass smart-skip.

## Batch 2 — open questions pick (conditional)

When `address_open_questions === yes` and `pending_open_questions.length > 0`:

| questionRef | kind | allowMultiple |
|-------------|------|---------------|
| `open_questions_pick` | multipleChoice | **true** |

One option per pending question: `{ id: "oq_0", label: "<question text truncated to 120 chars>" }`.

Then call `/mastermind(design-questions, gaps: <picked question texts>, priorQa: open_questions_qa, mission: …)`.

## Helper pseudo-ops

### `*extract_open_questions(knowledgeExtractRef)`

Parse `open_questions.items[]` from extract; fallback to empty array.

### `*build_rerun_intent_batch(extracted, pendingOpenQuestions, guideline)`

Build Batch 1 spec per tables above.

### `*parse_rerun_intent(answers)`

Map ask-user answers to `TRerunIntent`. Default `proceedMode: update_selected`, `updateScope: []`, `addressOpenQuestions: false` when first run (no rerun gate).

### `*should_update_scope(scopeKey, rerun_intent)`

| Condition | Returns |
|-----------|---------|
| `rerun_intent` absent or not rerun | false |
| `proceedMode === full_refresh` | true |
| `proceedMode === summary_only` | true only when `scopeKey === profile_summary` |
| `proceedMode === update_selected` | true when `scopeKey` in `updateScope` |

Stage scope map: `identity`→1, `goals`→2, `preferences`→3, `communication`→4, `profile_summary`→5.

### `*build_open_questions_pick_batch(pendingOpenQuestions)`

Checkbox batch for Batch 2.

### `*picked_open_questions(pickAnswers)`

Return question strings for selected `open_questions_pick` option ids.

### `*merge_open_questions_qa(prior, answers)`

Append `{ questionRef, question, answer }` entries; dedupe by `questionRef`.

## Persist

After open-question answers: `/mastermind(upsert-knowledge-page, topic: user-onboarding, key: open_questions_qa, value: { items: [...] })` — stored under `raw/open_questions_qa` only.
