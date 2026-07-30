---
name: propose-notification
description: Draft an outbound email or WhatsApp notification for human approval — does not send.
---

# propose-notification

Use `/mastermind(propose-notification, channel: …, direction: …, to: …, body: …)` in stage logic.

Creates a platform proposal. WhatsApp recipients on `WHATSAPP_WHITELIST` and email recipients on `EMAIL_WHITELIST` are **pre-approved**; others stay pending until a human approves at `/platform/approvals`. The worker sends after approval (or pre-approval). If WhatsApp is disconnected/logged out and SMTP + `SYSTEM_ADMIN_EMAIL` are configured, the worker emails an admin alert and retries the WhatsApp send when the client is ready again.

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

Returns `{ proposalId }` on success. Does not deliver — worker sends when the proposal is approved (whitelist pre-approve or human). WhatsApp requires a logged-in client; email requires SMTP when not stubbing.
