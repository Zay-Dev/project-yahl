# assess-onboarding-stage

Task-local skill for user onboarding smart-skip assessment.

## Purpose

Given extracted knowledge and prior stage Q&A, decide whether the current onboarding stage is **sufficient** or which **gaps** remain.

## Input (from stage context)

- Session extract markdown for topic `user-onboarding` (read from `~/nixery/get-knowledge/` artifacts)
- Stage-specific keys expected for this stage index
- `onboarding_qa_<stageIndex>` log if present
- Stage rubric from SKILL.yaml

## Output (via set_context)

Write an assessment object:

```json
{
  "sufficient": false,
  "gaps": ["preferred_name", "timezone"],
  "profile": {}
}
```

| Field | Meaning |
|-------|---------|
| `sufficient` | true when persisted knowledge + Q&A satisfy the stage goal |
| `gaps` | missing fields/topics; empty when sufficient |
| `profile` | optional partial profile extracted from knowledge |

## Smart skip

When `sufficient: true`:

1. Build stage `produceContextKeys` from extracted knowledge (no ask_user).
2. Call `upsert-knowledge-page` for stage keys (dual-write: overview sections + `raw/`).
3. Proceed to verify.

When `sufficient: false`:

1. Call `/nixery(design-questions, stage: N, gaps: …, priorQa: …)`.
2. Emit `ask_user` batch from the returned batch spec.
3. Merge answers into context and `onboarding_qa_<stageIndex>`.
4. Re-assess until sufficient or ready for verify.

## Stage checklists

| Stage | Required keys |
|-------|----------------|
| 1 Identity | preferred name, role, timezone, languages, background |
| 2 Goals | short/long-term goals, priorities, success criteria |
| 3 Preferences | tools, topics, boundaries, avoid list |
| 4 Communication | tone, detail level, language preference, proactivity |
| 5 Synthesis | all prior stage bundles present for dual Markdown synthesis |

Rerun: re-assess against knowledge corpus; skip ask_user when knowledge already satisfies the stage **unless** `rerun_intent` forces update.

## Rerun intent override

When `rerun_intent.isRerun` is true, read `~/task-skills/rerun-intent/SKILL.md`:

- `*should_update_scope(scopeKey, rerun_intent)` returns true → treat as **not sufficient** even when knowledge is complete (force ask-user or rebuild path).
- Stage scope keys: `identity` (1), `goals` (2), `preferences` (3), `communication` (4).
- `proceedMode === summary_only` → always sufficient for stages 1–4 (rebuild from knowledge only, no ask-user).
- `proceedMode === full_refresh` → never sufficient (always gaps path when any field missing).

When `rerun_intent` is absent (first run), smart-skip behaves as before.

## Profile builders

Before verify on stages 2–3, read `~/task-skills/build-onboarding-profiles/SKILL.md` and write normalized `goals_profile` / `preferences_profile` to context (not only Mastermind JSON).

- `goals_profile.topics` is invalid — goals use array fields only.
- `preferences_profile.topics` must be `string[]`, never boolean flags.
