# Tricks

Operator tips that are easy to miss.

## `additional_instruction` on `knowledge_refresh`

Do **not** put free-text guidance in `rerun_intent` — that key must stay a structured object (`proceedMode`, `updateScope`, …). Put natural-language guidance in optional `additional_instruction`.

After `get-knowledge`, a dedicated stage parses it into `instruction_followup`:

- `{ actionable: false, reason }` when blank
- `{ actionable: true, missionAddon, seedUrls, scopeHints, failFast, notes }` when there is work to do

Stage 1 merges mission/seed/scope hints and only keeps `rerun_intent` when it is structured.

Example:

```bash
curl -sS -X POST "http://127.0.0.1:4000/api/runs" \
  -H 'Content-Type: application/json' \
  -d '{
    "taskId": "knowledge_refresh",
    "runInput": {
      "knowledge_topic": "project yahl",
      "additional_instruction": "all, try refresh from discussion https://share.google/aimode/abcdefg, fail fast if cannot access the discussion"
    }
  }'
```

## Fuzzy topic vs exact policy

- **Ambiguous names** (e.g. `project yahl`) → nixery `resolve-topic` (+ agent `pick-canonical-topic` when `suggestMerge` is present) → exact slug such as `project-yahl-develop`.
- **Mastermind `resolve-topic-policy`** → exact slug or declared alias only; unknown → `{ ok: false }` (404-style), not fuzzy guess.

Structured `rerun_intent` still works for auto dispatch:

```json
{
  "knowledge_topic": "project-yahl-develop",
  "rerun_intent": {
    "isRerun": true,
    "proceedMode": "update_selected",
    "updateScope": ["studies", "facts", "synthesis", "summary"],
    "addressOpenQuestions": false
  }
}
```

## Novel tasks (`novel_*`)

Novels reuse `topics/{slug}/` via `resolve-topic` / `get-knowledge` / `upsert-knowledge-page` with **`page` + `content`** (do not add novel keys to the knowledge key map). Pass `novel` in `runInput` or the first stage asks.

```bash
curl -sS -X POST "http://127.0.0.1:4000/api/runs" \
  -H 'Content-Type: application/json' \
  -d '{
    "taskId": "novel_design",
    "runInput": {
      "novel": "my-novel-slug",
      "additional_instruction": "new idea: a quiet coastal city where clocks run backward"
    }
  }'
```

Pipeline order: `novel_design` → `novel_plan_arc` → `novel_plan_stages` → `novel_plan_batch` → `novel_write`.

After `novel_write`, sync chapters to tracked `novels/` for GitHub Pages (then commit/push `develop`):

```bash
./scripts/sync-novels-pages.sh
```
