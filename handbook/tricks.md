# Tricks

Operator tips that are easy to miss.

## `additional_instruction` (YAHL `runInput`)

Optional free-text **this-run** override. Declare the key under the task's `runInput:` list. Blank/missing → ignore. Never writes durable Knowledge Manager instruction or wiki.

`knowledge_manager` parses it into `instruction_followup` (`missionAddon` merges into this-run mission).

Example:

```bash
curl -sS -X POST "http://127.0.0.1:4000/api/runs" \
  -H 'Content-Type: application/json' \
  -d '{
    "taskId": "knowledge_manager",
    "runInput": {
      "additional_instruction": "Focus depth on project-yahl and hk-weather tonight"
    }
  }'
```

## `source_instruction` on `traffic_monitor`

Optional free-text **this-run** operator override for explore / source selection. Use it for one-offs (e.g. allow revisiting a source that durable `source-ops-*` still marks SKIP/FAIL) — do **not** patch wiki knowledge for a single run.

A `conditionMode` VM stage sets `instruction_active` from a trimmed blank check:

- blank / missing → `instruction_active: false` → normal durable known-failed auto-skip
- non-blank → `instruction_active: true` → explore must apply the free text (no blind “did not re-probe”)

Example:

```bash
curl -sS -X POST "http://127.0.0.1:4000/api/runs" \
  -H 'Content-Type: application/json' \
  -d '{
    "taskId": "traffic_monitor",
    "runInput": {
      "monitor_minutes": "20",
      "notify_to": "91234567",
      "origin": "Kowloon Tong",
      "destination": "Hong Kong International Airport",
      "source_instruction": "one off allow revisit HKeMobility",
      "city": "Hong_Kong",
      "timezone": "Asia/Hong_Kong"
    }
  }'
```

## Fuzzy topic vs exact policy

- **Ambiguous names** (e.g. `project yahl`) → nixery `resolve-topic` (+ agent `pick-canonical-topic` when `suggestMerge` is present) → exact slug such as `project-yahl-develop`.

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

## Greets / WhatsApp

Register the chat before you expect inbox stacking — run `greets` with `register_channel: true` (default when you leave it blank-ish), then cron `whatsapp_wiki_stack`. Unregistered chats never enter `data/whatsapp_inbox`.

Whitelist entries are comma-separated digits or `+852…` (or full `@c.us` / `@g.us` ids). Matching propose recipients skip `/platform/approvals`.

Wiki roots matter:

- `greets/{entity}/` — person/group knowledge from the greet task
- `whatsapp/{slug}/` — channel extract + stacked inbox
- `topics/{slug}/` — curated subject knowledge (different tree; don’t mix them)

Send/receive still live on the worker (`WHATSAPP_ENABLED=true`, QR in worker logs). YAHL only greets, stacks, and proposes.
