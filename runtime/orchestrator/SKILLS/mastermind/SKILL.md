---
name: mastermind
description: Gateway helper skills — instruction, dispatch, notifications, knowledge transfers
---

# mastermind (stage agent)

Use the **`mastermind`** API tool for `/mastermind(...)` in stage logic. Mastermind is HTTP-only (no Cursor).

| Invocation | Tool skill |
|------------|------------|
| `/mastermind(list-topic-policies)` | registry rows (labels only; intervals retired for scheduling) |
| `/mastermind(get-knowledge-manager-instruction)` | global do/don't/focus free-text |
| `/mastermind(put-knowledge-manager-instruction, text: …)` | update global instruction |
| `/mastermind(dispatch-task-run, taskId: …, …)` | queue a task run |
| `/mastermind(propose-notification, …)` | draft outbound; human approve |
| `/mastermind(propose-knowledge-transfer, …)` | cross-topic apply proposal + notify SYSTEM_ADMIN |

Deprecated for overnight scheduling: `evaluate-knowledge-refresh`, `patch-topic-policy` interval toggles — use global instruction + `knowledge_manager` instead.

**Knowledge writes for stage agents:** `/nixery(submit-knowledge-observation, …)` only. Overnight manager is multi-stage `knowledge_manager` (intake → research feedback → `apply-manager-topic` → group → `propose-knowledge-transfer` → `apply-approved-transfers`). See `/opt/skills/nixery/SKILL.md`.
