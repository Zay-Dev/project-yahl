# synthesize-user-profile

Task-local skill for producing dual Markdown user profiles.

## Purpose

Synthesize a holistic user profile from onboarding stage bundles, Q&A logs, and persisted knowledge.

## Output shape

Produce **Markdown** with sections for:

1. Identity & background
2. Goals & priorities
3. Preferences & constraints
4. Communication style

Use headings (`#`, `##`), bullets, and short prose. No placeholder text.

## Two authors

| Field | Author | Source |
|-------|--------|--------|
| `result.research` | Nixery via `/nixery(research, guidelinePath: ~/task-skills/synthesize-user-profile/SKILL.md, facts: …)` | wiki corpus + structured facts |
| `result.agent` | Stage agent following this same SKILL at `~/task-skills/synthesize-user-profile/SKILL.md` | in-session context + Q&A logs |

Both documents cover the same user; tone/structure may differ. Final profiles persist to wiki page `brief`; structured mirror under `raw/user_profile_summary`.

## Fact sources (required)

Build all four sections from structured context keys when present:

- `identity_profile`, `goals_profile`, `preferences_profile`, `communication_profile`

When structured keys are missing, derive from ask-user answers before marking anything TBD:

| Missing key | Fallback ask-user keys |
|-------------|------------------------|
| `goals_profile` | `ask_user_shortTermGoals_answer`, `ask_user_longTermGoals_answer`, `ask_user_priorities_answer`, `ask_user_successCriteria_answer` |
| `preferences_profile` | `ask_user_pref_tools_answer`, `ask_user_pref_topics_answer`, `ask_user_constraints_boundaries_answer`, `ask_user_constraints_avoid_answer` |

Never emit "TBD" or "pending" for Goals or Preferences when fallback answers exist in context.

Read `~/task-skills/build-onboarding-profiles/SKILL.md` for normalization rules (especially `topics: string[]`).

## Mastermind call

Stage agent passes structured facts from context and session knowledge extracts (`~/nixery/get-knowledge/*.md` markdown). Nixery loads this file via `guidelinePath` behind an untrusted-content banner.

## Verify expectations

Both Markdown strings must be non-empty, include all four section areas, and not contradict persisted wiki pages for `user-onboarding`.

## Open questions

After synthesis, identify gaps the profile cannot resolve from Q&A, knowledge, or `open_questions_qa` answers.

Emit a separate list (not in Markdown body):

```json
{ "items": ["question 1", "question 2"] }
```

Rules:

- Include only genuine unknowns — not fields already captured in profiles.
- Remove items answered in `open_questions_qa` this run.
- Carry forward unanswered items from prior `open_questions` extract unless superseded.
- Persist via stage logic: `/nixery(upsert-knowledge-page, key: open_questions, value: { items: [...] })` — overview summary + `raw/open_questions`.

When `open_questions_qa` is present, weave answered content into the relevant profile sections before computing remaining open questions.

## Summary-only rerun

When `rerun_intent.proceedMode === summary_only`, rebuild all four sections from extracted knowledge + `open_questions_qa`; prior stage context keys may be loaded from extract rather than in-session Q&A.

## Helper pseudo-ops (stage agent)

### `*load_profile_from_knowledge(knowledge, key, as: TProfile)`

Parse structured profile from extract text for summary-only rerun.

### `*extract_open_questions_from_synthesis(mastermindMd, agentMd, open_questions_qa, pending_open_questions, guideline)`

Return `{ items: string[] }` per Open questions rules above; exclude answered and already-resolved items.
