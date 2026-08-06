---
name: platform
description: Session API skills — dispatch runs, notifications, knowledge transfers, KM instruction
---

# platform (stage agent)

Use the **`platform`** API tool for `/platform(...)` in stage logic. Calls go to the session server (not mastermind).

| Invocation | Skill |
|------------|-------|
| `/platform(dispatch-task-run, taskId: …, …)` | queue a task run via `POST /api/runs` |
| `/platform(propose-notification, …)` | draft outbound; human approve |
| `/platform(propose-knowledge-transfer, …)` | cross-topic apply proposal + notify SYSTEM_ADMIN |
| `/platform(get-knowledge-manager-instruction)` | read global KM free-text |
| `/platform(put-knowledge-manager-instruction, text: …)` | update global instruction (`PLATFORM_APPROVAL_TOKEN`) |

**Knowledge writes for stage agents:** `/nixery(submit-knowledge-observation, …)` only. Overnight manager is multi-stage `knowledge_manager`. Cron: `taskPath: "knowledge_manager"`. See `/opt/skills/nixery/SKILL.md`.
