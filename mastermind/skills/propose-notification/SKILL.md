---
name: propose-notification
description: Draft an outbound email or WhatsApp notification for human approval — does not send.
---

# propose-notification

Use `/mastermind(propose-notification, channel: …, direction: …, to: …, body: …)` in stage logic.

Creates a **pending** platform proposal. A human must approve at `/platform/approvals` before the worker sends.

## Tool

```json
{
  "skill": "propose-notification",
  "args": {
    "body": "Session paused — please answer the question in the web UI.",
    "channel": "whatsapp",
    "direction": "to_user",
    "to": "+85291234567"
  }
}
```

- `channel` — `email` | `whatsapp` (required).
- `direction` — `to_user` | `on_behalf_of_user` (required).
- `to` — recipient address or E.164 phone (required).
- `body` — message text (required).
- `fromIdentity` — optional sender identity.
- `templateRef` — optional template key.
- `taskRef` — optional task id for traceability.

`sessionId` is injected from the stage run when omitted.

Returns `{ proposalId }` on success. Does not deliver — worker sends only after approval.
