# clarify-intake

Fixed ask-user batch for stage 0 (clarify). Read before emitting the first `ask_user` call.

## Fixed batch spec

Emit `ask_user` with `version: "askUserBatch.v1"` and this single batch:

| questionRef | kind | title | options / notes |
|-------------|------|-------|-----------------|
| `intent` | multipleChoice | Why do you want to learn about this? | `personal_interest` — Personal interest; `preserve_for_future_tasks` — Preserve for future agent tasks |
| `topic` | text | What subject should we learn about? | Required unless seed URLs alone define the subject |
| `direction` | text | Any angle or focus? (optional) | placeholder: e.g. pros/cons, beginner overview, compare options |
| `seed_urls` | text | Seed URLs (one per line, optional) | placeholder: https://… |
| `depth` | multipleChoice | How deep should we go? | `overview` — Overview; `deep_dive` — Deep dive |
| `language` | text | Preferred language for the brief (optional) | placeholder: e.g. en, zh-TW |

## Build learning_contract

After answers, normalize into context:

```json
{
  "intent": "personal_interest | preserve_for_future_tasks",
  "topic": "string",
  "direction": "string or empty",
  "seedUrls": ["url", "..."],
  "depth": "overview | deep_dive",
  "language": "string or empty"
}
```

## knowledge_topic slug

Derive `knowledge_topic` from `topic` (kebab-case, max 64 chars). If topic is empty but seed URLs exist, derive from first URL hostname + path segment.

## clarify_qa_log

Append each questionRef + answer to `clarify_qa_log` for verify follow-ups.

## When to call design-questions

Only after the fixed batch if verify fails because:

- `topic` is empty and no valid seed URLs
- `intent` or `depth` missing
- `direction` conflicts with topic (e.g. topic says "X" but direction contradicts)

Pass `mission` from `~/task-skills/task-mission/SKILL.md` on every design-questions call.
