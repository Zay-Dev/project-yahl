---
name: platform
description: Session API skills — dispatch runs, notifications, knowledge transfers, KM instruction
---

# platform (stage agent)

Use the **`platform`** API tool for `/platform(...)` in stage logic. Calls go to the session server (not mastermind). Read this file before calling — do not grep `/opt`, `/omniflex`, or other sessions for the contract.

**Knowledge writes for stage agents:** `/nixery(submit-knowledge-observation, …)` only. Overnight manager is multi-stage `knowledge_manager`. Cron: `taskPath: "knowledge_manager"`. See `/opt/skills/nixery/SKILL.md`.

## `propose-notification`

Draft outbound; human approve (whitelist recipients may auto-approve). Pass **only** these keys:

| Key | Required | Values |
|-----|----------|--------|
| `channel` | yes | `email` \| `whatsapp` |
| `to` | yes | WhatsApp: resolved JID (`notifyTo`). Email: address. |
| `direction` | yes | `to_user` \| `on_behalf_of_user` |
| `body` | yes | full message text |

```json
{
  "skill": "propose-notification",
  "args": {
    "channel": "whatsapp",
    "to": "85292195667@c.us",
    "direction": "to_user",
    "body": "[Name] title and body. Embed preference and language here."
  }
}
```

- `direction` is never `outbound`. Contact recipients use `to_user`.
- Embed name, kind (A/B/C), and language preference **inside `body`**. Do not pass `kind`, `taskRef`, `fromIdentity`, or other invented top-level keys.
- Runtime fills `sessionId`. `{ ok: true, data: { proposalId } }`.

## `dispatch-task-run`

Queue a task via `POST /api/runs`.

| Key | Required |
|-----|----------|
| `taskId` | yes (e.g. `knowledge_manager`) |
| `runInput` | no — object of string fields |

```json
{
  "skill": "dispatch-task-run",
  "args": {
    "taskId": "knowledge_manager",
    "runInput": {}
  }
}
```

## `propose-knowledge-transfer`

Cross-topic apply proposal + notify SYSTEM_ADMIN.

| Key | Required |
|-----|----------|
| `sourceTopic` | yes |
| `targetTopic` | yes (must differ from source) |
| `claim` | yes |
| `rationale` | yes |

```json
{
  "skill": "propose-knowledge-transfer",
  "args": {
    "sourceTopic": "inbox",
    "targetTopic": "traffic-monitor",
    "claim": "short claim",
    "rationale": "why these topics should merge or transfer"
  }
}
```

## `get-knowledge-manager-instruction`

No args. Returns `{ ok: true, data: { text } }`.

## `put-knowledge-manager-instruction`

Update global KM free-text. Requires host `PLATFORM_APPROVAL_TOKEN`.

| Key | Required |
|-----|----------|
| `text` | yes |
