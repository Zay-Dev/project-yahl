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
| `result.mastermind` | Mastermind via `/mastermind(research, guidelinePath: ~/task-skills/synthesize-user-profile/SKILL.md, facts: …)` | knowledges + structured facts |
| `result.agent` | Stage agent following this same SKILL at `~/task-skills/synthesize-user-profile/SKILL.md` | in-session context + Q&A logs |

Both documents cover the same user; tone/structure may differ.

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

Stage agent passes structured facts from context and session knowledge extracts (`~/knowledge/*.json` `.extracted`). Mastermind loads this file via `guidelinePath` behind an untrusted-content banner.

## Verify expectations

Both Markdown strings must be non-empty, include all four section areas, and not contradict persisted `knowledges/user-onboarding/` facts.
