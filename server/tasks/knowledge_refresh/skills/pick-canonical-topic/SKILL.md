# pick-canonical-topic

Choose an exact knowledge topic slug before Mastermind `resolve-topic-policy`.

Mastermind only accepts exact canonical slugs (or declared aliases). Free-text / ambiguous names must be resolved here.

## Inputs

- `topicRef` from `/nixery(resolve-topic, topicText: …, slug: …)` — fields `canonical`, `matchedBy`, `suggestMerge?`, `aliases?`
- `~/nixery/get-knowledge/intake.md` when present (prefer `primaryTopic` / extracted topic slugs)

## Rules

1. If `topicRef.matchedBy` is `slug`, `text`, or `url` — use `topicRef.canonical` as-is.
2. If `matchedBy === 'new'` and `suggestMerge` is a non-empty array:
   - Prefer a slug that matches intake `primaryTopic` or a clearly primary corpus folder in intake.
   - Else prefer the shortest `suggestMerge` entry that starts with the sanitized free-text slug (e.g. `project-yahl` → `project-yahl-develop`).
   - Else pick the strongest single match from intake; do not invent a slug outside `suggestMerge` + `topicRef.canonical`.
3. If `matchedBy === 'new'` and `suggestMerge` is empty — keep `topicRef.canonical` (policy may 404 → refresh skip).

## Output

Set `knowledge_topic` to the chosen exact slug string only.
