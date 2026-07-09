# build-onboarding-profiles

Task-local skill for building structured stage profile objects in agent context.

Read this file before `*build_goals_profile`, `*build_preferences_profile`, or similar profile builders.

## Rules

1. Always write the full profile object to context via `set_context` using the stage `produceContextKeys` name (e.g. `goals_profile`, `preferences_profile`).
2. Do not persist boolean maps or nested objects where the YAHL type expects `string[]`.
3. Prefer normalized string tokens (snake_case) in arrays; include free-text themes as additional array entries.
4. Persist with `upsert-knowledge-page` using legacy keys (`identity`, `goals`, …). Mastermind dual-writes elaborated markdown to `overview`/`brief` and structured JSON to `raw/{key}` — see `server/tasks/_shared/skills/knowledge-wiki-style/SKILL.md`.

## build_goals_profile

Input: stage Q&A log, knowledge, optional `identity_profile`.

Output shape:

```json
{
  "shortTermGoals": ["ship_feature", "build_project"],
  "longTermGoals": ["architecture_leadership"],
  "priorities": ["speed", "quality"],
  "successCriteria": ["launch side project", "improve income"]
}
```

Mapping:

| Source | Target |
|--------|--------|
| MC answers for short/long-term goals | `shortTermGoals`, `longTermGoals` (option ids or labels as strings) |
| MC priorities | `priorities` |
| Free-text success criteria | `successCriteria` as one or more strings (split phrases if needed) |

If MC answers exist but structured profile keys are missing, derive the profile from `ask_user_*` answers before stage finish.

## build_preferences_profile

Input: stage Q&A log, knowledge.

Output shape:

```json
{
  "tools": ["cursor", "github", "docker"],
  "topics": ["side_projects", "personal_assistant", "rapid_learning", "automation_monetization"],
  "boundaries": ["no_secrets", "no_prod_changes"],
  "avoid": ["over_engineering", "verbose_output"]
}
```

### topics normalization (required)

`topics` must be `string[]`, never an object with boolean flags.

Build `topics` by:

1. Selected MC option ids/labels → string tokens.
2. Parse free-text `pref_topics` into distinct theme strings (side projects, personal assistant, rapid learning, automation/monetization, etc.).
3. Merge and dedupe into a flat array.

Wrong:

```json
{ "side_projects": true, "automation": true, "topics_summary": "..." }
```

Right:

```json
["side_projects", "personal_assistant", "rapid_learning", "automation_monetization", "ai_agents"]
```

### Other fields

| Field | Source |
|-------|--------|
| `tools` | MC `pref_tools` option ids |
| `boundaries` | MC `constraints_boundaries` option ids |
| `avoid` | MC `constraints_avoid` option ids |

Persist the same normalized object via `upsert-knowledge-page` (`preferences`, `constraints` keys). Mastermind writes wiki overview sections + `raw/` JSON automatically.

## Verification

Before calling verify, confirm every `produceContextKeys` entry for the stage exists in context and matches the YAHL type (especially `topics: string[]`).
